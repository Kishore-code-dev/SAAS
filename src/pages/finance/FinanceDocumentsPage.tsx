import React, { useMemo, useState } from 'react'
import { Download, FileCheck2, History, RefreshCw, Search, ShieldAlert, Upload } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, EnterpriseModal, formatDateTime, formatShortDate, SeverityText } from '../../components/ui/EnterprisePrimitives'
import { useFinance } from '../../hooks/useFinance'
import { useFleet } from '../../hooks/useFleet'
import { canPerformAction } from '../../utils/rbac'
import type { FinanceDocCategory, FinanceDocumentItem } from '../../types/finance'
import { DOC_CATEGORIES, docCategoryLabel, readFileAsBase64 } from '../../utils/financeHelpers'

export default function FinanceDocumentsPage() {
  const { activeRole, activeOrganization } = useFleet()
  const { records, documents, uploadFinanceDocument, verifyFinanceDocument } = useFinance()

  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | FinanceDocCategory>('all')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | FinanceDocumentItem['verificationStatus']>('all')

  // Upload / Replace modal state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [replacingDoc, setReplacingDoc] = useState<FinanceDocumentItem | null>(null)
  const [formFinanceId, setFormFinanceId] = useState('')
  const [formCategory, setFormCategory] = useState<FinanceDocCategory>('loan_agreement')
  const [formTitle, setFormTitle] = useState('')
  const [formExpiry, setFormExpiry] = useState('')
  const [formRenewal, setFormRenewal] = useState(false)
  const [formNotes, setFormNotes] = useState('')
  const [selectedFile, setSelectedFile] = useState<{ fileName: string; mimeType: string; contentBase64: string } | null>(null)
  const [uploading, setUploading] = useState(false)

  // Version history modal
  const [historyDoc, setHistoryDoc] = useState<FinanceDocumentItem | null>(null)

  const canUpload = canPerformAction(activeRole, 'add_finance_records')
  const canVerify = canPerformAction(activeRole, 'reconcile_finance_payments')

  const recordById = useMemo(() => new Map(records.map((r) => [r.id, r])), [records])
  const vehicleOptions = useMemo(
    () => Array.from(new Map(records.map((r) => [r.vehicleId, r.vehicleRegistration])).entries()),
    [records],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return documents.filter((d) => {
      const rec = recordById.get(d.financeId)
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false
      if (vehicleFilter !== 'all' && d.vehicleId !== vehicleFilter) return false
      if (statusFilter !== 'all' && d.verificationStatus !== statusFilter) return false
      if (!q) return true
      return (
        d.title.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        (rec?.vehicleRegistration ?? '').toLowerCase().includes(q) ||
        (rec?.loanReferenceNumber ?? '').toLowerCase().includes(q)
      )
    })
  }, [documents, recordById, categoryFilter, vehicleFilter, statusFilter, query])

  const openUploadModal = (replaceTarget?: FinanceDocumentItem) => {
    setReplacingDoc(replaceTarget ?? null)
    setFormFinanceId(replaceTarget?.financeId ?? records[0]?.id ?? '')
    setFormCategory(replaceTarget?.category ?? 'loan_agreement')
    setFormTitle(replaceTarget?.title ?? '')
    setFormExpiry(replaceTarget?.expiryDate ?? '')
    setFormRenewal(replaceTarget?.requiresRenewal ?? false)
    setFormNotes('')
    setSelectedFile(null)
    setUploadOpen(true)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File exceeds 5 MB maximum upload limit.')
      return
    }
    try {
      const contentBase64 = await readFileAsBase64(file)
      setSelectedFile({ fileName: file.name, mimeType: file.type || 'application/pdf', contentBase64 })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to read selected file.')
    } finally {
      e.target.value = ''
    }
  }

  const submitUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      toast.error('Select a PDF or image file to upload.')
      return
    }
    const rec = recordById.get(formFinanceId)
    if (!rec) {
      toast.error('Select a valid vehicle finance agreement.')
      return
    }
    setUploading(true)
    try {
      await uploadFinanceDocument({
        financeId: rec.id,
        vehicleId: rec.vehicleId,
        category: formCategory,
        title: formTitle.trim() || `${docCategoryLabel(formCategory)} · ${rec.vehicleRegistration}`,
        expiryDate: formExpiry || undefined,
        requiresRenewal: formRenewal,
        parentDocId: replacingDoc?.id,
        notes: formNotes.trim() || undefined,
        fileName: selectedFile.fileName,
        mimeType: selectedFile.mimeType,
        contentBase64: selectedFile.contentBase64,
      })
      toast.success(replacingDoc ? `Uploaded new version v${replacingDoc.version + 1}` : 'Finance document uploaded')
      setUploadOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to upload finance document.')
    } finally {
      setUploading(false)
    }
  }

  const versionChain = useMemo(() => {
    if (!historyDoc) return []
    return documents
      .filter(
        (d) =>
          d.financeId === historyDoc.financeId &&
          d.category === historyDoc.category &&
          (d.id === historyDoc.id || d.parentDocId === historyDoc.id || d.id === historyDoc.parentDocId),
      )
      .sort((a, b) => b.version - a.version)
  }, [documents, historyDoc])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Documents"
        subtitle={`${activeOrganization.name} · Agreements, sanction letters, NOCs, foreclosure letters & versioned receipts`}
      >
        {canUpload && records.length > 0 && (
          <button type="button" onClick={() => openUploadModal()} className="btn-primary text-xs">
            <Upload className="w-3.5 h-3.5" />
            Upload Finance Document
          </button>
        )}
      </PageHeader>

      <div className="enterprise-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#958777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, file, vehicle, loan..."
            aria-label="Search finance documents"
            className="dm-input pl-9 py-2 text-xs"
          />
        </div>
        <select aria-label="Filter by document category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as 'all' | FinanceDocCategory)} className="dm-input py-2 text-xs">
          <option value="all">All 9 Categories</option>
          {DOC_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select aria-label="Filter by vehicle" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="dm-input py-2 text-xs">
          <option value="all">All Vehicles</option>
          {vehicleOptions.map(([id, reg]) => (
            <option key={id} value={id}>{reg}</option>
          ))}
        </select>
        <select aria-label="Filter by verification status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="dm-input py-2 text-xs">
          <option value="all">All Verification States</option>
          <option value="verified">Verified</option>
          <option value="pending_verification">Pending Verification</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptySectionState
          title="No finance documents match your filters"
          description="Upload a loan agreement, sanction letter, NOC, or statement to build the document vault."
        />
      ) : (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table [&_th]:px-2.5 [&_td]:px-2.5 [&_th]:text-[11px]">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Vehicle / Loan</th>
                  <th>Category</th>
                  <th>Version</th>
                  <th>Expiry / Renewal</th>
                  <th>Verification</th>
                  <th>Uploaded</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const rec = recordById.get(d.financeId)
                  return (
                    <tr key={d.id}>
                      <td className="max-w-[210px]">
                        <p className="font-semibold text-[#625346] leading-snug">{d.title}</p>
                        <p className="text-[11px] text-[#958777] truncate">{d.fileName}</p>
                      </td>
                      <td className="text-xs whitespace-nowrap">
                        <span className="font-semibold text-[#625346]">{rec?.vehicleRegistration ?? d.vehicleId}</span>
                        <span className="block text-[11px] font-mono text-[#958777]">{rec?.loanReferenceNumber ?? '—'}</span>
                      </td>
                      <td className="text-xs">{docCategoryLabel(d.category)}</td>
                      <td className="tabular-nums text-xs">
                        <button type="button" onClick={() => setHistoryDoc(d)} className="inline-flex items-center gap-1 text-[#6E5696] font-semibold hover:underline">
                          <History className="w-3 h-3" />
                          v{d.version}
                        </button>
                      </td>
                      <td className="text-xs whitespace-nowrap">
                        {d.expiryDate ? formatShortDate(d.expiryDate) : '—'}
                        {d.requiresRenewal && (
                          <span className="block text-[10.5px] font-semibold text-[#8F6510]">Renewal Flagged</span>
                        )}
                      </td>
                      <td>
                        <SeverityText
                          severity={d.verificationStatus === 'verified' ? 'normal' : d.verificationStatus === 'rejected' ? 'critical' : 'high'}
                          label={d.verificationStatus.replace(/_/g, ' ')}
                        />
                      </td>
                      <td className="text-[11px] text-[#958777] whitespace-nowrap">
                        <p>{d.uploadedBy}</p>
                        <p>{formatShortDate(d.uploadedAt)}</p>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <div className="inline-flex flex-wrap justify-end items-center gap-1">
                          <a href={`/api/finance/documents/${d.id}/download`} target="_blank" rel="noreferrer" className="btn-secondary text-[11px] px-2 py-1">
                            <Download className="w-3 h-3" />
                            Download
                          </a>
                          {canUpload && (
                            <button type="button" onClick={() => openUploadModal(d)} className="btn-secondary text-[11px] px-2 py-1">
                              <RefreshCw className="w-3 h-3" />
                              Replace
                            </button>
                          )}
                          {canVerify && d.verificationStatus !== 'verified' && (
                            <button
                              type="button"
                              onClick={async () => {
                                await verifyFinanceDocument(d.id, 'verified')
                                toast.success(`Verified ${d.title}`)
                              }}
                              className="btn-primary text-[11px] px-2 py-1"
                            >
                              <FileCheck2 className="w-3 h-3" />
                              Verify
                            </button>
                          )}
                          {canVerify && d.verificationStatus !== 'rejected' && (
                            <button
                              type="button"
                              onClick={async () => {
                                await verifyFinanceDocument(d.id, 'rejected', 'Scan unclear or mismatched')
                                toast.info(`Rejected ${d.title}`)
                              }}
                              className="btn-secondary text-[11px] px-2 py-1"
                            >
                              <ShieldAlert className="w-3 h-3 text-[#B84E42]" />
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EnterpriseModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title={replacingDoc ? `Replace Document (v${replacingDoc.version + 1})` : 'Upload Finance Document'}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={submitUpload} className="space-y-3 text-xs">
          <div>
            <label htmlFor="fdoc-loan" className="dm-label">Vehicle Loan Agreement</label>
            <select
              id="fdoc-loan"
              disabled={Boolean(replacingDoc)}
              value={formFinanceId}
              onChange={(e) => setFormFinanceId(e.target.value)}
              className="dm-input text-xs"
            >
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.vehicleRegistration} · {r.loanReferenceNumber} ({r.bankName})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="fdoc-cat" className="dm-label">Category</label>
              <select
                id="fdoc-cat"
                disabled={Boolean(replacingDoc)}
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as FinanceDocCategory)}
                className="dm-input text-xs"
              >
                {DOC_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fdoc-exp" className="dm-label">Expiry / Renewal Date</label>
              <input id="fdoc-exp" type="date" value={formExpiry} onChange={(e) => setFormExpiry(e.target.value)} className="dm-input text-xs tabular-nums" />
            </div>
          </div>
          <div>
            <label htmlFor="fdoc-title" className="dm-label">Document Title</label>
            <input id="fdoc-title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. Signed HDFC Loan Agreement" className="dm-input text-xs" />
          </div>
          <div className="flex items-center gap-2">
            <input id="fdoc-renew" type="checkbox" checked={formRenewal} onChange={(e) => setFormRenewal(e.target.checked)} />
            <label htmlFor="fdoc-renew" className="font-medium text-[#625346]">Flag document as requiring renewal alert</label>
          </div>
          <div>
            <label className="btn-secondary text-xs w-full cursor-pointer justify-center">
              <Upload className="w-3.5 h-3.5" />
              {selectedFile ? selectedFile.fileName : 'Select PDF / Image File'}
              <input type="file" accept=".pdf,image/*" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
          <div>
            <label htmlFor="fdoc-notes" className="dm-label">Notes</label>
            <textarea id="fdoc-notes" rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="dm-input text-xs" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <button type="button" onClick={() => setUploadOpen(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" disabled={uploading} className="btn-primary text-xs">
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </form>
      </EnterpriseModal>

      <EnterpriseModal
        open={Boolean(historyDoc)}
        onClose={() => setHistoryDoc(null)}
        title={historyDoc ? `Version History · ${historyDoc.title}` : 'Version History'}
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-2.5 text-xs">
          {versionChain.map((v) => (
            <div key={v.id} className="p-3 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-[#625346]">v{v.version} · {v.fileName}</p>
                <p className="text-[11px] text-[#958777]">{v.uploadedBy} · {formatDateTime(v.uploadedAt, activeOrganization.timezone)}</p>
              </div>
              <a href={`/api/finance/documents/${v.id}/download`} target="_blank" rel="noreferrer" className="btn-secondary text-[11px] px-2.5 py-1">
                Download
              </a>
            </div>
          ))}
        </div>
      </EnterpriseModal>
    </div>
  )
}
