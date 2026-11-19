import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type {
  EmiInstalment,
  FinanceAlertEvent,
  FinanceDocCategory,
  FinanceDocumentItem,
  FinanceNotificationSettings,
  FinancePaymentMethod,
  FinancePaymentTransaction,
  FinanceWorkspacePayload,
  FinancialInstitution,
  ReconciliationStatus,
  VehicleFinanceRecord,
} from '../types/finance'
import { canPerformAction } from '../utils/rbac'
import { useAuth } from './useAuth'
import { useFleet } from './useFleet'
import type { CreateVehicleFinanceInput } from '../../server/financeDb'

export interface FinanceContextValue extends FinanceWorkspacePayload {
  loading: boolean
  error: string | null
  refreshFinance: () => Promise<void>
  saveInstitution: (input: Partial<FinancialInstitution> & { bankName: string; branch: string; reason?: string }) => Promise<FinancialInstitution>
  createFinanceRecord: (input: CreateVehicleFinanceInput) => Promise<{ record: VehicleFinanceRecord; instalments: EmiInstalment[] }>
  updateFinanceTerms: (
    financeId: string,
    input: {
      mode: 'edit' | 'restructure' | 'foreclose' | 'close' | 'cancel'
      reason: string
      confirmScheduleRevision?: boolean
      principalAmount?: number
      downPayment?: number
      interestRateAnnualPct?: number
      interestType?: VehicleFinanceRecord['interestType']
      numberOfInstalments?: number
      emiAmount?: number
      firstEmiDate?: string
      paymentMethod?: FinancePaymentMethod
      notes?: string
      settlementAmountInr?: number
      settlementDate?: string
      settlementBankRef?: string
      settlementNotes?: string
    },
  ) => Promise<VehicleFinanceRecord>
  recordEmiPayment: (
    emiId: string,
    input: {
      amountInr: number
      manualLateFeeInr?: number
      paymentDate: string
      paymentMethod: FinancePaymentMethod
      bankTransactionRef: string
      notes?: string
      receiptUpload?: { fileName: string; mimeType: string; contentBase64: string }
    },
  ) => Promise<{ payment: FinancePaymentTransaction; instalment: EmiInstalment }>
  updateEmiStatusOrFee: (
    emiId: string,
    input: { action: 'waive' | 'cancel' | 'add_late_fee'; lateFeeInr?: number; reason: string },
  ) => Promise<EmiInstalment>
  reconcilePayment: (paymentId: string, status: ReconciliationStatus, notes?: string) => Promise<FinancePaymentTransaction>
  correctPayment: (
    paymentId: string,
    input: { correctedAmountInr: number; bankTransactionRef: string; reason: string },
  ) => Promise<FinancePaymentTransaction>
  uploadFinanceDocument: (input: {
    financeId: string
    vehicleId: string
    category: FinanceDocCategory
    title: string
    expiryDate?: string
    requiresRenewal?: boolean
    parentDocId?: string
    notes?: string
    fileName: string
    mimeType: string
    contentBase64: string
  }) => Promise<FinanceDocumentItem>
  verifyFinanceDocument: (docId: string, status: 'verified' | 'rejected', notes?: string) => Promise<FinanceDocumentItem>
  updateFinanceSettings: (
    patch: Partial<Omit<FinanceNotificationSettings, 'organizationId' | 'smtpConfigured' | 'updatedAt' | 'updatedBy'>>,
    reason?: string,
  ) => Promise<FinanceNotificationSettings>
  ackFinanceAlert: (alertId: string, mode?: 'read' | 'ack' | 'read_all') => Promise<void>
  evaluateFinanceAlerts: () => Promise<FinanceAlertEvent[]>
}

const EMPTY_SETTINGS: FinanceNotificationSettings = {
  organizationId: '',
  reminderDaysBefore: [15, 7, 3, 1, 0],
  notifyAfterDueDate: true,
  overdueEscalationDays: 5,
  inAppEnabled: true,
  emailEnabled: true,
  smtpConfigured: false,
  recipientRoles: ['org_admin', 'finance'],
  recipientEmails: [],
  defaultCurrency: 'INR',
  defaultTimezone: 'Asia/Kolkata',
  defaultReportingPeriod: 'monthly',
  partialPaymentRule: 'allow_partial',
  dueSoonWindowDays: 7,
  allowManualLateFeeEntry: true,
  updatedAt: '',
  updatedBy: '',
}

