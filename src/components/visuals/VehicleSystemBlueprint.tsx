import React, { useState } from 'react'
import { Activity, Cpu, Fuel, ShieldAlert, UserCheck, Wrench } from 'lucide-react'
import type { Vehicle, VehicleFiveAreaHealth } from '../../types/fleet'

type AreaKey = keyof VehicleFiveAreaHealth

interface AreaMeta {
  key: AreaKey
  title: string
  shortLabel: string
  x: number
  y: number
  nodeX: number
  nodeY: number
  icon: React.ComponentType<{ className?: string }>
}

const AREAS: AreaMeta[] = [
  { key: 'fuelHealth', title: 'Fuel Health', shortLabel: 'Fuel / Energy', x: 168, y: 120, nodeX: 255, nodeY: 162, icon: Fuel },
  { key: 'engineHealth', title: 'Engine Health', shortLabel: 'Powertrain', x: 525, y: 112, nodeX: 465, nodeY: 185, icon: Cpu },
  { key: 'tyreHealth', title: 'Tyre Health', shortLabel: 'Axle & Tread', x: 525, y: 270, nodeX: 460, nodeY: 245, icon: Activity },
  { key: 'driverHealth', title: 'Driver Health', shortLabel: 'Safety & KYC', x: 168, y: 270, nodeX: 315, nodeY: 205, icon: UserCheck },
  { key: 'vehicleHealth', title: 'Vehicle Health', shortLabel: 'Brakes & Chassis', x: 345, y: 54, nodeX: 365, nodeY: 160, icon: ShieldAlert },
]

function toneForStatus(status: 'healthy' | 'at-risk' | 'critical' | 'insufficient_data') {
  if (status === 'critical') return { stroke: '#D9786C', fill: '#FCEEEB', text: '#B84E42', label: 'Critical' }
  if (status === 'at-risk') return { stroke: '#D8B442', fill: '#FCF5DE', text: '#9A7812', label: 'Watch' }
  if (status === 'insufficient_data') return { stroke: '#CFC8BF', fill: '#F7F5F2', text: '#958777', label: 'No Data' }
  return { stroke: '#4D6E4A', fill: '#EDF4EC', text: '#4D6E4A', label: 'Healthy' }
}

