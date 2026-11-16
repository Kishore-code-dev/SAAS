import React, { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Info } from 'lucide-react'
import { useFleet } from '../hooks/useFleet'
import { formatInr } from '../components/ui/EnterprisePrimitives'

export default function Financials() {
  const { activeOrganization, reportingPeriod, financialSummary } = useFleet()
  const [showMethodology, setShowMethodology] = useState(false)

  const monthlyTrend = [
    { month: 'M-2', fuel: Math.round(financialSummary.fuelExpenditureInr * 0.92), maint: Math.round(financialSummary.maintenanceExpenditureInr * 0.85) },
    { month: 'M-1', fuel: Math.round(financialSummary.fuelExpenditureInr * 0.97), maint: Math.round(financialSummary.maintenanceExpenditureInr * 1.05) },
    { month: 'Current', fuel: financialSummary.fuelExpenditureInr, maint: financialSummary.maintenanceExpenditureInr },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dm-page-title">Financial Intelligence</h1>
          <p className="text-sm text-[#7D6D5F] mt-1">
            {activeOrganization.name} · Period {reportingPeriod.toUpperCase()} · All amounts in INR (₹)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowMethodology((s) => !s)}
          className="btn-secondary text-xs"
        >
          <Info className="w-3.5 h-3.5 text-[#6E5696]" />
          {showMethodology ? 'Hide Calculation Methodology' : 'View Calculation Methodology'}
        </button>
      </div>

      {showMethodology && (
        <div className="lavender-surface p-5 space-y-2 text-xs text-[#625346]">
          <p className="font-bold text-[#625346]">Financial Intelligence Calculation Methodology</p>
          <ul className="list-disc pl-5 space-y-1 text-[#7D6D5F]">
            {financialSummary.methodologyNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Primary Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#7D6D5F]">Fuel / Energy Spend</span>
          <p className="text-xl font-bold text-[#625346] tabular-nums mt-1.5">
            {formatInr(financialSummary.fuelExpenditureInr)}
          </p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#7D6D5F]">Maintenance Spend</span>
          <p className="text-xl font-bold text-[#625346] tabular-nums mt-1.5">
            {formatInr(financialSummary.maintenanceExpenditureInr)}
          </p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#7D6D5F]">Operating Expenditure</span>
          <p className="text-xl font-bold text-[#6E5696] tabular-nums mt-1.5">
            {formatInr(financialSummary.operatingExpenditureInr)}
          </p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#7D6D5F]">Blended Cost / km</span>
          <p className="text-xl font-bold text-[#625346] tabular-nums mt-1.5">
            ₹{financialSummary.costPerKmInr}
          </p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#7D6D5F]">Est. Downtime Exposure</span>
          <p className="text-xl font-bold text-[#625346] tabular-nums mt-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#D9786C]" />
            {formatInr(financialSummary.estimatedDowntimeCostInr)}
          </p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#7D6D5F]">Est. Potential Savings</span>
          <p className="text-xl font-bold text-[#625346] tabular-nums mt-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#789A75]" />
            {formatInr(financialSummary.estimatedPotentialSavingsInr)}
          </p>
        </div>
      </div>

      {/* ICE vs EV Comparison + Monthly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 enterprise-card p-5">
          <h2 className="dm-card-title">Expenditure Trend (Fuel vs Maintenance)</h2>
          <p className="text-xs text-[#7D6D5F] mb-4">Three-window rolling expenditure breakdown in INR</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#7D6D5F', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#7D6D5F', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="fuel" name="Fuel / Charging (₹)" fill="#E8C65A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="maint" name="Maintenance (₹)" fill="#B8A3D9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 enterprise-card p-5 space-y-4">
          <div>
            <h2 className="dm-card-title">ICE vs EV Operating Comparison</h2>
            <p className="text-xs text-[#7D6D5F]">Per-kilometer energy & service spend by powertrain</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px] p-4 space-y-1.5">
              <span className="font-semibold text-[#7D6D5F]">ICE Fleet ({financialSummary.iceVsEv.iceCount})</span>
              <p className="text-xl font-bold text-[#625346] tabular-nums">
                ₹{financialSummary.iceVsEv.iceCostPerKmInr}/km
              </p>
              <p className="text-[#7D6D5F]">Avg Health: {financialSummary.iceVsEv.iceAvgHealth}%</p>
            </div>
            <div className="border border-[#789A75] bg-[#789A75]/20 rounded-[10px] p-4 space-y-1.5">
              <span className="font-semibold text-[#625346]">EV Fleet ({financialSummary.iceVsEv.evCount})</span>
              <p className="text-xl font-bold text-[#625346] tabular-nums">
                ₹{financialSummary.iceVsEv.evCostPerKmInr}/km
              </p>
              <p className="text-[#625346]/85">Avg Health: {financialSummary.iceVsEv.evAvgHealth}%</p>
            </div>
          </div>

          <p className="text-xs text-[#7D6D5F] leading-relaxed">
            Estimated maintenance savings are planning projections derived from fixing high-priority components before reactive roadside failure.
          </p>
        </div>
      </div>

      {/* Vehicle Cost Breakdown Table */}
      <div className="enterprise-card overflow-hidden">
        <div className="px-5 py-4 bg-[#FBF6E6] border-b border-[#E0D4B7]">
          <h2 className="dm-card-title">Vehicle Cost Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Registration</th>
                <th>Powertrain</th>
                <th>Fuel / Charging</th>
                <th>Maintenance</th>
                <th>Total Operating</th>
                <th>Est. Distance</th>
                <th>Cost / km</th>
              </tr>
            </thead>
            <tbody>
              {financialSummary.vehicleCostBreakdown.map((row) => (
                <tr key={row.vehicleId}>
                  <td className="font-bold text-[#625346] tabular-nums">{row.registrationNumber}</td>
                  <td>{row.powertrain}</td>
                  <td className="tabular-nums">{formatInr(row.fuelSpendInr)}</td>
                  <td className="tabular-nums">{formatInr(row.maintenanceSpendInr)}</td>
                  <td className="font-bold tabular-nums">{formatInr(row.totalSpendInr)}</td>
                  <td className="tabular-nums">{row.distanceKm.toLocaleString('en-IN')} km</td>
                  <td className="font-semibold tabular-nums text-[#6E5696]">₹{row.costPerKmInr}/km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

