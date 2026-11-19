import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Sparkles,
  SquarePen,
  X,
} from 'lucide-react'
import { useFleet } from '../../hooks/useFleet'
import { queryFleetCopilot, type CopilotResponse } from '../../utils/copilotEngine'
import {
  buildMaintenanceSystemInstruction,
  DHIYU_SCOPE_REFUSAL,
  isFleetManagementQuery,
} from '../../utils/copilotContext'
import { DhiyuAvatarMark, DhiyuLogo } from '../ui/DhiyuLogo'

interface CopilotMessage {
  id: string
  sender: 'user' | 'copilot'
  text: string
  citations?: string[]
  blocked?: boolean
}

const SAFE_DHIYU_UNAVAILABLE_MESSAGE =
  'Dhiyu is temporarily unable to process this request. Your fleet information has not been changed. Please try again shortly.'

const STARTER_CARDS = [
  {
    title: '5-Area Predictive Health & Delay Cost',
    prompt: 'Summarize our 5 health areas (Fuel, Engine, Tyre, Driver, Vehicle) and vehicles with highest delay cost exposure',
  },
  {
    title: 'Work Orders & Low Spare Parts',
    prompt: 'Which work orders are active and which spare parts in inventory are below reorder threshold?',
  },
  {
    title: '30-Day Spend & Invoices Ledger',
    prompt: 'Summarize 30-day maintenance & fuel spend, EV vs ICE TCO, and unpaid vendor invoices',
  },
  {
    title: 'Indian Compliance & Driver Safety',
    prompt: 'Which drivers or vehicles have upcoming DL, FC, Insurance, or PUC expiries and harsh braking risks?',
  },
]

function renderInlineBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, idx) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={idx} className="font-semibold text-[#625346]">
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
        <div key={`tbl-${i}`} className="space-y-1.5 my-2">
          {dataRows.map((cells, rIdx) => (
            <div
              key={rIdx}
              className="rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] px-3 py-2 text-xs space-y-1"
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
      blocks.push(<hr key={`hr-${i}`} className="border-[#E5E5E5] my-2" />)
      i += 1
      continue
    }

    const headingMatch = trimmed.match(/^#{1,4}\s+(.*)$/)
    if (headingMatch) {
      const cleanHeading = headingMatch[1].replace(/\*\*/g, '').trim()
      blocks.push(
        <h4 key={`h-${i}`} className="text-[13.5px] font-bold text-[#625346] pt-1.5">
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
        <ul key={`ul-${i}`} className="space-y-1.5 pl-4 list-disc marker:text-[#6E5696]">
          {items.map((item, idx) => (
            <li key={idx} className="text-[13.5px] text-[#625346] leading-relaxed">
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
          className="space-y-1.5 pl-4 list-decimal marker:text-[#6E5696] marker:font-semibold"
        >
          {items.map((item, idx) => (
            <li key={idx} className="text-[13.5px] text-[#625346] leading-relaxed">
              {renderInlineBold(item)}
            </li>
          ))}
        </ol>,
      )
      continue
    }

    blocks.push(
      <p key={`p-${i}`} className="text-[13.5px] text-[#625346] leading-relaxed">
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
    workOrders,
    partsInventory,
  } = useFleet()

  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({})
  const [messages, setMessages] = useState<CopilotMessage[]>([])

  const msgSeqRef = useRef(0)
  const streamEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const nextMsgId = (prefix: string) => {
    msgSeqRef.current += 1
    return `${prefix}-${msgSeqRef.current}`
  }

  useEffect(() => {
    if (open) {
      streamEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading, open])

  if (!open) return null

  const activeVehicleCount = vehicles.filter((v) => !v.decommissioned).length
  const openPredictionsCount = predictions.filter(
    (p) => p.status !== 'resolved' && !p.insufficientData,
  ).length

  const resetChat = () => {
    if (isLoading) return
    setMessages([])
    setQuery('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500)
    } catch {
      // Clipboard unavailable
    }
  }

  const getActiveLanguage = (): string => {
    try {
      return localStorage.getItem('dm_language') || 'en'
    } catch {
      return 'en'
    }
  }

  const runPrompt = async (text: string) => {
    const clean = text.trim()
    if (!clean || isLoading) return

    const userMsgId = nextMsgId('u')
    setMessages((prev) => [...prev, { id: userMsgId, sender: 'user', text: clean }])
    setQuery('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Deterministic RBAC / Tenant Isolation / Insufficient Data Gate
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
    const hasPriorHistory = messages.some((m) => !m.blocked)

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
      workOrders,
      partsInventory,
    })

    const history = messages
      .filter((m) => !m.blocked)
      .slice(-6)
      .map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('model' as const),
        text: m.text,
      }))

    setIsLoading(true)
    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: clean,
          systemInstruction,
          history,
          language: getActiveLanguage(),
        }),
      })

      const payload = (await res.json().catch(() => ({}))) as {
        answer?: string
        error?: string
        scopeRefused?: boolean
        fallbackRecommended?: boolean
      }

      if (!res.ok || payload.fallbackRecommended || !payload.answer) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextMsgId('c'),
            sender: 'copilot',
            text: SAFE_DHIYU_UNAVAILABLE_MESSAGE,
            citations: ['Status: Temporary Service Notice'],
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
          text: SAFE_DHIYU_UNAVAILABLE_MESSAGE,
          citations: ['Status: Temporary Service Notice'],
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
      <div
        className={`w-full ${
          expanded ? 'max-w-2xl' : 'max-w-[490px]'
        } bg-[#FFFFFF] border-l border-[#E5E5E5] h-full flex flex-col shadow-elevated transition-[max-width] duration-200`}
      >
        <header className="h-14 px-4 border-b border-[#E5E5E5] bg-[#FFFFFF] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={resetChat}
              disabled={isLoading}
              title="New Dhiyu chat"
              aria-label="New conversation"
              className="p-2 rounded-[10px] text-[#625346] hover:bg-[#EEE8F7] disabled:opacity-50 transition-colors"
            >
              <SquarePen className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <DhiyuLogo size="sm" />
              <span className="text-xs font-medium text-[#958777] truncate hidden sm:inline">
                · {activeOrganization.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              title={expanded ? 'Compact panel' : 'Expand panel'}
              aria-label={expanded ? 'Collapse Dhiyu AI panel' : 'Expand Dhiyu AI panel'}
              className="p-2 rounded-[10px] text-[#958777] hover:text-[#625346] hover:bg-[#EEE8F7] transition-colors"
            >
              {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Dhiyu AI"
              className="p-2 rounded-[10px] text-[#958777] hover:text-[#625346] hover:bg-[#EEE8F7] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-custom bg-[#FFFFFF]">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-6 py-8">
              <div className="w-full max-w-md space-y-6 text-center">
                <div className="flex flex-col items-center space-y-2.5">
                  <DhiyuLogo size="lg" />
                  <h2 className="text-xl font-bold text-[#625346] tracking-tight">
                    How can I help with your fleet today?
                  </h2>
                  <p className="text-xs text-[#958777] flex items-center justify-center gap-1.5 flex-wrap">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#6E5696] shrink-0" />
                    <span className="tabular-nums font-medium text-[#625346]">
                      {activeVehicleCount} vehicles
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums font-medium text-[#625346]">
                      {openPredictionsCount} open wear signals
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Private Owner Fleet Intelligence</span>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                  {STARTER_CARDS.map((card) => (
                    <button
                      key={card.title}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void runPrompt(card.prompt)}
                      className="p-3.5 rounded-2xl border border-[#E5E5E5] bg-[#FFFFFF] hover:bg-[#FAFAFA] hover:border-[#B8A3D9] transition-colors space-y-1 text-left group disabled:opacity-50"
                    >
                      <span className="text-xs font-semibold text-[#625346] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#6E5696] shrink-0" />
                        <span className="line-clamp-1">{card.title}</span>
                      </span>
                      <span className="text-[11.5px] text-[#958777] line-clamp-2 block leading-snug">
                        {card.prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
              {messages.map((m) =>
                m.sender === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[82%] rounded-3xl px-4 py-2.5 bg-[#EEE8F7] text-[#625346] text-[13.5px] leading-relaxed">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex items-start gap-3.5 group">
                    <DhiyuAvatarMark className="mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div
                        className={
                          m.blocked
                            ? 'rounded-2xl bg-[#FDF3E7]/85 border border-[#E8C290] px-3.5 py-2.5'
                            : ''
                        }
                      >
                        <FormattedCopilotText text={m.text} />
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-[#958777]">
                        {m.citations && m.citations.length > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCitations((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                            }
                            className="inline-flex items-center gap-1 hover:text-[#625346] font-medium"
                          >
                            {expandedCitations[m.id] ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                            <span>{m.citations.length} fleet context source(s)</span>
                          </button>
                        ) : (
                          <span />
                        )}
                        <button
                          type="button"
                          onClick={() => void handleCopy(m.id, m.text)}
                          aria-label="Copy response"
                          className="p-1 rounded-md text-[#958777] hover:text-[#625346] hover:bg-[#EEE8F7]/70 transition-colors shrink-0"
                        >
                          {copiedId === m.id ? (
                            <Check className="w-3.5 h-3.5 text-[#4D6E4A]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      {expandedCitations[m.id] && m.citations && (
                        <div className="rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] px-3 py-2 text-[11px] text-[#625346] flex flex-wrap gap-2">
                          {m.citations.map((c) => (
                            <span key={c} className="px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#E5E5E5]">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}

              {isLoading && (
                <div className="flex items-start gap-3.5">
                  <DhiyuAvatarMark className="mt-0.5" />
                  <div className="flex items-center gap-2 text-[13px] text-[#958777] pt-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6E5696]" />
                    <span>Analyzing fleet telemetry & ERP records...</span>
                  </div>
                </div>
              )}
              <div ref={streamEndRef} />
            </div>
          )}
        </div>

        <div className="px-4 pb-4 pt-2 bg-[#FFFFFF]">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void runPrompt(query)
            }}
            className="max-w-xl mx-auto rounded-3xl border border-[#DDD3ED] bg-[#FAFAFA] focus-within:bg-[#FFFFFF] focus-within:border-[#B8A3D9] focus-within:ring-2 focus-within:ring-[#B8A3D9]/25 px-4 py-2.5 flex items-end gap-2 shadow-subtle transition-all"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void runPrompt(query)
                }
              }}
              disabled={isLoading}
              placeholder="Message Dhiyu about 5-area health, work orders, parts, or compliance..."
              aria-label="Ask Dhiyu Fleet Management AI"
              className="flex-1 bg-transparent resize-none outline-none text-[13.5px] text-[#625346] placeholder:text-[#958777] py-1 max-h-[120px] leading-relaxed"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              aria-label="Send question to Dhiyu"
              className="w-8 h-8 rounded-full bg-[#625346] text-[#FFFFFF] hover:bg-[#4E4136] disabled:bg-[#E5E5E5] disabled:text-[#958777] flex items-center justify-center shrink-0 transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </form>
          <p className="text-[10.5px] text-[#958777] text-center mt-2">
            Dhiyu assists strictly with DriveMitra fleet management for {activeOrganization.name}. Personal identifiers are masked before analysis.
          </p>
        </div>
      </div>
    </div>
  )
}
