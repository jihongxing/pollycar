import { describe, expect, it } from "vitest";
import { PostgresDriverQuotaRepository } from "./postgres-driver-quota-repository.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

describe("PostgreSQL 接单配额仓储", () => {
  it("只读取占用和已确认计入的滚动历史", async () => {
    let queryText = "";
    const repository = new PostgresDriverQuotaRepository({
      currentClient: () => ({
        query: async (text: string) => {
          queryText = text;
          return {
            rows: [{ occupied_at: "2026-07-13T00:00:00.000Z" }],
            rowCount: 1,
          };
        },
      }),
    } as unknown as PostgresTransaction);

    await expect(repository.listCountedHistory("driver-1")).resolves.toEqual([
      { occurredAt: new Date("2026-07-13T00:00:00.000Z") },
    ]);
    expect(queryText).toContain("occupancy_state IN ('occupied', 'finalized')");
  });
});
