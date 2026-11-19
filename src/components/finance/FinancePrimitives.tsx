import React from 'react'
import { AlertOctagon, AlertTriangle, CheckCircle2, Clock, Info, XCircle } from 'lucide-react'
import type {
  EmiPaymentStatus,
  ReconciliationStatus,
  VehicleFinanceStatus,
} from '../../types/finance'

export function FinanceStatusBadge({ status }: { status: VehicleFinanceStatus }) {
  const map: Record<VehicleFinanceStatus, { bg: string; icon: React.ComponentType<{ className?: string }>; iconColor: string; label: string }> = {
    active: { bg: 'bg-[#EDF4EC] border-[#B8D0B5] text-[#4D6E4A]', icon: CheckCircle2, iconColor: 'text-[#4D6E4A]', label: 'Active' },
    partially_paid: { bg: 'bg-[#FDF3E7] border-[#E8C290] text-[#8F6510]', icon: Clock, iconColor: 'text-[#A56021]', label: 'Partially Paid' },
    overdue: { bg: 'bg-[#FCECEB] border-[#E7A8A0] text-[#A24034]', icon: AlertOctagon, iconColor: 'text-[#B84E42]', label: 'Overdue' },
    restructured: { bg: 'bg-[#EEE8F7] border-[#B8A3D9] text-[#6E5696]', icon: Info, iconColor: 'text-[#6E5696]', label: 'Restructured' },
    foreclosed: { bg: 'bg-[#F5F5F7] border-[#D9D9DF] text-[#625346]', icon: CheckCircle2, iconColor: 'text-[#6E5696]', label: 'Foreclosed' },
    completed: { bg: 'bg-[#EDF4EC] border-[#B8D0B5] text-[#4D6E4A]', icon: CheckCircle2, iconColor: 'text-[#4D6E4A]', label: 'Completed' },
    cancelled: { bg: 'bg-[#F5F5F7] border-[#E5E5E5] text-[#958777]', icon: XCircle, iconColor: 'text-[#958777]', label: 'Cancelled' },
  }
  const entry = map[status] ?? map.active
  const Icon = entry.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[8px] text-[11.5px] font-semibold border whitespace-nowrap ${entry.bg}`}>
      <Icon className={`w-3 h-3 shrink-0 ${entry.iconColor}`} />
      <span>{entry.label}</span>
    </span>
  )
}

export function EmiStatusBadge({ status }: { status: EmiPaymentStatus }) {
  const map: Record<EmiPaymentStatus, { bg: string; icon: React.ComponentType<{ className?: string }>; iconColor: string; label: string }> = {
    upcoming: { bg: 'bg-[#FAFAFA] border-[#E5E5E5] text-[#625346]', icon: Clock, iconColor: 'text-[#958777]', label: 'Upcoming' },
    due_soon: { bg: 'bg-[#FDF3E7] border-[#E8C290] text-[#8F6510]', icon: AlertTriangle, iconColor: 'text-[#A56021]', label: 'Due Soon' },
    due_today: { bg: 'bg-[#FCF5DE] border-[#D8B442] text-[#625346]', icon: AlertTriangle, iconColor: 'text-[#8E6F19]', label: 'Due Today' },
    paid: { bg: 'bg-[#EDF4EC] border-[#B8D0B5] text-[#4D6E4A]', icon: CheckCircle2, iconColor: 'text-[#4D6E4A]', label: 'Paid' },
    partially_paid: { bg: 'bg-[#EEE8F7] border-[#B8A3D9] text-[#6E5696]', icon: Clock, iconColor: 'text-[#6E5696]', label: 'Partially Paid' },
    overdue: { bg: 'bg-[#FCECEB] border-[#E7A8A0] text-[#A24034]', icon: AlertOctagon, iconColor: 'text-[#B84E42]', label: 'Overdue' },
    waived: { bg: 'bg-[#F5F5F7] border-[#E5E5E5] text-[#958777]', icon: Info, iconColor: 'text-[#958777]', label: 'Waived' },
    cancelled: { bg: 'bg-[#F5F5F7] border-[#E5E5E5] text-[#958777]', icon: XCircle, iconColor: 'text-[#958777]', label: 'Cancelled' },
  }
  const entry = map[status] ?? map.upcoming
  const Icon = entry.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[8px] text-[11.5px] font-semibold border whitespace-nowrap ${entry.bg}`}>
      <Icon className={`w-3 h-3 shrink-0 ${entry.iconColor}`} />
      <span>{entry.label}</span>
    </span>
  )
}

export function ReconciliationBadge({ status }: { status: ReconciliationStatus }) {
  if (status === 'reconciled') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] text-[11px] font-semibold border bg-[#EDF4EC] border-[#B8D0B5] text-[#4D6E4A] whitespace-nowrap">
        <CheckCircle2 className="w-3 h-3" />
        Reconciled
      </span>
    )
  }
  if (status === 'discrepancy') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] text-[11px] font-semibold border bg-[#FCECEB] border-[#E7A8A0] text-[#A24034] whitespace-nowrap">
        <AlertOctagon className="w-3 h-3" />
        Discrepancy
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] text-[11px] font-semibold border bg-[#FDF3E7] border-[#E8C290] text-[#8F6510] whitespace-nowrap">
      <Clock className="w-3 h-3" />
      Pending Recon
    </span>
  )
}
