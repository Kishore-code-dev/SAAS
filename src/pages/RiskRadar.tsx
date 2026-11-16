import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldAlert } from 'lucide-react'
import { useFleet } from '../hooks/useFleet'
import { EmptySectionState, formatDateTime, SeverityText } from '../components/ui/EnterprisePrimitives'
import type { RiskCategory, RiskSeverity } from '../types/fleet'

export default function RiskRadar() {
  const navigate = useNavigate()
  const { activeOrganization, riskAssessments } = useFleet()

  const [severityFilter, setSeverityFilter] = useState<'all' | RiskSeverity>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | RiskCategory>('all')
  const [sortBy, setSortBy] = useState<'severity' | 'confidence' | 'recent'>('severity')

  const counts = useMemo(() => {
    return {
      critical: riskAssessments.filter((r) => r.severity === 'critical').length,
      high: riskAssessments.filter((r) => r.severity === 'high').length,
      moderate: riskAssessments.filter((r) => r.severity === 'moderate').length,
      normal: riskAssessments.filter((r) => r.severity === 'normal').length,
    }
  }, [riskAssessments])

  const filtered = useMemo(() => {
    const list = riskAssessments.filter((item) => {
      const mSev = severityFilter === 'all' || item.severity === severityFilter
      const mCat = categoryFilter === 'all' || item.category === categoryFilter
      return mSev && mCat
    })
    const sevOrder: Record<RiskSeverity, number> = { critical: 0, high: 1, moderate: 2, normal: 3 }
    return [...list].sort((a, b) => {
      if (sortBy === 'confidence') return b.confidencePct - a.confidencePct
      if (sortBy === 'recent') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      return sevOrder[a.severity] - sevOrder[b.severity]
    })
  }, [riskAssessments, severityFilter, categoryFilter, sortBy])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dm-page-title">Fleet Risk Radar</h1>
          <p className="text-sm text-[#7D6D5F] mt-1">
            {activeOrganization.name} · Unified cross-system risk prioritization with insufficient-data safeguards
          </p>
        </div>
      </div>

      {/* 4 Severity Buckets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { key: 'critical', label: 'Critical', count: counts.critical, dot: 'bg-[#D9786C]' },
          { key: 'high', label: 'High', count: counts.high, dot: 'bg-[#E8C65A]' },
          { key: 'moderate', label: 'Moderate', count: counts.moderate, dot: 'bg-[#B8A3D9]' },
          { key: 'normal', label: 'Normal', count: counts.normal, dot: 'bg-[#789A75]' },
        ] as const).map((bucket) => (
          <button
            key={bucket.key}
            type="button"
            onClick={() => setSeverityFilter(severityFilter === bucket.key ? 'all' : bucket.key)}
            className={`enterprise-card p-4 text-left transition-colors ${
              severityFilter === bucket.key ? 'border-[#B8A3D9] bg-[#EEE8F7]' : 'hover:bg-[#FBF6E6]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#7D6D5F]">{bucket.label} Risk</span>
              <ShieldAlert className="w-4 h-4 text-[#6E5696]" />
            </div>
            <p className="dm-kpi-value mt-2 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${bucket.dot}`} />
              {bucket.count}
            </p>
          </button>
        ))}
      </div>

      {/* Category & Sort Controls */}
      <div className="enterprise-card p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-[#EEE8F7] p-1 rounded-[10px] border border-[#D4C7E6]">
          {([
            { id: 'all', label: 'All Categories' },
            { id: 'maintenance', label: 'Maintenance' },
            { id: 'driver_safety', label: 'Driver Safety' },
            { id: 'fuel', label: 'Fuel' },
            { id: 'telemetry', label: 'Telemetry' },
            { id: 'trip_exceptions', label: 'Trip Exceptions' },
          ] as const).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1 rounded-[8px] text-xs font-semibold transition-colors whitespace-nowrap ${
                categoryFilter === cat.id ? 'bg-[#FBF6E6] text-[#625346] shadow-subtle' : 'text-[#7D6D5F] hover:text-[#625346]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="risk-sort" className="text-[#7D6D5F] font-medium">Sort:</label>
          <select
            id="risk-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="dm-input py-1.5 text-xs w-auto"
          >
            <option value="severity">Highest Severity</option>
            <option value="confidence">Highest Confidence</option>
            <option value="recent">Most Recent</option>
          </select>
        </div>
      </div>

      {/* Risk List */}
      {filtered.length === 0 ? (
        <EmptySectionState
          title="No risk entries for selected filter"
          description="Try clearing category or severity filters to inspect all fleet assessments."
          actionLabel="Show All Risks"
          onAction={() => {
            setSeverityFilter('all')
            setCategoryFilter('all')
          }}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} className="enterprise-card p-5 flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <SeverityText severity={item.severity} />
                  <span className="font-bold text-[#625346] tabular-nums">{item.vehicleRegistration}</span>
                  <span className="text-[#7D6D5F]">·</span>
                  <span className="capitalize text-[#625346] font-medium">{item.category.replace('_', ' ')}</span>
                  <span className="text-[#7D6D5F]">·</span>
                  <span className="text-[#7D6D5F] tabular-nums">Confidence {item.confidencePct}%</span>
                  {item.insufficientData && (
                    <>
                      <span className="text-[#7D6D5F]">·</span>
                      <span className="text-[#625346] bg-[#EEE8F7] border border-[#B8A3D9] px-2 py-0.5 rounded font-semibold">
                        Insufficient Live Telemetry
                      </span>
                    </>
                  )}
                </div>
                <h2 className="dm-card-title">{item.title}</h2>
                <p className="text-xs text-[#7D6D5F]">{item.evidence}</p>
                <p className="text-xs text-[#625346] font-medium">
                  Recommended Action: {item.recommendedAction}
                </p>
                <p className="text-[11px] text-[#7D6D5F] tabular-nums">
                  Assessed {formatDateTime(item.timestamp, activeOrganization.timezone)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(item.actionRoute)}
                className="btn-secondary text-xs shrink-0"
              >
                Open Module
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

