import React, { useMemo, useState } from 'react'
import { FilePlus2, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { contractRequest, useContractWorkspace } from '../../hooks/useContracts'
import { canPerformContractAction } from '../../utils/rbac'
import { useFleet } from '../../hooks/useFleet'
import { EnterpriseModal } from '../../components/ui/EnterprisePrimitives'
import {
  ContractPage,
  DataTable,
  ErrorBlock,
  Field,
  FilterSelect,
  GhostButton,
  Input,
  LoadingBlock,
  PrimaryButton,
  Select,
  Toolbar,
  dateTime,
} from './ContractUi'

const DOC_CATEGORIES = ['Agreement', 'Amendment', 'Vehicle documents', 'Insurance', 'Permit', 'Deposit receipt', 'Handover checklist', 'Other']

export default function ContractDocumentsPage() {
  const { data, loading, error, refresh } = useContractWorkspace()
  const { activeRole } = useFleet()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [contractFilter, setContractFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ contractId: '', name: '', category: 'Agreement', reference: '' })
  const [saving, setSaving] = useState(false)

  const canManage = canPerformContractAction(activeRole, 'manage_contract_documents')
  const documents = data?.documents ?? []
  const contracts = data?.contracts ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return documents.filter((d) => {
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false
      if (contractFilter !== 'all' && d.contractId !== contractFilter) return false
      if (!q) return true
      return `${d.name} ${d.category} ${d.reference} ${d.uploadedBy}`.toLowerCase().includes(q)
    })
  }, [documents, search, categoryFilter, contractFilter])

  const add = async () => {
    if (!form.contractId || !form.name.trim()) { toast.error('Select a contract and enter a document name.'); return }
    setSaving(true)
    try {
      await contractRequest(`/${encodeURIComponent(form.contractId)}/documents`, {
        method: 'POST',
        body: JSON.stringify({ name: form.name, category: form.category, reference: form.reference }),
      })
      toast.success('Document reference added to the contract file.')
      setModalOpen(false)
      setForm({ contractId: contracts[0]?.id ?? '', name: '', category: 'Agreement', reference: '' })
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to add document.')
    } finally {
      setSaving(false)
    }
  }

  const categoryOptions = Array.from(new Set(documents.map((d) => d.category).filter(Boolean))).map((c) => ({ value: c, label: c }))

  return (
    <ContractPage
      title="Contract Documents"
      subtitle="Agreement, amendment, vehicle and deposit documents linked to contracts. References are metadata only; no invented files."
      actions={canManage ? <PrimaryButton onClick={() => { setForm({ ...form, contractId: contracts[0]?.id ?? '' }); setModalOpen(true) }}><FilePlus2 className="w-3.5 h-3.5" /> Add Document</PrimaryButton> : undefined}
    >
      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search document name, reference, category or uploader"
        filters={
          <>
            <FilterSelect label="categories" value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} />
            <FilterSelect label="contracts" value={contractFilter} onChange={setContractFilter} options={contracts.map((c) => ({ value: c.id, label: `${c.contractNumber} · ${c.supplierName}` }))} />
          </>
        }
      />

      {loading && <LoadingBlock />}
      {!loading && error && <ErrorBlock message={error} onRetry={() => void refresh()} />}
      {!loading && !error && (
        <DataTable
          rows={filtered}
          rowKey={(d) => d.id}
          emptyTitle="No contract documents"
          emptyDescription="Add agreement, insurance, permit and deposit document references to the relevant contract."
          columns={[
            {
              key: 'name',
              label: 'Document',
              render: (d) => (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-[#EEE8F7] text-[#5B4579] flex items-center justify-center"><FolderOpen className="w-3.5 h-3.5" /></div>
                  <div>
                    <p className="text-xs font-bold text-[#625346]">{d.name}</p>
                    <p className="text-[10px] text-[#958777]">{d.reference || 'No reference'}</p>
                  </div>
                </div>
              ),
            },
            { key: 'category', label: 'Category', render: (d) => <span className="text-[11px] text-[#958777]">{d.category || '—'}</span> },
            {
              key: 'contract',
              label: 'Contract',
              render: (d) => {
                const contract = contracts.find((c) => c.id === d.contractId)
                return contract
                  ? <a href={`/dashboard/contracts/${contract.id}`} className="text-xs font-semibold text-[#6E5696]">{contract.contractNumber}</a>
                  : <span className="text-[11px] text-[#958777]">—</span>
              },
            },
            { key: 'uploader', label: 'Added By', render: (d) => <span className="text-[11px]">{d.uploadedBy}</span> },
            { key: 'created', label: 'Added', render: (d) => <span className="text-[10px] text-[#958777]">{dateTime(d.createdAt)}</span> },
          ]}
        />
      )}

      <EnterpriseModal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Contract Document Reference" subtitle="The contract file records document metadata and reference numbers.">
        <div className="space-y-3">
          <Field label="Contract">
            <Select value={form.contractId} onChange={(e) => setForm({ ...form, contractId: e.target.value })}>
              <option value="">Select contract…</option>
              {contracts.map((c) => <option key={c.id} value={c.id}>{c.contractNumber} · {c.supplierName}</option>)}
            </Select>
          </Field>
          <Field label="Document name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Signed lease agreement" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Reference"><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <GhostButton onClick={() => setModalOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void add()} disabled={saving}>{saving ? 'Saving…' : 'Add Document'}</PrimaryButton>
          </div>
        </div>
      </EnterpriseModal>
    </ContractPage>
  )
}
