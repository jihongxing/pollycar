import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { loadPostgresIntegrationTestConfig } from "@pollycar/configuration";
import type { LedgerPostingCommand } from "../ports/ledger.js";
import { runMigrations } from "./migrations.js";
import { PostgresLedgerRepository } from "./postgres-ledger-repository.js";
import { PostgresTransaction } from "./postgres-transaction.js";

const postgresTestConfig = loadPostgresIntegrationTestConfig();
const databaseUrl = postgresTestConfig.ledgerResilienceDatabaseUrl;
const phase = postgresTestConfig.ledgerResiliencePhase;
const describeBeforeRestart =
  databaseUrl && phase === "before_restart" ? describe.sequential : describe.skip;
const describeAfterRestart =
  databaseUrl && phase === "after_restart" ? describe.sequential : describe.skip;
const migrationsDirectory = fileURLToPath(new URL("../../migrations", import.meta.url));

describeBeforeRestart("阶段五账本并发、重建与回滚验证", () => {
  const pool = createPool("pollycar-ledger-stage5-before-restart");

  beforeAll(async () => {
    const applied = await runMigrations(pool, migrationsDirectory);
    expect(applied).toContain("0007_financial_ledger");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("相同请求并发调用返回同一结果且只产生一笔交易", async () => {
    const command = paymentCommand();
    const first = createRuntime(pool);
    const second = createRuntime(pool);

    const results = await Promise.all([
      postAsRuntime(first, command),
      postAsRuntime(second, command),
    ]);

    expect(new Set(results.map((result) => result.ledgerTransactionId)).size).toBe(1);
    expect(new Set(results.map((result) => result.transactionSequence)).size).toBe(1);
    expect(results.map((result) => result.replayed).sort()).toEqual([false, true]);
    await expectPersistedCounts(pool, command, {
      transactions: "1",
      entries: "2",
      outboxEvents: "1",
    });
  });

  it("来源事件和幂等键在并发冲突时均保持数据库唯一", async () => {
    const sourceCommand = paymentCommand();
    const competingSourceCommand = {
      ...paymentCommand(),
      sourceSystem: sourceCommand.sourceSystem,
      sourceEventId: sourceCommand.sourceEventId,
    } satisfies LedgerPostingCommand;
    const sourceResults = await Promise.allSettled([
      postAsRuntime(createRuntime(pool), sourceCommand),
      postAsRuntime(createRuntime(pool), competingSourceCommand),
    ]);
    expect(sourceResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(rejectionMessage(sourceResults)).toContain("LEDGER_SOURCE_EVENT_CONFLICT");
    await expectPersistedCounts(pool, sourceCommand, {
      transactions: "1",
      entries: "2",
      outboxEvents: "1",
    });

    const idempotentCommand = paymentCommand();
    const competingIdempotentCommand = {
      ...paymentCommand(),
      idempotencyKey: idempotentCommand.idempotencyKey,
    } satisfies LedgerPostingCommand;
    const idempotencyResults = await Promise.allSettled([
      postAsRuntime(createRuntime(pool), idempotentCommand),
      postAsRuntime(createRuntime(pool), competingIdempotentCommand),
    ]);
    expect(idempotencyResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(rejectionMessage(idempotencyResults)).toContain("LEDGER_IDEMPOTENCY_CONFLICT");

    const persisted = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM pollycar_finance.ledger_transactions
        WHERE idempotency_key = $1
          AND transaction_type = $2`,
      [idempotentCommand.idempotencyKey, idempotentCommand.transactionType],
    );
    expect(persisted.rows[0]?.count).toBe("1");
  });

  it("余额投影删除后可从全部分录重建为相同结果", async () => {
    await postAsRuntime(createRuntime(pool), paymentCommand());
    await postAsRuntime(createRuntime(pool), paymentCommand());
    const before = await projectionSnapshot(pool);
    const immutableCountsBefore = await immutableLedgerCounts(pool);

    await pool.query("DELETE FROM pollycar_finance.ledger_balance_projections");
    const deleted = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM pollycar_finance.ledger_balance_projections",
    );
    expect(deleted.rows[0]?.count).toBe("0");

    const maintenance = new PostgresTransaction(pool);
    await maintenance.run(async () => {
      await maintenance.currentClient().query("SET LOCAL ROLE pollycar_ledger_maintenance");
      await maintenance
        .currentClient()
        .query("SELECT pollycar_finance.rebuild_ledger_balance_projections()");
    });

    expect(await projectionSnapshot(pool)).toEqual(before);
    expect(await immutableLedgerCounts(pool)).toEqual(immutableCountsBefore);
  });

  it("数据库事务回滚不保留任何账本效果", async () => {
    const command = paymentCommand();
    const runtime = createRuntime(pool);
    let transactionId: string | undefined;

    await expect(
      runtime.transaction.run(async () => {
        await runtime.transaction
          .currentClient()
          .query("SET LOCAL ROLE pollycar_ledger_runtime");
        transactionId = (await runtime.repository.post(command)).ledgerTransactionId;
        throw new Error("FORCED_STAGE5_ROLLBACK");
      }),
    ).rejects.toThrow("FORCED_STAGE5_ROLLBACK");

    expect(transactionId).toBeDefined();
    await expectPersistedCounts(pool, command, {
      transactions: "0",
      entries: "0",
      outboxEvents: "0",
    });
  });

  it("写入数据库重启恢复基准交易", async () => {
    const result = await postAsRuntime(createRuntime(pool), restartRecoveryCommand());
    expect(result.replayed).toBe(false);
    await expectPersistedCounts(pool, restartRecoveryCommand(), {
      transactions: "1",
      entries: "2",
      outboxEvents: "1",
    });
  });
});

describeAfterRestart("阶段五账本数据库重启恢复验证", () => {
  const pool = createPool("pollycar-ledger-stage5-after-restart");

  beforeAll(async () => {
    expect(await runMigrations(pool, migrationsDirectory)).toEqual([]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("重启后交易、分录、投影和 Outbox 保持一致且重复调用返回原结果", async () => {
    const command = restartRecoveryCommand();
    const existing = await pool.query<{
      ledger_transaction_id: string;
      transaction_sequence: string;
    }>(
      `SELECT ledger_transaction_id::text, transaction_sequence::text
         FROM pollycar_finance.ledger_transactions
        WHERE idempotency_key = $1
          AND transaction_type = $2`,
      [command.idempotencyKey, command.transactionType],
    );
    expect(existing.rows).toHaveLength(1);

    const replayed = await postAsRuntime(createRuntime(pool), command);
    expect(replayed).toEqual({
      ledgerTransactionId: existing.rows[0]!.ledger_transaction_id,
      transactionSequence: existing.rows[0]!.transaction_sequence,
      replayed: true,
    });
    await expectPersistedCounts(pool, command, {
      transactions: "1",
      entries: "2",
      outboxEvents: "1",
    });

    const entriesAndProjections = await pool.query<{
      entries: string;
      projections: string;
    }>(
      `SELECT
         (SELECT count(*)::text
            FROM pollycar_finance.ledger_entries
           WHERE ledger_transaction_id = $1) AS entries,
         (SELECT count(*)::text
            FROM pollycar_finance.ledger_balance_projections AS projection
           WHERE projection.last_transaction_sequence = $2) AS projections`,
      [replayed.ledgerTransactionId, replayed.transactionSequence],
    );
    expect(entriesAndProjections.rows[0]).toEqual({
      entries: "2",
      projections: "2",
    });
  });
});

function createPool(applicationName: string): Pool {
  return new Pool({
    connectionString: databaseUrl,
    application_name: applicationName,
    max: 8,
  });
}

function createRuntime(pool: Pool): Readonly<{
  transaction: PostgresTransaction;
  repository: PostgresLedgerRepository;
}> {
  const transaction = new PostgresTransaction(pool);
  return {
    transaction,
    repository: new PostgresLedgerRepository(transaction),
  };
}

async function postAsRuntime(
  runtime: ReturnType<typeof createRuntime>,
  command: LedgerPostingCommand,
) {
  return runtime.transaction.run(async () => {
    await runtime.transaction.currentClient().query("SET LOCAL ROLE pollycar_ledger_runtime");
    return runtime.repository.post(command);
  });
}

async function expectPersistedCounts(
  pool: Pool,
  command: LedgerPostingCommand,
  expected: Readonly<{
    transactions: string;
    entries: string;
    outboxEvents: string;
  }>,
): Promise<void> {
  const result = await pool.query<{
    transactions: string;
    entries: string;
    outbox_events: string;
  }>(
    `SELECT
       (SELECT count(*)::text
          FROM pollycar_finance.ledger_transactions
         WHERE source_system = $1
           AND source_event_id = $2
           AND transaction_type = $3) AS transactions,
       (SELECT count(*)::text
          FROM pollycar_finance.ledger_entries AS entry
          JOIN pollycar_finance.ledger_transactions AS transaction
            ON transaction.ledger_transaction_id = entry.ledger_transaction_id
         WHERE transaction.source_system = $1
           AND transaction.source_event_id = $2
           AND transaction.transaction_type = $3) AS entries,
       (SELECT count(*)::text
          FROM public.pollycar_outbox
         WHERE payload->>'source_system' = $1
           AND payload->>'source_event_id' = $2
           AND payload->>'transaction_type' = $3) AS outbox_events`,
    [command.sourceSystem, command.sourceEventId, command.transactionType],
  );
  expect(result.rows[0]).toEqual({
    transactions: expected.transactions,
    entries: expected.entries,
    outbox_events: expected.outboxEvents,
  });
}

async function projectionSnapshot(pool: Pool) {
  const result = await pool.query<{
    ledger_account_id: string;
    debit_total_minor: string;
    credit_total_minor: string;
    balance_minor: string;
    last_transaction_sequence: string;
  }>(
    `SELECT ledger_account_id::text,
            debit_total_minor::text,
            credit_total_minor::text,
            balance_minor::text,
            last_transaction_sequence::text
       FROM pollycar_finance.ledger_balance_projections
      ORDER BY ledger_account_id`,
  );
  return result.rows;
}

async function immutableLedgerCounts(pool: Pool) {
  const result = await pool.query<{
    transactions: string;
    entries: string;
  }>(
    `SELECT
       (SELECT count(*)::text FROM pollycar_finance.ledger_transactions) AS transactions,
       (SELECT count(*)::text FROM pollycar_finance.ledger_entries) AS entries`,
  );
  return result.rows[0];
}

function rejectionMessage(results: readonly PromiseSettledResult<unknown>[]): string {
  return results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => String(result.reason))
    .join("\n");
}

function paymentCommand(): LedgerPostingCommand {
  const suffix = randomUUID();
  return createPaymentCommand(suffix);
}

function restartRecoveryCommand(): LedgerPostingCommand {
  return createPaymentCommand("restart-recovery-fixed");
}

function createPaymentCommand(suffix: string): LedgerPostingCommand {
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
