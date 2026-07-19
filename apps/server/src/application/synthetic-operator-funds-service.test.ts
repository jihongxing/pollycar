import { describe, expect, it } from "vitest";
import type { LedgerPostingCommand, LedgerRepository } from "../ports/ledger.js";
import type { Transaction } from "../ports/storage.js";
import type { FinancialReconciliationService } from "./financial-reconciliation-service.js";
import {
  SyntheticOperatorFundsService,
  type DriverOperatorMembership,
  type DriverPayoutBatch,
  type FinancialAllocation,
  type OperatorFundCase,
  type OperatorFundsRepository,
  type OperatorSettlementBatch,
} from "./synthetic-operator-funds-service.js";
import { SyntheticLedgerTemplateService } from "./synthetic-ledger-template-service.js";

describe("多运营主体合成资金编排", () => {
  it("按主运营快照完成 15/45/40 分配且尾差进入车主份额", async () => {
    const harness = createHarness();
    await harness.service.createPrimaryMembership(membershipInput());
    const allocation = await harness.service.allocateTrip(allocationInput());

    expect(allocation).toMatchObject({
      operatorEntityId: "operator-1",
      allocableFareMinor: "9999",
      platformShareMinor: "1499",
      operatorShareMinor: "4499",
      driverShareMinor: "4001",
      ruleVersion: "allocation-15-45-40-v1",
    });
    expect(harness.ledgerCommands[0]?.transactionType).toBe("ALLOCATION_15_45_40");
  });

  it("清算和付款必须通过对账门禁与双人复核", async () => {
    const harness = createHarness();
    await harness.service.createPrimaryMembership(membershipInput());
    await harness.service.allocateTrip(allocationInput());
    const settlement = await harness.service.createSettlementBatch({
      settlementBatchId: "settlement-1",
      reconciliationRunId: "reconciliation-1",
      operatorEntityId: "operator-1",
      businessDate: "2026-07-14",
      allocationIds: ["allocation-1"],
      preparedBy: "finance-maker",
    });
    expect(settlement.grossAmountMinor).toBe("8500");
    await expect(
      harness.service.completeSettlementBatch({
        settlementBatchId: "settlement-1",
        reviewedBy: "finance-maker",
        providerBatchId: "provider-batch-1",
      }),
    ).rejects.toThrow("FINANCE_REVIEWER_MUST_DIFFER");

    const payout = await harness.service.createPayoutBatch({
      payoutBatchId: "payout-1",
      reconciliationRunId: "reconciliation-1",
      operatorEntityId: "operator-1",
      driverAccountId: "driver-1",
      businessDate: "2026-07-15",
      allocationIds: ["allocation-1"],
      preparedBy: "finance-maker",
    });
    expect(payout.grossPayableMinor).toBe("4001");
    await harness.service.approvePayoutBatch("payout-1", "finance-reviewer");
    await harness.service.requestPayout({
      payoutBatchId: "payout-1",
      sourceEventId: "payout-request-event-1",
      idempotencyKey: "payout-request-key-1",
      occurredAt: "2026-07-15T04:00:00.000Z",
    });
    await harness.service.completePayout({
      payoutBatchId: "payout-1",
      legalEntityId: "operator-legal-1",
      bankAccountRef: "operator-bank-1",
      payoutProviderId: "provider-1",
      payoutFeeMinor: "10",
      sourceEventId: "payout-complete-event-1",
      idempotencyKey: "payout-complete-key-1",
      occurredAt: "2026-07-15T06:00:00.000Z",
    });

    expect(harness.repository.payouts.get("payout-1")).toMatchObject({
      state: "succeeded",
      grossPayableMinor: "4001",
      payoutFeeMinor: "10",
    });
    expect(harness.ledgerCommands.map((command) => command.transactionType)).toEqual([
      "ALLOCATION_15_45_40",
      "DRIVER_PAYOUT_REQUESTED",
      "DRIVER_PAYOUT_COMPLETED",
    ]);
  });

  it("提前结算保持关闭且资金案件不形成余额事实源", async () => {
    const harness = createHarness();
    await expect(harness.service.requestEarlySettlement()).rejects.toThrow(
      "DRIVER_EARLY_SETTLEMENT_DISABLED",
    );
    await harness.service.createFundCase({
      fundCaseId: "fund-case-1",
      operatorEntityId: "operator-1",
      caseType: "payout_unknown",
      referenceType: "driver_payout",
      referenceId: "payout-1",
      amountMinor: "4001",
      reasonCode: "synthetic_unknown",
      evidenceReference: "case://operator-1/payout-1",
    });
    expect(harness.repository.fundCases.get("fund-case-1")).toMatchObject({
      state: "open",
      amountMinor: "4001",
    });
    expect(
      Object.keys(harness.repository.fundCases.get("fund-case-1")!).some((key) =>
        key.toLowerCase().includes("balance"),
      ),
    ).toBe(false);
  });

  it("车主付款批次只能使用上一账务日分配", async () => {
    const harness = createHarness();
    await harness.service.createPrimaryMembership(membershipInput());
    await harness.service.allocateTrip(allocationInput());
    await expect(
      harness.service.createPayoutBatch({
        payoutBatchId: "payout-invalid-date",
        reconciliationRunId: "reconciliation-1",
        operatorEntityId: "operator-1",
        driverAccountId: "driver-1",
        businessDate: "2026-07-14",
        allocationIds: ["allocation-1"],
        preparedBy: "finance-maker",
      }),
    ).rejects.toThrow("PAYOUT_BATCH_NOT_T_PLUS_ONE");
  });
});

