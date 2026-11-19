import React from 'react'
import { AlertTriangle, CheckCircle2, Radio, Wrench } from 'lucide-react'
import type { TyrePositionRecord, Vehicle } from '../../types/fleet'
import { classifyTpmsPressurePsi } from '../../utils/workflowRules'

interface TpmsPod {
  key: string
  label: string
  positionCodes: string[]
  cx: number
  cy: number
  isTop: boolean
  isFront: boolean
}

const FOUR_WHEEL_PODS: TpmsPod[] = [
  { key: 'RL', label: 'Rear Left', positionCodes: ['RL', 'RL-OUTER', 'RL-INNER'], cx: 235, cy: 132, isTop: true, isFront: false },
  { key: 'FL', label: 'Front Left', positionCodes: ['FL'], cx: 565, cy: 132, isTop: true, isFront: true },
  { key: 'RR', label: 'Rear Right', positionCodes: ['RR', 'RR-OUTER', 'RR-INNER'], cx: 235, cy: 332, isTop: false, isFront: false },
  { key: 'FR', label: 'Front Right', positionCodes: ['FR'], cx: 565, cy: 332, isTop: false, isFront: true },
]

function resolvePodTyre(tyres: TyrePositionRecord[], pod: TpmsPod): TyrePositionRecord | undefined {
  for (const code of pod.positionCodes) {
    const found = tyres.find((t) => t.position.toUpperCase() === code)
    if (found) return found
  }
  return undefined
}

function defaultPsiForVehicle(vehicle?: Vehicle): number {
  if (!vehicle) return 96
  return vehicle.category === 'Heavy Truck' || vehicle.category === 'Medium Truck' ? 105 : 68
}

function statusColors(tyre?: TyrePositionRecord, recPsi = 96) {
  if (!tyre) {
    return {
      ring: '#CFC8BF',
      sensor: '#958777',
      arc: '#CFC8BF',
      text: '#958777',
      badge: 'No Sensor Data',
    }
  }
  const pState = classifyTpmsPressurePsi(tyre.pressurePsi, recPsi)
  if (tyre.status === 'replace_soon' || pState === 'critical_low') {
    return {
      ring: '#D9786C',
      sensor: '#D9786C',
      arc: '#D9786C',
      text: '#B84E42',
      badge: 'Critical Alert',
    }
  }
  if (tyre.status === 'wear_watch' || pState === 'low' || pState === 'overinflated') {
    return {
      ring: '#D8B442',
      sensor: '#D8B442',
      arc: '#E8C65A',
      text: '#9A7812',
      badge: 'Wear Watch',
    }
  }
  return {
    ring: '#2EB8AC',
    sensor: '#2EB8AC',
    arc: '#2EB8AC',
    text: '#4D6E4A',
    badge: 'Optimal',
  }
}

