import React, { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import { PaginationFooter, formatInr } from '../../components/ui/EnterprisePrimitives'
import type {
  ContractStatus,
  ContractPaymentStatus,
  DepositStatus,
  MaintenanceResponsibility,
  OwnershipType,
} from '../../types/contracts'

export const C = {
  cocoa: '#625346',
  muted: '#958777',
  lavender: '#EEE8F7',
  royal: '#B8A3D9',
  gold: '#E8C65A',
  cream: '#F7F0D9',
  line: '#E5E5E5',
}

export function inr(value: number): string {
  return formatInr(Number.isFinite(value) ? value : 0)
}

export function shortDate(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function dateTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function daysUntil(value: string): number {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)
}

const OWNERSHIP_LABEL: Record<OwnershipType, string> = {
  company_owned: 'Company Owned',
  contracted_fleet: 'Contracted Fleet',
  individual_owner: 'Individual Owner',
}

const OWNERSHIP_CLASS: Record<OwnershipType, string> = {
  company_owned: 'bg-[#EDF4EC] text-[#4D6E4A] border-[#C9DEC6]',
  contracted_fleet: 'bg-[#EEE8F7] text-[#5B4579] border-[#D8CBEA]',
  individual_owner: 'bg-[#FCF5DE] text-[#8E6F19] border-[#EBD9A2]',
}

export function OwnershipBadge({ type }: { type?: OwnershipType | null }) {
  const key = type ?? 'company_owned'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${OWNERSHIP_CLASS[key]}`}>
      {OWNERSHIP_LABEL[key]}
    </span>
  )
}

const STATUS_LABEL: Record<ContractStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  awaiting_handover: 'Awaiting Handover',
  active: 'Active',
  temporarily_suspended: 'Suspended',
  renewal_pending: 'Renewal Pending',
  expired: 'Expired',
  termination_requested: 'Termination Requested',
  terminated: 'Terminated',
  vehicle_return_pending: 'Vehicle Return Pending',
  closed: 'Closed',
}

const STATUS_CLASS: Record<ContractStatus, string> = {
  draft: 'bg-[#FAFAFA] text-[#958777] border-[#E5E5E5]',
  pending_approval: 'bg-[#FCF5DE] text-[#8E6F19] border-[#EBD9A2]',
  awaiting_handover: 'bg-[#FCF5DE] text-[#8E6F19] border-[#EBD9A2]',
  active: 'bg-[#EDF4EC] text-[#4D6E4A] border-[#C9DEC6]',
  temporarily_suspended: 'bg-[#FCECEB] text-[#B84E42] border-[#EBC3BF]',
  renewal_pending: 'bg-[#EEE8F7] text-[#5B4579] border-[#D8CBEA]',
  expired: 'bg-[#FAFAFA] text-[#958777] border-[#E5E5E5]',
  termination_requested: 'bg-[#FCECEB] text-[#B84E42] border-[#EBC3BF]',
  terminated: 'bg-[#FCECEB] text-[#B84E42] border-[#EBC3BF]',
  vehicle_return_pending: 'bg-[#FCF5DE] text-[#8E6F19] border-[#EBD9A2]',
  closed: 'bg-[#FAFAFA] text-[#958777] border-[#E5E5E5]',
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_CLASS[status] ?? STATUS_CLASS.draft}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export const CONTRACT_STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))
export const OWNERSHIP_OPTIONS = Object.entries(OWNERSHIP_LABEL).map(([value, label]) => ({ value, label }))

const PAYMENT_LABEL: Record<ContractPaymentStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  overdue: 'Overdue',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
  reconciled: 'Reconciled',
}
const PAYMENT_CLASS: Record<ContractPaymentStatus, string> = {
  draft: 'bg-[#FAFAFA] text-[#958777] border-[#E5E5E5]',
  pending_approval: 'bg-[#FCF5DE] text-[#8E6F19] border-[#EBD9A2]',
  approved: 'bg-[#EEE8F7] text-[#5B4579] border-[#D8CBEA]',
  partially_paid: 'bg-[#FCF5DE] text-[#8E6F19] border-[#EBD9A2]',
  paid: 'bg-[#EDF4EC] text-[#4D6E4A] border-[#C9DEC6]',
  overdue: 'bg-[#FCECEB] text-[#B84E42] border-[#EBC3BF]',
  disputed: 'bg-[#FCECEB] text-[#B84E42] border-[#EBC3BF]',
  cancelled: 'bg-[#FAFAFA] text-[#958777] border-[#E5E5E5]',
  reconciled: 'bg-[#EDF4EC] text-[#4D6E4A] border-[#C9DEC6]',
}

export function PaymentStatusBadge({ status }: { status: ContractPaymentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PAYMENT_CLASS[status] ?? PAYMENT_CLASS.draft}`}>
      {PAYMENT_LABEL[status] ?? status}
    </span>
  )
}

export const PAYMENT_STATUS_OPTIONS = Object.entries(PAYMENT_LABEL).map(([value, label]) => ({ value, label }))

export function DepositStatusBadge({ status }: { status: DepositStatus }) {
  const cls = status === 'refunded' || status === 'closed'
    ? 'bg-[#EDF4EC] text-[#4D6E4A] border-[#C9DEC6]'
    : status === 'active' || status === 'verified'
      ? 'bg-[#EEE8F7] text-[#5B4579] border-[#D8CBEA]'
      : 'bg-[#FCF5DE] text-[#8E6F19] border-[#EBD9A2]'
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>{status.replace(/_/g, ' ')}</span>
}

