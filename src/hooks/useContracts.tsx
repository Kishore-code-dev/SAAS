import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ALL_CONTRACT_PERMISSION_KEYS, resolveEffectiveContractPermissions } from '../utils/contractsEngine'
import type { OrganizationRole } from '../types/fleet'
import type {
  ContractAlertItem,
  ContractAmendment,
  ContractBondDeposit,
  ContractDocumentItem,
  ContractHistoryEntry,
  ContractMaintenanceAllocation,
  ContractMaintenanceRule,
  ContractPayment,
  ContractPermissionKey,
  ContractPermissionRule,
  ContractStatus,
  ContractsWorkspacePayload,
  ContractVehicleLink,
  ContractVersion,
  FleetPartner,
  IndividualVehicleOwner,
  VehicleContract,
  VehicleHandoverRecord,
  VehicleOwnershipRecord,
} from '../types/contracts'
import { useAuth } from './useAuth'
import { useFleet } from './useFleet'

interface ContractsContextValue {
  loading: boolean
  partners: FleetPartner[]
  owners: IndividualVehicleOwner[]
  ownershipRecords: VehicleOwnershipRecord[]
  contracts: VehicleContract[]
  contractVehicles: ContractVehicleLink[]
  versions: ContractVersion[]
  amendments: ContractAmendment[]
  maintenanceRules: ContractMaintenanceRule[]
  maintenanceAllocations: ContractMaintenanceAllocation[]
  deposits: ContractBondDeposit[]
  deductions: ContractsWorkspacePayload['deductions']
  payments: ContractPayment[]
  handovers: VehicleHandoverRecord[]
  documents: ContractDocumentItem[]
  history: ContractHistoryEntry[]
  permissions: ContractPermissionRule[]
  alerts: ContractAlertItem[]
  effectivePermissions: Record<ContractPermissionKey, boolean>
  hasPermission: (key: ContractPermissionKey) => boolean
  refreshContracts: () => Promise<void>
  savePartner: (input: Partial<FleetPartner> & { bankAccountNumber?: string }) => Promise<FleetPartner>
  saveOwner: (
    input: Partial<IndividualVehicleOwner> & { panNumber?: string; aadhaarNumber?: string; bankAccountNumber?: string },
  ) => Promise<IndividualVehicleOwner>
  createContract: (input: Record<string, unknown>) => Promise<VehicleContract>
  changeContractStatus: (
    contractId: string,
    status: ContractStatus,
    reason?: string,
    closureExceptionNote?: string,
  ) => Promise<VehicleContract>
  createAmendment: (contractId: string, input: Record<string, unknown>) => Promise<ContractAmendment>
  reviewAmendment: (amendmentId: string, decision: 'submit' | 'approve' | 'reject', rejectionReason?: string) => Promise<void>
  renewContract: (contractId: string, input: Record<string, unknown>) => Promise<VehicleContract>
  recordPayment: (input: Record<string, unknown>) => Promise<ContractPayment>
  updatePayment: (
    paymentId: string,
    action: 'approve' | 'reconcile' | 'dispute' | 'settle_balance',
    note?: string,
    additionalPaidInr?: number,
  ) => Promise<ContractPayment>
  createDeposit: (input: Record<string, unknown>) => Promise<ContractBondDeposit>
  updateDeposit: (
    depositId: string,
    action: 'deduct' | 'topup' | 'approve_refund' | 'settle_refund',
    input: Record<string, unknown>,
  ) => Promise<ContractBondDeposit>
  saveMaintenanceRuleOrAllocation: (input: Record<string, unknown>) => Promise<void>
  updateMaintenanceAllocationStatus: (allocId: string, status: 'approved' | 'settled' | 'disputed') => Promise<void>
  createHandover: (input: Record<string, unknown>) => Promise<VehicleHandoverRecord>
  uploadContractDocument: (input: Record<string, unknown>) => Promise<ContractDocumentItem>
  verifyContractDoc: (docId: string, status: ContractDocumentItem['verificationStatus']) => Promise<void>
  savePermissions: (
    updates: Array<{ role: OrganizationRole; permissionKey: ContractPermissionKey; allowed: boolean }>,
  ) => Promise<void>
}

const ContractsContext = createContext<ContractsContextValue | null>(null)

