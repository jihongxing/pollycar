import { describe, expect, it } from "vitest";
import { resolveTarget } from "./communication-context";

describe("消息中心目标路由", () => {
  it("所有共享目标都映射为有效页面", () => {
    expect(resolveTarget({ kind: "trip_chat", tripId: "trip-1" })).toBe("trip-chat");
    expect(resolveTarget({ kind: "trip", tripId: "trip-1" })).toBe("ride-detail");
    expect(resolveTarget({ kind: "vehicle_review" })).toBe("vehicle-settings");
    expect(resolveTarget({ kind: "eligibility" })).toBe("eligibility-settings");
    expect(resolveTarget({ kind: "safety_case", caseId: "case-1" })).toBe("safety-result");
  });
});
