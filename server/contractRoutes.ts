import express, { type NextFunction, type Response, type Router } from 'express'
import type { OrganizationRole } from '../src/types/fleet.ts'
import type {
  ContractPaymentStatus,
  ContractStatus,
  CreateAmendmentInput,
  CreateContractInput,
  DepositType,
  MaintenanceResponsibility,
  OwnershipType,
  SupplierType,
} from '../src/types/contracts.ts'
import { canPerformContractAction, type ContractAction } from '../src/utils/rbac.ts'
import {
  requireActiveOrganization,
  requireAuth,
  requirePasswordChanged,
  type AuthenticatedRequest,
} from './authMiddleware.ts'
import {
  addContractDocument,
  approveAmendment,
  approveDepositRefund,
  approveMaintenanceAllocation,
  createAmendment,
  createContract,
  createDeposit,
  createFleetPartner,
  createHandover,
  createIndividualOwner,
  createMaintenanceAllocation,
  createPayment,
  getContractActivity,
  getContractOverview,
  getContractRenewals,
  getContractWorkspace,
  recordDepositDeduction,
  recordDepositPayment,
  settleMaintenanceAllocation,
  submitAmendment,
  updateContractStatus,
  updateFleetPartner,
  updateIndividualOwner,
  updatePaymentStatus,
  type ContractActor,
} from './contractsDb.ts'
import { getDb } from './db.ts'

function actorOf(req: AuthenticatedRequest): ContractActor {
  return {
    userId: req.authUser!.id,
    username: req.authUser!.username,
    fullName: req.authUser!.fullName,
    role: req.authUser!.role,
  }
}

function requireContractAction(action: ContractAction) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const role = req.authUser?.role as OrganizationRole | undefined
    if (!role || !canPerformContractAction(role, action)) {
      res.status(403).json({
        error: `Role "${String(role ?? 'guest').replace(/_/g, ' ')}" is not authorized for this contract action.`,
        code: 'CONTRACT_FORBIDDEN',
        action,
      })
      return
    }
    next()
  }
}

function fail(res: Response, err: unknown): void {
  const message = err instanceof Error ? err.message : 'Contract operation failed.'
  res.status(400).json({ error: message })
}

