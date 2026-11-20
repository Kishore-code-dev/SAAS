import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Plus, Receipt, Camera, Loader2, X, AlertCircle, Info } from 'lucide-react'
import { toast } from 'sonner'

export default function DriverExpenses() {
  const { user } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    toast.info('Expense tracking is not yet available in the driver app. Use the web dashboard for expense management.')
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#625346]">Expenses</h1>
          <p className="text-sm text-[#958777]">Expense tracking - coming soon</p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#BAE6FD] flex items-center justify-center">
            <Info className="w-5 h-5 text-[#0369A1]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#0369A1]">Expense Management</h3>
            <p className="text-sm text-[#0369A1] mt-1">
              Driver expense submission is currently available on the web dashboard. 
              Please use the desktop version to submit tolls, parking, meals, and other trip expenses.
            </p>
            <p className="text-xs text-[#0369A1] mt-2">
              This mobile feature will be available in a future update with receipt capture and offline sync.
            </p>
          </div>
        </div>
      </div>

      {/* Placeholder for future expenses list */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center">
        <Receipt className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
        <h3 className="font-semibold text-[#625346]">No Expenses Tracked</h3>
        <p className="text-sm text-[#958777] mt-1">Expense tracking will appear here when available</p>
      </div>
    </div>
  )
}