export default function TpmsSchematic({
  vehicle,
  tyres,
  selectedTyreId,
  onSelectTyre,
  onLogReading,
}: {
  vehicle?: Vehicle
  tyres: TyrePositionRecord[]
  selectedTyreId?: string
  onSelectTyre?: (tyre: TyrePositionRecord) => void
  onLogReading?: (tyre: TyrePositionRecord) => void
}) {
  const vehicleTyres = vehicle ? tyres.filter((t) => t.vehicleId === vehicle.id) : tyres
  const recPsi = defaultPsiForVehicle(vehicle)
  const extraRearDuals = vehicleTyres.filter((t) =>
    ['RL-INNER', 'RR-INNER'].includes(t.position.toUpperCase()),
  )

  const warningCount = vehicleTyres.filter((t) => {
    const pState = classifyTpmsPressurePsi(t.pressurePsi, recPsi)
    return t.status !== 'healthy' || pState !== 'nominal'
  }).length
  const criticalCount = vehicleTyres.filter((t) => {
    const pState = classifyTpmsPressurePsi(t.pressurePsi, recPsi)
    return t.status === 'replace_soon' || pState === 'critical_low'
  }).length

  const warningColor = criticalCount > 0 ? '#D9786C' : warningCount > 0 ? '#E8C65A' : '#4D6E4A'
  const selectedTyre =
    vehicleTyres.find((t) => t.id === selectedTyreId) ?? vehicleTyres[0] ?? null

  return (
    <div
      className="dm-card overflow-hidden"
      data-testid="tpms-schematic"
    >
      <div className="px-5 py-4 border-b border-[#E5E5E5] bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#625346]">
            Tire Pressure Monitoring System (TPMS) Schematic
          </h3>
          <p className="text-xs text-[#958777] mt-0.5">
            {vehicle
              ? `${vehicle.registrationNumber} · ${vehicle.make} ${vehicle.model} · Recommended ${recPsi} PSI`
              : 'Live wheel sensor telemetry, RF module reception & tread condition'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#625346] tabular-nums">
            {warningCount > 0 ? (
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: warningColor }} />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#4D6E4A]" />
            )}
            {criticalCount > 0
              ? `${criticalCount} Critical Wheel${criticalCount > 1 ? 's' : ''}`
              : warningCount > 0
                ? `${warningCount} Watch Alert${warningCount > 1 ? 's' : ''}`
                : 'All Wheel Sensors Nominal'}
          </span>
          <span className="text-[#958777]" aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 text-[#6E5696] font-semibold">
            <Radio className="w-3.5 h-3.5" />
            433 MHz RF Active
          </span>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 xl:grid-cols-12 gap-6 items-center">
        {/* Top-down Technical Chassis Blueprint matching TPMS reference layout */}
        <div className="xl:col-span-8 bg-[#FAFAFA] border border-[#E5E5E5] rounded-2xl p-4 overflow-x-auto">
          <svg
            viewBox="0 0 800 455"
            className="w-full min-w-[540px] max-w-[760px] mx-auto block select-none"
            role="img"
            aria-label={`TPMS technical schematic for ${vehicle?.registrationNumber ?? 'selected vehicle'}`}
          >
            {/* Outer chassis blueprint frame */}
            <path
              d="M 145 142 C 122 142, 114 162, 114 232 C 114 302, 122 322, 145 322 L 580 322 C 626 322, 666 300, 678 265 C 684 244, 684 220, 678 199 C 666 164, 626 142, 580 142 Z"
              fill="#FFFFFF"
              stroke="#B8B0A7"
              strokeWidth="1.6"
            />
            {/* Inner cabin & windshield wireframe lines */}
            <path
              d="M 178 158 L 495 158 L 535 178 L 535 286 L 495 306 L 178 306 Z"
              fill="none"
              stroke="#D5CFC7"
              strokeWidth="1.2"
            />
            {/* Front windshield */}
            <path
              d="M 480 164 L 544 176 C 556 205, 556 259, 544 288 L 480 300 Z"
              fill="#F7F5FA"
              stroke="#C9C0D8"
              strokeWidth="1.2"
            />
            {/* Side mirrors */}
            <path d="M 488 142 L 498 118 L 512 124 L 502 142 Z" fill="#FFFFFF" stroke="#B8B0A7" strokeWidth="1.2" />
            <path d="M 488 322 L 498 346 L 512 340 L 502 322 Z" fill="#FFFFFF" stroke="#B8B0A7" strokeWidth="1.2" />
            {/* Axles */}
            <line x1="235" y1="150" x2="235" y2="314" stroke="#E5E1DB" strokeWidth="4" strokeLinecap="round" />
            <line x1="565" y1="150" x2="565" y2="314" stroke="#E5E1DB" strokeWidth="4" strokeLinecap="round" />

            {/* Circuit trace connecting central TPMS Module to Cab TPMS Warning Light */}
            <polyline
              points="398,232 456,232 456,216 520,216"
              fill="none"
              stroke="#2EB8AC"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />

            {/* Leader line for TPMS Warning Light */}
            <polyline
              points="535,204 398,204 398,80"
              fill="none"
              stroke="#4E4237"
              strokeWidth="1.8"
            />
            <text x="398" y="42" textAnchor="middle" fill="#625346" fontSize="14" fontWeight="700">
              TPMS
            </text>
            <text x="398" y="61" textAnchor="middle" fill="#625346" fontSize="14" fontWeight="700">
              Warning Light
            </text>

            {/* Cab TPMS Warning Light Indicator Box */}
            <g transform="translate(520, 193)">
              <rect width="38" height="44" rx="6" fill="#2F2B28" stroke={warningColor} strokeWidth="2" />
              {/* Tyre warning horseshoe emblem */}
              <path
                d="M 11 16 C 8 20, 8 27, 12 31 L 26 31 C 30 27, 30 20, 27 16"
                fill="none"
                stroke={warningColor}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <line x1="19" y1="15" x2="19" y2="23" stroke={warningColor} strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="19" cy="27.5" r="1.4" fill={warningColor} />
            </g>

            {/* Central TPMS Module Receiver Box */}
            <g transform="translate(342, 212)">
              <rect width="52" height="40" rx="4" fill="#3D352E" stroke="#6E5696" strokeWidth="1.6" />
              <rect x="52" y="10" width="6" height="20" rx="1" fill="#958777" />
              <circle cx="14" cy="20" r="3" fill="#2EB8AC" />
            </g>
            <line x1="368" y1="252" x2="368" y2="395" stroke="#4E4237" strokeWidth="1.8" />
            <text x="368" y="418" textAnchor="middle" fill="#625346" fontSize="14" fontWeight="700">
              TPMS Module
            </text>
            <text x="368" y="435" textAnchor="middle" fill="#958777" fontSize="11" fontWeight="600">
              {vehicle ? `Odometer ${vehicle.odometerKm.toLocaleString()} km` : 'RF Telemetry Gateway'}
            </text>

            {/* 4 Primary Wheel Sensor Pods + RF Signal Arcs */}
            {FOUR_WHEEL_PODS.map((pod) => {
              const tyre = resolvePodTyre(vehicleTyres, pod)
              const colors = statusColors(tyre, recPsi)
              const isSelected = Boolean(tyre && selectedTyre?.id === tyre.id)
              const psi = tyre?.pressurePsi ?? recPsi
              const tread = tyre?.treadDepthMm
              const leaderStartY = pod.isTop ? pod.cy - 24 : pod.cy + 24
              const leaderEndY = pod.isTop ? 62 : 395
              const labelTitleY = pod.isTop ? 40 : 418
              const labelMetricY = pod.isTop ? 55 : 434
              const arcDirY = pod.isTop ? 1 : -1
              const arcDirX = pod.isFront ? -1 : 1
              const arcBaseX = pod.cx + arcDirX * 14
              const arcBaseY = pod.cy + arcDirY * 34

              return (
                <g
                  key={pod.key}
                  onClick={() => tyre && onSelectTyre?.(tyre)}
                  className={tyre ? 'cursor-pointer' : undefined}
                >
                  {/* Leader Line */}
                  <line
                    x1={pod.cx}
                    y1={leaderStartY}
                    x2={pod.cx}
                    y2={leaderEndY}
                    stroke={isSelected ? '#6E5696' : '#4E4237'}
                    strokeWidth={isSelected ? '2.2' : '1.6'}
                  />

                  {/* Leader Title & Live PSI / Tread Label */}
                  <text
                    x={pod.cx}
                    y={labelTitleY}
                    textAnchor="middle"
                    fill={isSelected ? '#6E5696' : '#625346'}
                    fontSize="13.5"
                    fontWeight="700"
                  >
                    {pod.key} Sensor {tyre ? `· ${psi} PSI` : ''}
                  </text>
                  <text
                    x={pod.cx}
                    y={labelMetricY}
                    textAnchor="middle"
                    fill={colors.text}
                    fontSize="11"
                    fontWeight="600"
                  >
                    {tyre
                      ? `${tread?.toFixed(1)} mm · ${tyre.temperatureC ?? 41}°C`
                      : 'Awaiting reading'}
                  </text>

                  {/* 3 Concentric RF Wireless Waves */}
                  {[12, 21, 30].map((r, idx) => (
                    <path
                      key={r}
                      d={
                        pod.isTop
                          ? pod.isFront
                            ? `M ${arcBaseX - r} ${arcBaseY} A ${r} ${r} 0 0 0 ${arcBaseX} ${arcBaseY + r}`
                            : `M ${arcBaseX} ${arcBaseY + r} A ${r} ${r} 0 0 0 ${arcBaseX + r} ${arcBaseY}`
                          : pod.isFront
                            ? `M ${arcBaseX - r} ${arcBaseY} A ${r} ${r} 0 0 1 ${arcBaseX} ${arcBaseY - r}`
                            : `M ${arcBaseX} ${arcBaseY - r} A ${r} ${r} 0 0 1 ${arcBaseX + r} ${arcBaseY}`
                      }
                      fill="none"
                      stroke={colors.arc}
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      opacity={1 - idx * 0.14}
                    />
                  ))}

                  {/* Tyre Rubber Block & Treads */}
                  <rect
                    x={pod.cx - 46}
                    y={pod.cy - 22}
                    width="92"
                    height="44"
                    rx="7"
                    fill="#3B3530"
                    stroke={isSelected ? '#6E5696' : colors.ring}
                    strokeWidth={isSelected ? '3' : '2'}
                  />
                  {/* Horizontal rubber tread ribs */}
                  <line x1={pod.cx - 42} y1={pod.cy - 10} x2={pod.cx + 42} y2={pod.cy - 10} stroke="#231F1C" strokeWidth="3" />
                  <line x1={pod.cx - 42} y1={pod.cy} x2={pod.cx + 42} y2={pod.cy} stroke="#231F1C" strokeWidth="3" />
                  <line x1={pod.cx - 42} y1={pod.cy + 10} x2={pod.cx + 42} y2={pod.cy + 10} stroke="#231F1C" strokeWidth="3" />

                  {/* Mounted TPMS Valve Sensor Capsule */}
                  <rect
                    x={pod.cx - 12}
                    y={pod.isTop ? pod.cy + 3 : pod.cy - 13}
                    width="24"
                    height="10"
                    rx="3"
                    fill={colors.sensor}
                  />
                </g>
              )
            })}
          </svg>
        </div>

        {/* Right Side: Interactive Wheel Pod Selector & Selected Tyre Diagnostic */}
        <div className="xl:col-span-4 space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-bold text-[#625346]">
              Wheel Positions ({vehicleTyres.length})
            </p>
            {vehicleTyres.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] text-xs text-[#958777]">
                No tyre serial numbers registered for this vehicle yet. Register a wheel sensor to start live tracking.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {vehicleTyres.map((t) => {
                  const active = selectedTyre?.id === t.id
                  const c = statusColors(t, recPsi)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectTyre?.(t)}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        active
                          ? 'bg-[#EEE8F7] border-[#6E5696]'
                          : 'bg-[#FFFFFF] border-[#E5E5E5] hover:bg-[#FAFAFA]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-[#625346] font-mono">{t.position}</span>
                        <span className="text-[11px] font-semibold tabular-nums" style={{ color: c.text }}>
                          {t.pressurePsi ?? recPsi} PSI
                        </span>
                      </div>
                      <p className="text-[11px] text-[#958777] tabular-nums mt-1">
                        {t.treadDepthMm.toFixed(1)} mm · {c.badge}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {selectedTyre && (
            <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-[#625346]">
                    Position {selectedTyre.position} · {selectedTyre.brand}
                  </p>
                  <p className="text-[11px] font-mono text-[#958777]">
                    SN: {selectedTyre.serialNumber}
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#6E5696]">
                  {selectedTyre.status.replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center bg-[#FFFFFF] border border-[#E5E5E5] rounded-lg p-2.5">
                <div>
                  <p className="text-[11px] text-[#958777]">Pressure</p>
                  <p className="text-sm font-bold text-[#625346] tabular-nums">
                    {selectedTyre.pressurePsi ?? recPsi} PSI
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#958777]">Tread</p>
                  <p className="text-sm font-bold text-[#625346] tabular-nums">
                    {selectedTyre.treadDepthMm.toFixed(1)} mm
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#958777]">Temp</p>
                  <p className="text-sm font-bold text-[#625346] tabular-nums">
                    {selectedTyre.temperatureC ?? 41}°C
                  </p>
                </div>
              </div>

              {extraRearDuals.length > 0 && (
                <p className="text-[11px] text-[#958777]">
                  Dual rear inner axle tyres tracked: {extraRearDuals.map((d) => `${d.position} (${d.treadDepthMm.toFixed(1)}mm)`).join(', ')}
                </p>
              )}

              {onLogReading && (
                <button
                  type="button"
                  onClick={() => onLogReading(selectedTyre)}
                  className="btn-primary w-full justify-center text-xs"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  Log Tread & TPMS Reading
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
