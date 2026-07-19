import type { Transaction } from "../ports/storage.js";

export type ReconciliationFactSource =
  | "business_order"
  | "payment_aggregate"
  | "ledger"
  | "provider_statement";
export type ReconciliationRecordType = "payment" | "refund" | "settlement" | "fee";
export type ReconciliationRunState =
  | "created"
  | "validating"
  | "matching"
  | "differences_found"
  | "balanced"
  | "failed"
  | "closed";
export type ReconciliationDifferenceType =
  | "provider_only_payment"
  | "provider_only_refund"
  | "internal_only_payment"
  | "internal_only_refund"
  | "payment_aggregate_missing"
  | "payment_amount_mismatch"
  | "refund_amount_mismatch"
  | "settlement_mismatch"
  | "duplicate_provider_payment"
  | "ledger_missing"
  | "fee_mismatch"
  | "aggregate_count_mismatch"
  | "aggregate_amount_mismatch"
  | "late_provider_callback"
  | "unknown_result"
  | "statement_validation_failed";
export type ReconciliationRecoveryActionType =
  | "query_original_request"
  | "recheck_next_batch"
  | "create_duplicate_payment_refund_case"
  | "repair_missing_ledger_idempotently"
  | "investigate_orphan_provider_payment";
export type FinancialAction = "settlement" | "payout" | "close";

export type ReconciliationFact = Readonly<{
  reconciliationFactId: string;
  source: ReconciliationFactSource;
  recordType: ReconciliationRecordType;
  businessDate: string;
  merchantId: string;
  internalOrderId: string;
  providerOrderId: string;
  providerEventId: string;
  amountMinor: string;
  feeMinor: string;
  currency: "CNY";
  state: string;
  occurredAt: string;
  settledAt: string;
  sourceDigest: string;
  late: boolean;
  synthetic: true;
}>;

export type ReconciliationRun = Readonly<{
  reconciliationRunId: string;
  provider: string;
  merchantId: string;
  businessDate: string;
  recordType: ReconciliationRecordType;
  sourceFileId: string;
  sourceFileDigest: string;
  state: ReconciliationRunState;
  expectedCount: string;
  expectedAmountMinor: string;
  actualCount: string;
  actualAmountMinor: string;
  differenceCount: string;
  differenceAmountMinor: string;
  statementSignatureVerified: boolean;
  controlTotalsVerified: boolean;
  sourcesComplete: boolean;
  synthetic: true;
}>;

export type ReconciliationDifference = Readonly<{
  reconciliationItemId: string;
  reconciliationRunId: string;
  differenceType: ReconciliationDifferenceType;
  internalReference: string;
  providerReference: string;
  internalAmountMinor: string;
  providerAmountMinor: string;
  differenceAmountMinor: string;
  currency: "CNY";
  state: "open" | "resolved";
  riskLevel: "medium" | "high" | "critical";
  details: Readonly<Record<string, string | boolean>>;
  resolutionType?: string;
  resolvedBy?: string;
  reviewedBy?: string;
  resolutionEvidenceReference?: string;
  synthetic: true;
}>;

export type ReconciliationRecoveryAction = Readonly<{
  recoveryActionId: string;
  reconciliationRunId: string;
  reconciliationItemId: string;
  actionType: ReconciliationRecoveryActionType;
  state: "pending" | "failed" | "completed";
  attempts: number;
  lastErrorCode?: string;
  synthetic: true;
}>;

export type ReconciliationEvaluation = Readonly<{
  run: ReconciliationRun;
  facts: readonly ReconciliationFact[];
  differences: readonly ReconciliationDifference[];
  recoveryActions: readonly ReconciliationRecoveryAction[];
}>;

export type ReconciliationRunInput = Readonly<{
  reconciliationRunId: string;
  provider: string;
  merchantId: string;
  businessDate: string;
  recordType: ReconciliationRecordType;
  sourceFileId: string;
  sourceFileDigest: string;
  statementSignatureVerified: boolean;
  controlTotalsVerified: boolean;
  facts: readonly ReconciliationFact[];
}>;

