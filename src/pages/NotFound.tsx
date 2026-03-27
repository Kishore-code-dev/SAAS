import { Link } from 'react-router-dom'
import { Home, Zap, Truck, AlertTriangle, ChevronRight, Activity, Terminal } from 'lucide-react'
import { motion } from 'framer-motion'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] text-center page-enter bg-[#0A0A0A] rounded-[56px] m-10 border border-white/5 shadow-3xl overflow-hidden relative group">
      
      {/* Background kinetic effect */}
      <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[160px] animate-pulse" />
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
      </div>
      
      <div className="relative z-10 p-12 max-w-2xl">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 rounded-[32px] bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-10 shadow-gold group-hover:rotate-12 transition-transform duration-700"
        >
          <AlertTriangle className="w-12 h-12 text-primary shadow-gold animate-pulse" />
        </motion.div>

        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-[11px] font-black text-primary uppercase tracking-[0.6em] mb-4 italic"
        >
          Protocol Sync Error: 404
        </motion.p>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="font-display text-7xl md:text-9xl font-black text-white mb-8 tracking-tighter italic leading-none"
        >
          Route <span className="text-primary group-hover:line-through transition-all capitalize">Lost.</span>
        </motion.h1>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-center gap-4 mb-10 pb-10 border-b border-white/5 max-w-md mx-auto"
        >
            <div className="w-1.5 h-1.5 rounded-full bg-danger animate-ping shadow-lg" />
            <p className="text-muted text-sm font-bold uppercase tracking-widest italic leading-relaxed opacity-60">
              The intelligence layer encountered a logic break. Requested endpoint does not exist in the current fleet node.
            </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
           <Link to="/dashboard" className="w-full sm:w-auto">
             <button className="w-full btn-primary !px-12 !py-5 flex items-center justify-center gap-4 text-xs font-black uppercase tracking-widest shadow-gold group/btn italic">
               <Terminal className="w-5 h-5 group-hover/btn:rotate-12 transition-transform" />
               Re-synchronize Terminal
             </button>
           </Link>
           <button 
             onClick={() => window.history.back()}
             className="w-full sm:w-auto px-12 py-5 rounded-[28px] border border-white/10 bg-white/[0.02] text-muted hover:text-white hover:bg-white/5 transition-all text-[10px] font-black uppercase tracking-widest italic flex items-center justify-center gap-3"
           >
              Previous Packet <ChevronRight className="w-4 h-4" />
           </button>
        </motion.div>
      </div>

      {/* Terminal decorative text */}
      <div className="absolute bottom-10 left-10 text-[9px] font-black text-white/10 uppercase tracking-[0.4em] italic pointer-events-none">
         Node ID: DM-ERROR-MATRIX-0x404
      </div>
      <div className="absolute top-10 right-10 flex items-center gap-4 opacity-20 group-hover:opacity-40 transition-opacity">
         <Activity className="w-4 h-4 text-primary" />
         <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-primary animate-progress-flow" style={{ width: '40%' }} />
         </div>
      </div>
    </div>
  )
}
