import { describe, expect, it } from "vitest";
import type {
  LedgerPostingCommand,
  LedgerRepository,
} from "../ports/ledger.js";
import type { Transaction } from "../ports/storage.js";
import {
  SyntheticLedgerTemplateService,
  type PaymentSucceededInput,
  type ProviderSettledWithFeeInput,
  type RefundCompletedInput,
  type RefundLiabilityCreatedInput,
} from "./synthetic-ledger-template-service.js";

describe("基础合成账本交易模板", () => {
  it("支付成功固定借记支付机构应收并贷记乘车人待履约资金", async () => {
    const harness = createHarness();
    await harness.service.postPaymentSucceeded(paymentSucceededInput());

    expect(harness.commands).toEqual([
      expect.objectContaining({
        transactionType: "PAYMENT_SUCCEEDED",
        sourceSystem: "payment_aggregate",
        businessReferenceType: "payment_order",
        ruleVersion: "payment-succeeded-v1",
        initiatorType: "system",
        entries: [
          expect.objectContaining({
            entrySequence: 1,
            direction: "debit",
            amountMinor: "10000",
            account: expect.objectContaining({
              accountCode: "ASSET_PROVIDER_RECEIVABLE",
              accountType: "asset",
              ownerType: "legal_entity",
              ownerId: "legal-entity-1",
              dimensions: {
                provider_id: "provider-1",
                merchant_account_id: "merchant-1",
              },
            }),
          }),
          expect.objectContaining({
            entrySequence: 2,
            direction: "credit",
            amountMinor: "10000",
            account: expect.objectContaining({
              accountCode: "LIABILITY_PASSENGER_HELD",
              accountType: "liability",
              ownerType: "passenger",
              ownerId: "passenger-1",
              dimensions: {
                payment_order_id: "payment-1",
                trip_id: "trip-1",
              },
            }),
          }),
        ],
      }),
    ]);
  });

  it("支付机构清算固定借记银行资金和手续费并贷记支付机构应收", async () => {
    const harness = createHarness();
    await harness.service.postProviderSettledWithFee(providerSettledInput());

    expect(harness.commands[0]).toMatchObject({
      transactionType: "PROVIDER_SETTLED_WITH_FEE",
      sourceSystem: "provider_settlement",
      businessReferenceType: "provider_settlement",
      ruleVersion: "provider-settled-with-fee-v1",
      entries: [
        {
          entrySequence: 1,
          direction: "debit",
          amountMinor: "9800",
          currency: "CNY",
          account: {
            accountCode: "ASSET_BANK_CASH",
            accountType: "asset",
            currency: "CNY",
            ownerType: "legal_entity",
            ownerId: "legal-entity-1",
            dimensions: {
              legal_entity_id: "legal-entity-1",
              bank_account_ref: "synthetic-bank-1",
            },
          },
        },
        {
          entrySequence: 2,
          direction: "debit",
          amountMinor: "200",
          currency: "CNY",
          account: {
            accountCode: "EXPENSE_PROVIDER_FEE",
            accountType: "expense",
            currency: "CNY",
            ownerType: "legal_entity",
            ownerId: "legal-entity-1",
            dimensions: {
              provider_id: "provider-1",
              provider_product: "synthetic-acquiring",
            },
          },
        },
        {
          entrySequence: 3,
          direction: "credit",
          amountMinor: "10000",
          currency: "CNY",
          account: {
            accountCode: "ASSET_PROVIDER_RECEIVABLE",
            accountType: "asset",
            currency: "CNY",
            ownerType: "legal_entity",
            ownerId: "legal-entity-1",
            dimensions: {
              provider_id: "provider-1",
              merchant_account_id: "merchant-1",
            },
          },
        },
      ],
    });
  });

  it("退款责任形成固定从待履约资金转入退款应付款", async () => {
    const harness = createHarness();
    await harness.service.postRefundLiabilityCreated(refundLiabilityInput());

    expect(harness.commands[0]).toMatchObject({
      transactionType: "REFUND_LIABILITY_CREATED",
      sourceSystem: "refund_aggregate",
      businessReferenceType: "refund_order",
      ruleVersion: "refund-liability-created-v1",
      entries: [
        {
          entrySequence: 1,
          direction: "debit",
          amountMinor: "10000",
          account: expect.objectContaining({
            accountCode: "LIABILITY_PASSENGER_HELD",
          }),
        },
        {
          entrySequence: 2,
          direction: "credit",
          amountMinor: "10000",
          account: expect.objectContaining({
            accountCode: "LIABILITY_REFUND_PAYABLE",
          }),
        },
      ],
    });
  });

  it("退款完成按原支付清算状态选择支付机构应收或退款清算资产", async () => {
    const unsettled = createHarness();
    await unsettled.service.postRefundCompleted(refundCompletedInput("unsettled"));
    expect(unsettled.commands[0]?.entries[1]?.account.accountCode).toBe(
      "ASSET_PROVIDER_RECEIVABLE",
    );

    const settled = createHarness();
    await settled.service.postRefundCompleted(refundCompletedInput("settled"));
    expect(settled.commands[0]?.entries[1]?.account.accountCode).toBe(
      "ASSET_REFUND_CLEARING",
    );
  });

  it("完整冲正只提交原交易引用、原因和复核引用，不提交调用方分录", async () => {
    const harness = createHarness();
    await harness.service.postFullReversal({
      originalLedgerTransactionId: "10000000-0000-4000-8000-000000000001",
      sourceEventId: "manual-reversal-event-1",
      idempotencyKey: "manual-reversal-key-1",
      occurredAt: "2026-07-14T10:00:00.000Z",
      reasonCode: "synthetic_correction",
      reviewReference: "synthetic-review-1",
    });

    expect(harness.commands[0]).toEqual({
      transactionType: "FULL_REVERSAL",
      businessReferenceType: "ledger_transaction",
      businessReferenceId: "10000000-0000-4000-8000-000000000001",
      sourceSystem: "manual_finance",
      sourceEventId: "manual-reversal-event-1",
      idempotencyKey: "manual-reversal-key-1",
      ruleVersion: "full-reversal-v1",
      occurredAt: "2026-07-14T10:00:00.000Z",
      initiatorType: "finance_manual",
      reversalOfTransactionId: "10000000-0000-4000-8000-000000000001",
      reasonCode: "synthetic_correction",
      reviewReference: "synthetic-review-1",
      entries: [],
    });
  });

  it("金额和清算合计非法时在调用 Repository 前拒绝", async () => {
    const harness = createHarness();
    await expect(
      harness.service.postPaymentSucceeded({
        ...paymentSucceededInput(),
        amountMinor: "100.00",
      }),
    ).rejects.toThrow("SYNTHETIC_LEDGER_AMOUNT_INVALID");
    await expect(
      harness.service.postProviderSettledWithFee({
        ...providerSettledInput(),
        grossAmountMinor: "10001",
      }),
    ).rejects.toThrow("SYNTHETIC_LEDGER_SETTLEMENT_TOTAL_MISMATCH");
    expect(harness.commands).toEqual([]);
  });

  it("阶段八分配使用整数基点且尾差进入车主份额", async () => {
    const harness = createHarness();
    await harness.service.postAllocation154540({
      reconciliationRunId: "reconciliation-1",
      allocationId: "allocation-1",
      paymentOrderId: "payment-1",
      tripId: "trip-1",
      passengerAccountId: "passenger-1",
      operatorEntityId: "operator-1",
      driverAccountId: "driver-1",
      productCode: "ride",
      cityCode: "shanghai",
      accountingPeriod: "2026-07",
      allocableFareMinor: "9999",
      sourceEventId: "allocation-event-1",
      idempotencyKey: "allocation-key-1",
      occurredAt: "2026-07-14T10:00:00.000Z",
    });

    expect(harness.commands[0]).toMatchObject({
      transactionType: "ALLOCATION_15_45_40",
      ruleVersion: "allocation-15-45-40-v1",
      entries: [
        { direction: "debit", amountMinor: "9999" },
        { direction: "credit", amountMinor: "1499" },
        { direction: "credit", amountMinor: "4499" },
        { direction: "credit", amountMinor: "4001" },
      ],
    });
  });

  it("车主付款请求支持多行程聚合且付款手续费由运营主体承担", async () => {
    const harness = createHarness();
    await harness.service.postDriverPayoutRequested({
      reconciliationRunId: "reconciliation-1",
      payoutOrderId: "payout-1",
      operatorEntityId: "operator-1",
      driverAccountId: "driver-1",
      items: [
        { tripId: "trip-1", amountMinor: "4000" },
        { tripId: "trip-2", amountMinor: "4001" },
      ],
      sourceEventId: "payout-request-event-1",
      idempotencyKey: "payout-request-key-1",
      occurredAt: "2026-07-15T04:00:00.000Z",
    });
    await harness.service.postDriverPayoutCompleted({
      reconciliationRunId: "reconciliation-1",
      payoutOrderId: "payout-1",
      operatorEntityId: "operator-1",
      legalEntityId: "operator-legal-1",
      bankAccountRef: "operator-bank-1",
      payoutProviderId: "provider-1",
      amountMinor: "8001",
      feeAmountMinor: "10",
      sourceEventId: "payout-completed-event-1",
      idempotencyKey: "payout-completed-key-1",
      occurredAt: "2026-07-15T06:00:00.000Z",
    });

    expect(harness.commands[0]?.entries.map((entry) => entry.amountMinor)).toEqual([
      "4000",
      "4001",
      "8001",
    ]);
    expect(harness.commands[1]).toMatchObject({
      transactionType: "DRIVER_PAYOUT_COMPLETED",
      entries: [
        { direction: "debit", amountMinor: "8001" },
        {
          direction: "debit",
          amountMinor: "10",
          account: { accountCode: "EXPENSE_OPERATOR_PAYOUT_FEE" },
        },
        {
          direction: "credit",
          amountMinor: "8011",
          account: { accountCode: "ASSET_BANK_CASH" },
        },
      ],
    });
  });
});

