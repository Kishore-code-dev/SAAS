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
      classes: 'text-[#625346] bg-[#D9786C]/22 border-[#D9786C]',
      icon: AlertOctagon,
      iconColor: 'text-[#B84E42]',
    },
    offline: {
      classes: 'text-[#625346] bg-[#D9786C]/22 border-[#D9786C]',
      icon: AlertOctagon,
      iconColor: 'text-[#B84E42]',
    },
    high: {
      classes: 'text-[#625346] bg-[#E8C65A]/30 border-[#C9A63B]',
      icon: AlertTriangle,
      iconColor: 'text-[#8F6D15]',
    },
    'at-risk': {
      classes: 'text-[#625346] bg-[#E8C65A]/30 border-[#C9A63B]',
      icon: AlertTriangle,
      iconColor: 'text-[#8F6D15]',
    },
    stale: {
      classes: 'text-[#625346] bg-[#E8C65A]/30 border-[#C9A63B]',
      icon: AlertTriangle,
      iconColor: 'text-[#8F6D15]',
    },
    delayed: {
      classes: 'text-[#625346] bg-[#E8C65A]/30 border-[#C9A63B]',
      icon: AlertTriangle,
      iconColor: 'text-[#8F6D15]',
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
      classes: 'text-[#625346] bg-[#789A75]/22 border-[#789A75]',
      icon: CheckCircle2,
      iconColor: 'text-[#4D6E4A]',
    },
    healthy: {
      classes: 'text-[#625346] bg-[#789A75]/22 border-[#789A75]',
      icon: CheckCircle2,
      iconColor: 'text-[#4D6E4A]',
    },
    live: {
      classes: 'text-[#625346] bg-[#789A75]/22 border-[#789A75]',
      icon: CheckCircle2,
      iconColor: 'text-[#4D6E4A]',
    },
    low: {
      classes: 'text-[#625346] bg-[#F4EBD5] border-[#E0D4B7]',
      icon: Info,
      iconColor: 'text-[#7D6D5F]',
    },
  }

  const entry = styleMap[severity] ?? styleMap.low
  const Icon = entry.icon
  const display = label ?? severity.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[8px] text-xs font-semibold border whitespace-nowrap ${entry.classes}`}
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
      className="fixed inset-0 z-50 bg-[#625346]/25 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`bg-[#FBF6E6] border border-[#D4C7E6] rounded-xl shadow-elevated w-full ${maxWidthClass} p-6 my-auto animate-fade-in-up`}>
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E0D4B7]">
          <div>
            <h2 className="text-lg font-bold text-[#625346]">{title}</h2>
            {subtitle && <p className="text-xs text-[#7D6D5F] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="p-1.5 rounded-lg text-[#7D6D5F] hover:text-[#625346] hover:bg-[#EEE8F7] transition-colors"
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
      <p className="text-sm text-[#7D6D5F] mt-1 max-w-md mx-auto">{description}</p>
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
      <div className="enterprise-card max-w-md w-full p-8 text-center border-[#D4C7E6]">
        <div className="w-12 h-12 rounded-xl bg-[#EEE8F7] border border-[#B8A3D9] text-[#6E5696] flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-[#625346]">Access Restricted</h2>
        <p className="text-sm text-[#7D6D5F] mt-2">
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
