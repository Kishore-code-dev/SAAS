import React, { useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { usePWAInstall } from '../../hooks/usePWAInstall'

export function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall()
  const [showIOSGuide, setShowIOSGuide] = useState(false)

  if (isInstalled) {
    return null
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        aria-label="Install DriveMitra App"
        className={`inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-[#6E5696] hover:bg-[#5E4784] text-white font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
          compact ? 'px-2.5 text-xs' : 'px-3.5 py-2 text-xs'
        }`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>{compact ? 'Install' : 'Install App'}</span>
      </button>
    )
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Install on iPhone or iPad"
          className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-[#DDD3ED] bg-[#EEE8F7] px-3 py-1.5 text-xs font-semibold text-[#6E5696] hover:bg-[#E4DAF4] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <Share className="w-3.5 h-3.5" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#625346]/40 backdrop-blur-xs p-0 sm:p-4">
            <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-[#FFFFFF] border border-[#E5E5E5] p-6 shadow-elevated space-y-4">
              <div className="w-10 h-1 bg-[#E5E5E5] rounded-full mx-auto sm:hidden" />
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#625346]">Install DriveMitra App</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install instructions"
                  className="p-2 rounded-lg text-[#958777] hover:bg-[#FAFAFA]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="text-xs text-[#625346] space-y-2 leading-relaxed">
                <li>1. Tap the <strong>Share</strong> icon in the Safari toolbar.</li>
                <li>2. Scroll down and select <strong>Add to Home Screen</strong>.</li>
                <li>3. Open DriveMitra directly from your home screen in standalone app mode.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="btn-primary w-full py-2.5 text-xs"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  return null
}
