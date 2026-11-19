import { useNavigate } from 'react-router-dom'
import { BookOpen, Cpu, LifeBuoy, Mail, ShieldCheck, Wrench } from 'lucide-react'
import { EnterpriseModal } from '../ui/EnterprisePrimitives'

export default function HelpSupportModal({
  open,
  onClose,
  orgCode,
}: {
  open: boolean
  onClose: () => void
  orgCode: string
}) {
  const navigate = useNavigate()

  const quickGuides = [
    {
      title: 'Fleet & Preventive Maintenance Workflow',
      desc: 'Log pre-trip inspections, triage defect issues, and escalate directly into Work Orders with parts stock consumption.',
      icon: Wrench,
      route: '/dashboard/work-orders',
    },
    {
      title: '5-Area Predictive Health & Dhiyu AI',
      desc: 'Understand Fuel, Engine, Tyre, Driver, and Vehicle health scores and remaining useful life (RUL) confidence intervals.',
      icon: Cpu,
      route: '/dashboard/maintenance',
    },
    {
      title: 'Compliance Vault & Renewal Alerts',
      desc: 'Track RC, Insurance, Fitness, PUC, and Indian Driving License renewals across 60/30/15/7-day warning tiers.',
      icon: ShieldCheck,
      route: '/dashboard/reminders/vehicle-renewals',
    },
    {
      title: 'API Keys, Webhooks & Fleet MCP',
      desc: 'Configure external telematics ingestion, webhooks, and enterprise developer integrations.',
      icon: BookOpen,
      route: '/dashboard/settings/api-keys',
    },
  ]

  return (
    <EnterpriseModal
      open={open}
      onClose={onClose}
      title="Help & Support Center"
      subtitle={`DriveMitra Enterprise Fleet Support · Tenant Code ${orgCode}`}
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2.5">
          {quickGuides.map((g) => {
            const Icon = g.icon
            return (
              <button
                key={g.title}
                type="button"
                onClick={() => {
                  onClose()
                  navigate(g.route)
                }}
                className="p-3.5 rounded-xl border border-[#E5E5E5] hover:border-[#B8A3D9] hover:bg-[#FAFAFA] text-left flex items-start gap-3 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-[#EEE8F7] text-[#6E5696] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#625346]">{g.title}</p>
                  <p className="text-xs text-[#958777] mt-0.5 leading-relaxed">{g.desc}</p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <LifeBuoy className="w-5 h-5 text-[#6E5696] shrink-0" />
            <div>
              <p className="text-xs font-bold text-[#625346]">Priority Fleet Operations Desk</p>
              <p className="text-[11px] text-[#958777]">support@drivemitra.in · SLA Response &lt; 2 hrs</p>
            </div>
          </div>
          <a
            href="mailto:support@drivemitra.in?subject=DriveMitra%20Workspace%20Support"
            className="btn-secondary text-xs px-3 py-1.5"
          >
            <Mail className="w-3.5 h-3.5" />
            Email Desk
          </a>
        </div>
      </div>
    </EnterpriseModal>
  )
}
