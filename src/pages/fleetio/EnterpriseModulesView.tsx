import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, CloudRain, FileCheck2, FolderKanban, Map, Plug, Plus, ShieldCheck, Webhook } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '../../components/layout/PageHeader'
import { EnterpriseModal, formatInr, formatShortDate, SeverityText } from '../../components/ui/EnterprisePrimitives'
import { useFleet } from '../../hooks/useFleet'
import type { FleetWarrantyItem, CustomRecordEntry } from '../../types/fleet'
import { canPerformAction } from '../../utils/rbac'

export function DocumentsView() {
  const { activeOrganization, activeRole, vehicles, drivers, documentVault, verifyVaultDocument } = useFleet()
  const [filter, setFilter] = useState<'all' | 'vehicle' | 'driver'>('all')
  const canVerify = canPerformAction(activeRole, 'verify_documents')

  const filtered = documentVault.filter((d) => filter === 'all' || d.entityType === filter)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        subtitle={`${activeOrganization.name} · Centralized compliance vault for vehicle RC, insurance, fitness, PUC, and driver KYC`}
      >
        <div className="flex items-center bg-[#EEE8F7] p-1 rounded-[10px] border border-[#DDD3ED]">
          {(['all', 'vehicle', 'driver'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={`px-3 py-1 rounded-[8px] text-xs font-semibold capitalize ${
                filter === t ? 'bg-white text-[#625346] shadow-subtle' : 'text-[#958777]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Entity</th>
                <th>Category</th>
                <th>Expiry Date</th>
                <th>Verification</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => {
                const entityName =
                  doc.entityType === 'vehicle'
                    ? vehicles.find((v) => v.id === doc.entityId)?.registrationNumber ?? doc.entityId
                    : drivers.find((d) => d.id === doc.entityId)?.name ?? doc.entityId
                return (
                  <tr key={doc.id}>
                    <td>
                      <span className="font-semibold flex items-center gap-1.5">
                        <FileCheck2 className="w-3.5 h-3.5 text-[#1F7A4C]" />
                        {doc.title}
                      </span>
                      <span className="text-xs text-[#958777]">{doc.fileName}</span>
                    </td>
                    <td className="font-semibold">{entityName}</td>
                    <td>{doc.category}</td>
                    <td className="tabular-nums">{doc.expiryDate ? formatShortDate(doc.expiryDate) : '—'}</td>
                    <td>
                      <SeverityText
                        severity={
                          doc.verificationStatus === 'verified'
                            ? 'normal'
                            : doc.verificationStatus === 'rejected' || doc.verificationStatus === 'expired'
                              ? 'critical'
                              : 'high'
                        }
                        label={doc.verificationStatus.replace('_', ' ')}
                      />
                    </td>
                    <td className="text-right">
                      {canVerify && doc.verificationStatus !== 'verified' && (
                        <button
                          type="button"
                          onClick={() => {
                            verifyVaultDocument(doc.id, 'verified')
                            toast.success(`Verified document "${doc.title}"`)
                          }}
                          className="btn-primary text-xs px-2.5 py-1"
                        >
                          Verify
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-xs text-[#958777]">
                    No documents uploaded in this category yet. Upload from Vehicle or Driver detail pages.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function WarrantiesView() {
  const { activeOrganization, activeRole, vehicles, warranties, addWarranty } = useFleet()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    registrationNumber: vehicles[0]?.registrationNumber ?? '',
    provider: 'OEM Extended Commercial Care',
    coverageType: 'Powertrain' as FleetWarrantyItem['coverageType'],
    expiryDate: '2029-03-31',
    maxOdometerKm: 350000,
  })
  const canEdit = canPerformAction(activeRole, 'edit_vehicle')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const matched = vehicles.find((v) => v.registrationNumber === form.registrationNumber)
    await addWarranty({
      vehicleId: matched?.id,
      assetName: matched ? `${matched.make} ${matched.model}` : 'Commercial Asset',
      registrationNumber: form.registrationNumber || vehicles[0]?.registrationNumber || 'FLEET-01',
      provider: form.provider.trim(),
      coverageType: form.coverageType,
      startDate: new Date().toISOString().slice(0, 10),
      expiryDate: form.expiryDate,
      maxOdometerKm: Number(form.maxOdometerKm) || 300000,
      claimStatus: 'active',
    })
    toast.success('Warranty coverage added.')
    setModalOpen(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warranties"
        subtitle={`${activeOrganization.name} · OEM powertrain, EV battery pack, chassis, and component warranty coverage`}
      >
        {canEdit && (
          <button type="button" onClick={() => setModalOpen(true)} className="btn-primary text-xs">
            <Plus className="w-4 h-4" />
            Add Warranty
          </button>
        )}
      </PageHeader>

      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Vehicle / Asset</th>
                <th>Coverage</th>
                <th>Warranty Provider</th>
                <th>Meter Limit</th>
                <th>Expiry Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {warranties.map((w) => (
                <tr key={w.id}>
                  <td>
                    <span className="font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#1F7A4C]" />
                      {w.registrationNumber}
                    </span>
                    <span className="text-xs text-[#958777]">{w.assetName}</span>
                  </td>
                  <td>{w.coverageType}</td>
                  <td>{w.provider}</td>
                  <td className="tabular-nums">{w.maxOdometerKm.toLocaleString('en-IN')} km</td>
                  <td className="tabular-nums">{formatShortDate(w.expiryDate)}</td>
                  <td>
                    <SeverityText
                      severity={w.claimStatus === 'expiring_soon' ? 'high' : 'normal'}
                      label={w.claimStatus.replace('_', ' ')}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <EnterpriseModal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Asset Warranty">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label htmlFor="war-veh" className="dm-label">Vehicle</label>
            <select id="war-veh" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} className="dm-input">
              {vehicles.map((v) => (
                <option key={v.id} value={v.registrationNumber}>{v.registrationNumber} — {v.make} {v.model}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="war-type" className="dm-label">Coverage Type</label>
              <select id="war-type" value={form.coverageType} onChange={(e) => setForm({ ...form, coverageType: e.target.value as FleetWarrantyItem['coverageType'] })} className="dm-input">
                <option value="Powertrain">Powertrain</option>
                <option value="Battery / EV Pack">Battery / EV Pack</option>
                <option value="Chassis & Axle">Chassis &amp; Axle</option>
                <option value="Tyre Casing">Tyre Casing</option>
                <option value="Component">Component</option>
              </select>
            </div>
            <div>
              <label htmlFor="war-exp" className="dm-label">Expiry Date</label>
              <input id="war-exp" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className="dm-input" />
            </div>
          </div>
          <div>
            <label htmlFor="war-prov" className="dm-label">Provider</label>
            <input id="war-prov" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="dm-input" required />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Save Warranty</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}

export function CustomRecordsView() {
  const { activeOrganization, activeRole, vehicles, customRecords, addCustomRecord } = useFleet()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    recordType: 'Toll & FASTag Audit' as CustomRecordEntry['recordType'],
    vehicleOrDriver: vehicles[0]?.registrationNumber ?? '',
    referenceCode: '',
    amountInr: 1500,
    notes: '',
  })
  const canEdit = canPerformAction(activeRole, 'edit_vehicle')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.referenceCode.trim()) return
    await addCustomRecord({
      recordType: form.recordType,
      vehicleOrDriver: form.vehicleOrDriver,
      referenceCode: form.referenceCode.trim().toUpperCase(),
      recordedDate: new Date().toISOString().slice(0, 10),
      amountInr: Number(form.amountInr) || 0,
      status: 'verified',
      notes: form.notes.trim() || 'Recorded via Custom Records module.',
    })
    toast.success('Custom fleet record created.')
    setModalOpen(false)
    setForm((f) => ({ ...f, referenceCode: '', notes: '' }))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom Records"
        subtitle={`${activeOrganization.name} · Configurable records for FASTag toll audits, RTO permits, cold-chain logs, and kits`}
      >
        {canEdit && (
          <button type="button" onClick={() => setModalOpen(true)} className="btn-primary text-xs">
            <Plus className="w-4 h-4" />
            Add Custom Record
          </button>
        )}
      </PageHeader>

      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Record Type</th>
                <th>Reference</th>
                <th>Asset / Contact</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {customRecords.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold flex items-center gap-1.5">
                    <FolderKanban className="w-3.5 h-3.5 text-[#1F7A4C]" />
                    {r.recordType}
                  </td>
                  <td className="font-mono text-xs">{r.referenceCode}</td>
                  <td className="font-semibold">{r.vehicleOrDriver}</td>
                  <td className="tabular-nums">{r.amountInr ? formatInr(r.amountInr) : '—'}</td>
                  <td className="text-xs text-[#958777]">{formatShortDate(r.recordedDate)}</td>
                  <td className="text-xs text-[#958777]">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <EnterpriseModal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Custom Fleet Record">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cr-type" className="dm-label">Record Template</label>
              <select id="cr-type" value={form.recordType} onChange={(e) => setForm({ ...form, recordType: e.target.value as CustomRecordEntry['recordType'] })} className="dm-input">
                <option value="Toll & FASTag Audit">Toll &amp; FASTag Audit</option>
                <option value="RTO Permit Log">RTO Permit Log</option>
                <option value="Cold-Chain Temp Audit">Cold-Chain Temp Audit</option>
                <option value="Driver Uniform & Kit">Driver Uniform &amp; Kit</option>
              </select>
            </div>
            <div>
              <label htmlFor="cr-asset" className="dm-label">Vehicle / Contact</label>
              <select id="cr-asset" value={form.vehicleOrDriver} onChange={(e) => setForm({ ...form, vehicleOrDriver: e.target.value })} className="dm-input">
                {vehicles.map((v) => (
                  <option key={v.id} value={v.registrationNumber}>{v.registrationNumber}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cr-ref" className="dm-label">Reference Code</label>
              <input id="cr-ref" value={form.referenceCode} onChange={(e) => setForm({ ...form, referenceCode: e.target.value })} placeholder="FTG-2026-9901" className="dm-input" required />
            </div>
            <div>
              <label htmlFor="cr-amt" className="dm-label">Amount (₹)</label>
              <input id="cr-amt" type="number" min={0} value={form.amountInr} onChange={(e) => setForm({ ...form, amountInr: Number(e.target.value) })} className="dm-input tabular-nums" />
            </div>
          </div>
          <div>
            <label htmlFor="cr-notes" className="dm-label">Notes</label>
            <textarea id="cr-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="dm-input" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Save Record</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}

export function IntegrationsView() {
  const navigate = useNavigate()
  const { activeOrganization, settings, markModuleVisited } = useFleet()

  React.useEffect(() => {
    markModuleVisited('integrations')
  }, [markModuleVisited])

  const cards = [
    {
      name: 'Open-Meteo Corridor Weather Feed',
      category: 'Climate & Road Intelligence',
      status: 'Connected (Live)',
      desc: 'Live 5-minute cached corridor temperature, rainfall, and wind telemetry across Tamil Nadu & Karnataka hubs.',
      icon: CloudRain,
      actionLabel: 'View Corridors',
      route: '/dashboard/roads',
    },
    {
      name: 'Google Maps Commercial Truck Routing',
      category: 'Navigation & Restrictions',
      status: 'API Gateway Ready',
      desc: 'Bridge clearance, GVW, and axle-aware commercial truck routing with automatic highway fallback disclosure.',
      icon: Map,
      actionLabel: 'Open Fleet Map',
      route: '/dashboard/map',
    },
    {
      name: 'DigiLocker Indian KYC Readiness',
      category: 'Driver & RC Verification',
      status: settings.digilockerEnabled ? 'Enabled' : 'Disabled in Settings',
      desc: 'Surface DigiLocker verification readiness on driver Driving Licenses and vehicle Registration Certificates.',
      icon: ShieldCheck,
      actionLabel: 'Configure KYC',
      route: '/dashboard/settings/kyc',
    },
    {
      name: 'Webhooks & Fleet MCP API',
      category: 'Developer & ERP Sync',
      status: 'Configured',
      desc: 'Stream work order events, critical health alerts, and meter logs to external ERPs via API keys and webhooks.',
      icon: Webhook,
      actionLabel: 'Manage Webhooks',
      route: '/dashboard/settings/webhooks',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations Directory"
        subtitle={`${activeOrganization.name} · Connected telematics, routing, compliance, and developer integrations`}
      >
        <button type="button" onClick={() => navigate('/dashboard/settings/api-keys')} className="btn-accent text-xs">
          <Plug className="w-3.5 h-3.5" />
          Manage API Keys
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.name} className="enterprise-card p-5 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-[#EAF7EF] text-[#1F7A4C] flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#625346]">{c.name}</h3>
                      <p className="text-[11px] text-[#958777]">{c.category}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-[#EAF7EF] text-[#156C3F]">
                    <CheckCircle2 className="w-3 h-3" />
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-[#958777] leading-relaxed">{c.desc}</p>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => navigate(c.route)} className="btn-secondary text-xs">
                  {c.actionLabel}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