export interface ReconciliationRepository {
  saveEvaluation(evaluation: ReconciliationEvaluation): Promise<ReconciliationRun>;
  getRun(reconciliationRunId: string): Promise<ReconciliationRun | undefined>;
  listDifferences(reconciliationRunId: string): Promise<readonly ReconciliationDifference[]>;
  listRecoveryActions(
    reconciliationRunId: string,
  ): Promise<readonly ReconciliationRecoveryAction[]>;
  closeRun(reconciliationRunId: string): Promise<void>;
  assertActionAllowed(reconciliationRunId: string, action: FinancialAction): Promise<void>;
  closeBusinessDate(
    businessDate: string,
    preparedBy: string,
    reviewedBy: string,
  ): Promise<void>;
  recordRecoveryResult(
    recoveryActionId: string,
    result: Readonly<{ succeeded: boolean; errorCode?: string }>,
  ): Promise<void>;
  resolveDifference(
    reconciliationItemId: string,
    input: Readonly<{
      resolutionType: string;
      resolvedBy: string;
      reviewedBy: string;
      resolutionEvidenceReference: string;
    }>,
  ): Promise<void>;
}

export class FinancialReconciliationService {
  public constructor(
    private readonly repository: ReconciliationRepository,
    private readonly transaction: Transaction,
  ) {}

  public evaluate(input: ReconciliationRunInput): Promise<ReconciliationRun> {
    const evaluation = evaluateReconciliation(input);
    return this.transaction.run(() => this.repository.saveEvaluation(evaluation));
  }

  public listDifferences(
    reconciliationRunId: string,
  ): Promise<readonly ReconciliationDifference[]> {
    return this.repository.listDifferences(reconciliationRunId);
  }

  public listRecoveryActions(
    reconciliationRunId: string,
  ): Promise<readonly ReconciliationRecoveryAction[]> {
    return this.repository.listRecoveryActions(reconciliationRunId);
  }

  public closeRun(reconciliationRunId: string): Promise<void> {
    return this.transaction.run(() => this.repository.closeRun(reconciliationRunId));
  }

  public assertActionAllowed(
    reconciliationRunId: string,
    action: FinancialAction,
  ): Promise<void> {
    return this.repository.assertActionAllowed(reconciliationRunId, action);
  }

  public closeBusinessDate(input: Readonly<{
    businessDate: string;
    preparedBy: string;
    reviewedBy: string;
  }>): Promise<void> {
    if (input.preparedBy === input.reviewedBy) {
      return Promise.reject(new Error("RECONCILIATION_REVIEWER_MUST_DIFFER"));
    }
    return this.transaction.run(() =>
      this.repository.closeBusinessDate(
        input.businessDate,
        input.preparedBy,
        input.reviewedBy,
      ),
    );
  }

  public recordRecoveryResult(
    recoveryActionId: string,
    result: Readonly<{ succeeded: boolean; errorCode?: string }>,
  ): Promise<void> {
    return this.transaction.run(() =>
      this.repository.recordRecoveryResult(recoveryActionId, result),
    );
  }

  public resolveDifference(
    reconciliationItemId: string,
    input: Readonly<{
      resolutionType: string;
      resolvedBy: string;
      reviewedBy: string;
      resolutionEvidenceReference: string;
    }>,
  ): Promise<void> {
    if (input.resolvedBy === input.reviewedBy) {
      return Promise.reject(new Error("RECONCILIATION_REVIEWER_MUST_DIFFER"));
    }
    if (
      input.resolutionType.trim() === "" ||
      input.resolvedBy.trim() === "" ||
      input.reviewedBy.trim() === "" ||
      input.resolutionEvidenceReference.trim() === ""
    ) {
      return Promise.reject(new Error("RECONCILIATION_RESOLUTION_EVIDENCE_REQUIRED"));
    }
    return this.transaction.run(() =>
      this.repository.resolveDifference(reconciliationItemId, input),
    );
  }
}

