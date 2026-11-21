import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { OrganizationRole } from '../src/types/fleet.ts'
import type {
  EmiInstalment,
  EmiPaymentStatus,
  FinanceAlertEvent,
  FinanceDocCategory,
  FinanceDocumentItem,
  FinanceInterestType,
  FinanceLoanType,
  FinanceNotificationSettings,
  FinancePaymentMethod,
  FinancePaymentTransaction,
  FinanceUpdateHistoryEntry,
  FinanceWorkspacePayload,
  FinancialInstitution,
  ReconciliationStatus,
  VehicleFinanceRecord,
  VehicleFinanceStatus,
} from '../src/types/finance.ts'
import {
  applyEmiPaymentCalculation,
  buildRestructuredSchedule,
  deriveEmiStatus,
  evaluateFinanceAlerts,
  generateAmortisationSchedule,
  getTodayIsoInTz,
  maskAccountNumber,
  maskFinanceWorkspaceForRole,
  roundInr,
  summarizeVehicleFinanceRecord,
} from '../src/utils/financeEngine.ts'
import { canPerformAction } from '../src/utils/rbac.ts'
import { ALLOWED_DOCUMENT_MIMES, MAX_DOCUMENT_BYTES } from './authLogic.ts'
import { getUploadsDir, mapOrgRow } from './db.ts'

export interface FinanceActor {
  userId: string
  username: string
  fullName: string
  role: OrganizationRole
}

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER)
}

