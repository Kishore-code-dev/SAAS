import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, Rocket, ArrowRight } from 'lucide-react'
import { EnterpriseModal } from '../ui/EnterprisePrimitives'
import type { OnboardingChecklistItem } from '../../utils/fleetioConfigStore'

export default function GetStartedModal({
  open,
  onClose,
  items,
  orgName,
}: {
  open: boolean
  onClose: () => void
  items: OnboardingChecklistItem[]
  orgName: string
}) {
  const navigate = useNavigate()
  const completedCount = items.filter((i) => i.completed).length
  const pct = Math.round((completedCount / Math.max(1, items.length)) * 100)

  return (
    <EnterpriseModal
      open={open}
      onClose={onClose}
      title={`Get Started · ${orgName}`}
      subtitle="Complete workspace setup milestones to unlock full fleet intelligence and compliance automation."
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-5">
        <div className="p-4 rounded-xl bg-[#EEE8F7] border border-[#DDD3ED] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6E5696] text-white flex items-center justify-center shrink-0">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#625346]">
                {completedCount} of {items.length} milestones completed ({pct}%)
              </p>
              <p className="text-xs text-[#958777]">
                Click any checklist item below to jump straight to that module.
              </p>
            </div>
          </div>
          <div className="w-28 h-2 rounded-full bg-[#DDD3ED] overflow-hidden shrink-0">
            <div className="h-full bg-[#6E5696] transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="divide-y divide-[#E5E5E5] border border-[#E5E5E5] rounded-xl overflow-hidden">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onClose()
                navigate(item.route)
              }}
              className="w-full px-4 py-3.5 bg-white hover:bg-[#FAFAFA] text-left flex items-center justify-between gap-3 transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                {item.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-[#6E5696] shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-[#958777] shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${item.completed ? 'text-[#625346]' : 'text-[#625346]'}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-[#958777] mt-0.5">{item.description}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#958777] shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </EnterpriseModal>
  )
}