export function evaluateReconciliation(
  input: ReconciliationRunInput,
): ReconciliationEvaluation {
  validateRunInput(input);
  const facts = [...input.facts];
  const businessFacts = facts.filter((fact) => fact.source === "business_order");
  const providerFacts = facts.filter((fact) => fact.source === "provider_statement");
  const expectedAmount = sumAmounts(businessFacts.map((fact) => fact.amountMinor));
  const actualAmount = sumAmounts(providerFacts.map((fact) => fact.amountMinor));
  const differenceAmount = actualAmount - expectedAmount;
  const differenceCount = BigInt(providerFacts.length - businessFacts.length);
  const sourcesComplete = (
    [
      "business_order",
      "payment_aggregate",
      "ledger",
      "provider_statement",
    ] as const
  ).every((source) => facts.some((fact) => fact.source === source));
  const differences: ReconciliationDifference[] = [];

  const addDifference = (
    differenceType: ReconciliationDifferenceType,
    values: Readonly<{
      internalReference?: string;
      providerReference?: string;
      internalAmount?: bigint;
      providerAmount?: bigint;
      riskLevel: ReconciliationDifference["riskLevel"];
      details?: Readonly<Record<string, string | boolean>>;
    }>,
  ) => {
    const internalAmount = values.internalAmount ?? 0n;
    const providerAmount = values.providerAmount ?? 0n;
    differences.push({
      reconciliationItemId: `${input.reconciliationRunId}:${differenceType}:${differences.length + 1}`,
      reconciliationRunId: input.reconciliationRunId,
      differenceType,
      internalReference: values.internalReference ?? "",
      providerReference: values.providerReference ?? "",
      internalAmountMinor: internalAmount.toString(),
      providerAmountMinor: providerAmount.toString(),
      differenceAmountMinor: (providerAmount - internalAmount).toString(),
      currency: "CNY",
      state: "open",
      riskLevel: values.riskLevel,
      details: values.details ?? {},
      synthetic: true,
    });
  };

  if (!input.statementSignatureVerified || !input.controlTotalsVerified) {
    addDifference("statement_validation_failed", {
      riskLevel: "critical",
      details: {
        statement_signature_verified: input.statementSignatureVerified,
        control_totals_verified: input.controlTotalsVerified,
      },
    });
  }

  const factsByOrder = new Map<string, ReconciliationFact[]>();
  for (const fact of facts) {
    const existing = factsByOrder.get(fact.internalOrderId) ?? [];
    existing.push(fact);
    factsByOrder.set(fact.internalOrderId, existing);
  }
  for (const [internalOrderId, orderFacts] of factsByOrder) {
    const business = orderFacts.find((fact) => fact.source === "business_order");
    const payment = orderFacts.find((fact) => fact.source === "payment_aggregate");
    const ledger = orderFacts.find((fact) => fact.source === "ledger");
    const providers = orderFacts.filter((fact) => fact.source === "provider_statement");
    const provider = providers[0];

    if (!business && provider) {
      addDifference(
        input.recordType === "refund" ? "provider_only_refund" : "provider_only_payment",
        {
        providerReference: provider.providerOrderId,
        providerAmount: amount(provider.amountMinor),
        riskLevel: "critical",
        },
      );
    }
    if (business && !provider) {
      addDifference(
        input.recordType === "refund" ? "internal_only_refund" : "internal_only_payment",
        {
        internalReference: internalOrderId,
        internalAmount: amount(business.amountMinor),
        riskLevel: "critical",
        },
      );
    }
    if (business && !payment) {
      addDifference("payment_aggregate_missing", {
        internalReference: internalOrderId,
        internalAmount: amount(business.amountMinor),
        riskLevel: "high",
      });
    }
    if (payment && !ledger && payment.state === "succeeded") {
      addDifference("ledger_missing", {
        internalReference: internalOrderId,
        internalAmount: amount(payment.amountMinor),
        riskLevel: "critical",
      });
    }
    if (providers.length > 1) {
      addDifference("duplicate_provider_payment", {
        internalReference: internalOrderId,
        providerReference: providers.map((fact) => fact.providerOrderId).join(","),
        internalAmount: business ? amount(business.amountMinor) : 0n,
        providerAmount: sumAmounts(providers.map((fact) => fact.amountMinor)),
        riskLevel: "critical",
      });
    }
    if (
      business &&
      provider &&
      providers.length === 1 &&
      business.amountMinor !== provider.amountMinor
    ) {
      addDifference(
        input.recordType === "refund"
          ? "refund_amount_mismatch"
          : input.recordType === "settlement"
            ? "settlement_mismatch"
            : "payment_amount_mismatch",
        {
        internalReference: internalOrderId,
        providerReference: provider.providerOrderId,
        internalAmount: amount(business.amountMinor),
        providerAmount: amount(provider.amountMinor),
        riskLevel: "critical",
        },
      );
    }
    if (payment && provider && payment.feeMinor !== provider.feeMinor) {
      addDifference("fee_mismatch", {
        internalReference: internalOrderId,
        providerReference: provider.providerOrderId,
        internalAmount: amount(payment.feeMinor),
        providerAmount: amount(provider.feeMinor),
        riskLevel: "high",
      });
    }
    if (payment && ["processing", "unknown"].includes(payment.state)) {
      addDifference("unknown_result", {
        internalReference: internalOrderId,
        providerReference: payment.providerOrderId,
        riskLevel: "high",
      });
    }
    for (const lateProvider of providers.filter((fact) => fact.late)) {
      addDifference("late_provider_callback", {
        internalReference: internalOrderId,
        providerReference: lateProvider.providerEventId,
        riskLevel: "medium",
      });
    }
  }

  if (differenceCount !== 0n) {
    addDifference("aggregate_count_mismatch", {
      internalAmount: BigInt(businessFacts.length),
      providerAmount: BigInt(providerFacts.length),
      riskLevel: "high",
    });
  }
  if (differenceAmount !== 0n) {
    addDifference("aggregate_amount_mismatch", {
      internalAmount: expectedAmount,
      providerAmount: actualAmount,
      riskLevel: "critical",
    });
  }

  const recoveryActions = differences
    .map((difference) => recoveryForDifference(difference))
    .filter(
      (action): action is ReconciliationRecoveryAction => action !== undefined,
    );
  const run: ReconciliationRun = {
    reconciliationRunId: input.reconciliationRunId,
    provider: input.provider,
    merchantId: input.merchantId,
    businessDate: input.businessDate,
    recordType: input.recordType,
    sourceFileId: input.sourceFileId,
    sourceFileDigest: input.sourceFileDigest,
    state: differences.length === 0 && sourcesComplete ? "balanced" : "differences_found",
    expectedCount: businessFacts.length.toString(),
    expectedAmountMinor: expectedAmount.toString(),
    actualCount: providerFacts.length.toString(),
    actualAmountMinor: actualAmount.toString(),
    differenceCount: differenceCount.toString(),
    differenceAmountMinor: differenceAmount.toString(),
    statementSignatureVerified: input.statementSignatureVerified,
    controlTotalsVerified: input.controlTotalsVerified,
    sourcesComplete,
    synthetic: true,
  };
  return { run, facts, differences, recoveryActions };
}