function createHarness(): Readonly<{
  service: SyntheticLedgerTemplateService;
  commands: LedgerPostingCommand[];
}> {
  const commands: LedgerPostingCommand[] = [];
  const repository: LedgerRepository = {
    post: async (command) => {
      commands.push(command);
      return {
        ledgerTransactionId: "10000000-0000-4000-8000-000000000001",
        transactionSequence: String(commands.length),
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
  return {
    service: new SyntheticLedgerTemplateService(repository, transaction),
    commands,
  };
}

function paymentSucceededInput(): PaymentSucceededInput {
  return {
    paymentOrderId: "payment-1",
    tripId: "trip-1",
    passengerAccountId: "passenger-1",
    legalEntityId: "legal-entity-1",
    providerId: "provider-1",
    merchantAccountId: "merchant-1",
    amountMinor: "10000",
    sourceEventId: "payment-event-1",
    idempotencyKey: "payment-key-1",
    occurredAt: "2026-07-14T08:00:00.000Z",
  };
}

function providerSettledInput(): ProviderSettledWithFeeInput {
  return {
    providerSettlementId: "provider-settlement-1",
    legalEntityId: "legal-entity-1",
    providerId: "provider-1",
    providerProduct: "synthetic-acquiring",
    merchantAccountId: "merchant-1",
    bankAccountRef: "synthetic-bank-1",
    grossAmountMinor: "10000",
    netAmountMinor: "9800",
    feeAmountMinor: "200",
    sourceEventId: "settlement-event-1",
    idempotencyKey: "settlement-key-1",
    occurredAt: "2026-07-14T09:00:00.000Z",
  };
}

function refundLiabilityInput(): RefundLiabilityCreatedInput {
  return {
    refundOrderId: "refund-1",
    paymentOrderId: "payment-1",
    tripId: "trip-1",
    passengerAccountId: "passenger-1",
    amountMinor: "10000",
    sourceEventId: "refund-liability-event-1",
    idempotencyKey: "refund-liability-key-1",
    occurredAt: "2026-07-14T09:30:00.000Z",
  };
}

function refundCompletedInput(
  settlementState: RefundCompletedInput["originalPaymentSettlementState"],
): RefundCompletedInput {
  return {
    refundOrderId: `refund-${settlementState}`,
    passengerAccountId: "passenger-1",
    legalEntityId: "legal-entity-1",
    providerId: "provider-1",
    merchantAccountId: "merchant-1",
    originalPaymentSettlementState: settlementState,
    amountMinor: "10000",
    sourceEventId: `refund-completed-event-${settlementState}`,
    idempotencyKey: `refund-completed-key-${settlementState}`,
    occurredAt: "2026-07-14T09:45:00.000Z",
  };
}
