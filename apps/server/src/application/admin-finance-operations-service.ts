import { createHash } from "node:crypto";
import type {
  AdminAllocationSettlement,
  AdminBusinessDayClose,
  AdminDriverPayout,
  AdminFinanceOperationsCenter,
  AdminFinanceOperationsCommand,
  AdminFinanceOperationsCommandResult,
  AdminFunctionalRole,
  AdminLedgerTransaction,
  AdminReconciliationFundCases,
  AdminRefundReversal,
} from "@pollycar/contracts";
import {
  AdminAccessService,
  type AdminAccessActor,
} from "./admin-access-service.js";

type MutableSettlement = Omit<AdminAllocationSettlement, "context">;
type MutablePayout = Omit<AdminDriverPayout, "context">;
type MutableRefundReversal = Omit<AdminRefundReversal, "context">;
type MutableReconciliation = Omit<AdminReconciliationFundCases, "context">;
type MutableBusinessDay = Omit<AdminBusinessDayClose, "context">;
type LedgerSnapshot = Omit<AdminLedgerTransaction, "context">;

export type AdminFinanceDirectorySource = Readonly<{
  context: AdminFinanceOperationsCenter["context"];
  settlements: readonly MutableSettlement[];
  payouts: readonly MutablePayout[];
  refundReversals: readonly MutableRefundReversal[];
  reconciliations: readonly MutableReconciliation[];
  businessDays: readonly MutableBusinessDay[];
  ledgerTransactions: readonly LedgerSnapshot[];
}>;

const allFinanceRoles: readonly AdminFunctionalRole[] = Object.freeze([
  "finance_officer",
  "finance_lead",
  "operator_finance_officer",
  "operator_finance_lead",
  "auditor",
]);

export class AdminFinanceOperationsService {
  private readonly settlements = new Map<string, MutableSettlement>([
    [
      "settlement-synthetic-184",
      Object.freeze({
        settlementBatchId: "settlement-synthetic-184",
        operatorId: "operator-huhang",
        operatorName: "沪行出行服务",
        businessDate: "2026-07-13",
        state: "eligible",
        allocationRuleVersion: "allocation-15-45-40-v1",
        allocationRates: Object.freeze({ platform: 15, operator: 45, driver: 40 }),
        allocationCount: 127,
        platformShareMinor: "1912500",
        operatorShareMinor: "5733000",
        driverShareMinor: "5109000",
        grossSettlementMinor: "10842000",
        reconciliationRunId: "reconciliation-synthetic-0714-ready",
        blockers: Object.freeze([]),
        resourceVersion: 1,
        amountEditable: false,
        synthetic: true,
      }),
    ],
    [
      "settlement-synthetic-blocked",
      Object.freeze({
        settlementBatchId: "settlement-synthetic-blocked",
        operatorId: "operator-haiwan",
        operatorName: "海湾城市服务",
        businessDate: "2026-07-13",
        state: "blocked",
        allocationRuleVersion: "allocation-15-45-40-v1",
        allocationRates: Object.freeze({ platform: 15, operator: 45, driver: 40 }),
        allocationCount: 12,
        platformShareMinor: "28800",
        operatorShareMinor: "86400",
        driverShareMinor: "76800",
        grossSettlementMinor: "163200",
        reconciliationRunId: "reconciliation-synthetic-0714",
        blockers: Object.freeze(["nonzero_difference"]),
        resourceVersion: 3,
        amountEditable: false,
        synthetic: true,
      }),
    ],
  ]);

