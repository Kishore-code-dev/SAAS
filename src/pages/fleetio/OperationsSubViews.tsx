import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, BellRing, Hammer, Plus, ShieldAlert, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '../../components/layout/PageHeader'
import { EnterpriseModal, formatShortDate, SeverityText } from '../../components/ui/EnterprisePrimitives'
import { useFleet } from '../../hooks/useFleet'
import {
  buildDefaultTools,
  loadScopedStorage,
  saveScopedStorage,
  type FleetToolItem,
} from '../../utils/fleetioConfigStore'
import { classifyComplianceExpiryTier } from '../../utils/intelligenceEngine'
import { canPerformAction } from '../../utils/rbac'
import type { FiveAreaHealthCategory } from '../../types/fleet'

export function ToolsHubView({ tab }: { tab: 'list' | 'service' | 'reminders' }) {
  const { activeOrganization, activeRole } = useFleet()
  const [tools, setTools] = useState<FleetToolItem[]>(() =>
    loadScopedStorage(activeOrganization.id, 'tools', buildDefaultTools(activeOrganization.city)),
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    serialNumber: '',
    category: 'Workshop Diagnostics',
    assignedTo: 'Workshop Bay 1',
    location: `${activeOrganization.city} Main Depot`,
    purchaseCostInr: 12000,
    nextCalibrationDate: '2027-06-30',
  })

  const canManage = canPerformAction(activeRole, 'manage_inventory') || canPerformAction(activeRole, 'schedule_maintenance')

  const handleAddTool = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.serialNumber.trim()) {
      toast.error('Tool name and serial number are required.')
      return
    }
    const next: FleetToolItem[] = [
      {
        id: `tool-${Date.now()}`,
        name: form.name.trim(),
        serialNumber: form.serialNumber.trim().toUpperCase(),
        category: form.category,
        assignedTo: form.assignedTo.trim(),
        location: form.location.trim(),
        status: 'in_service',
        purchaseCostInr: Number(form.purchaseCostInr) || 0,
        nextCalibrationDate: form.nextCalibrationDate,
      },
      ...tools,
    ]
    setTools(next)
    saveScopedStorage(activeOrganization.id, 'tools', next)
    toast.success(`Added tool ${form.name.trim()} to equipment inventory.`)
    setModalOpen(false)
    setForm((f) => ({ ...f, name: '', serialNumber: '' }))
  }

  const title =
    tab === 'service'
      ? 'Tool Service & Calibration Entries'
      : tab === 'reminders'
        ? 'Tool Calibration Reminders'
        : 'Tools & Workshop Equipment'

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={`${activeOrganization.name} · Track diagnostic scanners, hydraulic jacks, EV tools, and calibration schedules`}
      >
        {canManage && (
          <button type="button" onClick={() => setModalOpen(true)} className="btn-primary text-xs">
            <Plus className="w-4 h-4" />
            Add Tool
          </button>
        )}
      </PageHeader>

      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Category</th>
                <th>Assigned To / Location</th>
                <th>Status</th>
                <th>Next Calibration</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.id}>
                  <td>
                    <span className="font-semibold flex items-center gap-1.5">
                      <Hammer className="w-3.5 h-3.5 text-[#1F7A4C]" />
                      {tool.name}
                    </span>
                    <span className="text-xs text-[#958777]">{tool.serialNumber}</span>
                  </td>
                  <td>{tool.category}</td>
                  <td>
                    <span className="block font-medium">{tool.assignedTo}</span>
                    <span className="text-xs text-[#958777]">{tool.location}</span>
                  </td>
                  <td>
                    <SeverityText
                      severity={tool.status === 'maintenance' ? 'high' : 'normal'}
                      label={tool.status.replace('_', ' ')}
                    />
                  </td>
                  <td className="tabular-nums text-xs">{formatShortDate(tool.nextCalibrationDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <EnterpriseModal open={modalOpen} onClose={() => setModalOpen(false)} title="Register Workshop Tool">
        <form onSubmit={handleAddTool} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="tool-name" className="dm-label">Tool Name</label>
              <input
                id="tool-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Torque Wrench 1000 Nm"
                className="dm-input"
                required
              />
            </div>
            <div>
              <label htmlFor="tool-serial" className="dm-label">Serial Number</label>
              <input
                id="tool-serial"
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                placeholder="DM-TQ-900"
                className="dm-input"
                required
              />
            </div>
            <div>
              <label htmlFor="tool-assigned" className="dm-label">Assigned To</label>
              <input
                id="tool-assigned"
                value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                className="dm-input"
              />
            </div>
            <div>
              <label htmlFor="tool-cal" className="dm-label">Next Calibration Date</label>
              <input
                id="tool-cal"
                type="date"
                value={form.nextCalibrationDate}
                onChange={(e) => setForm({ ...form, nextCalibrationDate: e.target.value })}
                className="dm-input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Save Tool</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}

export function IssuesHubView({ mode }: { mode: 'issues' | 'recalls' }) {
  const navigate = useNavigate()
  const { activeOrganization, activeRole, vehicles, smallIssues, addSmallIssue, convertIssueToWorkOrder } = useFleet()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    vehicleId: vehicles[0]?.id ?? '',
    title: '',
    description: '',
    healthArea: 'Vehicle Health' as FiveAreaHealthCategory,
    severity: 'high' as 'low' | 'medium' | 'high' | 'critical',
  })

  const canReport = canPerformAction(activeRole, 'report_issue') || canPerformAction(activeRole, 'edit_vehicle')
  const canWo = canPerformAction(activeRole, 'manage_work_orders')

  const handleCreateIssue = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    addSmallIssue({
      vehicleId: form.vehicleId || vehicles[0]?.id || '',
      title: form.title.trim(),
      description: form.description.trim() || 'Reported from Fleetio Issues Queue.',
      healthArea: form.healthArea,
      severity: form.severity,
      source: 'owner_manual',
    })
    toast.success('Issue logged and queued for triage.')
    setModalOpen(false)
    setForm((f) => ({ ...f, title: '', description: '' }))
  }

  if (mode === 'recalls') {
    const oemAdvisories = [
      {
        id: 'rec-1',
        campaign: 'BS-VI EGR Cooler Inspection Campaign 2026-A',
        oem: 'Tata Motors Commercial',
        affectedCount: vehicles.filter((v) => v.make.toLowerCase().includes('tata')).length,
        severity: 'high' as const,
        status: 'Monitoring',
      },
      {
        id: 'rec-2',
        campaign: 'ABS Wheel Speed Sensor Harness Clip Update',
        oem: 'Ashok Leyland',
        affectedCount: vehicles.filter((v) => v.make.toLowerCase().includes('ashok')).length,
        severity: 'moderate' as const,
        status: 'Scheduled',
      },
    ]

    return (
      <div className="space-y-6">
        <PageHeader
          title="Manufacturer Safety Recalls"
          subtitle={`${activeOrganization.name} · OEM recall campaigns mapped to your active commercial chassis inventory`}
        />
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>OEM</th>
                  <th>Matched Fleet Assets</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {oemAdvisories.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-[#A87F14]" />
                      {r.campaign}
                    </td>
                    <td>{r.oem}</td>
                    <td className="tabular-nums font-bold">{r.affectedCount} vehicle(s)</td>
                    <td><SeverityText severity={r.severity} label={r.severity} /></td>
                    <td className="text-xs font-semibold text-[#1F7A4C]">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet Issues & Defect Triage"
        subtitle={`${activeOrganization.name} · Track reported defects, inspection failures, and escalate directly to Work Orders`}
      >
        {canReport && (
          <button type="button" onClick={() => setModalOpen(true)} className="btn-primary text-xs">
            <Plus className="w-4 h-4" />
            Report Issue
          </button>
        )}
      </PageHeader>

      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Vehicle</th>
                <th>Area</th>
                <th>Severity</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {smallIssues.map((iss) => {
                const v = vehicles.find((x) => x.id === iss.vehicleId)
                return (
                  <tr key={iss.id}>
                    <td>
                      <span className="font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#D9786C]" />
                        {iss.title}
                      </span>
                      <span className="text-xs text-[#958777]">{iss.description}</span>
                    </td>
                    <td className="font-semibold">{v?.registrationNumber ?? iss.vehicleId}</td>
                    <td>{iss.healthArea}</td>
                    <td><SeverityText severity={iss.severity === 'low' ? 'normal' : iss.severity === 'medium' ? 'moderate' : iss.severity} label={iss.severity} /></td>
                    <td className="capitalize text-xs font-semibold">{iss.status.replace(/_/g, ' ')}</td>
                    <td className="text-right">
                      {iss.linkedWorkOrderId ? (
                        <button type="button" onClick={() => navigate('/dashboard/work-orders')} className="btn-secondary text-xs px-2.5 py-1">
                          View WO
                        </button>
                      ) : canWo ? (
                        <button
                          type="button"
                          onClick={() => {
                            const wo = convertIssueToWorkOrder(iss.id)
                            if (wo) toast.success(`Converted to Work Order ${wo.workOrderNumber}`)
                          }}
                          className="btn-accent text-xs px-2.5 py-1"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          Convert to WO
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <EnterpriseModal open={modalOpen} onClose={() => setModalOpen(false)} title="Report Fleet Issue">
        <form onSubmit={handleCreateIssue} className="space-y-4">
          <div>
            <label htmlFor="iss-veh" className="dm-label">Vehicle</label>
            <select id="iss-veh" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} className="dm-input">
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.registrationNumber} — {v.make} {v.model}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="iss-title" className="dm-label">Issue Summary</label>
            <input id="iss-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Air brake pressure drop on rear axle" className="dm-input" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="iss-area" className="dm-label">Health Area</label>
              <select id="iss-area" value={form.healthArea} onChange={(e) => setForm({ ...form, healthArea: e.target.value as FiveAreaHealthCategory })} className="dm-input">
                <option value="Vehicle Health">Vehicle Health</option>
                <option value="Engine Health">Engine Health</option>
                <option value="Tyre Health">Tyre Health</option>
                <option value="Fuel Health">Fuel Health</option>
                <option value="Driver Health">Driver Health</option>
              </select>
            </div>
            <div>
              <label htmlFor="iss-sev" className="dm-label">Severity</label>
              <select id="iss-sev" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as 'low' | 'medium' | 'high' | 'critical' })} className="dm-input">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="iss-desc" className="dm-label">Notes</label>
            <textarea id="iss-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="dm-input" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Submit Issue</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}

export function RemindersHubView({ mode }: { mode: 'service' | 'vehicle_renewals' | 'contact_renewals' }) {
  const { activeOrganization, activeRole, vehicles, drivers, serviceSchedules, completeServiceSchedule, nowTick } = useFleet()
  const canSchedule = canPerformAction(activeRole, 'schedule_maintenance')

  if (mode === 'service') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Service Reminders"
          subtitle={`${activeOrganization.name} · Date and odometer-interval preventive reminders`}
        />
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Reminder</th>
                  <th>Vehicle</th>
                  <th>Due Date</th>
                  <th>Due Odometer</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {serviceSchedules.map((s) => {
                  const v = vehicles.find((x) => x.id === s.vehicleId)
                  return (
                    <tr key={s.id}>
                      <td className="font-semibold flex items-center gap-1.5">
                        <BellRing className="w-3.5 h-3.5 text-[#1F7A4C]" />
                        {s.title}
                      </td>
                      <td>{v?.registrationNumber ?? s.vehicleId}</td>
                      <td className="tabular-nums">{formatShortDate(s.dueDate)}</td>
                      <td className="tabular-nums">{s.dueOdometerKm.toLocaleString('en-IN')} km</td>
                      <td>
                        <SeverityText
                          severity={s.status === 'overdue' ? 'critical' : s.status === 'due_soon' ? 'high' : 'normal'}
                          label={s.status.replace('_', ' ')}
                        />
                      </td>
                      <td className="text-right">
                        {canSchedule && s.status !== 'completed' && (
                          <button
                            type="button"
                            onClick={() => {
                              completeServiceSchedule(s.id)
                              toast.success(`Marked "${s.title}" as completed.`)
                            }}
                            className="btn-secondary text-xs px-2.5 py-1"
                          >
                            Mark Complete
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'vehicle_renewals') {
    const renewalRows = vehicles.flatMap((v) => [
      { id: `${v.id}-ins`, reg: v.registrationNumber, type: 'Commercial Insurance', provider: v.insuranceProvider, expiry: v.insuranceExpiry },
      { id: `${v.id}-rc`, reg: v.registrationNumber, type: 'Registration Certificate (RC)', provider: 'State RTO', expiry: v.registrationExpiry },
      ...(v.fitnessExpiry ? [{ id: `${v.id}-fit`, reg: v.registrationNumber, type: 'Fitness Certificate (FC)', provider: 'RTO Inspection', expiry: v.fitnessExpiry }] : []),
      ...(v.pucExpiry ? [{ id: `${v.id}-puc`, reg: v.registrationNumber, type: 'PUC Emission Certificate', provider: 'Authorized Testing', expiry: v.pucExpiry }] : []),
    ])

    return (
      <div className="space-y-6">
        <PageHeader
          title="Vehicle Renewals"
          subtitle={`${activeOrganization.name} · 60 / 30 / 15 / 7-day compliance tracking for Insurance, RC, Fitness, and PUC`}
        />
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Renewal Type</th>
                  <th>Issuing Authority</th>
                  <th>Expiry Date</th>
                  <th>Compliance Tier</th>
                </tr>
              </thead>
              <tbody>
                {renewalRows.map((row) => {
                  const tier = classifyComplianceExpiryTier(row.expiry, nowTick)
                  return (
                    <tr key={row.id}>
                      <td className="font-semibold">{row.reg}</td>
                      <td>{row.type}</td>
                      <td>{row.provider}</td>
                      <td className="tabular-nums">{formatShortDate(row.expiry)}</td>
                      <td>
                        <SeverityText
                          severity={tier.tier === 'expired' || tier.tier === 'critical_7d' ? 'critical' : tier.tier === 'urgent_15d' || tier.tier === 'upcoming_30d' ? 'high' : 'normal'}
                          label={tier.label}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact Renewals"
        subtitle={`${activeOrganization.name} · Indian Driving License (DL), Hazmat endorsement, and medical fitness renewals`}
      />
      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Driver / Contact</th>
                <th>License Number</th>
                <th>Categories</th>
                <th>DL Expiry</th>
                <th>Tier</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => {
                const tier = classifyComplianceExpiryTier(d.licenseExpiry, nowTick)
                return (
                  <tr key={d.id}>
                    <td>
                      <span className="font-semibold block">{d.name}</span>
                      <span className="text-xs text-[#958777]">{d.mobile}</span>
                    </td>
                    <td className="font-mono text-xs">{d.licenseNumber}</td>
                    <td className="text-xs">{d.licenseCategories?.join(', ') || 'TRANS'}</td>
                    <td className="tabular-nums">{formatShortDate(d.licenseExpiry)}</td>
                    <td>
                      <SeverityText
                        severity={tier.tier === 'expired' || tier.tier === 'critical_7d' ? 'critical' : tier.tier === 'urgent_15d' ? 'high' : 'normal'}
                        label={tier.label}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
