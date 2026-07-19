import type {
  LedgerAccountReference,
  LedgerPostResult,
  LedgerPostingCommand,
  LedgerRepository,
} from "../ports/ledger.js";
import type { Transaction } from "../ports/storage.js";

type SyntheticEventInput = Readonly<{
  sourceEventId: string;
  idempotencyKey: string;
  occurredAt: string;
}>;

type ProviderAccountInput = Readonly<{
  legalEntityId: string;
  providerId: string;
  merchantAccountId: string;
}>;

export type PaymentSucceededInput = SyntheticEventInput &
  ProviderAccountInput &
  Readonly<{
    paymentOrderId: string;
    tripId: string;
    passengerAccountId: string;
    amountMinor: string;
  }>;

export type ProviderSettledWithFeeInput = SyntheticEventInput &
  ProviderAccountInput &
  Readonly<{
    providerSettlementId: string;
    providerProduct: string;
    bankAccountRef: string;
    grossAmountMinor: string;
    netAmountMinor: string;
    feeAmountMinor: string;
  }>;

export type RefundLiabilityCreatedInput = SyntheticEventInput &
  Readonly<{
    refundOrderId: string;
    paymentOrderId: string;
    tripId: string;
    passengerAccountId: string;
    amountMinor: string;
  }>;

export type RefundCompletedInput = SyntheticEventInput &
  ProviderAccountInput &
  Readonly<{
    refundOrderId: string;
    passengerAccountId: string;
    originalPaymentSettlementState: "unsettled" | "settled";
    amountMinor: string;
  }>;

export type FullReversalInput = SyntheticEventInput &
  Readonly<{
    originalLedgerTransactionId: string;
    reasonCode: string;
    reviewReference: string;
  }>;

export type Allocation154540Input = SyntheticEventInput &
  Readonly<{
    reconciliationRunId: string;
    allocationId: string;
    paymentOrderId: string;
    tripId: string;
    passengerAccountId: string;
    operatorEntityId: string;
    driverAccountId: string;
    productCode: string;
    cityCode: string;
    accountingPeriod: string;
    allocableFareMinor: string;
  }>;

export type DriverPayoutRequestedInput = SyntheticEventInput &
  Readonly<{
    reconciliationRunId: string;
    payoutOrderId: string;
    operatorEntityId: string;
    driverAccountId: string;
    items: readonly Readonly<{ tripId: string; amountMinor: string }>[];
  }>;

export type DriverPayoutCompletedInput = SyntheticEventInput &
  Readonly<{
    reconciliationRunId: string;
    payoutOrderId: string;
    operatorEntityId: string;
    legalEntityId: string;
    bankAccountRef: string;
    payoutProviderId: string;
    amountMinor: string;
    feeAmountMinor: string;
  }>;

const maximumAmountMinor = 9_223_372_036_854_775_807n;

export class SyntheticLedgerTemplateService {
  public constructor(
    private readonly repository: LedgerRepository,
    private readonly transaction: Transaction,
  ) {}

  public async postPaymentSucceeded(input: PaymentSucceededInput): Promise<LedgerPostResult> {
    validateFields(input);
    validateAmount(input.amountMinor);
    return await this.post({
      transactionType: "PAYMENT_SUCCEEDED",
      businessReferenceType: "payment_order",
      businessReferenceId: input.paymentOrderId,
      sourceSystem: "payment_aggregate",
      sourceEventId: input.sourceEventId,
      idempotencyKey: input.idempotencyKey,
      ruleVersion: "payment-succeeded-v1",
      occurredAt: input.occurredAt,
      initiatorType: "system",
      entries: [
        {
          entrySequence: 1,
          direction: "debit",
          amountMinor: input.amountMinor,
          currency: "CNY",
          account: providerReceivableAccount(input),
        },
        {
          entrySequence: 2,
          direction: "credit",
          amountMinor: input.amountMinor,
          currency: "CNY",
          account: passengerHeldAccount(input),
        },
      ],
    });
  }