  private readonly payouts = new Map<string, MutablePayout>([
    [
      "payout-synthetic-0714",
      Object.freeze({
        payoutBatchId: "payout-synthetic-0714",
        operatorId: "operator-huhang",
        operatorName: "沪行出行服务",
        driverAccountMasked: "车主 SYN-D-041",
        bankAccountMasked: "银行卡尾号 3821",
        businessDate: "2026-07-13",
        state: "eligible",
        allocationCount: 8,
        grossPayableMinor: "128000",
        payoutFeeMinor: "300",
        payoutFeeBorneBy: "operator",
        payoutFeeReducesDriverPayable: false,
        earlySettlementEnabled: false,
        duplicatePayoutAllowed: false,
        reconciliationRunId: "reconciliation-synthetic-0714-ready",
        blockers: Object.freeze([]),
        resourceVersion: 1,
        synthetic: true,
      }),
    ],
    [
      "payout-synthetic-unknown",
      Object.freeze({
        payoutBatchId: "payout-synthetic-unknown",
        operatorId: "operator-huhang",
        operatorName: "沪行出行服务",
        driverAccountMasked: "车主 SYN-D-118",
        bankAccountMasked: "银行卡尾号 6108",
        businessDate: "2026-07-13",
        state: "unknown",
        allocationCount: 5,
        grossPayableMinor: "86000",
        payoutFeeMinor: "300",
        payoutFeeBorneBy: "operator",
        payoutFeeReducesDriverPayable: false,
        earlySettlementEnabled: false,
        duplicatePayoutAllowed: false,
        reconciliationRunId: "reconciliation-synthetic-0714-ready",
        blockers: Object.freeze(["unknown_result"]),
        preparedBy: "internal-operator-finance-officer-001",
        reviewedBy: "internal-operator-finance-lead-001",
        resourceVersion: 4,
        synthetic: true,
      }),
    ],
  ]);

  private readonly refundReversals = new Map<string, MutableRefundReversal>([
    [
      "finance-case-synthetic-071",
      Object.freeze({
        financeCaseId: "finance-case-synthetic-071",
        operatorId: "operator-huhang",
        originalPaymentId: "payment-synthetic-8821",
        originalLedgerTransactionId: "ledger-transaction-synthetic-19341",
        amountMinor: "26800",
        state: "liability_formed",
        providerResult: "pending",
        originalRecordMutable: false,
        arbitraryJournalEntryAllowed: false,
        fullReversalMustBeEqualAndOpposite: true,
        resourceVersion: 1,
        synthetic: true,
      }),
    ],
  ]);

  private readonly reconciliations = new Map<string, MutableReconciliation>([
    [
      "reconciliation-synthetic-0714",
      Object.freeze({
        reconciliationRunId: "reconciliation-synthetic-0714",
        businessDate: "2026-07-13",
        state: "differences_found",
        factSources: Object.freeze(["business_order", "payment_aggregate", "ledger", "provider_statement"] as const),
        differences: Object.freeze([
          Object.freeze({
            reconciliationItemId: "reconciliation-item-synthetic-204",
            operatorId: "operator-haiwan",
            differenceType: "duplicate_statement",
            differenceAmountMinor: "8600",
            state: "open",
          }),
          Object.freeze({
            reconciliationItemId: "reconciliation-item-synthetic-205",
            operatorId: "operator-huhang",
            differenceType: "late_callback",
            differenceAmountMinor: "4200",
            state: "open",
          }),
        ]),
        fundCases: Object.freeze([
          Object.freeze({
            fundCaseId: "fund-case-synthetic-071",
            operatorId: "operator-haiwan",
            state: "open",
            blocking: true,
            summary: "支付机构重复账单调查",
          }),
        ]),
        nonzeroDifferenceAutoWriteoffAllowed: false,
        resourceVersion: 1,
        synthetic: true,
      }),
    ],
    [
      "reconciliation-synthetic-0714-ready",
      Object.freeze({
        reconciliationRunId: "reconciliation-synthetic-0714-ready",
        businessDate: "2026-07-12",
        state: "closed",
        factSources: Object.freeze(["business_order", "payment_aggregate", "ledger", "provider_statement"] as const),
        differences: Object.freeze([]),
        fundCases: Object.freeze([]),
        nonzeroDifferenceAutoWriteoffAllowed: false,
        resourceVersion: 2,
        synthetic: true,
      }),
    ],
  ]);

  private readonly businessDays = new Map<string, MutableBusinessDay>([
    [
      "2026-07-13",
      Object.freeze({
        businessDate: "2026-07-13",
        timezone: "Asia/Shanghai",
        state: "open",
        allRunsClosed: false,
        fourSourcesPresent: true,
        zeroDifference: false,
        blockingFundCases: 1,
        reopenAllowed: false,
        historicalOverwriteAllowed: false,
        resourceVersion: 1,
        synthetic: true,
      }),
    ],
    [
      "2026-07-12",
      Object.freeze({
        businessDate: "2026-07-12",
        timezone: "Asia/Shanghai",
        state: "ready",
        allRunsClosed: true,
        fourSourcesPresent: true,
        zeroDifference: true,
        blockingFundCases: 0,
        reopenAllowed: false,
        historicalOverwriteAllowed: false,
        resourceVersion: 2,
        synthetic: true,
      }),
    ],
  ]);

