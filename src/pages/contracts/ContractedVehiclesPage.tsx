import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, FileText, Plus, Search, Truck } from 'lucide-react'
import { useContracts } from '../../hooks/useContracts'
import { useFleet } from '../../hooks/useFleet'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, MetricTile } from '../../components/ui/EnterprisePrimitives'
import {
  ContractStatusBadge,
  OwnershipBadge,
  ResponsibilityBadge,
} from '../../components/contracts/ContractPrimitives'

export default function ContractedVehiclesPage() {
  const navigate = useNavigate()
  const { vehicles } = useFleet()
  const { contracts, contractVehicles, handovers, partners, owners, hasPermission } = useContracts()
  const [q, setQ] = useState('')
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'contracted_fleet' | 'individual_owner'>('all')

  const thirdPartyVehicles = useMemo(
    () =>
      vehicles.filter((v) => {
        const cat = v.ownershipCategory ?? 'company_owned'
        if (cat === 'company_owned') return false
        if (ownershipFilter !== 'all' && cat !== ownershipFilter) return false
        const query = q.trim().toLowerCase()
        if (!query) return true
        return (
          v.registrationNumber.toLowerCase().includes(query) ||
          v.make.toLowerCase().includes(query) ||
          v.model.toLowerCase().includes(query) ||
          (v.legalOwnerName ?? '').toLowerCase().includes(query)
        )
      }),
    [ownershipFilter, q, vehicles],
  )

  const pendingReturns = handovers.filter((h) => {
    if (h.recordType !== 'initial_handover') return false
    return !handovers.some((r) => r.contractId === h.contractId && r.vehicleId === h.vehicleId && r.recordType === 'vehicle_return')
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracted & Owner-Supplied Vehicles"
        subtitle="Non-company-owned vehicles under commercial Fleet Partner or Individual Owner agreements"
      >
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => navigate('/dashboard/fleet')} className="btn-secondary">
            <Truck className="w-4 h-4" />
            All Fleet Assets
          </button>
          {hasPermission('manage_contract_vehicles') && (
            <button
              type="button"
              onClick={() => navigate('/dashboard/contracts/vehicles/handover/new')}
              className="btn-accent"
            >
              <Plus className="w-4 h-4" />
              Record Initial Handover
            </button>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile
          title="Total Contracted Assets"
          value={vehicles.filter((v) => (v.ownershipCategory ?? 'company_owned') !== 'company_owned').length}
          subtitle="Excluded from company loan EMIs"
          color="#6E5696"
        />
        <MetricTile
          title="Fleet Partner Vehicles"
          value={vehicles.filter((v) => v.ownershipCategory === 'contracted_fleet').length}
          subtitle={`${partners.length} active partner supplier(s)`}
          color="#789A75"
        />
        <MetricTile
          title="Individual Owner Vehicles"
          value={vehicles.filter((v) => v.ownershipCategory === 'individual_owner').length}
          subtitle={`${owners.length} registered individual owner(s)`}
          color="#D8B442"
        />
        <MetricTile
          title="Open Handover Records"
          value={pendingReturns.length}
          subtitle="Awaiting end-of-contract return inspection"
          color={pendingReturns.length > 0 ? '#D8B442' : '#4D6E4A'}
        />
      </div>

      <div className="enterprise-card p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'contracted_fleet', 'individual_owner'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setOwnershipFilter(tab)}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold border transition-colors ${
                ownershipFilter === tab
                  ? 'bg-[#625346] text-white border-[#625346]'
                  : 'bg-[#FAFAFA] text-[#625346] border-[#E5E5E5] hover:bg-[#F2F2F2]'
              }`}
            >
              {tab === 'all' ? 'All Third-Party' : tab === 'contracted_fleet' ? 'Contracted Fleet' : 'Individual Owner'}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#958777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search registration, make, legal owner..."
            className="dm-input pl-9 py-1.5 text-xs"
          />
        </div>
      </div>

      {thirdPartyVehicles.length === 0 ? (
        <EmptySectionState
          title="No contracted or owner-supplied vehicles match"
          description="Register a third-party vehicle or adjust filters to inspect ownership and handover records."
          actionLabel="Register Vehicle"
          onAction={() => navigate('/dashboard/fleet/new')}
        />
      ) : (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Vehicle & Category</th>
                  <th>Legal Owner / Supplier</th>
                  <th>Active Agreement</th>
                  <th>Maint. Responsibility</th>
                  <th>Handover Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {thirdPartyVehicles.map((v) => {
                  const link = contractVehicles.find((l) => l.vehicleId === v.id)
                  const contract = contracts.find((c) => c.id === (v.activeContractId ?? link?.contractId))
                  const initialHandover = handovers.find(
                    (h) => h.vehicleId === v.id && h.recordType === 'initial_handover',
                  )
                  const returnHandover = handovers.find(
                    (h) => h.vehicleId === v.id && h.recordType === 'vehicle_return',
                  )
                  const partner = partners.find((p) => p.id === v.fleetPartnerId)
                  const owner = owners.find((o) => o.id === v.individualOwnerId)

                  return (
                    <tr key={v.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/fleet/vehicles/${v.id}`)}
                          className="font-bold text-[#625346] hover:text-[#6E5696] hover:underline block text-left"
                        >
                          {v.registrationNumber}
                        </button>
                        <div className="text-xs text-[#958777] mb-1">
                          {v.make} {v.model} · {v.odometerKm.toLocaleString('en-IN')} km
                        </div>
                        <OwnershipBadge category={v.ownershipCategory} />
                      </td>
                      <td>
                        {partner ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/dashboard/contracts/partners/${partner.id}`)}
                            className="font-semibold text-[#6E5696] hover:underline text-left block"
                          >
                            {partner.companyName}
                          </button>
                        ) : owner ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/dashboard/contracts/owners/${owner.id}`)}
                            className="font-semibold text-[#6E5696] hover:underline text-left block"
                          >
                            {owner.fullName}
                          </button>
                        ) : (
                          <span className="font-semibold text-[#625346] block">
                            {v.legalOwnerName ?? 'Third-Party Owner'}
                          </span>
                        )}
                        <span className="text-xs text-[#958777]">
                          {partner ? partner.partnerCode : owner ? owner.ownerCode : 'Unlinked profile'}
                        </span>
                      </td>
                      <td>
                        {contract ? (
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/dashboard/contracts/register/${contract.id}`)}
                              className="font-semibold text-[#625346] hover:text-[#6E5696] hover:underline block text-left"
                            >
                              {contract.contractCode}
                            </button>
                            <ContractStatusBadge status={contract.status} />
                          </div>
                        ) : (
                          <span className="text-xs text-[#A24034] font-semibold">No Active Contract</span>
                        )}
                      </td>
                      <td>
                        <ResponsibilityBadge
                          party={contract?.contractConditions.maintenanceResponsibility ?? 'unspecified'}
                        />
                      </td>
                      <td className="text-xs">
                        {returnHandover ? (
                          <span className="font-semibold text-[#4D6E4A]">
                            Returned ({returnHandover.handoverDate})
                          </span>
                        ) : initialHandover ? (
                          <div>
                            <div className="font-semibold text-[#625346]">
                              In Fleet ({initialHandover.handoverDate})
                            </div>
                            <div className="text-[#958777]">
                              Start Odo: {initialHandover.odometerKm.toLocaleString('en-IN')} km
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#8F6510] font-semibold">Initial handover pending</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/dashboard/fleet/vehicles/${v.id}`)}
                            className="btn-secondary text-xs px-2.5 py-1.5"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Vehicle
                          </button>
                          {initialHandover && !returnHandover && hasPermission('manage_contract_vehicles') && (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/dashboard/contracts/vehicles/return/${initialHandover.id}`)
                              }
                              className="btn-primary text-xs px-2.5 py-1.5"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                              Return Check
                            </button>
                          )}
                          {!initialHandover && hasPermission('manage_contract_vehicles') && (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/dashboard/contracts/vehicles/handover/new?vehicleId=${v.id}${
                                    contract ? `&contractId=${contract.id}` : ''
                                  }`,
                                )
                              }
                              className="btn-accent text-xs px-2.5 py-1.5"
                            >
                              Handover
                            </button>
                          )}
                        </div>
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