export function buildContractRouter(): Router {
  const router = express.Router()
  const guarded = [requireAuth, requirePasswordChanged, requireActiveOrganization]

  router.get('/workspace', ...guarded, requireContractAction('view_contracts'), (req: AuthenticatedRequest, res: Response) => {
    const org = req.activeOrg!
    res.json({ organization: org, role: req.authUser!.role, ...getContractWorkspace(getDb(), org.id) })
  })

  router.get('/overview', ...guarded, requireContractAction('view_contracts'), (req: AuthenticatedRequest, res: Response) => {
    res.json(getContractOverview(getDb(), req.activeOrg!.id))
  })

  router.get('/renewals', ...guarded, requireContractAction('view_contracts'), (req: AuthenticatedRequest, res: Response) => {
    res.json({ renewals: getContractRenewals(getDb(), req.activeOrg!.id) })
  })

  router.get('/activity', ...guarded, requireContractAction('view_contracts'), (req: AuthenticatedRequest, res: Response) => {
    const limit = Number(req.query.limit ?? 300)
    res.json({ activity: getContractActivity(getDb(), req.activeOrg!.id, Number.isFinite(limit) ? limit : 300) })
  })

  router.get('/vehicle-ownership', ...guarded, requireContractAction('view_contracts'), (req: AuthenticatedRequest, res: Response) => {
    const workspace = getContractWorkspace(getDb(), req.activeOrg!.id)
    res.json({ ownership: workspace.ownership })
  })

  // ---------- Fleet partners ----------
  router.post('/partners', ...guarded, requireContractAction('manage_suppliers'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const partner = createFleetPartner(getDb(), req.activeOrg!.id, req.body ?? {}, actorOf(req).fullName)
      res.status(201).json({ partner })
    } catch (err) {
      fail(res, err)
    }
  })

  router.patch('/partners/:partnerId', ...guarded, requireContractAction('manage_suppliers'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const partner = updateFleetPartner(getDb(), req.activeOrg!.id, req.params.partnerId, req.body ?? {}, actorOf(req).fullName)
      res.json({ partner })
    } catch (err) {
      fail(res, err)
    }
  })

  // ---------- Individual owners ----------
  router.post('/owners', ...guarded, requireContractAction('manage_individual_owners'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = createIndividualOwner(getDb(), req.activeOrg!.id, req.body ?? {}, actorOf(req).fullName)
      res.status(201).json({ owner })
    } catch (err) {
      fail(res, err)
    }
  })

  router.patch('/owners/:ownerId', ...guarded, requireContractAction('manage_individual_owners'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = updateIndividualOwner(getDb(), req.activeOrg!.id, req.params.ownerId, req.body ?? {}, actorOf(req).fullName)
      res.json({ owner })
    } catch (err) {
      fail(res, err)
    }
  })

  // ---------- Contracts ----------
  router.post('/', ...guarded, requireContractAction('create_contracts'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = req.body as CreateContractInput
      if (!body || typeof body !== 'object') throw new Error('Invalid contract payload.')
      if (body.supplierType !== 'fleet_partner' && body.supplierType !== 'individual_owner') {
        throw new Error('Supplier type must be fleet_partner or individual_owner.')
      }
      const contract = createContract(
        getDb(),
        req.activeOrg!.id,
        actorOf(req).fullName,
        {
          ...body,
          category: body.category ?? 'custom',
          financialTerms: body.financialTerms ?? {},
          conditions: body.conditions ?? {},
          vehicles: Array.isArray(body.vehicles) ? body.vehicles : [],
        },
        actorOf(req).userId,
      )
      res.status(201).json({ contract })
    } catch (err) {
      fail(res, err)
    }
  })

  router.patch('/:contractId/status', ...guarded, (req: AuthenticatedRequest, res: Response) => {
    try {
      const status = req.body?.status as ContractStatus
      const actor = actorOf(req)
      const approvalStatuses: ContractStatus[] = ['active', 'pending_approval', 'closed', 'terminated', 'termination_requested']
      const required: ContractAction = status === 'closed' || status === 'terminated' || status === 'termination_requested'
        ? 'terminate_contracts'
        : approvalStatuses.includes(status)
          ? 'approve_contracts'
          : 'edit_contracts'
      if (!canPerformContractAction(actor.role as OrganizationRole, required)) {
        res.status(403).json({ error: 'Not authorized to change the contract to this status.', code: 'CONTRACT_FORBIDDEN', action: required })
        return
      }
      const contract = updateContractStatus(
        getDb(),
        req.activeOrg!.id,
        req.params.contractId,
        status,
        actor.fullName,
        { allowUnresolved: req.body?.allowUnresolved === true && canPerformContractAction(actor.role as OrganizationRole, 'approve_contracts') },
      )
      res.json({ contract })
    } catch (err) {
      fail(res, err)
    }
  })

  // ---------- Amendments ----------
  router.post('/:contractId/amendments', ...guarded, requireContractAction('create_amendments'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = req.body as CreateAmendmentInput
      const amendment = createAmendment(getDb(), req.activeOrg!.id, req.params.contractId, body, actorOf(req).fullName)
      res.status(201).json({ amendment })
    } catch (err) {
      fail(res, err)
    }
  })

  router.post('/:contractId/amendments/:amendmentId/submit', ...guarded, requireContractAction('create_amendments'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const amendment = submitAmendment(getDb(), req.activeOrg!.id, req.params.contractId, req.params.amendmentId, actorOf(req).fullName)
      res.json({ amendment })
    } catch (err) {
      fail(res, err)
    }
  })

  router.post('/:contractId/amendments/:amendmentId/decision', ...guarded, requireContractAction('approve_amendments'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const amendment = approveAmendment(
        getDb(),
        req.activeOrg!.id,
        req.params.contractId,
        req.params.amendmentId,
        actorOf(req).fullName,
        req.body?.approve !== false,
      )
      res.json({ amendment })
    } catch (err) {
      fail(res, err)
    }
  })

  // ---------- Deposits ----------
  router.post('/:contractId/deposits', ...guarded, requireContractAction('manage_security_deposits'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const deposit = createDeposit(
        getDb(),
        req.activeOrg!.id,
        req.params.contractId,
        {
          depositType: req.body?.depositType as DepositType,
          vehicleIds: Array.isArray(req.body?.vehicleIds) ? req.body.vehicleIds : undefined,
          requiredAmountInr: Number(req.body?.requiredAmountInr),
          refundable: req.body?.refundable !== false,
          refundConditions: req.body?.refundConditions,
          receivingParty: req.body?.receivingParty,
          documentReference: req.body?.documentReference,
          expiryDate: req.body?.expiryDate,
        },
        actorOf(req).fullName,
      )
      res.status(201).json({ deposit })
    } catch (err) {
      fail(res, err)
    }
  })

  router.post('/:contractId/deposits/:depositId/payments', ...guarded, requireContractAction('manage_security_deposits'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const deposit = recordDepositPayment(getDb(), req.activeOrg!.id, req.params.contractId, req.params.depositId, req.body ?? {}, actorOf(req).fullName)
      res.json({ deposit })
    } catch (err) {
      fail(res, err)
    }
  })

  router.post('/:contractId/deposits/:depositId/deductions', ...guarded, requireContractAction('approve_deposit_refunds'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const deposit = recordDepositDeduction(getDb(), req.activeOrg!.id, req.params.contractId, req.params.depositId, req.body ?? {}, actorOf(req).fullName)
      res.json({ deposit })
    } catch (err) {
      fail(res, err)
    }
  })

  router.post('/:contractId/deposits/:depositId/refund', ...guarded, requireContractAction('approve_deposit_refunds'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const deposit = approveDepositRefund(getDb(), req.activeOrg!.id, req.params.contractId, req.params.depositId, actorOf(req).fullName)
      res.json({ deposit })
    } catch (err) {
      fail(res, err)
    }
  })

  // ---------- Payments ----------
  router.post('/:contractId/payments', ...guarded, requireContractAction('manage_contract_payments'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const payment = createPayment(getDb(), req.activeOrg!.id, req.params.contractId, req.body ?? {}, actorOf(req).fullName)
      res.status(201).json({ payment })
    } catch (err) {
      fail(res, err)
    }
  })

  router.patch('/:contractId/payments/:paymentId', ...guarded, (req: AuthenticatedRequest, res: Response) => {
    try {
      const status = req.body?.status as ContractPaymentStatus
      const actor = actorOf(req)
      const required: ContractAction = status === 'approved' || status === 'reconciled'
        ? 'approve_contract_payments'
        : 'manage_contract_payments'
      if (!canPerformContractAction(actor.role as OrganizationRole, required)) {
        res.status(403).json({ error: 'Not authorized for this payment action.', code: 'CONTRACT_FORBIDDEN', action: required })
        return
      }
      const payment = updatePaymentStatus(
        getDb(),
        req.activeOrg!.id,
        req.params.contractId,
        req.params.paymentId,
        status,
        actor.fullName,
        req.body?.paidAmountInr === undefined ? undefined : Number(req.body.paidAmountInr),
        req.body?.paymentReference,
      )
      res.json({ payment })
    } catch (err) {
      fail(res, err)
    }
  })

  // ---------- Maintenance allocations ----------
  router.post('/:contractId/maintenance', ...guarded, requireContractAction('manage_contract_maintenance'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const allocation = createMaintenanceAllocation(
        getDb(),
        req.activeOrg!.id,
        req.params.contractId,
        {
          vehicleId: String(req.body?.vehicleId ?? ''),
          workOrderId: req.body?.workOrderId,
          category: String(req.body?.category ?? 'Other'),
          description: String(req.body?.description ?? ''),
          totalCostInr: Number(req.body?.totalCostInr),
          operatingOrgShareInr: Number(req.body?.operatingOrgShareInr),
          supplierShareInr: Number(req.body?.supplierShareInr),
          responsibility: req.body?.responsibility as MaintenanceResponsibility,
        },
        actorOf(req).fullName,
      )
      res.status(201).json({ allocation })
    } catch (err) {
      fail(res, err)
    }
  })

  router.post('/:contractId/maintenance/:allocationId/decision', ...guarded, requireContractAction('approve_contract_maintenance'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const allocation = approveMaintenanceAllocation(
        getDb(),
        req.activeOrg!.id,
        req.params.contractId,
        req.params.allocationId,
        actorOf(req).fullName,
        req.body?.approve !== false,
      )
      res.json({ allocation })
    } catch (err) {
      fail(res, err)
    }
  })

  router.post('/:contractId/maintenance/:allocationId/settle', ...guarded, requireContractAction('approve_contract_maintenance'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const allocation = settleMaintenanceAllocation(getDb(), req.activeOrg!.id, req.params.contractId, req.params.allocationId, actorOf(req).fullName)
      res.json({ allocation })
    } catch (err) {
      fail(res, err)
    }
  })

  // ---------- Handovers ----------
  router.post('/:contractId/handovers', ...guarded, requireContractAction('record_handovers'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const handover = createHandover(
        getDb(),
        req.activeOrg!.id,
        req.params.contractId,
        {
          vehicleId: String(req.body?.vehicleId ?? ''),
          handoverType: req.body?.handoverType === 'return' ? 'return' : 'handover',
          handoverAt: String(req.body?.handoverAt ?? ''),
          odometerKm: Number(req.body?.odometerKm ?? 0),
          fuelLevelPct: Number(req.body?.fuelLevelPct ?? 0),
          exteriorCondition: String(req.body?.exteriorCondition ?? ''),
          interiorCondition: String(req.body?.interiorCondition ?? ''),
          tyreCondition: String(req.body?.tyreCondition ?? ''),
          existingDamages: req.body?.existingDamages,
          accessories: req.body?.accessories,
          photoReferences: Array.isArray(req.body?.photoReferences) ? req.body.photoReferences : [],
          documentChecklist: Array.isArray(req.body?.documentChecklist) ? req.body.documentChecklist : [],
          supplierRepresentative: req.body?.supplierRepresentative,
          receivingRepresentative: req.body?.receivingRepresentative,
          notes: req.body?.notes,
        },
        actorOf(req).fullName,
      )
      res.status(201).json({ handover })
    } catch (err) {
      fail(res, err)
    }
  })

  // ---------- Documents ----------
  router.post('/:contractId/documents', ...guarded, requireContractAction('manage_contract_documents'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const document = addContractDocument(getDb(), req.activeOrg!.id, req.params.contractId, req.body ?? {}, actorOf(req).fullName)
      res.status(201).json({ document })
    } catch (err) {
      fail(res, err)
    }
  })

  return router
}

export type { OwnershipType, SupplierType }
