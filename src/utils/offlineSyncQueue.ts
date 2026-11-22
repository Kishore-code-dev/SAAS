export type OfflineActionType = 'fuel_log' | 'dvir_check' | 'odometer_ping' | 'expense_entry'

export interface OfflineSyncItem {
  id: string
  type: OfflineActionType
  endpoint: string
  summary: string
  payload: Record<string, unknown>
  createdAt: string
  status: 'pending' | 'synced' | 'failed'
  errorMessage?: string
}

const OFFLINE_QUEUE_KEY = 'dm.offline.pending_sync'

export function createOfflineQueueItem(params: {
  id: string
  type: OfflineActionType
  endpoint: string
  summary: string
  payload: Record<string, unknown>
  createdAt: string
}): OfflineSyncItem {
  return {
    id: params.id,
    type: params.type,
    endpoint: params.endpoint,
    summary: params.summary.trim() || 'Offline fleet operation',
    payload: params.payload,
    createdAt: params.createdAt,
    status: 'pending',
  }
}

export function enqueueOfflineItem(
  queue: OfflineSyncItem[],
  item: OfflineSyncItem,
): OfflineSyncItem[] {
  const withoutDup = queue.filter((existing) => existing.id !== item.id)
  return [item, ...withoutDup]
}

export function markOfflineItemStatus(
  queue: OfflineSyncItem[],
  id: string,
  status: OfflineSyncItem['status'],
  errorMessage?: string,
): OfflineSyncItem[] {
  return queue.map((item) =>
    item.id === id
      ? {
          ...item,
          status,
          errorMessage: status === 'failed' ? errorMessage : undefined,
        }
      : item,
  )
}

export function getPendingOfflineItems(queue: OfflineSyncItem[]): OfflineSyncItem[] {
  return queue.filter((item) => item.status === 'pending' || item.status === 'failed')
}

export function pruneSyncedOfflineItems(queue: OfflineSyncItem[]): OfflineSyncItem[] {
  return queue.filter((item) => item.status !== 'synced')
}

export function loadOfflineQueue(): OfflineSyncItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as OfflineSyncItem[]) : []
  } catch {
    return []
  }
}

export function saveOfflineQueue(queue: OfflineSyncItem[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    /* ignore storage quota failures */
  }
}