  private readonly ledgerTransactions = new Map<string, LedgerSnapshot>([
    [
      "ledger-transaction-synthetic-19341",
      Object.freeze({
        ledgerTransactionId: "ledger-transaction-synthetic-19341",
        globalSequence: "18834",
        sourceNamespace: "payment_aggregate",
        sourceEventId: "payment-synthetic-8821",
        requestDigest: "sha256:91a09d57f01f8f63",
        operatorId: "operator-huhang",
        currency: "CNY",
        debitTotalMinor: "26800",
        creditTotalMinor: "26800",
        entries: Object.freeze([
          Object.freeze({
            entryId: "ledger-entry-synthetic-d1",
            side: "debit",
            accountCode: "provider_receivable",
            dimensionKey: "platform|shanghai|CNY|provider_receivable",
            amountMinor: "26800",
          }),
          Object.freeze({
            entryId: "ledger-entry-synthetic-c1",
            side: "credit",
            accountCode: "passenger_payable",
            dimensionKey: "platform|shanghai|CNY|passenger_payable",
            amountMinor: "26800",
          }),
        ]),
        balanceProjectionReadOnly: true,
        entryEditAllowed: false,
        entryDeleteAllowed: false,
        directReversalAllowed: false,
        synthetic: true,
      }),
    ],
  ]);

  private readonly commandResults = new Map<string, Readonly<{
    digest: string;
    internalUserId: string;
    organizationId: string;
    result: AdminFinanceOperationsCommandResult;
  }>>();
  private readonly recoveryStates = new Map<string, Readonly<{
    state: "open" | "reconciling_authoritative_state";
    resourceVersion: number;
  }>>([
    ["payout-synthetic-unknown", Object.freeze({ state: "open", resourceVersion: 1 })],
  ]);

  public constructor(
    private readonly enabled: boolean,
    private readonly access: AdminAccessService,
  ) {}

  public listDirectorySource(actor: AdminAccessActor): AdminFinanceDirectorySource {
    const session = this.authorize(
      actor,
      "admin_finance.directory.read",
      "finance_operations",
      "collection",
      allFinanceRoles,
    );
    const visibleOperators = new Set(session.context.operatorScopes);
    const platform = session.context.organizationType === "platform";
    return Object.freeze({
      context: session.context,
      settlements: Object.freeze(
        [...this.settlements.values()].filter((record) =>
          visibleOperators.has(record.operatorId),
        ),
      ),
      payouts: Object.freeze(
        [...this.payouts.values()].filter((record) =>
          visibleOperators.has(record.operatorId),
        ),
      ),
      refundReversals: Object.freeze(
        platform
          ? [...this.refundReversals.values()].filter((record) =>
              visibleOperators.has(record.operatorId),
            )
          : [],
      ),
      reconciliations: Object.freeze(
        [...this.reconciliations.values()]
          .map((record) =>
            Object.freeze({
              ...record,
              differences: Object.freeze(
                record.differences.filter((item) =>
                  visibleOperators.has(item.operatorId),
                ),
              ),
              fundCases: Object.freeze(
                record.fundCases.filter((item) =>
                  visibleOperators.has(item.operatorId),
                ),
              ),
            }),
          )
          .filter(
            (record) =>
              record.differences.length > 0 ||
              record.fundCases.length > 0 ||
              (platform && record.state === "closed"),
          ),
      ),
      businessDays: Object.freeze(
        platform ? [...this.businessDays.values()] : [],
      ),
      ledgerTransactions: Object.freeze(
        [...this.ledgerTransactions.values()].filter((record) =>
          visibleOperators.has(record.operatorId),
        ),
      ),
    });
  }

