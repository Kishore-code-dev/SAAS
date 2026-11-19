import React, { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, Plus, Search } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, formatInr, formatShortDate } from '../../components/ui/EnterprisePrimitives'
import { useFinance } from '../../hooks/useFinance'
import { useFleet } from '../../hooks/useFleet'
import { canPerformAction } from '../../utils/rbac'
import AddVehicleFinanceModal from '../../components/finance/AddVehicleFinanceModal'
import { FinanceStatusBadge } from '../../components/finance/FinancePrimitives'
import { exportRowsToCsv, loanTypeLabel } from '../../utils/financeHelpers'

export default function VehicleFinanceListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { activeRole, activeOrganization } = useFleet()
  const { records } = useFinance()

  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') ?? 'all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [bankFilter, setBankFilter] = useState<string>('all')

  const canAdd = canPerformAction(activeRole, 'add_finance_records')

  const banks = useMemo(() => Array.from(new Set(records.map((r) => r.bankName))).sort(), [records])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records.filter((r) => {
      if (statusFilter !== 'all' && r.financeStatus !== statusFilter) return false
      if (typeFilter !== 'all' && r.loanType !== typeFilter) return false
      if (bankFilter !== 'all' && r.bankName !== bankFilter) return false
      if (!q) return true
      return (
        r.vehicleRegistration.toLowerCase().includes(q) ||
        r.vehicleName.toLowerCase().includes(q) ||
        r.vehicleMakeModel.toLowerCase().includes(q) ||
        r.bankName.toLowerCase().includes(q) ||
        r.loanReferenceNumber.toLowerCase().includes(q) ||
        r.loanAccountMasked.toLowerCase().includes(q)
      )
    })
  }, [records, query, statusFilter, typeFilter, bankFilter])

  const handleExport = () => {
    exportRowsToCsv(
      `vehicle-finance-register-${activeOrganization.code}`,
      [
        'Vehicle Number',
        'Vehicle Name',
        'Make & Model',
        'Financing Bank',
        'Loan Account Ref (Masked)',
        'Loan Reference',
        'Loan Type',
        'Loan Start Date',
        'Loan End Date',
        'Original Loan Amount',
        'Outstanding Principal',
        'EMI Amount',
        'Next EMI Due Date',
        'Finance Status',
      ],
      filtered.map((r) => [
        r.vehicleRegistration,
        r.vehicleName,
        r.vehicleMakeModel,
        r.bankName,
        r.loanAccountMasked,
        r.loanReferenceNumber,
        loanTypeLabel(r.loanType, r.customLoanTypeLabel),
        r.loanStartDate,
        r.finalEmiDate,
        r.principalAmount,
        r.outstandingPrincipal,
        r.emiAmount,
        r.nextDueDate ?? '—',
        r.financeStatus,
      ]),
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicle Finance Register"
        subtitle={`${activeOrganization.name} · Active & historical vehicle loans, leases, and hire purchase agreements`}
      >
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleExport} className="btn-secondary text-xs">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          {canAdd && (
            <button type="button" onClick={() => setAddOpen(true)} className="btn-primary text-xs">
              <Plus className="w-4 h-4" />
              Add Vehicle Finance
            </button>
          )}
        </div>
      </PageHeader>

      <div className="enterprise-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#958777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vehicle, loan ref, bank..."
            aria-label="Search vehicle finance register"
            className="dm-input pl-9 py-2 text-xs"
          />
        </div>
        <select aria-label="Filter by loan type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="dm-input py-2 text-xs">
          <option value="all">All Loan Types</option>
          <option value="vehicle_loan">Vehicle Loan</option>
          <option value="commercial_vehicle_loan">Commercial Vehicle Loan</option>
          <option value="lease">Lease</option>
          <option value="hire_purchase">Hire Purchase</option>
          <option value="other">Other Configurable</option>
        </select>
        <select aria-label="Filter by bank" value={bankFilter} onChange={(e) => setBankFilter(e.target.value)} className="dm-input py-2 text-xs">
          <option value="all">All Financing Banks</option>
          {banks.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select aria-label="Filter by finance status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="dm-input py-2 text-xs">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="overdue">Overdue</option>
          <option value="restructured">Restructured</option>
          <option value="foreclosed">Foreclosed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptySectionState
          title="No matching vehicle finance records"
          description="Try clearing filters or register a new vehicle loan, lease, or hire purchase arrangement."
          actionLabel={canAdd ? 'Add Vehicle Finance' : undefined}
          onAction={canAdd ? () => setAddOpen(true) : undefined}
        />
      ) : (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table [&_th]:px-2.5 [&_td]:px-2.5 [&_th]:text-[11px]">
              <thead>
                <tr>
                  <th>Vehicle Number</th>
                  <th>Vehicle Name</th>
                  <th>Make & Model</th>
                  <th>Financing Bank</th>
                  <th>Loan Account Ref</th>
                  <th>Loan Type</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Original Loan Amt</th>
                  <th>Outstanding Principal</th>
                  <th>EMI Amount</th>
                  <th>Next EMI Due</th>
                  <th>Finance Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/dashboard/finance/vehicles/${r.id}`)}
                    className="cursor-pointer"
                  >
                    <td className="font-bold text-[#625346] whitespace-nowrap">{r.vehicleRegistration}</td>
                    <td className="whitespace-nowrap">{r.vehicleName}</td>
                    <td className="text-xs text-[#958777] whitespace-nowrap">{r.vehicleMakeModel}</td>
                    <td className="whitespace-nowrap">{r.bankName}</td>
                    <td className="font-mono text-xs whitespace-nowrap">
                      <div>{r.loanAccountMasked}</div>
                      <div className="text-[11px] text-[#958777]">{r.loanReferenceNumber}</div>
                    </td>
                    <td className="whitespace-nowrap text-xs">{loanTypeLabel(r.loanType, r.customLoanTypeLabel)}</td>
                    <td className="tabular-nums text-xs whitespace-nowrap">{formatShortDate(r.loanStartDate)}</td>
                    <td className="tabular-nums text-xs whitespace-nowrap">{formatShortDate(r.finalEmiDate)}</td>
                    <td className="tabular-nums font-semibold whitespace-nowrap">{formatInr(r.principalAmount)}</td>
                    <td className="tabular-nums font-bold text-[#625346] whitespace-nowrap">{formatInr(r.outstandingPrincipal)}</td>
                    <td className="tabular-nums whitespace-nowrap">{formatInr(r.emiAmount)}</td>
                    <td className="tabular-nums text-xs whitespace-nowrap">{r.nextDueDate ? formatShortDate(r.nextDueDate) : '—'}</td>
                    <td><FinanceStatusBadge status={r.financeStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddVehicleFinanceModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
