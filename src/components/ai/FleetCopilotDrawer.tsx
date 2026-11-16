import React, { useState } from 'react'
import { Bot, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useFleet } from '../../hooks/useFleet'
import { queryFleetCopilot, type CopilotResponse } from '../../utils/copilotEngine'

interface CopilotMessage {
  id: string
  sender: 'user' | 'copilot'
  text: string
  citations?: string[]
  blocked?: boolean
}

const SAMPLE_PROMPTS = [
  'Which vehicles need maintenance soonest and what are the estimated savings?',
  'Summarize 30-day fuel spend and EV vs ICE cost per km',
  'Which drivers need safety coaching right now?',
]

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
    riskAssessments,
    drivers,
    fuelTransactions,
    financialSummary,
  } = useFleet()

  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      sender: 'copilot',
      text: `Grounded operational assistant active for ${activeOrganization.name} (${activeOrganization.code}). Responses use verified organization records only.`,
      citations: [`Tenant: ${activeOrganization.id}`, `Role: ${activeRole}`],
    },
  ])

  if (!open) return null

  const runPrompt = (text: string) => {
    const clean = text.trim()
    if (!clean) return
    const result: CopilotResponse = queryFleetCopilot({
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

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, sender: 'user', text: clean },
      {
        id: `c-${Date.now() + 1}`,
        sender: 'copilot',
        text: result.answer,
        citations: result.citations,
        blocked: result.blocked,
      },
    ])
    setQuery('')
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#625346]/25 backdrop-blur-[1px] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Fleet Intelligence Copilot"
    >
      <div className="w-full max-w-md bg-[#FBF6E6] border-l border-[#D4C7E6] h-full flex flex-col shadow-elevated">
        <div className="px-5 py-4 bg-[#EEE8F7] border-b border-[#D4C7E6] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] bg-[#E8C65A] border border-[#C9A63B] text-[#625346] flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#625346]">Fleet Intelligence Copilot</h2>
              <p className="text-[11px] text-[#7D6D5F] flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#6E5696]" />
                Org-isolated: {activeOrganization.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Fleet Copilot"
            className="p-1.5 rounded-lg text-[#7D6D5F] hover:text-[#625346] hover:bg-[#DFD3F2]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2.5 bg-[#F4EBD5] border-b border-[#E0D4B7] flex flex-wrap gap-1.5">
          {SAMPLE_PROMPTS.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => runPrompt(sample)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-[8px] bg-[#FBF6E6] border border-[#D4C7E6] text-[#625346] hover:bg-[#EEE8F7] text-left"
            >
              <Sparkles className="w-3 h-3 inline mr-1 text-[#6E5696]" />
              {sample}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-custom">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl p-3.5 text-xs leading-relaxed border ${
                m.sender === 'user'
                  ? 'ml-8 bg-[#EEE8F7] border-[#B8A3D9] text-[#625346]'
                  : m.blocked
                    ? 'mr-6 bg-[#D9786C]/18 border-[#D9786C] text-[#625346]'
                    : 'mr-6 bg-[#F4EBD5] border-[#E0D4B7] text-[#625346]'
              }`}
            >
              <p className="whitespace-pre-line font-medium">{m.text}</p>
              {m.citations && m.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#E0D4B7]/70 flex flex-wrap gap-1.5">
                  {m.citations.map((c) => (
                    <span
                      key={c}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-[6px] bg-[#FBF6E6] border border-[#E0D4B7] text-[#7D6D5F]"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            runPrompt(query)
          }}
          className="p-4 border-t border-[#E0D4B7] bg-[#F4EBD5] flex items-center gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about maintenance, fuel, or driver safety..."
            aria-label="Ask Fleet Intelligence Copilot"
            className="dm-input flex-1 text-xs"
          />
          <button type="submit" className="btn-accent px-3 py-2 shrink-0" aria-label="Send copilot question">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