  public async postProviderSettledWithFee(
    input: ProviderSettledWithFeeInput,
  ): Promise<LedgerPostResult> {
    validateFields(input);
    const grossAmount = validateAmount(input.grossAmountMinor);
    const netAmount = validateAmount(input.netAmountMinor);
    const feeAmount = validateAmount(input.feeAmountMinor);
    if (netAmount + feeAmount !== grossAmount) {
      throw new Error("SYNTHETIC_LEDGER_SETTLEMENT_TOTAL_MISMATCH");
    }
    return await this.post({
      transactionType: "PROVIDER_SETTLED_WITH_FEE",
      businessReferenceType: "provider_settlement",
      businessReferenceId: input.providerSettlementId,
      sourceSystem: "provider_settlement",
      sourceEventId: input.sourceEventId,
      idempotencyKey: input.idempotencyKey,
      ruleVersion: "provider-settled-with-fee-v1",
      occurredAt: input.occurredAt,
      initiatorType: "system",
      entries: [
        {
          entrySequence: 1,
          direction: "debit",
          amountMinor: input.netAmountMinor,
          currency: "CNY",
          account: {
            accountCode: "ASSET_BANK_CASH",
            accountType: "asset",
            currency: "CNY",
            ownerType: "legal_entity",
            ownerId: input.legalEntityId,
            dimensions: {
              legal_entity_id: input.legalEntityId,
              bank_account_ref: input.bankAccountRef,
            },
          },
        },
        {
          entrySequence: 2,
          direction: "debit",
          amountMinor: input.feeAmountMinor,
          currency: "CNY",
          account: {
            accountCode: "EXPENSE_PROVIDER_FEE",
            accountType: "expense",
            currency: "CNY",
            ownerType: "legal_entity",
            ownerId: input.legalEntityId,
            dimensions: {
              provider_id: input.providerId,
              provider_product: input.providerProduct,
            },
          },
        },
        {
          entrySequence: 3,
          direction: "credit",
          amountMinor: input.grossAmountMinor,
          currency: "CNY",
          account: providerReceivableAccount(input),
        },
      ],
    });
  }

  public async postRefundLiabilityCreated(
    input: RefundLiabilityCreatedInput,
  ): Promise<LedgerPostResult> {
    validateFields(input);
    validateAmount(input.amountMinor);
    return await this.post({
      transactionType: "REFUND_LIABILITY_CREATED",
      businessReferenceType: "refund_order",
      businessReferenceId: input.refundOrderId,
      sourceSystem: "refund_aggregate",
      sourceEventId: input.sourceEventId,
      idempotencyKey: input.idempotencyKey,
      ruleVersion: "refund-liability-created-v1",
      occurredAt: input.occurredAt,
      initiatorType: "system",
      entries: [
        {
          entrySequence: 1,
          direction: "debit",
          amountMinor: input.amountMinor,
          currency: "CNY",
          account: passengerHeldAccount(input),
        },
        {
          entrySequence: 2,
          direction: "credit",
          amountMinor: input.amountMinor,
          currency: "CNY",
          account: refundPayableAccount(input),
        },
      ],
    });
  }

  public async postRefundCompleted(input: RefundCompletedInput): Promise<LedgerPostResult> {
    validateFields(input);
    validateAmount(input.amountMinor);
    if (!["unsettled", "settled"].includes(input.originalPaymentSettlementState)) {
      throw new Error("SYNTHETIC_LEDGER_REFUND_SETTLEMENT_STATE_INVALID");
    }
    return await this.post({
      transactionType: "REFUND_COMPLETED",
      businessReferenceType: "refund_order",
      businessReferenceId: input.refundOrderId,
      sourceSystem: "refund_aggregate",
      sourceEventId: input.sourceEventId,
      idempotencyKey: input.idempotencyKey,
      ruleVersion: "refund-completed-v1",
      occurredAt: input.occurredAt,
      initiatorType: "system",
      entries: [
        {
          entrySequence: 1,
          direction: "debit",
          amountMinor: input.amountMinor,
          currency: "CNY",
          account: refundPayableAccount(input),
        },
        {
          entrySequence: 2,
          direction: "credit",
          amountMinor: input.amountMinor,
          currency: "CNY",
          account:
            input.originalPaymentSettlementState === "settled"
              ? refundClearingAccount(input)
              : providerReceivableAccount(input),
        },
      ],
    });
  }

  public async postFullReversal(input: FullReversalInput): Promise<LedgerPostResult> {
    validateFields(input);
    return await this.post({
      transactionType: "FULL_REVERSAL",
      businessReferenceType: "ledger_transaction",
      businessReferenceId: input.originalLedgerTransactionId,
      sourceSystem: "manual_finance",
      sourceEventId: input.sourceEventId,
      idempotencyKey: input.idempotencyKey,
      ruleVersion: "full-reversal-v1",
      occurredAt: input.occurredAt,
      initiatorType: "finance_manual",
      reversalOfTransactionId: input.originalLedgerTransactionId,
      reasonCode: input.reasonCode,
      reviewReference: input.reviewReference,
      entries: [],
    });
  }