  public getOperationsCenter(actor: AdminAccessActor): AdminFinanceOperationsCenter {
    const session = this.authorize(actor, "admin_finance.operations.read", "finance_operations", "finance_operations_center", allFinanceRoles);
    const visibleOperators = new Set(session.context.operatorScopes);
    const tasks = [
      this.task("finance-task-settlement-184", "operator-huhang", "沪行出行服务", "settlement", this.settlements.get("settlement-synthetic-184")!.state, "运营主体清算等待准备", false, 1),
      this.task("finance-task-payout-unknown", "operator-huhang", "沪行出行服务", "recovery", "unknown", "车主付款请求返回未知结果", true, 4),
      this.task("finance-task-reconciliation-204", "operator-haiwan", "海湾城市服务", "reconciliation", "blocked", "非零差异阻断清算、付款和关账", true, 3),
    ].filter((task) => visibleOperators.has(task.operatorId));
    const visibleReviewRecords = [...this.settlements.values(), ...this.payouts.values()]
      .filter((item) => visibleOperators.has(item.operatorId));
    return Object.freeze({
      context: session.context,
      businessDate: "2026-07-13",
      metrics: Object.freeze({
        nonzeroDifferenceBlockers: tasks.filter((task) => task.category === "reconciliation" && task.blocking).length,
        awaitingIndependentReview: visibleReviewRecords.filter((item) => item.state === "ready" || item.state === "awaiting_review").length,
        unknownResults: tasks.filter((task) => task.state === "unknown").length,
        openFundCases: this.visibleFundCases(session.context.operatorScopes).length,
      }),
      tasks: Object.freeze(tasks),
      clientAmountEditAllowed: false,
      directBalanceMutationAllowed: false,
      synthetic: true,
    });
  }

  public getAllocationSettlement(actor: AdminAccessActor, resourceId: string): AdminAllocationSettlement {
    const record = this.requireSettlement(resourceId);
    const session = this.authorize(actor, "admin_finance.settlement.read", "finance_allocation_settlement", resourceId, allFinanceRoles, record.operatorId);
    this.auditAmount(actor, "admin_finance.settlement.read", "operator_settlement", resourceId);
    return Object.freeze({ context: session.context, ...record });
  }

  public getDriverPayout(actor: AdminAccessActor, resourceId: string): AdminDriverPayout {
    const record = this.requirePayout(resourceId);
    const session = this.authorize(actor, "admin_finance.payout.read", "finance_driver_payouts", resourceId, allFinanceRoles, record.operatorId);
    this.auditAmount(actor, "admin_finance.payout.read", "driver_payout", resourceId);
    return Object.freeze({ context: session.context, ...record });
  }

  public getRefundReversal(actor: AdminAccessActor, resourceId: string): AdminRefundReversal {
    const record = this.requireRefund(resourceId);
    const session = this.authorize(actor, "admin_finance.refund.read", "finance_refund_reversals", resourceId, ["finance_officer", "finance_lead", "auditor"], record.operatorId, true);
    this.auditAmount(actor, "admin_finance.refund.read", "refund_reversal", resourceId);
    return Object.freeze({ context: session.context, ...record });
  }

  public getReconciliationFundCases(actor: AdminAccessActor, resourceId: string): AdminReconciliationFundCases {
    const record = this.requireReconciliation(resourceId);
    const session = this.authorize(actor, "admin_finance.reconciliation.read", "finance_reconciliation_cases", resourceId, allFinanceRoles);
    const visibleOperators = new Set(session.context.operatorScopes);
    this.auditAmount(actor, "admin_finance.reconciliation.read", "finance_reconciliation", resourceId);
    return Object.freeze({
      context: session.context,
      ...record,
      differences: Object.freeze(record.differences.filter((item) => visibleOperators.has(item.operatorId))),
      fundCases: Object.freeze(record.fundCases.filter((item) => visibleOperators.has(item.operatorId))),
    });
  }

  public getBusinessDayClose(actor: AdminAccessActor, businessDate: string): AdminBusinessDayClose {
    const record = this.requireBusinessDay(businessDate);
    const session = this.authorize(actor, "admin_finance.business_day.read", "finance_business_day_close", businessDate, ["finance_officer", "finance_lead", "auditor"], undefined, true);
    return Object.freeze({ context: session.context, ...record });
  }

  public getLedgerTransaction(actor: AdminAccessActor, resourceId: string): AdminLedgerTransaction {
    const record = this.ledgerTransactions.get(resourceId);
    if (!record) throw new Error("ADMIN_FINANCE_LEDGER_SCOPE_FORBIDDEN");
    const session = this.authorize(actor, "admin_finance.ledger.read", "finance_ledger", resourceId, allFinanceRoles, record.operatorId);
    this.auditAmount(actor, "admin_finance.ledger.read", "ledger_transaction", resourceId);
    return Object.freeze({ context: session.context, ...record });
  }

