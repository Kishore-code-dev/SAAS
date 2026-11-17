import React, { useRef, useState } from 'react'
import { Loader2, RotateCcw, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useFleet } from '../../hooks/useFleet'
import { queryFleetCopilot, type CopilotResponse } from '../../utils/copilotEngine'
import {
  buildMaintenanceSystemInstruction,
  DHIYU_SCOPE_REFUSAL,
  isFleetManagementQuery,
} from '../../utils/copilotContext'
import { DhiyuLogo } from '../ui/DhiyuLogo'

interface CopilotMessage {
  id: string
  sender: 'user' | 'copilot'
  text: string
  citations?: string[]
  blocked?: boolean
}

const SAMPLE_PROMPTS = [
  'Which vehicles need preventive maintenance soonest and what is the cost of delay?',
  'Explain our 8-component predictive maintenance risk for overdue vehicles',
  'Summarize 30-day maintenance & fuel spend and EV vs ICE TCO',
]

function renderInlineBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, idx) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={idx} className="font-bold text-[#625346]">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    ),
  )
}

function FormattedCopilotText({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const trimmed = lines[i].trim()
    if (!trimmed) {
      i += 1
      continue
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim())
        i += 1
      }
      const parseRow = (row: string) =>
        row
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim())
      const headers = parseRow(tableLines[0])
      const dataRows = tableLines
        .slice(1)
        .filter((r) => !/^\|[\s:-]+\|$/.test(r.replace(/[^|\s:-]/g, '')))
        .map(parseRow)

      blocks.push(
        <div key={`tbl-${i}`} className="space-y-1.5 my-1">
          {dataRows.map((cells, rIdx) => (
            <div
              key={rIdx}
              className="rounded-lg bg-[#FFFFFF] border border-[#E5E5E5] px-2.5 py-2 text-[11px] space-y-0.5"
            >
              {cells.map((cell, cIdx) => (
                <div key={cIdx} className="flex items-baseline justify-between gap-2">
                  <span className="text-[#958777] font-medium shrink-0">
                    {headers[cIdx] ?? ''}:
                  </span>
                  <span className="text-[#625346] font-semibold text-right">
                    {renderInlineBold(cell)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>,
      )
      continue
    }

    if (/^([-*_]){3,}$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${i}`} className="border-[#E5E5E5] my-1.5" />)
      i += 1
      continue
    }

    const headingMatch = trimmed.match(/^#{1,4}\s+(.*)$/)
    if (headingMatch) {
      const cleanHeading = headingMatch[1].replace(/\*\*/g, '').trim()
      blocks.push(
        <h4 key={`h-${i}`} className="text-xs font-bold text-[#625346] pt-1">
          {cleanHeading}
        </h4>,
      )
      i += 1
      continue
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''))
        i += 1
      }
      blocks.push(
        <ul key={`ul-${i}`} className="space-y-1 pl-3.5 list-disc marker:text-[#B8A3D9]">
          {items.map((item, idx) => (
            <li key={idx} className="text-xs font-medium text-[#625346] leading-relaxed">
              {renderInlineBold(item)}
            </li>
          ))}
        </ul>,
      )
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i += 1
      }
      blocks.push(
        <ol
          key={`ol-${i}`}
          className="space-y-1 pl-4 list-decimal marker:text-[#6E5696] marker:font-bold"
        >
          {items.map((item, idx) => (
            <li key={idx} className="text-xs font-medium text-[#625346] leading-relaxed">
              {renderInlineBold(item)}
            </li>
          ))}
        </ol>,
      )
      continue
    }

    blocks.push(
      <p key={`p-${i}`} className="text-xs font-medium text-[#625346] leading-relaxed">
        {renderInlineBold(trimmed)}
      </p>,
    )
    i += 1
  }

  return <div className="space-y-2">{blocks}</div>
}

export default function FleetCopilotDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const {
    activeOrganization,
    organizations,
    activeRole,
    vehicles,
    predictions,
    maintenanceRecords,
    riskAssessments,
    drivers,
    fuelTransactions,
    financialSummary,
  } = useFleet()

  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const msgSeqRef = useRef(0)
  const nextMsgId = (prefix: string) => {
    msgSeqRef.current += 1
    return `${prefix}-${msgSeqRef.current}`
  }

  const createWelcomeMessage = (): CopilotMessage => ({
    id: 'welcome',
    sender: 'copilot',
    text: `Hi, I’m Dhiyu — your dedicated Fleet Management AI for ${activeOrganization.name} (${activeOrganization.code}). I assist strictly with your fleet’s vehicles, 8-subsystem predictive maintenance, breakdown delay costs, driver safety, fuel verification, and TCO.`,
    citations: [
      `Tenant: ${activeOrganization.id}`,
      `Role: ${activeRole}`,
      'Scope: Fleet Management Only',
    ],
  })

  const [messages, setMessages] = useState<CopilotMessage[]>(() => [createWelcomeMessage()])

  if (!open) return null

  const activeVehicleCount = vehicles.filter((v) => !v.decommissioned).length
  const openPredictionsCount = predictions.filter(
    (p) => p.status !== 'resolved' && !p.insufficientData,
  ).length

  const resetChat = () => {
    if (isLoading) return
    setMessages([createWelcomeMessage()])
    setQuery('')
  }

  const runPrompt = async (text: string) => {
    const clean = text.trim()
    if (!clean || isLoading) return

    const userMsgId = nextMsgId('u')
    setMessages((prev) => [...prev, { id: userMsgId, sender: 'user', text: clean }])
    setQuery('')

    // Pre-flight RBAC, prompt-injection, SQL-probe, cross-org, and sensor-scope guard
    const guard: CopilotResponse = queryFleetCopilot({
      query: clean,
      activeOrganization,
      allOrganizations: organizations,
      activeRole,
      vehicles,
      predictions,
      riskAssessments,
      drivers,
      fuelTransactions,
      financialSummary,
    })

    if (guard.blocked || guard.reason === 'insufficient_data') {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMsgId('c'),
          sender: 'copilot',
          text: guard.answer,
          citations: guard.citations,
          blocked: guard.blocked,
        },
      ])
      return
    }

    const activeRegs = vehicles.filter((v) => !v.decommissioned).map((v) => v.registrationNumber)
    const hasPriorHistory = messages.some((m) => m.id !== 'welcome' && !m.blocked)

    // Strict Fleet-Management-Only enforcement
    if (!isFleetManagementQuery(clean, activeRegs, hasPriorHistory)) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMsgId('c'),
          sender: 'copilot',
          text: DHIYU_SCOPE_REFUSAL,
          citations: ['Guard: Fleet Management Scope Only'],
          blocked: true,
        },
      ])
      return
    }

    const { systemInstruction, citations } = buildMaintenanceSystemInstruction({
      activeOrganization,
      activeRole,
      vehicles,
      predictions,
      maintenanceRecords,
      riskAssessments,
      drivers,
      fuelTransactions,
      financialSummary,
    })

    const history = messages
      .filter((m) => m.id !== 'welcome' && !m.blocked)
      .slice(-6)
      .map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('model' as const),
        text: m.text,
      }))

    setIsLoading(true)
    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: clean,
          systemInstruction,
          history,
        }),
      })
      const payload = (await res.json()) as {
        answer?: string
        error?: string
        model?: string
        scopeRefused?: boolean
      }
      if (!res.ok || !payload.answer) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextMsgId('c'),
            sender: 'copilot',
            text: payload.error ?? 'Unable to generate a response from Dhiyu right now.',
            citations: ['Status: Unavailable'],
            blocked: true,
          },
        ])
        return
      }

      setMessages((prev) => [
        ...prev,
        {
          id: nextMsgId('c'),
          sender: 'copilot',
          text: payload.answer!,
          citations: payload.scopeRefused ? ['Guard: Fleet Management Scope Only'] : citations,
          blocked: Boolean(payload.scopeRefused),
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMsgId('c'),
          sender: 'copilot',
          text: 'Network error reaching the Dhiyu backend service. Please try again.',
          citations: ['Status: Network Error'],
          blocked: true,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#625346]/20 backdrop-blur-[1px] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Dhiyu Fleet Management AI"
    >
      <div className="w-full max-w-md bg-[#FFFFFF] border-l border-[#E5E5E5] h-full flex flex-col shadow-elevated">
        <div className="px-5 py-3.5 bg-[#EEE8F7] border-b border-[#DDD3ED] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <DhiyuLogo size="sm" className="shadow-subtle" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#625346] leading-tight">Dhiyu</h2>
              <p className="text-[11px] text-[#958777] flex items-center gap-1 truncate">
                <ShieldCheck className="w-3 h-3 text-[#6E5696] shrink-0" />
                <span className="truncate">Fleet Management AI · {activeOrganization.name}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={resetChat}
              disabled={isLoading}
              title="Reset Dhiyu conversation"
              aria-label="Reset conversation"
              className="p-1.5 rounded-lg text-[#958777] hover:text-[#625346] hover:bg-[#E2D8F3] disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Dhiyu AI"
              className="p-1.5 rounded-lg text-[#958777] hover:text-[#625346] hover:bg-[#E2D8F3]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-2 bg-[#FFFFFF] border-b border-[#E5E5E5] flex items-center gap-2 text-[11px] text-[#958777]">
          <span className="font-semibold text-[#625346] tabular-nums">
            {activeVehicleCount} vehicles
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-[#625346] tabular-nums">
            {openPredictionsCount} open alerts
          </span>
          <span aria-hidden="true">·</span>
          <span>Fleet-Only Scope</span>
        </div>

        <div className="px-4 py-2.5 bg-[#FAFAFA] border-b border-[#E5E5E5] flex flex-wrap gap-1.5">
          {SAMPLE_PROMPTS.map((sample) => (
            <button
              key={sample}
              type="button"
              disabled={isLoading}
              onClick={() => void runPrompt(sample)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-[8px] bg-[#FFFFFF] border border-[#E5E5E5] text-[#625346] hover:bg-[#EEE8F7] hover:border-[#B8A3D9] text-left disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3 inline mr-1 text-[#6E5696]" />
              {sample}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-custom bg-[#FFFFFF]">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl p-3.5 text-xs leading-relaxed border ${
                m.sender === 'user'
                  ? 'ml-8 bg-[#EEE8F7] border-[#B8A3D9] text-[#625346]'
                  : m.blocked
                    ? 'mr-6 bg-[#FCECEB] border-[#E7A8A0] text-[#625346]'
                    : 'mr-6 bg-[#FAFAFA] border-[#E5E5E5] text-[#625346]'
              }`}
            >
              <FormattedCopilotText text={m.text} />
              {m.citations && m.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#E5E5E5] flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium text-[#958777]">
                  {m.citations.map((c, idx) => (
                    <React.Fragment key={c}>
                      {idx > 0 && <span aria-hidden="true">·</span>}
                      <span>{c}</span>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="mr-6 rounded-xl p-3.5 text-xs border bg-[#FAFAFA] border-[#E5E5E5] text-[#958777] flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6E5696]" />
              <span>Dhiyu is analyzing fleet telemetry & maintenance windows...</span>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void runPrompt(query)
          }}
          className="p-4 border-t border-[#E5E5E5] bg-[#FAFAFA] flex items-center gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
            placeholder="Ask Dhiyu about fleet maintenance, RUL, vehicles, or fuel..."
            aria-label="Ask Dhiyu Fleet Management AI"
            className="dm-input flex-1 text-xs"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="btn-accent px-3 py-2 shrink-0 disabled:opacity-50"
            aria-label="Send question to Dhiyu"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  )
}
