import { motion } from 'framer-motion'
import { Truck, Navigation, Shield, Activity, Zap, Brain } from 'lucide-react'

const Y = 'rgb(255,204,0)'

export default function HeroVisual() {
  return (
    <div className="relative w-full h-[600px] flex items-center justify-center pointer-events-none perspective-[1000px]">
      {/* Central Hub */}
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="relative z-20 w-32 h-32 rounded-[40px] bg-gradient-to-br from-[#1a1a1a] to-black border border-white/10 flex items-center justify-center shadow-2xl glow-yellow"
      >
        <div className="absolute inset-0 rounded-[40px] bg-primary/10 animate-pulse" />
        <Truck className="w-16 h-16 text-primary" />
        
        {/* Orbital Rings */}
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={{ rotate: 360 }}
            transition={{ duration: 10 + i * 5, repeat: Infinity, ease: "linear" }}
            className="absolute rounded-full border border-white/5"
            style={{
              width: `${160 + i * 120}px`,
              height: `${160 + i * 120}px`,
            }}
          />
        ))}
      </motion.div>

      {/* Floating Nodes */}
      {[
        { Icon: Navigation, label: 'GPS', delay: 0.2, x: -200, y: -150 },
        { Icon: Shield, label: 'Alerts', delay: 0.5, x: 220, y: -80 },
        { Icon: Activity, label: 'Safety', delay: 0.8, x: -180, y: 120 },
        { Icon: Zap, label: 'Live', delay: 1.1, x: 200, y: 150 },
        { Icon: Brain, label: 'AI', delay: 1.4, x: 0, y: -250 },
      ].map((node, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: node.delay, duration: 0.8, type: "spring" }}
          className="absolute z-30"
          style={{ x: node.x, y: node.y }}
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
            className="flex flex-col items-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-black/80 border border-white/10 flex items-center justify-center backdrop-blur-xl shadow-xl group cursor-pointer hover:border-primary/50 transition-colors pointer-events-auto">
              <node.Icon className="w-6 h-6 text-primary" />
            </div>
            <span className="mt-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{node.label}</span>
          </motion.div>
          
          {/* Connection Line */}
          <motion.div 
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: node.delay + 0.5, duration: 1 }}
            className="absolute top-1/2 left-1/2 w-[1px] bg-gradient-to-t from-primary/30 to-transparent origin-bottom"
            style={{ 
              height: Math.sqrt(node.x * node.x + node.y * node.y) - 60,
              transform: `rotate(${Math.atan2(node.x, -node.y) * 180 / Math.PI}deg) translate(-50%, -100%)`,
              left: 0, top: 0
            }}
          />
        </motion.div>
      ))}

      {/* Particles/Data Dots */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-primary/40 rounded-full"
          initial={{ 
            x: (Math.random() - 0.5) * 800, 
            y: (Math.random() - 0.5) * 600,
            opacity: 0 
          }}
          animate={{ 
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
          }}
          transition={{ 
            duration: 3 + Math.random() * 4, 
            repeat: Infinity, 
            delay: Math.random() * 5 
          }}
        />
      ))}
      
      {/* Radial Glow */}
      <div className="absolute inset-0 bg-radial-gold opacity-10 blur-[100px]" />
    </div>
  )
}