  public executeCommand(
    actor: AdminAccessActor,
    idempotencyKey: string,
    command: AdminFinanceOperationsCommand,
  ): AdminFinanceOperationsCommandResult {
    this.requireEnabled();
    const requestSession = this.access.getSession(actor);
    const digest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
    const existing = this.commandResults.get(idempotencyKey);
    if (existing) {
      if (
        existing.digest !== digest ||
        existing.internalUserId !== requestSession.internalUserId ||
        existing.organizationId !== requestSession.context.organizationId
      ) {
        throw new Error("CONFLICT_IDEMPOTENCY_KEY_REUSED");
      }
      return existing.result;
    }
    const result = this.executeNewCommand(actor, command, digest);
    this.commandResults.set(idempotencyKey, Object.freeze({
      digest,
      internalUserId: requestSession.internalUserId,
      organizationId: requestSession.context.organizationId,
      result,
    }));
    return result;
  }

  private executeNewCommand(
    actor: AdminAccessActor,
    command: AdminFinanceOperationsCommand,
    digest: string,
  ): AdminFinanceOperationsCommandResult {
    if (command.reasonCode.trim() === "") throw new Error("VALIDATION_FAILED");
    switch (command.type) {
      case "prepare_operator_settlement":
        return this.prepareSettlement(actor, command, digest);
      case "review_operator_settlement":
        return this.reviewSettlement(actor, command, digest);
      case "prepare_driver_payout":
        return this.preparePayout(actor, command, digest);
      case "review_driver_payout":
        return this.reviewPayout(actor, command, digest);
      case "request_driver_payout":
        return this.requestPayout(actor, command, digest);
      case "request_refund":
      case "request_full_reversal":
        return this.requestRefundOrReversal(actor, command, digest);
      case "submit_reconciliation_resolution":
        return this.submitReconciliationResolution(actor, command, digest);
      case "review_reconciliation_resolution":
        return this.reviewReconciliationResolution(actor, command, digest);
      case "prepare_business_day_close":
        return this.prepareBusinessDay(actor, command, digest);
      case "review_business_day_close":
        return this.reviewBusinessDay(actor, command, digest);
      case "query_finance_command_recovery":
        return this.queryRecovery(actor, command, digest);
    }
  }

  private prepareSettlement(actor: AdminAccessActor, command: AdminFinanceOperationsCommand, digest: string) {
    const record = this.requireSettlement(command.resourceId);
    const session = this.authorize(actor, "admin_finance.settlement.prepare", "finance_allocation_settlement", command.resourceId, ["finance_officer"], record.operatorId, true);
    this.requireVersion(record.resourceVersion, command.resourceVersion);
    if (record.blockers.length > 0 || record.state === "blocked") throw new Error("ADMIN_FINANCE_SETTLEMENT_BLOCKED");
    if (record.state !== "eligible") throw new Error("ADMIN_FINANCE_SETTLEMENT_BLOCKED");
    const next = Object.freeze({ ...record, state: "ready" as const, preparedBy: session.internalUserId, resourceVersion: record.resourceVersion + 1 });
    this.settlements.set(command.resourceId, next);
    return this.result(actor, command, next.resourceVersion, next.state, digest, "finance_operation_changed");
  }

  private reviewSettlement(actor: AdminAccessActor, command: AdminFinanceOperationsCommand, digest: string) {
    const record = this.requireSettlement(command.resourceId);
    const session = this.authorize(actor, "admin_finance.settlement.review", "finance_allocation_settlement", command.resourceId, ["finance_lead"], record.operatorId, true);
    this.requireVersion(record.resourceVersion, command.resourceVersion);
    if (record.preparedBy === session.internalUserId) throw new Error("ADMIN_FINANCE_REVIEWER_CONFLICT");
    if (record.state !== "ready" || record.blockers.length > 0) throw new Error("ADMIN_FINANCE_SETTLEMENT_BLOCKED");
    const next = Object.freeze({ ...record, state: "succeeded" as const, reviewedBy: session.internalUserId, resourceVersion: record.resourceVersion + 1 });
    this.settlements.set(command.resourceId, next);
    return this.result(actor, command, next.resourceVersion, next.state, digest, "finance_review_recorded");
  }

