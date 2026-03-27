import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFleet } from '../hooks/useFleet'
import { useTranslation, languageOptions } from '../i18n/useTranslation'
import { toast } from 'sonner'
import {
  Truck, Eye, EyeOff, ArrowRight, Shield, Zap,
  Phone, UserCog, Globe, Activity, Upload, CheckCircle, CreditCard, Mail, Loader2,
  ChevronRight, Languages, Check, Fingerprint, ShieldCheck, ZapOff
} from 'lucide-react'
import { cn } from '../lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export default function Auth() {
  const { signIn } = useAuth()
  const { setUserRole, setCurrentDriverId } = useFleet()
  const { t, language, setLanguage } = useTranslation()
  const navigate = useNavigate()

  const [role, setRole] = useState<'admin' | 'driver'>('admin')
  const [step, setStep] = useState<'language' | 'auth'>('language')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  
  const [adminLoginForm, setAdminLoginForm] = useState({ email: '', password: '' })
  const [driverMobile, setDriverMobile] = useState('')
  const [driverOtp, setDriverOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  // Skip language step if already set in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dm_language')
    if (saved) setStep('auth')
  }, [])

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Simulate auth for luxury feel
    setTimeout(async () => {
      const { error } = await signIn(adminLoginForm.email, adminLoginForm.password)
      if (error) {
        toast.error('Identity Verification Failed')
      } else {
        setUserRole('admin')
        navigate('/dashboard')
        toast.success(`Nexus Authorized. Welcome back.`)
      }
      setLoading(false)
    }, 1500)
  }

  const handleDriverOTPSend = () => {
    if (!driverMobile || driverMobile.length < 10) { toast.error('Standard Mobile Identification Required'); return }
    setOtpSent(true)
    toast.success('Frequency Code Transmitted')
  }

  const handleDriverOTPVerify = () => {
    if (driverOtp === '000000' || driverOtp.length === 6) {
      setUserRole('driver')
      setCurrentDriverId('d001')
      navigate('/driver')
      toast.success('Pilot Link Sycnrhonized')
    } else {
      toast.error('Sync Decryption Failed')
    }
  }

  const handleDemoLogin = (demoRole: 'admin' | 'driver') => {
    setUserRole(demoRole)
    if (demoRole === 'driver') { setCurrentDriverId('d001'); navigate('/driver') }
    else navigate('/dashboard')
    toast.success(`Demo Access: Authorized as ${demoRole.toUpperCase()}`)
  }

  return (
    <div className="min-h-screen flex items-stretch bg-background selection:bg-primary/30 overflow-hidden">
      
      {/* Brand Side (Elite Branding) */}
      <div className="hidden lg:flex w-[45%] flex-col relative overflow-hidden bg-black border-r border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_50%,rgba(245,197,24,0.1),transparent_60%)]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05] contrast-150" />
        
        {/* Animated Brand Background */}
        <motion.div 
           className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] opacity-[0.03] pointer-events-none"
        />

        <div className="relative z-10 p-16">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-5"
          >
            <div className="w-16 h-16 rounded-[22px] bg-black border border-primary/20 shadow-gold flex items-center justify-center p-[1px]">
               <Truck className="w-8 h-8 text-primary shadow-gold" />
            </div>
            <div>
              <h2 className="font-display font-black text-4xl tracking-tighter text-white">DriveMitra</h2>
              <p className="text-[10px] text-primary font-black uppercase tracking-[0.4em] mt-1 opacity-80">Precision Intelligence</p>
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center px-24">
           <motion.div
             initial={{ opacity: 0, y: 30 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.8, delay: 0.2 }}
           >
              <h1 className="text-8xl font-display font-black text-white leading-[0.85] tracking-tighter mb-10">
                 The Command <br />
                 <span className="text-gradient-gold drop-shadow-2xl">Interface.</span>
              </h1>
              <p className="text-muted text-xl font-medium max-w-sm mb-16 leading-relaxed border-l-2 border-primary/20 pl-8">
                 Enter the nexus of predictive logistics and neural fleet telemetry.
              </p>
           </motion.div>

           <div className="space-y-10">
              {[
                { icon: ShieldCheck, title: 'Strategic Security', label: 'E2E encrypted asset nodes' },
                { icon: Activity, title: 'Neural Telemetry', label: 'Real-time behavior inference' },
                { icon: Fingerprint, title: 'Biometric Integrity', label: 'Mission-critical access control' },
              ].map((f, i) => (
                <motion.div 
                   key={i}
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: 0.4 + (i * 0.1) }}
                   className="flex items-center gap-6 group cursor-default"
                >
                   <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/30 transition-all duration-500">
                      <f.icon className="w-5 h-5 text-muted group-hover:text-primary transition-colors" />
                   </div>
                   <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-widest mb-1">{f.title}</h4>
                      <p className="text-[10px] text-muted font-bold uppercase tracking-widest opacity-60">{f.label}</p>
                   </div>
                </motion.div>
              ))}
           </div>
        </div>

        <div className="relative z-10 p-16 border-t border-white/5 flex items-center gap-16">
           <div>
              <p className="text-[10px] text-muted font-black uppercase tracking-[0.4em] mb-2">Protocol Status</p>
              <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-gold" />
                 <span className="text-sm font-black text-white uppercase tracking-tighter">Operational</span>
              </div>
           </div>
           <div>
              <p className="text-[10px] text-muted font-black uppercase tracking-[0.4em] mb-2">Network Layer</p>
              <span className="text-sm font-black text-white uppercase tracking-tighter">Hyper-Converged</span>
           </div>
        </div>
      </div>

      {/* Auth Side (The Terminal) */}
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-[#0A0A0A] relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(245,197,24,0.03),transparent_50%)]" />
        
        <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="w-full max-w-[480px] relative z-10"
        >
           <AnimatePresence mode="wait">
             {step === 'language' ? (
               <motion.div 
                 key="lang"
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -20 }}
                 className="space-y-12"
               >
                  <div className="text-center">
                     <div className="w-24 h-24 rounded-[36px] bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-8 shadow-gold">
                        <Languages className="w-12 h-12 text-primary shadow-gold" />
                     </div>
                     <h2 className="text-4xl font-display font-black text-white tracking-tight mb-4 uppercase leading-none">Initiate Terminal</h2>
                     <p className="text-muted text-xs font-black uppercase tracking-[0.3em]">Select Command Language</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     {languageOptions.map(l => (
                       <button 
                         key={l.code}
                         onClick={() => setLanguage(l.code)}
                         className={cn(
                           "p-8 rounded-[36px] border text-left transition-all duration-300 relative group overflow-hidden",
                           language === l.code ? "bg-primary border-primary shadow-gold" : "bg-white/[0.02] border-white/5 hover:border-white/20"
                         )}
                       >
                          <span className={cn("block text-2xl font-black mb-1", language === l.code ? "text-black" : "text-white")}>{l.nativeLabel}</span>
                          <span className={cn("text-[10px] font-black uppercase tracking-widest opacity-60", language === l.code ? "text-black" : "text-muted")}>{l.label}</span>
                          {language === l.code && <Check className="absolute top-4 right-4 w-5 h-5 text-black" />}
                       </button>
                     ))}
                  </div>

                  <button 
                    onClick={() => { localStorage.setItem('dm_language', language); setStep('auth'); }}
                    className="w-full btn-primary !py-7 !rounded-[36px] !text-sm uppercase tracking-[0.3em] shadow-gold group"
                  >
                    Confirm Configuration <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                  </button>
               </motion.div>
             ) : (
               <motion.div 
                 key="auth"
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="space-y-10"
               >
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-gold" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Network Active</span>
                     </div>
                     <button onClick={() => setStep('language')} className="text-[10px] font-black text-muted hover:text-primary transition-colors uppercase tracking-[0.2em] flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5" /> Language Config
                     </button>
                  </div>

                  {/* Role Switcher */}
                  <div className="p-2 bg-white/[0.02] border border-white/5 rounded-[40px] flex gap-2">
                     {[
                       { id: 'admin', label: 'Command Hub', icon: UserCog },
                       { id: 'driver', label: 'Pilot Terminal', icon: Truck },
                     ].map(r => (
                       <button 
                         key={r.id}
                         onClick={() => setRole(r.id as any)}
                         className={cn(
                           "flex-1 flex items-center justify-center gap-3 py-5 rounded-[32px] text-[10px] font-black uppercase tracking-widest transition-all",
                           role === r.id ? "bg-white text-black shadow-2xl scale-[1.02]" : "text-muted hover:text-white"
                         )}
                       >
                         <r.icon className="w-4 h-4" /> {r.label}
                       </button>
                     ))}
                  </div>

                  {/* Form Surface */}
                  <div className="glass-card p-12 rounded-[48px] border-white/5 bg-white/[0.01] shadow-premium relative overflow-hidden group">
                     <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-10 transition-opacity" />
                     
                     {role === 'admin' ? (
                       <form onSubmit={handleAdminSignIn} className="space-y-8">
                          <div>
                             <h3 className="text-3xl font-display font-black text-white tracking-tight mb-2 uppercase italic leading-none">Nexus Admin</h3>
                             <p className="text-muted text-[10px] font-black uppercase tracking-[0.3em]">Secure Identity Verification</p>
                          </div>
                          
                          <div className="space-y-6">
                             <div>
                                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-3 ml-2">Access Key (Email)</label>
                                <input 
                                  type="email" 
                                  required
                                  value={adminLoginForm.email}
                                  onChange={e => setAdminLoginForm(p => ({ ...p, email: e.target.value }))}
                                  className="dm-input !bg-black !py-6 !px-8 !text-lg !rounded-[24px]"
                                  placeholder="admin@nexus.fleet"
                                />
                             </div>
                             <div>
                                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-3 ml-2">Encryption Key</label>
                                <div className="relative">
                                   <input 
                                     type={showPw ? 'text' : 'password'} 
                                     required
                                     value={adminLoginForm.password}
                                     onChange={e => setAdminLoginForm(p => ({ ...p, password: e.target.value }))}
                                     className="dm-input !bg-black !py-6 !pl-8 !pr-20 !text-lg !rounded-[24px]"
                                     placeholder="••••••••"
                                   />
                                   <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-6 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors">
                                      {showPw ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                                   </button>
                                </div>
                             </div>
                             <button type="submit" disabled={loading} className="w-full btn-primary !py-7 !rounded-[28px] !text-sm uppercase tracking-[0.4em] shadow-gold group mt-4">
                                {loading ? <Loader2 className="animate-spin w-6 h-6" /> : "Initiate Verification"}
                             </button>
                          </div>
                       </form>
                     ) : (
                       <div className="space-y-8">
                          <div>
                             <h3 className="text-3xl font-display font-black text-white tracking-tight mb-2 uppercase italic leading-none">Pilot Sync</h3>
                             <p className="text-muted text-[10px] font-black uppercase tracking-[0.3em]">Telemetry Identification</p>
                          </div>

                          <div className="space-y-6">
                             <div>
                                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-3 ml-2">Pilot Frequency (Mobile)</label>
                                <div className="relative">
                                   <div className="absolute left-6 top-1/2 -translate-y-1/2 text-primary font-black text-lg pr-6 border-r border-white/10">+91</div>
                                   <input 
                                     type="tel" 
                                     value={driverMobile}
                                     onChange={e => setDriverMobile(e.target.value)}
                                     maxLength={10}
                                     className="dm-input !bg-black !py-6 !pl-24 !pr-6 !text-lg !rounded-[24px] tracking-widest"
                                     placeholder="00000 00000"
                                   />
                                </div>
                             </div>
                             
                             {otpSent && (
                               <motion.div 
                                 initial={{ opacity: 0, scale: 0.9 }} 
                                 animate={{ opacity: 1, scale: 1 }}
                                 className="space-y-3"
                               >
                                  <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-3 ml-2">Transmission Code</label>
                                  <input 
                                    type="text" 
                                    maxLength={6}
                                    value={driverOtp}
                                    onChange={e => setDriverOtp(e.target.value)}
                                    className="dm-input !bg-black !py-7 !text-2xl !tracking-[1em] text-center !rounded-[24px]"
                                    placeholder="••••••"
                                  />
                               </motion.div>
                             )}

                             <button 
                               onClick={otpSent ? handleDriverOTPVerify : handleDriverOTPSend}
                               className="w-full btn-primary !py-7 !rounded-[28px] !text-sm uppercase tracking-[0.4em] shadow-gold group mt-4"
                             >
                               {otpSent ? "Authorize Uplink" : "Transmit Signal"}
                             </button>
                          </div>
                       </div>
                     )}
                  </div>

                  {/* Fast Action Demos */}
                  <div className="pt-4 space-y-6">
                     <div className="flex items-center gap-6">
                        <div className="h-px flex-1 bg-white/5" />
                        <span className="text-[9px] font-black text-muted uppercase tracking-[0.4em]">Rapid Nexus Access</span>
                        <div className="h-px flex-1 bg-white/5" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => handleDemoLogin('admin')} className="py-4 rounded-[20px] bg-white/[0.02] border border-white/5 text-[9px] font-black text-muted uppercase tracking-widest hover:bg-white/5 hover:text-primary transition-all flex items-center justify-center gap-3">
                           <UserCog className="w-4 h-4" /> Admin Demo
                        </button>
                        <button onClick={() => handleDemoLogin('driver')} className="py-4 rounded-[20px] bg-white/[0.02] border border-white/5 text-[9px] font-black text-muted uppercase tracking-widest hover:bg-white/5 hover:text-primary transition-all flex items-center justify-center gap-3">
                           <Truck className="w-4 h-4" /> Pilot Demo
                        </button>
                     </div>
                  </div>
               </motion.div>
             )}
           </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
