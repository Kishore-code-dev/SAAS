import React, { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import FleetCopilotDrawer from '../ai/FleetCopilotDrawer'
import AddVehicleDialog from '../vehicles/AddVehicleDialog'
import { useFleet } from '../../hooks/useFleet'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [addVehicleOpen, setAddVehicleOpen] = useState(false)
  const { environment, activeOrganization, activeRole } = useFleet()
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#625346] flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 bg-[#FFFFFF]">
        <Header
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          onOpenCopilot={() => setCopilotOpen(true)}
          onAddVehicle={() => setAddVehicleOpen(true)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto bg-[#FFFFFF]">
          <Outlet key={`${environment}:${activeOrganization.id}`} />
        </main>
      </div>
      <FleetCopilotDrawer
        key={`${environment}:${activeOrganization.id}:${activeRole}`}
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
      />
      <AddVehicleDialog open={addVehicleOpen} onClose={() => setAddVehicleOpen(false)} />
    </div>
  )
}