  private preparePayout(actor: AdminAccessActor, command: AdminFinanceOperationsCommand, digest: string) {
    const record = this.requirePayout(command.resourceId);
    const session = this.authorize(actor, "admin_finance.payout.prepare", "finance_driver_payouts", command.resourceId, ["operator_finance_officer"], record.operatorId);
    this.requireVersion(record.resourceVersion, command.resourceVersion);
    if (record.state !== "eligible" || record.blockers.length > 0) throw new Error("ADMIN_FINANCE_PAYOUT_BLOCKED");
    const next = Object.freeze({ ...record, state: "awaiting_review" as const, preparedBy: session.internalUserId, resourceVersion: record.resourceVersion + 1 });
    this.payouts.set(command.resourceId, next);
    return this.result(actor, command, next.resourceVersion, next.state, digest, "finance_operation_changed");
  }

  private reviewPayout(actor: AdminAccessActor, command: AdminFinanceOperationsCommand, digest: string) {
    const record = this.requirePayout(command.resourceId);
    const session = this.authorize(actor, "admin_finance.payout.review", "finance_driver_payouts", command.resourceId, ["operator_finance_lead"], record.operatorId);
    this.requireVersion(record.resourceVersion, command.resourceVersion);
    if (record.preparedBy === session.internalUserId) throw new Error("ADMIN_FINANCE_REVIEWER_CONFLICT");
    if (record.state !== "awaiting_review") throw new Error("ADMIN_FINANCE_PAYOUT_BLOCKED");
    const next = Object.freeze({ ...record, state: "approved" as const, reviewedBy: session.internalUserId, resourceVersion: record.resourceVersion + 1 });
    this.payouts.set(command.resourceId, next);
    return this.result(actor, command, next.resourceVersion, next.state, digest, "finance_review_recorded");
  }

  private requestPayout(actor: AdminAccessActor, command: AdminFinanceOperationsCommand, digest: string) {
    const record = this.requirePayout(command.resourceId);
    this.authorize(actor, "admin_finance.payout.request", "finance_driver_payouts", command.resourceId, ["operator_finance_lead"], record.operatorId);
    this.requireVersion(record.resourceVersion, command.resourceVersion);
    if (record.state === "unknown") throw new Error("ADMIN_FINANCE_UNKNOWN_RESULT_IN_PROGRESS");
    if (record.state !== "approved") throw new Error("ADMIN_FINANCE_PAYOUT_BLOCKED");
    const next = Object.freeze({ ...record, state: "processing" as const, resourceVersion: record.resourceVersion + 1 });
    this.payouts.set(command.resourceId, next);
    return this.result(actor, command, next.resourceVersion, next.state, digest, "finance_operation_changed");
  }

  private requestRefundOrReversal(actor: AdminAccessActor, command: AdminFinanceOperationsCommand, digest: string) {
    const record = this.requireRefund(command.resourceId);
    this.authorize(actor, command.type === "request_refund" ? "admin_finance.refund.request" : "admin_finance.reversal.request", "finance_refund_reversals", command.resourceId, ["finance_officer"], record.operatorId, true);
    this.requireVersion(record.resourceVersion, command.resourceVersion);
    if (record.state !== "liability_formed") throw new Error(command.type === "request_refund" ? "ADMIN_FINANCE_REFUND_INELIGIBLE" : "ADMIN_FINANCE_REVERSAL_INVALID");
    const next = Object.freeze({
      ...record,
      state: command.type === "request_refund" ? "refund_requested" as const : "reversal_requested" as const,
      resourceVersion: record.resourceVersion + 1,
    });
    this.refundReversals.set(command.resourceId, next);
    return this.result(actor, command, next.resourceVersion, next.state, digest, "finance_operation_changed");
  }

  private submitReconciliationResolution(
    actor: AdminAccessActor,
    command: Extract<AdminFinanceOperationsCommand, { type: "submit_reconciliation_resolution" }>,
    digest: string,
  ) {
    const { record, difference } = this.requireDifference(command.resourceId);
    const session = this.authorize(actor, "admin_finance.reconciliation.resolve", "finance_reconciliation_cases", command.resourceId, ["finance_officer", "operator_finance_officer"], difference.operatorId);
    this.requireVersion(record.resourceVersion, command.resourceVersion);
    if (command.evidenceReference.trim() === "") throw new Error("ADMIN_FINANCE_RESOLUTION_EVIDENCE_REQUIRED");
    if (difference.state !== "open") throw new Error("ADMIN_FINANCE_RECONCILIATION_BLOCKED");
    const differences = record.differences.map((item) => item.reconciliationItemId === command.resourceId
      ? Object.freeze({ ...item, state: "awaiting_review" as const, evidenceReference: command.evidenceReference, resolvedBy: session.internalUserId })
      : item);
    const next = Object.freeze({ ...record, state: "awaiting_review" as const, differences: Object.freeze(differences), resourceVersion: record.resourceVersion + 1 });
    this.reconciliations.set(record.reconciliationRunId, next);
    return this.result(actor, command, next.resourceVersion, "awaiting_review", digest, "finance_operation_changed");
  }

