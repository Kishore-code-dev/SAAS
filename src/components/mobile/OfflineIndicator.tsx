import React from 'react'
import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../../hooks/usePWAInstall'

export function OfflineIndicator() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl bg-[#FCF5DE] border border-[#D8B442] px-3.5 py-2 text-xs font-semibold text-[#625346] shadow-card whitespace-nowrap"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#A56021]" />
      <span>Offline Mode · Queuing actions locally</span>
    </div>
  )
}
