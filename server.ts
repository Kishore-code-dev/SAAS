import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { GoogleGenAI, ThinkingLevel } from '@google/genai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = Number(process.env.PORT) || 3000
const MODEL_NAME = 'gemini-3.1-flash-lite'
const DEFAULT_MAINTENANCE_KNOWLEDGE =
  'DriveMitra monitors 8 core vehicle subsystems (Engine Oil & Thermal System, Brake Pads & Rotor Wear, Battery & Alternator Electrical, Tyre Tread & Alignment, Transmission & Clutch, Cooling & Radiator System, Suspension & Shock Absorbers, Air Filter & Intake) using software-only telemetry (odometer, daily utilization, days since service, corridor road stress, harsh events, and pre-trip inspections) and quantifies preventive repair cost vs breakdown delay exposure in INR.'

interface ChatHistoryTurn {
  role: 'user' | 'model'
  text: string
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return null
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  })
}

async function generateWithRetry(
  ai: GoogleGenAI,
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
  systemInstruction: string,
) {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents,
        config: {
          systemInstruction,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
        },
      })
      return response.text ?? ''
    } catch (err) {
      lastError = err
      const msg = err instanceof Error ? err.message : String(err)
      const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('ECONNRESET')
      if (!isTransient || attempt === 1) {
        throw err
      }
      await new Promise((res) => setTimeout(res, 600))
    }
  }
  throw lastError
}

async function startServer() {
  const app = express()
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      model: MODEL_NAME,
      configured: Boolean(process.env.GEMINI_API_KEY),
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
    const systemInstruction = clientSystemInstruction.includes('DRIVEMITRA FLEET MAINTENANCE DOMAIN KNOWLEDGE')
      ? clientSystemInstruction
      : [
          'You are DriveMitra Fleet Maintenance & Operations Copilot.',
          DEFAULT_MAINTENANCE_KNOWLEDGE,
          clientSystemInstruction,
        ]
          .filter(Boolean)
          .join('\n\n')
    const rawHistory = Array.isArray(body?.history) ? (body.history as ChatHistoryTurn[]) : []

    if (!query) {
      res.status(400).json({ error: 'Enter a fleet or maintenance question to ask Copilot.' })
      return
    }

    const ai = getGeminiClient()
    if (!ai) {
      res.status(503).json({
        error:
          'Gemini API key (GEMINI_API_KEY) is not configured on the server. Add it in Settings > Secrets to enable live Gemini responses.',
      })
      return
    }

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = []
    for (const turn of rawHistory.slice(-8)) {
      if (
        (turn.role === 'user' || turn.role === 'model') &&
        typeof turn.text === 'string' &&
        turn.text.trim()
      ) {
        contents.push({
          role: turn.role,
          parts: [{ text: turn.text.trim() }],
        })
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: query }],
    })

    try {
      const answer = await generateWithRetry(ai, contents, systemInstruction)
      if (!answer.trim()) {
        res.status(502).json({
          error: 'The AI model returned an empty response. Please rephrase and try again.',
        })
        return
      }
      res.json({
        answer: answer.trim(),
        model: MODEL_NAME,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('403') || msg.includes('400')) {
        res.status(403).json({
          error:
            'Gemini API key was rejected or lacks permission. Please verify GEMINI_API_KEY in Settings > Secrets.',
        })
        return
      }
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
        res.status(429).json({
          error: 'Gemini free-tier rate limit reached. Please wait a moment and try again.',
        })
        return
      }
      res.status(502).json({
        error: `Unable to reach Gemini service (${MODEL_NAME}). Please verify network connectivity and API configuration.`,
      })
    }
  })

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
