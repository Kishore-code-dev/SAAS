import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileCheck, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useContracts } from '../../hooks/useContracts'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState } from '../../components/ui/EnterprisePrimitives'

export function ContractDocumentsPage() {
  const navigate = useNavigate()
  const { documents, contracts, hasPermission, verifyContractDoc } = useContracts()
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return documents.filter((d) => {
      const mQ =
        !query ||
        d.title.toLowerCase().includes(query) ||
        (d.documentType ?? '').toLowerCase().includes(query) ||
        d.fileName.toLowerCase().includes(query)
      const mS = statusFilter === 'all' || d.verificationStatus === statusFilter
      return mQ && mS
    })
  }, [documents, q, statusFilter])

  const handleVerify = async (docId: string, status: 'verified' | 'rejected') => {
    try {
      await verifyContractDoc(docId, status)
      toast.success(`Document marked ${status}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update verification')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contract & Compliance Documents"
        subtitle="Signed agreements, amendments, supplier KYC, RC copies, deposit receipts, and handover proof"
      >
        {hasPermission('manage_contract_documents') && (
          <button type="button" onClick={() => navigate('/dashboard/contracts/documents/upload')} className="btn-accent">
            <Plus className="w-4 h-4" />
            Upload Contract Document
          </button>
        )}
      </PageHeader>

      <div className="enterprise-card p-3.5 flex flex-wrap items-center justify-between gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="dm-input py-1.5 text-xs w-44"
        >
          <option value="all">All Verification States</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#958777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, filename..."
            className="dm-input pl-9 py-1.5 text-xs"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptySectionState
          title="No contract documents found"
          description="Upload signed agreements, KYC records, or handover checklists."
          actionLabel={hasPermission('manage_contract_documents') ? 'Upload Document' : undefined}
          onAction={hasPermission('manage_contract_documents') ? () => navigate('/dashboard/contracts/documents/upload') : undefined}
        />
      ) : (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Document Title</th>
                  <th>Type</th>
                  <th>Linked Contract</th>
                  <th>Uploaded By & Date</th>
                  <th>Verification</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const c = contracts.find((x) => x.id === d.contractId)
                  return (
                    <tr key={d.id}>
                      <td>
                        <div className="font-semibold text-xs text-[#625346] flex items-center gap-1.5">
                          <FileCheck className="w-3.5 h-3.5 text-[#6E5696]" />
                          {d.title}
                        </div>
                        <div className="text-[11px] text-[#958777]">{d.fileName}</div>
                      </td>
                      <td className="text-xs capitalize">{(d.documentType ?? '').replace(/_/g, ' ')}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/contracts/register/${d.contractId}`)}
                          className="text-xs font-semibold text-[#6E5696] hover:underline"
                        >
                          {c?.contractCode ?? d.contractId}
                        </button>
                      </td>
                      <td className="text-xs text-[#958777]">
                        {d.uploadedBy} · {d.uploadedAt.slice(0, 10)}
                      </td>
                      <td>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-[6px] text-[11px] font-semibold border capitalize ${
                            d.verificationStatus === 'verified'
                              ? 'bg-[#EDF4EC] text-[#4D6E4A] border-[#C7DEC4]'
                              : d.verificationStatus === 'rejected'
                                ? 'bg-[#FCECEB] text-[#A24034] border-[#F4CBC7]'
                                : 'bg-[#FDF3E7] text-[#8F6510] border-[#F0D9B5]'
                          }`}
                        >
                          {d.verificationStatus}
                        </span>
                      </td>
                      <td className="text-right">
                        {hasPermission('manage_contract_documents') && d.verificationStatus !== 'verified' && (
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleVerify(d.id, 'verified')}
                              className="btn-secondary text-[11px] px-2.5 py-1"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleVerify(d.id, 'rejected')}
                              className="btn-secondary text-[11px] px-2.5 py-1 text-[#A24034]"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export function ContractDocumentUploadPage() {
  const navigate = useNavigate()
  const { contracts, uploadContractDocument } = useContracts()
  const [contractId, setContractId] = useState(contracts[0]?.id ?? '')
  const [documentType, setDocumentType] = useState('signed_agreement')
  const [title, setTitle] = useState('')
  const [fileName, setFileName] = useState('signed-agreement-v1.pdf')
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await uploadContractDocument({
        contractId,
        documentType,
        title,
        fileName,
        expiryDate: expiryDate || undefined,
        notes,
      })
      toast.success('Contract document registered')
      navigate('/dashboard/contracts/documents')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload document')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Upload Contract Document"
        subtitle="Attach signed agreement PDFs, addendum scans, KYC proofs, or vehicle handover forms"
      >
        <button type="button" onClick={() => navigate('/dashboard/contracts/documents')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
          Back to Documents
        </button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="enterprise-card p-6 space-y-5">
        {error && (
          <div role="alert" className="p-3 rounded-[8px] bg-[#FCECEB] border border-[#F4CBC7] text-xs font-semibold text-[#A24034]">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[#625346] mb-1">Contract Agreement *</label>
            <select value={contractId} onChange={(e) => setContractId(e.target.value)} className="dm-input text-xs">
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contractCode} — {c.contractName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Document Category</label>
            <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="dm-input text-xs">
              <option value="signed_agreement">Signed Master Agreement</option>
              <option value="amendment_addendum">Amendment / Addendum</option>
              <option value="deposit_receipt">Security Deposit Receipt</option>
              <option value="partner_kyc">Partner KYC / GST Certificate</option>
              <option value="owner_kyc">Owner KYC (PAN / Aadhaar)</option>
              <option value="handover_checklist">Handover Checklist Scan</option>
              <option value="settlement_voucher">Closure Settlement Voucher</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Document Title *</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Executed Master Agreement" className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">File Reference / Name *</label>
            <input required value={fileName} onChange={(e) => setFileName(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Document Expiry Date (Optional)</label>
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="dm-input text-xs" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[#625346] mb-1">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="dm-input text-xs" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/dashboard/contracts/documents')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-accent">
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Uploading...' : 'Save Contract Document'}
          </button>
        </div>
      </form>
    </div>
  )
}