function createHarness() {
  const repository = new MemoryOperatorFundsRepository();
  const ledgerCommands: LedgerPostingCommand[] = [];
  const ledgerRepository: LedgerRepository = {
    post: async (command) => {
      ledgerCommands.push(command);
      return {
        ledgerTransactionId: `10000000-0000-4000-8000-${String(ledgerCommands.length).padStart(12, "0")}`,
        transactionSequence: String(ledgerCommands.length),
        replayed: false,
      };
    },
    getTransaction: async () => undefined,
    listEntries: async () => [],
    getBalance: async () => undefined,
  };
  const transaction: Transaction = {
    run: async <TResult>(operation: () => Promise<TResult>) => operation(),
  };
  const reconciliation = {
    assertActionAllowed: async () => undefined,
  } as unknown as FinancialReconciliationService;
  const templates = new SyntheticLedgerTemplateService(ledgerRepository, transaction);
  return {
    repository,
    ledgerCommands,
    service: new SyntheticOperatorFundsService(
      repository,
      templates,
      reconciliation,
      transaction,
    ),
  };
}

function membershipInput() {
  return {
    membershipId: "membership-1",
    driverAccountId: "driver-1",
    operatorEntityId: "operator-1",
    cityCode: "shanghai",
    vehicleId: "vehicle-1",
    effectiveFrom: "2026-07-14T00:00:00.000Z",
  };
}

function allocationInput() {
  return {
    allocationId: "allocation-1",
    reconciliationRunId: "reconciliation-1",
    paymentOrderId: "payment-1",
    tripId: "trip-1",
    passengerAccountId: "passenger-1",
    driverAccountId: "driver-1",
    cityCode: "shanghai",
    vehicleId: "vehicle-1",
    businessDate: "2026-07-14",
    accountingPeriod: "2026-07",
    productCode: "ride",
    allocableFareMinor: "9999",
    sourceEventId: "allocation-event-1",
    idempotencyKey: "allocation-key-1",
    occurredAt: "2026-07-14T10:00:00.000Z",
  };
}