export function ResponsibilityBadge({ value }: { value?: MaintenanceResponsibility }) {
  const label = (value ?? 'unspecified').replace(/_/g, ' ')
  const cls = value === 'supplier'
    ? 'bg-[#EEE8F7] text-[#5B4579] border-[#D8CBEA]'
    : value === 'operating_org'
      ? 'bg-[#EDF4EC] text-[#4D6E4A] border-[#C9DEC6]'
      : value === 'shared'
        ? 'bg-[#FCF5DE] text-[#8E6F19] border-[#EBD9A2]'
        : 'bg-[#FAFAFA] text-[#958777] border-[#E5E5E5]'
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>{label}</span>
}

export function ContractPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} subtitle={subtitle}>{actions}</PageHeader>
      {children}
    </div>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`enterprise-card p-4 ${className}`}>{children}</div>
}

export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
      <div>
        <h2 className="text-sm font-bold text-[#625346]">{title}</h2>
        {hint && <p className="text-[11px] text-[#958777] mt-0.5">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export interface Column<T> {
  key: string
  label: string
  render: (row: T) => React.ReactNode
  className?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyTitle,
  emptyDescription,
  pageSize = 12,
  onRowClick,
  actions,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyTitle: string
  emptyDescription: string
  pageSize?: number
  onRowClick?: (row: T) => void
  actions?: (row: T) => React.ReactNode
}) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const visible = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage, pageSize],
  )

  if (rows.length === 0) {
    return (
      <div className="enterprise-card p-10 text-center">
        <h3 className="text-base font-bold text-[#625346]">{emptyTitle}</h3>
        <p className="text-sm text-[#958777] mt-1 max-w-md mx-auto">{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className="enterprise-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="dm-table">
          <thead>
            <tr>
              {columns.map((col) => <th key={col.key} className={col.className}>{col.label}</th>)}
              {actions && <th className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? 'cursor-pointer hover:bg-[#FAF7EF]' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => <td key={col.key} className={col.className}>{col.render(row)}</td>)}
                {actions && (
                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > pageSize && (
        <PaginationFooter page={safePage} pageSize={pageSize} totalItems={rows.length} onPageChange={setPage} />
      )}
    </div>
  )
}

export function Toolbar({
  search,
  onSearch,
  placeholder,
  filters,
  right,
}: {
  search: string
  onSearch: (value: string) => void
  placeholder: string
  filters?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="enterprise-card p-3 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#958777]" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#E5E5E5] bg-white text-[#625346] focus:outline-none focus:ring-2 focus:ring-[#B8A3D9]/40"
        />
      </div>
      {filters}
      {right}
    </div>
  )
}

export function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  label: string
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2.5 py-2 text-xs rounded-lg border border-[#E5E5E5] bg-white text-[#625346] focus:outline-none focus:ring-2 focus:ring-[#B8A3D9]/40"
    >
      <option value="all">All {label}</option>
      {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  )
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-[#958777] block mb-1">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-[#958777] mt-1 block">{hint}</span>}
    </label>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 text-sm rounded-lg border border-[#E5E5E5] bg-white text-[#625346] focus:outline-none focus:ring-2 focus:ring-[#B8A3D9]/40 ${props.className ?? ''}`}
    />
  )
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 text-sm rounded-lg border border-[#E5E5E5] bg-white text-[#625346] focus:outline-none focus:ring-2 focus:ring-[#B8A3D9]/40 ${props.className ?? ''}`}
    />
  )
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2 text-sm rounded-lg border border-[#E5E5E5] bg-white text-[#625346] focus:outline-none focus:ring-2 focus:ring-[#B8A3D9]/40 ${props.className ?? ''}`}
    />
  )
}

export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`btn-primary text-xs ${props.className ?? ''}`}>{children}</button>
}

export function GhostButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`px-2.5 py-1.5 rounded-lg border border-[#E5E5E5] bg-white text-[11px] font-semibold text-[#625346] hover:bg-[#FAF7EF] disabled:opacity-40 ${props.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export function LoadingBlock({ label = 'Loading contract data…' }: { label?: string }) {
  return (
    <div className="enterprise-card p-10 text-center">
      <div className="w-6 h-6 border-2 border-[#B8A3D9] border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-xs text-[#958777] mt-3">{label}</p>
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="enterprise-card p-8 text-center border-l-4 border-l-[#D9786C]">
      <h3 className="text-sm font-bold text-[#625346]">Contract data unavailable</h3>
      <p className="text-xs text-[#958777] mt-1">{message}</p>
      {onRetry && <PrimaryButton onClick={onRetry} className="mt-4">Retry</PrimaryButton>}
    </div>
  )
}

export function BarRow({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[#625346] font-semibold truncate">{label}</span>
        <span className="text-[#958777] tabular-nums">{value}{suffix ?? ''}</span>
      </div>
      <div className="h-2 rounded-full bg-[#F7F0D9] overflow-hidden">
        <div className="h-full rounded-full bg-[#B8A3D9]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function ArrowPager({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(1, page - 1))} className="p-1.5 rounded border border-[#E5E5E5]" aria-label="Previous page"><ChevronLeft className="w-3.5 h-3.5" /></button>
      <span className="text-[11px] text-[#958777] px-1">{page}/{Math.max(1, total)}</span>
      <button type="button" onClick={() => onChange(Math.min(total, page + 1))} className="p-1.5 rounded border border-[#E5E5E5]" aria-label="Next page"><ChevronRight className="w-3.5 h-3.5" /></button>
    </div>
  )
}
