import type { LedgerPostResult } from "../ports/ledger.js";
import type { Transaction } from "../ports/storage.js";
import type { FinancialReconciliationService } from "./financial-reconciliation-service.js";
import type { SyntheticLedgerTemplateService } from "./synthetic-ledger-template-service.js";

export type DriverOperatorMembership = Readonly<{
  membershipId: string;
  driverAccountId: string;
  operatorEntityId: string;
  cityCode: string;
  vehicleId: string;
  state: "active" | "ended";
  effectiveFrom: string;
  effectiveTo?: string;
  synthetic: true;
}>;

export type FinancialAllocation = Readonly<{
  allocationId: string;
  paymentOrderId: string;
  tripId: string;
  driverAccountId: string;
  operatorEntityId: string;
  businessDate: string;
  allocableFareMinor: string;
  platformShareMinor: string;
  operatorShareMinor: string;
  driverShareMinor: string;
  ruleVersion: "allocation-15-45-40-v1";
  ledgerTransactionId: string;
  synthetic: true;
}>;

export type OperatorSettlementBatch = Readonly<{
  settlementBatchId: string;
  operatorEntityId: string;
  businessDate: string;
  reconciliationRunId: string;
  state: "ready" | "succeeded";
  allocationIds: readonly string[];
  grossAmountMinor: string;
  preparedBy: string;
  reviewedBy?: string;
  providerBatchId?: string;
  synthetic: true;
}>;

export type DriverPayoutBatch = Readonly<{
  payoutBatchId: string;
  operatorEntityId: string;
  driverAccountId: string;
  businessDate: string;
  reconciliationRunId: string;
  state: "awaiting_review" | "approved" | "processing" | "succeeded";
  allocationIds: readonly string[];
  grossPayableMinor: string;
  payoutFeeMinor: string;
  preparedBy: string;
  reviewedBy?: string;
  requestedLedgerTransactionId?: string;
  completedLedgerTransactionId?: string;
  synthetic: true;
}>;

export type OperatorFundCase = Readonly<{
  fundCaseId: string;
  operatorEntityId: string;
  caseType:
    | "settlement_blocked"
    | "payout_overdue"
    | "payout_unknown"
    | "funds_insufficient"
    | "refund_recovery";
  referenceType: string;
  referenceId: string;
  amountMinor: string;
  state: "open" | "resolved";
  reasonCode: string;
  evidenceReference: string;
  synthetic: true;
}>;

export interface OperatorFundsRepository {
  createMembership(input: Omit<DriverOperatorMembership, "state" | "synthetic">): Promise<void>;
  findActiveMembership(input: Readonly<{
    driverAccountId: string;
    cityCode: string;
    vehicleId: string;
    effectiveAt: string;
  }>): Promise<DriverOperatorMembership | undefined>;
  saveAllocation(allocation: FinancialAllocation): Promise<void>;
  getAllocation(allocationId: string): Promise<FinancialAllocation | undefined>;
  createSettlementBatch(batch: OperatorSettlementBatch): Promise<void>;
  getSettlementBatch(settlementBatchId: string): Promise<OperatorSettlementBatch | undefined>;
  completeSettlementBatch(input: Readonly<{
    settlementBatchId: string;
    reviewedBy: string;
    providerBatchId: string;
  }>): Promise<void>;
  createPayoutBatch(batch: DriverPayoutBatch): Promise<void>;
  getPayoutBatch(payoutBatchId: string): Promise<DriverPayoutBatch | undefined>;
  approvePayoutBatch(payoutBatchId: string, reviewedBy: string): Promise<void>;
  markPayoutRequested(payoutBatchId: string, ledgerTransactionId: string): Promise<void>;
  markPayoutCompleted(input: Readonly<{
    payoutBatchId: string;
    ledgerTransactionId: string;
    payoutFeeMinor: string;
  }>): Promise<void>;
  createFundCase(fundCase: OperatorFundCase): Promise<void>;
}

export class SyntheticOperatorFundsService {
  public constructor(
    private readonly repository: OperatorFundsRepository,
    private readonly ledgerTemplates: SyntheticLedgerTemplateService,
    private readonly reconciliation: FinancialReconciliationService,
    private readonly transaction: Transaction,
  ) {}

