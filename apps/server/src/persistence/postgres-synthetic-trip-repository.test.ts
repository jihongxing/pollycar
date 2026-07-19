import { describe, expect, it } from "vitest";
import type { SyntheticTripRecord } from "../application/synthetic-trip-service.js";
import { PostgresSyntheticTripRepository } from "./postgres-synthetic-trip-repository.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

describe("PostgreSQL 合成行程仓储", () => {
  it("保存行程并同步幂等键与接单配额占用", async () => {
    const queries: string[] = [];
    const repository = new PostgresSyntheticTripRepository(
      createTransaction(async (text) => {
        queries.push(text);
        if (text.includes("RETURNING trip_id")) {
          return {
            rows: [{ trip_id: "trip-1", trip_version: 1, payload: acceptedTrip() }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
    );

    await expect(repository.put("trip-1", acceptedTrip(), 0)).resolves.toMatchObject({
      version: 1,
    });
    expect(queries.some((query) => query.includes("pollycar_idempotency_keys"))).toBe(true);
    expect(queries.some((query) => query.includes("pollycar_driver_quota_occupancies"))).toBe(true);
  });

  it("幂等键被其他聚合占用时拒绝写入", async () => {
    const repository = new PostgresSyntheticTripRepository(
      createTransaction(async (text) => {
        if (text.includes("RETURNING trip_id")) {
          return {
            rows: [{ trip_id: "trip-1", trip_version: 1, payload: acceptedTrip() }],
            rowCount: 1,
          };
        }
        if (text.includes("pollycar_idempotency_keys")) return { rows: [], rowCount: 0 };
        return { rows: [], rowCount: 1 };
      }),
    );

    await expect(repository.put("trip-1", acceptedTrip(), 0)).rejects.toThrow(
      "CONFLICT_IDEMPOTENCY_KEY_REUSED",
    );
  });

  it("版本不匹配映射为统一并发错误", async () => {
    const repository = new PostgresSyntheticTripRepository(
      createTransaction(async () => ({ rows: [], rowCount: 0 })),
    );
    await expect(repository.put("trip-1", acceptedTrip(), 2)).rejects.toThrow(
      "STORAGE_CONCURRENT_MODIFICATION",
    );
  });
});

function acceptedTrip(): SyntheticTripRecord {
  return {
    tripId: "trip-1",
    passengerAccountId: "passenger-1",
    driverAccountId: "driver-1",
    state: "accepted",
    originLabel: "合成起点",
    destinationLabel: "合成终点",
    passengerCount: 1,
    createdAt: "2026-07-13T00:00:00.000Z",
    acceptedAt: "2026-07-13T00:01:00.000Z",
    quotaPolicy: "base",
    processedKeys: ["accept-key"],
    synthetic: true,
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
