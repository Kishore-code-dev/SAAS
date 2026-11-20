import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Eye, FilePlus2, ShieldAlert, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useFleet } from '../../hooks/useFleet'
import { contractRequest, useContractWorkspace } from '../../hooks/useContracts'
import { canPerformContractAction } from '../../utils/rbac'
import { EnterpriseModal } from '../../components/ui/EnterprisePrimitives'
import type {
  ContractCategory,
  ContractStatus,
  MaintenanceResponsibility,
  SupplierType,
} from '../../types/contracts'
import {
  CONTRACT_STATUS_OPTIONS,
  ContractPage,
  ContractStatusBadge,
  DataTable,
  ErrorBlock,
  Field,
  FilterSelect,
  GhostButton,
  Input,
  LoadingBlock,
  OwnershipBadge,
  PrimaryButton,
  Select,
  Textarea,
  Toolbar,
  inr,
  shortDate,
  todayIso,
} from './ContractUi'

const CATEGORY_OPTIONS: Array<{ value: ContractCategory; label: string }> = [
  { value: 'fixed_monthly', label: 'Fixed Monthly Rental' },
  { value: 'per_km', label: 'Per-Kilometre Rental' },
  { value: 'per_trip', label: 'Per-Trip Rental' },
  { value: 'revenue_sharing', label: 'Revenue Sharing' },
  { value: 'fixed_variable', label: 'Fixed + Variable' },
  { value: 'custom', label: 'Custom Agreement' },
]

const RESPONSIBILITY_OPTIONS: Array<{ value: MaintenanceResponsibility; label: string }> = [
  { value: 'operating_org', label: 'Operating organization' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'shared', label: 'Shared' },
  { value: 'unspecified', label: 'Unspecified' },
]

const emptyForm = () => ({
  name: '',
  category: 'fixed_monthly' as ContractCategory,
  supplierType: 'fleet_partner' as SupplierType,
  supplierId: '',
  agreementReference: '',
  agreementDate: todayIso(),
  startDate: todayIso(),
  expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  durationMonths: '12',
  description: '',
  monthlyRental: '0',
  perKmRate: '0',
  perTripRate: '0',
  revenueSharePct: '0',
  advancePayment: '0',
  securityDeposit: '0',
  paymentFrequency: 'monthly',
  paymentDueDay: '5',
  maintenance: 'supplier' as MaintenanceResponsibility,
  fuel: 'operating_org' as MaintenanceResponsibility,
  insurance: 'supplier' as MaintenanceResponsibility,
  tyres: 'supplier' as MaintenanceResponsibility,
  driver: 'operating_org' as MaintenanceResponsibility,
})

