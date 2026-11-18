import React from 'react'
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react'

export function formatInr(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

export function formatDateTime(iso: string, timeZone = 'Asia/Kolkata'): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', {
    timeZone,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatShortDate(iso: string, timeZone = 'Asia/Kolkata'): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function SeverityText({
  severity,
  label,
}: {
  severity: 'critical' | 'high' | 'moderate' | 'medium' | 'normal' | 'low' | 'healthy' | 'at-risk' | 'live' | 'delayed' | 'stale' | 'offline'
  label?: string
}) {
  const styleMap: Record<string, { classes: string; icon: React.ComponentType<{ className?: string }>; iconColor: string }> = {
    critical: {
      classes: 'text-[#625346] bg-[#FCECEB] border-[#E7A8A0]',
      icon: AlertOctagon,
      iconColor: 'text-[#B84E42]',
    },
    offline: {
      classes: 'text-[#625346] bg-[#FCECEB] border-[#E7A8A0]',
      icon: AlertOctagon,
      iconColor: 'text-[#B84E42]',
    },
    high: {
      classes: 'text-[#625346] bg-[#FDF3E7] border-[#E8C290]',
      icon: AlertTriangle,
      iconColor: 'text-[#A56021]',
    },
    'at-risk': {
      classes: 'text-[#625346] bg-[#FDF3E7] border-[#E8C290]',
      icon: AlertTriangle,
      iconColor: 'text-[#A56021]',
    },
    stale: {
      classes: 'text-[#625346] bg-[#FDF3E7] border-[#E8C290]',
      icon: AlertTriangle,
      iconColor: 'text-[#A56021]',
    },
    delayed: {
      classes: 'text-[#625346] bg-[#FDF3E7] border-[#E8C290]',
      icon: AlertTriangle,
      iconColor: 'text-[#A56021]',
    },
    moderate: {
      classes: 'text-[#625346] bg-[#EEE8F7] border-[#B8A3D9]',
      icon: Info,
      iconColor: 'text-[#6E5696]',
    },
    medium: {
      classes: 'text-[#625346] bg-[#EEE8F7] border-[#B8A3D9]',
      icon: Info,
      iconColor: 'text-[#6E5696]',
    },
    normal: {
      classes: 'text-[#625346] bg-[#EDF4EC] border-[#B8D0B5]',
      icon: CheckCircle2,
      iconColor: 'text-[#4D6E4A]',
    },
    healthy: {
      classes: 'text-[#625346] bg-[#EDF4EC] border-[#B8D0B5]',
      icon: CheckCircle2,
      iconColor: 'text-[#4D6E4A]',
    },
    live: {
      classes: 'text-[#625346] bg-[#EDF4EC] border-[#B8D0B5]',
      icon: CheckCircle2,
      iconColor: 'text-[#4D6E4A]',
    },
    low: {
      classes: 'text-[#625346] bg-[#FAFAFA] border-[#E5E5E5]',
      icon: Info,
      iconColor: 'text-[#958777]',
    },
  }

  const entry = styleMap[severity] ?? styleMap.low
  const Icon = entry.icon
  const display = label ?? severity.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${entry.classes}`}
    >
      <Icon className={`w-3 h-3 shrink-0 ${entry.iconColor}`} />
      <span>{display}</span>
    </span>
  )
}

export function EnterpriseModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  maxWidthClass?: string
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 bg-[#625346]/20 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl shadow-elevated w-full ${maxWidthClass} p-6 my-auto animate-fade-in-up`}>
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E5E5E5]">
          <div>
            <h2 className="text-lg font-bold text-[#625346]">{title}</h2>
            {subtitle && <p className="text-xs text-[#958777] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="p-1.5 rounded-lg text-[#958777] hover:text-[#625346] hover:bg-[#EEE8F7] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  )
}

export function EmptySectionState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="enterprise-card p-10 text-center">
      <h3 className="text-base font-bold text-[#625346]">{title}</h3>
      <p className="text-sm text-[#958777] mt-1 max-w-md mx-auto">{description}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="btn-primary mt-5">
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function AccessDeniedState({
  roleLabel,
  targetPath,
  onReturn,
}: {
  roleLabel: string
  targetPath: string
  onReturn: () => void
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="enterprise-card max-w-md w-full p-8 text-center border-[#E5E5E5]">
        <div className="w-12 h-12 rounded-xl bg-[#EEE8F7] border border-[#B8A3D9] text-[#6E5696] flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-[#625346]">Access Restricted</h2>
        <p className="text-sm text-[#958777] mt-2">
          Your active role (<span className="font-semibold text-[#625346] capitalize">{roleLabel}</span>) is not authorized to open{' '}
          <span className="font-semibold text-[#625346]">{targetPath}</span>.
        </p>
        <button type="button" onClick={onReturn} className="btn-primary mt-6">
          Return to Authorized Workspace
        </button>
      </div>
    </div>
  )
}

export function KpiCard({
  label,
  value,
  subValue,
  icon: Icon,
  tone = 'cocoa',
}: {
  label: string
  value: string | number
  subValue?: string
  icon?: React.ComponentType<{ className?: string }>
  tone?: 'cocoa' | 'purple' | 'yellow' | 'sage' | 'coral'
}) {
  const toneBorder: Record<string, string> = {
    cocoa: 'border-l-[#958777]',
    purple: 'border-l-[#6E5696]',
    yellow: 'border-l-[#D8B442]',
    sage: 'border-l-[#789A75]',
    coral: 'border-l-[#D9786C]',
  }
  const toneIconBg: Record<string, string> = {
    cocoa: 'bg-[#FAFAFA] text-[#625346]',
    purple: 'bg-[#EEE8F7] text-[#6E5696]',
    yellow: 'bg-[#FCF5DE] text-[#8E6F19]',
    sage: 'bg-[#EDF4EC] text-[#4D6E4A]',
    coral: 'bg-[#FCECEB] text-[#B84E42]',
  }
  return (
    <div className={`enterprise-card p-4 border-l-4 ${toneBorder[tone] ?? toneBorder.cocoa}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-[#958777] block truncate">{label}</span>
          <p className="text-xl font-bold text-[#625346] tabular-nums mt-1">{value}</p>
          {subValue && <p className="text-[11px] text-[#958777] mt-1 truncate">{subValue}</p>}
        </div>
        {Icon && (
          <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${toneIconBg[tone] ?? toneIconBg.cocoa}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  )
}

export function PaginationFooter({
  page,
  pageSize,
  totalItems,
  onPageChange,
}: {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (nextPage: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, totalItems)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[#E5E5E5] bg-[#FAFAFA] text-xs text-[#958777]">
      <span className="tabular-nums">
        Showing {start}–{end} of {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="btn-secondary px-2.5 py-1 text-xs disabled:opacity-40"
        >
          Previous
        </button>
        <span className="font-semibold text-[#625346] tabular-nums">
          Page {safePage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="btn-secondary px-2.5 py-1 text-xs disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}