class MemoryOperatorFundsRepository implements OperatorFundsRepository {
  public readonly memberships: DriverOperatorMembership[] = [];
  public readonly allocations = new Map<string, FinancialAllocation>();
  public readonly settlements = new Map<string, OperatorSettlementBatch>();
  public readonly payouts = new Map<string, DriverPayoutBatch>();
  public readonly fundCases = new Map<string, OperatorFundCase>();

  public async createMembership(
    input: Omit<DriverOperatorMembership, "state" | "synthetic">,
  ): Promise<void> {
    if (
      this.memberships.some(
        (membership) =>
          membership.driverAccountId === input.driverAccountId &&
          membership.cityCode === input.cityCode &&
          membership.vehicleId === input.vehicleId &&
          membership.state === "active",
      )
    ) {
      throw new Error("PRIMARY_OPERATOR_MEMBERSHIP_CONFLICT");
    }
    this.memberships.push({ ...input, state: "active", synthetic: true });
  }

  public async findActiveMembership(input: Readonly<{
    driverAccountId: string;
    cityCode: string;
    vehicleId: string;
    effectiveAt: string;
  }>): Promise<DriverOperatorMembership | undefined> {
    return this.memberships.find(
      (membership) =>
        membership.driverAccountId === input.driverAccountId &&
        membership.cityCode === input.cityCode &&
        membership.vehicleId === input.vehicleId &&
        membership.state === "active" &&
        membership.effectiveFrom <= input.effectiveAt,
    );
  }

  public async saveAllocation(allocation: FinancialAllocation): Promise<void> {
    this.allocations.set(allocation.allocationId, allocation);
  }

  public async getAllocation(allocationId: string): Promise<FinancialAllocation | undefined> {
    return this.allocations.get(allocationId);
  }

  public async createSettlementBatch(batch: OperatorSettlementBatch): Promise<void> {
    this.settlements.set(batch.settlementBatchId, batch);
  }

  public async getSettlementBatch(
    settlementBatchId: string,
  ): Promise<OperatorSettlementBatch | undefined> {
    return this.settlements.get(settlementBatchId);
  }

  public async completeSettlementBatch(input: Readonly<{
    settlementBatchId: string;
    reviewedBy: string;
    providerBatchId: string;
  }>): Promise<void> {
    const batch = this.settlements.get(input.settlementBatchId)!;
    this.settlements.set(input.settlementBatchId, {
      ...batch,
      state: "succeeded",
      reviewedBy: input.reviewedBy,
      providerBatchId: input.providerBatchId,
    });
  }

  public async createPayoutBatch(batch: DriverPayoutBatch): Promise<void> {
    this.payouts.set(batch.payoutBatchId, batch);
  }

  public async getPayoutBatch(payoutBatchId: string): Promise<DriverPayoutBatch | undefined> {
    return this.payouts.get(payoutBatchId);
  }

  public async approvePayoutBatch(payoutBatchId: string, reviewedBy: string): Promise<void> {
    const batch = this.payouts.get(payoutBatchId)!;
    this.payouts.set(payoutBatchId, { ...batch, state: "approved", reviewedBy });
  }

  public async markPayoutRequested(
    payoutBatchId: string,
    ledgerTransactionId: string,
  ): Promise<void> {
    const batch = this.payouts.get(payoutBatchId)!;
    this.payouts.set(payoutBatchId, {
      ...batch,
      state: "processing",
      requestedLedgerTransactionId: ledgerTransactionId,
    });
  }

  public async markPayoutCompleted(input: Readonly<{
    payoutBatchId: string;
    ledgerTransactionId: string;
    payoutFeeMinor: string;
  }>): Promise<void> {
    const batch = this.payouts.get(input.payoutBatchId)!;
    this.payouts.set(input.payoutBatchId, {
      ...batch,
      state: "succeeded",
      payoutFeeMinor: input.payoutFeeMinor,
      completedLedgerTransactionId: input.ledgerTransactionId,
    });
  }

  public async createFundCase(fundCase: OperatorFundCase): Promise<void> {
    this.fundCases.set(fundCase.fundCaseId, fundCase);
  }
}
