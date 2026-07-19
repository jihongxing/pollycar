import { describe, expect, it } from "vitest";
import { MemoryRepository, MemoryTransaction } from "../adapters/memory-repository.js";
import {
  GoodwillCancellationService,
  type GoodwillCancellationRecord,
} from "./goodwill-cancellation-service.js";

describe("善意取消额度服务", () => {
  it("乘车人按 1/1/2 三档滚动窗口限制", async () => {
    const repository = new MemoryRepository<GoodwillCancellationRecord>();
    let now = new Date("2026-07-13T00:00:00.000Z");
    const service = new GoodwillCancellationService(repository, new MemoryTransaction(), () => now);

    const first = await service.reserve("passenger-1", "trip-1", "passenger", "accepted", "key-1");
    await service.transition(first.recordId, "consumed");
    await expect(service.evaluate("passenger-1", "passenger", "accepted")).resolves.toMatchObject({
      eligible: false,
      blockedBy: "hours24",
      usage: { hours24: 1, days7: 1, days30: 1 },
      limits: { hours24: 1, days7: 1, days30: 2 },
    });

    now = new Date("2026-07-14T00:00:01.000Z");
    await expect(service.evaluate("passenger-1", "passenger", "accepted")).resolves.toMatchObject({
      eligible: false,
      blockedBy: "days7",
    });
  });

  it("车主允许 1/2/3 且到达后禁用", async () => {
    const repository = new MemoryRepository<GoodwillCancellationRecord>();
    const service = new GoodwillCancellationService(
      repository,
      new MemoryTransaction(),
      () => new Date("2026-07-13T00:00:00.000Z"),
    );

    await expect(service.evaluate("driver-1", "driver", "accepted")).resolves.toMatchObject({
      eligible: true,
      limits: { hours24: 1, days7: 2, days30: 3 },
    });
    await expect(service.evaluate("driver-1", "driver", "driver_arrived")).resolves.toMatchObject({
      eligible: false,
      blockedBy: "trip_state",
    });
  });

  it("重复预留返回同一记录且恢复后不计入使用量", async () => {
    const repository = new MemoryRepository<GoodwillCancellationRecord>();
    const service = new GoodwillCancellationService(
      repository,
      new MemoryTransaction(),
      () => new Date("2026-07-13T00:00:00.000Z"),
    );
    const first = await service.reserve("driver-1", "trip-1", "driver", "accepted", "same-key");
    const replay = await service.reserve("driver-1", "trip-1", "driver", "accepted", "same-key");
    expect(replay).toEqual(first);
    await service.transition(first.recordId, "restored");
    await expect(service.evaluate("driver-1", "driver", "accepted")).resolves.toMatchObject({
      eligible: true,
      usage: { hours24: 0, days7: 0, days30: 0 },
    });
  });
});