export default function ContractRegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data, loading, error, refresh } = useContractWorkspace()
  const { vehicles, activeRole } = useFleet()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(params.get('status') ?? 'all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const canCreate = canPerformContractAction(activeRole, 'create_contracts')
  const canApprove = canPerformContractAction(activeRole, 'approve_contracts')
  const canTerminate = canPerformContractAction(activeRole, 'terminate_contracts')

  const contracts = data?.contracts ?? []
  const partners = data?.partners ?? []
  const owners = data?.owners ?? []
  const suppliers = form.supplierType === 'fleet_partner' ? partners : owners

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contracts.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false
      if (supplierFilter !== 'all' && c.supplierName !== supplierFilter) return false
      if (!q) return true
      return `${c.contractNumber} ${c.name} ${c.supplierName} ${c.agreementReference}`.toLowerCase().includes(q)
    })
  }, [contracts, search, statusFilter, categoryFilter, supplierFilter])

  const supplierNames = Array.from(new Set(contracts.map((c) => c.supplierName)))

  const toggleVehicle = (id: string) => {
    setSelectedVehicles((current) => current.includes(id) ? current.filter((v) => v !== id) : [...current, id])
  }

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Contract name is required.'); return }
    if (!form.supplierId) { toast.error('Select a supplier.'); return }
    if (selectedVehicles.length === 0) { toast.error('Select at least one vehicle.'); return }
    setSaving(true)
    try {
      await contractRequest('/', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          supplierType: form.supplierType,
          fleetPartnerId: form.supplierType === 'fleet_partner' ? form.supplierId : undefined,
          individualOwnerId: form.supplierType === 'individual_owner' ? form.supplierId : undefined,
          agreementReference: form.agreementReference,
          agreementDate: form.agreementDate,
          startDate: form.startDate,
          expiryDate: form.expiryDate,
          durationMonths: Number(form.durationMonths || 0),
          description: form.description,
          status: 'draft',
          financialTerms: {
            fixedRentalInr: Number(form.monthlyRental || 0),
            monthlyRentalInr: Number(form.monthlyRental || 0),
            perKmRateInr: Number(form.perKmRate || 0),
            perTripRateInr: Number(form.perTripRate || 0),
            revenueSharePct: Number(form.revenueSharePct || 0),
            advancePaymentInr: Number(form.advancePayment || 0),
            securityDepositInr: Number(form.securityDeposit || 0),
            paymentFrequency: form.paymentFrequency,
            paymentDueDay: Number(form.paymentDueDay || 5),
          },
          conditions: {
            maintenance: form.maintenance,
            fuel: form.fuel,
            insurance: form.insurance,
            tyres: form.tyres,
            driver: form.driver,
          },
          vehicles: selectedVehicles.map((vehicleId) => ({
            vehicleId,
            agreedRentalInr: Number(form.monthlyRental || 0),
            maintenanceResponsibility: form.maintenance,
          })),
        }),
      })
      toast.success('Contract created as draft.')
      setCreateOpen(false)
      setForm(emptyForm())
      setSelectedVehicles([])
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to create contract.')
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (contractId: string, status: ContractStatus) => {
    try {
      await contractRequest(`/${encodeURIComponent(contractId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      toast.success(`Contract marked ${status.replace(/_/g, ' ')}.`)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update status.')
    }
  }

  return (
    <ContractPage
      title="Contract Register"
      subtitle="Every agreement, its supplier, vehicles, validity and lifecycle status. Amendments preserve prior versions."
      actions={canCreate ? <PrimaryButton onClick={() => setCreateOpen(true)}><FilePlus2 className="w-3.5 h-3.5" /> New Contract</PrimaryButton> : undefined}
    >
      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search contract number, name, supplier or agreement reference"
        filters={
          <>
            <FilterSelect label="statuses" value={statusFilter} onChange={setStatusFilter} options={CONTRACT_STATUS_OPTIONS} />
            <FilterSelect label="categories" value={categoryFilter} onChange={setCategoryFilter} options={CATEGORY_OPTIONS} />
            <FilterSelect label="suppliers" value={supplierFilter} onChange={setSupplierFilter} options={supplierNames.map((name) => ({ value: name, label: name }))} />
          </>
        }
      />

      {loading && <LoadingBlock />}
      {!loading && error && <ErrorBlock message={error} onRetry={() => void refresh()} />}
      {!loading && !error && (
        <DataTable
          rows={filtered}
          rowKey={(c) => c.id}
          onRowClick={(c) => navigate(`/dashboard/contracts/${c.id}`)}
          emptyTitle="No contracts match these filters"
          emptyDescription="Create a contract or adjust the status, category and supplier filters."
          columns={[
            {
              key: 'contract',
              label: 'Contract',
              render: (c) => (
                <div>
                  <p className="text-xs font-bold text-[#625346]">{c.contractNumber}</p>
                  <p className="text-[11px] text-[#958777] truncate max-w-[220px]">{c.name}</p>
                </div>
              ),
            },
            {
              key: 'supplier',
              label: 'Supplier',
              render: (c) => (
                <div>
                  <p className="text-xs font-semibold text-[#625346]">{c.supplierName}</p>
                  <OwnershipBadge type={c.supplierType === 'fleet_partner' ? 'contracted_fleet' : 'individual_owner'} />
                </div>
              ),
            },
            {
              key: 'vehicles',
              label: 'Vehicles',
              render: (c) => <span className="text-xs tabular-nums">{c.vehicles.length}</span>,
            },
            { key: 'status', label: 'Status', render: (c) => <ContractStatusBadge status={c.status} /> },
            {
              key: 'term',
              label: 'Term',
              render: (c) => <span className="text-[11px] text-[#958777]">{shortDate(c.startDate)} → {shortDate(c.expiryDate)}</span>,
            },
            {
              key: 'value',
              label: 'Monthly Value',
              className: 'text-right',
              render: (c) => <span className="text-xs font-semibold tabular-nums">{c.financialTerms.monthlyRentalInr ? inr(c.financialTerms.monthlyRentalInr) : '—'}</span>,
            },
          ]}
          actions={(c) => (
            <>
              <GhostButton onClick={() => navigate(`/dashboard/contracts/${c.id}`)} aria-label="View contract"><Eye className="w-3.5 h-3.5" /></GhostButton>
              {canApprove && (c.status === 'draft' || c.status === 'pending_approval') && (
                <GhostButton onClick={() => void changeStatus(c.id, 'active')} aria-label="Approve contract"><CheckCircle2 className="w-3.5 h-3.5 text-[#4D6E4A]" /></GhostButton>
              )}
              {canTerminate && c.status === 'active' && (
                <GhostButton onClick={() => void changeStatus(c.id, 'termination_requested')} aria-label="Request termination"><XCircle className="w-3.5 h-3.5 text-[#B84E42]" /></GhostButton>
              )}
            </>
          )}
        />
      )}

      <EnterpriseModal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Vehicle Contract" subtitle="Ownership and financial responsibility stay separate from operational control." maxWidthClass="max-w-4xl">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Contract name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. EV cargo lease — Bengaluru hub" /></Field>
            <Field label="Contract category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ContractCategory })}>
                {CATEGORY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </Select>
            </Field>
            <Field label="Supplier type">
              <Select value={form.supplierType} onChange={(e) => setForm({ ...form, supplierType: e.target.value as SupplierType, supplierId: '' })}>
                <option value="fleet_partner">Fleet partner</option>
                <option value="individual_owner">Individual vehicle owner</option>
              </Select>
            </Field>
            <Field label={form.supplierType === 'fleet_partner' ? 'Fleet partner' : 'Individual owner'}>
              <Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                <option value="">Select supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{'companyName' in s ? s.companyName : s.fullName}</option>
                ))}
              </Select>
            </Field>
            <Field label="Agreement reference"><Input value={form.agreementReference} onChange={(e) => setForm({ ...form, agreementReference: e.target.value })} placeholder="DVS/KAV/2026/001" /></Field>
            <Field label="Agreement date"><Input type="date" value={form.agreementDate} onChange={(e) => setForm({ ...form, agreementDate: e.target.value })} /></Field>
            <Field label="Start date"><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
            <Field label="Expiry date"><Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></Field>
            <Field label="Duration (months)"><Input type="number" min="1" value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} /></Field>
            <Field label="Security deposit (INR)"><Input type="number" min="0" value={form.securityDeposit} onChange={(e) => setForm({ ...form, securityDeposit: e.target.value })} /></Field>
          </div>

          <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Scope, corridor, special conditions" /></Field>

          <div>
            <p className="text-[11px] font-bold text-[#625346] mb-2">Financial terms</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Monthly rental (INR)"><Input type="number" min="0" value={form.monthlyRental} onChange={(e) => setForm({ ...form, monthlyRental: e.target.value })} /></Field>
              <Field label="Per-km rate (INR)"><Input type="number" min="0" value={form.perKmRate} onChange={(e) => setForm({ ...form, perKmRate: e.target.value })} /></Field>
              <Field label="Per-trip rate (INR)"><Input type="number" min="0" value={form.perTripRate} onChange={(e) => setForm({ ...form, perTripRate: e.target.value })} /></Field>
              <Field label="Revenue share (%)"><Input type="number" min="0" max="100" value={form.revenueSharePct} onChange={(e) => setForm({ ...form, revenueSharePct: e.target.value })} /></Field>
              <Field label="Advance payment (INR)"><Input type="number" min="0" value={form.advancePayment} onChange={(e) => setForm({ ...form, advancePayment: e.target.value })} /></Field>
              <Field label="Payment frequency">
                <Select value={form.paymentFrequency} onChange={(e) => setForm({ ...form, paymentFrequency: e.target.value })}>
                  <option value="monthly">Monthly</option>
                  <option value="fortnightly">Fortnightly</option>
                  <option value="weekly">Weekly</option>
                  <option value="per_trip">Per trip</option>
                  <option value="on_demand">On demand</option>
                </Select>
              </Field>
              <Field label="Payment due day"><Input type="number" min="1" max="28" value={form.paymentDueDay} onChange={(e) => setForm({ ...form, paymentDueDay: e.target.value })} /></Field>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-[#625346] mb-2">Responsibility split</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {([
                ['maintenance', 'Maintenance'],
                ['fuel', 'Fuel'],
                ['insurance', 'Insurance'],
                ['tyres', 'Tyres'],
                ['driver', 'Driver'],
              ] as const).map(([key, label]) => (
                <Field key={key} label={label}>
                  <Select value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value as MaintenanceResponsibility })}>
                    {RESPONSIBILITY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </Select>
                </Field>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-[#625346] mb-2">Vehicles under this agreement ({selectedVehicles.length} selected)</p>
            <div className="max-h-52 overflow-y-auto border border-[#E5E5E5] rounded-lg divide-y divide-[#F0F0F0]">
              {vehicles.filter((v) => !v.decommissioned).map((v) => (
                <label key={v.id} className="flex items-center gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-[#FAF7EF]">
                  <input type="checkbox" checked={selectedVehicles.includes(v.id)} onChange={() => toggleVehicle(v.id)} />
                  <span className="font-semibold text-[#625346]">{v.registrationNumber}</span>
                  <span className="text-[#958777]">{v.make} {v.model}</span>
                  <span className="ml-auto text-[10px] text-[#958777]">{v.category}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <GhostButton onClick={() => setCreateOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void submit()} disabled={saving}>{saving ? 'Creating…' : 'Create Draft Contract'}</PrimaryButton>
          </div>
        </div>
      </EnterpriseModal>
    </ContractPage>
  )
}
