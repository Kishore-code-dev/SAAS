import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  FileCheck2,
  Lock,
  Save,
  ShieldAlert,
  Truck,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { useFleet } from '../hooks/useFleet'
import {
  classifyComplianceExpiryTier,
  evaluateDriverSafety,
  type ComplianceExpiryTier,
} from '../utils/intelligenceEngine'
import { canPerformAction } from '../utils/rbac'
import {
  EmptySectionState,
  formatDateTime,
  formatShortDate,
  SeverityText,
} from '../components/ui/EnterprisePrimitives'
import type { DriverOperationalStatus, IndianLicenseCategory } from '../types/fleet'

const INDIAN_DL_CATEGORIES: IndianLicenseCategory[] = ['LMV-TR', 'TRANS', 'HGMV', 'HPMV', 'HTV', 'MGV']

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Failed to read selected file.'))
    reader.readAsDataURL(file)
  })
}

function tierBadgeStyle(tier: ComplianceExpiryTier) {
  if (tier === 'expired' || tier === 'critical_7d') {
    return 'bg-[#FCECEB] border-[#E7A8A0] text-[#A24034]'
  }
  if (tier === 'urgent_15d' || tier === 'upcoming_30d') {
    return 'bg-[#FDF3E7] border-[#E8C290] text-[#8F6510]'
  }
  if (tier === 'watch_60d') {
    return 'bg-[#EEE8F7] border-[#B8A3D9] text-[#6E5696]'
  }
  if (tier === 'valid') {
    return 'bg-[#EDF4EC] border-[#B8D0B5] text-[#4D6E4A]'
  }
  return 'bg-[#F5F5F7] border-[#E5E5E5] text-[#958777]'
}

