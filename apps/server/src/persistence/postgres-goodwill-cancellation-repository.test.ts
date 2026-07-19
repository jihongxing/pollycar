import { describe, expect, it } from "vitest";
import type { GoodwillCancellationRecord } from "../application/goodwill-cancellation-service.js";
import { PostgresGoodwillCancellationRepository } from "./postgres-goodwill-cancellation-repository.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

describe("PostgreSQL 善意取消仓储", () => {
  it("创建预留并使用显式版本更新为已消费", async () => {
    const values: readonly unknown[][] = [];
    const mutableValues = values as unknown[][];
    const repository = new PostgresGoodwillCancellationRepository(
      createTransaction(async (text, parameters) => {
        mutableValues.push([...(parameters ?? [])]);
        return {
          rows: [{
            record_id: "goodwill-1",
            record_version: text.startsWith("UPDATE") ? 2 : 1,
            payload: text.startsWith("UPDATE") ? consumedRecord() : reservedRecord(),
          }],
          rowCount: 1,
        };
      }),
    );
    const created = await repository.put("goodwill-1", reservedRecord(), 0);
    const consumed = await repository.put("goodwill-1", consumedRecord(), created.version);
    expect(consumed.version).toBe(2);
    expect(mutableValues[1]).toContain(1);
  });

  it("禁止非合成记录", async () => {
    const repository = new PostgresGoodwillCancellationRepository(
      createTransaction(async () => ({ rows: [], rowCount: 0 })),
    );
    await expect(
      repository.put(
        "goodwill-1",
        { ...reservedRecord(), synthetic: false } as unknown as GoodwillCancellationRecord,
        0,
      ),
    ).rejects.toThrow("REAL_DATA_FORBIDDEN");
  });
});

function reservedRecord(): GoodwillCancellationRecord {
  return {
    recordId: "goodwill-1",
    accountId: "passenger-1",
    tripId: "trip-1",
    actor: "passenger",
    state: "reserved",
    reservedAt: "2026-07-13T00:00:00.000Z",
    idempotencyKey: "cancel-key",
    synthetic: true,
  };
}

function consumedRecord(): GoodwillCancellationRecord {
  return {
    ...reservedRecord(),
    state: "consumed",
    consumedAt: "2026-07-13T00:01:00.000Z",
  };
}

function createTransaction(
  query: (text: string, values?: readonly unknown[]) => Promise<{
    rows: readonly Record<string, unknown>[];
    rowCount: number;
  }>,
): PostgresTransaction {
  return {
    currentClient: () => ({ query }),
    run: <TResult>(operation: () => Promise<TResult>) => operation(),
  } as PostgresTransaction;
}
