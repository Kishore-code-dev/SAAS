import type {
  DriverAssignmentHistoryItem,
  TyrePositionRecord,
  WorkOrderStatus,
} from '../types/fleet'

export interface GeofenceZone {
  id: string
  name: string
  lat: number
  lng: number
  radiusMeters: number
  color: string
  corridor: string
}

export function deriveTyreHealthStatus(treadDepthMm: number): TyrePositionRecord['status'] {
  if (!Number.isFinite(treadDepthMm) || treadDepthMm <= 3.5) {
    return 'replace_soon'
  }
  if (treadDepthMm <= 5.5) {
    return 'wear_watch'
  }
  return 'healthy'
}

export type TpmsPressureState = 'nominal' | 'low' | 'critical_low' | 'overinflated'

export function classifyTpmsPressurePsi(
  pressurePsi: number | undefined,
  recommendedPsi = 105,
): TpmsPressureState {
  if (pressurePsi === undefined || !Number.isFinite(pressurePsi)) return 'nominal'
  if (pressurePsi < recommendedPsi * 0.8) return 'critical_low'
  if (pressurePsi < recommendedPsi * 0.9) return 'low'
  if (pressurePsi > recommendedPsi * 1.15) return 'overinflated'
  return 'nominal'
}

export function shouldIncrementWorkshopTotals(
  previousStatus: WorkOrderStatus,
  nextStatus: WorkOrderStatus,
): boolean {
  const closedStates: WorkOrderStatus[] = ['completed', 'closed']
  return !closedStates.includes(previousStatus) && closedStates.includes(nextStatus)
}

export function validateGeofenceInput(input: {
  name: string
  lat: number
  lng: number
  radiusMeters: number
}): string | null {
  if (!input.name.trim()) {
    return 'Enter a hub or geofence name.'
  }
  if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) {
    return 'Latitude must be between -90 and 90.'
  }
  if (!Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180) {
    return 'Longitude must be between -180 and 180.'
  }
  if (!Number.isFinite(input.radiusMeters) || input.radiusMeters < 100 || input.radiusMeters > 50000) {
    return 'Geofence radius must be between 100m and 50,000m.'
  }
  return null
}

export function filterVehicleCostBreakdown<T extends { vehicleId: string }>(
  rows: T[],
  vehicleFilterId: string,
): T[] {
  if (!vehicleFilterId || vehicleFilterId === 'all') return rows
  return rows.filter((row) => row.vehicleId === vehicleFilterId)
}

export function closeAndAppendAssignmentHistory(params: {
  existing: DriverAssignmentHistoryItem[]
  organizationId: string
  vehicleId: string
  vehicleRegistration: string
  driverId: string | null
  assignedBy: string
  nowIso: string
  assignmentId: string
  notes?: string
}): DriverAssignmentHistoryItem[] {
  const closed = params.existing.map((a) =>
    a.organizationId === params.organizationId &&
    !a.unassignedAt &&
    (a.vehicleId === params.vehicleId || (params.driverId && a.driverId === params.driverId))
      ? { ...a, unassignedAt: params.nowIso }
      : a,
  )
  if (!params.driverId) return closed
  return [
    {
      id: params.assignmentId,
      organizationId: params.organizationId,
      driverId: params.driverId,
      vehicleId: params.vehicleId,
      vehicleRegistration: params.vehicleRegistration,
      assignedAt: params.nowIso,
      assignedBy: params.assignedBy,
      notes: params.notes ?? 'Assigned via ERP workspace',
    },
    ...closed,
  ]
}
