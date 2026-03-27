import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { Settings as SettingsIcon, User, Bell, Brain, Shield, Save, Loader2, CreditCard, Zap, Globe, Lock, Smartphone, Mail, Building, Phone, ChevronRight, CheckCircle2, MoreHorizontal, Database, Sparkles, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '../lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface Toggle {
  label: string
  description: string
  checked: boolean
  icon: any
}

export default function Settings() {
  const { user } = useAuth()
  const { profile, loading: pLoading, updateProfile } = useProfile()
  const [tab, setTab] = useState<'profile' | 'notifications' | 'ai' | 'billing'>('profile')
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    full_name: '',
    company_name: '',
    phone: '',
    role_label: 'Fleet Manager',
  })

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        company_name: profile.company_name || '',
        phone: profile.phone || '',
        role_label: profile.role_label || 'Fleet Manager',
      })
    }
  }, [profile])

  const [notifications, setNotifications] = useState<Toggle[]>([
    { label: 'Critical Service Alerts', description: 'Immediate notification for high-priority fleet events.', checked: true, icon: AlertTriangle },
    { label: 'AI Movement Digest', description: 'Daily summary of protocol deviations and mission logs.', checked: true, icon: Brain },
    { label: 'Energy Flux Alerts', description: 'Heavy fuel consumption or suspicious refueling nodes.', checked: false, icon: Zap },
    { label: 'System Compliance', description: 'Updates on data sovereignty and privacy audits.', checked: true, icon: Shield },
  ])

  const [aiSettings, setAiSettings] = useState<Toggle[]>([
    { label: 'Automatic Resource Scheduling', description: 'AI autonomously creates maintenance service windows.', checked: true, icon: Zap },
    { label: 'Neural Behavior Analysis', description: 'Advanced heuristic scoring for pilot safety metrics.', checked: true, icon: Brain },
    { label: 'Carbon Footprint Mitigation', description: 'Route optimization to minimize emission coefficients.', checked: true, icon: Globe },
  ])

  const toggleItem = (arr: Toggle[], setArr: (v: Toggle[]) => void, idx: number) => {
    const copy = [...arr]
    copy[idx] = { ...copy[idx], checked: !copy[idx].checked }
    setArr(copy)
  }

  const handleSave = async () => {
    setSaving(true)
    const { error } = await updateProfile(formData)
    setSaving(false)
    if (error) {
      toast.error('Synchronization Failed: Settings not persisted.')
    } else {
      toast.success('Core Protocols Updated: Settings synchronized successfully.')
    }
  }

  if (pLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
       <div className="relative">
          <div className="w-16 h-16 rounded-full border-t-2 border-primary animate-spin" />
          <SettingsIcon className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
       </div>
       <p className="text-[10px] font-black text-muted uppercase tracking-[0.4em] animate-pulse">Synchronizing Profiles...</p>
    </div>
  )

  return (
    <div className="space-y-10 page-enter pt-6 pb-20 max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-4">
             <SettingsIcon className="w-3.5 h-3.5" /> Terminal Config
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter text-white">System Settings</h1>
          <p className="text-muted text-sm font-bold mt-2 uppercase tracking-widest opacity-60">Global Fleet Preferences • Protocol Governance</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving} 
          className="btn-primary !px-10 !py-4 flex items-center gap-3 text-xs font-black uppercase tracking-widest shadow-gold group"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />}
          {saving ? 'Synchronizing...' : 'Save Configuration'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         
         {/* Navigation Sidebar */}
         <div className="lg:col-span-3 space-y-2">
            {[
              { id: 'profile', label: 'Identity & Access', icon: User },
              { id: 'notifications', label: 'Signal Protocols', icon: Bell },
              { id: 'ai', label: 'Neural Intelligence', icon: Sparkles },
              { id: 'billing', label: 'Billing Ledger', icon: Database },
            ].map(t => (
               <button 
                 key={t.id}
                 onClick={() => setTab(t.id as any)}
                 className={cn(
                   "w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-left group",
                   tab === t.id ? "bg-primary text-black shadow-gold" : "text-muted hover:text-white hover:bg-white/5"
                 )}
               >
                  <t.icon className="w-4.5 h-4.5" /> 
                  {t.label}
                  {tab === t.id && <ChevronRight className="w-4 h-4 ml-auto" />}
               </button>
            ))}

            <div className="pt-10 px-6">
                <div className="p-6 rounded-[32px] bg-primary/[0.03] border border-primary/20 text-center relative overflow-hidden group">
                   <div className="absolute -right-8 -bottom-8 w-20 h-20 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all" />
                   <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-gold">
                      <Shield className="w-5 h-5 text-black" />
                   </div>
                   <p className="text-[11px] font-black text-white uppercase mb-2">Protocol V2.4</p>
                   <p className="text-[8px] font-bold text-muted uppercase tracking-widest leading-relaxed">Encrypted Session Securely Managed by DriveMitra Core</p>
                </div>
            </div>
         </div>

         {/* Content Area */}
         <div className="lg:col-span-9">
            <AnimatePresence mode="wait">
               {tab === 'profile' && (
                 <motion.div 
                   key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                   className="space-y-8"
                 >
                    <div className="glass-card p-10 rounded-[40px] border border-white/5 bg-white/[0.01] shadow-premium relative overflow-hidden">
                       <div className="absolute -right-20 -top-20 w-60 h-60 bg-primary/5 rounded-full blur-[80px]" />
                       <div className="flex items-center gap-4 mb-10 pb-10 border-b border-white/5">
                          <User className="w-6 h-6 text-primary" />
                          <h2 className="text-xl font-display font-black text-white italic tracking-tighter uppercase">Identity Architecture</h2>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-4 italic">Collaborator Full Name</label>
                             <div className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 focus-within:border-primary/50 transition-all">
                                <User className="w-4 h-4 text-muted/40" />
                                <input 
                                  value={formData.full_name} 
                                  onChange={e => setFormData({...formData, full_name: e.target.value})} 
                                  className="bg-transparent border-none outline-none text-sm font-bold text-white w-full placeholder:text-muted/20"
                                  placeholder="Enter Pilot Identity"
                                />
                             </div>
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-4 italic">Registry Email (Non-editable)</label>
                             <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 rounded-2xl px-6 py-4 opacity-50 cursor-not-allowed">
                                <Mail className="w-4 h-4 text-muted/40" />
                                <input value={user?.email || ''} className="bg-transparent border-none outline-none text-sm font-bold text-white w-full" disabled />
                                <Lock className="w-3.5 h-3.5 text-muted" />
                             </div>
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-4 italic">Organization Cluster</label>
                             <div className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 focus-within:border-primary/50 transition-all">
                                <Building className="w-4 h-4 text-muted/40" />
                                <input 
                                  value={formData.company_name} 
                                  onChange={e => setFormData({...formData, company_name: e.target.value})} 
                                  className="bg-transparent border-none outline-none text-sm font-bold text-white w-full placeholder:text-muted/20"
                                  placeholder="Corporate Identity"
                                />
                             </div>
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-4 italic">Contact Protocol</label>
                             <div className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 focus-within:border-primary/50 transition-all">
                                <Phone className="w-4 h-4 text-muted/40" />
                                <input 
                                  value={formData.phone} 
                                  onChange={e => setFormData({...formData, phone: e.target.value})} 
                                  className="bg-transparent border-none outline-none text-sm font-bold text-white w-full placeholder:text-muted/20"
                                  placeholder="+91 System Line"
                                />
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="glass-card p-10 rounded-[40px] border border-white/5 bg-info/[0.02] shadow-premium flex gap-8">
                        <div className="w-16 h-16 rounded-[24px] bg-info/10 flex items-center justify-center flex-shrink-0 border border-info/20 shadow-lg">
                           <Shield className="w-8 h-8 text-info" />
                        </div>
                        <div>
                           <h3 className="text-xl font-display font-black text-white italic tracking-tighter uppercase mb-4">Privacy Sovereignty</h3>
                           <div className="space-y-3 text-[11px] font-medium text-muted/70 leading-relaxed italic">
                              <p>✓ Zero-Access Protocol: System never activates camera or audio sensors.</p>
                              <p>✓ Neural Inferencing: Behavior derived from velocity packets, not biometric surveillance.</p>
                              <p>✓ Row-Level Sovereignty: All fleet data isolated within your tenant stack.</p>
                           </div>
                        </div>
                    </div>
                 </motion.div>
               )}

               {(tab === 'notifications' || tab === 'ai') && (
                 <motion.div 
                   key={tab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                   className="space-y-6"
                 >
                    <div className="glass-card p-10 rounded-[40px] border border-white/5 bg-white/[0.01] shadow-premium">
                       <div className="flex items-center gap-4 mb-10 pb-10 border-b border-white/5">
                          {tab === 'notifications' ? <Bell className="w-6 h-6 text-primary" /> : <Sparkles className="w-6 h-6 text-primary" />}
                          <h2 className="text-xl font-display font-black text-white italic tracking-tighter uppercase">{tab === 'notifications' ? 'Communication Protocols' : 'AI Reasoning Configuration'}</h2>
                       </div>

                       <div className="space-y-4">
                          {(tab === 'notifications' ? notifications : aiSettings).map((item, idx) => (
                             <div key={item.label} className="flex items-center justify-between p-6 rounded-[28px] bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group">
                                <div className="flex items-center gap-6">
                                   <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border transition-all", item.checked ? "bg-primary/10 border-primary/20 text-primary" : "bg-white/5 border-white/10 text-muted/40")}>
                                      <item.icon className="w-6 h-6" />
                                   </div>
                                   <div>
                                      <p className={cn("text-sm font-black uppercase tracking-widest italic mb-1", item.checked ? "text-white" : "text-muted")}>{item.label}</p>
                                      <p className="text-[11px] font-medium text-muted/60 italic leading-relaxed">{item.description}</p>
                                   </div>
                                </div>
                                <button
                                  onClick={() => toggleItem(tab === 'notifications' ? notifications : aiSettings, tab === 'notifications' ? setNotifications : setAiSettings, idx)}
                                  className={cn("relative w-14 h-7 rounded-full transition-all duration-500 p-1", item.checked ? "bg-primary shadow-gold" : "bg-white/5 border border-white/10")}
                                >
                                   <div className={cn("w-5 h-5 rounded-full bg-white shadow-lg transition-transform duration-500", item.checked ? "translate-x-7" : "translate-x-0")} />
                                </button>
                             </div>
                          ))}
                       </div>
                    </div>
                 </motion.div>
               )}

               {tab === 'billing' && (
                 <motion.div 
                   key="billing" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                   className="space-y-8"
                 >
                    <div className="glass-card p-10 rounded-[40px] border border-primary/20 bg-primary/[0.03] shadow-premium relative overflow-hidden">
                       <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-primary/10 rounded-full blur-[100px]" />
                       <div className="flex items-center justify-between mb-10">
                          <div>
                             <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-2 italic">Subscription Protocol</p>
                             <h2 className="text-4xl font-display font-black text-white italic tracking-tighter uppercase">{profile?.subscription_plan || 'Propulsion Starter'}</h2>
                          </div>
                          <div className="px-6 py-2 rounded-full bg-success/20 border border-success/30 text-success text-[10px] font-black uppercase tracking-widest shadow-gold">Active Session</div>
                       </div>
                       
                       <div className="flex flex-col md:flex-row items-center gap-10 py-10 border-y border-white/10 mb-8">
                          <div className="flex-1 w-full">
                             <div className="flex justify-between text-[11px] font-black uppercase tracking-widest mb-4 italic">
                                <span className="text-muted">Node Allocation</span>
                                <span className="text-white">12 / 50 Active Units</span>
                             </div>
                             <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: '24%' }} transition={{ duration: 1.5 }} className="h-full bg-primary shadow-gold" />
                             </div>
                          </div>
                          <button className="w-full md:w-auto btn-primary !bg-white !text-black !px-10 !py-4 shadow-xl text-[10px] uppercase font-black tracking-widest transition-all hover:scale-105 active:scale-95">Upgrade Capacity</button>
                       </div>
                       <p className="text-[10px] font-bold text-muted/60 italic uppercase tracking-widest">Next Transaction Deployment: Feb 25, 2026 • ₹4,999</p>
                    </div>

                    <div className="glass-card p-10 rounded-[40px] border border-white/5 bg-white/[0.01] shadow-premium">
                       <h3 className="text-xl font-display font-black text-white italic tracking-tighter uppercase mb-8 flex items-center gap-4">
                          <CreditCard className="w-6 h-6 text-primary" /> Financial Registry
                       </h3>
                       <div className="space-y-4">
                          {[
                            { id: 'INV-2026-001', date: 'Feb 25, 2026', amount: '₹4,999', status: 'SYNCHRONIZED' },
                            { id: 'INV-2026-002', date: 'Jan 25, 2026', amount: '₹4,999', status: 'SYNCHRONIZED' },
                          ].map(inv => (
                            <div key={inv.id} className="flex items-center justify-between p-6 rounded-[28px] bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group">
                               <div className="flex items-center gap-8">
                                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-primary/10 transition-colors">
                                     <Database className="w-5 h-5 text-muted group-hover:text-primary transition-colors" />
                                  </div>
                                  <div>
                                     <p className="text-[10px] font-black text-white italic uppercase tracking-widest mb-1">{inv.id}</p>
                                     <p className="text-[9px] font-bold text-muted uppercase tracking-widest">{inv.date}</p>
                                  </div>
                               </div>
                               <div className="flex items-center gap-10">
                                  <p className="text-xl font-display font-black text-white italic tracking-tighter">{inv.amount}</p>
                                  <div className="flex items-center gap-3 text-success">
                                     <CheckCircle2 className="w-4 h-4 shadow-gold" />
                                     <span className="text-[10px] font-black uppercase tracking-widest">DOWNLOAD</span>
                                  </div>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                 </motion.div>
               )}
            </AnimatePresence>
         </div>
      </div>

    </div>
  )
}
