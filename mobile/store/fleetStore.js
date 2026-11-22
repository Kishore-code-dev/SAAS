import { create } from 'zustand'
import { apiClient } from '../services/api'
import {
  getPendingActions,
  markActionSynced,
  queueOfflineAction,
} from '../database/sqlite'

export const useFleetStore = create((set, get) => ({
  vehicles: [],
  drivers: [],
  trips: [],
  workOrders: [],
  fuelTransactions: [],
  contractsSummary: null,
  financeSummary: null,
  pendingSync: [],
  isLoading: false,
  error: null,

  loadFleetData: async () => {
    set({ isLoading: true, error: null })
    try {
      const [bootRes, contractsRes] = await Promise.all([
        apiClient.get('/fleet/bootstrap'),
        apiClient.get('/contracts').catch(() => ({ data: null })),
      ])
      const payload = bootRes.data?.data ?? bootRes.data ?? {}
      const pending = getPendingActions()
      set({
        vehicles: Array.isArray(payload.vehicles) ? payload.vehicles : [],
        drivers: Array.isArray(payload.drivers) ? payload.drivers : [],
        trips: Array.isArray(payload.trips) ? payload.trips : [],
        workOrders: Array.isArray(payload.workOrders) ? payload.workOrders : [],
        fuelTransactions: Array.isArray(payload.fuelTransactions) ? payload.fuelTransactions : [],
        contractsSummary: contractsRes?.data ?? null,
        pendingSync: pending,
        isLoading: false,
      })
    } catch (err) {
      const pending = getPendingActions()
      set({
        pendingSync: pending,
        isLoading: false,
        error: err.response?.data?.error ?? 'Unable to reach fleet server. Offline queue ready.',
      })
    }
  },

  submitFuelEntry: async (entry) => {
    try {
      await apiClient.post('/fleet/fuel', entry)
      await get().loadFleetData()
      return { synced: true }
    } catch {
      queueOfflineAction('/fleet/fuel', entry)
      set({ pendingSync: getPendingActions() })
      return { synced: false }
    }
  },

  queueFieldAction: (endpoint, payload) => {
    queueOfflineAction(endpoint, payload)
    set({ pendingSync: getPendingActions() })
  },

  flushOfflineQueue: async () => {
    const pending = getPendingActions()
    let syncedCount = 0
    for (const item of pending) {
      try {
        const body = JSON.parse(item.payload)
        await apiClient.post(item.endpoint, body)
        markActionSynced(item.id)
        syncedCount += 1
      } catch {
        // Keep item pending for next connectivity window
      }
    }
    set({ pendingSync: getPendingActions() })
    if (syncedCount > 0) {
      await get().loadFleetData()
    }
    return syncedCount
  },
}))
