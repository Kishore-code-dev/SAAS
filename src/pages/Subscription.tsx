import { useSubscription } from '../hooks/useSubscription'
import { Check, Zap, CreditCard, ShieldCheck, ArrowRight, Star, Layers, Globe, Clock, ChevronRight, Activity, Database, Sparkles } from 'lucide-react'
import { formatCurrency, cn } from '../lib/utils'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const Y = '#F5C518'
const G = '#00C896'
const M = '#FF4444'

export default function Subscription() {
  const { plan, allPlans, upgradePlan, subscription_status } = useSubscription()
  const [loading, setLoading] = useState<string | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')

  const handleUpgrade = async (id: string) => {
    setLoading(id)
    await upgradePlan(id)
    setLoading(null)
  }

  return (
    <div className="max-w-7xl mx-auto py-12 px-6 space-y-20 page-enter pb-32">
      
      {/* Hero Section */}
      <div className="text-center space-y-6 max-w-4xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-4"
        >
           <Star className="w-3.5 h-3.5" /> High-Performance Fleet Intelligence
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl font-display font-black tracking-tighter text-white"
        >
          Scale Your <span className="text-primary italic">Intelligence</span> Protocol.
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed border-l-2 border-white/5 pl-8 italic"
        >
          Zero hardware. Zero capital expenditure. Pure predictive logic for the next-generation global supply chain.
        </motion.p>
      </div>

      {/* Billing Toggle */}
      <div className="flex justify-center">
         <div className="flex p-1.5 bg-white/[0.02] border border-white/10 rounded-2xl gap-2 backdrop-blur-3xl shadow-premium">
            {[
              { id: 'monthly', label: 'Monthly' },
              { id: 'annual', label: 'Annual (Save 20%)' }
            ].map(b => (
              <button 
                key={b.id}
                onClick={() => setBillingCycle(b.id as any)}
                className={cn(
                  "px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  billingCycle === b.id ? "bg-primary text-black shadow-gold" : "text-muted hover:text-white"
                )}
              >
                {b.label}
              </button>
            ))}
         </div>
      </div>

      {/* Pricing Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-stretch">
        {allPlans.map((p, idx) => {
          const isCurrent = p.id === plan.id
          const isPremium = p.name === 'Growth' || p.name === 'Pro' || idx === 1
          const price = typeof p.price === 'number' ? (billingCycle === 'annual' ? p.price * 0.8 : p.price) : p.price

          return (
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={p.id} 
              className={cn(
                "relative flex flex-col p-12 rounded-[56px] transition-all duration-700 group shadow-premium overflow-hidden",
                isCurrent 
                  ? 'bg-gradient-to-br from-primary/10 via-primary/[0.02] to-transparent border-2 border-primary/40 ring-4 ring-primary/5' 
                  : 'bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] hover:border-white/10'
              )}
            >
              {isCurrent && (
                <div className="absolute top-0 right-0 p-8">
                   <div className="px-4 py-1.5 bg-primary text-black text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-gold italic rotate-12">
                     ACTIVE NODE
                   </div>
                </div>
              )}

              {isPremium && !isCurrent && (
                <div className="absolute -left-12 top-6 -rotate-45 px-16 py-1.5 bg-primary text-black text-[8px] font-black uppercase tracking-widest italic shadow-lg">
                   RECOMMENDED
                </div>
              )}

              <div className="mb-14 relative z-10">
                <div className="flex items-center gap-4 mb-4">
                   <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border transition-all", isPremium ? "bg-primary/10 border-primary/20 text-primary" : "bg-white/5 border-white/10 text-muted")}>
                      {idx === 0 ? <Layers className="w-6 h-6" /> : idx === 1 ? <Sparkles className="w-6 h-6 shadow-gold" /> : <Globe className="w-6 h-6" />}
                   </div>
                   <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white opacity-40 italic">{p.name} PLAN</h3>
                      <div className="h-px w-full bg-white/5 mt-1" />
                   </div>
                </div>
                
                <div className="flex items-baseline gap-2 mt-8">
                  <span className="text-6xl font-display font-black text-white italic tracking-tighter">
                    {typeof price === 'number' ? `₹${price.toLocaleString()}` : price}
                  </span>
                  {typeof price === 'number' && <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest italic">/ Cycle</span>}
                </div>
              </div>

              <div className="space-y-6 flex-1 mb-16 relative z-10">
                <ul className="space-y-5">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-4 group/li">
                      <div className={cn("mt-1 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all", isPremium ? "bg-primary/10 border-primary/30 text-primary group-hover/li:scale-110" : "bg-white/5 border-white/10 text-muted/40 group-hover/li:text-white")}>
                        <Check className="w-3 h-3" strokeWidth={4} />
                      </div>
                      <span className="text-sm font-bold text-white/50 group-hover/li:text-white transition-colors tracking-tight italic">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleUpgrade(p.id)}
                disabled={isCurrent || loading === p.id}
                className={cn(
                  "w-full py-6 rounded-[28px] font-black text-[11px] uppercase tracking-[0.3em] transition-all duration-500 shadow-xl relative z-10 italic overflow-hidden group/btn",
                  isCurrent 
                    ? 'bg-white/5 text-muted-foreground/30 border border-white/5 cursor-default' 
                    : isPremium 
                      ? 'bg-primary text-black hover:scale-105 active:scale-95 shadow-gold hover:shadow-[0_0_40px_rgba(255,204,0,0.3)]'
                      : 'bg-white text-black hover:scale-105 active:scale-95'
                )}
              >
                {loading === p.id ? <Activity className="w-5 h-5 animate-spin mx-auto" /> : isCurrent ? 'SYNCED' : 'Initiate Propulsion'}
              </button>

              <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/[0.01] rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/[0.03] transition-all" />
            </motion.div>
          )
        })}
      </div>

      {/* Billing Footer */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="glass-card p-12 rounded-[56px] bg-white/[0.01] border border-white/10 flex flex-col md:flex-row items-center justify-between gap-12 shadow-premium relative overflow-hidden"
      >
        <div className="absolute -left-10 -top-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
        <div className="flex items-center gap-8 relative z-10 w-full md:w-auto">
            <div className="w-20 h-20 rounded-[32px] bg-white/[0.02] border border-white/10 flex items-center justify-center shadow-2xl group hover:border-primary/20 transition-all">
                <CreditCard className="w-10 h-10 text-muted group-hover:text-primary transition-colors" />
            </div>
            <div>
                <h4 className="text-2xl font-display font-black text-white italic tracking-tighter uppercase mb-2">Protocol Billing</h4>
                <p className="text-sm font-medium text-muted/60 italic leading-relaxed">
                   Next node synchronization for <span className="text-primary font-black">₹{plan.price.toLocaleString()}</span> scheduled for <span className="text-white font-bold">{new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
                </p>
            </div>
        </div>
        <div className="flex items-center gap-6 relative z-10 w-full md:w-auto">
            <div className="text-right hidden md:block">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted/30 mb-2 italic">Session Status</p>
                <div className="flex items-center justify-end gap-3 text-success">
                   <div className="w-2 h-2 rounded-full bg-success shadow-gold animate-pulse" />
                   <span className="text-[11px] font-black uppercase tracking-widest">{subscription_status}</span>
                </div>
            </div>
            <button className="flex-1 md:flex-none px-10 py-5 bg-white/5 border border-white/10 rounded-[28px] text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all italic">
                Update Vault
            </button>
        </div>
      </motion.div>

      {/* Trust Quote */}
      <div className="text-center py-10 opacity-40 group cursor-default">
         <div className="w-1 h-12 bg-primary/20 mx-auto mb-8 rounded-full group-hover:bg-primary transition-colors" />
         <p className="text-sm font-black uppercase tracking-[0.6em] text-muted-foreground italic mb-4">Security Protocol Powered by DRIVE MITRA CORE</p>
         <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em] italic">ISO 27001 CLOUD ARCHITECTURE • END-TO-END DATA SOVEREIGNTY</p>
      </div>

    </div>
  )
}
