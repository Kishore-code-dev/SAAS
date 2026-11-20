import React, { useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { useContractWorkspace } from '../../hooks/useContracts'
import {
  ContractPage,
  DataTable,
  ErrorBlock,
  FilterSelect,
  LoadingBlock,
  Toolbar,
  dateTime,
} from './ContractUi'

const ACTION_LABEL: Record<string, string> = {
  CONTRACT_CREATED: 'Contract created',
  STATUS_CHANGED: 'Status changed',
  AMENDMENT_CREATED: 'Amendment created',
  AMENDMENT_SUBMITTED: 'Amendment submitted',
  AMENDMENT_APPROVED: 'Amendment approved',
  AMENDMENT_REJECTED: 'Amendment rejected',
  DEPOSIT_DEFINED: 'Deposit defined',
  DEPOSIT_PAYMENT: 'Deposit payment',
  DEPOSIT_DEDUCTION: 'Deposit deduction',
  DEPOSIT_REFUND_APPROVED: 'Deposit refund approved',
  PAYMENT_CREATED: 'Payment created',
  PAYMENT_RECORDED: 'Payment recorded',
  PAYMENT_STATUS: 'Payment status changed',
  MAINTENANCE_ALLOCATED: 'Maintenance allocated',
  MAINTENANCE_APPROVED: 'Maintenance approved',
  MAINTENANCE_REJECTED: 'Maintenance rejected',
  MAINTENANCE_SETTLED: 'Maintenance settled',
  VEHICLE_HANDOVER: 'Vehicle handover',
  VEHICLE_RETURNED: 'Vehicle returned',
  DOCUMENT_ADDED: 'Document added',
  PARTNER_CREATED: 'Fleet partner created',
  PARTNER_UPDATED: 'Fleet partner updated',
  INDIVIDUAL_OWNER_CREATED: 'Individual owner created',
  INDIVIDUAL_OWNER_UPDATED: 'Individual owner updated',
}

export default function ContractHistoryPage() {
  const { data, loading, error, refresh } = useContractWorkspace()
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [contractFilter, setContractFilter] = useState('all')
  const [actorFilter, setActorFilter] = useState('all')

  const activity = data?.activity ?? []
  const contracts = data?.contracts ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return activity.filter((a) => {
      if (actionFilter !== 'all' && a.action !== actionFilter) return false
      if (contractFilter !== 'all' && a.contractId !== contractFilter) return false
      if (actorFilter !== 'all' && a.actor !== actorFilter) return false
      if (!q) return true
      return `${a.summary} ${a.action} ${a.actor}`.toLowerCase().includes(q)
    })
  }, [activity, search, actionFilter, contractFilter, actorFilter])

  const actions = Array.from(new Set(activity.map((a) => a.action)))
  const actors = Array.from(new Set(activity.map((a) => a.actor)))

  return (
    <ContractPage
      title="Contract History"
      subtitle="Append-only audit trail of contract, amendment, deposit, payment, maintenance and handover events. Entries are never edited in place."
    >
      <div className="enterprise-card p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#EEE8F7] text-[#5B4579] flex items-center justify-center"><History className="w-4 h-4" /></div>
        <div>
          <p className="text-xs font-bold text-[#625346]">{activity.length} recorded events</p>
          <p className="text-[10px] text-[#958777]">Newest first. Each event stores actor, action, summary and UTC timestamp.</p>
        </div>
      </div>

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search summary, action or actor"
        filters={
          <>
            <FilterSelect label="actions" value={actionFilter} onChange={setActionFilter} options={actions.map((a) => ({ value: a, label: ACTION_LABEL[a] ?? a }))} />
            <FilterSelect label="contracts" value={contractFilter} onChange={setContractFilter} options={contracts.map((c) => ({ value: c.id, label: c.contractNumber }))} />
            <FilterSelect label="actors" value={actorFilter} onChange={setActorFilter} options={actors.map((a) => ({ value: a, label: a }))} />
          </>
        }
      />

      {loading && <LoadingBlock label="Loading contract audit trail…" />}
      {!loading && error && <ErrorBlock message={error} onRetry={() => void refresh()} />}
      {!loading && !error && (
        <DataTable
          rows={filtered}
          rowKey={(a) => a.id}
          pageSize={20}
          emptyTitle="No history entries match these filters"
          emptyDescription="Contract actions appear here as soon as they are recorded."
          columns={[
            {
              key: 'event',
              label: 'Event',
              render: (a) => (
                <div>
                  <p className="text-xs font-bold text-[#625346]">{ACTION_LABEL[a.action] ?? a.action.replace(/_/g, ' ')}</p>
                  <p className="text-[11px] text-[#958777] max-w-[420px]">{a.summary}</p>
                </div>
              ),
            },
            {
              key: 'contract',
              label: 'Contract',
              render: (a) => {
                const contract = contracts.find((c) => c.id === a.contractId)
                return contract
                  ? <a href={`/dashboard/contracts/${contract.id}`} className="text-xs font-semibold text-[#6E5696]">{contract.contractNumber}</a>
                  : <span className="text-[11px] text-[#958777]">Directory</span>
              },
            },
            { key: 'actor', label: 'Actor', render: (a) => <span className="text-[11px]">{a.actor}</span> },
            { key: 'time', label: 'Timestamp (UTC)', render: (a) => <span className="text-[10px] text-[#958777] tabular-nums">{dateTime(a.createdAt)}</span> },
          ]}
        />
      )}
    </ContractPage>
  )
}
