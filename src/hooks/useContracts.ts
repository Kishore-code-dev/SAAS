import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ContractOverview,
  ContractWorkspace,
  VehicleOwnershipRecord,
} from '../types/contracts'

export interface ContractApiState {
  data: ContractWorkspace | null
  overview: ContractOverview | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export async function contractRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`/api/contracts${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(payload?.error || `Request failed (${res.status}).`)
  return payload
}

export function useContractWorkspace(): ContractApiState {
  const [data, setData] = useState<ContractWorkspace | null>(null)
  const [overview, setOverview] = useState<ContractOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [workspace, summary] = await Promise.all([
        contractRequest<ContractWorkspace>('/workspace'),
        contractRequest<ContractOverview>('/overview'),
      ])
      setData(workspace)
      setOverview(summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load contract data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, overview, loading, error, refresh }
}

export function useVehicleOwnership(): {
  ownershipByVehicle: Map<string, VehicleOwnershipRecord>
  loading: boolean
} {
  const [ownership, setOwnership] = useState<VehicleOwnershipRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    contractRequest<{ ownership: VehicleOwnershipRecord[] }>('/vehicle-ownership')
      .then((payload) => {
        if (!cancelled) setOwnership(payload.ownership ?? [])
      })
      .catch(() => {
        if (!cancelled) setOwnership([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const ownershipByVehicle = useMemo(
    () => new Map(ownership.map((record) => [record.vehicleId, record])),
    [ownership],
  )
  return { ownershipByVehicle, loading }
}
