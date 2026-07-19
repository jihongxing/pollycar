import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("派单邀请 PostgreSQL 迁移", () => {
  it("创建位置、邀请和车主活动行程数据库约束", async () => {
    const sql = await readFile(
      resolve(process.cwd(), "migrations/0006_dispatch_offers.sql"),
      "utf8",
    );

    for (const required of [
      "pollycar_driver_dispatch_presence",
      "pollycar_dispatch_offers",
      "pollycar_synthetic_trips_one_active_immediate_driver",
      "driver_occupied_window",
      "pollycar_synthetic_trips_driver_schedule_exclusion",
      "EXCLUDE USING gist",
    ]) {
      expect(sql).toContain(required);
    }
  });
});

