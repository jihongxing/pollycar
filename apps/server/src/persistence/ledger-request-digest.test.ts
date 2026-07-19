import { describe, expect, it } from "vitest";
import type { LedgerPostingCommand } from "../ports/ledger.js";
import { createLedgerRequestDigest } from "./ledger-request-digest.js";

describe("账本请求摘要", () => {
  it("按 RFC 8785 固定字段和分录顺序生成稳定 SHA-256", () => {
    const command: LedgerPostingCommand = {
      transactionType: "PAYMENT_SUCCEEDED",
      businessReferenceType: "payment_order",
      businessReferenceId: "payment-fixed",
      sourceSystem: "payment_aggregate",
      sourceEventId: "event-fixed",
      idempotencyKey: "excluded-idempotency-key",
      ruleVersion: "payment-v1",
      occurredAt: "2026-07-14T08:00:00.000Z",
      initiatorType: "system",
      entries: [
        {
          entrySequence: 2,
          direction: "credit",
          amountMinor: "10000",
          currency: "CNY",
          account: {
            accountCode: "LIABILITY_PASSENGER_HELD",
            accountType: "liability",
            currency: "CNY",
            ownerType: "passenger",
            ownerId: "passenger-fixed",
            dimensions: {
              trip_id: "trip-fixed",
              payment_order_id: "payment-fixed",
            },
          },
        },
        {
          entrySequence: 1,
          direction: "debit",
          amountMinor: "10000",
          currency: "CNY",
          account: {
            accountCode: "ASSET_PROVIDER_RECEIVABLE",
            accountType: "asset",
            currency: "CNY",
            ownerType: "platform",
            ownerId: "platform-main",
            dimensions: {
              provider_id: "provider",
              merchant_account_id: "merchant",
            },
          },
        },
      ],
    };

    expect(createLedgerRequestDigest(command)).toBe(
      "5b7d636ecc11b062448aa011d2e7d2c1bd448d241f6ceecfed26236705604921",
    );
  });
});
