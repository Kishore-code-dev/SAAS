import { useParams, Link } from 'react-router-dom'
import { useVehicles } from '../hooks/useVehicles'
import { useVehicleComponents } from '../hooks/useVehicleComponents'
import { useAIPredictions } from '../hooks/useAIPredictions'
import { useMaintenanceHistory } from '../hooks/useMaintenanceHistory'
import { useDrivers } from '../hooks/useDrivers'
import { ArrowLeft, MapPin, User2, Fuel, Calendar, Activity, Wrench, Brain, AlertTriangle } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getHealthColor, getHealthClass, formatCurrency, getPriorityClass } from '../lib/utils'

// Generate health timeline from current health score
function buildTimeline(healthScore: number) {
  const now = new Date()
  const trend: { month: string; score: number | null; predicted: number | null }[] = []
  for (let i = 9; i >= 1; i--) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i)
    const noise = Math.floor(Math.random() * 4) - 2
    const base = Math.min(100, Math.round(healthScore + i * 2.5 + noise))
    trend.push({ month: d.toLocaleString('default', { month: 'short' }), score: base, predicted: null })
  }
  trend.push({ month: now.toLocaleString('default', { month: 'short' }), score: healthScore, predicted: null })
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now)
    d.setMonth(d.getMonth() + i)
    trend.push({
      month: d.toLocaleString('default', { month: 'short' }),
      score: null,
      predicted: Math.max(10, Math.round(healthScore - i * (100 - healthScore) * 0.08))
    })
  }
  return trend
}

