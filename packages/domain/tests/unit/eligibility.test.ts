import { describe, expect, it } from "vitest";
import { decideEligibilityTransition } from "../../src/index.js";

describe("弹性资格状态转换", () => {
  it("允许免费确认并拒绝付费确认", () => {
    const aggregate = { id: "elig-1", state: "awaiting_confirmation" as const, version: 2 };
    const free = decideEligibilityTransition(
      aggregate,
      { type: "confirm_free_trial", requestId: "req-free" },
      { expectedVersion: 2, activationDaysInLookback: 0 },
    );
    const paid = decideEligibilityTransition(
      aggregate,
      { type: "confirm_paid_trial", requestId: "req-paid" },
      { expectedVersion: 2, activationDaysInLookback: 0 },
    );

    expect(free).toMatchObject({ ok: true, next: { state: "pending_activation", version: 3 } });
    expect(paid).toEqual({
      ok: false,
      error: { code: "ELIGIBILITY_PAID_PATH_FROZEN", retryable: false },
    });
  });

  it("拒绝第 61 个启用日", () => {
    const result = decideEligibilityTransition(
      { id: "elig-1", state: "pending_activation", version: 3 },
      { type: "activate", requestId: "req-active", cycleEndsAt: new Date("2026-08-10T00:00:00Z") },
      { expectedVersion: 3, activationDaysInLookback: 60 },
    );
    expect(result).toMatchObject({ ok: false, error: { code: "ELIGIBILITY_ACTIVATION_DAYS_EXCEEDED" } });
  });
});
