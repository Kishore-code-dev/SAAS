import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import {
  DHIYU_SCOPE_REFUSAL,
  isFleetManagementQuery,
} from './src/utils/copilotContext'

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
  'Dhiyu is DriveMitra’s Fleet Management AI. DriveMitra monitors 8 core vehicle subsystems (Engine Oil & Thermal System, Brake Pads & Rotor Wear, Battery & Alternator Electrical, Tyre Tread & Alignment, Transmission & Clutch, Cooling & Radiator System, Suspension & Shock Absorbers, Air Filter & Intake) using software-only telemetry (odometer, daily utilization, days since service, corridor road stress, harsh events, and pre-trip inspections) and quantifies preventive repair cost vs breakdown delay exposure in INR.'

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
  let lastMessage = 'Unable to reach OpenCode AI free inference gateway.'

  for (const model of FREE_OPENCODE_MODELS) {
    try {
      const response = await fetch(OPENCODE_CHAT_ENDPOINT, {
        method: 'POST',
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

      // Only fail fast on auth rejection; try alternate free models on transient errors
      if (response.status === 401 || response.status === 403) {
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
  const app = express()
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      aiName: 'Dhiyu',
      provider: 'opencode-zen',
      model: FREE_OPENCODE_MODELS[0],
      freeModels: FREE_OPENCODE_MODELS,
      configured: true,
      hasApiKey: Boolean(getOpenCodeApiKey()),
    })
  })

  app.post('/api/copilot', async (req, res) => {
    const body = req.body as {
      query?: unknown
      systemInstruction?: unknown
      history?: unknown
    }

    const query = typeof body?.query === 'string' ? body.query.trim() : ''
    const clientSystemInstruction =
      typeof body?.systemInstruction === 'string' ? body.systemInstruction : ''
    const rawHistory = Array.isArray(body?.history) ? (body.history as ChatHistoryTurn[]) : []

    if (!query) {
      res.status(400).json({ error: 'Enter a fleet management question to ask Dhiyu.' })
      return
    }

    if (!isFleetManagementQuery(query, [], rawHistory.length > 0)) {
      res.json({
        answer: DHIYU_SCOPE_REFUSAL,
        model: 'scope-guard',
        provider: 'opencode-zen',
        scopeRefused: true,
      })
      return
    }

    const systemInstruction = clientSystemInstruction.includes('DRIVEMITRA FLEET MAINTENANCE DOMAIN KNOWLEDGE')
      ? clientSystemInstruction
      : [
          'You are Dhiyu, DriveMitra’s Fleet Management AI.',
          'ONLY answer fleet management questions related to DriveMitra vehicles, predictive maintenance, RUL windows, cost of delay, driver safety, fuel logs, and fleet financials. Politely refuse anything unrelated.',
          DEFAULT_MAINTENANCE_KNOWLEDGE,
          clientSystemInstruction,
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
          content: turn.text.trim(),
        })
      }
    }

    messages.push({ role: 'user', content: query })

    try {
      const result = await queryOpenCodeFree(messages)
      res.json({
        answer: result.answer,
        model: result.model,
        provider: 'opencode-zen',
      })
    } catch (err) {
      const status = (err as { status?: number })?.status ?? 502
      const msg = err instanceof Error ? err.message : String(err)
      if (status === 429 || msg.includes('FreeUsageLimitError')) {
        res.status(429).json({
          error:
            'OpenCode AI free-tier anonymous quota for this server IP is temporarily reached. Add a free OPENCODE_ZEN_API_KEY (from opencode.ai/auth) in Settings > Secrets for dedicated access, or try again shortly.',
        })
        return
      }
      if (status === 401 || status === 403) {
        res.status(403).json({
          error:
            'OpenCode AI API key was rejected or lacks permission. Please verify OPENCODE_ZEN_API_KEY in Settings > Secrets.',
        })
        return
      }
      res.status(502).json({
        error: `Unable to reach OpenCode AI service (${msg}). Please try again shortly.`,
      })
    }
  })

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