  private reviewReconciliationResolution(actor: AdminAccessActor, command: AdminFinanceOperationsCommand, digest: string) {
    const { record, difference } = this.requireDifference(command.resourceId);
    const session = this.authorize(actor, "admin_finance.reconciliation.review", "finance_reconciliation_cases", command.resourceId, ["finance_lead", "operator_finance_lead"], difference.operatorId);
    this.requireVersion(record.resourceVersion, command.resourceVersion);
    if (difference.resolvedBy === session.internalUserId) throw new Error("ADMIN_FINANCE_REVIEWER_CONFLICT");
    if (difference.state !== "awaiting_review" || !difference.evidenceReference) throw new Error("ADMIN_FINANCE_RESOLUTION_EVIDENCE_REQUIRED");
    const differences = record.differences.map((item) => item.reconciliationItemId === command.resourceId
      ? Object.freeze({ ...item, state: "resolved" as const, reviewedBy: session.internalUserId })
      : item);
    const nextState = differences.every((item) => item.state === "resolved") ? "closed" as const : "differences_found" as const;
    const next = Object.freeze({ ...record, state: nextState, differences: Object.freeze(differences), resourceVersion: record.resourceVersion + 1 });
    this.reconciliations.set(record.reconciliationRunId, next);
    return this.result(actor, command, next.resourceVersion, "resolved", digest, "finance_review_recorded");
  }

  private prepareBusinessDay(actor: AdminAccessActor, command: AdminFinanceOperationsCommand, digest: string) {
    const record = this.requireBusinessDay(command.resourceId);
    const session = this.authorize(actor, "admin_finance.business_day.prepare", "finance_business_day_close", command.resourceId, ["finance_officer"], undefined, true);
    this.requireVersion(record.resourceVersion, command.resourceVersion);
    if (!record.allRunsClosed || !record.fourSourcesPresent || !record.zeroDifference || record.blockingFundCases > 0) throw new Error("ADMIN_FINANCE_DAY_CLOSE_BLOCKED");
    if (record.state !== "ready") throw new Error("ADMIN_FINANCE_DAY_CLOSE_BLOCKED");
    const next = Object.freeze({ ...record, state: "awaiting_review" as const, preparedBy: session.internalUserId, resourceVersion: record.resourceVersion + 1 });
    this.businessDays.set(command.resourceId, next);
    return this.result(actor, command, next.resourceVersion, next.state, digest, "finance_operation_changed");
  }

  private reviewBusinessDay(actor: AdminAccessActor, command: AdminFinanceOperationsCommand, digest: string) {
    const record = this.requireBusinessDay(command.resourceId);
    const session = this.authorize(actor, "admin_finance.business_day.review", "finance_business_day_close", command.resourceId, ["finance_lead"], undefined, true);
    this.requireVersion(record.resourceVersion, command.resourceVersion);
    if (record.preparedBy === session.internalUserId) throw new Error("ADMIN_FINANCE_REVIEWER_CONFLICT");
    if (record.state !== "awaiting_review") throw new Error("ADMIN_FINANCE_DAY_CLOSE_BLOCKED");
    const next = Object.freeze({ ...record, state: "closed" as const, reviewedBy: session.internalUserId, resourceVersion: record.resourceVersion + 1 });
    this.businessDays.set(command.resourceId, next);
    return this.result(actor, command, next.resourceVersion, next.state, digest, "finance_review_recorded");
  }

  private queryRecovery(actor: AdminAccessActor, command: AdminFinanceOperationsCommand, digest: string) {
    const payout = this.requirePayout(command.resourceId);
    this.authorize(actor, "admin_finance.recovery.read", "finance_operations", command.resourceId, ["technical_operations"], payout.operatorId);
    const recovery = this.recoveryStates.get(command.resourceId);
    if (!recovery) throw new Error("ADMIN_FINANCE_UNKNOWN_RESULT_IN_PROGRESS");
    this.requireVersion(recovery.resourceVersion, command.resourceVersion);
    const next = Object.freeze({ state: "reconciling_authoritative_state" as const, resourceVersion: recovery.resourceVersion + 1 });
    this.recoveryStates.set(command.resourceId, next);
    return this.result(actor, command, next.resourceVersion, next.state, digest, "finance_command_recovery_queried");
  }

