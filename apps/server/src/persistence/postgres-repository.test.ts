import { describe, expect, it } from "vitest";
import { PostgresRepository } from "./postgres-repository.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

describe("PostgreSQL 聚合仓储", () => {
  it("使用版本条件保存合成记录", async () => {
    const calls: readonly unknown[][] = [];
    const mutableCalls = calls as unknown[][];
    const repository = new PostgresRepository<{ synthetic: true; status: string }>(
      "vehicle_review",
      createTransaction(async (_text, values) => {
        mutableCalls.push([...(values ?? [])]);
        return {
          rows: [{ record_key: "app-1", version: 1, payload: { synthetic: true, status: "draft" } }],
          rowCount: 1,
        };
      }),
    );

    const saved = await repository.put("app-1", { synthetic: true, status: "draft" }, 0);

    expect(saved.version).toBe(1);
    expect(mutableCalls[0]).toContain("vehicle_review");
  });

  it("并发失败映射为统一错误", async () => {
    const repository = new PostgresRepository(
      "vehicle_review",
      createTransaction(async () => ({ rows: [], rowCount: 0 })),
    );
    await expect(repository.put("app-1", { synthetic: true }, 1)).rejects.toThrow(
      "STORAGE_CONCURRENT_MODIFICATION",
    );
  });

  it("禁止写入非合成记录", async () => {
    const repository = new PostgresRepository(
      "vehicle_review",
      createTransaction(async () => ({ rows: [], rowCount: 0 })),
    );
    await expect(repository.put("app-1", { synthetic: false }, 0)).rejects.toThrow(
      "REAL_DATA_FORBIDDEN",
    );
  });
});

function createTransaction(
  query: (text: string, values?: readonly unknown[]) => Promise<{
    rows: readonly Record<string, unknown>[];
    rowCount: number;
  }>,
): PostgresTransaction {
  return {
    currentClient: () => ({ query }),
  } as PostgresTransaction;
}
