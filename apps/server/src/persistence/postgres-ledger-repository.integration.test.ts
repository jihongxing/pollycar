import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import type { LedgerPostingCommand } from "../ports/ledger.js";
import { runMigrations } from "./migrations.js";
import { PostgresLedgerRepository } from "./postgres-ledger-repository.js";
import { PostgresTransaction } from "./postgres-transaction.js";

const databaseUrl = process.env.POLLYCAR_LEDGER_KERNEL_DATABASE_URL;
const describePostgres = databaseUrl ? describe.sequential : describe.skip;
const migrationsDirectory = fileURLToPath(new URL("../../migrations", import.meta.url));

describePostgres("阶段四账本持久化内核", () => {
  const pool = new Pool({
    connectionString: databaseUrl,
    application_name: "pollycar-ledger-stage4-kernel",
    max: 4,
  });
  const transaction = new PostgresTransaction(pool);
  const repository = new PostgresLedgerRepository(transaction);

  beforeAll(async () => {
    const applied = await runMigrations(pool, migrationsDirectory);
    expect(applied).toContain("0007_financial_ledger");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("事务外拒绝过账，事务内原子写入交易、分录、投影和 Outbox", async () => {
    const command = paymentCommand();

    await expect(repository.post(command)).rejects.toThrow("LEDGER_TRANSACTION_REQUIRED");

    const posted = await transaction.run(async () => {
      await transaction.currentClient().query("SET LOCAL ROLE pollycar_ledger_runtime");
      return repository.post(command);
    });

    expect(posted.replayed).toBe(false);
    const record = await repository.getTransaction(posted.ledgerTransactionId);
    expect(record).toMatchObject({
      ledgerTransactionId: posted.ledgerTransactionId,
      transactionSequence: posted.transactionSequence,
      sourceEventId: command.sourceEventId,
      idempotencyKey: command.idempotencyKey,
    });

    const entries = await repository.listEntries(posted.ledgerTransactionId);
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => [entry.entrySequence, entry.direction, entry.amountMinor])).toEqual([
      [1, "debit", "10000"],
      [2, "credit", "10000"],
    ]);
    for (const entry of entries) {
      const balance = await repository.getBalance(entry.ledgerAccountId);
      expect(balance?.lastTransactionSequence).toBe(posted.transactionSequence);
      expect(balance?.balanceMinor).toBe(entry.direction === "debit" ? "10000" : "-10000");
    }

    const outbox = await pool.query<{
      aggregate_id: string;
      event_type: string;
      source_event_id: string;
    }>(
      `SELECT aggregate_id, event_type, payload->>'source_event_id' AS source_event_id
         FROM public.pollycar_outbox
        WHERE aggregate_id = $1`,
      [posted.ledgerTransactionId],
    );
    expect(outbox.rows).toEqual([
      {
        aggregate_id: posted.ledgerTransactionId,
        event_type: "finance.ledger.transaction_posted",
        source_event_id: command.sourceEventId,
      },
    ]);
  });

  it("业务事务回滚时交易、分录、投影和 Outbox 均不保留", async () => {
    const command = paymentCommand();
    let postedTransactionId: string | undefined;

    await expect(
      transaction.run(async () => {
        await transaction.currentClient().query("SET LOCAL ROLE pollycar_ledger_runtime");
        const posted = await repository.post(command);
        postedTransactionId = posted.ledgerTransactionId;
        throw new Error("FORCED_LEDGER_ROLLBACK");
      }),
    ).rejects.toThrow("FORCED_LEDGER_ROLLBACK");

    expect(postedTransactionId).toBeDefined();
    const persisted = await pool.query<{
      transactions: string;
      entries: string;
      projections: string;
      outbox_events: string;
    }>(
      `SELECT
         (SELECT count(*)::text
            FROM pollycar_finance.ledger_transactions
           WHERE source_system = $1 AND source_event_id = $2) AS transactions,
         (SELECT count(*)::text
            FROM pollycar_finance.ledger_entries AS entry
            JOIN pollycar_finance.ledger_transactions AS transaction
              ON transaction.ledger_transaction_id = entry.ledger_transaction_id
           WHERE transaction.source_system = $1
             AND transaction.source_event_id = $2) AS entries,
         (SELECT count(*)::text
            FROM pollycar_finance.ledger_balance_projections AS projection
            JOIN pollycar_finance.ledger_accounts AS account
              ON account.ledger_account_id = projection.ledger_account_id
           WHERE account.owner_id = $3) AS projections,
         (SELECT count(*)::text
            FROM public.pollycar_outbox
           WHERE aggregate_id = $4) AS outbox_events`,
      [
        command.sourceSystem,
        command.sourceEventId,
        command.entries[1]!.account.ownerId,
        postedTransactionId,
      ],
    );
    expect(persisted.rows[0]).toEqual({
      transactions: "0",
      entries: "0",
      projections: "0",
      outbox_events: "0",
    });
  });
});

function paymentCommand(): LedgerPostingCommand {
  const suffix = randomUUID();
  return {
    transactionType: "PAYMENT_SUCCEEDED",
    businessReferenceType: "payment_order",
    businessReferenceId: `payment-${suffix}`,
    sourceSystem: "payment_aggregate",
    sourceEventId: `event-${suffix}`,
    idempotencyKey: `idempotency-${suffix}`,
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
          ownerId: `platform-${suffix}`,
          dimensions: {
            provider_id: "synthetic-provider",
            merchant_account_id: `merchant-${suffix}`,
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
          ownerId: `passenger-${suffix}`,
          dimensions: {
            payment_order_id: `payment-${suffix}`,
            trip_id: `trip-${suffix}`,
          },
        },
      },
    ],
  };
}