export default function VehicleSystemBlueprint({
  vehicle,
  fiveAreaHealth,
  onCreateWorkOrder,
  onInspectTpms,
}: {
  vehicle: Vehicle
  fiveAreaHealth: VehicleFiveAreaHealth
  onCreateWorkOrder?: () => void
  onInspectTpms?: () => void
}) {
  const [selectedArea, setSelectedArea] = useState<AreaKey>('engineHealth')
  const currentArea = fiveAreaHealth[selectedArea]
  const currentMeta = AREAS.find((a) => a.key === selectedArea) ?? AREAS[0]
  const tone = toneForStatus(currentArea.status)

  return (
    <div className="dm-card overflow-hidden" data-testid="vehicle-system-blueprint">
      <div className="px-5 py-4 border-b border-[#E5E5E5] bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#625346]">
            5-Area Vehicle Digital Twin Blueprint
          </h3>
          <p className="text-xs text-[#958777] mt-0.5">
            {vehicle.registrationNumber} · {vehicle.powertrain} · Composite Health {vehicle.healthScore}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onInspectTpms && (
            <button type="button" onClick={onInspectTpms} className="btn-secondary text-xs">
              TPMS & Tyre Schematic
            </button>
          )}
          {onCreateWorkOrder && (
            <button type="button" onClick={onCreateWorkOrder} className="btn-primary text-xs">
              <Wrench className="w-3.5 h-3.5" />
              Create Work Order
            </button>
          )}
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7 bg-[#FAFAFA] border border-[#E5E5E5] rounded-2xl p-4 overflow-x-auto">
          <svg
            viewBox="0 0 680 330"
            className="w-full min-w-[460px] mx-auto block select-none"
            role="img"
            aria-label={`5-area subsystem blueprint for ${vehicle.registrationNumber}`}
          >
            {/* Side elevation truck wireframe */}
            <path
              d="M 160 220 L 160 135 L 405 135 L 405 220 Z"
              fill="#FFFFFF"
              stroke="#B8B0A7"
              strokeWidth="1.6"
            />
            <path
              d="M 412 220 L 412 145 L 482 145 L 520 182 L 520 220 Z"
              fill="#FFFFFF"
              stroke="#B8B0A7"
              strokeWidth="1.6"
            />
            <polygon
              points="442,155 480,155 508,184 442,184"
              fill="#EEE8F7"
              stroke="#C9C0D8"
              strokeWidth="1.2"
            />
            {/* Chassis rail */}
            <line x1="145" y1="224" x2="532" y2="224" stroke="#625346" strokeWidth="3.5" strokeLinecap="round" />
            {/* Wheels */}
            <g>
              <circle cx="235" cy="238" r="24" fill="#3B3530" stroke="#625346" strokeWidth="2" />
              <circle cx="235" cy="238" r="10" fill="#DDD3ED" />
              <circle cx="465" cy="238" r="24" fill="#3B3530" stroke="#625346" strokeWidth="2" />
              <circle cx="465" cy="238" r="10" fill="#DDD3ED" />
            </g>

            {/* 5 Interactive Callouts + Callout Leaders */}
            {AREAS.map((area) => {
              const metric = fiveAreaHealth[area.key]
              const c = toneForStatus(metric.status)
              const active = selectedArea === area.key
              return (
                <g
                  key={area.key}
                  onClick={() => setSelectedArea(area.key)}
                  className="cursor-pointer"
                >
                  <line
                    x1={area.x}
                    y1={area.y}
                    x2={area.nodeX}
                    y2={area.nodeY}
                    stroke={active ? '#6E5696' : c.stroke}
                    strokeWidth={active ? '2' : '1.4'}
                    strokeDasharray={active ? undefined : '4 3'}
                  />
                  <circle
                    cx={area.nodeX}
                    cy={area.nodeY}
                    r={active ? 7 : 5}
                    fill={c.stroke}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  <rect
                    x={area.x - 68}
                    y={area.y - 22}
                    width="136"
                    height="44"
                    rx="10"
                    fill={active ? '#EEE8F7' : '#FFFFFF'}
                    stroke={active ? '#6E5696' : c.stroke}
                    strokeWidth={active ? '2' : '1.3'}
                  />
                  <text
                    x={area.x}
                    y={area.y - 3}
                    textAnchor="middle"
                    fill="#625346"
                    fontSize="11.5"
                    fontWeight="700"
                  >
                    {area.title}
                  </text>
                  <text
                    x={area.x}
                    y={area.y + 13}
                    textAnchor="middle"
                    fill={c.text}
                    fontSize="11"
                    fontWeight="700"
                  >
                    {metric.status === 'insufficient_data' ? 'N/A' : `${metric.score}% · ${c.label}`}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="lg:col-span-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
            {AREAS.map((area) => {
              const Icon = area.icon
              const metric = fiveAreaHealth[area.key]
              const c = toneForStatus(metric.status)
              const active = selectedArea === area.key
              return (
                <button
                  key={area.key}
                  type="button"
                  onClick={() => setSelectedArea(area.key)}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors ${
                    active
                      ? 'bg-[#EEE8F7] border-[#6E5696]'
                      : 'bg-[#FFFFFF] border-[#E5E5E5] hover:bg-[#FAFAFA]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center text-[#6E5696] shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#625346] truncate">{area.title}</p>
                      <p className="text-[11px] text-[#958777] truncate">{area.shortLabel}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: c.text }}>
                    {metric.status === 'insufficient_data' ? 'No Data' : `${metric.score}%`}
                  </span>
                </button>
              )
            })}
          </div>

          <div
            className="p-4 rounded-xl border"
            style={{ backgroundColor: tone.fill, borderColor: tone.stroke }}
          >
            <p className="text-xs font-bold text-[#625346]">
              {currentMeta.title} Diagnostic ({tone.label})
            </p>
            <p className="text-xs text-[#625346] mt-1 leading-relaxed">
              {currentArea.detail}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
