import type {
  FinanceDocCategory,
  FinanceInterestType,
  FinanceLoanType,
  FinancePaymentMethod,
} from '../types/finance'

export function loanTypeLabel(t: FinanceLoanType, custom?: string): string {
  switch (t) {
    case 'vehicle_loan':
      return 'Vehicle Loan'
    case 'commercial_vehicle_loan':
      return 'Commercial Vehicle Loan'
    case 'lease':
      return 'Lease'
    case 'hire_purchase':
      return 'Hire Purchase'
    case 'other':
      return custom?.trim() || 'Other Finance'
  }
}

export function interestTypeLabel(t: FinanceInterestType): string {
  switch (t) {
    case 'reducing_balance':
      return 'Reducing Balance'
    case 'flat_rate':
      return 'Flat Rate'
    case 'lease_fixed':
      return 'Lease Fixed'
    case 'interest_only_balloon':
      return 'Interest-Only + Balloon'
    case 'custom':
      return 'Custom Schedule'
  }
}

export function paymentMethodLabel(m: FinancePaymentMethod): string {
  return m.replace(/_/g, ' ').toUpperCase()
}

export const DOC_CATEGORIES: Array<{ value: FinanceDocCategory; label: string }> = [
  { value: 'loan_agreement', label: 'Loan Agreement' },
  { value: 'loan_sanction_letter', label: 'Loan Sanction Letter' },
  { value: 'emi_schedule', label: 'EMI Schedule' },
  { value: 'bank_statements', label: 'Bank Statements' },
  { value: 'payment_receipts', label: 'Payment Receipts' },
  { value: 'noc', label: 'NOC' },
  { value: 'foreclosure_letter', label: 'Foreclosure Letter' },
  { value: 'insurance_finance_docs', label: 'Insurance-related Finance Documents' },
  { value: 'other_supporting_docs', label: 'Other Supporting Documents' },
]

export function docCategoryLabel(cat: FinanceDocCategory): string {
  return DOC_CATEGORIES.find((c) => c.value === cat)?.label ?? cat.replace(/_/g, ' ')
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(new Error('Failed to read selected file.'))
    reader.readAsDataURL(file)
  })
}

export function exportRowsToCsv(fileName: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (v: string | number) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportRowsToExcelHtml(fileName: string, title: string, headers: string[], rows: Array<Array<string | number>>) {
  const esc = (v: string | number) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  const html = `<html><head><meta charset="utf-8" /></head><body><h3>${esc(title)}</h3><table border="1"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.xls') ? fileName : `${fileName}.xls`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