  public async postAllocation154540(
    input: Allocation154540Input,
  ): Promise<LedgerPostResult> {
    validateFields(input);
    const allocableFare = validateAmount(input.allocableFareMinor);
    const platformShare = (allocableFare * 1_500n) / 10_000n;
    const operatorShare = (allocableFare * 4_500n) / 10_000n;
    const driverShare = allocableFare - platformShare - operatorShare;
    return await this.post({
      transactionType: "ALLOCATION_15_45_40",
      businessReferenceType: "financial_allocation",
      businessReferenceId: input.allocationId,
      sourceSystem: "trip_fulfillment",
      sourceEventId: input.sourceEventId,
      idempotencyKey: input.idempotencyKey,
      ruleVersion: "allocation-15-45-40-v1",
      occurredAt: input.occurredAt,
      initiatorType: "system",
      reconciliationRunId: input.reconciliationRunId,
      entries: [
        {
          entrySequence: 1,
          direction: "debit",
          amountMinor: input.allocableFareMinor,
          currency: "CNY",
          account: passengerHeldAccount(input),
        },
        {
          entrySequence: 2,
          direction: "credit",
          amountMinor: platformShare.toString(),
          currency: "CNY",
          account: {
            accountCode: "REVENUE_PLATFORM_SERVICE",
            accountType: "revenue",
            currency: "CNY",
            ownerType: "platform",
            ownerId: "pollycar-platform",
            dimensions: {
              product_code: input.productCode,
              city_code: input.cityCode,
              accounting_period: input.accountingPeriod,
            },
          },
        },
        {
          entrySequence: 3,
          direction: "credit",
          amountMinor: operatorShare.toString(),
          currency: "CNY",
          account: operatorEntitlementAccount(input),
        },
        {
          entrySequence: 4,
          direction: "credit",
          amountMinor: driverShare.toString(),
          currency: "CNY",
          account: driverPayableAccount(input),
        },
      ],
    });
  }

  public async postDriverPayoutRequested(
    input: DriverPayoutRequestedInput,
  ): Promise<LedgerPostResult> {
    validateFields(input);
    if (input.items.length === 0) {
      throw new Error("SYNTHETIC_LEDGER_PAYOUT_ITEMS_REQUIRED");
    }
    const total = input.items.reduce(
      (sum, item) => sum + validateAmount(item.amountMinor),
      0n,
    );
    return await this.post({
      transactionType: "DRIVER_PAYOUT_REQUESTED",
      businessReferenceType: "driver_payout",
      businessReferenceId: input.payoutOrderId,
      sourceSystem: "payout_aggregate",
      sourceEventId: input.sourceEventId,
      idempotencyKey: input.idempotencyKey,
      ruleVersion: "driver-payout-requested-v1",
      occurredAt: input.occurredAt,
      initiatorType: "system",
      reconciliationRunId: input.reconciliationRunId,
      entries: [
        ...input.items.map((item, index) => ({
          entrySequence: index + 1,
          direction: "debit" as const,
          amountMinor: item.amountMinor,
          currency: "CNY" as const,
          account: driverPayableAccount({
            driverAccountId: input.driverAccountId,
            tripId: item.tripId,
          }),
        })),
        {
          entrySequence: input.items.length + 1,
          direction: "credit",
          amountMinor: total.toString(),
          currency: "CNY",
          account: payoutClearingAccount(input),
        },
      ],
    });
  }

  public async postDriverPayoutCompleted(
    input: DriverPayoutCompletedInput,
  ): Promise<LedgerPostResult> {
    validateFields(input);
    const amount = validateAmount(input.amountMinor);
    const fee = validateNonNegativeAmount(input.feeAmountMinor);
    return await this.post({
      transactionType: "DRIVER_PAYOUT_COMPLETED",
      businessReferenceType: "driver_payout",
      businessReferenceId: input.payoutOrderId,
      sourceSystem: "payout_aggregate",
      sourceEventId: input.sourceEventId,
      idempotencyKey: input.idempotencyKey,
      ruleVersion: "driver-payout-completed-v1",
      occurredAt: input.occurredAt,
      initiatorType: "system",
      reconciliationRunId: input.reconciliationRunId,
      entries: [
        {
          entrySequence: 1,
          direction: "debit",
          amountMinor: input.amountMinor,
          currency: "CNY",
          account: payoutClearingAccount(input),
        },
        ...(fee > 0n
          ? [{
              entrySequence: 2,
              direction: "debit" as const,
              amountMinor: input.feeAmountMinor,
              currency: "CNY" as const,
              account: {
                accountCode: "EXPENSE_OPERATOR_PAYOUT_FEE",
                accountType: "expense" as const,
                currency: "CNY" as const,
                ownerType: "operator",
                ownerId: input.operatorEntityId,
                dimensions: {
                  operator_id: input.operatorEntityId,
                  payout_provider_id: input.payoutProviderId,
                },
              },
            }]
          : []),
        {
          entrySequence: fee > 0n ? 3 : 2,
          direction: "credit",
          amountMinor: (amount + fee).toString(),
          currency: "CNY",
          account: {
            accountCode: "ASSET_BANK_CASH",
            accountType: "asset",
            currency: "CNY",
            ownerType: "operator",
            ownerId: input.operatorEntityId,
            dimensions: {
              legal_entity_id: input.legalEntityId,
              bank_account_ref: input.bankAccountRef,
            },
          },
        },
      ],
    });
  }