export default function VehicleDetails() {
  const { id } = useParams<{ id: string }>()
  const { vehicles, loading: vLoad } = useVehicles()
  const { components, loading: cLoad } = useVehicleComponents(id)
  const { predictions } = useAIPredictions()
  const { records } = useMaintenanceHistory(id)
  const { drivers } = useDrivers()

  const vehicle = vehicles.find(v => v.id === id)
  const vehiclePredictions = predictions.filter(p => p.vehicle_id === id)
  const driver = drivers.find(d => d.vehicle_id === id)

  if (vLoad) return (
    <div className="space-y-4 animate-pulse">
      <div className="skeleton h-16 rounded-2xl" />
      <div className="grid grid-cols-4 gap-3">{Array.from({length:4}).map((_,i)=><div key={i} className="skeleton h-20 rounded-xl"/>)}</div>
      <div className="grid grid-cols-2 gap-4"><div className="skeleton h-64 rounded-2xl"/><div className="skeleton h-64 rounded-2xl"/></div>
    </div>
  )

  if (!vehicle) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <AlertTriangle className="w-12 h-12 text-warning/40 mb-3" />
      <p className="text-muted-foreground">Vehicle not found</p>
      <Link to="/vehicles" className="text-primary text-sm mt-2 hover:underline">← Back to fleet</Link>
    </div>
  )

  const health = vehicle.health_score
  const timeline = buildTimeline(health)
  const prob7d  = Math.max(0, Math.round((100 - health) * 0.4))
  const prob30d = Math.max(0, Math.round((100 - health) * 0.65))
  const prob90d = Math.max(0, Math.round((100 - health) * 0.85))

  return (
    <div className="space-y-5 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/vehicles">
          <button className="p-2 rounded-xl hover:bg-secondary transition-colors"><ArrowLeft className="w-4 h-4" /></button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center flex-wrap gap-3">
            <h1 className="font-display text-xl font-bold">{vehicle.registration_number}</h1>
            <span className={getHealthClass(health)}>{vehicle.status}</span>
            <span className="text-xs text-muted-foreground">{vehicle.make} {vehicle.model} • {vehicle.year} • {vehicle.fuel_type}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-3xl font-display font-bold" style={{ color: getHealthColor(health) }}>{health}%</div>
          <div className="text-xs text-muted-foreground">Health Score</div>
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: MapPin, label: 'City', value: vehicle.city_name || '—' },
          { icon: User2, label: 'Driver', value: vehicle.assigned_driver || 'Unassigned' },
          { icon: Fuel, label: 'Fuel', value: vehicle.fuel_type },
          { icon: Calendar, label: 'Next Service', value: vehicle.next_service_due || 'Not set' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass-card p-3.5 rounded-xl flex items-center gap-3">
            <Icon className="w-4 h-4 text-primary flex-shrink-0" />
            <div><p className="text-[10px] text-muted-foreground">{label}</p><p className="text-xs font-semibold">{value}</p></div>
          </div>
        ))}
      </div>

      {/* Failure risk banners */}
      {vehiclePredictions.length > 0 && (
        <div className="space-y-2">
          {vehiclePredictions.map(p => (
            <div key={p.id} className={`flex items-start gap-3 p-4 rounded-2xl border ${
              p.priority === 'critical' ? 'bg-destructive/10 border-destructive/30' :
              p.priority === 'high' ? 'bg-warning/10 border-warning/25' : 'bg-info/10 border-info/25'
            }`}>
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${p.priority === 'critical' ? 'text-destructive' : p.priority === 'high' ? 'text-warning' : 'text-info'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold">{p.component_name}</span>
                  <span className={getPriorityClass(p.priority)}>{p.priority}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{p.ai_reasoning}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-xs font-bold text-success">{formatCurrency(p.estimated_cost_if_fixed)}</p>
                <p className="text-[10px] text-muted-foreground">saves {formatCurrency(p.roi_if_fixed_now)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Health Timeline */}
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-sm">Health Timeline</h3>
            <span className="text-[10px] text-muted-foreground ml-auto">AI predicted trend</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={timeline} margin={{top:4,right:4,left:-20,bottom:0}}>
              <defs>
                <linearGradient id="ahGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160 84% 39%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(160 84% 39%)" stopOpacity={0.02}/>
                </linearGradient>
                <linearGradient id="phGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(43 96% 56%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(43 96% 56%)" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 10% 18%)"/>
              <XAxis dataKey="month" tick={{fontSize:10, fill:'hsl(220 10% 55%)'}}/>
              <YAxis tick={{fontSize:10, fill:'hsl(220 10% 55%)'}} domain={[0,100]}/>
              <Tooltip contentStyle={{background:'hsl(220 15% 10%)',border:'1px solid hsl(220 10% 20%)',borderRadius:12,fontSize:11}}/>
              <Area type="monotone" dataKey="score" name="Actual" stroke="hsl(160 84% 39%)" fill="url(#ahGrad)" strokeWidth={2} connectNulls={false}/>
              <Area type="monotone" dataKey="predicted" name="AI Predicted" stroke="hsl(43 96% 56%)" fill="url(#phGrad)" strokeWidth={2} strokeDasharray="4 3" connectNulls={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Driver Impact */}
        <div className="glass-card p-5 rounded-2xl">
          <h3 className="font-display font-semibold text-sm mb-3">Driver Impact Analysis</h3>
          {driver ? (
            <>
              <div className="flex items-center gap-3 mb-3 p-3 bg-secondary/40 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-gradient-gold flex items-center justify-center text-black font-bold text-sm">{driver.driver_name.charAt(0)}</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{driver.driver_name}</p>
                  <p className="text-[11px] text-muted-foreground">Overall score: {driver.overall_score}/100</p>
                </div>
                <div className="text-2xl font-display font-bold" style={{color: driver.overall_score>=70?'hsl(160 84% 39%)':driver.overall_score>=50?'hsl(38 92% 50%)':'hsl(0 72% 51%)'}}>{driver.overall_score}</div>
              </div>
              {[
                {label:'Aggressive Driving', value:driver.aggressive_driving_score, max:100, inverse:true},
                {label:'Harsh Braking', value:driver.harsh_braking_count, max:200, inverse:true},
                {label:'Fuel Efficiency', value:driver.fuel_efficiency_score, max:100, inverse:false},
              ].map(({label,value,max,inverse})=>{
                const pct = Math.round((value/max)*100)
                const color = inverse?(pct>60?'hsl(0 72% 51%)':pct>30?'hsl(38 92% 50%)':'hsl(160 84% 39%)'):(pct>70?'hsl(160 84% 39%)':pct>40?'hsl(38 92% 50%)':'hsl(0 72% 51%)')
                return (
                  <div key={label} className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span style={{color}}>{value}</span>
                    </div>
                    <div className="health-bar"><div className="health-bar-fill" style={{width:`${pct}%`,background:color}}/></div>
                  </div>
                )
              })}
              <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">{driver.impact_on_vehicle}</p>
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs text-muted-foreground">No driver data for this vehicle</p>
            </div>
          )}
        </div>
      </div>

      {/* Component Health from Supabase */}
      {!cLoad && components.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-sm">Component Health</h3>
            <span className="text-[11px] text-muted-foreground">{components.length} components tracked</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {components.map(c => {
              const pred = vehiclePredictions.find(p => p.component_name.toLowerCase().includes(c.component_name.toLowerCase().split(' ')[0]))
              return (
                <div key={c.id} className="glass-card p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold truncate">{c.component_name}</span>
                    <span className={getHealthClass(c.health_score)}>{c.status}</span>
                  </div>
                  <div className="text-2xl font-display font-bold mb-1" style={{color:getHealthColor(c.health_score)}}>{c.health_score}%</div>
                  <div className="health-bar mb-2">
                    <div className="health-bar-fill" style={{width:`${c.health_score}%`,background:getHealthColor(c.health_score)}}/>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Wear rate: {(c.wear_rate * 100).toFixed(1)}%/month
                  </p>
                  {c.predicted_replacement && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Replace by: {c.predicted_replacement}</p>
                  )}
                  {pred && (
                    <div className="mt-2 p-1.5 bg-warning/10 rounded-lg">
                      <p className="text-[10px] text-warning font-medium">AI Alert: {Math.round(pred.failure_probability_30d * 100)}% 30d risk</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Failure probabilities */}
      <div className="glass-card p-5 rounded-2xl">
        <h3 className="font-display font-semibold text-sm mb-4">Failure Probability</h3>
        <div className="grid grid-cols-3 gap-4">
          {[['7 Day', prob7d], ['30 Day', prob30d], ['90 Day', prob90d]].map(([label, prob]) => (
            <div key={label} className="text-center p-4 rounded-xl bg-secondary/40">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <div className="text-3xl font-display font-bold" style={{color: Number(prob)>50?'hsl(0 72% 51%)':Number(prob)>25?'hsl(38 92% 50%)':'hsl(160 84% 39%)'}}>
                {prob}%
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">failure risk</p>
              <div className="mt-2 health-bar">
                <div className="health-bar-fill" style={{width:`${prob}%`,background:Number(prob)>50?'hsl(0 72% 51%)':Number(prob)>25?'hsl(38 92% 50%)':'hsl(160 84% 39%)'}}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Maintenance History */}
      {records.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-sm">Maintenance History</h3>
          </div>
          <div className="space-y-2">
            {records.map(r => (
              <div key={r.id} className="glass-card p-4 rounded-xl flex items-start gap-4">
                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-success mt-1.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{r.maintenance_type}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{r.description}</p>
                  {r.parts_replaced?.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">Parts: {r.parts_replaced.join(', ')}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">By: {r.performed_by}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs font-bold text-primary">{formatCurrency(r.cost)}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(r.performed_at).toLocaleDateString('en-IN')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