  public createPrimaryMembership(input: Readonly<{
    membershipId: string;
    driverAccountId: string;
    operatorEntityId: string;
    cityCode: string;
    vehicleId: string;
    effectiveFrom: string;
  }>): Promise<void> {
    validateRequiredStrings(input);
    return this.transaction.run(() => this.repository.createMembership(input));
  }

  public allocateTrip(input: Readonly<{
    allocationId: string;
    reconciliationRunId: string;
    paymentOrderId: string;
    tripId: string;
    passengerAccountId: string;
    driverAccountId: string;
    cityCode: string;
    vehicleId: string;
    businessDate: string;
    accountingPeriod: string;
    productCode: string;
    allocableFareMinor: string;
    sourceEventId: string;
    idempotencyKey: string;
    occurredAt: string;
  }>): Promise<FinancialAllocation> {
    validateRequiredStrings(input);
    const allocableFare = validatePositiveAmount(input.allocableFareMinor);
    return this.transaction.run(async () => {
      await this.reconciliation.assertActionAllowed(input.reconciliationRunId, "settlement");
      const membership = await this.repository.findActiveMembership({
        driverAccountId: input.driverAccountId,
        cityCode: input.cityCode,
        vehicleId: input.vehicleId,
        effectiveAt: input.occurredAt,
      });
      if (!membership) throw new Error("PRIMARY_OPERATOR_MEMBERSHIP_REQUIRED");
      const platformShare = (allocableFare * 1_500n) / 10_000n;
      const operatorShare = (allocableFare * 4_500n) / 10_000n;
      const driverShare = allocableFare - platformShare - operatorShare;
      const posted = await this.ledgerTemplates.postAllocation154540({
        reconciliationRunId: input.reconciliationRunId,
        allocationId: input.allocationId,
        paymentOrderId: input.paymentOrderId,
        tripId: input.tripId,
        passengerAccountId: input.passengerAccountId,
        operatorEntityId: membership.operatorEntityId,
        driverAccountId: input.driverAccountId,
        productCode: input.productCode,
        cityCode: input.cityCode,
        accountingPeriod: input.accountingPeriod,
        allocableFareMinor: input.allocableFareMinor,
        sourceEventId: input.sourceEventId,
        idempotencyKey: input.idempotencyKey,
        occurredAt: input.occurredAt,
      });
      const allocation: FinancialAllocation = {
        allocationId: input.allocationId,
        paymentOrderId: input.paymentOrderId,
        tripId: input.tripId,
        driverAccountId: input.driverAccountId,
        operatorEntityId: membership.operatorEntityId,
        businessDate: input.businessDate,
        allocableFareMinor: input.allocableFareMinor,
        platformShareMinor: platformShare.toString(),
        operatorShareMinor: operatorShare.toString(),
        driverShareMinor: driverShare.toString(),
        ruleVersion: "allocation-15-45-40-v1",
        ledgerTransactionId: posted.ledgerTransactionId,
        synthetic: true,
      };
      await this.repository.saveAllocation(allocation);
      return allocation;
    });
  }

  public createSettlementBatch(input: Readonly<{
    settlementBatchId: string;
    reconciliationRunId: string;
    operatorEntityId: string;
    businessDate: string;
    allocationIds: readonly string[];
    preparedBy: string;
  }>): Promise<OperatorSettlementBatch> {
    validateRequiredStrings(input);
    return this.transaction.run(async () => {
      await this.reconciliation.assertActionAllowed(input.reconciliationRunId, "settlement");
      const allocations = await this.loadAllocations(input.allocationIds);
      ensureAllocationOwnership(allocations, input.operatorEntityId);
      const grossAmountMinor = allocations
        .reduce(
          (total, allocation) =>
            total + BigInt(allocation.operatorShareMinor) + BigInt(allocation.driverShareMinor),
          0n,
        )
        .toString();
      const batch: OperatorSettlementBatch = {
        ...input,
        state: "ready",
        grossAmountMinor,
        synthetic: true,
      };
      await this.repository.createSettlementBatch(batch);
      return batch;
    });
  }

