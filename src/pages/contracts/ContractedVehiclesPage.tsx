import React, { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useContractWorkspace } from '../../hooks/useContracts'
import type { OwnershipType } from '../../types/contracts'
import {
  ContractPage,
  ContractStatusBadge,
  DataTable,
  ErrorBlock,
  FilterSelect,
  LoadingBlock,
  OWNERSHIP_OPTIONS,
  OwnershipBadge,
  ResponsibilityBadge,
  Toolbar,
  inr,
  shortDate,
} from './ContractUi'

interface VehicleRow {
  key: string
  vehicleId: string
  registration: string
  category: string
  ownershipType: OwnershipType
  legalOwner: string
  contractId: string
  contractNumber: string
  contractStatus: string
  supplier: string
  startDate: string
  expiryDate: string
  rentalInr: number
  maintenance: string
  returnedAt?: string | null
}

export default function ContractedVehiclesPage() {
  const [params] = useSearchParams()
  const { data, loading, error, refresh } = useContractWorkspace()
  const [search, setSearch] = useState('')
  const [ownershipFilter, setOwnershipFilter] = useState(params.get('ownership') ?? 'all')
  const [statusFilter, setStatusFilter] = useState('all')

  const rows = useMemo<VehicleRow[]>(() => {
    if (!data) return []
    return data.contracts.flatMap((contract) =>
      contract.vehicles.map((link) => {
        const record = data.ownership.find((o) => o.vehicleId === link.vehicleId)
        return {
          key: `${contract.id}-${link.vehicleId}`,
          vehicleId: link.vehicleId,
          registration: link.vehicleRegistration,
          category: link.vehicleCategory,
          ownershipType: link.ownershipType,
          legalOwner: record?.legalOwnerName ?? contract.supplierName,
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          contractStatus: contract.status,
          supplier: contract.supplierName,
          startDate: contract.startDate,
          expiryDate: contract.expiryDate,
          rentalInr: link.agreedRentalInr,
          maintenance: link.maintenanceResponsibility,
          returnedAt: link.returnedAt,
        }
      }),
    )
  }, [data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (ownershipFilter !== 'all' && row.ownershipType !== ownershipFilter) return false
      if (statusFilter !== 'all' && row.contractStatus !== statusFilter) return false
      if (!q) return true
      return `${row.registration} ${row.supplier} ${row.contractNumber} ${row.legalOwner}`.toLowerCase().includes(q)
    })
  }, [rows, search, ownershipFilter, statusFilter])

  const counts = {
    company: rows.filter((r) => r.ownershipType === 'company_owned').length,
    contracted: rows.filter((r) => r.ownershipType === 'contracted_fleet').length,
    individual: rows.filter((r) => r.ownershipType === 'individual_owner').length,
  }

  return (
    <ContractPage
      title="Contracted Vehicles"
      subtitle="Every supplied vehicle with its legal owner, operating contract, agreed rental and maintenance responsibility."
    >
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Company Owned', value: counts.company, type: 'company_owned' as OwnershipType },
          { label: 'Contracted Fleet', value: counts.contracted, type: 'contracted_fleet' as OwnershipType },
          { label: 'Individual Owner', value: counts.individual, type: 'individual_owner' as OwnershipType },
        ].map((item) => (
          <div key={item.type} className="enterprise-card p-4">
            <OwnershipBadge type={item.type} />
            <p className="text-xl font-bold text-[#625346] mt-2 tabular-nums">{item.value}</p>
            <p className="text-[11px] text-[#958777]">vehicles in operating fleet</p>
          </div>
        ))}
      </div>

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search registration, legal owner, supplier or contract"
        filters={
          <>
            <FilterSelect label="ownership" value={ownershipFilter} onChange={setOwnershipFilter} options={OWNERSHIP_OPTIONS} />
            <FilterSelect
              label="contract statuses"
              value={statusFilter}
              onChange={setStatusFilter}
              options={Array.from(new Set(rows.map((r) => r.contractStatus))).map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
            />
          </>
        }
      />

      {loading && <LoadingBlock />}
      {!loading && error && <ErrorBlock message={error} onRetry={() => void refresh()} />}
      {!loading && !error && (
        <DataTable
          rows={filtered}
          rowKey={(row) => row.key}
          emptyTitle="No vehicles match these filters"
          emptyDescription="Contracted and individually supplied vehicles appear here once linked to a contract."
          columns={[
            {
              key: 'vehicle',
              label: 'Vehicle',
              render: (row) => (
                <div>
                  <Link to={`/dashboard/fleet/vehicles/${row.vehicleId}`} className="text-xs font-bold text-[#625346] hover:text-[#6E5696]">{row.registration}</Link>
                  <p className="text-[10px] text-[#958777]">{row.category}</p>
                </div>
              ),
            },
            { key: 'ownership', label: 'Ownership', render: (row) => <OwnershipBadge type={row.ownershipType} /> },
            {
              key: 'owner',
              label: 'Legal Owner / Supplier',
              render: (row) => (
                <div>
                  <p className="text-xs text-[#625346]">{row.legalOwner}</p>
                  <p className="text-[10px] text-[#958777]">Operating supplier: {row.supplier}</p>
                </div>
              ),
            },
            {
              key: 'contract',
              label: 'Contract',
              render: (row) => (
                <div>
                  <Link to={`/dashboard/contracts/${row.contractId}`} className="text-xs font-semibold text-[#6E5696]">{row.contractNumber}</Link>
                  <div className="mt-1"><ContractStatusBadge status={row.contractStatus as never} /></div>
                </div>
              ),
            },
            { key: 'term', label: 'Term', render: (row) => <span className="text-[11px] text-[#958777]">{shortDate(row.startDate)} → {shortDate(row.expiryDate)}</span> },
            { key: 'rental', label: 'Agreed Rental', className: 'text-right', render: (row) => <span className="text-xs tabular-nums">{row.rentalInr ? inr(row.rentalInr) : '—'}</span> },
            { key: 'maintenance', label: 'Maintenance', render: (row) => <ResponsibilityBadge value={row.maintenance as never} /> },
            { key: 'returned', label: 'Return', render: (row) => <span className="text-[11px] text-[#958777]">{row.returnedAt ? shortDate(row.returnedAt) : 'In service'}</span> },
          ]}
        />
      )}
    </ContractPage>
  )
}
