import { useAIPredictions, AIPrediction } from '../hooks/useAIPredictions'
import { useVehicles } from '../hooks/useVehicles'
import { Brain, Shield, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Info, TrendingDown, Clock } from 'lucide-react'
import { useState } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { getHealthColor, getHealthClass, formatCurrency, getPriorityClass } from '../lib/utils'

function SeverityBanner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl border border-info/30 bg-info/8 mb-5">
      <Shield className="w-5 h-5 text-info flex-shrink-0" />
      <div>
        <p className="text-sm font-semibold text-info">Privacy-First Intelligence</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function PredictionCard({ p, expanded, onToggle }: { p: AIPrediction; expanded: boolean; onToggle: () => void }) {
  const factors = Array.isArray(p.causal_factors) ? p.causal_factors : []
  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${
      p.priority === 'critical' ? 'border-destructive/35' :
      p.priority === 'high' ? 'border-warning/35' :
      p.priority === 'medium' ? 'border-info/35' : 'border-border/50'
    }`}>
      <button className="w-full flex items-start gap-4 p-4 hover:bg-secondary/30 transition-colors text-left" onClick={onToggle}>
        <div className="flex-shrink-0 mt-0.5">
          <span className={getPriorityClass(p.priority)}>{p.priority}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold">{p.component_name}</span>
            <span className="text-[11px] text-muted-foreground">• {p.registration_number} ({p.make} {p.model})</span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">{p.recommendation}</p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-3 ml-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-success">{formatCurrency(p.estimated_cost_if_fixed)}</p>
            <p className="text-[10px] text-muted-foreground">saves {formatCurrency(p.roi_if_fixed_now)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-primary">{Math.round(p.confidence_score * 100)}%</p>
            <p className="text-[10px] text-muted-foreground">confidence</p>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground"/> : <ChevronDown className="w-4 h-4 text-muted-foreground"/>}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-0 border-t border-border/40 bg-secondary/10">
          {/* 7/30/90 day probabilities */}
          <div className="grid grid-cols-3 gap-3 my-4">
            {[
              ['7d Risk', p.failure_probability_7d],
              ['30d Risk', p.failure_probability_30d],
              ['90d Risk', p.failure_probability_90d],
            ].map(([label, prob]) => (
              <div key={String(label)} className="text-center p-3 rounded-xl bg-background/50">
                <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                <p className="text-xl font-display font-bold" style={{
                  color: Number(prob)>0.5?'hsl(0 72% 51%)':Number(prob)>0.25?'hsl(38 92% 50%)':'hsl(160 84% 39%)'
                }}>{Math.round(Number(prob)*100)}%</p>
              </div>
            ))}
          </div>

          {/* Failure window */}
          <div className="flex items-center gap-2 mb-3 p-3 bg-background/50 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-warning flex-shrink-0" />
            <div className="text-xs">
              <span className="text-muted-foreground">Failure window: </span>
              <span className="font-medium">{p.failure_date_earliest}</span>
              <span className="text-muted-foreground"> → probable </span>
              <span className="font-semibold text-warning">{p.predicted_failure_date}</span>
              <span className="text-muted-foreground"> → latest </span>
              <span className="font-medium">{p.failure_date_latest}</span>
            </div>
          </div>

          {/* AI Reasoning */}
          <div className="p-3 bg-primary/5 border border-primary/15 rounded-xl mb-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="text-primary font-semibold">AI Reasoning: </span>{p.ai_reasoning}
            </p>
          </div>

          {/* Causal factors */}
          {factors.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-medium text-muted-foreground mb-2">Causal Factors</p>
              <div className="space-y-1.5">
                {factors.map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="text-[10px] text-muted-foreground w-32 truncate capitalize">{f.factor?.replace(/_/g,' ')}</div>
                    <div className="flex-1 health-bar h-1.5">
                      <div className="health-bar-fill h-full" style={{width:`${Math.round(f.weight*100)}%`,background:'hsl(43 96% 56%)'}}/>
                    </div>
                    <div className="text-[10px] text-primary w-8 text-right">{Math.round(f.weight*100)}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost breakdown */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 bg-success/10 border border-success/25 rounded-xl text-center">
              <p className="text-[10px] text-muted-foreground">Fix now</p>
              <p className="text-sm font-bold text-success">{formatCurrency(p.estimated_cost_if_fixed)}</p>
            </div>
            <div className="p-2.5 bg-destructive/10 border border-destructive/25 rounded-xl text-center">
              <p className="text-[10px] text-muted-foreground">If delayed</p>
              <p className="text-sm font-bold text-destructive">{formatCurrency(p.estimated_cost_if_delayed)}</p>
            </div>
            <div className="p-2.5 bg-primary/10 border border-primary/25 rounded-xl text-center">
              <p className="text-[10px] text-muted-foreground">Net savings</p>
              <p className="text-sm font-bold text-primary">{formatCurrency(p.roi_if_fixed_now)}</p>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground mt-3">
            <span className="font-medium">Recommendation: </span>{p.recommendation}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Data quality: {Math.round(p.data_quality_score * 100)}% • Confidence: {Math.round(p.confidence_lower*100)}%–{Math.round(p.confidence_upper*100)}%
          </p>
        </div>
      )}
    </div>
  )
}

export default function HealthPredictions() {
  const { predictions, loading, resolvePrediction } = useAIPredictions()
  const { vehicles } = useVehicles()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [vehicleExpandId, setVehicleExpandId] = useState<string | null>(null)

  const healthy = vehicles.filter(v => v.status === 'healthy').length
  const monitor = vehicles.filter(v => v.status === 'at-risk').length
  const priority = vehicles.filter(v => v.status === 'critical').length

  const radarData = [
    { component: 'Engine', health: predictions.filter(p=>p.component_name.includes('Engine')).length > 0 ? Math.round((1 - predictions.find(p=>p.component_name.includes('Engine'))!.failure_probability_30d)*100) : 90 },
    { component: 'Brakes', health: predictions.filter(p=>p.component_name.includes('Brake')).length > 0 ? Math.round((1 - predictions.find(p=>p.component_name.includes('Brake'))!.failure_probability_30d)*100) : 85 },
    { component: 'Battery', health: predictions.filter(p=>p.component_name.includes('Battery')).length > 0 ? Math.round((1 - predictions.find(p=>p.component_name.includes('Battery'))!.failure_probability_30d)*100) : 92 },
    { component: 'Suspension', health: predictions.filter(p=>p.component_name.includes('Suspension')).length > 0 ? Math.round((1 - predictions.find(p=>p.component_name.includes('Suspension'))!.failure_probability_30d)*100) : 80 },
    { component: 'Tires', health: predictions.filter(p=>p.component_name.includes('Tir')).length > 0 ? Math.round((1 - predictions.find(p=>p.component_name.includes('Tir'))!.failure_probability_30d)*100) : 82 },
  ]

  const barData = predictions.slice(0,5).map(p => ({
    name: p.component_name.split(' ')[0],
    predicted: Math.round(p.failure_probability_30d * 10),
    savings: Math.round(p.roi_if_fixed_now / 5000),
  }))

  const totalSavings = predictions.reduce((s,p) => s + p.roi_if_fixed_now, 0)
  const avgConf = predictions.length > 0 ? Math.round(predictions.reduce((s,p) => s + p.confidence_score, 0) / predictions.length * 100) : 0

  return (
    <div className="space-y-5 page-enter">
      <SeverityBanner label="All predictions inferred from fleet patterns, maintenance history, and road data. No cameras. No microphones. No driver surveillance. PDPA-compliant." />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            AI Health Predictions
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {predictions.length} active predictions • AI model confidence avg {avgConf}%
          </p>
        </div>
        {totalSavings > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-success/10 border border-success/25">
            <TrendingDown className="w-3.5 h-3.5 text-success" />
            <span className="text-xs font-medium text-success">Act now → save {formatCurrency(totalSavings)}</span>
          </div>
        )}
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {label:'Healthy', count:healthy, icon:CheckCircle, cls:'text-success', bg:'bg-success/10 border-success/25'},
          {label:'Monitor', count:monitor, icon:Info, cls:'text-warning', bg:'bg-warning/10 border-warning/25'},
          {label:'Priority', count:priority, icon:AlertTriangle, cls:'text-destructive', bg:'bg-destructive/10 border-destructive/25'},
          {label:'AI Predictions', count:predictions.length, icon:Brain, cls:'text-primary', bg:'bg-primary/10 border-primary/25'},
        ].map(({label,count,icon:Icon,cls,bg})=>(
          <div key={label} className={`glass-card p-4 rounded-2xl border ${bg}`}>
            <Icon className={`w-5 h-5 ${cls} mb-2`}/>
            <div className={`text-2xl font-display font-bold ${cls}`}>{count}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-2xl">
          <h3 className="font-display font-semibold text-sm mb-4">Fleet Component Health Radar</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(220 10% 18%)"/>
              <PolarAngleAxis dataKey="component" tick={{fontSize:10,fill:'hsl(220 10% 55%)'}}/>
              <Radar name="Health" dataKey="health" stroke="hsl(43 96% 56%)" fill="hsl(43 96% 56%)" fillOpacity={0.2}/>
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <h3 className="font-display font-semibold text-sm mb-4">Prediction Risk vs Savings (×₹5K)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{top:4,right:4,left:-16,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 10% 18%)"/>
              <XAxis dataKey="name" tick={{fontSize:10,fill:'hsl(220 10% 55%)'}}/>
              <YAxis tick={{fontSize:10,fill:'hsl(220 10% 55%)'}}/>
              <Tooltip contentStyle={{background:'hsl(220 15% 10%)',border:'1px solid hsl(220 10% 20%)',borderRadius:12,fontSize:11}}/>
              <Bar dataKey="predicted" name="Failure Risk (×10%)" fill="hsl(0 72% 51%)" radius={[4,4,0,0]}/>
              <Bar dataKey="savings" name="Net Savings (×₹5K)" fill="hsl(43 96% 56%)" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Prediction cards */}
      {loading ? (
        <div className="space-y-3">{Array.from({length:4}).map((_,i)=><div key={i} className="skeleton h-20 rounded-2xl"/>)}</div>
      ) : predictions.length === 0 ? (
        <div className="glass-card p-10 rounded-2xl text-center">
          <CheckCircle className="w-10 h-10 text-success/40 mx-auto mb-3"/>
          <p className="text-sm text-muted-foreground">No active predictions — your fleet looks healthy!</p>
          <p className="text-[11px] text-muted-foreground mt-1">Add vehicles and run the database seed to see AI predictions.</p>
        </div>
      ) : (
        <div>
          <h3 className="font-display font-semibold text-sm mb-3">Active Predictions ({predictions.length})</h3>
          <div className="space-y-2">
            {predictions.map(p => (
              <PredictionCard
                key={p.id}
                p={p}
                expanded={expandedId === p.id}
                onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Vehicle health rankings */}
      <div className="glass-card p-5 rounded-2xl">
        <h3 className="font-display font-semibold text-sm mb-4">Vehicle Health Rankings</h3>
        {vehicles.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Add vehicles to see health rankings</p>
        ) : (
          <div className="space-y-2">
            {[...vehicles].sort((a,b)=>a.health_score-b.health_score).map(v=>{
              const ex = vehicleExpandId === v.id
              const vPreds = predictions.filter(p => p.vehicle_id === v.id)
              return (
                <div key={v.id} className="border border-border/50 rounded-xl overflow-hidden">
                  <button className="w-full flex items-center gap-4 p-3.5 hover:bg-secondary/40 transition-colors" onClick={()=>setVehicleExpandId(ex?null:v.id)}>
                    <div className="flex-shrink-0 w-12 text-center">
                      <span className="text-base font-display font-bold" style={{color:getHealthColor(v.health_score)}}>{v.health_score}%</span>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold">{v.registration_number}</p>
                      <p className="text-xs text-muted-foreground">{v.make} {v.model} • {v.city_name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={getHealthClass(v.health_score)}>{v.status}</span>
                      {vPreds.length > 0 && <span className="text-[10px] text-destructive font-medium">{vPreds.length} alert{vPreds.length>1?'s':''}</span>}
                      {ex ? <ChevronUp className="w-4 h-4 text-muted-foreground"/> : <ChevronDown className="w-4 h-4 text-muted-foreground"/>}
                    </div>
                  </button>
                  {ex && (
                    <div className="px-4 pb-4 border-t border-border/40 pt-3 bg-secondary/20">
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        {[['7 Day', Math.max(0,Math.round((100-v.health_score)*0.4))],['30 Day',Math.max(0,Math.round((100-v.health_score)*0.65))],['90 Day',Math.max(0,Math.round((100-v.health_score)*0.85))]].map(([label,prob])=>(
                          <div key={label} className="p-2.5 bg-background/50 rounded-xl text-center">
                            <p className="text-[10px] text-muted-foreground">{label} Risk</p>
                            <p className="text-lg font-display font-bold" style={{color:Number(prob)>50?'hsl(0 72% 51%)':Number(prob)>25?'hsl(38 92% 50%)':'hsl(160 84% 39%)'}}>{prob}%</p>
                          </div>
                        ))}
                      </div>
                      {vPreds.map(p => (
                        <div key={p.id} className="text-[11px] text-muted-foreground leading-relaxed mb-1">
                          • <span className="text-warning font-medium">{p.component_name}:</span> {p.recommendation}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