const EMPTY_PERMS = ALL_CONTRACT_PERMISSION_KEYS.reduce(
  (acc, k) => {
    acc[k] = false
    return acc
  },
  {} as Record<ContractPermissionKey, boolean>,
)

const EMPTY_WORKSPACE: ContractsWorkspacePayload = {
  partners: [],
  owners: [],
  ownershipRecords: [],
  contracts: [],
  contractVehicles: [],
  versions: [],
  amendments: [],
  maintenanceRules: [],
  maintenanceAllocations: [],
  deposits: [],
  deductions: [],
  payments: [],
  handovers: [],
  documents: [],
  history: [],
  permissions: [],
  alerts: [],
  effectivePermissions: EMPTY_PERMS,
}

async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
  }
  return data as T
}

export function ContractsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  const { activeOrganization, activeRole } = useFleet()
  const [loading, setLoading] = useState(false)
  const [workspace, setWorkspace] = useState<ContractsWorkspacePayload>(EMPTY_WORKSPACE)

  const refreshContracts = useCallback(async () => {
    if (!isAuthenticated || !user || user.role === 'platform_admin' || !activeOrganization?.id) {
      setWorkspace(EMPTY_WORKSPACE)
      return
    }
    setLoading(true)
    try {
      const data = await apiJson<ContractsWorkspacePayload>('/api/contracts/workspace')
      setWorkspace(data)
    } catch {
      setWorkspace({
        ...EMPTY_WORKSPACE,
        effectivePermissions: resolveEffectiveContractPermissions(activeRole, []),
      })
    } finally {
      setLoading(false)
    }
  }, [activeOrganization?.id, activeRole, isAuthenticated, user])

  useEffect(() => {
    void refreshContracts()
  }, [refreshContracts])

  const hasPermission = useCallback(
    (key: ContractPermissionKey) => Boolean(workspace.effectivePermissions?.[key]),
    [workspace.effectivePermissions],
  )

  const applyWorkspace = (next?: ContractsWorkspacePayload) => {
    if (next) setWorkspace(next)
  }

  const savePartner = async (input: Partial<FleetPartner> & { bankAccountNumber?: string }) => {
    const res = await apiJson<{ partner: FleetPartner; workspace: ContractsWorkspacePayload }>('/api/contracts/partners', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    applyWorkspace(res.workspace)
    return res.partner
  }

  const saveOwner = async (
    input: Partial<IndividualVehicleOwner> & { panNumber?: string; aadhaarNumber?: string; bankAccountNumber?: string },
  ) => {
    const res = await apiJson<{ owner: IndividualVehicleOwner; workspace: ContractsWorkspacePayload }>('/api/contracts/owners', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    applyWorkspace(res.workspace)
    return res.owner
  }

  const createContract = async (input: Record<string, unknown>) => {
    const res = await apiJson<{ contract: VehicleContract; workspace: ContractsWorkspacePayload }>('/api/contracts', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    applyWorkspace(res.workspace)
    return res.contract
  }

  const changeContractStatus = async (
    contractId: string,
    status: ContractStatus,
    reason?: string,
    closureExceptionNote?: string,
  ) => {
    const res = await apiJson<{ contract: VehicleContract; workspace: ContractsWorkspacePayload }>(
      `/api/contracts/${contractId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, reason, closureExceptionNote }),
      },
    )
    applyWorkspace(res.workspace)
    return res.contract
  }

  const createAmendment = async (contractId: string, input: Record<string, unknown>) => {
    const res = await apiJson<{ amendment: ContractAmendment; workspace: ContractsWorkspacePayload }>(
      `/api/contracts/${contractId}/amendments`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    )
    applyWorkspace(res.workspace)
    return res.amendment
  }

  const reviewAmendment = async (
    amendmentId: string,
    decision: 'submit' | 'approve' | 'reject',
    rejectionReason?: string,
  ) => {
    const res = await apiJson<{ workspace: ContractsWorkspacePayload }>(
      `/api/contracts/amendments/${amendmentId}/review`,
      {
        method: 'POST',
        body: JSON.stringify({ decision, rejectionReason }),
      },
    )
    applyWorkspace(res.workspace)
  }

  const renewContract = async (contractId: string, input: Record<string, unknown>) => {
    const res = await apiJson<{ contract: VehicleContract; workspace: ContractsWorkspacePayload }>(
      `/api/contracts/${contractId}/renew`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    )
    applyWorkspace(res.workspace)
    return res.contract
  }

  const recordPayment = async (input: Record<string, unknown>) => {
    const res = await apiJson<{ payment: ContractPayment; workspace: ContractsWorkspacePayload }>('/api/contracts/payments', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    applyWorkspace(res.workspace)
    return res.payment
  }

  const updatePayment = async (
    paymentId: string,
    action: 'approve' | 'reconcile' | 'dispute' | 'settle_balance',
    note?: string,
    additionalPaidInr?: number,
  ) => {
    const res = await apiJson<{ payment: ContractPayment; workspace: ContractsWorkspacePayload }>(
      `/api/contracts/payments/${paymentId}/action`,
      {
        method: 'POST',
        body: JSON.stringify({ action, note, additionalPaidInr }),
      },
    )
    applyWorkspace(res.workspace)
    return res.payment
  }

  const createDeposit = async (input: Record<string, unknown>) => {
    const res = await apiJson<{ deposit: ContractBondDeposit; workspace: ContractsWorkspacePayload }>('/api/contracts/deposits', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    applyWorkspace(res.workspace)
    return res.deposit
  }

  const updateDeposit = async (
    depositId: string,
    action: 'deduct' | 'topup' | 'approve_refund' | 'settle_refund',
    input: Record<string, unknown>,
  ) => {
    const res = await apiJson<{ deposit: ContractBondDeposit; workspace: ContractsWorkspacePayload }>(
      `/api/contracts/deposits/${depositId}/action`,
      {
        method: 'POST',
        body: JSON.stringify({ action, ...input }),
      },
    )
    applyWorkspace(res.workspace)
    return res.deposit
  }

  const saveMaintenanceRuleOrAllocation = async (input: Record<string, unknown>) => {
    const res = await apiJson<{ workspace: ContractsWorkspacePayload }>('/api/contracts/maintenance', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    applyWorkspace(res.workspace)
  }

  const updateMaintenanceAllocationStatus = async (allocId: string, status: 'approved' | 'settled' | 'disputed') => {
    const res = await apiJson<{ workspace: ContractsWorkspacePayload }>(`/api/contracts/maintenance/${allocId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    })
    applyWorkspace(res.workspace)
  }

  const createHandover = async (input: Record<string, unknown>) => {
    const res = await apiJson<{ handover: VehicleHandoverRecord; workspace: ContractsWorkspacePayload }>('/api/contracts/handovers', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    applyWorkspace(res.workspace)
    return res.handover
  }

  const uploadContractDocument = async (input: Record<string, unknown>) => {
    const res = await apiJson<{ document: ContractDocumentItem; workspace: ContractsWorkspacePayload }>('/api/contracts/documents', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    applyWorkspace(res.workspace)
    return res.document
  }

  const verifyContractDoc = async (docId: string, status: ContractDocumentItem['verificationStatus']) => {
    const res = await apiJson<{ workspace: ContractsWorkspacePayload }>(`/api/contracts/documents/${docId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    })
    applyWorkspace(res.workspace)
  }

  const savePermissions = async (
    updates: Array<{ role: OrganizationRole; permissionKey: ContractPermissionKey; allowed: boolean }>,
  ) => {
    const res = await apiJson<{ workspace: ContractsWorkspacePayload }>('/api/contracts/permissions', {
      method: 'PUT',
      body: JSON.stringify({ updates }),
    })
    applyWorkspace(res.workspace)
  }

  return (
    <ContractsContext.Provider
      value={{
        loading,
        ...workspace,
        hasPermission,
        refreshContracts,
        savePartner,
        saveOwner,
        createContract,
        changeContractStatus,
        createAmendment,
        reviewAmendment,
        renewContract,
        recordPayment,
        updatePayment,
        createDeposit,
        updateDeposit,
        saveMaintenanceRuleOrAllocation,
        updateMaintenanceAllocationStatus,
        createHandover,
        uploadContractDocument,
        verifyContractDoc,
        savePermissions,
      }}
    >
      {children}
    </ContractsContext.Provider>
  )
}

export function useContracts() {
  const ctx = useContext(ContractsContext)
  if (!ctx) throw new Error('useContracts must be used inside ContractsProvider')
  return ctx
}

export function useOptionalContracts() {
  return useContext(ContractsContext)
}
