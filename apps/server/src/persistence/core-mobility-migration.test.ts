import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("核心出行 PostgreSQL 迁移", () => {
  it("创建行程、幂等、接单配额和善意取消专用表", async () => {
    const sql = await readFile(
      resolve(process.cwd(), "migrations/0002_core_mobility_persistence.sql"),
      "utf8",
    );
    for (const table of [
      "pollycar_synthetic_trips",
      "pollycar_idempotency_keys",
      "pollycar_driver_quota_occupancies",
      "pollycar_goodwill_cancellations",
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(sql).toContain("CHECK (occupancy_state IN ('occupied', 'released', 'finalized'))");
    expect(sql).toContain("CHECK (record_state IN ('reserved', 'consumed', 'restored'))");
    expect(sql).toContain("UNIQUE (account_id, idempotency_key)");
    expect(sql).toContain("WHERE record_state = 'consumed'");
  });
});
