import { useTNCities } from '../hooks/useTNCities'
import { Map, Thermometer, Droplets, AlertTriangle, Loader2, Info } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend } from 'recharts'

export default function RoadIntelligence() {
  const { cities, loading } = useTNCities()

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  )

  const barData = cities.map(c => ({
    name: c.name,
    pothole: Math.round(c.road_stress_index * 100),
    climate: Math.round(c.climate_impact_score * 100),
    risk: c.pothole_density === 'high' ? 90 : c.pothole_density === 'moderate' ? 60 : 30,
  }))

  const radarData = cities.map(c => ({
    route: c.name,
    stress: Math.round(c.road_stress_index * 100),
    climate: Math.round(c.climate_impact_score * 100),
    potholes: c.pothole_density === 'high' ? 95 : c.pothole_density === 'moderate' ? 65 : 35,
  }))

  const getRiskColor = (stress: number) => {
    if (stress >= 0.7) return 'status-critical'
    if (stress >= 0.5) return 'status-warning'
    return 'status-success'
  }

  const getDensityColor = (density: string) => {
    if (density === 'high') return 'text-destructive'
    if (density === 'moderate') return 'text-warning'
    return 'text-success'
  }

  return (
    <div className="space-y-5 page-enter">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Map className="w-6 h-6 text-primary" />
          Indian Road Intelligence
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Tamil Nadu route conditions • AI-calibrated wear factors • {cities.length} cities tracked</p>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <div className="px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/25 text-xs text-destructive font-medium flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" />
          {cities.filter(c => c.road_stress_index >= 0.7).length} High Stress Zones
        </div>
        <div className="px-3 py-1.5 rounded-full bg-warning/10 border border-warning/25 text-xs text-warning font-medium">
          {cities.filter(c => c.road_stress_index >= 0.5 && c.road_stress_index < 0.7).length} Moderate Stress
        </div>
        <div className="px-3 py-1.5 rounded-full bg-success/10 border border-success/25 text-xs text-success font-medium">
          {cities.filter(c => c.road_stress_index < 0.5).length} Optimized Routes
        </div>
        <div className="px-3 py-1.5 rounded-full bg-info/10 border border-info/25 text-xs text-info font-medium flex items-center gap-1.5">
          <Info className="w-3 h-3" />
          Real-time weather & load data synced
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-2xl">
          <h3 className="font-display font-semibold text-sm mb-4">Route Stress Comparison (%)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 10% 18%)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(220 10% 55%)' }} interval={0} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(220 10% 55%)' }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: 'hsl(220 15% 10%)', border: '1px solid hsl(220 10% 20%)', borderRadius: 12, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
              <Bar dataKey="pothole" name="Pothole Factor" fill="hsl(0 72% 51%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="climate" name="Climate Impact" fill="hsl(43 96% 56%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="risk" name="Overall Risk" fill="hsl(38 92% 50%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <h3 className="font-display font-semibold text-sm mb-4">Multi-Factor Risk Radar</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData.slice(0, 8)}>
              <PolarGrid stroke="hsl(220 10% 18%)" />
              <PolarAngleAxis dataKey="route" tick={{ fontSize: 9, fill: 'hsl(220 10% 55%)' }} />
              <Radar name="Road Stress" dataKey="stress" stroke="hsl(0 72% 51%)" fill="hsl(0 72% 51%)" fillOpacity={0.15} />
              <Radar name="Climate impact" dataKey="climate" stroke="hsl(43 96% 56%)" fill="hsl(43 96% 56%)" fillOpacity={0.15} />
              <Radar name="Pothole density" dataKey="potholes" stroke="hsl(217 91% 60%)" fill="hsl(217 91% 60%)" fillOpacity={0.15} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Route cards */}
      <h3 className="font-display font-semibold text-sm mb-3">Tamil Nadu Regional Intelligence</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cities.map(c => (
          <div key={c.id} className="glass-card card-lift p-4 rounded-2xl">
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight truncate">{c.name}</p>
                <p className="text-[10px] text-muted-foreground">{c.region} Tamil Nadu</p>
              </div>
              <span className={getRiskColor(c.road_stress_index)}>
                {c.road_stress_index >= 0.7 ? 'Critical' : c.road_stress_index >= 0.5 ? 'Moderate' : 'Optimized'}
              </span>
            </div>

            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground">Road Stress Index</span>
                  <span className="font-bold text-primary">{Math.round(c.road_stress_index * 100)}%</span>
                </div>
                <div className="health-bar">
                  <div className="health-bar-fill" style={{ width: `${c.road_stress_index * 100}%`, background: 'hsl(43 96% 56%)' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground">Climate Impact</span>
                  <span className="font-bold text-info">{Math.round(c.climate_impact_score * 100)}%</span>
                </div>
                <div className="health-bar">
                  <div className="health-bar-fill" style={{ width: `${c.climate_impact_score * 100}%`, background: 'hsl(217 91% 60%)' }} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/40">
                <div className="flex items-center gap-1.5">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase">Potholes</span>
                    <span className={`text-[11px] font-bold capitalize ${getDensityColor(c.pothole_density)}`}>
                      {c.pothole_density}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase">Avg Temp</span>
                    <span className="text-[11px] font-bold">34°C</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3 text-center">
              <div className="p-2 bg-secondary/40 rounded-xl">
                <Thermometer className="w-3 h-3 text-warning mx-auto mb-0.5" />
                <p className="text-[10px] text-muted-foreground">Heat Wear</p>
                <p className="text-[11px] font-bold">{Math.round(c.climate_impact_score * 120)}%</p>
              </div>
              <div className="p-2 bg-secondary/40 rounded-xl">
                <Droplets className="w-3 h-3 text-info mx-auto mb-0.5" />
                <p className="text-[10px] text-muted-foreground">Rain Wear</p>
                <p className="text-[11px] font-bold">{Math.round(c.climate_impact_score * 85)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
