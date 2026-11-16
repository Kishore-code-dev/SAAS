import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import FleetCopilotDrawer from '../ai/FleetCopilotDrawer'
import { useFleet } from '../../hooks/useFleet'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const { environment, activeOrganization } = useFleet()

  return (
    <div className="min-h-screen bg-[#F7F0D9] text-[#625346] flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          onOpenCopilot={() => setCopilotOpen(true)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          <Outlet key={`${environment}:${activeOrganization.id}`} />
        </main>
      </div>
      <FleetCopilotDrawer open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  )
}
