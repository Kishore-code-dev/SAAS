import { Bell, Search, Globe, Menu, LogOut, UserCog, Smartphone, Clock, Command } from 'lucide-react'
import { useFleet } from '../../hooks/useFleet'
import { useAuth } from '../../hooks/useAuth'
import { useTranslation, languageOptions } from '../../i18n/useTranslation'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

interface HeaderProps { onMenuToggle: () => void }

export default function Header({ onMenuToggle }: HeaderProps) {
  const { unreadAlertCount, userRole, setUserRole, setCurrentDriverId, alerts, searchTerm, setSearchTerm } = useFleet()
  const { user, signOut } = useAuth()
  const { t, language, setLanguage } = useTranslation()
  const navigate = useNavigate()
  
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showLang, setShowLang] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
    toast.success('Signed out successfully')
  }

  const recentAlerts = alerts.filter(a => !a.read).slice(0, 5)

  return (
    <header className="h-20 border-b border-white/5 flex items-center gap-6 px-8 flex-shrink-0 relative z-30 bg-background/50 backdrop-blur-xl">
      {/* Search Bar / CMD+K */}
      <div className="flex-1 max-w-xl group">
        <div className={`relative flex items-center transition-all duration-300 ${isSearchFocused ? 'scale-[1.02]' : ''}`}>
          <Search className={`absolute left-4 w-4 h-4 transition-colors ${isSearchFocused ? 'text-primary' : 'text-muted'}`} />
          <input 
            type="text"
            placeholder="Search anything... (CMD+K)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 pl-12 pr-16 text-sm text-white placeholder:text-muted/40 outline-none focus:border-primary/50 focus:bg-white/[0.05] transition-all"
          />
          <div className="absolute right-4 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black text-muted uppercase tracking-widest pointer-events-none">
            <Command className="w-3 h-3" /> K
          </div>
        </div>
      </div>

      <div className="flex-1" />

      {/* Mission Clock */}
      <div className="hidden lg:flex flex-col items-end gap-0.5">
         <div className="flex items-center gap-2 text-[13px] font-black text-white tracking-widest">
            <Clock className="w-3.5 h-3.5 text-primary shadow-gold" />
            {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
         </div>
         <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">
            {currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
         </p>
      </div>

      <div className="h-8 w-px bg-white/10 hidden lg:block" />

      {/* Control Buttons */}
      <div className="flex items-center gap-3">
        {/* Language */}
        <div className="relative">
          <button 
            onClick={() => { setShowLang(!showLang); setShowAlerts(false); setShowUser(false) }}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${showLang ? 'bg-primary text-black' : 'bg-white/5 text-muted hover:text-white hover:bg-white/10 border border-white/5'}`}
          >
            <Globe className="w-5 h-5" />
          </button>
          <AnimatePresence>
            {showLang && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute right-0 top-full mt-3 glass-card rounded-[20px] p-1.5 z-50 min-w-[200px] shadow-premium border-white/10 bg-black/90 backdrop-blur-3xl"
              >
                {languageOptions.map(lang => (
                  <button key={lang.code}
                    onClick={() => { setLanguage(lang.code); setShowLang(false) }}
                    className={`w-full text-left px-4 py-3 rounded-xl text-xs flex items-center justify-between transition-all ${language === lang.code ? 'bg-primary/10 text-primary font-black' : 'hover:bg-white/5 text-muted hover:text-white'}`}
                  >
                    <span>{lang.nativeLabel}</span>
                    <span className="text-[10px] opacity-40 uppercase tracking-widest">{lang.code}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => { setShowAlerts(!showAlerts); setShowLang(false); setShowUser(false) }}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 relative ${showAlerts ? 'bg-primary text-black' : 'bg-white/5 text-muted hover:text-white hover:bg-white/10 border border-white/5'}`}
          >
            <Bell className="w-5 h-5" />
            {unreadAlertCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 rounded-full bg-danger text-[10px] font-black flex items-center justify-center px-1 text-white border-2 border-background animate-pulse shadow-gold">
                {unreadAlertCount}
              </span>
            )}
          </button>
          <AnimatePresence>
            {showAlerts && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute right-0 top-full mt-3 glass-card rounded-[24px] z-50 w-[360px] shadow-premium border-white/10 bg-black/90 backdrop-blur-3xl overflow-hidden"
              >
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Alert Signals</h3>
                  <span className="text-[10px] font-black text-danger uppercase tracking-widest bg-danger/10 px-2 py-1 rounded-lg">Real-Time</span>
                </div>
                <div className="max-h-[400px] overflow-y-auto scrollbar-none">
                  {recentAlerts.length === 0 ? (
                    <div className="p-10 text-center">
                       <ShieldCheck className="w-10 h-10 text-muted/20 mx-auto mb-4" />
                       <p className="text-xs text-muted font-bold">Network Secure. No active alerts.</p>
                    </div>
                  ) : (
                    recentAlerts.map(a => (
                      <div key={a.id} className="p-5 hover:bg-white/5 transition-all border-b border-white/[0.02] group cursor-pointer">
                        <div className="flex items-start gap-4">
                           <div className="w-2 h-2 rounded-full mt-1.5 bg-danger shadow-gold" />
                           <div>
                              <p className="text-[13px] font-bold text-white/90 leading-tight mb-2 group-hover:text-primary transition-colors">{a.message}</p>
                              <p className="text-[10px] text-muted font-black uppercase tracking-[0.2em]">
                                {new Date(a.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} • MISSION HUB
                              </p>
                           </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <button 
                  onClick={() => navigate('/dashboard/alerts')}
                  className="w-full p-4 text-[10px] font-black uppercase tracking-[0.3em] text-primary hover:bg-primary/5 transition-all border-t border-white/5"
                >
                  Enter Alert Command Center
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