  public completeSettlementBatch(input: Readonly<{
    settlementBatchId: string;
    reviewedBy: string;
    providerBatchId: string;
  }>): Promise<void> {
    validateRequiredStrings(input);
    return this.transaction.run(async () => {
      const batch = await this.requireSettlementBatch(input.settlementBatchId);
      if (batch.preparedBy === input.reviewedBy) {
        throw new Error("FINANCE_REVIEWER_MUST_DIFFER");
      }
      await this.reconciliation.assertActionAllowed(batch.reconciliationRunId, "settlement");
      await this.repository.completeSettlementBatch(input);
    });
  }

  public createPayoutBatch(input: Readonly<{
    payoutBatchId: string;
    reconciliationRunId: string;
    operatorEntityId: string;
    driverAccountId: string;
    businessDate: string;
    allocationIds: readonly string[];
    preparedBy: string;
  }>): Promise<DriverPayoutBatch> {
    validateRequiredStrings(input);
    return this.transaction.run(async () => {
      await this.reconciliation.assertActionAllowed(input.reconciliationRunId, "payout");
      const allocations = await this.loadAllocations(input.allocationIds);
      ensureAllocationOwnership(allocations, input.operatorEntityId, input.driverAccountId);
      if (
        allocations.some(
          (allocation) => addUtcDays(allocation.businessDate, 1) !== input.businessDate,
        )
      ) {
        throw new Error("PAYOUT_BATCH_NOT_T_PLUS_ONE");
      }
      const batch: DriverPayoutBatch = {
        ...input,
        state: "awaiting_review",
        grossPayableMinor: allocations
          .reduce((total, allocation) => total + BigInt(allocation.driverShareMinor), 0n)
          .toString(),
        payoutFeeMinor: "0",
        synthetic: true,
      };
      await this.repository.createPayoutBatch(batch);
      return batch;
    });
  }

  public approvePayoutBatch(payoutBatchId: string, reviewedBy: string): Promise<void> {
    validateRequiredStrings({ payoutBatchId, reviewedBy });
    return this.transaction.run(async () => {
      const batch = await this.requirePayoutBatch(payoutBatchId);
      if (batch.preparedBy === reviewedBy) throw new Error("FINANCE_REVIEWER_MUST_DIFFER");
      await this.repository.approvePayoutBatch(payoutBatchId, reviewedBy);
    });
  }

  public requestPayout(input: Readonly<{
    payoutBatchId: string;
    sourceEventId: string;
    idempotencyKey: string;
    occurredAt: string;
  }>): Promise<LedgerPostResult> {
    validateRequiredStrings(input);
    return this.transaction.run(async () => {
      const batch = await this.requirePayoutBatch(input.payoutBatchId);
      if (batch.state !== "approved") throw new Error("PAYOUT_BATCH_NOT_APPROVED");
      await this.reconciliation.assertActionAllowed(batch.reconciliationRunId, "payout");
      const allocations = await this.loadAllocations(batch.allocationIds);
      const result = await this.ledgerTemplates.postDriverPayoutRequested({
        reconciliationRunId: batch.reconciliationRunId,
        payoutOrderId: batch.payoutBatchId,
        operatorEntityId: batch.operatorEntityId,
        driverAccountId: batch.driverAccountId,
        items: allocations.map((allocation) => ({
          tripId: allocation.tripId,
          amountMinor: allocation.driverShareMinor,
        })),
        sourceEventId: input.sourceEventId,
        idempotencyKey: input.idempotencyKey,
        occurredAt: input.occurredAt,
      });
      await this.repository.markPayoutRequested(batch.payoutBatchId, result.ledgerTransactionId);
      return result;
    });
  }

