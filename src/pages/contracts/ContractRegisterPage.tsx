import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Plus, Search } from 'lucide-react'
import { useContracts } from '../../hooks/useContracts'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, formatInr } from '../../components/ui/EnterprisePrimitives'
import { ContractStatusBadge } from '../../components/contracts/ContractPrimitives'

export default function ContractRegisterPage() {
  const navigate = useNavigate()
  const { contracts, contractVehicles, hasPermission } = useContracts()

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return contracts.filter((c) => {
      const mQ =
        !query ||
        c.contractCode.toLowerCase().includes(query) ||
        c.contractName.toLowerCase().includes(query) ||
        c.supplierName.toLowerCase().includes(query) ||
        c.agreementRefNumber.toLowerCase().includes(query)
      const mStatus = statusFilter === 'all' || c.status === statusFilter
      const mSupplier = supplierFilter === 'all' || c.supplierType === supplierFilter
      const mCat = categoryFilter === 'all' || c.contractCategory === categoryFilter
      return mQ && mStatus && mSupplier && mCat
    })
  }, [categoryFilter, contracts, q, statusFilter, supplierFilter])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contract Register"
        subtitle={<>Master registry of third-party Fleet Partner &amp; Individual Owner agreements ({contracts.length} total)</>}
      >
        {hasPermission('create_contracts') && (
          <button type="button" onClick={() => navigate('/dashboard/contracts/register/new')} className="btn-accent">
            <Plus className="w-4 h-4" />
            Create Contract
          </button>
        )}
      </PageHeader>

      <div className="enterprise-card p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter by contract status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="dm-input py-1.5 text-xs w-44"
          >
            <option value="all">All Lifecycle Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="awaiting_handover">Awaiting Handover</option>
            <option value="active">Active</option>
            <option value="renewal_pending">Renewal Pending</option>
            <option value="expired">Expired</option>
            <option value="vehicle_return_pending">Vehicle Return Pending</option>
            <option value="closed">Closed</option>
          </select>

          <select
            aria-label="Filter by supplier type"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="dm-input py-1.5 text-xs w-44"
          >
            <option value="all">All Supplier Types</option>
            <option value="fleet_partner">Fleet Partner</option>
            <option value="individual_owner">Individual Owner</option>
          </select>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="dm-input py-1.5 text-xs w-48"
          >
            <option value="all">All Contract Categories</option>
            <option value="fixed_monthly_rental">Fixed Monthly Rental</option>
            <option value="per_km_rental">Per-Km Rental</option>
            <option value="per_trip_rental">Per-Trip Rental</option>
            <option value="revenue_sharing">Revenue Sharing</option>
            <option value="fixed_plus_variable">Fixed + Variable</option>
            <option value="custom_agreement">Custom Agreement</option>
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#958777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, supplier, agreement..."
            className="dm-input pl-9 py-1.5 text-xs"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptySectionState
          title="No matching contracts"
          description="Adjust your search filters or create a new Fleet Partner / Individual Owner contract."
          actionLabel={hasPermission('create_contracts') ? 'Create Contract' : undefined}
          onAction={hasPermission('create_contracts') ? () => navigate('/dashboard/contracts/register/new') : undefined}
        />
      ) : (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Contract Code & Title</th>
                  <th>Supplier / Legal Owner</th>
                  <th>Category</th>
                  <th>Linked Vehicles</th>
                  <th>Terms Summary</th>
                  <th>Term Dates</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const linked = contractVehicles.filter((v) => v.contractId === c.id)
                  return (
                    <tr key={c.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/contracts/register/${c.id}`)}
                          className="font-bold text-[#625346] hover:text-[#6E5696] hover:underline text-left block"
                        >
                          {c.contractCode} <span className="text-[11px] font-medium text-[#958777]">(v{c.currentVersion})</span>
                        </button>
                        <span className="text-xs text-[#958777]">{c.contractName}</span>
                      </td>
                      <td>
                        <span className="font-semibold text-[#625346] block">{c.supplierName}</span>
                        <span className="text-xs text-[#958777] capitalize">{c.supplierType.replace(/_/g, ' ')} · {c.agreementRefNumber}</span>
                      </td>
                      <td className="text-xs capitalize text-[#625346]">{c.contractCategory.replace(/_/g, ' ')}</td>
                      <td className="text-xs text-[#625346]">
                        {linked.length === 0 ? 'Unlinked' : linked.map((l) => l.vehicleRegistration).join(', ')}
                      </td>
                      <td className="text-xs text-[#625346] tabular-nums">
                        {c.financialTerms.monthlyRental > 0 && <div>{formatInr(c.financialTerms.monthlyRental)}/mo</div>}
                        {c.financialTerms.perKmRate > 0 && <div>{formatInr(c.financialTerms.perKmRate)}/km</div>}
                        {c.financialTerms.revenueSharingPct > 0 && <div>{c.financialTerms.revenueSharingPct}% share</div>}
                        <div className="text-[#958777]">Maint: {c.contractConditions.maintenanceResponsibility.replace(/_/g, ' ')}</div>
                      </td>
                      <td className="text-xs text-[#625346] tabular-nums whitespace-nowrap">
                        <div>{c.startDate}</div>
                        <div className="text-[#958777]">to {c.expiryDate}</div>
                      </td>
                      <td>
                        <ContractStatusBadge status={c.status} />
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/contracts/register/${c.id}`)}
                          className="btn-secondary text-xs px-3 py-1.5"
                        >
                          Inspect
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