export function ensureFinanceSchemaAndSeed(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS finance_institutions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      institution_type TEXT NOT NULL,
      branch TEXT NOT NULL,
      relationship_manager TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      email TEXT NOT NULL,
      ifsc_code TEXT NOT NULL,
      default_payment_method TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vehicle_finance_records (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      institution_id TEXT,
      vehicle_registration TEXT NOT NULL,
      vehicle_name TEXT NOT NULL,
      vehicle_make_model TEXT NOT NULL,
      vehicle_ownership TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      institution_name TEXT NOT NULL,
      branch TEXT NOT NULL,
      relationship_manager TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      email TEXT NOT NULL,
      ifsc_code TEXT NOT NULL,
      loan_account_number TEXT NOT NULL,
      loan_account_masked TEXT NOT NULL,
      loan_reference_number TEXT NOT NULL,
      loan_type TEXT NOT NULL,
      custom_loan_type_label TEXT,
      principal_amount REAL NOT NULL,
      down_payment REAL NOT NULL,
      net_financed_amount REAL NOT NULL,
      interest_rate_annual_pct REAL NOT NULL,
      interest_type TEXT NOT NULL,
      loan_start_date TEXT NOT NULL,
      loan_tenure_months INTEGER NOT NULL,
      number_of_instalments INTEGER NOT NULL,
      emi_amount REAL NOT NULL,
      first_emi_date TEXT NOT NULL,
      final_emi_date TEXT NOT NULL,
      processing_fees REAL NOT NULL DEFAULT 0,
      other_charges REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      finance_status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS finance_emi_instalments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      finance_id TEXT NOT NULL REFERENCES vehicle_finance_records(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL,
      emi_number INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      opening_principal REAL NOT NULL,
      principal_component REAL NOT NULL,
      interest_component REAL NOT NULL,
      emi_amount REAL NOT NULL,
      late_fee_inr REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      remaining_amount REAL NOT NULL,
      payment_date TEXT,
      status TEXT NOT NULL,
      reconciliation_status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS finance_payments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      finance_id TEXT NOT NULL REFERENCES vehicle_finance_records(id) ON DELETE CASCADE,
      emi_id TEXT NOT NULL REFERENCES finance_emi_instalments(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL,
      emi_number INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      amount_inr REAL NOT NULL,
      late_fee_component_inr REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      bank_transaction_ref TEXT NOT NULL,
      bank_transaction_ref_masked TEXT NOT NULL,
      receipt_doc_id TEXT,
      receipt_file_name TEXT,
      reconciliation_status TEXT NOT NULL DEFAULT 'pending',
      reconciled_by TEXT,
      reconciled_at TEXT,
      correction_of_payment_id TEXT,
      correction_reason TEXT,
      is_corrected INTEGER NOT NULL DEFAULT 0,
      recorded_by TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS finance_documents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      finance_id TEXT NOT NULL REFERENCES vehicle_finance_records(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      storage_key TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      parent_doc_id TEXT,
      verification_status TEXT NOT NULL DEFAULT 'pending_verification',
      verified_by TEXT,
      verified_at TEXT,
      expiry_date TEXT,
      requires_renewal INTEGER NOT NULL DEFAULT 0,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS finance_notification_settings (
      organization_id TEXT PRIMARY KEY,
      reminder_days_json TEXT NOT NULL,
      notify_after_due_date INTEGER NOT NULL DEFAULT 1,
      overdue_escalation_days INTEGER NOT NULL DEFAULT 5,
      in_app_enabled INTEGER NOT NULL DEFAULT 1,
      email_enabled INTEGER NOT NULL DEFAULT 1,
      recipient_roles_json TEXT NOT NULL,
      recipient_emails_json TEXT NOT NULL,
      default_currency TEXT NOT NULL DEFAULT 'INR',
      default_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      default_reporting_period TEXT NOT NULL DEFAULT 'monthly',
      partial_payment_rule TEXT NOT NULL DEFAULT 'allow_partial',
      due_soon_window_days INTEGER NOT NULL DEFAULT 7,
      allow_manual_late_fee_entry INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS finance_alerts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      finance_id TEXT NOT NULL,
      emi_id TEXT,
      vehicle_id TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      channel_summary TEXT NOT NULL,
      action_route TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      acknowledged INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS finance_update_history (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      finance_id TEXT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      previous_value TEXT NOT NULL,
      updated_value TEXT NOT NULL,
      update_reason TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      updated_by_role TEXT NOT NULL,
      update_date TEXT NOT NULL,
      approval_status TEXT NOT NULL DEFAULT 'approved'
    );
  `)

  seedFinanceDataIfEmpty(db)
  seedAdditionalDummyFinanceIfNeeded(db)
}

function addDaysIso(baseIso: string, days: number): string {
  const ms = Date.parse(`${baseIso.slice(0, 10)}T00:00:00Z`) + days * 86400000
  return new Date(ms).toISOString().slice(0, 10)
}

function addMonthsToDate(baseIso: string, months: number): string {
  const [yStr, mStr, dStr] = baseIso.slice(0, 10).split('-')
  const y = Number(yStr)
  const m = Number(mStr) - 1 + months
  const targetY = y + Math.floor(m / 12)
  const targetM = ((m % 12) + 12) % 12
  const maxD = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate()
  const d = Math.min(Number(dStr) || 1, maxD)
  return `${targetY}-${String(targetM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function seedFinanceDataIfEmpty(db: DatabaseSync): void {
  const countRow = db
    .prepare('SELECT COUNT(*) AS count FROM finance_institutions')
    .get() as { count: number }
  if (countRow.count > 0) return

  const todayIso = getTodayIsoInTz('Asia/Kolkata')
  const nowIso = new Date().toISOString()

  // Seed default finance settings for all existing organizations
  const orgRows = db.prepare('SELECT * FROM organizations').all() as Record<string, unknown>[]
  for (const r of orgRows) {
    const org = mapOrgRow(r)
    ensureOrgSettingsRow(db, org.id, org.timezone || 'Asia/Kolkata', org.ownerEmail ? [org.ownerEmail] : [])
  }

  // Seed Kaveri institutions
  const institutions: FinancialInstitution[] = [
    {
      id: 'inst-k-hdfc',
      organizationId: 'org-kaveri',
      bankName: 'HDFC Bank Commercial',
      institutionType: 'bank',
      branch: 'Guindy Industrial Estate, Chennai',
      relationshipManager: 'Raghavan Subramanian',
      contactNumber: '+91 98401 44120',
      email: 'raghavan.cv@hdfcbank.com',
      ifscCode: 'HDFC0000128',
      defaultPaymentMethod: 'nach',
      active: true,
      notes: 'Primary commercial fleet credit line for TN corridor trucks.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'inst-k-chola',
      organizationId: 'org-kaveri',
      bankName: 'Cholamandalam Investment & Finance',
      institutionType: 'nbfc',
      branch: 'KK Nagar Hub, Madurai',
      relationshipManager: 'Arjun Pandian',
      contactNumber: '+91 98421 77210',
      email: 'arjun.p@chola.murugappa.com',
      ifscCode: 'CHOL0001104',
      defaultPaymentMethod: 'ecs',
      active: true,
      notes: 'Heavy & light commercial vehicle NBFC desk.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'inst-k-sbi',
      organizationId: 'org-kaveri',
      bankName: 'State Bank of India SME',
      institutionType: 'bank',
      branch: 'Five Roads Commercial Branch, Salem',
      relationshipManager: 'Meenakshi Sundaram',
      contactNumber: '+91 94431 55209',
      email: 'meenakshi.sme@sbi.co.in',
      ifscCode: 'SBIN0004218',
      defaultPaymentMethod: 'neft',
      active: true,
      notes: 'Equipment & medium truck term loan facility.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'inst-k-tata',
      organizationId: 'org-kaveri',
      bankName: 'Tata Motors Finance EV Leasing',
      institutionType: 'oem_captive',
      branch: 'Ambattur EV Desk, Chennai',
      relationshipManager: 'Vikramaditya Rao',
      contactNumber: '+91 97909 22190',
      email: 'vikram.ev@tmf.co.in',
      ifscCode: 'TMFL0000091',
      defaultPaymentMethod: 'nach',
      active: true,
      notes: 'Dedicated EV lease & captive fleet financing partner.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'inst-k-sundaram',
      organizationId: 'org-kaveri',
      bankName: 'Sundaram Finance Ltd',
      institutionType: 'nbfc',
      branch: 'Avinashi Road, Coimbatore',
      relationshipManager: 'Senthil Nathan K',
      contactNumber: '+91 98940 88211',
      email: 'senthil.k@sundaramfinance.in',
      ifscCode: 'SUNF0000312',
      defaultPaymentMethod: 'rtgs',
      active: true,
      notes: 'Hire purchase & long-haul heavy truck desk.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'inst-d-icici',
      organizationId: 'org-deccan',
      bankName: 'ICICI Bank Fleet Credit',
      institutionType: 'bank',
      branch: 'Koramangala Commercial, Bengaluru',
      relationshipManager: 'Ananya Deshpande',
      contactNumber: '+91 98801 33419',
      email: 'ananya.d@icicibank.com',
      ifscCode: 'ICIC0000291',
      defaultPaymentMethod: 'nach',
      active: true,
      notes: 'EV urban freight leasing and loan partner.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ]

  const insertInst = db.prepare(`
    INSERT INTO finance_institutions (
      id, organization_id, bank_name, institution_type, branch, relationship_manager,
      contact_number, email, ifsc_code, default_payment_method, active, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const inst of institutions) {
    insertInst.run(
      inst.id,
      inst.organizationId,
      inst.bankName,
      inst.institutionType,
      inst.branch,
      inst.relationshipManager,
      inst.contactNumber,
      inst.email,
      inst.ifscCode,
      inst.defaultPaymentMethod,
      inst.active ? 1 : 0,
      inst.notes ?? null,
      inst.createdAt,
      inst.updatedAt,
    )
  }

  // Helper to seed one loan + schedule + payments + docs cleanly
  const seedLoan = (cfg: {
    id: string
    orgId: string
    vehicleId: string
    vehicleRegistration: string
    vehicleName: string
    vehicleMakeModel: string
    vehicleOwnership: VehicleFinanceRecord['vehicleOwnership']
    inst: FinancialInstitution
    loanAccountNumber: string
    loanReferenceNumber: string
    loanType: FinanceLoanType
    principalAmount: number
    downPayment: number
    interestRateAnnualPct: number
    interestType: FinanceInterestType
    numberOfInstalments: number
    firstEmiDate: string
    processingFees: number
    otherCharges: number
    paidCount: number
    partialNext?: { amount: number; lateFee?: number }
    customEmiAmount?: number
    notes?: string
    docs: Array<{
      category: FinanceDocCategory
      title: string
      fileName: string
      verified: boolean
      expiryDate?: string
      requiresRenewal?: boolean
    }>
  }) => {
    const netFinanced = roundInr(cfg.principalAmount - cfg.downPayment)
    const sched = generateAmortisationSchedule({
      organizationId: cfg.orgId,
      financeId: cfg.id,
      vehicleId: cfg.vehicleId,
      netFinancedAmount: netFinanced,
      interestRateAnnualPct: cfg.interestRateAnnualPct,
      interestType: cfg.interestType,
      numberOfInstalments: cfg.numberOfInstalments,
      firstEmiDate: cfg.firstEmiDate,
      customEmiAmount: cfg.customEmiAmount,
      nowIso,
    })

    const loanStartDate = addMonthsToDate(cfg.firstEmiDate, -1)
    const maskedAcc = maskAccountNumber(cfg.loanAccountNumber)

    db.prepare(`
      INSERT INTO vehicle_finance_records (
        id, organization_id, vehicle_id, institution_id, vehicle_registration, vehicle_name,
        vehicle_make_model, vehicle_ownership, bank_name, institution_name, branch,
        relationship_manager, contact_number, email, ifsc_code, loan_account_number,
        loan_account_masked, loan_reference_number, loan_type, custom_loan_type_label,
        principal_amount, down_payment, net_financed_amount, interest_rate_annual_pct,
        interest_type, loan_start_date, loan_tenure_months, number_of_instalments,
        emi_amount, first_emi_date, final_emi_date, processing_fees, other_charges,
        payment_method, finance_status, notes, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cfg.id,
      cfg.orgId,
      cfg.vehicleId,
      cfg.inst.id,
      cfg.vehicleRegistration,
      cfg.vehicleName,
      cfg.vehicleMakeModel,
      cfg.vehicleOwnership,
      cfg.inst.bankName,
      cfg.inst.bankName,
      cfg.inst.branch,
      cfg.inst.relationshipManager,
      cfg.inst.contactNumber,
      cfg.inst.email,
      cfg.inst.ifscCode,
      cfg.loanAccountNumber,
      maskedAcc,
      cfg.loanReferenceNumber,
      cfg.loanType,
      null,
      cfg.principalAmount,
      cfg.downPayment,
      netFinanced,
      cfg.interestRateAnnualPct,
      cfg.interestType,
      loanStartDate,
      cfg.numberOfInstalments,
      cfg.numberOfInstalments,
      sched.emiAmount,
      cfg.firstEmiDate,
      sched.finalEmiDate,
      cfg.processingFees,
      cfg.otherCharges,
      cfg.inst.defaultPaymentMethod,
      cfg.paidCount >= cfg.numberOfInstalments ? 'completed' : 'active',
      cfg.notes ?? null,
      nowIso,
      nowIso,
      'Karthikeyan R',
    )

    const insertEmi = db.prepare(`
      INSERT INTO finance_emi_instalments (
        id, organization_id, finance_id, vehicle_id, emi_number, due_date, opening_principal,
        principal_component, interest_component, emi_amount, late_fee_inr, amount_paid,
        remaining_amount, payment_date, status, reconciliation_status, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertPay = db.prepare(`
      INSERT INTO finance_payments (
        id, organization_id, finance_id, emi_id, vehicle_id, emi_number, payment_date,
        amount_inr, late_fee_component_inr, payment_method, bank_transaction_ref,
        bank_transaction_ref_masked, receipt_doc_id, receipt_file_name, reconciliation_status,
        reconciled_by, reconciled_at, correction_of_payment_id, correction_reason,
        is_corrected, recorded_by, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (let idx = 0; idx < sched.instalments.length; idx++) {
      let emi = sched.instalments[idx]
      let reconStatus: ReconciliationStatus = 'pending'
      let pendingPay: {
        id: string
        date: string
        amount: number
        lateFee: number
        method: FinancePaymentMethod
        txRef: string
        receiptFile: string | null
        recon: ReconciliationStatus
        reconBy: string | null
        reconAt: string | null
        notes: string
        createdAt: string
      } | null = null

      if (idx < cfg.paidCount) {
        const applied = applyEmiPaymentCalculation(emi, emi.emiAmount, 0, emi.dueDate, true)
        emi = applied.updatedEmi
        reconStatus = 'reconciled'
        const txRef = `UTR${cfg.inst.ifscCode.slice(0, 4)}${String(260000 + idx * 137 + cfg.id.charCodeAt(4))}`
        pendingPay = {
          id: `fpay-${cfg.id}-${emi.emiNumber}`,
          date: emi.dueDate,
          amount: emi.emiAmount,
          lateFee: 0,
          method: cfg.inst.defaultPaymentMethod,
          txRef,
          receiptFile: `Receipt_EMI_${emi.emiNumber}.pdf`,
          recon: 'reconciled',
          reconBy: 'Lakshmi Narayanan',
          reconAt: `${emi.dueDate}T11:30:00.000Z`,
          notes: `Auto-debit / bank cleared for EMI #${emi.emiNumber}`,
          createdAt: `${emi.dueDate}T10:15:00.000Z`,
        }
      } else if (idx === cfg.paidCount && cfg.partialNext) {
        const lateFee = cfg.partialNext.lateFee ?? 0
        const applied = applyEmiPaymentCalculation(emi, cfg.partialNext.amount, lateFee, addDaysIso(emi.dueDate, 2), true)
        emi = applied.updatedEmi
        reconStatus = 'pending'
        const txRef = `UTRPART${String(881000 + cfg.id.charCodeAt(4))}`
        pendingPay = {
          id: `fpay-${cfg.id}-${emi.emiNumber}-p1`,
          date: addDaysIso(emi.dueDate, 2),
          amount: cfg.partialNext.amount,
          lateFee,
          method: 'neft',
          txRef,
          receiptFile: null,
          recon: 'pending',
          reconBy: null,
          reconAt: null,
          notes: 'Partial instalment transfer pending bank statement reconciliation',
          createdAt: nowIso,
        }
      } else {
        emi = {
          ...emi,
          status: deriveEmiStatus(emi, todayIso, 7),
        }
      }

      insertEmi.run(
        emi.id,
        emi.organizationId,
        emi.financeId,
        emi.vehicleId,
        emi.emiNumber,
        emi.dueDate,
        emi.openingPrincipal,
        emi.principalComponent,
        emi.interestComponent,
        emi.emiAmount,
        emi.lateFeeInr,
        emi.amountPaid,
        emi.remainingAmount,
        emi.paymentDate,
        emi.status,
        reconStatus,
        emi.notes ?? null,
        nowIso,
      )

      if (pendingPay) {
        insertPay.run(
          pendingPay.id,
          cfg.orgId,
          cfg.id,
          emi.id,
          cfg.vehicleId,
          emi.emiNumber,
          pendingPay.date,
          pendingPay.amount,
          pendingPay.lateFee,
          pendingPay.method,
          pendingPay.txRef,
          maskAccountNumber(pendingPay.txRef),
          null,
          pendingPay.receiptFile,
          pendingPay.recon,
          pendingPay.reconBy,
          pendingPay.reconAt,
          null,
          null,
          0,
          'Lakshmi Narayanan',
          pendingPay.notes,
          pendingPay.createdAt,
        )
      }
    }

    const insertDoc = db.prepare(`
      INSERT INTO finance_documents (
        id, organization_id, finance_id, vehicle_id, category, title, file_name,
        mime_type, file_size_bytes, storage_key, version, parent_doc_id,
        verification_status, verified_by, verified_at, expiry_date, requires_renewal,
        uploaded_by, uploaded_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    cfg.docs.forEach((doc, i) => {
      insertDoc.run(
        `fdoc-${cfg.id}-${i + 1}`,
        cfg.orgId,
        cfg.id,
        cfg.vehicleId,
        doc.category,
        doc.title,
        doc.fileName,
        'application/pdf',
        184320,
        `seed/${cfg.id}/${doc.fileName}`,
        1,
        null,
        doc.verified ? 'verified' : 'pending_verification',
        doc.verified ? 'Lakshmi Narayanan' : null,
        doc.verified ? nowIso : null,
        doc.expiryDate ?? null,
        doc.requiresRenewal ? 1 : 0,
        'Karthikeyan R',
        nowIso,
        null,
      )
    })

    db.prepare(`
      INSERT INTO finance_update_history (
        id, organization_id, finance_id, entity_type, entity_id, field_name,
        previous_value, updated_value, update_reason, updated_by, updated_by_role,
        update_date, approval_status
      ) VALUES (?, ?, ?, 'finance_record', ?, 'Initial Registration', 'None', ?, ?, 'Karthikeyan R', 'org_admin', ?, 'approved')
    `).run(
      `fhist-init-${cfg.id}`,
      cfg.orgId,
      cfg.id,
      cfg.id,
      `${cfg.loanReferenceNumber} (${cfg.inst.bankName}) · Net Financed ₹${netFinanced.toLocaleString('en-IN')}`,
      'Initial vehicle finance facility onboarded into DriveMitra Finance Register.',
      nowIso,
    )
  }

  // 1. Active loan on TN 38 AB 1234 (next EMI due in 3 days -> Due Soon)
  seedLoan({
    id: 'fin-k-1',
    orgId: 'org-kaveri',
    vehicleId: 'v-k1',
    vehicleRegistration: 'TN 38 AB 1234',
    vehicleName: 'Tata Ace Gold Diesel+',
    vehicleMakeModel: 'Tata Ace Gold Diesel+',
    vehicleOwnership: 'Financed',
    inst: institutions[0],
    loanAccountNumber: 'HDFC901288334411',
    loanReferenceNumber: 'CVL-HDFC-2025-101',
    loanType: 'commercial_vehicle_loan',
    principalAmount: 850000,
    downPayment: 150000,
    interestRateAnnualPct: 9.4,
    interestType: 'reducing_balance',
    numberOfInstalments: 24,
    firstEmiDate: addDaysIso(addMonthsToDate(todayIso, -6), 3),
    processingFees: 6500,
    otherCharges: 1200,
    paidCount: 6,
    notes: 'NACH mandate active on HDFC Chennai Corporate Current A/C.',
    docs: [
      { category: 'loan_agreement', title: 'Hypothecation & Loan Agreement — TN 38 AB 1234', fileName: 'HDFC_Loan_Agreement_TN38AB1234.pdf', verified: true },
      { category: 'loan_sanction_letter', title: 'Sanction Letter CVL-HDFC-2025-101', fileName: 'HDFC_Sanction_Letter_101.pdf', verified: true },
      { category: 'emi_schedule', title: 'Approved 24M Amortisation Sheet', fileName: 'HDFC_Amortisation_101.pdf', verified: true },
    ],
  })

  // 2. Overdue + Partially Paid loan on TN 58 CD 5678 (EMI #6 overdue & partially paid, missing sanction letter)
  seedLoan({
    id: 'fin-k-2',
    orgId: 'org-kaveri',
    vehicleId: 'v-k2',
    vehicleRegistration: 'TN 58 CD 5678',
    vehicleName: 'Ashok Leyland Dost Strong',
    vehicleMakeModel: 'Ashok Leyland Dost Strong',
    vehicleOwnership: 'Financed',
    inst: institutions[1],
    loanAccountNumber: 'CHOL773190228842',
    loanReferenceNumber: 'VL-CHOL-2025-204',
    loanType: 'vehicle_loan',
    principalAmount: 980000,
    downPayment: 180000,
    interestRateAnnualPct: 10.5,
    interestType: 'reducing_balance',
    numberOfInstalments: 24,
    firstEmiDate: addDaysIso(addMonthsToDate(todayIso, -5), -6),
    processingFees: 7500,
    otherCharges: 1500,
    paidCount: 5,
    partialNext: { amount: 15000, lateFee: 500 },
    notes: 'Partial NEFT settled; balance overdue EMI #6 awaiting reconciliation.',
    docs: [
      { category: 'loan_agreement', title: 'Chola Loan Agreement — TN 58 CD 5678', fileName: 'Chola_Agreement_TN58CD5678.pdf', verified: true },
      { category: 'insurance_finance_docs', title: 'Hypothecated Motor Insurance Endorsement', fileName: 'ICICI_Hypothecation_Endorsement.pdf', verified: true, expiryDate: addDaysIso(todayIso, 18), requiresRenewal: true },
    ],
  })

  // 3. Loan nearing completion on TN 30 EF 9012 (11/12 paid, last EMI due in 12 days)
  seedLoan({
    id: 'fin-k-3',
    orgId: 'org-kaveri',
    vehicleId: 'v-k3',
    vehicleRegistration: 'TN 30 EF 9012',
    vehicleName: 'Eicher Pro 2049',
    vehicleMakeModel: 'Eicher Pro 2049',
    vehicleOwnership: 'Financed',
    inst: institutions[2],
    loanAccountNumber: 'SBIN440912885519',
    loanReferenceNumber: 'SME-SBI-2025-088',
    loanType: 'commercial_vehicle_loan',
    principalAmount: 1850000,
    downPayment: 350000,
    interestRateAnnualPct: 8.9,
    interestType: 'reducing_balance',
    numberOfInstalments: 12,
    firstEmiDate: addDaysIso(addMonthsToDate(todayIso, -11), 12),
    processingFees: 9000,
    otherCharges: 0,
    paidCount: 11,
    notes: 'Final instalment upcoming; NOC request to be raised after clearance.',
    docs: [
      { category: 'loan_agreement', title: 'SBI Term Loan Agreement — TN 30 EF 9012', fileName: 'SBI_Loan_Agreement_088.pdf', verified: true },
      { category: 'loan_sanction_letter', title: 'SBI SME Fleet Sanction Letter', fileName: 'SBI_Sanction_088.pdf', verified: true },
    ],
  })

  // 4. EV Lease on TN 01 EV 4401 (Due Today!)
  seedLoan({
    id: 'fin-k-4',
    orgId: 'org-kaveri',
    vehicleId: 'v-k5',
    vehicleRegistration: 'TN 01 EV 4401',
    vehicleName: 'Tata Ace EV Cargo',
    vehicleMakeModel: 'Tata Ace EV Cargo',
    vehicleOwnership: 'Leased',
    inst: institutions[3],
    loanAccountNumber: 'TMFL661029384756',
    loanReferenceNumber: 'EVL-TMF-2026-019',
    loanType: 'lease',
    principalAmount: 1120000,
    downPayment: 120000,
    interestRateAnnualPct: 7.8,
    interestType: 'lease_fixed',
    numberOfInstalments: 36,
    firstEmiDate: addMonthsToDate(todayIso, -4),
    processingFees: 4000,
    otherCharges: 500,
    paidCount: 4,
    notes: 'EV Fleet Operating Lease with battery warranty endorsement.',
    docs: [
      { category: 'loan_agreement', title: 'Master EV Fleet Lease Agreement', fileName: 'TMF_EV_Lease_019.pdf', verified: true },
      { category: 'loan_sanction_letter', title: 'EV Lease Sanction & Residual Sheet', fileName: 'TMF_Sanction_019.pdf', verified: true },
    ],
  })

  // 5. Completed Hire Purchase on TN 39 GH 3456
  seedLoan({
    id: 'fin-k-5',
    orgId: 'org-kaveri',
    vehicleId: 'v-k4',
    vehicleRegistration: 'TN 39 GH 3456',
    vehicleName: 'BharatBenz 1617R',
    vehicleMakeModel: 'BharatBenz 1617R',
    vehicleOwnership: 'Owned',
    inst: institutions[4],
    loanAccountNumber: 'SUNF881920334400',
    loanReferenceNumber: 'HP-SUN-2024-042',
    loanType: 'hire_purchase',
    principalAmount: 2400000,
    downPayment: 400000,
    interestRateAnnualPct: 9.8,
    interestType: 'flat_rate',
    numberOfInstalments: 12,
    firstEmiDate: addMonthsToDate(todayIso, -13),
    processingFees: 12000,
    otherCharges: 0,
    paidCount: 12,
    notes: 'All 12 hire-purchase instalments settled; Form 35 & NOC issued.',
    docs: [
      { category: 'loan_agreement', title: 'Sundaram Hire Purchase Deed', fileName: 'Sundaram_HP_042.pdf', verified: true },
      { category: 'loan_sanction_letter', title: 'Sundaram Sanction Advice', fileName: 'Sundaram_Sanction_042.pdf', verified: true },
      { category: 'noc', title: 'NOC & Form 35 Hypothecation Termination', fileName: 'Sundaram_NOC_TN39GH3456.pdf', verified: true },
    ],
  })

  // 6. Historical Completed Accessory/Body-Building Loan on TN 38 AB 1234 (demonstrates multiple finance records per vehicle)
  seedLoan({
    id: 'fin-k-0',
    orgId: 'org-kaveri',
    vehicleId: 'v-k1',
    vehicleRegistration: 'TN 38 AB 1234',
    vehicleName: 'Tata Ace Gold Diesel+ (Cold Box Fitment)',
    vehicleMakeModel: 'Tata Ace Gold Diesel+',
    vehicleOwnership: 'Financed',
    inst: institutions[2],
    loanAccountNumber: 'SBIN102938470012',
    loanReferenceNumber: 'EQP-SBI-2024-007',
    loanType: 'other',
    principalAmount: 240000,
    downPayment: 40000,
    interestRateAnnualPct: 8.5,
    interestType: 'reducing_balance',
    numberOfInstalments: 6,
    firstEmiDate: addMonthsToDate(todayIso, -10),
    processingFees: 2000,
    otherCharges: 0,
    paidCount: 6,
    notes: 'Historical closed insulated container body finance.',
    docs: [
      { category: 'loan_agreement', title: 'Container Body Equipment Finance Deed', fileName: 'SBI_Equip_007.pdf', verified: true },
      { category: 'loan_sanction_letter', title: 'Equipment Finance Sanction', fileName: 'SBI_Equip_Sanction_007.pdf', verified: true },
      { category: 'noc', title: 'Equipment Closure NOC', fileName: 'SBI_Equip_NOC_007.pdf', verified: true },
    ],
  })

  // Seed Deccan EV fleet loan
  seedLoan({
    id: 'fin-d-1',
    orgId: 'org-deccan',
    vehicleId: 'v-d1',
    vehicleRegistration: 'KA 01 EV 7101',
    vehicleName: 'Tata Ultra T.7 Electric',
    vehicleMakeModel: 'Tata Ultra T.7 Electric',
    vehicleOwnership: 'Financed',
    inst: institutions[5],
    loanAccountNumber: 'ICIC551092837461',
    loanReferenceNumber: 'EV-ICIC-2026-301',
    loanType: 'commercial_vehicle_loan',
    principalAmount: 2650000,
    downPayment: 450000,
    interestRateAnnualPct: 8.4,
    interestType: 'reducing_balance',
    numberOfInstalments: 36,
    firstEmiDate: addDaysIso(addMonthsToDate(todayIso, -3), 5),
    processingFees: 11000,
    otherCharges: 0,
    paidCount: 3,
    docs: [
      { category: 'loan_agreement', title: 'ICICI Green Fleet Loan Agreement', fileName: 'ICICI_EV_301.pdf', verified: true },
      { category: 'loan_sanction_letter', title: 'ICICI Green Credit Sanction', fileName: 'ICICI_Sanction_301.pdf', verified: true },
    ],
  })

  // Sync alerts for seeded orgs
  for (const orgId of ['org-kaveri', 'org-deccan']) {
    syncFinanceAlertsInDb(db, orgId, 'Asia/Kolkata')
  }
}

function seedAdditionalDummyFinanceIfNeeded(db: DatabaseSync): void {
  // Normalize any earlier category/reconciliation literals if already inserted
  db.prepare("UPDATE finance_documents SET category = 'bank_statements' WHERE category = 'bank_statement'").run()
  db.prepare("UPDATE finance_documents SET category = 'other_supporting_docs' WHERE category = 'other'").run()
  db.prepare("UPDATE finance_payments SET reconciliation_status = 'discrepancy' WHERE reconciliation_status = 'disputed'").run()
  db.prepare("UPDATE finance_emi_instalments SET reconciliation_status = 'discrepancy' WHERE reconciliation_status = 'disputed'").run()

  const hasFinance = (id: string): boolean =>
    (db.prepare('SELECT COUNT(*) AS count FROM vehicle_finance_records WHERE id = ?').get(id) as { count: number }).count > 0
  if (hasFinance('fin-k-6') && hasFinance('fin-k-9') && hasFinance('fin-d-2')) {
    return
  }

  const todayIso = getTodayIsoInTz('Asia/Kolkata')
  const nowIso = new Date().toISOString()

  const adminKaveri: FinanceActor = {
    userId: 'u-k1',
    username: 'kaveri.owner',
    fullName: 'Karthikeyan R',
    role: 'org_admin',
  }
  const financeKaveri: FinanceActor = {
    userId: 'u-k4',
    username: 'kaveri.finance',
    fullName: 'Lakshmi Narayanan',
    role: 'finance',
  }

  const insertInstIgnore = db.prepare(`
    INSERT OR IGNORE INTO finance_institutions (
      id, organization_id, bank_name, institution_type, branch, relationship_manager,
      contact_number, email, ifsc_code, default_payment_method, active, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const extraInstitutions: FinancialInstitution[] = [
    {
      id: 'inst-k-axis',
      organizationId: 'org-kaveri',
      bankName: 'Axis Bank Commercial Fleet Desk',
      institutionType: 'bank',
      branch: 'Mount Road Corporate Hub, Chennai',
      relationshipManager: 'Deepak Rajagopal',
      contactNumber: '+91 98407 61209',
      email: 'deepak.fleet@axisbank.com',
      ifscCode: 'UTIB0000017',
      defaultPaymentMethod: 'nach',
      active: true,
      notes: 'Restructuring & multi-corridor light cargo fleet facility.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'inst-k-federal',
      organizationId: 'org-kaveri',
      bankName: 'Federal Bank Fleet Leasing',
      institutionType: 'bank',
      branch: 'RS Puram Commercial, Coimbatore',
      relationshipManager: 'Anitha Menon',
      contactNumber: '+91 98942 44810',
      email: 'anitha.m@federalbank.co.in',
      ifscCode: 'FDRL0001089',
      defaultPaymentMethod: 'ecs',
      active: true,
      notes: 'Electric last-mile & battery-included lease facility.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ]

  const hasDeccanOrg =
    (db.prepare("SELECT COUNT(*) AS count FROM organizations WHERE id = 'org-deccan'").get() as { count: number }).count > 0

  if (hasDeccanOrg) {
    extraInstitutions.push({
      id: 'inst-d-axis',
      organizationId: 'org-deccan',
      bankName: 'Axis Bank Green Mobility Desk',
      institutionType: 'bank',
      branch: 'MG Road Commercial, Bengaluru',
      relationshipManager: 'Rohan Kulkarni',
      contactNumber: '+91 99002 71820',
      email: 'rohan.ev@axisbank.com',
      ifscCode: 'UTIB0000009',
      defaultPaymentMethod: 'nach',
      active: true,
      notes: 'EV urban cold-chain leasing and battery telemetry facility.',
      createdAt: nowIso,
      updatedAt: nowIso,
    })
  }

  for (const inst of extraInstitutions) {
    insertInstIgnore.run(
      inst.id,
      inst.organizationId,
      inst.bankName,
      inst.institutionType,
      inst.branch,
      inst.relationshipManager,
      inst.contactNumber,
      inst.email,
      inst.ifscCode,
      inst.defaultPaymentMethod,
      inst.active ? 1 : 0,
      inst.notes ?? null,
      inst.createdAt,
      inst.updatedAt,
    )
  }

  const getInst = (id: string): FinancialInstitution | null => {
    const row = db.prepare('SELECT * FROM finance_institutions WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return row ? mapInstitutionRow(row) : null
  }

  const insertDoc = db.prepare(`
    INSERT OR IGNORE INTO finance_documents (
      id, organization_id, finance_id, vehicle_id, category, title, file_name,
      mime_type, file_size_bytes, storage_key, version, parent_doc_id,
      verification_status, verified_by, verified_at, expiry_date, requires_renewal,
      uploaded_by, uploaded_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertSeedLoan = (cfg: {
    id: string
    orgId: string
    vehicleId: string
    vehicleRegistration: string
    vehicleName: string
    vehicleMakeModel: string
    vehicleOwnership: VehicleFinanceRecord['vehicleOwnership']
    inst: FinancialInstitution
    loanAccountNumber: string
    loanReferenceNumber: string
    loanType: FinanceLoanType
    customLoanTypeLabel?: string
    principalAmount: number
    downPayment: number
    interestRateAnnualPct: number
    interestType: FinanceInterestType
    numberOfInstalments: number
    firstEmiDate: string
    processingFees: number
    otherCharges: number
    paidCount: number
    partialNext?: { amount: number; lateFee?: number }
    notes?: string
    docs: Array<{
      category: FinanceDocCategory
      title: string
      fileName: string
      verificationStatus: 'verified' | 'pending_verification' | 'rejected'
      expiryDate?: string
      requiresRenewal?: boolean
      notes?: string
    }>
  }): EmiInstalment[] => {
    const netFinanced = roundInr(cfg.principalAmount - cfg.downPayment)
    const sched = generateAmortisationSchedule({
      organizationId: cfg.orgId,
      financeId: cfg.id,
      vehicleId: cfg.vehicleId,
      netFinancedAmount: netFinanced,
      interestRateAnnualPct: cfg.interestRateAnnualPct,
      interestType: cfg.interestType,
      numberOfInstalments: cfg.numberOfInstalments,
      firstEmiDate: cfg.firstEmiDate,
      nowIso,
    })

    const loanStartDate = addMonthsToDate(cfg.firstEmiDate, -1)
    const maskedAcc = maskAccountNumber(cfg.loanAccountNumber)

    db.prepare(`
      INSERT INTO vehicle_finance_records (
        id, organization_id, vehicle_id, institution_id, vehicle_registration, vehicle_name,
        vehicle_make_model, vehicle_ownership, bank_name, institution_name, branch,
        relationship_manager, contact_number, email, ifsc_code, loan_account_number,
        loan_account_masked, loan_reference_number, loan_type, custom_loan_type_label,
        principal_amount, down_payment, net_financed_amount, interest_rate_annual_pct,
        interest_type, loan_start_date, loan_tenure_months, number_of_instalments,
        emi_amount, first_emi_date, final_emi_date, processing_fees, other_charges,
        payment_method, finance_status, notes, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cfg.id,
      cfg.orgId,
      cfg.vehicleId,
      cfg.inst.id,
      cfg.vehicleRegistration,
      cfg.vehicleName,
      cfg.vehicleMakeModel,
      cfg.vehicleOwnership,
      cfg.inst.bankName,
      cfg.inst.bankName,
      cfg.inst.branch,
      cfg.inst.relationshipManager,
      cfg.inst.contactNumber,
      cfg.inst.email,
      cfg.inst.ifscCode,
      cfg.loanAccountNumber,
      maskedAcc,
      cfg.loanReferenceNumber,
      cfg.loanType,
      cfg.customLoanTypeLabel ?? null,
      cfg.principalAmount,
      cfg.downPayment,
      netFinanced,
      cfg.interestRateAnnualPct,
      cfg.interestType,
      loanStartDate,
      cfg.numberOfInstalments,
      cfg.numberOfInstalments,
      sched.emiAmount,
      cfg.firstEmiDate,
      sched.finalEmiDate,
      cfg.processingFees,
      cfg.otherCharges,
      cfg.inst.defaultPaymentMethod,
      cfg.paidCount >= cfg.numberOfInstalments ? 'completed' : 'active',
      cfg.notes ?? null,
      nowIso,
      nowIso,
      cfg.orgId === 'org-deccan' ? 'Nandini Rao' : 'Karthikeyan R',
    )

    const insertEmi = db.prepare(`
      INSERT INTO finance_emi_instalments (
        id, organization_id, finance_id, vehicle_id, emi_number, due_date, opening_principal,
        principal_component, interest_component, emi_amount, late_fee_inr, amount_paid,
        remaining_amount, payment_date, status, reconciliation_status, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertPay = db.prepare(`
      INSERT INTO finance_payments (
        id, organization_id, finance_id, emi_id, vehicle_id, emi_number, payment_date,
        amount_inr, late_fee_component_inr, payment_method, bank_transaction_ref,
        bank_transaction_ref_masked, receipt_doc_id, receipt_file_name, reconciliation_status,
        reconciled_by, reconciled_at, correction_of_payment_id, correction_reason,
        is_corrected, recorded_by, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const finalInstalments: EmiInstalment[] = []

    for (let idx = 0; idx < sched.instalments.length; idx++) {
      let emi = sched.instalments[idx]
      let reconStatus: ReconciliationStatus = 'pending'
      let pendingPay: {
        id: string
        date: string
        amount: number
        lateFee: number
        method: FinancePaymentMethod
        txRef: string
        receiptFile: string | null
        recon: ReconciliationStatus
        reconBy: string | null
        reconAt: string | null
        notes: string
        createdAt: string
      } | null = null

      if (idx < cfg.paidCount) {
        const applied = applyEmiPaymentCalculation(emi, emi.emiAmount, 0, emi.dueDate, true)
        emi = applied.updatedEmi
        reconStatus = 'reconciled'
        const txRef = `UTR${cfg.inst.ifscCode.slice(0, 4)}${String(420000 + idx * 149 + cfg.id.charCodeAt(4))}`
        pendingPay = {
          id: `fpay-${cfg.id}-${emi.emiNumber}`,
          date: emi.dueDate,
          amount: emi.emiAmount,
          lateFee: 0,
          method: cfg.inst.defaultPaymentMethod,
          txRef,
          receiptFile: `Receipt_${cfg.id}_EMI_${emi.emiNumber}.pdf`,
          recon: 'reconciled',
          reconBy: 'Lakshmi Narayanan',
          reconAt: `${emi.dueDate}T11:30:00.000Z`,
          notes: `Cleared via ${cfg.inst.defaultPaymentMethod.toUpperCase()} for EMI #${emi.emiNumber}`,
          createdAt: `${emi.dueDate}T10:15:00.000Z`,
        }
      } else if (idx === cfg.paidCount && cfg.partialNext) {
        const lateFee = cfg.partialNext.lateFee ?? 0
        const applied = applyEmiPaymentCalculation(emi, cfg.partialNext.amount, lateFee, addDaysIso(emi.dueDate, 1), true)
        emi = applied.updatedEmi
        reconStatus = 'pending'
        const txRef = `UTRPART${String(910000 + cfg.id.charCodeAt(4))}`
        pendingPay = {
          id: `fpay-${cfg.id}-${emi.emiNumber}-p1`,
          date: addDaysIso(emi.dueDate, 1),
          amount: cfg.partialNext.amount,
          lateFee,
          method: 'neft',
          txRef,
          receiptFile: null,
          recon: 'pending',
          reconBy: null,
          reconAt: null,
          notes: 'Partial NEFT batch received; balance overdue',
          createdAt: nowIso,
        }
      } else {
        emi = {
          ...emi,
          status: deriveEmiStatus(emi, todayIso, 7),
        }
      }

      finalInstalments.push(emi)
      insertEmi.run(
        emi.id,
        emi.organizationId,
        emi.financeId,
        emi.vehicleId,
        emi.emiNumber,
        emi.dueDate,
        emi.openingPrincipal,
        emi.principalComponent,
        emi.interestComponent,
        emi.emiAmount,
        emi.lateFeeInr,
        emi.amountPaid,
        emi.remainingAmount,
        emi.paymentDate,
        emi.status,
        reconStatus,
        emi.notes ?? null,
        nowIso,
      )

      if (pendingPay) {
        insertPay.run(
          pendingPay.id,
          cfg.orgId,
          cfg.id,
          emi.id,
          cfg.vehicleId,
          emi.emiNumber,
          pendingPay.date,
          pendingPay.amount,
          pendingPay.lateFee,
          pendingPay.method,
          pendingPay.txRef,
          maskAccountNumber(pendingPay.txRef),
          null,
          pendingPay.receiptFile,
          pendingPay.recon,
          pendingPay.reconBy,
          pendingPay.reconAt,
          null,
          null,
          0,
          cfg.orgId === 'org-deccan' ? 'Nandini Rao' : 'Lakshmi Narayanan',
          pendingPay.notes,
          pendingPay.createdAt,
        )
      }
    }

    cfg.docs.forEach((doc, i) => {
      insertDoc.run(
        `fdoc-${cfg.id}-${i + 1}`,
        cfg.orgId,
        cfg.id,
        cfg.vehicleId,
        doc.category,
        doc.title,
        doc.fileName,
        'application/pdf',
        214016,
        `seed/${cfg.id}/${doc.fileName}`,
        1,
        null,
        doc.verificationStatus,
        doc.verificationStatus === 'verified' ? 'Lakshmi Narayanan' : doc.verificationStatus === 'rejected' ? 'Karthikeyan R' : null,
        doc.verificationStatus !== 'pending_verification' ? nowIso : null,
        doc.expiryDate ?? null,
        doc.requiresRenewal ? 1 : 0,
        cfg.orgId === 'org-deccan' ? 'Nandini Rao' : 'Karthikeyan R',
        nowIso,
        doc.notes ?? null,
      )
    })

    db.prepare(`
      INSERT INTO finance_update_history (
        id, organization_id, finance_id, entity_type, entity_id, field_name,
        previous_value, updated_value, update_reason, updated_by, updated_by_role,
        update_date, approval_status
      ) VALUES (?, ?, ?, 'finance_record', ?, 'Initial Registration', 'None', ?, ?, ?, 'org_admin', ?, 'approved')
    `).run(
      `fhist-init-${cfg.id}`,
      cfg.orgId,
      cfg.id,
      cfg.id,
      `${cfg.loanReferenceNumber} (${cfg.inst.bankName}) · Net Financed ₹${netFinanced.toLocaleString('en-IN')}`,
      'Initial vehicle finance facility onboarded into DriveMitra Finance Register.',
      cfg.orgId === 'org-deccan' ? 'Nandini Rao' : 'Karthikeyan R',
      nowIso,
    )

    return finalInstalments
  }

  const instKAxis = getInst('inst-k-axis')
  const instKFed = getInst('inst-k-federal')
  const instKSundaram = getInst('inst-k-sundaram')

  // 6. Kaveri Restructured Loan with Partial/Overdue EMI #4 + Pending Statement Doc (v-k6)
  if (instKAxis && !hasFinance('fin-k-6')) {
    insertSeedLoan({
      id: 'fin-k-6',
      orgId: 'org-kaveri',
      vehicleId: 'v-k6',
      vehicleRegistration: 'TN 45 CN 7710',
      vehicleName: 'Tata Ace CNG Plus',
      vehicleMakeModel: 'Tata Ace CNG Plus',
      vehicleOwnership: 'Financed',
      inst: instKAxis,
      loanAccountNumber: 'UTIB774190882311',
      loanReferenceNumber: 'CVL-AXIS-2025-412',
      loanType: 'commercial_vehicle_loan',
      principalAmount: 760000,
      downPayment: 110000,
      interestRateAnnualPct: 9.6,
      interestType: 'reducing_balance',
      numberOfInstalments: 18,
      firstEmiDate: addDaysIso(addMonthsToDate(todayIso, -3), -8),
      processingFees: 5500,
      otherCharges: 950,
      paidCount: 3,
      partialNext: { amount: 18000, lateFee: 650 },
      notes: 'Restructured from 9.6% to 8.75% for Trichy pharma corridor stabilization; EMI #4 balance overdue.',
      docs: [
        { category: 'loan_agreement', title: 'Axis Commercial Hypothecation Agreement', fileName: 'Axis_Loan_TN45CN7710.pdf', verificationStatus: 'verified' },
        { category: 'bank_statements', title: 'Axis Q1 NACH Ledger Statement', fileName: 'Axis_Q1_Statement_TN45CN7710.pdf', verificationStatus: 'pending_verification', notes: 'Awaiting treasury reconciliation check' },
      ],
    })
    updateVehicleFinanceTerms(db, 'org-kaveri', 'fin-k-6', adminKaveri, {
      mode: 'restructure',
      reason: 'Renegotiated rate from 9.6% to 8.75% and smoothed remaining 14 instalments',
      interestRateAnnualPct: 8.75,
      interestType: 'reducing_balance',
      numberOfInstalments: 14,
      firstEmiDate: addDaysIso(addMonthsToDate(todayIso, 1), 4),
      confirmScheduleRevision: true,
    })
  }

  // 7. Kaveri Foreclosed Loan on v-k7 (TN 33 KL 8890)
  if (instKSundaram && !hasFinance('fin-k-7')) {
    insertSeedLoan({
      id: 'fin-k-7',
      orgId: 'org-kaveri',
      vehicleId: 'v-k7',
      vehicleRegistration: 'TN 33 KL 8890',
      vehicleName: 'BharatBenz 1217C Cargo',
      vehicleMakeModel: 'BharatBenz 1217C Cargo',
      vehicleOwnership: 'Owned',
      inst: instKSundaram,
      loanAccountNumber: 'SUNF551290448817',
      loanReferenceNumber: 'HP-SUN-2024-119',
      loanType: 'hire_purchase',
      principalAmount: 2150000,
      downPayment: 350000,
      interestRateAnnualPct: 10.1,
      interestType: 'reducing_balance',
      numberOfInstalments: 24,
      firstEmiDate: addMonthsToDate(todayIso, -9),
      processingFees: 10500,
      otherCharges: 0,
      paidCount: 8,
      notes: 'Pre-closed ahead of schedule via Erode SIPCOT reserve surplus.',
      docs: [
        { category: 'loan_agreement', title: 'Sundaram Heavy Truck HP Agreement', fileName: 'Sundaram_HP_119.pdf', verificationStatus: 'verified' },
        { category: 'foreclosure_letter', title: 'Sundaram Early Foreclosure Settlement Letter', fileName: 'Sundaram_Foreclosure_119.pdf', verificationStatus: 'verified' },
        { category: 'noc', title: 'Hypothecation Cancellation NOC & Form 35', fileName: 'Sundaram_NOC_TN33KL8890.pdf', verificationStatus: 'verified' },
      ],
    })
    updateVehicleFinanceTerms(db, 'org-kaveri', 'fin-k-7', adminKaveri, {
      mode: 'foreclose',
      reason: 'Early fleet debt foreclosure from Erode SIPCOT reserve surplus',
      settlementAmountInr: 1185000,
      settlementDate: addDaysIso(todayIso, -12),
      settlementBankRef: 'UTRFCL882104',
      settlementNotes: 'RTGS lump-sum settlement verified by Sundaram Coimbatore desk',
      confirmScheduleRevision: true,
    })
  }

  // 8. Kaveri EV Lease on v-k8 (TN 23 EV 2090) — showcases Waived EMI #1, Payment Correction on EMI #2, Disputed Payment on EMI #3, Pending & Rejected Docs
  if (instKFed && !hasFinance('fin-k-8')) {
    const k8Emis = insertSeedLoan({
      id: 'fin-k-8',
      orgId: 'org-kaveri',
      vehicleId: 'v-k8',
      vehicleRegistration: 'TN 23 EV 2090',
      vehicleName: 'Euler HiLoad EV',
      vehicleMakeModel: 'Euler HiLoad EV',
      vehicleOwnership: 'Leased',
      inst: instKFed,
      loanAccountNumber: 'FDRL339011228874',
      loanReferenceNumber: 'EVL-FED-2026-063',
      loanType: 'lease',
      principalAmount: 620000,
      downPayment: 70000,
      interestRateAnnualPct: 8.2,
      interestType: 'lease_fixed',
      numberOfInstalments: 24,
      firstEmiDate: addDaysIso(addMonthsToDate(todayIso, -3), 9),
      processingFees: 3500,
      otherCharges: 400,
      paidCount: 0,
      notes: 'Last-mile Vellore EV lease with promotional month-1 waiver.',
      docs: [
        { category: 'loan_agreement', title: 'Federal EV Operating Lease Contract', fileName: 'Federal_EV_Lease_063.pdf', verificationStatus: 'verified' },
        { category: 'loan_sanction_letter', title: 'Federal EV Lease Sanction Advice', fileName: 'Federal_Sanction_063.pdf', verificationStatus: 'pending_verification', notes: 'Pending finance controller stamp check' },
        { category: 'bank_statements', title: 'ECS Mandate Scan (Blurry Copy)', fileName: 'Federal_ECS_Mandate_v1.pdf', verificationStatus: 'rejected', notes: 'Re-upload clear signed ECS page' },
      ],
    })

    if (k8Emis[0]) {
      updateEmiStatusOrLateFee(db, 'org-kaveri', k8Emis[0].id, financeKaveri, {
        action: 'waive',
        reason: 'OEM promotional zero-rental first month credit note applied',
      })
    }
    if (k8Emis[1]) {
      const p2 = recordEmiPayment(db, 'org-kaveri', k8Emis[1].id, financeKaveri, {
        amountInr: k8Emis[1].emiAmount,
        paymentDate: k8Emis[1].dueDate,
        paymentMethod: 'ecs',
        bankTransactionRef: 'UTRFED771200',
        notes: 'Initial ECS entry prior to bank fee adjustment',
      })
      const adjusted = Math.max(1000, roundInr(k8Emis[1].emiAmount - 250))
      const corrected = correctFinancePayment(db, 'org-kaveri', p2.payment.id, financeKaveri, {
        correctedAmountInr: adjusted,
        bankTransactionRef: 'UTRFED771200-REV1',
        reason: 'Adjusted ₹250 bank rebate confirmed in Federal monthly statement',
      })
      reconcileFinancePayment(db, 'org-kaveri', corrected.id, financeKaveri, 'reconciled', 'Reconciled after statement rebate adjustment')
      recordEmiPayment(db, 'org-kaveri', k8Emis[1].id, financeKaveri, {
        amountInr: roundInr(k8Emis[1].emiAmount - adjusted),
        paymentDate: addDaysIso(k8Emis[1].dueDate, 2),
        paymentMethod: 'upi',
        bankTransactionRef: 'UPIFEDBAL250',
        notes: 'Residual fee top-up cleared',
      })
    }
    if (k8Emis[2]) {
      const p3 = recordEmiPayment(db, 'org-kaveri', k8Emis[2].id, financeKaveri, {
        amountInr: k8Emis[2].emiAmount,
        paymentDate: k8Emis[2].dueDate,
        paymentMethod: 'ecs',
        bankTransactionRef: 'UTRFED771998',
        notes: 'Duplicate ECS debit observed on bank feed; escalated to RM',
      })
      reconcileFinancePayment(
        db,
        'org-kaveri',
        p3.payment.id,
        financeKaveri,
        'discrepancy',
        'UTR debited twice on ECS batch; dispute ticket FED-9941 raised with branch RM',
      )
    }
  } else if (hasFinance('fin-k-8')) {
    const pendingDisputePay = db
      .prepare("SELECT id FROM finance_payments WHERE finance_id = 'fin-k-8' AND bank_transaction_ref = 'UTRFED771998' AND reconciliation_status = 'pending'")
      .get() as { id: string } | undefined
    if (pendingDisputePay) {
      reconcileFinancePayment(
        db,
        'org-kaveri',
        pendingDisputePay.id,
        financeKaveri,
        'discrepancy',
        'UTR debited twice on ECS batch; dispute ticket FED-9941 raised with branch RM',
      )
    }
  }

  // 9. Kaveri Cancelled Refurbishment Top-Up Facility on v-k2 (showcases cancelled status & custom loan type)
  if (instKAxis && !hasFinance('fin-k-9')) {
    insertSeedLoan({
      id: 'fin-k-9',
      orgId: 'org-kaveri',
      vehicleId: 'v-k2',
      vehicleRegistration: 'TN 58 CD 5678',
      vehicleName: 'Ashok Leyland Dost Strong',
      vehicleMakeModel: 'Ashok Leyland Dost Strong',
      vehicleOwnership: 'Financed',
      inst: instKAxis,
      loanAccountNumber: 'UTIB991044552201',
      loanReferenceNumber: 'REF-AXIS-2026-009',
      loanType: 'other',
      customLoanTypeLabel: 'Refurbishment & Body Top-Up',
      principalAmount: 340000,
      downPayment: 40000,
      interestRateAnnualPct: 10.8,
      interestType: 'flat_rate',
      numberOfInstalments: 12,
      firstEmiDate: addMonthsToDate(todayIso, 1),
      processingFees: 2500,
      otherCharges: 0,
      paidCount: 0,
      notes: 'Draft body-refurbishment facility superseded by consolidated working-capital line.',
      docs: [
        { category: 'other_supporting_docs', title: 'Draft Facility Closure Memo', fileName: 'Axis_Cancelled_Memo_009.pdf', verificationStatus: 'verified' },
      ],
    })
    updateVehicleFinanceTerms(db, 'org-kaveri', 'fin-k-9', adminKaveri, {
      mode: 'cancel',
      reason: 'Superseded by consolidated Axis commercial fleet working-capital facility',
      confirmScheduleRevision: true,
    })
  }

  // Deccan EV Express extra loans if org-deccan exists
  if (hasDeccanOrg) {
    const instDAxis = getInst('inst-d-axis')
    const instDIcici = getInst('inst-d-icici')
    if (instDAxis && !hasFinance('fin-d-2')) {
      insertSeedLoan({
        id: 'fin-d-2',
        orgId: 'org-deccan',
        vehicleId: 'v-d2',
        vehicleRegistration: 'KA 05 EV 3319',
        vehicleName: 'Switch Mobility IeV4 Cargo',
        vehicleMakeModel: 'Switch Mobility IeV4 Cargo',
        vehicleOwnership: 'Leased',
        inst: instDAxis,
        loanAccountNumber: 'UTIB440192837412',
        loanReferenceNumber: 'EVL-AXIS-2025-702',
        loanType: 'lease',
        principalAmount: 1480000,
        downPayment: 180000,
        interestRateAnnualPct: 8.6,
        interestType: 'lease_fixed',
        numberOfInstalments: 24,
        firstEmiDate: addDaysIso(addMonthsToDate(todayIso, -4), -5),
        processingFees: 6000,
        otherCharges: 0,
        paidCount: 4,
        partialNext: { amount: 25000, lateFee: 750 },
        notes: 'Electronic City cold-chain EV lease; EMI #5 partial transfer posted.',
        docs: [
          { category: 'loan_agreement', title: 'Axis Green EV Lease Contract', fileName: 'Axis_EV_Lease_702.pdf', verificationStatus: 'verified' },
          { category: 'insurance_finance_docs', title: 'Hypothecated EV Battery & Motor Cover', fileName: 'HDFC_ERGO_EV_Cover.pdf', verificationStatus: 'verified', expiryDate: addDaysIso(todayIso, 14), requiresRenewal: true },
          { category: 'loan_sanction_letter', title: 'Axis Green Credit Sanction Advice', fileName: 'Axis_Sanction_702.pdf', verificationStatus: 'pending_verification' },
        ],
      })
    }
    if (instDIcici && !hasFinance('fin-d-3')) {
      insertSeedLoan({
        id: 'fin-d-3',
        orgId: 'org-deccan',
        vehicleId: 'v-d3',
        vehicleRegistration: 'KA 51 DG 9044',
        vehicleName: 'Force Traveller Delivery Van',
        vehicleMakeModel: 'Force Traveller Delivery Van',
        vehicleOwnership: 'Owned',
        inst: instDIcici,
        loanAccountNumber: 'ICIC770192837455',
        loanReferenceNumber: 'VL-ICIC-2024-118',
        loanType: 'vehicle_loan',
        principalAmount: 1650000,
        downPayment: 350000,
        interestRateAnnualPct: 9.25,
        interestType: 'reducing_balance',
        numberOfInstalments: 12,
        firstEmiDate: addMonthsToDate(todayIso, -12),
        processingFees: 8500,
        otherCharges: 0,
        paidCount: 12,
        notes: 'Hosur logistics delivery van loan fully repaid; NOC issued.',
        docs: [
          { category: 'loan_agreement', title: 'ICICI Delivery Van Loan Deed', fileName: 'ICICI_VL_118.pdf', verificationStatus: 'verified' },
          { category: 'noc', title: 'ICICI Closure NOC & Form 35', fileName: 'ICICI_NOC_KA51DG9044.pdf', verificationStatus: 'verified' },
        ],
      })
    }
  }

  for (const orgId of hasDeccanOrg ? ['org-kaveri', 'org-deccan'] : ['org-kaveri']) {
    syncFinanceAlertsInDb(db, orgId, 'Asia/Kolkata')
  }
}

function ensureOrgSettingsRow(
  db: DatabaseSync,
  orgId: string,
  timezone = 'Asia/Kolkata',
  recipientEmails: string[] = [],
): FinanceNotificationSettings {
  const row = db
    .prepare('SELECT * FROM finance_notification_settings WHERE organization_id = ?')
    .get(orgId) as Record<string, unknown> | undefined

  if (!row) {
    const nowIso = new Date().toISOString()
    db.prepare(`
      INSERT INTO finance_notification_settings (
        organization_id, reminder_days_json, notify_after_due_date, overdue_escalation_days,
        in_app_enabled, email_enabled, recipient_roles_json, recipient_emails_json,
        default_currency, default_timezone, default_reporting_period, partial_payment_rule,
        due_soon_window_days, allow_manual_late_fee_entry, updated_at, updated_by
      ) VALUES (?, ?, 1, 5, 1, 1, ?, ?, 'INR', ?, 'monthly', 'allow_partial', 7, 1, ?, 'System')
    `).run(
      orgId,
      JSON.stringify([15, 7, 3, 1, 0]),
      JSON.stringify(['org_admin', 'finance']),
      JSON.stringify(recipientEmails),
      timezone,
      nowIso,
    )
    return ensureOrgSettingsRow(db, orgId, timezone, recipientEmails)
  }

  return {
    organizationId: String(row.organization_id),
    reminderDaysBefore: JSON.parse(String(row.reminder_days_json)) as number[],
    notifyAfterDueDate: Number(row.notify_after_due_date) === 1,
    overdueEscalationDays: Number(row.overdue_escalation_days),
    inAppEnabled: Number(row.in_app_enabled) === 1,
    emailEnabled: Number(row.email_enabled) === 1,
    smtpConfigured: isSmtpConfigured(),
    recipientRoles: JSON.parse(String(row.recipient_roles_json)) as OrganizationRole[],
    recipientEmails: JSON.parse(String(row.recipient_emails_json)) as string[],
    defaultCurrency: 'INR',
    defaultTimezone: String(row.default_timezone || 'Asia/Kolkata'),
    defaultReportingPeriod: String(row.default_reporting_period) as FinanceNotificationSettings['defaultReportingPeriod'],
    partialPaymentRule: String(row.partial_payment_rule) as FinanceNotificationSettings['partialPaymentRule'],
    dueSoonWindowDays: Number(row.due_soon_window_days || 7),
    allowManualLateFeeEntry: Number(row.allow_manual_late_fee_entry) === 1,
    updatedAt: String(row.updated_at),
    updatedBy: String(row.updated_by),
  }
}

function mapInstitutionRow(row: Record<string, unknown>): FinancialInstitution {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    bankName: String(row.bank_name),
    institutionType: String(row.institution_type) as FinancialInstitution['institutionType'],
    branch: String(row.branch),
    relationshipManager: String(row.relationship_manager),
    contactNumber: String(row.contact_number),
    email: String(row.email),
    ifscCode: String(row.ifsc_code),
    defaultPaymentMethod: String(row.default_payment_method) as FinancePaymentMethod,
    active: Number(row.active) === 1,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapRawFinanceRow(row: Record<string, unknown>): VehicleFinanceRecord {
  const principal = Number(row.principal_amount)
  const down = Number(row.down_payment)
  const net = Number(row.net_financed_amount)
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    vehicleId: String(row.vehicle_id),
    institutionId: row.institution_id ? String(row.institution_id) : null,
    vehicleRegistration: String(row.vehicle_registration),
    vehicleName: String(row.vehicle_name),
    vehicleMakeModel: String(row.vehicle_make_model),
    vehicleOwnership: String(row.vehicle_ownership) as VehicleFinanceRecord['vehicleOwnership'],
    bankName: String(row.bank_name),
    institutionName: String(row.institution_name),
    branch: String(row.branch),
    relationshipManager: String(row.relationship_manager),
    contactNumber: String(row.contact_number),
    email: String(row.email),
    ifscCode: String(row.ifsc_code),
    loanAccountNumber: String(row.loan_account_number),
    loanAccountMasked: String(row.loan_account_masked),
    loanReferenceNumber: String(row.loan_reference_number),
    loanType: String(row.loan_type) as FinanceLoanType,
    customLoanTypeLabel: row.custom_loan_type_label ? String(row.custom_loan_type_label) : undefined,
    principalAmount: principal,
    downPayment: down,
    netFinancedAmount: net,
    interestRateAnnualPct: Number(row.interest_rate_annual_pct),
    interestType: String(row.interest_type) as FinanceInterestType,
    loanStartDate: String(row.loan_start_date),
    loanTenureMonths: Number(row.loan_tenure_months),
    numberOfInstalments: Number(row.number_of_instalments),
    emiAmount: Number(row.emi_amount),
    firstEmiDate: String(row.first_emi_date),
    finalEmiDate: String(row.final_emi_date),
    processingFees: Number(row.processing_fees || 0),
    otherCharges: Number(row.other_charges || 0),
    paymentMethod: String(row.payment_method) as FinancePaymentMethod,
    financeStatus: String(row.finance_status) as VehicleFinanceStatus,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdBy: String(row.created_by),
    outstandingPrincipal: net,
    principalRepaid: 0,
    interestPaid: 0,
    totalAmountPaid: 0,
    remainingInstalments: Number(row.number_of_instalments),
    nextDueDate: String(row.first_emi_date),
    loanCompletionDate: String(row.final_emi_date),
    overdueCount: 0,
    overdueAmount: 0,
  }
}

function mapEmiRow(row: Record<string, unknown>): EmiInstalment {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    financeId: String(row.finance_id),
    vehicleId: String(row.vehicle_id),
    emiNumber: Number(row.emi_number),
    dueDate: String(row.due_date),
    openingPrincipal: Number(row.opening_principal),
    principalComponent: Number(row.principal_component),
    interestComponent: Number(row.interest_component),
    emiAmount: Number(row.emi_amount),
    lateFeeInr: Number(row.late_fee_inr || 0),
    amountPaid: Number(row.amount_paid || 0),
    remainingAmount: Number(row.remaining_amount),
    paymentDate: row.payment_date ? String(row.payment_date) : null,
    status: String(row.status) as EmiPaymentStatus,
    reconciliationStatus: String(row.reconciliation_status) as ReconciliationStatus,
    notes: row.notes ? String(row.notes) : undefined,
    updatedAt: String(row.updated_at),
  }
}

function mapPaymentRow(row: Record<string, unknown>): FinancePaymentTransaction {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    financeId: String(row.finance_id),
    emiId: String(row.emi_id),
    vehicleId: String(row.vehicle_id),
    emiNumber: Number(row.emi_number),
    paymentDate: String(row.payment_date),
    amountInr: Number(row.amount_inr),
    lateFeeComponentInr: Number(row.late_fee_component_inr || 0),
    paymentMethod: String(row.payment_method) as FinancePaymentMethod,
    bankTransactionRef: String(row.bank_transaction_ref),
    bankTransactionRefMasked: String(row.bank_transaction_ref_masked),
    receiptDocId: row.receipt_doc_id ? String(row.receipt_doc_id) : null,
    receiptFileName: row.receipt_file_name ? String(row.receipt_file_name) : null,
    reconciliationStatus: String(row.reconciliation_status) as ReconciliationStatus,
    reconciledBy: row.reconciled_by ? String(row.reconciled_by) : null,
    reconciledAt: row.reconciled_at ? String(row.reconciled_at) : null,
    correctionOfPaymentId: row.correction_of_payment_id ? String(row.correction_of_payment_id) : null,
    correctionReason: row.correction_reason ? String(row.correction_reason) : null,
    isCorrected: Number(row.is_corrected) === 1,
    recordedBy: String(row.recorded_by),
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at),
  }
}

function mapDocRow(row: Record<string, unknown>): FinanceDocumentItem {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    financeId: String(row.finance_id),
    vehicleId: String(row.vehicle_id),
    category: String(row.category) as FinanceDocCategory,
    title: String(row.title),
    fileName: String(row.file_name),
    mimeType: String(row.mime_type),
    fileSizeBytes: Number(row.file_size_bytes),
    storageKey: String(row.storage_key),
    version: Number(row.version || 1),
    parentDocId: row.parent_doc_id ? String(row.parent_doc_id) : null,
    verificationStatus: String(row.verification_status) as FinanceDocumentItem['verificationStatus'],
    verifiedBy: row.verified_by ? String(row.verified_by) : null,
    verifiedAt: row.verified_at ? String(row.verified_at) : null,
    expiryDate: row.expiry_date ? String(row.expiry_date) : null,
    requiresRenewal: Number(row.requires_renewal) === 1,
    uploadedBy: String(row.uploaded_by),
    uploadedAt: String(row.uploaded_at),
    notes: row.notes ? String(row.notes) : undefined,
  }
}

function mapAlertRow(row: Record<string, unknown>): FinanceAlertEvent {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    financeId: String(row.finance_id),
    emiId: row.emi_id ? String(row.emi_id) : null,
    vehicleId: String(row.vehicle_id),
    alertType: String(row.alert_type) as FinanceAlertEvent['alertType'],
    severity: String(row.severity) as FinanceAlertEvent['severity'],
    title: String(row.title),
    message: String(row.message),
    channelSummary: String(row.channel_summary),
    actionRoute: String(row.action_route),
    read: Number(row.read) === 1,
    acknowledged: Number(row.acknowledged) === 1,
    createdAt: String(row.created_at),
  }
}

function mapHistoryRow(row: Record<string, unknown>): FinanceUpdateHistoryEntry {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    financeId: row.finance_id ? String(row.finance_id) : null,
    entityType: String(row.entity_type) as FinanceUpdateHistoryEntry['entityType'],
    entityId: String(row.entity_id),
    fieldName: String(row.field_name),
    previousValue: String(row.previous_value),
    updatedValue: String(row.updated_value),
    updateReason: String(row.update_reason),
    updatedBy: String(row.updated_by),
    updatedByRole: String(row.updated_by_role) as OrganizationRole,
    updateDate: String(row.update_date),
    approvalStatus: String(row.approval_status) as FinanceUpdateHistoryEntry['approvalStatus'],
  }
}

function insertHistoryEntry(
  db: DatabaseSync,
  entry: Omit<FinanceUpdateHistoryEntry, 'id' | 'updateDate'>,
): void {
  db.prepare(`
    INSERT INTO finance_update_history (
      id, organization_id, finance_id, entity_type, entity_id, field_name,
      previous_value, updated_value, update_reason, updated_by, updated_by_role,
      update_date, approval_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `fhist-${crypto.randomUUID().slice(0, 10)}`,
    entry.organizationId,
    entry.financeId ?? null,
    entry.entityType,
    entry.entityId,
    entry.fieldName,
    entry.previousValue,
    entry.updatedValue,
    entry.updateReason,
    entry.updatedBy,
    entry.updatedByRole,
    new Date().toISOString(),
    entry.approvalStatus,
  )
}

function insertFinanceAlert(
  db: DatabaseSync,
  alert: FinanceAlertEvent,
): void {
  db.prepare(`
    INSERT OR REPLACE INTO finance_alerts (
      id, organization_id, finance_id, emi_id, vehicle_id, alert_type,
      severity, title, message, channel_summary, action_route, read, acknowledged, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    alert.id,
    alert.organizationId,
    alert.financeId,
    alert.emiId ?? null,
    alert.vehicleId,
    alert.alertType,
    alert.severity,
    alert.title,
    alert.message,
    alert.channelSummary,
    alert.actionRoute,
    alert.read ? 1 : 0,
    alert.acknowledged ? 1 : 0,
    alert.createdAt,
  )
}

export function syncFinanceAlertsInDb(
  db: DatabaseSync,
  orgId: string,
  orgTimezone = 'Asia/Kolkata',
): FinanceAlertEvent[] {
  const settings = ensureOrgSettingsRow(db, orgId, orgTimezone)
  const todayIso = getTodayIsoInTz(settings.defaultTimezone || orgTimezone)

  const rawRecords = (
    db
      .prepare('SELECT * FROM vehicle_finance_records WHERE organization_id = ?')
      .all(orgId) as Record<string, unknown>[]
  ).map(mapRawFinanceRow)
  const instalments = (
    db
      .prepare('SELECT * FROM finance_emi_instalments WHERE organization_id = ?')
      .all(orgId) as Record<string, unknown>[]
  ).map(mapEmiRow)
  const payments = (
    db
      .prepare('SELECT * FROM finance_payments WHERE organization_id = ?')
      .all(orgId) as Record<string, unknown>[]
  ).map(mapPaymentRow)
  const documents = (
    db
      .prepare('SELECT * FROM finance_documents WHERE organization_id = ?')
      .all(orgId) as Record<string, unknown>[]
  ).map(mapDocRow)
  const existingAlerts = (
    db
      .prepare('SELECT * FROM finance_alerts WHERE organization_id = ?')
      .all(orgId) as Record<string, unknown>[]
  ).map(mapAlertRow)

  const summarized = rawRecords.map((r) =>
    summarizeVehicleFinanceRecord(r, instalments, payments, todayIso, settings.dueSoonWindowDays),
  )

  const computed = evaluateFinanceAlerts({
    organizationId: orgId,
    records: summarized,
    instalments,
    documents,
    settings,
    existingAlerts,
    todayIso,
  })

  // Keep alerts in sync
  db.prepare('DELETE FROM finance_alerts WHERE organization_id = ?').run(orgId)
  for (const a of computed) {
    insertFinanceAlert(db, a)
  }

  return computed
}

function storeUploadedFile(
  db: DatabaseSync,
  orgId: string,
  fileName: string,
  mimeType: string,
  contentBase64: string,
): { docId: string; safeName: string; storageKey: string; fileSizeBytes: number } {
  if (!ALLOWED_DOCUMENT_MIMES.has(mimeType)) {
    throw new Error('Unsupported document format. Upload PDF, JPEG, PNG, or WebP.')
  }
  const rawBase64 = contentBase64.includes(',') ? contentBase64.split(',')[1] : contentBase64
  const fileBuf = Buffer.from(rawBase64, 'base64')
  if (fileBuf.length === 0 || fileBuf.length > MAX_DOCUMENT_BYTES) {
    throw new Error('Document file must be non-empty and under 5 MB.')
  }

  const docId = `doc-${crypto.randomUUID().slice(0, 10)}`
  const orgDir = path.join(getUploadsDir(), orgId)
  fs.mkdirSync(orgDir, { recursive: true })
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storageKey = path.join(orgId, `${docId}_${safeName}`)
  fs.writeFileSync(path.join(getUploadsDir(), storageKey), fileBuf)

  db.prepare(`
    INSERT INTO document_files (id, organization_id, storage_key, file_name, mime_type, file_size_bytes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(docId, orgId, storageKey, safeName, mimeType, fileBuf.length, new Date().toISOString())

  return { docId, safeName, storageKey, fileSizeBytes: fileBuf.length }
}

export function getFinanceWorkspace(
  db: DatabaseSync,
  orgId: string,
  role: OrganizationRole,
  orgTimezone = 'Asia/Kolkata',
): FinanceWorkspacePayload {
  const settings = ensureOrgSettingsRow(db, orgId, orgTimezone)
  const todayIso = getTodayIsoInTz(settings.defaultTimezone || orgTimezone)
  const canViewUnmasked = canPerformAction(role, 'view_finance_unmasked')

  const institutions = (
    db
      .prepare('SELECT * FROM finance_institutions WHERE organization_id = ? ORDER BY bank_name ASC')
      .all(orgId) as Record<string, unknown>[]
  ).map(mapInstitutionRow)

  const rawRecords = (
    db
      .prepare('SELECT * FROM vehicle_finance_records WHERE organization_id = ? ORDER BY created_at DESC')
      .all(orgId) as Record<string, unknown>[]
  ).map(mapRawFinanceRow)

  const rawInstalments = (
    db
      .prepare('SELECT * FROM finance_emi_instalments WHERE organization_id = ? ORDER BY due_date ASC, emi_number ASC')
      .all(orgId) as Record<string, unknown>[]
  ).map(mapEmiRow)

  const rawPayments = (
    db
      .prepare('SELECT * FROM finance_payments WHERE organization_id = ? ORDER BY payment_date DESC, created_at DESC')
      .all(orgId) as Record<string, unknown>[]
  ).map(mapPaymentRow)

  const documents = (
    db
      .prepare('SELECT * FROM finance_documents WHERE organization_id = ? ORDER BY uploaded_at DESC')
      .all(orgId) as Record<string, unknown>[]
  ).map(mapDocRow)

  const instalments = rawInstalments.map((inst) => ({
    ...inst,
    status: deriveEmiStatus(inst, todayIso, settings.dueSoonWindowDays),
    remainingAmount: roundInr(Math.max(0, inst.emiAmount + (inst.lateFeeInr || 0) - inst.amountPaid)),
  }))

  const records = rawRecords
    .map((r) => summarizeVehicleFinanceRecord(r, instalments, rawPayments, todayIso, settings.dueSoonWindowDays))
    .map((r) => maskFinanceWorkspaceForRole(r, canViewUnmasked))

  const payments = rawPayments.map((p) =>
    canViewUnmasked
      ? p
      : {
          ...p,
          bankTransactionRef: p.bankTransactionRefMasked || maskAccountNumber(p.bankTransactionRef),
        },
  )

  const alerts = syncFinanceAlertsInDb(db, orgId, settings.defaultTimezone || orgTimezone)

  const updateHistory = (
    db
      .prepare('SELECT * FROM finance_update_history WHERE organization_id = ? ORDER BY update_date DESC LIMIT 200')
      .all(orgId) as Record<string, unknown>[]
  ).map(mapHistoryRow)

  return {
    institutions: canViewUnmasked
      ? institutions
      : institutions.map((i) => ({ ...i, contactNumber: '••••••••••', email: '***@protected' })),
    records,
    instalments,
    payments,
    documents,
    settings,
    alerts,
    updateHistory,
    maskedForRole: !canViewUnmasked,
    todayIso,
  }
}

export function upsertInstitution(
  db: DatabaseSync,
  orgId: string,
  actor: FinanceActor,
  input: {
    id?: string
    bankName: string
    institutionType?: FinancialInstitution['institutionType']
    branch: string
    relationshipManager: string
    contactNumber: string
    email: string
    ifscCode: string
    defaultPaymentMethod?: FinancePaymentMethod
    active?: boolean
    notes?: string
    reason?: string
  },
): FinancialInstitution {
  if (!input.bankName?.trim() || !input.branch?.trim()) {
    throw new Error('Bank name and branch are required.')
  }
  const nowIso = new Date().toISOString()

  db.exec('BEGIN IMMEDIATE')
  try {
    if (input.id) {
      const existingRow = db
        .prepare('SELECT * FROM finance_institutions WHERE id = ? AND organization_id = ?')
        .get(input.id, orgId) as Record<string, unknown> | undefined
      if (!existingRow) {
        throw new Error('Financial institution not found in active organization.')
      }
      const prev = mapInstitutionRow(existingRow)
      const nextActive = input.active !== undefined ? (input.active ? 1 : 0) : prev.active ? 1 : 0
      db.prepare(`
        UPDATE finance_institutions
        SET bank_name = ?, institution_type = ?, branch = ?, relationship_manager = ?,
            contact_number = ?, email = ?, ifsc_code = ?, default_payment_method = ?,
            active = ?, notes = ?, updated_at = ?
        WHERE id = ? AND organization_id = ?
      `).run(
        input.bankName.trim(),
        input.institutionType ?? prev.institutionType,
        input.branch.trim(),
        input.relationshipManager?.trim() || prev.relationshipManager,
        input.contactNumber?.trim() || prev.contactNumber,
        input.email?.trim() || prev.email,
        (input.ifscCode ?? prev.ifscCode).trim().toUpperCase(),
        input.defaultPaymentMethod ?? prev.defaultPaymentMethod,
        nextActive,
        input.notes !== undefined ? input.notes : prev.notes ?? null,
        nowIso,
        input.id,
        orgId,
      )

      insertHistoryEntry(db, {
        organizationId: orgId,
        financeId: null,
        entityType: 'institution',
        entityId: input.id,
        fieldName: 'Bank & Financier Record',
        previousValue: `${prev.bankName} (${prev.branch}, RM: ${prev.relationshipManager}, Active: ${prev.active})`,
        updatedValue: `${input.bankName.trim()} (${input.branch.trim()}, RM: ${input.relationshipManager?.trim() || prev.relationshipManager}, Active: ${nextActive === 1})`,
        updateReason: input.reason?.trim() || 'Bank / financier details updated via Finance Settings',
        updatedBy: actor.fullName,
        updatedByRole: actor.role,
        approvalStatus: 'approved',
      })

      db.exec('COMMIT')
      const updated = db
        .prepare('SELECT * FROM finance_institutions WHERE id = ?')
        .get(input.id) as Record<string, unknown>
      return mapInstitutionRow(updated)
    }

    const newId = `inst-${crypto.randomUUID().slice(0, 8)}`
    db.prepare(`
      INSERT INTO finance_institutions (
        id, organization_id, bank_name, institution_type, branch, relationship_manager,
        contact_number, email, ifsc_code, default_payment_method, active, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId,
      orgId,
      input.bankName.trim(),
      input.institutionType ?? 'bank',
      input.branch.trim(),
      input.relationshipManager?.trim() || 'Commercial Fleet Desk',
      input.contactNumber?.trim() || '—',
      input.email?.trim() || '—',
      (input.ifscCode ?? '').trim().toUpperCase(),
      input.defaultPaymentMethod ?? 'nach',
      input.active === false ? 0 : 1,
      input.notes ?? null,
      nowIso,
      nowIso,
    )

    insertHistoryEntry(db, {
      organizationId: orgId,
      financeId: null,
      entityType: 'institution',
      entityId: newId,
      fieldName: 'New Financial Institution',
      previousValue: 'None',
      updatedValue: `${input.bankName.trim()} · ${input.branch.trim()}`,
      updateReason: input.reason?.trim() || 'Added financing institution to directory',
      updatedBy: actor.fullName,
      updatedByRole: actor.role,
      approvalStatus: 'approved',
    })

    db.exec('COMMIT')
    const created = db
      .prepare('SELECT * FROM finance_institutions WHERE id = ?')
      .get(newId) as Record<string, unknown>
    return mapInstitutionRow(created)
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* ignore */ }
    throw err
  }
}

export interface CreateVehicleFinanceInput {
  vehicleId: string
  vehicleRegistration: string
  vehicleName: string
  vehicleMakeModel: string
  vehicleOwnership: VehicleFinanceRecord['vehicleOwnership']
  institutionId?: string | null
  bankName: string
  institutionName?: string
  branch: string
  relationshipManager: string
  contactNumber: string
  email: string
  loanAccountNumber: string
  ifscCode?: string
  loanReferenceNumber: string
  loanType: FinanceLoanType
  customLoanTypeLabel?: string
  principalAmount: number
  downPayment: number
  interestRateAnnualPct: number
  interestType: FinanceInterestType
  loanStartDate: string
  loanTenureMonths: number
  numberOfInstalments: number
  emiAmount?: number
  firstEmiDate: string
  finalEmiDate?: string
  processingFees?: number
  otherCharges?: number
  paymentMethod: FinancePaymentMethod
  notes?: string
  initialDocuments?: Array<{
    category: FinanceDocCategory
    title: string
    fileName: string
    mimeType: string
    contentBase64: string
  }>
}

export function createVehicleFinanceRecord(
  db: DatabaseSync,
  orgId: string,
  actor: FinanceActor,
  input: CreateVehicleFinanceInput,
): { record: VehicleFinanceRecord; instalments: EmiInstalment[] } {
  if (!input.vehicleId?.trim() || !input.vehicleRegistration?.trim()) {
    throw new Error('Select a valid vehicle.')
  }
  const hasFleetVehiclesTable = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'fleet_vehicles'")
    .get()
  const vehRow = hasFleetVehiclesTable
    ? (db
        .prepare('SELECT ownership_category, registration_number FROM fleet_vehicles WHERE id = ? AND organization_id = ?')
        .get(input.vehicleId, orgId) as { ownership_category?: string; registration_number?: string } | undefined)
    : undefined
  if (vehRow && vehRow.ownership_category && vehRow.ownership_category !== 'company_owned') {
    throw new Error(
      `${vehRow.registration_number || input.vehicleRegistration} is classified as ${vehRow.ownership_category.replace(/_/g, ' ')}. Company loans and EMIs apply only to company-owned vehicles.`,
    )
  }
  if ((input.vehicleOwnership as string) === 'partner_contracted' || (input.vehicleOwnership as string) === 'individual_owner') {
    throw new Error('Third-party contracted or individual owner vehicles cannot have company loan liabilities attached.')
  }
  if (!input.bankName?.trim() || !input.loanAccountNumber?.trim() || !input.loanReferenceNumber?.trim()) {
    throw new Error('Bank name, loan account number, and loan reference number are required.')
  }
  const principal = roundInr(Number(input.principalAmount))
  const down = roundInr(Number(input.downPayment || 0))
  if (principal <= 0 || down < 0 || down >= principal) {
    throw new Error('Principal amount must be positive and down payment must be less than principal.')
  }
  const numInstalments = Math.max(1, Math.round(Number(input.numberOfInstalments || input.loanTenureMonths)))
  if (!input.firstEmiDate) {
    throw new Error('First EMI date is required.')
  }

  const netFinanced = roundInr(principal - down)
  const settings = ensureOrgSettingsRow(db, orgId)
  const todayIso = getTodayIsoInTz(settings.defaultTimezone)
  const nowIso = new Date().toISOString()
  const financeId = `fin-${crypto.randomUUID().slice(0, 10)}`

  const sched = generateAmortisationSchedule({
    organizationId: orgId,
    financeId,
    vehicleId: input.vehicleId,
    netFinancedAmount: netFinanced,
    interestRateAnnualPct: Number(input.interestRateAnnualPct || 0),
    interestType: input.interestType,
    numberOfInstalments: numInstalments,
    firstEmiDate: input.firstEmiDate,
    customEmiAmount: input.emiAmount && input.emiAmount > 0 ? Number(input.emiAmount) : undefined,
    nowIso,
  })

  const maskedAcc = maskAccountNumber(input.loanAccountNumber)
  const finalDate = input.finalEmiDate?.trim() || sched.finalEmiDate

  db.exec('BEGIN IMMEDIATE')
  try {
    // Ensure institution link or upsert if new bank
    let instId = input.institutionId || null
    if (!instId) {
      const match = db
        .prepare('SELECT id FROM finance_institutions WHERE organization_id = ? AND LOWER(bank_name) = LOWER(?)')
        .get(orgId, input.bankName.trim()) as { id: string } | undefined
      if (match) {
        instId = match.id
      } else {
        instId = `inst-${crypto.randomUUID().slice(0, 8)}`
        db.prepare(`
          INSERT INTO finance_institutions (
            id, organization_id, bank_name, institution_type, branch, relationship_manager,
            contact_number, email, ifsc_code, default_payment_method, active, notes, created_at, updated_at
          ) VALUES (?, ?, ?, 'bank', ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)
        `).run(
          instId,
          orgId,
          input.bankName.trim(),
          input.branch?.trim() || 'Main Commercial Branch',
          input.relationshipManager?.trim() || 'Fleet RM',
          input.contactNumber?.trim() || '—',
          input.email?.trim() || '—',
          (input.ifscCode ?? '').trim().toUpperCase(),
          input.paymentMethod,
          nowIso,
          nowIso,
        )
      }
    }

    db.prepare(`
      INSERT INTO vehicle_finance_records (
        id, organization_id, vehicle_id, institution_id, vehicle_registration, vehicle_name,
        vehicle_make_model, vehicle_ownership, bank_name, institution_name, branch,
        relationship_manager, contact_number, email, ifsc_code, loan_account_number,
        loan_account_masked, loan_reference_number, loan_type, custom_loan_type_label,
        principal_amount, down_payment, net_financed_amount, interest_rate_annual_pct,
        interest_type, loan_start_date, loan_tenure_months, number_of_instalments,
        emi_amount, first_emi_date, final_emi_date, processing_fees, other_charges,
        payment_method, finance_status, notes, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      financeId,
      orgId,
      input.vehicleId,
      instId,
      input.vehicleRegistration.trim(),
      input.vehicleName.trim(),
      input.vehicleMakeModel.trim(),
      input.vehicleOwnership,
      input.bankName.trim(),
      (input.institutionName || input.bankName).trim(),
      input.branch?.trim() || 'Main Commercial Branch',
      input.relationshipManager?.trim() || '—',
      input.contactNumber?.trim() || '—',
      input.email?.trim() || '—',
      (input.ifscCode ?? '').trim().toUpperCase(),
      input.loanAccountNumber.trim(),
      maskedAcc,
      input.loanReferenceNumber.trim(),
      input.loanType,
      input.customLoanTypeLabel?.trim() || null,
      principal,
      down,
      netFinanced,
      Number(input.interestRateAnnualPct || 0),
      input.interestType,
      input.loanStartDate,
      Math.max(1, Math.round(Number(input.loanTenureMonths || numInstalments))),
      numInstalments,
      sched.emiAmount,
      input.firstEmiDate,
      finalDate,
      roundInr(Number(input.processingFees || 0)),
      roundInr(Number(input.otherCharges || 0)),
      input.paymentMethod,
      'active',
      input.notes?.trim() || null,
      nowIso,
      nowIso,
      actor.fullName,
    )

    const insertEmi = db.prepare(`
      INSERT INTO finance_emi_instalments (
        id, organization_id, finance_id, vehicle_id, emi_number, due_date, opening_principal,
        principal_component, interest_component, emi_amount, late_fee_inr, amount_paid,
        remaining_amount, payment_date, status, reconciliation_status, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, NULL, ?, 'pending', NULL, ?)
    `)

    const refreshedInstalments = sched.instalments.map((emi) => {
      const status = deriveEmiStatus(emi, todayIso, settings.dueSoonWindowDays)
      insertEmi.run(
        emi.id,
        emi.organizationId,
        emi.financeId,
        emi.vehicleId,
        emi.emiNumber,
        emi.dueDate,
        emi.openingPrincipal,
        emi.principalComponent,
        emi.interestComponent,
        emi.emiAmount,
        emi.remainingAmount,
        status,
        nowIso,
      )
      return { ...emi, status }
    })

    if (input.initialDocuments?.length) {
      const insertDoc = db.prepare(`
        INSERT INTO finance_documents (
          id, organization_id, finance_id, vehicle_id, category, title, file_name,
          mime_type, file_size_bytes, storage_key, version, parent_doc_id,
          verification_status, verified_by, verified_at, expiry_date, requires_renewal,
          uploaded_by, uploaded_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, 'pending_verification', NULL, NULL, NULL, 0, ?, ?, NULL)
      `)
      for (const doc of input.initialDocuments) {
        const stored = storeUploadedFile(db, orgId, doc.fileName, doc.mimeType, doc.contentBase64)
        insertDoc.run(
          `fdoc-${crypto.randomUUID().slice(0, 10)}`,
          orgId,
          financeId,
          input.vehicleId,
          doc.category,
          doc.title.trim(),
          stored.safeName,
          doc.mimeType,
          stored.fileSizeBytes,
          stored.storageKey,
          actor.fullName,
          nowIso,
        )
      }
    }

    insertHistoryEntry(db, {
      organizationId: orgId,
      financeId,
      entityType: 'finance_record',
      entityId: financeId,
      fieldName: 'Vehicle Finance Created',
      previousValue: 'None',
      updatedValue: `${input.loanReferenceNumber.trim()} · ${input.bankName.trim()} · Net ₹${netFinanced.toLocaleString('en-IN')} (${numInstalments} EMIs)`,
      updateReason: 'Added new vehicle finance agreement and generated EMI schedule',
      updatedBy: actor.fullName,
      updatedByRole: actor.role,
      approvalStatus: 'approved',
    })

    syncFinanceAlertsInDb(db, orgId, settings.defaultTimezone)
    db.exec('COMMIT')

    const row = db
      .prepare('SELECT * FROM vehicle_finance_records WHERE id = ?')
      .get(financeId) as Record<string, unknown>
    const raw = mapRawFinanceRow(row)
    const record = summarizeVehicleFinanceRecord(
      raw,
      refreshedInstalments,
      [],
      todayIso,
      settings.dueSoonWindowDays,
    )
    return { record, instalments: refreshedInstalments }
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* ignore */ }
    throw err
  }
}

export function updateVehicleFinanceTerms(
  db: DatabaseSync,
  orgId: string,
  financeId: string,
  actor: FinanceActor,
  input: {
    mode: 'edit' | 'restructure' | 'foreclose' | 'close' | 'cancel'
    reason: string
    confirmScheduleRevision?: boolean
    // Optional edit / restructure fields
    principalAmount?: number
    downPayment?: number
    interestRateAnnualPct?: number
    interestType?: FinanceInterestType
    numberOfInstalments?: number
    emiAmount?: number
    firstEmiDate?: string
    paymentMethod?: FinancePaymentMethod
    notes?: string
    // Foreclosure / Closure fields
    settlementAmountInr?: number
    settlementDate?: string
    settlementBankRef?: string
    settlementNotes?: string
  },
): VehicleFinanceRecord {
  if (!input.reason?.trim()) {
    throw new Error('An update reason is required for the Finance Update History audit trail.')
  }
  const settings = ensureOrgSettingsRow(db, orgId)
  const todayIso = getTodayIsoInTz(settings.defaultTimezone)
  const nowIso = new Date().toISOString()

  db.exec('BEGIN IMMEDIATE')
  try {
    const recRow = db
      .prepare('SELECT * FROM vehicle_finance_records WHERE id = ? AND organization_id = ?')
      .get(financeId, orgId) as Record<string, unknown> | undefined
    if (!recRow) {
      throw new Error('Vehicle finance record not found in active organization.')
    }
    const prev = mapRawFinanceRow(recRow)
    const existingEmis = (
      db
        .prepare('SELECT * FROM finance_emi_instalments WHERE finance_id = ? ORDER BY emi_number ASC')
        .all(financeId) as Record<string, unknown>[]
    ).map(mapEmiRow)

    const existingPayments = (
      db
        .prepare('SELECT * FROM finance_payments WHERE finance_id = ? ORDER BY created_at DESC')
        .all(financeId) as Record<string, unknown>[]
    ).map(mapPaymentRow)

    const needsScheduleRevision =
      input.mode === 'restructure' ||
      input.mode === 'foreclose' ||
      input.mode === 'close' ||
      input.mode === 'cancel' ||
      input.principalAmount !== undefined ||
      input.downPayment !== undefined ||
      input.interestRateAnnualPct !== undefined ||
      input.interestType !== undefined ||
      input.numberOfInstalments !== undefined ||
      input.emiAmount !== undefined ||
      input.firstEmiDate !== undefined

    if (needsScheduleRevision && !input.confirmScheduleRevision) {
      throw new Error('Schedule modification requires explicit review and confirmation (confirmScheduleRevision: true).')
    }

    if (input.mode === 'foreclose' || input.mode === 'close') {
      const targetStatus: VehicleFinanceStatus = input.mode === 'foreclose' ? 'foreclosed' : 'completed'
      const setDate = (input.settlementDate || todayIso).slice(0, 10)
      const openEmis = existingEmis.filter(
        (e) => e.status !== 'paid' && e.status !== 'waived' && e.status !== 'cancelled',
      )

      const settlementAmt = roundInr(
        Number(
          input.settlementAmountInr ??
            openEmis.reduce((s, e) => s + e.principalComponent, 0),
        ),
      )

      if (settlementAmt > 0 && openEmis.length > 0) {
        const anchorEmi = openEmis[0]
        const txRef = input.settlementBankRef?.trim() || `FCL${Date.now().toString().slice(-8)}`
        db.prepare(`
          INSERT INTO finance_payments (
            id, organization_id, finance_id, emi_id, vehicle_id, emi_number, payment_date,
            amount_inr, late_fee_component_inr, payment_method, bank_transaction_ref,
            bank_transaction_ref_masked, receipt_doc_id, receipt_file_name, reconciliation_status,
            reconciled_by, reconciled_at, correction_of_payment_id, correction_reason,
            is_corrected, recorded_by, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, NULL, NULL, 'reconciled', ?, ?, NULL, NULL, 0, ?, ?, ?)
        `).run(
          `fpay-${crypto.randomUUID().slice(0, 10)}`,
          orgId,
          financeId,
          anchorEmi.id,
          prev.vehicleId,
          anchorEmi.emiNumber,
          setDate,
          settlementAmt,
          prev.paymentMethod,
          txRef,
          maskAccountNumber(txRef),
          actor.fullName,
          nowIso,
          actor.fullName,
          input.settlementNotes?.trim() || `${targetStatus === 'foreclosed' ? 'Loan Foreclosure' : 'Loan Closure'} final settlement`,
          nowIso,
        )
      }

      // Preserve already paid/partially_paid EMIs; mark remaining open EMIs cancelled (for foreclose) or paid/waived
      for (const emi of openEmis) {
        const nextEmiStatus: EmiPaymentStatus = targetStatus === 'foreclosed' ? 'cancelled' : 'waived'
        db.prepare(`
          UPDATE finance_emi_instalments
          SET status = ?, remaining_amount = 0, payment_date = COALESCE(payment_date, ?), notes = ?, updated_at = ?
          WHERE id = ?
        `).run(
          nextEmiStatus,
          setDate,
          `${targetStatus === 'foreclosed' ? 'Cancelled on loan foreclosure' : 'Closed on loan completion'}: ${input.reason.trim()}`,
          nowIso,
          emi.id,
        )
      }

      db.prepare(`
        UPDATE vehicle_finance_records
        SET finance_status = ?, notes = COALESCE(?, notes), updated_at = ?
        WHERE id = ?
      `).run(targetStatus, input.notes?.trim() || null, nowIso, financeId)

      insertHistoryEntry(db, {
        organizationId: orgId,
        financeId,
        entityType: 'finance_record',
        entityId: financeId,
        fieldName: input.mode === 'foreclose' ? 'Loan Foreclosure' : 'Loan Closure',
        previousValue: `${prev.financeStatus} · ${openEmis.length} open EMIs`,
        updatedValue: `${targetStatus} · Settlement ₹${settlementAmt.toLocaleString('en-IN')} on ${setDate}`,
        updateReason: input.reason.trim(),
        updatedBy: actor.fullName,
        updatedByRole: actor.role,
        approvalStatus: 'approved',
      })
    } else if (input.mode === 'cancel') {
      const openEmis = existingEmis.filter(
        (e) => e.status !== 'paid' && e.status !== 'partially_paid',
      )
      for (const emi of openEmis) {
        db.prepare(`
          UPDATE finance_emi_instalments SET status = 'cancelled', remaining_amount = 0, updated_at = ? WHERE id = ?
        `).run(nowIso, emi.id)
      }
      db.prepare(`
        UPDATE vehicle_finance_records SET finance_status = 'cancelled', updated_at = ? WHERE id = ?
      `).run(nowIso, financeId)

      insertHistoryEntry(db, {
        organizationId: orgId,
        financeId,
        entityType: 'finance_record',
        entityId: financeId,
        fieldName: 'Finance Status',
        previousValue: prev.financeStatus,
        updatedValue: 'cancelled',
        updateReason: input.reason.trim(),
        updatedBy: actor.fullName,
        updatedByRole: actor.role,
        approvalStatus: 'approved',
      })
    } else if (input.mode === 'restructure') {
      const nextRate = Number(input.interestRateAnnualPct ?? prev.interestRateAnnualPct)
      const nextType = input.interestType ?? prev.interestType
      const nextCount = Math.max(1, Math.round(Number(input.numberOfInstalments ?? 12)))
      const effectiveDate = (input.firstEmiDate || todayIso).slice(0, 10)

      const restructured = buildRestructuredSchedule({
        record: prev,
        existingInstalments: existingEmis,
        newInterestRateAnnualPct: nextRate,
        newInterestType: nextType,
        newRemainingInstalmentsCount: nextCount,
        effectiveNextDueDate: effectiveDate,
        customEmiAmount: input.emiAmount,
      })

      // Delete ONLY non-preserved open EMIs, preserving historical paid/partially_paid/waived/cancelled
      const preservedIds = new Set(restructured.preservedInstalments.map((i) => i.id))
      for (const e of existingEmis) {
        if (!preservedIds.has(e.id)) {
          db.prepare('DELETE FROM finance_emi_instalments WHERE id = ?').run(e.id)
        }
      }

      const insertEmi = db.prepare(`
        INSERT INTO finance_emi_instalments (
          id, organization_id, finance_id, vehicle_id, emi_number, due_date, opening_principal,
          principal_component, interest_component, emi_amount, late_fee_inr, amount_paid,
          remaining_amount, payment_date, status, reconciliation_status, notes, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, NULL, ?, 'pending', 'Restructured instalment', ?)
      `)
      for (const nEmi of restructured.newInstalments) {
        const status = deriveEmiStatus(nEmi, todayIso, settings.dueSoonWindowDays)
        insertEmi.run(
          nEmi.id,
          nEmi.organizationId,
          nEmi.financeId,
          nEmi.vehicleId,
          nEmi.emiNumber,
          nEmi.dueDate,
          nEmi.openingPrincipal,
          nEmi.principalComponent,
          nEmi.interestComponent,
          nEmi.emiAmount,
          nEmi.remainingAmount,
          status,
          nowIso,
        )
      }

      const totalCount = restructured.preservedInstalments.length + restructured.newInstalments.length
      db.prepare(`
        UPDATE vehicle_finance_records
        SET interest_rate_annual_pct = ?, interest_type = ?, number_of_instalments = ?,
            loan_tenure_months = ?, emi_amount = ?, final_emi_date = ?,
            payment_method = COALESCE(?, payment_method), finance_status = 'restructured',
            notes = COALESCE(?, notes), updated_at = ?
        WHERE id = ?
      `).run(
        nextRate,
        nextType,
        totalCount,
        totalCount,
        restructured.newEmiAmount,
        restructured.newFinalEmiDate,
        input.paymentMethod ?? null,
        input.notes ?? null,
        nowIso,
        financeId,
      )

      insertHistoryEntry(db, {
        organizationId: orgId,
        financeId,
        entityType: 'finance_record',
        entityId: financeId,
        fieldName: 'Loan Restructuring',
        previousValue: `EMI ₹${Math.round(prev.emiAmount)} @ ${prev.interestRateAnnualPct}% (${prev.numberOfInstalments} EMIs)`,
        updatedValue: `New EMI ₹${Math.round(restructured.newEmiAmount)} @ ${nextRate}% (${restructured.newInstalments.length} new EMIs from ${effectiveDate})`,
        updateReason: input.reason.trim(),
        updatedBy: actor.fullName,
        updatedByRole: actor.role,
        approvalStatus: 'approved',
      })
    } else {
      // mode === 'edit'
      const nextPrincipal = roundInr(Number(input.principalAmount ?? prev.principalAmount))
      const nextDown = roundInr(Number(input.downPayment ?? prev.downPayment))
      const nextNet = roundInr(Math.max(0, nextPrincipal - nextDown))
      const nextRate = Number(input.interestRateAnnualPct ?? prev.interestRateAnnualPct)
      const nextType = input.interestType ?? prev.interestType
      const nextPaymentMethod = input.paymentMethod ?? prev.paymentMethod
      const nextNotes = input.notes !== undefined ? input.notes : prev.notes ?? null

      const changes: Array<{ field: string; prevVal: string; nextVal: string }> = []
      if (nextPrincipal !== prev.principalAmount) changes.push({ field: 'Principal Amount', prevVal: `₹${prev.principalAmount}`, nextVal: `₹${nextPrincipal}` })
      if (nextDown !== prev.downPayment) changes.push({ field: 'Down Payment', prevVal: `₹${prev.downPayment}`, nextVal: `₹${nextDown}` })
      if (nextRate !== prev.interestRateAnnualPct) changes.push({ field: 'Interest Rate', prevVal: `${prev.interestRateAnnualPct}%`, nextVal: `${nextRate}%` })
      if (nextType !== prev.interestType) changes.push({ field: 'Interest Type', prevVal: prev.interestType, nextVal: nextType })
      if (nextPaymentMethod !== prev.paymentMethod) changes.push({ field: 'Payment Method', prevVal: prev.paymentMethod, nextVal: nextPaymentMethod })

      if (
        input.principalAmount !== undefined ||
        input.downPayment !== undefined ||
        input.interestRateAnnualPct !== undefined ||
        input.interestType !== undefined ||
        input.numberOfInstalments !== undefined ||
        input.emiAmount !== undefined ||
        input.firstEmiDate !== undefined
      ) {
        const preservedStatuses = new Set<EmiPaymentStatus>(['paid', 'partially_paid', 'waived', 'cancelled'])
        const preserved = existingEmis.filter((e) => preservedStatuses.has(e.status))
        const totalTargetCount = Math.max(
          preserved.length + 1,
          Math.round(Number(input.numberOfInstalments ?? prev.numberOfInstalments)),
        )
        const remainingSlots = Math.max(1, totalTargetCount - preserved.length)
        const effectiveStart = input.firstEmiDate?.slice(0, 10) ||
          existingEmis.find((e) => !preservedStatuses.has(e.status))?.dueDate ||
          prev.firstEmiDate

        const fakeRecord: VehicleFinanceRecord = {
          ...prev,
          principalAmount: nextPrincipal,
          downPayment: nextDown,
          netFinancedAmount: nextNet,
        }
        const reSched = buildRestructuredSchedule({
          record: fakeRecord,
          existingInstalments: existingEmis,
          newInterestRateAnnualPct: nextRate,
          newInterestType: nextType,
          newRemainingInstalmentsCount: remainingSlots,
          effectiveNextDueDate: effectiveStart,
          customEmiAmount: input.emiAmount,
        })

        const preservedIds = new Set(reSched.preservedInstalments.map((i) => i.id))
        for (const e of existingEmis) {
          if (!preservedIds.has(e.id)) {
            db.prepare('DELETE FROM finance_emi_instalments WHERE id = ?').run(e.id)
          }
        }
        const insertEmi = db.prepare(`
          INSERT INTO finance_emi_instalments (
            id, organization_id, finance_id, vehicle_id, emi_number, due_date, opening_principal,
            principal_component, interest_component, emi_amount, late_fee_inr, amount_paid,
            remaining_amount, payment_date, status, reconciliation_status, notes, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, NULL, ?, 'pending', NULL, ?)
        `)
        for (const nEmi of reSched.newInstalments) {
          const status = deriveEmiStatus(nEmi, todayIso, settings.dueSoonWindowDays)
          insertEmi.run(
            nEmi.id,
            nEmi.organizationId,
            nEmi.financeId,
            nEmi.vehicleId,
            nEmi.emiNumber,
            nEmi.dueDate,
            nEmi.openingPrincipal,
            nEmi.principalComponent,
            nEmi.interestComponent,
            nEmi.emiAmount,
            nEmi.remainingAmount,
            status,
            nowIso,
          )
        }

        if (reSched.newEmiAmount !== prev.emiAmount) {
          changes.push({ field: 'EMI Amount', prevVal: `₹${prev.emiAmount}`, nextVal: `₹${reSched.newEmiAmount}` })
        }

        db.prepare(`
          UPDATE vehicle_finance_records
          SET principal_amount = ?, down_payment = ?, net_financed_amount = ?,
              interest_rate_annual_pct = ?, interest_type = ?, number_of_instalments = ?,
              loan_tenure_months = ?, emi_amount = ?, final_emi_date = ?,
              payment_method = ?, notes = ?, updated_at = ?
          WHERE id = ?
        `).run(
          nextPrincipal,
          nextDown,
          nextNet,
          nextRate,
          nextType,
          reSched.preservedInstalments.length + reSched.newInstalments.length,
          reSched.preservedInstalments.length + reSched.newInstalments.length,
          reSched.newEmiAmount,
          reSched.newFinalEmiDate,
          nextPaymentMethod,
          nextNotes,
          nowIso,
          financeId,
        )
      } else {
        db.prepare(`
          UPDATE vehicle_finance_records
          SET payment_method = ?, notes = ?, updated_at = ?
          WHERE id = ?
        `).run(nextPaymentMethod, nextNotes, nowIso, financeId)
      }

      if (changes.length === 0) {
        changes.push({ field: 'Loan Metadata / Notes', prevVal: prev.notes || '—', nextVal: nextNotes || '—' })
      }
      for (const ch of changes) {
        insertHistoryEntry(db, {
          organizationId: orgId,
          financeId,
          entityType: 'finance_record',
          entityId: financeId,
          fieldName: ch.field,
          previousValue: ch.prevVal,
          updatedValue: ch.nextVal,
          updateReason: input.reason.trim(),
          updatedBy: actor.fullName,
          updatedByRole: actor.role,
          approvalStatus: 'approved',
        })
      }
    }

    // Create informational alert for loan information update
    insertFinanceAlert(db, {
      id: `falt-updated-${financeId}-${Date.now()}`,
      organizationId: orgId,
      financeId,
      emiId: null,
      vehicleId: prev.vehicleId,
      alertType: 'loan_info_updated',
      severity: 'moderate',
      title: `Loan Updated · ${prev.vehicleRegistration}`,
      message: `${prev.loanReferenceNumber}: ${input.reason.trim()} (updated by ${actor.fullName}).`,
      channelSummary: settings.inAppEnabled ? 'In-App' : 'In-App',
      actionRoute: `/dashboard/finance/vehicles/${financeId}`,
      read: false,
      acknowledged: false,
      createdAt: nowIso,
    })

    syncFinanceAlertsInDb(db, orgId, settings.defaultTimezone)
    db.exec('COMMIT')

    const updatedRec = mapRawFinanceRow(
      db.prepare('SELECT * FROM vehicle_finance_records WHERE id = ?').get(financeId) as Record<string, unknown>,
    )
    const updatedEmis = (
      db.prepare('SELECT * FROM finance_emi_instalments WHERE finance_id = ?').all(financeId) as Record<string, unknown>[]
    ).map(mapEmiRow)
    return summarizeVehicleFinanceRecord(
      updatedRec,
      updatedEmis,
      existingPayments,
      todayIso,
      settings.dueSoonWindowDays,
    )
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* ignore */ }
    throw err
  }
}

export function recordEmiPayment(
  db: DatabaseSync,
  orgId: string,
  emiId: string,
  actor: FinanceActor,
  input: {
    amountInr: number
    manualLateFeeInr?: number
    paymentDate: string
    paymentMethod: FinancePaymentMethod
    bankTransactionRef: string
    notes?: string
    receiptUpload?: {
      fileName: string
      mimeType: string
      contentBase64: string
    }
  },
): { payment: FinancePaymentTransaction; instalment: EmiInstalment } {
  if (!input.bankTransactionRef?.trim()) {
    throw new Error('Bank transaction / UTR reference is required.')
  }
  const settings = ensureOrgSettingsRow(db, orgId)
  const manualLateFee = roundInr(Math.max(0, Number(input.manualLateFeeInr || 0)))
  if (manualLateFee > 0 && !settings.allowManualLateFeeEntry) {
    throw new Error('Manual late fee entry is disabled in Finance Defaults.')
  }
  if (manualLateFee > 0 && !canPerformAction(actor.role, 'edit_finance_records') && !canPerformAction(actor.role, 'reconcile_finance_payments')) {
    throw new Error('Only authorized finance or admin roles may record a manual late fee.')
  }

  const nowIso = new Date().toISOString()
  const payDate = (input.paymentDate || getTodayIsoInTz(settings.defaultTimezone)).slice(0, 10)

  db.exec('BEGIN IMMEDIATE')
  try {
    const emiRow = db
      .prepare('SELECT * FROM finance_emi_instalments WHERE id = ? AND organization_id = ?')
      .get(emiId, orgId) as Record<string, unknown> | undefined
    if (!emiRow) {
      throw new Error('EMI instalment not found in active organization.')
    }
    const emi = mapEmiRow(emiRow)

    const applied = applyEmiPaymentCalculation(
      emi,
      Number(input.amountInr),
      manualLateFee,
      payDate,
      settings.partialPaymentRule === 'allow_partial',
    )

    let receiptDocId: string | null = null
    let receiptFileName: string | null = null
    if (input.receiptUpload) {
      const stored = storeUploadedFile(
        db,
        orgId,
        input.receiptUpload.fileName,
        input.receiptUpload.mimeType,
        input.receiptUpload.contentBase64,
      )
      receiptDocId = `fdoc-${crypto.randomUUID().slice(0, 10)}`
      receiptFileName = stored.safeName
      db.prepare(`
        INSERT INTO finance_documents (
          id, organization_id, finance_id, vehicle_id, category, title, file_name,
          mime_type, file_size_bytes, storage_key, version, parent_doc_id,
          verification_status, verified_by, verified_at, expiry_date, requires_renewal,
          uploaded_by, uploaded_at, notes
        ) VALUES (?, ?, ?, ?, 'payment_receipts', ?, ?, ?, ?, ?, 1, NULL, 'pending_verification', NULL, NULL, NULL, 0, ?, ?, NULL)
      `).run(
        receiptDocId,
        orgId,
        emi.financeId,
        emi.vehicleId,
        `EMI #${emi.emiNumber} Receipt (${input.bankTransactionRef.trim()})`,
        stored.safeName,
        input.receiptUpload.mimeType,
        stored.fileSizeBytes,
        stored.storageKey,
        actor.fullName,
        nowIso,
      )
    }

    const paymentId = `fpay-${crypto.randomUUID().slice(0, 10)}`
    const txRef = input.bankTransactionRef.trim()
    db.prepare(`
      INSERT INTO finance_payments (
        id, organization_id, finance_id, emi_id, vehicle_id, emi_number, payment_date,
        amount_inr, late_fee_component_inr, payment_method, bank_transaction_ref,
        bank_transaction_ref_masked, receipt_doc_id, receipt_file_name, reconciliation_status,
        reconciled_by, reconciled_at, correction_of_payment_id, correction_reason,
        is_corrected, recorded_by, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, NULL, 0, ?, ?, ?)
    `).run(
      paymentId,
      orgId,
      emi.financeId,
      emi.id,
      emi.vehicleId,
      emi.emiNumber,
      payDate,
      roundInr(Number(input.amountInr)),
      manualLateFee,
      input.paymentMethod,
      txRef,
      maskAccountNumber(txRef),
      receiptDocId,
      receiptFileName,
      actor.fullName,
      input.notes?.trim() || null,
      nowIso,
    )

    db.prepare(`
      UPDATE finance_emi_instalments
      SET late_fee_inr = ?, amount_paid = ?, remaining_amount = ?, payment_date = ?,
          status = ?, reconciliation_status = 'pending', updated_at = ?
      WHERE id = ?
    `).run(
      applied.updatedEmi.lateFeeInr,
      applied.updatedEmi.amountPaid,
      applied.updatedEmi.remainingAmount,
      applied.updatedEmi.paymentDate,
      applied.updatedEmi.status,
      nowIso,
      emi.id,
    )

    if (applied.updatedEmi.status === 'partially_paid') {
      const recRow = db
        .prepare('SELECT vehicle_registration FROM vehicle_finance_records WHERE id = ?')
        .get(emi.financeId) as { vehicle_registration: string } | undefined
      insertFinanceAlert(db, {
        id: `falt-partial-${emi.id}-${Date.now()}`,
        organizationId: orgId,
        financeId: emi.financeId,
        emiId: emi.id,
        vehicleId: emi.vehicleId,
        alertType: 'partial_payment_recorded',
        severity: 'high',
        title: `Partial Payment Recorded · ${recRow?.vehicle_registration ?? emi.vehicleId}`,
        message: `Recorded ₹${Math.round(Number(input.amountInr)).toLocaleString('en-IN')} against EMI #${emi.emiNumber}; remaining balance ₹${Math.round(applied.updatedEmi.remainingAmount).toLocaleString('en-IN')}.`,
        channelSummary: settings.inAppEnabled ? 'In-App' : 'In-App',
        actionRoute: '/dashboard/finance/overdue',
        read: false,
        acknowledged: false,
        createdAt: nowIso,
      })
    }

    syncFinanceAlertsInDb(db, orgId, settings.defaultTimezone)
    db.exec('COMMIT')

    const payRow = db.prepare('SELECT * FROM finance_payments WHERE id = ?').get(paymentId) as Record<string, unknown>
    return { payment: mapPaymentRow(payRow), instalment: applied.updatedEmi }
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* ignore */ }
    throw err
  }
}

export function reconcileFinancePayment(
  db: DatabaseSync,
  orgId: string,
  paymentId: string,
  actor: FinanceActor,
  status: ReconciliationStatus,
  notes?: string,
): FinancePaymentTransaction {
  const settings = ensureOrgSettingsRow(db, orgId)
  const nowIso = new Date().toISOString()

  db.exec('BEGIN IMMEDIATE')
  try {
    const payRow = db
      .prepare('SELECT * FROM finance_payments WHERE id = ? AND organization_id = ?')
      .get(paymentId, orgId) as Record<string, unknown> | undefined
    if (!payRow) {
      throw new Error('Payment transaction not found in active organization.')
    }
    const prev = mapPaymentRow(payRow)

    db.prepare(`
      UPDATE finance_payments
      SET reconciliation_status = ?, reconciled_by = ?, reconciled_at = ?,
          notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(status, actor.fullName, nowIso, notes?.trim() || null, paymentId)

    db.prepare(`
      UPDATE finance_emi_instalments
      SET reconciliation_status = ?, updated_at = ?
      WHERE id = ?
    `).run(status, nowIso, prev.emiId)

    insertHistoryEntry(db, {
      organizationId: orgId,
      financeId: prev.financeId,
      entityType: 'payment',
      entityId: paymentId,
      fieldName: 'Payment Reconciliation',
      previousValue: prev.reconciliationStatus,
      updatedValue: status,
      updateReason: notes?.trim() || `Marked transaction ${prev.bankTransactionRefMasked} as ${status}`,
      updatedBy: actor.fullName,
      updatedByRole: actor.role,
      approvalStatus: 'approved',
    })

    if (status === 'reconciled') {
      const recRow = db
        .prepare('SELECT vehicle_registration FROM vehicle_finance_records WHERE id = ?')
        .get(prev.financeId) as { vehicle_registration: string } | undefined
      insertFinanceAlert(db, {
        id: `falt-recon-${paymentId}`,
        organizationId: orgId,
        financeId: prev.financeId,
        emiId: prev.emiId,
        vehicleId: prev.vehicleId,
        alertType: 'payment_reconciled',
        severity: 'normal',
        title: `Payment Reconciled · ${recRow?.vehicle_registration ?? prev.vehicleId}`,
        message: `EMI #${prev.emiNumber} payment of ₹${Math.round(prev.amountInr).toLocaleString('en-IN')} (${prev.bankTransactionRefMasked}) reconciled by ${actor.fullName}.`,
        channelSummary: settings.inAppEnabled ? 'In-App' : 'In-App',
        actionRoute: '/dashboard/finance/payments',
        read: false,
        acknowledged: false,
        createdAt: nowIso,
      })
    }

    syncFinanceAlertsInDb(db, orgId, settings.defaultTimezone)
    db.exec('COMMIT')

    const updated = db.prepare('SELECT * FROM finance_payments WHERE id = ?').get(paymentId) as Record<string, unknown>
    return mapPaymentRow(updated)
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* ignore */ }
    throw err
  }
}

export function correctFinancePayment(
  db: DatabaseSync,
  orgId: string,
  paymentId: string,
  actor: FinanceActor,
  input: {
    correctedAmountInr: number
    bankTransactionRef: string
    reason: string
  },
): FinancePaymentTransaction {
  if (!input.reason?.trim()) {
    throw new Error('Correction reason is required for the audit trail.')
  }
  const settings = ensureOrgSettingsRow(db, orgId)
  const todayIso = getTodayIsoInTz(settings.defaultTimezone)
  const nowIso = new Date().toISOString()

  db.exec('BEGIN IMMEDIATE')
  try {
    const payRow = db
      .prepare('SELECT * FROM finance_payments WHERE id = ? AND organization_id = ?')
      .get(paymentId, orgId) as Record<string, unknown> | undefined
    if (!payRow) throw new Error('Payment transaction not found.')
    const prev = mapPaymentRow(payRow)
    if (prev.isCorrected) throw new Error('This payment entry has already been corrected.')

    const emiRow = db
      .prepare('SELECT * FROM finance_emi_instalments WHERE id = ?')
      .get(prev.emiId) as Record<string, unknown> | undefined
    if (!emiRow) throw new Error('Linked EMI instalment not found.')
    const emi = mapEmiRow(emiRow)

    const nextAmount = roundInr(Number(input.correctedAmountInr))
    if (nextAmount < 0) throw new Error('Corrected amount cannot be negative.')

    // Recompute EMI paid sum across non-corrected payments + this corrected entry
    const delta = roundInr(nextAmount - prev.amountInr)
    const nextEmiPaid = roundInr(Math.max(0, emi.amountPaid + delta))
    const totalLiability = roundInr(emi.emiAmount + emi.lateFeeInr)
    if (nextEmiPaid > totalLiability + 0.01) {
      throw new Error(`Corrected amount causes EMI paid total (₹${nextEmiPaid}) to exceed EMI liability (₹${totalLiability}).`)
    }
    const nextRemaining = roundInr(Math.max(0, totalLiability - nextEmiPaid))
    const nextStatus = deriveEmiStatus(
      { ...emi, amountPaid: nextEmiPaid, remainingAmount: nextRemaining, status: nextRemaining <= 0.01 && nextEmiPaid > 0 ? 'paid' : 'upcoming' },
      todayIso,
      settings.dueSoonWindowDays,
    )

    // Preserve old row as corrected, insert new corrected row
    db.prepare('UPDATE finance_payments SET is_corrected = 1, correction_reason = ? WHERE id = ?').run(
      input.reason.trim(),
      paymentId,
    )

    const newPayId = `fpay-${crypto.randomUUID().slice(0, 10)}`
    const txRef = input.bankTransactionRef?.trim() || prev.bankTransactionRef
    db.prepare(`
      INSERT INTO finance_payments (
        id, organization_id, finance_id, emi_id, vehicle_id, emi_number, payment_date,
        amount_inr, late_fee_component_inr, payment_method, bank_transaction_ref,
        bank_transaction_ref_masked, receipt_doc_id, receipt_file_name, reconciliation_status,
        reconciled_by, reconciled_at, correction_of_payment_id, correction_reason,
        is_corrected, recorded_by, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?, 0, ?, ?, ?)
    `).run(
      newPayId,
      orgId,
      prev.financeId,
      prev.emiId,
      prev.vehicleId,
      prev.emiNumber,
      prev.paymentDate,
      nextAmount,
      prev.lateFeeComponentInr,
      prev.paymentMethod,
      txRef,
      maskAccountNumber(txRef),
      prev.receiptDocId ?? null,
      prev.receiptFileName ?? null,
      paymentId,
      input.reason.trim(),
      actor.fullName,
      `Audit correction of ${prev.id}: ${input.reason.trim()}`,
      nowIso,
    )

    db.prepare(`
      UPDATE finance_emi_instalments
      SET amount_paid = ?, remaining_amount = ?, status = ?, reconciliation_status = 'pending', updated_at = ?
      WHERE id = ?
    `).run(nextEmiPaid, nextRemaining, nextStatus, nowIso, emi.id)

    insertHistoryEntry(db, {
      organizationId: orgId,
      financeId: prev.financeId,
      entityType: 'payment',
      entityId: newPayId,
      fieldName: `Payment Correction (EMI #${prev.emiNumber})`,
      previousValue: `₹${prev.amountInr} (${prev.bankTransactionRefMasked})`,
      updatedValue: `₹${nextAmount} (${maskAccountNumber(txRef)})`,
      updateReason: input.reason.trim(),
      updatedBy: actor.fullName,
      updatedByRole: actor.role,
      approvalStatus: 'approved',
    })

    syncFinanceAlertsInDb(db, orgId, settings.defaultTimezone)
    db.exec('COMMIT')

    const updated = db.prepare('SELECT * FROM finance_payments WHERE id = ?').get(newPayId) as Record<string, unknown>
    return mapPaymentRow(updated)
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* ignore */ }
    throw err
  }
}

export function updateEmiStatusOrLateFee(
  db: DatabaseSync,
  orgId: string,
  emiId: string,
  actor: FinanceActor,
  input: {
    action: 'waive' | 'cancel' | 'add_late_fee'
    lateFeeInr?: number
    reason: string
  },
): EmiInstalment {
  if (!input.reason?.trim()) {
    throw new Error('A reason is required when modifying EMI status or adding a late fee.')
  }
  const settings = ensureOrgSettingsRow(db, orgId)
  const todayIso = getTodayIsoInTz(settings.defaultTimezone)
  const nowIso = new Date().toISOString()

  db.exec('BEGIN IMMEDIATE')
  try {
    const row = db
      .prepare('SELECT * FROM finance_emi_instalments WHERE id = ? AND organization_id = ?')
      .get(emiId, orgId) as Record<string, unknown> | undefined
    if (!row) throw new Error('EMI instalment not found.')
    const emi = mapEmiRow(row)

    if (input.action === 'add_late_fee') {
      if (!settings.allowManualLateFeeEntry) {
        throw new Error('Manual late fee entry is disabled in Finance Defaults.')
      }
      const addFee = roundInr(Number(input.lateFeeInr || 0))
      if (addFee <= 0) throw new Error('Late fee must be greater than zero.')
      const nextFee = roundInr(emi.lateFeeInr + addFee)
      const nextRemaining = roundInr(Math.max(0, emi.emiAmount + nextFee - emi.amountPaid))
      const nextStatus = deriveEmiStatus(
        { ...emi, lateFeeInr: nextFee, remainingAmount: nextRemaining },
        todayIso,
        settings.dueSoonWindowDays,
      )
      db.prepare(`
        UPDATE finance_emi_instalments
        SET late_fee_inr = ?, remaining_amount = ?, status = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `).run(nextFee, nextRemaining, nextStatus, input.reason.trim(), nowIso, emi.id)

      insertHistoryEntry(db, {
        organizationId: orgId,
        financeId: emi.financeId,
        entityType: 'finance_record',
        entityId: emi.id,
        fieldName: `EMI #${emi.emiNumber} Manual Late Fee`,
        previousValue: `₹${emi.lateFeeInr}`,
        updatedValue: `₹${nextFee}`,
        updateReason: input.reason.trim(),
        updatedBy: actor.fullName,
        updatedByRole: actor.role,
        approvalStatus: 'approved',
      })
    } else {
      if (emi.status === 'paid') {
        throw new Error('Paid EMIs cannot be waived or cancelled.')
      }
      const nextStatus: EmiPaymentStatus = input.action === 'waive' ? 'waived' : 'cancelled'
      db.prepare(`
        UPDATE finance_emi_instalments
        SET status = ?, remaining_amount = 0, notes = ?, updated_at = ?
        WHERE id = ?
      `).run(nextStatus, input.reason.trim(), nowIso, emi.id)

      insertHistoryEntry(db, {
        organizationId: orgId,
        financeId: emi.financeId,
        entityType: 'finance_record',
        entityId: emi.id,
        fieldName: `EMI #${emi.emiNumber} Status`,
        previousValue: emi.status,
        updatedValue: nextStatus,
        updateReason: input.reason.trim(),
        updatedBy: actor.fullName,
        updatedByRole: actor.role,
        approvalStatus: 'approved',
      })
    }

    syncFinanceAlertsInDb(db, orgId, settings.defaultTimezone)
    db.exec('COMMIT')

    const updated = db.prepare('SELECT * FROM finance_emi_instalments WHERE id = ?').get(emiId) as Record<string, unknown>
    return mapEmiRow(updated)
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* ignore */ }
    throw err
  }
}

export function uploadFinanceDocument(
  db: DatabaseSync,
  orgId: string,
  actor: FinanceActor,
  input: {
    financeId: string
    vehicleId: string
    category: FinanceDocCategory
    title: string
    expiryDate?: string
    requiresRenewal?: boolean
    parentDocId?: string
    notes?: string
    fileName: string
    mimeType: string
    contentBase64: string
  },
): FinanceDocumentItem {
  if (!input.financeId?.trim() || !input.title?.trim()) {
    throw new Error('Finance record and document title are required.')
  }
  const settings = ensureOrgSettingsRow(db, orgId)
  const nowIso = new Date().toISOString()

  db.exec('BEGIN IMMEDIATE')
  try {
    const recRow = db
      .prepare('SELECT id, vehicle_id FROM vehicle_finance_records WHERE id = ? AND organization_id = ?')
      .get(input.financeId, orgId) as { id: string; vehicle_id: string } | undefined
    if (!recRow) throw new Error('Vehicle finance record not found.')

    let nextVersion = 1
    if (input.parentDocId) {
      const parentRow = db
        .prepare('SELECT version FROM finance_documents WHERE id = ? AND organization_id = ?')
        .get(input.parentDocId, orgId) as { version: number } | undefined
      if (parentRow) nextVersion = Number(parentRow.version || 1) + 1
    } else {
      const sameCat = db
        .prepare('SELECT MAX(version) AS max_ver FROM finance_documents WHERE finance_id = ? AND category = ?')
        .get(input.financeId, input.category) as { max_ver: number | null } | undefined
      if (sameCat?.max_ver) nextVersion = Number(sameCat.max_ver) + 1
    }

    const stored = storeUploadedFile(db, orgId, input.fileName, input.mimeType, input.contentBase64)
    const fdocId = `fdoc-${crypto.randomUUID().slice(0, 10)}`

    db.prepare(`
      INSERT INTO finance_documents (
        id, organization_id, finance_id, vehicle_id, category, title, file_name,
        mime_type, file_size_bytes, storage_key, version, parent_doc_id,
        verification_status, verified_by, verified_at, expiry_date, requires_renewal,
        uploaded_by, uploaded_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_verification', NULL, NULL, ?, ?, ?, ?, ?)
    `).run(
      fdocId,
      orgId,
      input.financeId,
      recRow.vehicle_id,
      input.category,
      input.title.trim(),
      stored.safeName,
      input.mimeType,
      stored.fileSizeBytes,
      stored.storageKey,
      nextVersion,
      input.parentDocId ?? null,
      input.expiryDate || null,
      input.requiresRenewal ? 1 : 0,
      actor.fullName,
      nowIso,
      input.notes?.trim() || null,
    )

    insertHistoryEntry(db, {
      organizationId: orgId,
      financeId: input.financeId,
      entityType: 'document',
      entityId: fdocId,
      fieldName: 'Finance Document Upload',
      previousValue: input.parentDocId ? `Replaced doc v${nextVersion - 1}` : 'None',
      updatedValue: `${input.title.trim()} (v${nextVersion})`,
      updateReason: input.parentDocId ? 'Replaced finance document version' : 'Uploaded finance supporting document',
      updatedBy: actor.fullName,
      updatedByRole: actor.role,
      approvalStatus: 'approved',
    })

    syncFinanceAlertsInDb(db, orgId, settings.defaultTimezone)
    db.exec('COMMIT')

    const created = db.prepare('SELECT * FROM finance_documents WHERE id = ?').get(fdocId) as Record<string, unknown>
    return mapDocRow(created)
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* ignore */ }
    throw err
  }
}

export function verifyFinanceDocument(
  db: DatabaseSync,
  orgId: string,
  docId: string,
  actor: FinanceActor,
  status: 'verified' | 'rejected',
  notes?: string,
): FinanceDocumentItem {
  const nowIso = new Date().toISOString()
  db.exec('BEGIN IMMEDIATE')
  try {
    const row = db
      .prepare('SELECT * FROM finance_documents WHERE id = ? AND organization_id = ?')
      .get(docId, orgId) as Record<string, unknown> | undefined
    if (!row) throw new Error('Finance document not found.')
    const prev = mapDocRow(row)

    db.prepare(`
      UPDATE finance_documents
      SET verification_status = ?, verified_by = ?, verified_at = ?, notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(status, actor.fullName, nowIso, notes?.trim() || null, docId)

    insertHistoryEntry(db, {
      organizationId: orgId,
      financeId: prev.financeId,
      entityType: 'document',
      entityId: docId,
      fieldName: 'Document Verification Status',
      previousValue: prev.verificationStatus,
      updatedValue: status,
      updateReason: notes?.trim() || `Document ${status} by ${actor.fullName}`,
      updatedBy: actor.fullName,
      updatedByRole: actor.role,
      approvalStatus: 'approved',
    })

    db.exec('COMMIT')
    const updated = db.prepare('SELECT * FROM finance_documents WHERE id = ?').get(docId) as Record<string, unknown>
    return mapDocRow(updated)
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* ignore */ }
    throw err
  }
}

export function updateFinanceSettings(
  db: DatabaseSync,
  orgId: string,
  actor: FinanceActor,
  patch: Partial<Omit<FinanceNotificationSettings, 'organizationId' | 'smtpConfigured' | 'updatedAt' | 'updatedBy'>>,
  reason?: string,
): FinanceNotificationSettings {
  const prev = ensureOrgSettingsRow(db, orgId)
  const nowIso = new Date().toISOString()

  const next: FinanceNotificationSettings = {
    ...prev,
    reminderDaysBefore: patch.reminderDaysBefore ?? prev.reminderDaysBefore,
    notifyAfterDueDate: patch.notifyAfterDueDate ?? prev.notifyAfterDueDate,
    overdueEscalationDays: patch.overdueEscalationDays ?? prev.overdueEscalationDays,
    inAppEnabled: patch.inAppEnabled ?? prev.inAppEnabled,
    emailEnabled: patch.emailEnabled ?? prev.emailEnabled,
    recipientRoles: patch.recipientRoles ?? prev.recipientRoles,
    recipientEmails: patch.recipientEmails ?? prev.recipientEmails,
    defaultCurrency: 'INR',
    defaultTimezone: patch.defaultTimezone ?? prev.defaultTimezone,
    defaultReportingPeriod: patch.defaultReportingPeriod ?? prev.defaultReportingPeriod,
    partialPaymentRule: patch.partialPaymentRule ?? prev.partialPaymentRule,
    dueSoonWindowDays: patch.dueSoonWindowDays ?? prev.dueSoonWindowDays,
    allowManualLateFeeEntry: patch.allowManualLateFeeEntry ?? prev.allowManualLateFeeEntry,
    updatedAt: nowIso,
    updatedBy: actor.fullName,
  }

  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare(`
      UPDATE finance_notification_settings
      SET reminder_days_json = ?, notify_after_due_date = ?, overdue_escalation_days = ?,
          in_app_enabled = ?, email_enabled = ?, recipient_roles_json = ?, recipient_emails_json = ?,
          default_timezone = ?, default_reporting_period = ?, partial_payment_rule = ?,
          due_soon_window_days = ?, allow_manual_late_fee_entry = ?, updated_at = ?, updated_by = ?
      WHERE organization_id = ?
    `).run(
      JSON.stringify(next.reminderDaysBefore),
      next.notifyAfterDueDate ? 1 : 0,
      next.overdueEscalationDays,
      next.inAppEnabled ? 1 : 0,
      next.emailEnabled ? 1 : 0,
      JSON.stringify(next.recipientRoles),
      JSON.stringify(next.recipientEmails),
      next.defaultTimezone,
      next.defaultReportingPeriod,
      next.partialPaymentRule,
      next.dueSoonWindowDays,
      next.allowManualLateFeeEntry ? 1 : 0,
      nowIso,
      actor.fullName,
      orgId,
    )

    insertHistoryEntry(db, {
      organizationId: orgId,
      financeId: null,
      entityType: 'settings',
      entityId: orgId,
      fieldName: 'Finance Notification & Default Rules',
      previousValue: `Reminders [${prev.reminderDaysBefore.join(',')}] · Partial=${prev.partialPaymentRule} · DueSoon=${prev.dueSoonWindowDays}d`,
      updatedValue: `Reminders [${next.reminderDaysBefore.join(',')}] · Partial=${next.partialPaymentRule} · DueSoon=${next.dueSoonWindowDays}d`,
      updateReason: reason?.trim() || 'Updated finance notification rules and default settings',
      updatedBy: actor.fullName,
      updatedByRole: actor.role,
      approvalStatus: 'approved',
    })

    syncFinanceAlertsInDb(db, orgId, next.defaultTimezone)
    db.exec('COMMIT')
    return ensureOrgSettingsRow(db, orgId)
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* ignore */ }
    throw err
  }
}

export function ackFinanceAlert(
  db: DatabaseSync,
  orgId: string,
  alertId: string,
  mode: 'read' | 'ack' | 'read_all',
): void {
  if (mode === 'read_all') {
    db.prepare('UPDATE finance_alerts SET read = 1 WHERE organization_id = ?').run(orgId)
    return
  }
  if (mode === 'read') {
    db.prepare('UPDATE finance_alerts SET read = 1 WHERE id = ? AND organization_id = ?').run(alertId, orgId)
    return
  }
  db.prepare('UPDATE finance_alerts SET read = 1, acknowledged = 1 WHERE id = ? AND organization_id = ?').run(alertId, orgId)
}
