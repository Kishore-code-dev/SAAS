import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArchiveRestore, ArrowRight, Layers, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useFleet } from '../hooks/useFleet'
import { classifyTelemetryFreshness } from '../utils/intelligenceEngine'
import { canPerformAction } from '../utils/rbac'
import { EmptySectionState, SeverityText } from '../components/ui/EnterprisePrimitives'
import AddVehicleDialog from '../components/vehicles/AddVehicleDialog'
import PageHeader from '../components/layout/PageHeader'

const PAGE_SIZE = 10

export default function Vehicles() {
  const navigate = useNavigate()
  const {
    activeOrganization,
    activeRole,
    vehicles,
    archivedVehicles,
    drivers,
    predictions,
    searchTerm,
    setSearchTerm,
    restoreVehicle,
    nowTick,
  } = useFleet()

  const [lifecycleTab, setLifecycleTab] = useState<'active' | 'archived'>('active')
  const [powertrainFilter, setPowertrainFilter] = useState<'all' | 'ICE' | 'EV'>('all')
  const [healthFilter, setHealthFilter] = useState<'all' | 'healthy' | 'at-risk' | 'critical'>('all')
  const [sortBy, setSortBy] = useState<'health_asc' | 'odometer_desc' | 'reg_asc'>('health_asc')
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)

  const canAdd = canPerformAction(activeRole, 'add_vehicle')
  const canRestore = canPerformAction(activeRole, 'restore_vehicle')

  const baseList = lifecycleTab === 'active' ? vehicles : archivedVehicles

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    const matched = baseList.filter((v) => {
      const hState = v.healthScore <= 49 ? 'critical' : v.healthScore <= 74 ? 'at-risk' : 'healthy'
      const matchesHealth = healthFilter === 'all' || hState === healthFilter
      const matchesPowertrain = powertrainFilter === 'all' || v.powertrain === powertrainFilter
      const driver = drivers.find((d) => d.id === v.assignedDriverId)
      const matchesQ =
        !q ||
        v.registrationNumber.toLowerCase().includes(q) ||
        v.make.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.cityName.toLowerCase().includes(q) ||
        (driver?.name.toLowerCase().includes(q) ?? false)
      return matchesHealth && matchesPowertrain && matchesQ
    })

    return matched.sort((a, b) => {
      if (sortBy === 'odometer_desc') return b.odometerKm - a.odometerKm
      if (sortBy === 'reg_asc') return a.registrationNumber.localeCompare(b.registrationNumber)
      return a.healthScore - b.healthScore
    })
  }, [baseList, drivers, healthFilter, powertrainFilter, searchTerm, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedVehicles = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleRestore = (vehicleId: string, reg: string) => {
    try {
      restoreVehicle(vehicleId)
      toast.success(`Restored ${reg} to active fleet`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to restore vehicle.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Fleet & Vehicle Digital Twins" subtitle={<>{activeOrganization.name} · {vehicles.length} active, {archivedVehicles.length} archived (Plan limit {activeOrganization.vehicleLimit})</>}>
        {canAdd && (
          <button type="button" onClick={() => setAddOpen(true)} className="btn-accent">
            <Plus className="w-4 h-4" />
            Register Vehicle
          </button>
        )}
      </PageHeader>

      {/* Filters & Sorting */}
      <div className="enterprise-card p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-[#EEE8F7] p-1 rounded-[10px] border border-[#DDD3ED]">
            {(['active', 'archived'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setLifecycleTab(tab)
                  setPage(1)
                }}
                className={`px-3 py-1 rounded-[8px] text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                  lifecycleTab === tab ? 'bg-[#FFFFFF] text-[#625346] shadow-subtle border border-[#DDD3ED]' : 'text-[#958777] hover:text-[#625346]'
                }`}
              >
                {tab === 'active' ? `Active (${vehicles.length})` : `Archived (${archivedVehicles.length})`}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-[#EEE8F7] p-1 rounded-[10px] border border-[#DDD3ED]">
            {(['all', 'healthy', 'at-risk', 'critical'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setHealthFilter(st)
                  setPage(1)
                }}
                className={`px-3 py-1 rounded-[8px] text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                  healthFilter === st ? 'bg-[#FFFFFF] text-[#625346] shadow-subtle border border-[#DDD3ED]' : 'text-[#958777] hover:text-[#625346]'
                }`}
              >
                {st.replace('-', ' ')}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-[#EEE8F7] p-1 rounded-[10px] border border-[#DDD3ED]">
            {(['all', 'ICE', 'EV'] as const).map((pt) => (
              <button
                key={pt}
                type="button"
                onClick={() => {
                  setPowertrainFilter(pt)
                  setPage(1)
                }}
                className={`px-3 py-1 rounded-[8px] text-xs font-semibold transition-colors whitespace-nowrap ${
                  powertrainFilter === pt ? 'bg-[#FFFFFF] text-[#625346] shadow-subtle border border-[#DDD3ED]' : 'text-[#958777] hover:text-[#625346]'
                }`}
              >
                {pt === 'all' ? 'All Powertrains' : pt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <label htmlFor="fleet-sort" className="sr-only">Sort fleet</label>
          <select
            id="fleet-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="dm-input py-1.5 text-xs w-40"
          >
            <option value="health_asc">Lowest Health First</option>
            <option value="odometer_desc">Highest Odometer</option>
            <option value="reg_asc">Registration (A–Z)</option>
          </select>

          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-[#958777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              placeholder="Search registration, model, city..."
              aria-label="Search vehicles"
              className="dm-input pl-9 py-1.5 text-xs"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptySectionState
          title={lifecycleTab === 'archived' ? 'No archived vehicles' : 'No matching vehicles found'}
          description={
            lifecycleTab === 'archived'
              ? 'Decommissioned vehicles appear here while preserving all historical trip, fuel, and maintenance records.'
              : 'Adjust your filters or register a new commercial vehicle in this organization.'
          }
          actionLabel={lifecycleTab === 'active' && canAdd ? 'Register Vehicle' : undefined}
          onAction={lifecycleTab === 'active' && canAdd ? () => setAddOpen(true) : undefined}
        />
      ) : (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Registration & Model</th>
                  <th>Powertrain</th>
                  <th>Assigned Driver</th>
                  <th>Odometer</th>
                  <th>Health Score</th>
                  <th>Telemetry</th>
                  <th>Open Alerts</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedVehicles.map((v) => {
                  const driver = drivers.find((d) => d.id === v.assignedDriverId)
                  const freshness = classifyTelemetryFreshness(v.telemetry.lastUpdatedAt, v.telemetry.connectionState, nowTick)
                  const openPreds = predictions.filter((p) => !p.insufficientData && p.vehicleId === v.id && p.status !== 'resolved')
                  const healthState = v.healthScore <= 49 ? 'critical' : v.healthScore <= 74 ? 'at-risk' : 'healthy'
                  return (
                    <tr key={v.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-[8px] bg-[#EEE8F7] border border-[#DDD3ED] text-[#6E5696] flex items-center justify-center shrink-0">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => navigate(`/dashboard/fleet/${v.id}`)}
                              className="font-bold text-[#625346] hover:text-[#6E5696] hover:underline block text-left tabular-nums"
                            >
                              {v.registrationNumber}
                            </button>
                            <span className="text-xs text-[#958777]">
                              {v.make} {v.model} ({v.year}) · {v.cityName}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs font-semibold text-[#625346]">{v.powertrain}</span>
                        <span className="text-xs text-[#958777] block">{v.fuelType}</span>
                      </td>
                      <td className="text-[#625346]">{driver?.name ?? 'Unassigned'}</td>
                      <td className="tabular-nums text-[#625346] whitespace-nowrap">
                        {v.odometerKm.toLocaleString('en-IN')} km
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold tabular-nums text-[#625346]">{v.healthScore}%</span>
                          <SeverityText severity={healthState} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        <SeverityText severity={freshness.freshness} label={freshness.label} />
                      </td>
                      <td className="tabular-nums text-[#625346] whitespace-nowrap">
                        {openPreds.filter((p) => p.priority === 'critical' || p.priority === 'high').length} high/crit
                      </td>
                      <td className="text-right space-x-2">
                        {v.decommissioned && canRestore ? (
                          <button
                            type="button"
                            onClick={() => handleRestore(v.id, v.registrationNumber)}
                            className="btn-accent text-xs px-3 py-1.5"
                          >
                            <ArchiveRestore className="w-3.5 h-3.5" />
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate(`/dashboard/fleet/${v.id}`)}
                            className="btn-secondary text-xs px-3 py-1.5"
                          >
                            Inspect
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 bg-[#FFFFFF] border-t border-[#E5E5E5] flex items-center justify-between text-xs text-[#958777]">
              <span>
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="btn-secondary px-2.5 py-1 text-xs disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="font-semibold text-[#625346] tabular-nums">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="btn-secondary px-2.5 py-1 text-xs disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <AddVehicleDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