  private post(command: LedgerPostingCommand): Promise<LedgerPostResult> {
    return this.transaction.run(() => this.repository.post(command));
  }
}

function providerReceivableAccount(input: ProviderAccountInput): LedgerAccountReference {
  return {
    accountCode: "ASSET_PROVIDER_RECEIVABLE",
    accountType: "asset",
    currency: "CNY",
    ownerType: "legal_entity",
    ownerId: input.legalEntityId,
    dimensions: {
      provider_id: input.providerId,
      merchant_account_id: input.merchantAccountId,
    },
  };
}

function refundClearingAccount(input: ProviderAccountInput): LedgerAccountReference {
  return {
    accountCode: "ASSET_REFUND_CLEARING",
    accountType: "asset",
    currency: "CNY",
    ownerType: "legal_entity",
    ownerId: input.legalEntityId,
    dimensions: {
      provider_id: input.providerId,
      merchant_account_id: input.merchantAccountId,
    },
  };
}

function passengerHeldAccount(
  input: Readonly<{
    paymentOrderId: string;
    tripId: string;
    passengerAccountId: string;
  }>,
): LedgerAccountReference {
  return {
    accountCode: "LIABILITY_PASSENGER_HELD",
    accountType: "liability",
    currency: "CNY",
    ownerType: "passenger",
    ownerId: input.passengerAccountId,
    dimensions: {
      payment_order_id: input.paymentOrderId,
      trip_id: input.tripId,
    },
  };
}

function refundPayableAccount(
  input: Readonly<{
    refundOrderId: string;
    passengerAccountId: string;
  }>,
): LedgerAccountReference {
  return {
    accountCode: "LIABILITY_REFUND_PAYABLE",
    accountType: "liability",
    currency: "CNY",
    ownerType: "passenger",
    ownerId: input.passengerAccountId,
    dimensions: {
      refund_order_id: input.refundOrderId,
      passenger_account_id: input.passengerAccountId,
    },
  };
}

function operatorEntitlementAccount(
  input: Readonly<{ operatorEntityId: string; tripId: string }>,
): LedgerAccountReference {
  return {
    accountCode: "LIABILITY_OPERATOR_ENTITLEMENT",
    accountType: "liability",
    currency: "CNY",
    ownerType: "operator",
    ownerId: input.operatorEntityId,
    dimensions: {
      operator_id: input.operatorEntityId,
      trip_id: input.tripId,
    },
  };
}

function driverPayableAccount(
  input: Readonly<{ driverAccountId: string; tripId: string }>,
): LedgerAccountReference {
  return {
    accountCode: "LIABILITY_DRIVER_PAYABLE",
    accountType: "liability",
    currency: "CNY",
    ownerType: "driver",
    ownerId: input.driverAccountId,
    dimensions: {
      driver_account_id: input.driverAccountId,
      trip_id: input.tripId,
    },
  };
}

function payoutClearingAccount(
  input: Readonly<{ operatorEntityId: string; payoutOrderId: string }>,
): LedgerAccountReference {
  return {
    accountCode: "LIABILITY_PAYOUT_CLEARING",
    accountType: "liability",
    currency: "CNY",
    ownerType: "operator",
    ownerId: input.operatorEntityId,
    dimensions: {
      operator_id: input.operatorEntityId,
      payout_order_id: input.payoutOrderId,
    },
  };
}

function validateFields(input: Readonly<Record<string, unknown>>): void {
  for (const [field, value] of Object.entries(input)) {
    if (typeof value === "string" && value.trim() === "") {
      throw new Error(`SYNTHETIC_LEDGER_FIELD_REQUIRED:${field}`);
    }
  }
}

function validateAmount(value: string): bigint {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error("SYNTHETIC_LEDGER_AMOUNT_INVALID");
  }
  const amount = BigInt(value);
  if (amount > maximumAmountMinor) {
    throw new Error("SYNTHETIC_LEDGER_AMOUNT_OVERFLOW");
  }
  return amount;
}

function validateNonNegativeAmount(value: string): bigint {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("SYNTHETIC_LEDGER_AMOUNT_INVALID");
  }
  const amount = BigInt(value);
  if (amount > maximumAmountMinor) {
    throw new Error("SYNTHETIC_LEDGER_AMOUNT_OVERFLOW");
  }
  return amount;
}