  public completePayout(input: Readonly<{
    payoutBatchId: string;
    legalEntityId: string;
    bankAccountRef: string;
    payoutProviderId: string;
    payoutFeeMinor: string;
    sourceEventId: string;
    idempotencyKey: string;
    occurredAt: string;
  }>): Promise<LedgerPostResult> {
    validateRequiredStrings(input);
    validateNonNegativeAmount(input.payoutFeeMinor);
    return this.transaction.run(async () => {
      const batch = await this.requirePayoutBatch(input.payoutBatchId);
      if (batch.state !== "processing") throw new Error("PAYOUT_BATCH_NOT_PROCESSING");
      await this.reconciliation.assertActionAllowed(batch.reconciliationRunId, "payout");
      const result = await this.ledgerTemplates.postDriverPayoutCompleted({
        reconciliationRunId: batch.reconciliationRunId,
        payoutOrderId: batch.payoutBatchId,
        operatorEntityId: batch.operatorEntityId,
        legalEntityId: input.legalEntityId,
        bankAccountRef: input.bankAccountRef,
        payoutProviderId: input.payoutProviderId,
        amountMinor: batch.grossPayableMinor,
        feeAmountMinor: input.payoutFeeMinor,
        sourceEventId: input.sourceEventId,
        idempotencyKey: input.idempotencyKey,
        occurredAt: input.occurredAt,
      });
      await this.repository.markPayoutCompleted({
        payoutBatchId: batch.payoutBatchId,
        ledgerTransactionId: result.ledgerTransactionId,
        payoutFeeMinor: input.payoutFeeMinor,
      });
      return result;
    });
  }

  public requestEarlySettlement(): Promise<never> {
    return Promise.reject(new Error("DRIVER_EARLY_SETTLEMENT_DISABLED"));
  }

  public createFundCase(input: Omit<OperatorFundCase, "state" | "synthetic">): Promise<void> {
    validateRequiredStrings(input);
    validateNonNegativeAmount(input.amountMinor);
    return this.transaction.run(() =>
      this.repository.createFundCase({ ...input, state: "open", synthetic: true }),
    );
  }

  private async loadAllocations(
    allocationIds: readonly string[],
  ): Promise<readonly FinancialAllocation[]> {
    if (allocationIds.length === 0 || new Set(allocationIds).size !== allocationIds.length) {
      throw new Error("ALLOCATION_SET_INVALID");
    }
    return await Promise.all(
      allocationIds.map(async (allocationId) => {
        const allocation = await this.repository.getAllocation(allocationId);
        if (!allocation) throw new Error("ALLOCATION_NOT_FOUND");
        return allocation;
      }),
    );
  }

  private async requireSettlementBatch(
    settlementBatchId: string,
  ): Promise<OperatorSettlementBatch> {
    const batch = await this.repository.getSettlementBatch(settlementBatchId);
    if (!batch) throw new Error("SETTLEMENT_BATCH_NOT_FOUND");
    return batch;
  }

  private async requirePayoutBatch(payoutBatchId: string): Promise<DriverPayoutBatch> {
    const batch = await this.repository.getPayoutBatch(payoutBatchId);
    if (!batch) throw new Error("PAYOUT_BATCH_NOT_FOUND");
    return batch;
  }

}

function ensureAllocationOwnership(
  allocations: readonly FinancialAllocation[],
  operatorEntityId: string,
  driverAccountId?: string,
): void {
  if (
    allocations.some(
      (allocation) =>
        allocation.operatorEntityId !== operatorEntityId ||
        (driverAccountId && allocation.driverAccountId !== driverAccountId),
    )
  ) {
    throw new Error("ALLOCATION_OWNERSHIP_MISMATCH");
  }
}

function validateRequiredStrings(input: Readonly<Record<string, unknown>>): void {
  for (const [field, value] of Object.entries(input)) {
    if (typeof value === "string" && value.trim() === "") {
      throw new Error(`OPERATOR_FUNDS_FIELD_REQUIRED:${field}`);
    }
  }
}

function validatePositiveAmount(value: string): bigint {
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error("OPERATOR_FUNDS_AMOUNT_INVALID");
  return BigInt(value);
}

function validateNonNegativeAmount(value: string): bigint {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("OPERATOR_FUNDS_AMOUNT_INVALID");
  }
  return BigInt(value);
}

function addUtcDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error("OPERATOR_FUNDS_DATE_INVALID");
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
