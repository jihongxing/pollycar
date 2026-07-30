import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient, type QueryResult } from "pg";
import { loadPostgresIntegrationTestConfig } from "@pollycar/configuration";

const databaseUrl =
  loadPostgresIntegrationTestConfig().ledgerPrototypeDatabaseUrl;
const describePostgres = databaseUrl ? describe.sequential : describe.skip;
const migrationPaths = [
  fileURLToPath(new URL("../../migrations/0001_internal_sandbox.sql", import.meta.url)),
  fileURLToPath(new URL("../../migrations/0007_financial_ledger.sql", import.meta.url)),
];

describePostgres("阶段三不可变复式账本数据库不变量原型", () => {
  const pool = new Pool({
    connectionString: databaseUrl,
    application_name: "pollycar-ledger-stage3-proof",
    max: 4,
  });

  beforeAll(async () => {
    for (const migrationPath of migrationPaths) {
      await pool.query(await readFile(migrationPath, "utf8"));
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("合法平衡交易通过唯一过账函数并同步生成投影与 Outbox", async () => {
    const request = paymentRequest();
    const posted = await postAsRuntime(pool, request);

    expect(posted.rows[0]).toMatchObject({
      ledger_transaction_id: request.ledger_transaction_id,
      replayed: false,
    });
    expect(BigInt(posted.rows[0]!.transaction_sequence)).toBeGreaterThan(0n);

    const projection = await pool.query<{
      debit_total_minor: string;
      credit_total_minor: string;
      balance_minor: string;
    }>(
      `SELECT debit_total_minor, credit_total_minor, balance_minor
         FROM pollycar_finance.ledger_balance_projections
        WHERE ledger_account_id IN ($1, $2)
        ORDER BY balance_minor DESC`,
      [
        request.entries[0]!.account.ledger_account_id,
        request.entries[1]!.account.ledger_account_id,
      ],
    );
    expect(projection.rows).toEqual([
      {
        debit_total_minor: "10000",
        credit_total_minor: "0",
        balance_minor: "10000",
      },
      {
        debit_total_minor: "0",
        credit_total_minor: "10000",
        balance_minor: "-10000",
      },
    ]);

    const outbox = await pool.query(
      "SELECT event_type FROM public.pollycar_outbox WHERE event_id = $1",
      [`ledger-posted:${request.ledger_transaction_id}`],
    );
    expect(outbox.rows).toEqual([{ event_type: "finance.ledger.transaction_posted" }]);
  });

  it("借贷不平交易由数据库拒绝", async () => {
    const request = paymentRequest();
    request.entries[1]!.amount_minor = "9999";

    await expect(postAsRuntime(pool, request)).rejects.toThrow(
      "LEDGER_TRANSACTION_UNBALANCED",
    );
  });

  it("单分录交易由数据库拒绝", async () => {
    const request = paymentRequest();
    request.entries = [request.entries[0]!];

    await expect(postAsRuntime(pool, request)).rejects.toThrow(
      "LEDGER_MINIMUM_ENTRIES_REQUIRED",
    );
  });

  it("重复来源事件由数据库拒绝", async () => {
    const first = paymentRequest();
    await postAsRuntime(pool, first);

    const duplicate = paymentRequest();
    duplicate.source_event_id = first.source_event_id;

    await expect(postAsRuntime(pool, duplicate)).rejects.toThrow(
      "LEDGER_SOURCE_EVENT_CONFLICT",
    );
  });

  it("同一幂等键对应不同请求摘要时由数据库拒绝", async () => {
    const first = paymentRequest();
    await postAsRuntime(pool, first);

    const conflicting = paymentRequest();
    conflicting.idempotency_key = first.idempotency_key;

    await expect(postAsRuntime(pool, conflicting)).rejects.toThrow(
      "LEDGER_IDEMPOTENCY_CONFLICT",
    );
  });

  it("相同幂等键和摘要返回原交易而不重复入账", async () => {
    const request = paymentRequest();
    const first = await postAsRuntime(pool, request);
    const replay = await postAsRuntime(pool, request);

    expect(replay.rows[0]).toEqual({
      ledger_transaction_id: first.rows[0]!.ledger_transaction_id,
      transaction_sequence: first.rows[0]!.transaction_sequence,
      replayed: true,
    });
    const count = await pool.query<{ count: string }>(
      `SELECT count(*)
         FROM pollycar_finance.ledger_transactions
        WHERE idempotency_key = $1`,
      [request.idempotency_key],
    );
    expect(count.rows[0]!.count).toBe("1");
  });

  it("已过账交易和分录即使由数据库管理员修改也被不可变触发器拒绝", async () => {
    const request = paymentRequest();
    await postAsRuntime(pool, request);

    await expect(
      pool.query(
        `UPDATE pollycar_finance.ledger_transactions
            SET reason_code = 'tampered'
          WHERE ledger_transaction_id = $1`,
        [request.ledger_transaction_id],
      ),
    ).rejects.toThrow("LEDGER_IMMUTABLE");

    await expect(
      pool.query(
        `DELETE FROM pollycar_finance.ledger_entries
          WHERE ledger_transaction_id = $1`,
        [request.ledger_transaction_id],
      ),
    ).rejects.toThrow("LEDGER_IMMUTABLE");
  });

  it("运行时角色不能直接写账本表或禁用触发器", async () => {
    const request = paymentRequest();

    await expect(
      runAsRuntime(pool, (client) =>
        client.query(
          `INSERT INTO pollycar_finance.ledger_transactions
             (ledger_transaction_id, transaction_type, business_reference_type,
              business_reference_id, source_system, source_event_id, idempotency_key,
              request_digest, rule_version, occurred_at, posted_at, initiator_type, state)
           VALUES ($1, 'PAYMENT_SUCCEEDED', 'payment_order', 'forbidden',
                   'payment_aggregate', 'forbidden', 'forbidden',
                   repeat('a', 64), 'v1', now(), now(), 'system', 'posted')`,
          [request.ledger_transaction_id],
        ),
      ),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      runAsRuntime(pool, (client) =>
        client.query(
          "ALTER TABLE pollycar_finance.ledger_entries DISABLE TRIGGER ALL",
        ),
      ),
    ).rejects.toThrow(/must be owner|permission denied/i);
  });

  it("延迟约束在提交时拒绝绕过过账函数写入的单分录交易", async () => {
    const seeded = paymentRequest();
    await postAsRuntime(pool, seeded);
    const transactionId = randomUUID();
    const connection = await pool.connect();

    try {
      await connection.query("BEGIN");
      await connection.query(
        `INSERT INTO pollycar_finance.ledger_transactions
           (ledger_transaction_id, transaction_type, business_reference_type,
            business_reference_id, source_system, source_event_id, idempotency_key,
            request_digest, rule_version, occurred_at, posted_at, initiator_type, state)
         VALUES ($1, 'PAYMENT_SUCCEEDED', 'payment_order', $2,
                 'payment_aggregate', $3, $4, repeat('b', 64),
                 'v1', now(), now(), 'system', 'posted')`,
        [
          transactionId,
          `direct-${transactionId}`,
          `direct-source-${transactionId}`,
          `direct-idempotency-${transactionId}`,
        ],
      );
      await connection.query(
        `INSERT INTO pollycar_finance.ledger_entries
           (ledger_entry_id, ledger_transaction_id, ledger_account_id,
            direction, amount_minor, currency, entry_sequence)
         VALUES ($1, $2, $3, 'debit', 10000, 'CNY', 1)`,
        [randomUUID(), transactionId, seeded.entries[0]!.account.ledger_account_id],
      );

      await expect(connection.query("COMMIT")).rejects.toThrow(
        "LEDGER_MINIMUM_ENTRIES_REQUIRED",
      );
    } finally {
      await connection.query("ROLLBACK").catch(() => undefined);
      connection.release();
    }
  });

  it("完整冲正由数据库复制反向分录，并拒绝二次冲正和冲正冲正", async () => {
    const original = paymentRequest();
    await postAsRuntime(pool, original);

    const reversal = reversalRequest(original.ledger_transaction_id);
    await postAsRuntime(pool, reversal);

    const entries = await pool.query<{
      direction: "debit" | "credit";
      amount_minor: string;
      entry_sequence: number;
    }>(
      `SELECT direction, amount_minor, entry_sequence
         FROM pollycar_finance.ledger_entries
        WHERE ledger_transaction_id = $1
        ORDER BY entry_sequence`,
      [reversal.ledger_transaction_id],
    );
    expect(entries.rows).toEqual([
      { direction: "credit", amount_minor: "10000", entry_sequence: 1 },
      { direction: "debit", amount_minor: "10000", entry_sequence: 2 },
    ]);

    await expect(
      postAsRuntime(pool, reversalRequest(original.ledger_transaction_id)),
    ).rejects.toThrow("LEDGER_REVERSAL_INVALID");
    await expect(
      postAsRuntime(pool, reversalRequest(reversal.ledger_transaction_id)),
    ).rejects.toThrow("LEDGER_REVERSAL_INVALID");

    const suppliedEntries = reversalRequest(paymentRequest().ledger_transaction_id);
    suppliedEntries.entries = paymentRequest().entries;
    await expect(postAsRuntime(pool, suppliedEntries)).rejects.toThrow(
      "LEDGER_REVERSAL_INVALID",
    );
  });
});

type LedgerAccountInput = {
  ledger_account_id: string;
  account_code: string;
  account_type: string;
  currency: "CNY";
  owner_type: string;
  owner_id: string;
  dimensions: Record<string, string>;
};

type LedgerEntryInput = {
  ledger_entry_id: string;
  entry_sequence: number;
  direction: "debit" | "credit";
  amount_minor: string;
  currency: "CNY";
  account: LedgerAccountInput;
};

type LedgerRequest = {
  ledger_transaction_id: string;
  transaction_type: string;
  business_reference_type: string;
  business_reference_id: string;
  source_system: string;
  source_event_id: string;
  idempotency_key: string;
  request_digest: string;
  rule_version: string;
  occurred_at: string;
  initiator_type: "system" | "finance_manual";
  reversal_of_transaction_id: string | null;
  reason_code: string | null;
  review_reference: string | null;
  entries: LedgerEntryInput[];
};

function paymentRequest(): LedgerRequest {
  const suffix = randomUUID();
  return {
    ledger_transaction_id: randomUUID(),
    transaction_type: "PAYMENT_SUCCEEDED",
    business_reference_type: "payment_order",
    business_reference_id: `payment-${suffix}`,
    source_system: "payment_aggregate",
    source_event_id: `payment-event-${suffix}`,
    idempotency_key: `payment-idempotency-${suffix}`,
    request_digest: randomDigest(),
    rule_version: "payment-v1",
    occurred_at: "2026-07-14T08:00:00.000Z",
    initiator_type: "system",
    reversal_of_transaction_id: null,
    reason_code: null,
    review_reference: null,
    entries: [
      {
        ledger_entry_id: randomUUID(),
        entry_sequence: 1,
        direction: "debit",
        amount_minor: "10000",
        currency: "CNY",
        account: {
          ledger_account_id: randomUUID(),
          account_code: "ASSET_PROVIDER_RECEIVABLE",
          account_type: "asset",
          currency: "CNY",
          owner_type: "platform",
          owner_id: "platform-main",
          dimensions: {
            provider_id: "synthetic-provider",
            merchant_account_id: `synthetic-merchant-${suffix}`,
          },
        },
      },
      {
        ledger_entry_id: randomUUID(),
        entry_sequence: 2,
        direction: "credit",
        amount_minor: "10000",
        currency: "CNY",
        account: {
          ledger_account_id: randomUUID(),
          account_code: "LIABILITY_PASSENGER_HELD",
          account_type: "liability",
          currency: "CNY",
          owner_type: "passenger",
          owner_id: `passenger-${suffix}`,
          dimensions: {
            payment_order_id: `payment-${suffix}`,
            trip_id: `trip-${suffix}`,
          },
        },
      },
    ],
  };
}

function reversalRequest(originalTransactionId: string): LedgerRequest {
  const suffix = randomUUID();
  return {
    ledger_transaction_id: randomUUID(),
    transaction_type: "FULL_REVERSAL",
    business_reference_type: "ledger_transaction",
    business_reference_id: originalTransactionId,
    source_system: "manual_finance",
    source_event_id: `reversal-event-${suffix}`,
    idempotency_key: `reversal-idempotency-${suffix}`,
    request_digest: randomDigest(),
    rule_version: "reversal-v1",
    occurred_at: "2026-07-14T09:00:00.000Z",
    initiator_type: "finance_manual",
    reversal_of_transaction_id: originalTransactionId,
    reason_code: "prototype_correction",
    review_reference: `review-${suffix}`,
    entries: [],
  };
}

function randomDigest(): string {
  return randomUUID().replaceAll("-", "").padEnd(64, "0");
}

async function postAsRuntime(
  pool: Pool,
  request: LedgerRequest,
): Promise<QueryResult<{
  ledger_transaction_id: string;
  transaction_sequence: string;
  replayed: boolean;
}>> {
  return runAsRuntime(pool, (client) =>
    client.query(
      "SELECT * FROM pollycar_finance.post_ledger_transaction($1::jsonb)",
      [JSON.stringify(request)],
    ),
  );
}

async function runAsRuntime<TResult>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<TResult>,
): Promise<TResult> {
  const connection = await pool.connect();
  await connection.query("BEGIN");
  try {
    await connection.query("SET LOCAL ROLE pollycar_ledger_runtime");
    const result = await operation(connection);
    await connection.query("COMMIT");
    return result;
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}
