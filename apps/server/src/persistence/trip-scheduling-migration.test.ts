import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("预约行程 PostgreSQL 迁移", () => {
  it("建立预约时间列、十分钟约束和车主冲突索引", async () => {
    const sql = await readFile(
      resolve(process.cwd(), "migrations/0005_trip_scheduling.sql"),
      "utf8",
    );
    for (const required of [
      "timing_mode",
      "requested_pickup_starts_at",
      "requested_pickup_ends_at",
      "interval '10 minutes'",
      "pollycar_synthetic_trips_driver_schedule_idx",
    ]) {
      expect(sql).toContain(required);
    }
  });
});
