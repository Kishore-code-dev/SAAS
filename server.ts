import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import {
  DHIYU_SCOPE_REFUSAL,
  isFleetManagementQuery,
} from './src/utils/dhiyuScope.ts'
import { attachSession, requireActiveOrganization, requireAuth, requirePasswordChanged, type AuthenticatedRequest } from './server/authMiddleware.ts'
import { sanitizeCopilotPayloadForLlm } from './server/authLogic.ts'
import { getDb } from './server/db.ts'
import { syncDbsReferenceFolder } from './server/dbsSync.ts'
import { buildApiRouter } from './server/routes.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = Number(process.env.PORT) || 3000
const OPENCODE_CHAT_ENDPOINT = 'https://opencode.ai/zen/v1/chat/completions'
const FREE_OPENCODE_MODELS = [
  'deepseek-v4.1-flash-free',
  'mimo-v2.6-flash-free',
  'glm-5.3-flash-free',
  'big-pickle',
] as const

const DEFAULT_MAINTENANCE_KNOWLEDGE =
  'Dhiyu is DriveMitra’s Fleet Management AI. DriveMitra monitors 5 core predictive health intelligence areas (Fuel Health, Engine Health, Tyre Health, Driver Health, and Vehicle Health) using fleet telemetry, odometer utilization, service history, inspection defects, and work order costs in INR (₹).'

interface ChatHistoryTurn {
  role: 'user' | 'model'
  text: string
}

interface OpenCodeChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
  error?: {
    type?: string
    message?: string
  }
}

function getOpenCodeApiKey(): string | null {
  const key = process.env.OPENCODE_ZEN_API_KEY || process.env.OPENCODE_API_KEY
  return key && key.trim() ? key.trim() : null
}

async function queryOpenCodeFree(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
): Promise<{ answer: string; model: string }> {
  const apiKey = getOpenCodeApiKey()
  let lastStatus = 502
  let lastMessage = 'Unable to reach OpenCode AI inference gateway.'

  for (const model of FREE_OPENCODE_MODELS) {
    try {
      const response = await fetch(OPENCODE_CHAT_ENDPOINT, {
        method: 'POST',
        signal: AbortSignal.timeout(4500),
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.25,
          max_tokens: 900,
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as OpenCodeChatResponse
      const content = payload?.choices?.[0]?.message?.content?.trim()

      if (response.ok && content) {
        return { answer: content, model }
      }

      lastStatus = response.status
      lastMessage =
        payload?.error?.message ||
        `OpenCode model ${model} returned HTTP ${response.status}.`

      if (response.status === 401 || response.status === 403 || response.status === 429) {
        break
      }
    } catch (err) {
      lastStatus = 502
      lastMessage = err instanceof Error ? err.message : String(err)
    }
  }

  const error = new Error(lastMessage) as Error & { status?: number }
  error.status = lastStatus
  throw error
}

async function startServer() {
  // Initialize SQLite database & pre-seed production tenants and Level-2 admin
  const liveDb = getDb()
  void syncDbsReferenceFolder(liveDb).catch((err) => {
    console.warn('[DBS-Sync] Initial startup sync failed:', err instanceof Error ? err.message : String(err))
  })

  const app = express()
  app.use(express.json({ limit: '8mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      aiName: 'Dhiyu',
      environment: 'production',
      configured: true,
    })
  })

  // Auth, Super Admin, Fleet Persistence, Document Vault, Truck Routing, Weather APIs
  app.use('/api', buildApiRouter())

  // Secured Dhiyu Fleet Intelligence Endpoint (Auth + Active Org + PII Redaction + User-Safe Errors)
  app.post(
    '/api/copilot',
    attachSession,
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    async (req: AuthenticatedRequest, res) => {
      const body = req.body as {
        query?: unknown
        systemInstruction?: unknown
        history?: unknown
        language?: unknown
      }

      const query = typeof body?.query === 'string' ? body.query.trim() : ''
      const clientSystemInstruction =
        typeof body?.systemInstruction === 'string' ? body.systemInstruction : ''
      const rawHistory = Array.isArray(body?.history) ? (body.history as ChatHistoryTurn[]) : []
      const activeLang = typeof body?.language === 'string' ? body.language.trim() : 'en'

      if (!query) {
        res.status(400).json({ error: 'Enter a fleet management question to ask Dhiyu.' })
        return
      }

      if (!isFleetManagementQuery(query, [], rawHistory.length > 0)) {
        res.json({
          answer: DHIYU_SCOPE_REFUSAL,
          model: 'scope-guard',
          scopeRefused: true,
        })
        return
      }

      // Sanitize any sensitive personal identifiers before outbound LLM inference
      const sanitizedContext = sanitizeCopilotPayloadForLlm(clientSystemInstruction)
      const languageDirective =
        activeLang && activeLang !== 'en'
          ? `Respond naturally in the active user interface language code "${activeLang}" while keeping Indian vehicle registration numbers and INR (₹) values clear.`
          : 'Respond clearly in English with INR (₹) formatting.'

      const systemInstruction = [
        'You are Dhiyu, DriveMitra’s Fleet Management AI.',
        'ONLY answer fleet management questions related to DriveMitra vehicles, 5-area predictive health, work orders, parts inventory, driver safety & compliance, fuel logs, and fleet financials. Politely refuse anything unrelated.',
        languageDirective,
        DEFAULT_MAINTENANCE_KNOWLEDGE,
        sanitizedContext,
      ]
        .filter(Boolean)
        .join('\n\n')

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemInstruction },
      ]

      for (const turn of rawHistory.slice(-8)) {
        if (
          (turn.role === 'user' || turn.role === 'model') &&
          typeof turn.text === 'string' &&
          turn.text.trim()
        ) {
          messages.push({
            role: turn.role === 'user' ? 'user' : 'assistant',
            content: sanitizeCopilotPayloadForLlm(turn.text.trim()),
          })
        }
      }

      messages.push({ role: 'user', content: sanitizeCopilotPayloadForLlm(query) })

      try {
        const result = await queryOpenCodeFree(messages)
        res.json({
          answer: result.answer,
          model: 'dhiyu-fleet-intelligence',
        })
      } catch (err) {
        const correlationId = crypto.randomUUID().slice(0, 8)
        const internalMsg = err instanceof Error ? err.message : String(err)
        console.error(`[Dhiyu][${correlationId}] Upstream inference unavailable:`, internalMsg)
        // Strict user-safe response: NEVER expose OpenCode IP quota, upstream keys, or provider diagnostics
        res.json({
          fallbackRecommended: true,
          correlationId,
          error:
            'Dhiyu is temporarily unable to process this request. Your fleet information has not been changed. Please try again shortly.',
        })
      }
    },
  )

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distDir = path.resolve(__dirname, 'dist')
    app.use(express.static(distDir))
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DriveMitra server listening on http://0.0.0.0:${PORT}`)
  })
}

startServer().catch((err) => {
  console.error('Failed to start DriveMitra server:', err)
  process.exit(1)
})