  private result(
    actor: AdminAccessActor,
    command: AdminFinanceOperationsCommand,
    resourceVersion: number,
    state: string,
    digest: string,
    eventType: "finance_operation_changed" | "finance_review_recorded" | "finance_command_recovery_queried",
  ): AdminFinanceOperationsCommandResult {
    this.access.recordFinanceOperationsEvent(actor, {
      eventType,
      action: command.type,
      resourceType: "finance_operation",
      resourceId: command.resourceId,
      reasonCode: command.reasonCode,
    });
    return Object.freeze({
      commandType: command.type,
      resourceId: command.resourceId,
      resourceVersion,
      state,
      requestDigest: digest,
      synthetic: true,
    });
  }

  private authorize(
    actor: AdminAccessActor,
    action: string,
    module: Parameters<AdminAccessService["authorizeFinanceOperations"]>[1]["module"],
    resourceId: string,
    allowedRoles: readonly AdminFunctionalRole[],
    operatorId?: string,
    platformOnly = false,
  ) {
    this.requireEnabled();
    return this.access.authorizeFinanceOperations(actor, {
      action,
      module,
      resourceType: module,
      resourceId,
      allowedRoles,
      ...(operatorId ? { operatorId } : {}),
      ...(platformOnly ? { platformOnly: true } : {}),
    });
  }

  private auditAmount(actor: AdminAccessActor, action: string, resourceType: string, resourceId: string) {
    this.access.recordFinanceOperationsEvent(actor, {
      eventType: "finance_amount_viewed",
      action,
      resourceType,
      resourceId,
    });
  }

  private requireEnabled(): void {
    if (!this.enabled) throw new Error("FEATURE_DISABLED");
  }

  private requireVersion(actual: number, expected: number): void {
    if (actual !== expected) throw new Error("ADMIN_RESOURCE_VERSION_CONFLICT");
  }

  private requireSettlement(id: string): MutableSettlement {
    const record = this.settlements.get(id);
    if (!record) throw new Error("ADMIN_FINANCE_SCOPE_FORBIDDEN");
    return record;
  }

  private requirePayout(id: string): MutablePayout {
    const record = this.payouts.get(id);
    if (!record) throw new Error("ADMIN_FINANCE_OPERATOR_PAYMENT_DATA_FORBIDDEN");
    return record;
  }

  private requireRefund(id: string): MutableRefundReversal {
    const record = this.refundReversals.get(id);
    if (!record) throw new Error("ADMIN_FINANCE_REFUND_INELIGIBLE");
    return record;
  }

  private requireReconciliation(id: string): MutableReconciliation {
    const record = this.reconciliations.get(id);
    if (!record) throw new Error("ADMIN_FINANCE_RECONCILIATION_BLOCKED");
    return record;
  }

  private requireDifference(id: string): Readonly<{ record: MutableReconciliation; difference: MutableReconciliation["differences"][number] }> {
    for (const record of this.reconciliations.values()) {
      const difference = record.differences.find((item) => item.reconciliationItemId === id);
      if (difference) return { record, difference };
    }
    throw new Error("ADMIN_FINANCE_RECONCILIATION_BLOCKED");
  }

  private requireBusinessDay(id: string): MutableBusinessDay {
    const record = this.businessDays.get(id);
    if (!record) throw new Error("ADMIN_FINANCE_DAY_CLOSE_BLOCKED");
    return record;
  }

  private visibleFundCases(operatorIds: readonly string[]) {
    const scope = new Set(operatorIds);
    return [...this.reconciliations.values()].flatMap((record) => record.fundCases).filter((item) => scope.has(item.operatorId) && item.state === "open");
  }

  private task(
    taskId: string,
    operatorId: string,
    operatorName: string,
    category: AdminFinanceOperationsCenter["tasks"][number]["category"],
    state: AdminFinanceOperationsCenter["tasks"][number]["state"],
    summary: string,
    blocking: boolean,
    resourceVersion: number,
  ): AdminFinanceOperationsCenter["tasks"][number] {
    return Object.freeze({ taskId, operatorId, operatorName, category, state, summary, blocking, resourceVersion, synthetic: true });
  }
}
