import React from 'react'
import { TileLayer } from 'react-leaflet'

export type MapBaseStyle = 'hybrid' | 'satellite' | 'street'

export function SatelliteTileLayers({ style = 'hybrid' }: { style?: MapBaseStyle }) {
  if (style === 'street') {
    return (
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
    )
  }

  return (
    <>
      <TileLayer
        attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      {style === 'hybrid' && (
        <>
          <TileLayer
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            opacity={0.78}
          />
          <TileLayer
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        </>
      )}
    </>
  )
}

const STYLE_OPTIONS: Array<{ id: MapBaseStyle; label: string }> = [
  { id: 'hybrid', label: 'Satellite + Roads' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'street', label: 'Street' },
]

export function MapStyleToggle({
  value,
  onChange,
  compact = false,
}: {
  value: MapBaseStyle
  onChange: (next: MapBaseStyle) => void
  compact?: boolean
}) {
  return (
    <div
      role="group"
      aria-label="Map layer style"
      className="inline-flex items-center gap-0.5 bg-[#FFFFFF]/95 backdrop-blur border border-[#E5E5E5] rounded-[9px] p-0.5 shadow-subtle"
    >
      {STYLE_OPTIONS.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={`${
              compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs'
            } rounded-[7px] font-semibold transition-colors whitespace-nowrap ${
              active
                ? 'bg-[#E8C65A] text-[#625346]'
                : 'text-[#958777] hover:text-[#625346] hover:bg-[#EEE8F7]/70'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
