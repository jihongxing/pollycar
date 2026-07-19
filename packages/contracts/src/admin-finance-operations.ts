import type { AdminOrganizationContext } from "./admin-access.js";

export type AdminFinanceOperationState =
  | "eligible"
  | "ready"
  | "awaiting_review"
  | "approved"
  | "processing"
  | "succeeded"
  | "blocked"
  | "unknown";

export type AdminFinanceOperationsCenter = Readonly<{
  context: AdminOrganizationContext;
  businessDate: string;
  metrics: Readonly<{
    nonzeroDifferenceBlockers: number;
    awaitingIndependentReview: number;
    unknownResults: number;
    openFundCases: number;
  }>;
  tasks: readonly Readonly<{
    taskId: string;
    operatorId: string;
    operatorName: string;
    category: "settlement" | "payout" | "refund" | "reconciliation" | "business_day" | "recovery";
    state: AdminFinanceOperationState;
    summary: string;
    blocking: boolean;
    resourceVersion: number;
    synthetic: true;
  }>[];
  clientAmountEditAllowed: false;
  directBalanceMutationAllowed: false;
  synthetic: true;
}>;

export type AdminAllocationSettlement = Readonly<{
  context: AdminOrganizationContext;
  settlementBatchId: string;
  operatorId: string;
  operatorName: string;
  businessDate: string;
  state: AdminFinanceOperationState;
  allocationRuleVersion: "allocation-15-45-40-v1";
  allocationRates: Readonly<{ platform: 15; operator: 45; driver: 40 }>;
  allocationCount: number;
  platformShareMinor: string;
  operatorShareMinor: string;
  driverShareMinor: string;
  grossSettlementMinor: string;
  reconciliationRunId: string;
  blockers: readonly string[];
  preparedBy?: string;
  reviewedBy?: string;
  resourceVersion: number;
  amountEditable: false;
  synthetic: true;
}>;

export type AdminDriverPayout = Readonly<{
  context: AdminOrganizationContext;
  payoutBatchId: string;
  operatorId: string;
  operatorName: string;
  driverAccountMasked: string;
  bankAccountMasked: string;
  businessDate: string;
  state: AdminFinanceOperationState;
  allocationCount: number;
  grossPayableMinor: string;
  payoutFeeMinor: string;
  payoutFeeBorneBy: "operator";
  payoutFeeReducesDriverPayable: false;
  earlySettlementEnabled: false;
  duplicatePayoutAllowed: false;
  reconciliationRunId: string;
  blockers: readonly string[];
  preparedBy?: string;
  reviewedBy?: string;
  resourceVersion: number;
  synthetic: true;
}>;

export type AdminRefundReversal = Readonly<{
  context: AdminOrganizationContext;
  financeCaseId: string;
  operatorId: string;
  originalPaymentId: string;
  originalLedgerTransactionId: string;
  amountMinor: string;
  state: "liability_formed" | "refund_requested" | "refund_succeeded" | "reversal_requested" | "reversal_succeeded";
  providerResult: "pending" | "success" | "failed";
  originalRecordMutable: false;
  arbitraryJournalEntryAllowed: false;
  fullReversalMustBeEqualAndOpposite: true;
  resourceVersion: number;
  synthetic: true;
}>;

export type AdminReconciliationFundCases = Readonly<{
  context: AdminOrganizationContext;
  reconciliationRunId: string;
  businessDate: string;
  state: "differences_found" | "awaiting_review" | "closed";
  factSources: readonly ["business_order", "payment_aggregate", "ledger", "provider_statement"];
  differences: readonly Readonly<{
    reconciliationItemId: string;
    operatorId: string;
    differenceType: "duplicate_statement" | "late_callback" | "fee_mismatch";
    differenceAmountMinor: string;
    state: "open" | "awaiting_review" | "resolved";
    evidenceReference?: string;
    resolvedBy?: string;
    reviewedBy?: string;
  }>[];
  fundCases: readonly Readonly<{
    fundCaseId: string;
    operatorId: string;
    state: "open" | "resolved";
    blocking: boolean;
    summary: string;
  }>[];
  nonzeroDifferenceAutoWriteoffAllowed: false;
  resourceVersion: number;
  synthetic: true;
}>;

export type AdminBusinessDayClose = Readonly<{
  context: AdminOrganizationContext;
  businessDate: string;
  timezone: "Asia/Shanghai";
  state: "open" | "ready" | "awaiting_review" | "closed";
  allRunsClosed: boolean;
  fourSourcesPresent: boolean;
  zeroDifference: boolean;
  blockingFundCases: number;
  preparedBy?: string;
  reviewedBy?: string;
  reopenAllowed: false;
  historicalOverwriteAllowed: false;
  resourceVersion: number;
  synthetic: true;
}>;

export type AdminLedgerTransaction = Readonly<{
  context: AdminOrganizationContext;
  ledgerTransactionId: string;
  globalSequence: string;
  sourceNamespace: string;
  sourceEventId: string;
  requestDigest: string;
  operatorId: string;
  currency: "CNY";
  debitTotalMinor: string;
  creditTotalMinor: string;
  entries: readonly Readonly<{
    entryId: string;
    side: "debit" | "credit";
    accountCode: string;
    dimensionKey: string;
    amountMinor: string;
  }>[];
  balanceProjectionReadOnly: true;
  entryEditAllowed: false;
  entryDeleteAllowed: false;
  directReversalAllowed: false;
  synthetic: true;
}>;

type VersionedFinanceCommand<TType extends string> = Readonly<{
  type: TType;
  resourceId: string;
  resourceVersion: number;
  reasonCode: string;
}>;

export type AdminFinanceOperationsCommand =
  | VersionedFinanceCommand<"prepare_operator_settlement">
  | VersionedFinanceCommand<"review_operator_settlement">
  | VersionedFinanceCommand<"prepare_driver_payout">
  | VersionedFinanceCommand<"review_driver_payout">
  | VersionedFinanceCommand<"request_driver_payout">
  | VersionedFinanceCommand<"request_refund">
  | VersionedFinanceCommand<"request_full_reversal">
  | (VersionedFinanceCommand<"submit_reconciliation_resolution"> & Readonly<{ evidenceReference: string }>)
  | VersionedFinanceCommand<"review_reconciliation_resolution">
  | VersionedFinanceCommand<"prepare_business_day_close">
  | VersionedFinanceCommand<"review_business_day_close">
  | VersionedFinanceCommand<"query_finance_command_recovery">;

export type AdminFinanceOperationsCommandResult = Readonly<{
  commandType: AdminFinanceOperationsCommand["type"];
  resourceId: string;
  resourceVersion: number;
  state: string;
  requestDigest: string;
  synthetic: true;
}>;

export interface AdminFinanceOperationsClient {
  getFinanceOperationsCenter(): Promise<AdminFinanceOperationsCenter>;
  getAllocationSettlement(settlementBatchId: string): Promise<AdminAllocationSettlement>;
  getDriverPayout(payoutBatchId: string): Promise<AdminDriverPayout>;
  getRefundReversal(financeCaseId: string): Promise<AdminRefundReversal>;
  getReconciliationFundCases(reconciliationRunId: string): Promise<AdminReconciliationFundCases>;
  getBusinessDayClose(businessDate: string): Promise<AdminBusinessDayClose>;
  getLedgerTransaction(ledgerTransactionId: string): Promise<AdminLedgerTransaction>;
  executeFinanceOperationsCommand(
    command: AdminFinanceOperationsCommand,
  ): Promise<AdminFinanceOperationsCommandResult>;
}