function recoveryForDifference(
  difference: ReconciliationDifference,
): ReconciliationRecoveryAction | undefined {
  const actionType: ReconciliationRecoveryActionType | undefined =
    difference.differenceType === "unknown_result" ||
    difference.differenceType === "internal_only_payment" ||
    difference.differenceType === "internal_only_refund"
      ? "query_original_request"
      : difference.differenceType === "late_provider_callback"
        ? "recheck_next_batch"
        : difference.differenceType === "duplicate_provider_payment"
          ? "create_duplicate_payment_refund_case"
          : difference.differenceType === "ledger_missing"
            ? "repair_missing_ledger_idempotently"
            : difference.differenceType === "provider_only_payment" ||
                difference.differenceType === "provider_only_refund"
              ? "investigate_orphan_provider_payment"
              : undefined;
  if (!actionType) return undefined;
  return {
    recoveryActionId: `${difference.reconciliationItemId}:recovery`,
    reconciliationRunId: difference.reconciliationRunId,
    reconciliationItemId: difference.reconciliationItemId,
    actionType,
    state: "pending",
    attempts: 0,
    synthetic: true,
  };
}

function validateRunInput(input: ReconciliationRunInput): void {
  for (const value of [
    input.reconciliationRunId,
    input.provider,
    input.merchantId,
    input.businessDate,
    input.sourceFileId,
    input.sourceFileDigest,
  ]) {
    if (value.trim() === "") throw new Error("RECONCILIATION_FIELD_REQUIRED");
  }
  if (!/^[0-9a-f]{64}$/.test(input.sourceFileDigest)) {
    throw new Error("RECONCILIATION_SOURCE_DIGEST_INVALID");
  }
  for (const fact of input.facts) {
    amount(fact.amountMinor);
    amount(fact.feeMinor, true);
    if (fact.currency !== "CNY" || fact.businessDate !== input.businessDate) {
      throw new Error("RECONCILIATION_FACT_INVALID");
    }
  }
}

function sumAmounts(values: readonly string[]): bigint {
  return values.reduce((total, value) => total + amount(value), 0n);
}

function amount(value: string, allowZero = false): bigint {
  const pattern = allowZero ? /^(0|[1-9][0-9]*)$/ : /^[1-9][0-9]*$/;
  if (!pattern.test(value)) throw new Error("RECONCILIATION_AMOUNT_INVALID");
  return BigInt(value);
}
