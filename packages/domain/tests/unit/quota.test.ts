import { describe, expect, it } from "vitest";
import { evaluateQuota, occupyQuota, releaseOrFinalizeQuota } from "../../src/index.js";

const now = new Date("2026-07-11T12:00:00Z");

describe("滚动配额", () => {
  it("基础配额在 24 小时第 3 单后拒绝", () => {
    const history = [1, 2, 3].map((hours) => ({ occurredAt: new Date(now.getTime() - hours * 60 * 60 * 1000) }));
    expect(evaluateQuota("base", history, now)).toMatchObject({ ok: false, errorCode: "QUOTA_24H_EXCEEDED" });
    expect(evaluateQuota("flex", history, now)).toMatchObject({ ok: true });
  });

  it("同一占用只能释放一次", () => {
    const occupied = occupyQuota(undefined, "order-1", "req-1", 0);
    expect(occupied.ok).toBe(true);
    if (!occupied.ok) return;
    const released = releaseOrFinalizeQuota(occupied.occupancy, "release");
    expect(released).toMatchObject({ ok: true, eventType: "quota_slot_released" });
    if (!released.ok) return;
    expect(releaseOrFinalizeQuota(released.occupancy, "release")).toEqual({
      ok: false,
      code: "QUOTA_DUPLICATE_REQUEST",
    });
  });
});
