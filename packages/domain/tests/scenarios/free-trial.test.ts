import { describe, expect, it } from "vitest";
import { countActiveCalendarDays, decideEligibilityTransition, evaluateQuota } from "../../src/index.js";

describe("免费弹性资格场景", () => {
  it("启用资格使用弹性配额且付费路径冻结", () => {
    const confirmed = decideEligibilityTransition(
      { id: "elig-1", state: "awaiting_confirmation", version: 1 },
      { type: "confirm_free_trial", requestId: "confirm-1" },
      { expectedVersion: 1, activationDaysInLookback: 30 },
    );
    expect(confirmed.ok).toBe(true);

    const now = new Date("2026-07-11T12:00:00Z");
    const history = [1, 2, 3].map((hours) => ({ occurredAt: new Date(now.getTime() - hours * 60 * 60 * 1000) }));
    expect(evaluateQuota("flex", history, now).ok).toBe(true);
  });

  it("部分启用日按一个自然日计算", () => {
    const days = countActiveCalendarDays(
      [{ startsAt: new Date("2026-07-10T16:30:00Z"), endsAt: new Date("2026-07-10T17:00:00Z") }],
      new Date("2026-07-11T00:00:00Z"),
      "Asia/Shanghai",
    );
    expect(days).toBe(1);
  });
});
