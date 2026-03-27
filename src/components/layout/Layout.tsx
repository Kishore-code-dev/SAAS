import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  return (
    <div className="flex h-screen bg-[#080808] overflow-hidden selection:bg-primary/30 relative font-sans antialiased text-white">
      
      {/* Cinematic Overlays */}
      <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.03] mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.15] mix-blend-soft-light bg-[radial-gradient(circle_at_50%_50%,rgba(245,197,24,0.05),transparent_70%)]" />

      {/* Sidebar Command Console */}
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      {/* Main Viewport */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
        
        {/* Top Intelligence Hub */}
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        
        {/* Unified Mission Surface */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 sm:p-10 scrollbar-none custom-scrollbar relative">
          <div className="max-w-[1700px] mx-auto min-h-full flex flex-col relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 15, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 1.01 }}
                transition={{ 
                  duration: 0.5, 
                  ease: [0.16, 1, 0.3, 1] 
                }}
                className="flex-1 flex flex-col"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Logic Footer (Subtle) */}
          <div className="mt-auto pt-20 pb-10 text-center opacity-10 pointer-events-none">
             <p className="text-[9px] font-black uppercase tracking-[0.8em]">DriveMitra Neural Core V2.4 • Mission Hub Status: Online</p>
          </div>
        </main>
      </div>
    </div>
  )
}
