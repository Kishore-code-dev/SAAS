import React from 'react'
import { Compass, Thermometer } from 'lucide-react'
import { useFleet } from '../hooks/useFleet'
import { SeverityText } from '../components/ui/EnterprisePrimitives'

export default function RoadIntelligence() {
  const { activeOrganization, corridors, vehicles, predictions } = useFleet()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="dm-page-title">Corridor Stress & Climate Intelligence</h1>
        <p className="text-sm text-[#7D6D5F] mt-1">
          {activeOrganization.name} · Regional road stress and thermal multipliers applied in predictive wear models
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {corridors.map((cor) => {
          const activeOnCorridor = vehicles.filter((v) => v.corridorId === cor.id)
          const elevatedRisks = predictions.filter(
            (p) =>
              !p.insufficientData &&
              p.status !== 'resolved' &&
              (p.priority === 'critical' || p.priority === 'high') &&
              activeOnCorridor.some((v) => v.id === p.vehicleId),
          )
          const sev = cor.roadStressIndex >= 0.7 ? 'critical' : cor.roadStressIndex >= 0.6 ? 'high' : 'normal'
          return (
            <div key={cor.id} className="enterprise-card p-5 space-y-3 hover:bg-[#FBF6E6] transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="dm-card-title">{cor.name}</h2>
                  <p className="text-xs text-[#7D6D5F]">{cor.region}</p>
                </div>
                <SeverityText severity={sev} label={cor.potholeDensity} />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E0D4B7] text-xs">
                <div>
                  <span className="text-[#7D6D5F] block">Road Stress Index</span>
                  <span className="text-base font-bold text-[#625346] tabular-nums">
                    {cor.roadStressIndex.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[#7D6D5F] block">Ambient Temp</span>
                  <span className="text-base font-bold text-[#625346] tabular-nums inline-flex items-center gap-1">
                    <Thermometer className="w-3.5 h-3.5 text-[#8F6D15]" />
                    {cor.avgAmbientTempC}°C
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E0D4B7] flex items-center justify-between text-xs text-[#7D6D5F]">
                <span className="inline-flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-[#6E5696]" />
                  {activeOnCorridor.length} vehicle(s)
                </span>
                <span className="font-semibold text-[#625346] tabular-nums">
                  {elevatedRisks.length} high/crit alerts
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

