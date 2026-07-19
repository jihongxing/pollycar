import { describe, expect, it } from "vitest";
import type { LedgerPostingCommand } from "../ports/ledger.js";
import { PostgresLedgerRepository } from "./postgres-ledger-repository.js";
import { PostgresTransaction } from "./postgres-transaction.js";
import type {
  SqlConnection,
  SqlResult,
  TransactionalSqlClient,
} from "./sql-client.js";

describe("PostgreSQL 账本 Repository", () => {
  it("事务外禁止过账，事务内仅调用统一过账函数", async () => {
    const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
    const transaction = new PostgresTransaction(
      createPool(async (text, values) => {
        calls.push({ text, ...(values ? { values } : {}) });
        if (text.includes("post_runtime_ledger_transaction")) {
          return {
            rows: [
              {
                ledger_transaction_id: "10000000-0000-4000-8000-000000000001",
                transaction_sequence: "7",
                replayed: false,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    );
    const repository = new PostgresLedgerRepository(transaction);

    await expect(repository.post(paymentCommand())).rejects.toThrow(
      "LEDGER_TRANSACTION_REQUIRED",
    );

    const result = await transaction.run(() => repository.post(paymentCommand()));
    expect(result).toEqual({
      ledgerTransactionId: "10000000-0000-4000-8000-000000000001",
      transactionSequence: "7",
      replayed: false,
    });

    const postingCall = calls.find((call) =>
      call.text.includes("post_runtime_ledger_transaction"),
    );
    expect(postingCall?.text).toContain(
      "pollycar_finance.post_runtime_ledger_transaction($1::jsonb)",
    );
    expect(postingCall?.text).not.toContain(
      "pollycar_finance.post_ledger_transaction($1::jsonb)",
    );
    const request = JSON.parse(postingCall?.values?.[0] as string) as Record<string, unknown>;
    expect(request).toMatchObject({
      transaction_type: "PAYMENT_SUCCEEDED",
      source_system: "payment_aggregate",
      request_digest: "7750c1af199ca0aed7fed986447162a4e64fa2ee87321d85b5a833c0ea89816c",
    });
    expect(request.ledger_transaction_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

function paymentCommand(): LedgerPostingCommand {
  return {
    transactionType: "PAYMENT_SUCCEEDED",
    businessReferenceType: "payment_order",
    businessReferenceId: "payment-repository",
    sourceSystem: "payment_aggregate",
    sourceEventId: "event-repository",
    idempotencyKey: "idempotency-repository",
    ruleVersion: "payment-v1",
    occurredAt: "2026-07-14T08:00:00.000Z",
    initiatorType: "system",
    entries: [
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
            merchant_account_id: "merchant-repository",
          },
        },
      },
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
          ownerId: "passenger-repository",
          dimensions: {
            payment_order_id: "payment-repository",
            trip_id: "trip-repository",
          },
        },
      },
    ],
  };
}

function createPool(
  query: (
    text: string,
    values?: readonly unknown[],
  ) => Promise<SqlResult<Record<string, unknown>>>,
): TransactionalSqlClient {
  const connection: SqlConnection = {
    query: async <TRow extends Record<string, unknown>>(
      text: string,
      values?: readonly unknown[],
    ) => (await query(text, values)) as SqlResult<TRow>,
    release: () => undefined,
  };
  return {
    connect: async () => connection,
    query: async <TRow extends Record<string, unknown>>(
      text: string,
      values?: readonly unknown[],
    ) => (await query(text, values)) as SqlResult<TRow>,
  };
}
