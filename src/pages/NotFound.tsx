import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, LayoutDashboard } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center p-6">
      <div className="enterprise-card max-w-lg w-full p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-[#E8C65A]/30 border border-[#D8B442] text-[#A56021] flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <p className="text-xs font-semibold text-[#958777] uppercase tracking-wide">404 · Route Not Found</p>
        <h1 className="dm-section-title mt-1">
          Requested page is unavailable
        </h1>
        <p className="text-sm text-[#958777] mt-2">
          The requested fleet route does not exist or may have moved to the Command Centre structure.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <Link to="/dashboard" className="btn-primary">
            <LayoutDashboard className="w-4 h-4" />
            Fleet Command Centre
          </Link>
        </div>
      </div>
    </div>
  )
}