export default function DriverDetails() {
  const { driverId, id } = useParams()
  const resolvedId = driverId ?? id
  const navigate = useNavigate()
  const {
    activeOrganization,
    activeRole,
    drivers,
    vehicles,
    trips,
    driverEvents,
    driverAssignments,
    documentVault,
    corridors,
    settings,
    updateDriverDetails,
    updateDriverOperationalStatus,
    uploadDocumentToVault,
    verifyVaultDocument,
    resolveDriverEventDispute,
    nowTick,
  } = useFleet()

  const driver = drivers.find((d) => d.id === resolvedId)

  const [identityForm, setIdentityForm] = useState({
    name: driver?.name ?? '',
    mobile: driver?.mobile ?? '',
    alternateMobile: driver?.alternateMobile ?? '',
    email: driver?.email ?? '',
    city: driver?.city ?? '',
    state: driver?.state ?? '',
    address: driver?.address ?? '',
    bloodGroup: driver?.bloodGroup ?? '',
    emergencyContactName: driver?.emergencyContactName ?? '',
    emergencyContactRelation: driver?.emergencyContactRelation ?? '',
    emergencyContactPhone: driver?.emergencyContactPhone ?? '',
  })

  const [complianceForm, setComplianceForm] = useState({
    licenseNumber: driver?.licenseNumber ?? '',
    licenseCategories: driver?.licenseCategories ?? (['TRANS'] as IndianLicenseCategory[]),
    licenseIssuingRto: driver?.licenseIssuingRto ?? '',
    licenseIssueDate: driver?.licenseIssueDate ?? '',
    licenseExpiry: driver?.licenseExpiry ?? '',
    hazmatEndorsed: Boolean(driver?.hazmatEndorsed),
    hazmatExpiry: driver?.hazmatExpiry ?? '',
    aadhaarMasked: driver?.aadhaarMasked ?? '',
    panMasked: driver?.panMasked ?? '',
    medicalFitnessExpiry: driver?.medicalFitnessExpiry ?? '',
    policeVerificationStatus: driver?.policeVerificationStatus ?? 'not_submitted',
  })

  const [docCategory, setDocCategory] = useState('Commercial Driving Licence (DL)')
  const [docTitle, setDocTitle] = useState('')
  const [docExpiry, setDocExpiry] = useState('')
  const [uploading, setUploading] = useState(false)

  const canEdit = canPerformAction(activeRole, 'manage_driver_status')
  const canVerifyDocs = canPerformAction(activeRole, 'verify_documents')
  const canResolveDispute = canPerformAction(activeRole, 'resolve_driver_dispute')

  const safetyEvaluation = useMemo(() => {
    if (!driver) return null
    return evaluateDriverSafety({
      driver,
      events: driverEvents,
      trips,
      corridors,
      vehicles,
    })
  }, [driver, driverEvents, trips, corridors, vehicles])

  if (!driver) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => navigate('/dashboard/drivers')} className="btn-secondary text-xs">
          <ArrowLeft className="w-4 h-4" />
          Back to Drivers
        </button>
        <EmptySectionState
          title="Driver record not found"
          description="The requested driver profile does not exist in this organization workspace."
          actionLabel="Return to Drivers"
          onAction={() => navigate('/dashboard/drivers')}
        />
      </div>
    )
  }

  const assignedVehicle = vehicles.find((v) => v.id === driver.assignedVehicleId)
  const drvVaultDocs = documentVault.filter((doc) => doc.entityType === 'driver' && doc.entityId === driver.id)
  const drvAssignments = driverAssignments.filter((a) => a.driverId === driver.id)
  const drvTrips = trips.filter((t) => t.driverId === driver.id)
  const drvEvents = driverEvents.filter((e) => e.driverId === driver.id)

  const expiryAlerts = [
    { label: 'Commercial DL', tierInfo: classifyComplianceExpiryTier(driver.licenseExpiry, nowTick) },
    { label: 'Medical Fitness (Form 1A)', tierInfo: classifyComplianceExpiryTier(driver.medicalFitnessExpiry, nowTick) },
    ...(driver.hazmatEndorsed
      ? [{ label: 'Hazmat Endorsement', tierInfo: classifyComplianceExpiryTier(driver.hazmatExpiry, nowTick) }]
      : []),
  ].filter(
    (item) =>
      item.tierInfo.tier === 'expired' ||
      item.tierInfo.tier === 'critical_7d' ||
      item.tierInfo.tier === 'urgent_15d' ||
      item.tierInfo.tier === 'upcoming_30d' ||
      item.tierInfo.tier === 'watch_60d',
  )

  const handleSaveIdentity = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return
    try {
      updateDriverDetails(driver.id, {
        name: identityForm.name.trim(),
        mobile: identityForm.mobile.trim(),
        alternateMobile: identityForm.alternateMobile.trim() || undefined,
        email: identityForm.email.trim(),
        city: identityForm.city.trim(),
        state: identityForm.state.trim(),
        address: identityForm.address.trim() || undefined,
        bloodGroup: identityForm.bloodGroup.trim() || undefined,
        emergencyContactName: identityForm.emergencyContactName.trim() || undefined,
        emergencyContactRelation: identityForm.emergencyContactRelation.trim() || undefined,
        emergencyContactPhone: identityForm.emergencyContactPhone.trim() || undefined,
      })
      toast.success('Updated driver identity & emergency contact.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save driver details.')
    }
  }

  const handleSaveCompliance = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return
    try {
      updateDriverDetails(driver.id, {
        licenseNumber: complianceForm.licenseNumber.trim().toUpperCase(),
        licenseCategories: complianceForm.licenseCategories,
        licenseIssuingRto: complianceForm.licenseIssuingRto.trim(),
        licenseIssueDate: complianceForm.licenseIssueDate || undefined,
        licenseExpiry: complianceForm.licenseExpiry,
        hazmatEndorsed: complianceForm.hazmatEndorsed,
        hazmatExpiry: complianceForm.hazmatExpiry || undefined,
        aadhaarMasked: complianceForm.aadhaarMasked.trim() || undefined,
        panMasked: complianceForm.panMasked.trim().toUpperCase() || undefined,
        medicalFitnessExpiry: complianceForm.medicalFitnessExpiry || undefined,
        policeVerificationStatus: complianceForm.policeVerificationStatus,
      })
      toast.success('Saved Indian commercial licence & compliance details.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save compliance profile.')
    }
  }

  const toggleCategory = (cat: IndianLicenseCategory) => {
    setComplianceForm((prev) => {
      const exists = prev.licenseCategories.includes(cat)
      return {
        ...prev,
        licenseCategories: exists
          ? prev.licenseCategories.filter((c) => c !== cat)
          : [...prev.licenseCategories, cat],
      }
    })
  }

  const handleVaultUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Maximum private document size is 5 MB.')
      return
    }
    setUploading(true)
    try {
      const contentBase64 = await readFileAsBase64(file)
      await uploadDocumentToVault({
        entityType: 'driver',
        entityId: driver.id,
        category: docCategory,
        title: docTitle.trim() || `${docCategory} · ${driver.name}`,
        expiryDate: docExpiry || undefined,
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
        contentBase64,
      })
      setDocTitle('')
      toast.success('Document uploaded with status Pending Verification (owner verification required).')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to upload document.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleStatusChange = (nextStatus: DriverOperationalStatus) => {
    try {
      updateDriverOperationalStatus(driver.id, nextStatus)
      toast.success(`Updated operational status for ${driver.name} to ${nextStatus}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update driver status.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/drivers')}
            className="text-xs font-semibold text-[#958777] hover:text-[#625346] inline-flex items-center gap-1.5 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Drivers
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="dm-page-title">{driver.name}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EEE8F7] border border-[#DDD3ED] text-[#6E5696] tabular-nums">
              {driver.employeeCode ?? driver.id.toUpperCase()}
            </span>
            <SeverityText
              severity={
                driver.operationalStatus === 'active'
                  ? 'normal'
                  : driver.operationalStatus === 'suspended'
                    ? 'critical'
                    : 'moderate'
              }
              label={`Status: ${driver.operationalStatus}`}
            />
          </div>
          <p className="text-sm text-[#958777] mt-1">
            {driver.licenseNumber} · {driver.city ?? activeOrganization.city}, {driver.state ?? activeOrganization.state} · Assigned Vehicle:{' '}
            {assignedVehicle ? (
              <button
                type="button"
                onClick={() => navigate(`/dashboard/fleet/vehicles/${assignedVehicle.id}`)}
                className="font-semibold text-[#6E5696] hover:underline"
              >
                {assignedVehicle.registrationNumber}
              </button>
            ) : (
              'Unassigned'
            )}
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {(['active', 'inactive', 'suspended', 'archived'] as DriverOperationalStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                disabled={driver.operationalStatus === st}
                onClick={() => handleStatusChange(st)}
                className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold capitalize border transition-colors ${
                  driver.operationalStatus === st
                    ? 'bg-[#E8C65A] border-[#D8B442] text-[#625346]'
                    : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#625346] hover:bg-[#EEE8F7]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 60 / 30 / 15 / 7 / 0-Day Compliance Expiry Alert Banner */}
      {expiryAlerts.length > 0 && (
        <div className="rounded-xl border border-[#E8C290] bg-[#FDF3E7] p-4 flex flex-wrap items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#8F6510] shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <p className="text-sm font-bold text-[#625346]">Indian Commercial Compliance Expiry Watch</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {expiryAlerts.map((item) => (
                <span
                  key={item.label}
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${tierBadgeStyle(item.tierInfo.tier)}`}
                >
                  {item.label}: {item.tierInfo.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Identity & Indian Commercial Licence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <form onSubmit={handleSaveIdentity} className="enterprise-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
            <div>
              <h2 className="dm-card-title text-base">Identity & Emergency Contact</h2>
              <p className="text-xs text-[#958777]">Owner-managed ERP record · No driver self-login enabled</p>
            </div>
            {canEdit && (
              <button type="submit" className="btn-primary text-xs px-3 py-1.5">
                <Save className="w-3.5 h-3.5" />
                Save Identity
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label htmlFor="drv-m-name" className="dm-label">Full Name</label>
              <input
                id="drv-m-name"
                disabled={!canEdit}
                value={identityForm.name}
                onChange={(e) => setIdentityForm((f) => ({ ...f, name: e.target.value }))}
                className="dm-input"
              />
            </div>
            <div>
              <label htmlFor="drv-m-mob" className="dm-label">Primary Mobile</label>
              <input
                id="drv-m-mob"
                disabled={!canEdit}
                value={identityForm.mobile}
                onChange={(e) => setIdentityForm((f) => ({ ...f, mobile: e.target.value }))}
                className="dm-input tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="drv-m-alt" className="dm-label">Alternate Mobile</label>
              <input
                id="drv-m-alt"
                disabled={!canEdit}
                value={identityForm.alternateMobile}
                onChange={(e) => setIdentityForm((f) => ({ ...f, alternateMobile: e.target.value }))}
                className="dm-input tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="drv-m-blood" className="dm-label">Blood Group</label>
              <input
                id="drv-m-blood"
                disabled={!canEdit}
                value={identityForm.bloodGroup}
                onChange={(e) => setIdentityForm((f) => ({ ...f, bloodGroup: e.target.value }))}
                placeholder="B+"
                className="dm-input"
              />
            </div>
            <div>
              <label htmlFor="drv-m-city" className="dm-label">Base City</label>
              <input
                id="drv-m-city"
                disabled={!canEdit}
                value={identityForm.city}
                onChange={(e) => setIdentityForm((f) => ({ ...f, city: e.target.value }))}
                className="dm-input"
              />
            </div>
            <div>
              <label htmlFor="drv-m-state" className="dm-label">State</label>
              <input
                id="drv-m-state"
                disabled={!canEdit}
                value={identityForm.state}
                onChange={(e) => setIdentityForm((f) => ({ ...f, state: e.target.value }))}
                className="dm-input"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="drv-m-addr" className="dm-label">Permanent / Correspondence Address</label>
              <input
                id="drv-m-addr"
                disabled={!canEdit}
                value={identityForm.address}
                onChange={(e) => setIdentityForm((f) => ({ ...f, address: e.target.value }))}
                className="dm-input"
              />
            </div>
            <div>
              <label htmlFor="drv-m-ecname" className="dm-label">Emergency Contact Name</label>
              <input
                id="drv-m-ecname"
                disabled={!canEdit}
                value={identityForm.emergencyContactName}
                onChange={(e) => setIdentityForm((f) => ({ ...f, emergencyContactName: e.target.value }))}
                className="dm-input"
              />
            </div>
            <div>
              <label htmlFor="drv-m-ecphone" className="dm-label">Emergency Contact Phone</label>
              <input
                id="drv-m-ecphone"
                disabled={!canEdit}
                value={identityForm.emergencyContactPhone}
                onChange={(e) => setIdentityForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))}
                className="dm-input tabular-nums"
              />
            </div>
          </div>
        </form>

        <form onSubmit={handleSaveCompliance} className="enterprise-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
            <div>
              <h2 className="dm-card-title text-base">Indian Commercial Licence & Compliance</h2>
              <p className="text-xs text-[#958777]">Parivahan / RTO categories, Form 1A, and KYC verification</p>
            </div>
            {canEdit && (
              <button type="submit" className="btn-accent text-xs px-3 py-1.5">
                <Save className="w-3.5 h-3.5 text-[#6E5696]" />
                Save Compliance
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label htmlFor="drv-c-dl" className="dm-label">Commercial DL Number</label>
              <input
                id="drv-c-dl"
                disabled={!canEdit}
                value={complianceForm.licenseNumber}
                onChange={(e) => setComplianceForm((f) => ({ ...f, licenseNumber: e.target.value }))}
                className="dm-input font-mono uppercase"
              />
            </div>
            <div>
              <label htmlFor="drv-c-rto" className="dm-label">Issuing RTO</label>
              <input
                id="drv-c-rto"
                disabled={!canEdit}
                value={complianceForm.licenseIssuingRto}
                onChange={(e) => setComplianceForm((f) => ({ ...f, licenseIssuingRto: e.target.value }))}
                placeholder="TN-01 Chennai Central RTO"
                className="dm-input"
              />
            </div>
            <div>
              <label htmlFor="drv-c-exp" className="dm-label">DL Expiry Date</label>
              <input
                id="drv-c-exp"
                type="date"
                disabled={!canEdit}
                value={complianceForm.licenseExpiry}
                onChange={(e) => setComplianceForm((f) => ({ ...f, licenseExpiry: e.target.value }))}
                className="dm-input tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="drv-c-med" className="dm-label">Form 1A Medical Fitness Expiry</label>
              <input
                id="drv-c-med"
                type="date"
                disabled={!canEdit}
                value={complianceForm.medicalFitnessExpiry}
                onChange={(e) => setComplianceForm((f) => ({ ...f, medicalFitnessExpiry: e.target.value }))}
                className="dm-input tabular-nums"
              />
            </div>
            <div className="sm:col-span-2">
              <span className="dm-label">Licence Endorsement Categories</span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {INDIAN_DL_CATEGORIES.map((cat) => {
                  const active = complianceForm.licenseCategories.includes(cat)
                  return (
                    <button
                      key={cat}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => toggleCategory(cat)}
                      className={`px-2.5 py-1 rounded-[8px] text-xs font-semibold border transition-colors ${
                        active
                          ? 'bg-[#EEE8F7] border-[#B8A3D9] text-[#6E5696]'
                          : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#958777]'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label htmlFor="drv-c-aadhaar" className="dm-label">Masked Aadhaar (Last 4 only)</label>
              <input
                id="drv-c-aadhaar"
                disabled={!canEdit}
                value={complianceForm.aadhaarMasked}
                onChange={(e) => setComplianceForm((f) => ({ ...f, aadhaarMasked: e.target.value }))}
                placeholder="XXXX-XXXX-4821"
                className="dm-input font-mono"
              />
            </div>
            <div>
              <label htmlFor="drv-c-pan" className="dm-label">Masked PAN</label>
              <input
                id="drv-c-pan"
                disabled={!canEdit}
                value={complianceForm.panMasked}
                onChange={(e) => setComplianceForm((f) => ({ ...f, panMasked: e.target.value }))}
                placeholder="ABCPK****L"
                className="dm-input font-mono uppercase"
              />
            </div>
            <div>
              <label htmlFor="drv-c-pol" className="dm-label">Police Verification</label>
              <select
                id="drv-c-pol"
                disabled={!canEdit}
                value={complianceForm.policeVerificationStatus}
                onChange={(e) =>
                  setComplianceForm((f) => ({
                    ...f,
                    policeVerificationStatus: e.target.value as NonNullable<typeof driver.policeVerificationStatus>,
                  }))
                }
                className="dm-input"
              >
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                <option value="not_submitted">Not Submitted</option>
              </select>
            </div>
            <div className="flex items-end gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-[#625346] cursor-pointer pb-2">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={complianceForm.hazmatEndorsed}
                  onChange={(e) => setComplianceForm((f) => ({ ...f, hazmatEndorsed: e.target.checked }))}
                />
                Hazmat Endorsed
              </label>
              {complianceForm.hazmatEndorsed && (
                <div className="flex-1">
                  <label htmlFor="drv-c-haz" className="dm-label">Hazmat Expiry</label>
                  <input
                    id="drv-c-haz"
                    type="date"
                    disabled={!canEdit}
                    value={complianceForm.hazmatExpiry}
                    onChange={(e) => setComplianceForm((f) => ({ ...f, hazmatExpiry: e.target.value }))}
                    className="dm-input tabular-nums"
                  />
                </div>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Private Document Vault & DigiLocker Readiness */}
      <div className="enterprise-card p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E5E5] pb-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#EEE8F7] flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-[#6E5696]" />
            </div>
            <div>
              <h2 className="dm-card-title text-base">Private Driver Document Vault</h2>
              <p className="text-xs text-[#958777]">
                Uploads start as <strong className="text-[#625346]">Pending Verification</strong> — uploaded status never implies verified without explicit owner approval.
              </p>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-[10px] border border-[#DDD3ED] bg-[#EEE8F7] text-xs text-[#625346]">
            DigiLocker KYC:{' '}
            <strong className="text-[#6E5696]">
              {settings.digilockerEnabled ? 'Enabled (Consent Pending)' : 'Disabled in Settings'}
            </strong>
          </div>
        </div>

        {canEdit && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-4">
            <div>
              <label htmlFor="vlt-cat" className="dm-label">Document Type</label>
              <select
                id="vlt-cat"
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
                className="dm-input text-xs"
              >
                <option value="Commercial Driving Licence (DL)">Commercial Driving Licence (DL)</option>
                <option value="Form 1A Medical Fitness Certificate">Form 1A Medical Fitness Certificate</option>
                <option value="Police Verification Certificate">Police Verification Certificate</option>
                <option value="Aadhaar Masked KYC">Aadhaar Masked KYC</option>
                <option value="PAN Card Copy">PAN Card Copy</option>
              </select>
            </div>
            <div>
              <label htmlFor="vlt-title" className="dm-label">Document Title</label>
              <input
                id="vlt-title"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="e.g. DL Renewal 2026"
                className="dm-input text-xs"
              />
            </div>
            <div>
              <label htmlFor="vlt-exp" className="dm-label">Expiry Date</label>
              <input
                id="vlt-exp"
                type="date"
                value={docExpiry}
                onChange={(e) => setDocExpiry(e.target.value)}
                className="dm-input text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="btn-primary text-xs w-full cursor-pointer justify-center">
                <Upload className="w-3.5 h-3.5" />
                {uploading ? 'Uploading…' : 'Upload PDF / Image'}
                <input
                  type="file"
                  accept=".pdf,image/*"
                  disabled={uploading}
                  onChange={handleVaultUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Category</th>
                <th>Expiry</th>
                <th>Verification Status</th>
                <th>Uploaded</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drvVaultDocs.map((doc) => {
                const expTier = doc.expiryDate ? classifyComplianceExpiryTier(doc.expiryDate, nowTick) : null
                return (
                  <tr key={doc.id}>
                    <td>
                      <p className="font-semibold text-[#625346]">{doc.title}</p>
                      <p className="text-[11px] text-[#958777]">{doc.fileName}</p>
                    </td>
                    <td className="text-xs text-[#625346]">{doc.category}</td>
                    <td>
                      {expTier ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${tierBadgeStyle(expTier.tier)}`}>
                          {expTier.label}
                        </span>
                      ) : (
                        <span className="text-xs text-[#958777]">—</span>
                      )}
                    </td>
                    <td>
                      <SeverityText
                        severity={
                          doc.verificationStatus === 'verified'
                            ? 'normal'
                            : doc.verificationStatus === 'rejected' || doc.verificationStatus === 'expired'
                              ? 'critical'
                              : 'high'
                        }
                        label={doc.verificationStatus.replace(/_/g, ' ')}
                      />
                    </td>
                    <td className="text-xs text-[#958777] tabular-nums">{formatShortDate(doc.uploadedAt)}</td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        {doc.storageKey && !doc.storageKey.startsWith('seed/') && (
                          <a
                            href={`/api/fleet/documents/${doc.id}/download`}
                            className="btn-secondary text-[11px] px-2.5 py-1"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </a>
                        )}
                        {canVerifyDocs && doc.verificationStatus !== 'verified' && (
                          <button
                            type="button"
                            onClick={() => {
                              verifyVaultDocument(doc.id, 'verified')
                              toast.success(`Verified ${doc.title}`)
                            }}
                            className="btn-primary text-[11px] px-2.5 py-1"
                          >
                            <FileCheck2 className="w-3 h-3" />
                            Verify
                          </button>
                        )}
                        {canVerifyDocs && doc.verificationStatus !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => {
                              verifyVaultDocument(doc.id, 'rejected', 'Document illegible or expired')
                              toast.info(`Rejected ${doc.title}`)
                            }}
                            className="btn-secondary text-[11px] px-2.5 py-1"
                          >
                            <ShieldAlert className="w-3 h-3" />
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {drvVaultDocs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-xs text-[#958777] py-6">
                    No private compliance documents uploaded for this driver yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safety Scores, Behavior Events & Vehicle Assignment History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {safetyEvaluation && (
          <div className="lg:col-span-7 enterprise-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
              <div>
                <h2 className="dm-card-title text-base">Driver Safety & Corridor Evaluation</h2>
                <p className="text-xs text-[#958777]">{safetyEvaluation.roadAdjustedNote}</p>
              </div>
              <SeverityText
                severity={safetyEvaluation.overallScore < 65 ? 'critical' : safetyEvaluation.overallScore < 80 ? 'high' : 'normal'}
                label={`Safety ${safetyEvaluation.overallScore}/100`}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              {[
                { label: 'Speeding', val: safetyEvaluation.speedingScore },
                { label: 'Braking', val: safetyEvaluation.brakingScore },
                { label: 'Acceleration', val: safetyEvaluation.accelerationScore },
                { label: 'Cornering', val: safetyEvaluation.corneringScore },
                { label: 'Fatigue / Hours', val: safetyEvaluation.fatigueComplianceScore },
              ].map((m) => (
                <div key={m.label} className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-3">
                  <span className="text-[#958777] block">{m.label}</span>
                  <span className="text-lg font-bold text-[#625346] tabular-nums">{m.val}</span>
                </div>
              ))}
            </div>

            <div className="divide-y divide-[#E5E5E5] border border-[#E5E5E5] rounded-xl">
              {drvEvents.map((ev) => (
                <div key={ev.id} className="p-3.5 text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <SeverityText
                      severity={ev.disputeStatus === 'accepted_dismissed' ? 'normal' : ev.severity === 'high' ? 'high' : 'moderate'}
                      label={`${ev.eventType.replace(/_/g, ' ')} · ${ev.locationLabel}`}
                    />
                    <span className="tabular-nums text-[#958777]">{ev.speedKmh} km/h · {formatDateTime(ev.timestamp)}</span>
                  </div>
                  {ev.disputeStatus === 'disputed' && canResolveDispute && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          resolveDriverEventDispute(ev.id, 'accepted_dismissed', 'Confirmed road/mount artifact')
                          toast.success('Event penalty dismissed.')
                        }}
                        className="btn-primary text-[11px] px-2.5 py-1"
                      >
                        Dismiss Penalty
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          resolveDriverEventDispute(ev.id, 'rejected_upheld', 'Confirmed via telemetry trace')
                          toast.info('Event upheld.')
                        }}
                        className="btn-secondary text-[11px] px-2.5 py-1"
                      >
                        Uphold
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {drvEvents.length === 0 && (
                <p className="p-5 text-center text-xs text-[#958777]">No harsh behavior events logged.</p>
              )}
            </div>
          </div>
        )}

        <div className="lg:col-span-5 enterprise-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
            <div>
              <h2 className="dm-card-title text-base">Vehicle Assignment & Trip Log</h2>
              <p className="text-xs text-[#958777]">{driver.totalTrips} trips · {driver.totalDistanceKm.toLocaleString('en-IN')} km</p>
            </div>
            <Truck className="w-4 h-4 text-[#6E5696]" />
          </div>

          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-[#625346]">Assignment History</h3>
            {drvAssignments.map((a) => (
              <div key={a.id} className="p-3 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] text-xs flex items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-[#625346] tabular-nums">{a.vehicleRegistration}</p>
                  <p className="text-[#958777]">{formatShortDate(a.assignedAt)} → {a.unassignedAt ? formatShortDate(a.unassignedAt) : 'Current'}</p>
                </div>
                <span className="text-[11px] font-medium text-[#6E5696]">{a.assignedBy}</span>
              </div>
            ))}
            {drvAssignments.length === 0 && (
              <p className="text-xs text-[#958777]">No assignment history logged yet.</p>
            )}
          </div>

          <div className="space-y-2.5 pt-2 border-t border-[#E5E5E5]">
            <h3 className="text-xs font-bold text-[#625346]">Recent Trips ({drvTrips.length})</h3>
            {drvTrips.slice(0, 4).map((t) => (
              <div key={t.id} className="text-xs flex items-center justify-between gap-2 py-1.5 border-b border-[#E5E5E5]/60 last:border-0">
                <div className="min-w-0">
                  <p className="font-medium text-[#625346] truncate">{t.originAddress} → {t.destinationAddress}</p>
                  <p className="text-[11px] text-[#958777] tabular-nums">{t.distanceKm} km · {formatShortDate(t.startTime)}</p>
                </div>
                <SeverityText severity={t.status === 'delayed' ? 'high' : 'normal'} label={t.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
