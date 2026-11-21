import React from 'react'
import type { VehicleOwnershipCategory } from '../../types/fleet'
import type {
  ContractAmendment,
  ContractPaymentStatus,
  ContractStatus,
  DepositStatus,
  ResponsibilityParty,
} from '../../types/contracts'
import { buildAmendmentComparison } from '../../utils/contractsEngine'

export function OwnershipBadge({ category }: { category?: VehicleOwnershipCategory }) {
  const cat = category ?? 'company_owned'
  const styles: Record<VehicleOwnershipCategory, { label: string; cls: string }> = {
    company_owned: {
      label: 'Company-Owned',
      cls: 'bg-[#EDF4EC] text-[#4D6E4A] border-[#C7DEC4]',
    },
    contracted_fleet: {
      label: 'Contracted Fleet',
      cls: 'bg-[#EEE8F7] text-[#6E5696] border-[#DDD3ED]',
    },
    individual_owner: {
      label: 'Individual Owner',
      cls: 'bg-[#FDF3E7] text-[#8F6510] border-[#F0D9B5]',
    },
  }
  const st = styles[cat]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-semibold border whitespace-nowrap ${st.cls}`}>
      {st.label}
    </span>
  )
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const map: Record<ContractStatus, string> = {
    draft: 'bg-[#FAFAFA] text-[#625346] border-[#E5E5E5]',
    pending_approval: 'bg-[#FDF3E7] text-[#8F6510] border-[#F0D9B5]',
    awaiting_handover: 'bg-[#EEE8F7] text-[#6E5696] border-[#DDD3ED]',
    active: 'bg-[#EDF4EC] text-[#4D6E4A] border-[#C7DEC4]',
    temporarily_suspended: 'bg-[#FCECEB] text-[#A24034] border-[#F4CBC7]',
    renewal_pending: 'bg-[#FDF3E7] text-[#8F6510] border-[#E8C65A]',
    expired: 'bg-[#FCECEB] text-[#A24034] border-[#F4CBC7]',
    termination_requested: 'bg-[#FCECEB] text-[#A24034] border-[#F4CBC7]',
    terminated: 'bg-[#FAFAFA] text-[#958777] border-[#E5E5E5]',
    vehicle_return_pending: 'bg-[#FDF3E7] text-[#8F6510] border-[#F0D9B5]',
    closed: 'bg-[#FAFAFA] text-[#958777] border-[#E5E5E5]',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-semibold border capitalize whitespace-nowrap ${map[status] ?? map.draft}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export function ContractPaymentStatusBadge({ status }: { status: ContractPaymentStatus }) {
  const map: Record<ContractPaymentStatus, string> = {
    draft: 'bg-[#FAFAFA] text-[#625346] border-[#E5E5E5]',
    pending_approval: 'bg-[#FDF3E7] text-[#8F6510] border-[#F0D9B5]',
    approved: 'bg-[#EEE8F7] text-[#6E5696] border-[#DDD3ED]',
    partially_paid: 'bg-[#FDF3E7] text-[#8F6510] border-[#E8C65A]',
    paid: 'bg-[#EDF4EC] text-[#4D6E4A] border-[#C7DEC4]',
    overdue: 'bg-[#FCECEB] text-[#A24034] border-[#F4CBC7]',
    disputed: 'bg-[#FCECEB] text-[#A24034] border-[#F4CBC7]',
    cancelled: 'bg-[#FAFAFA] text-[#958777] border-[#E5E5E5]',
    reconciled: 'bg-[#EDF4EC] text-[#4D6E4A] border-[#C7DEC4]',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-semibold border capitalize whitespace-nowrap ${map[status] ?? map.draft}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export function DepositStatusBadge({ status }: { status: DepositStatus }) {
  const map: Record<DepositStatus, string> = {
    deposit_defined: 'bg-[#FAFAFA] text-[#625346] border-[#E5E5E5]',
    payment_recorded: 'bg-[#FDF3E7] text-[#8F6510] border-[#F0D9B5]',
    payment_verified: 'bg-[#EEE8F7] text-[#6E5696] border-[#DDD3ED]',
    active: 'bg-[#EDF4EC] text-[#4D6E4A] border-[#C7DEC4]',
    contract_expiry: 'bg-[#FDF3E7] text-[#8F6510] border-[#E8C65A]',
    vehicle_inspection: 'bg-[#EEE8F7] text-[#6E5696] border-[#DDD3ED]',
    deductions: 'bg-[#FCECEB] text-[#A24034] border-[#F4CBC7]',
    refund_approval: 'bg-[#FDF3E7] text-[#8F6510] border-[#F0D9B5]',
    refund_payment: 'bg-[#EEE8F7] text-[#6E5696] border-[#DDD3ED]',
    closed: 'bg-[#FAFAFA] text-[#958777] border-[#E5E5E5]',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-semibold border capitalize whitespace-nowrap ${map[status] ?? map.deposit_defined}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export function ResponsibilityBadge({ party }: { party: ResponsibilityParty }) {
  const labels: Record<ResponsibilityParty, { label: string; cls: string }> = {
    operating_org: { label: 'Operating Org', cls: 'bg-[#EEE8F7] text-[#6E5696] border-[#DDD3ED]' },
    supplier: { label: 'Supplier / Owner', cls: 'bg-[#FDF3E7] text-[#8F6510] border-[#F0D9B5]' },
    shared: { label: 'Shared Split', cls: 'bg-[#EDF4EC] text-[#4D6E4A] border-[#C7DEC4]' },
    unspecified: { label: 'Unspecified', cls: 'bg-[#FAFAFA] text-[#958777] border-[#E5E5E5]' },
  }
  const st = labels[party] ?? labels.unspecified
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-semibold border whitespace-nowrap ${st.cls}`}>
      {st.label}
    </span>
  )
}

export function AmendmentDiffTable({ amendment }: { amendment: ContractAmendment }) {
  const rows = buildAmendmentComparison(amendment)
  return (
    <div className="border border-[#E5E5E5] rounded-[10px] overflow-hidden bg-[#FFFFFF]">
      <table className="dm-table">
        <thead>
          <tr>
            <th>Contract Clause / Field</th>
            <th>Previous Value</th>
            <th>Revised Value</th>
            <th>Change Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.field} className={r.changed ? 'bg-[#FDF3E7]/40' : ''}>
              <td className="font-semibold text-[#625346]">{r.label}</td>
              <td className="text-[#958777]">{r.previousValue}</td>
              <td className={`font-semibold ${r.changed ? 'text-[#6E5696]' : 'text-[#625346]'}`}>{r.revisedValue}</td>
              <td>
                <span
                  className={`inline-flex px-2 py-0.5 rounded-[6px] text-[11px] font-semibold border ${
                    r.changed
                      ? 'bg-[#FDF3E7] text-[#8F6510] border-[#F0D9B5]'
                      : 'bg-[#FAFAFA] text-[#958777] border-[#E5E5E5]'
                  }`}
                >
                  {r.changed ? 'Modified' : 'Unchanged'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