const EMPTY_WORKSPACE: FinanceWorkspacePayload = {
  institutions: [],
  records: [],
  instalments: [],
  payments: [],
  documents: [],
  settings: EMPTY_SETTINGS,
  alerts: [],
  updateHistory: [],
  maskedForRole: false,
  todayIso: new Date().toISOString().slice(0, 10),
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error(payload?.error || `Request failed (${res.status})`)
  }
  return payload
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, passwordChangeRequired, user } = useAuth()
  const { activeOrganization, activeRole } = useFleet()
  const [workspace, setWorkspace] = useState<FinanceWorkspacePayload>(EMPTY_WORKSPACE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eligible =
    isAuthenticated &&
    !passwordChangeRequired &&
    Boolean(activeOrganization?.id) &&
    user?.role !== 'platform_admin' &&
    canPerformAction(activeRole, 'view_finance')

  const refreshFinance = useCallback(async () => {
    if (!eligible) {
      setWorkspace(EMPTY_WORKSPACE)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await apiJson<FinanceWorkspacePayload>('/api/finance/workspace')
      setWorkspace(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load vehicle finance workspace.')
    } finally {
      setLoading(false)
    }
  }, [eligible])

  useEffect(() => {
    let active = true
    async function loadWorkspace() {
      if (!eligible) {
        await Promise.resolve()
        if (active) setWorkspace(EMPTY_WORKSPACE)
        return
      }
      try {
        const data = await apiJson<FinanceWorkspacePayload>('/api/finance/workspace')
        if (active) {
          setWorkspace(data)
          setError(null)
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load vehicle finance workspace.')
        }
      }
    }
    void loadWorkspace()
    return () => {
      active = false
    }
  }, [eligible, activeOrganization?.id, activeRole])

  const saveInstitution: FinanceContextValue['saveInstitution'] = useCallback(
    async (input) => {
      const url = input.id ? `/api/finance/institutions/${input.id}` : '/api/finance/institutions'
      const method = input.id ? 'PATCH' : 'POST'
      const { institution } = await apiJson<{ institution: FinancialInstitution }>(url, {
        method,
        body: JSON.stringify(input),
      })
      await refreshFinance()
      return institution
    },
    [refreshFinance],
  )

  const createFinanceRecord: FinanceContextValue['createFinanceRecord'] = useCallback(
    async (input) => {
      const res = await apiJson<{ record: VehicleFinanceRecord; instalments: EmiInstalment[] }>('/api/finance/records', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      await refreshFinance()
      return res
    },
    [refreshFinance],
  )

  const updateFinanceTerms: FinanceContextValue['updateFinanceTerms'] = useCallback(
    async (financeId, input) => {
      const { record } = await apiJson<{ record: VehicleFinanceRecord }>(
        `/api/finance/records/${financeId}/update-terms`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      )
      await refreshFinance()
      return record
    },
    [refreshFinance],
  )

  const recordEmiPayment: FinanceContextValue['recordEmiPayment'] = useCallback(
    async (emiId, input) => {
      const res = await apiJson<{ payment: FinancePaymentTransaction; instalment: EmiInstalment }>(
        `/api/finance/emis/${emiId}/pay`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      )
      await refreshFinance()
      return res
    },
    [refreshFinance],
  )

  const updateEmiStatusOrFee: FinanceContextValue['updateEmiStatusOrFee'] = useCallback(
    async (emiId, input) => {
      const { instalment } = await apiJson<{ instalment: EmiInstalment }>(
        `/api/finance/emis/${emiId}/status`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      )
      await refreshFinance()
      return instalment
    },
    [refreshFinance],
  )

  const reconcilePayment: FinanceContextValue['reconcilePayment'] = useCallback(
    async (paymentId, status, notes) => {
      const { payment } = await apiJson<{ payment: FinancePaymentTransaction }>(
        `/api/finance/payments/${paymentId}/reconcile`,
        {
          method: 'POST',
          body: JSON.stringify({ status, notes }),
        },
      )
      await refreshFinance()
      return payment
    },
    [refreshFinance],
  )

  const correctPayment: FinanceContextValue['correctPayment'] = useCallback(
    async (paymentId, input) => {
      const { payment } = await apiJson<{ payment: FinancePaymentTransaction }>(
        `/api/finance/payments/${paymentId}/correct`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      )
      await refreshFinance()
      return payment
    },
    [refreshFinance],
  )

  const uploadFinanceDocument: FinanceContextValue['uploadFinanceDocument'] = useCallback(
    async (input) => {
      const { document } = await apiJson<{ document: FinanceDocumentItem }>('/api/finance/documents', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      await refreshFinance()
      return document
    },
    [refreshFinance],
  )

  const verifyFinanceDocument: FinanceContextValue['verifyFinanceDocument'] = useCallback(
    async (docId, status, notes) => {
      const { document } = await apiJson<{ document: FinanceDocumentItem }>(
        `/api/finance/documents/${docId}/verify`,
        {
          method: 'POST',
          body: JSON.stringify({ status, notes }),
        },
      )
      await refreshFinance()
      return document
    },
    [refreshFinance],
  )

  const updateFinanceSettings: FinanceContextValue['updateFinanceSettings'] = useCallback(
    async (patch, reason) => {
      const { settings } = await apiJson<{ settings: FinanceNotificationSettings }>('/api/finance/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: patch, reason }),
      })
      await refreshFinance()
      return settings
    },
    [refreshFinance],
  )

  const ackFinanceAlert: FinanceContextValue['ackFinanceAlert'] = useCallback(
    async (alertId, mode = 'ack') => {
      await apiJson('/api/finance/alerts/' + encodeURIComponent(alertId) + '/ack', {
        method: 'PATCH',
        body: JSON.stringify({ mode }),
      })
      await refreshFinance()
    },
    [refreshFinance],
  )

  const evaluateFinanceAlerts: FinanceContextValue['evaluateFinanceAlerts'] = useCallback(async () => {
    const { alerts } = await apiJson<{ alerts: FinanceAlertEvent[] }>('/api/finance/alerts/evaluate', {
      method: 'POST',
    })
    await refreshFinance()
    return alerts
  }, [refreshFinance])

  return (
    <FinanceContext.Provider
      value={{
        ...workspace,
        loading,
        error,
        refreshFinance,
        saveInstitution,
        createFinanceRecord,
        updateFinanceTerms,
        recordEmiPayment,
        updateEmiStatusOrFee,
        reconcilePayment,
        correctPayment,
        uploadFinanceDocument,
        verifyFinanceDocument,
        updateFinanceSettings,
        ackFinanceAlert,
        evaluateFinanceAlerts,
      }}
    >
      {children}
    </FinanceContext.Provider>
  )
}

export function useOptionalFinance(): FinanceContextValue | null {
  return useContext(FinanceContext)
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext)
  if (!ctx) {
    throw new Error('useFinance must be used inside FinanceProvider')
  }
  return ctx
}
