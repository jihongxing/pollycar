import { describe, expect, it } from "vitest";

import {
  cancellationRemainingSeconds,
  canConfirmRide,
  createRideDraft,
  searchPlaces,
  selectDestination,
  suggestedPlaces,
  updatePassengerCount,
  formatPickupSlot,
  pickupSlotTimeLabel,
  timingFromSlot,
} from "./ride-model";

describe("ride-model", () => {
  it("默认一人且选定目的地后才允许确认", () => {
    const initial = createRideDraft();
    expect(initial.passengerCount).toBe(1);
    expect(canConfirmRide(initial)).toBe(false);
    expect(canConfirmRide(selectDestination(initial, suggestedPlaces[0]!))).toBe(true);
  });

  it("支持最多三人的前端选择模型", () => {
    expect(updatePassengerCount(createRideDraft(), 3).passengerCount).toBe(3);
  });

  it("默认尽快出发并能把连续时段转为预约摘要", () => {
    expect(createRideDraft().timing.mode).toBe("immediate");
    const slot = {
      startsAt: "2026-07-13T07:00:00.000Z",
      endsAt: "2026-07-13T07:10:00.000Z",
      available: true,
    };
    expect(pickupSlotTimeLabel(slot)).toBe("15:00–15:10");
    expect(
      formatPickupSlot(
        timingFromSlot(slot, "quick_slot"),
        new Date("2026-07-13T06:25:00.000Z"),
      ),
    ).toEqual({ summary: "今天 15:00–15:10", action: "预约今天 15:00" });
  });

  it("搜索地点并保留常用地点", () => {
    expect(searchPlaces("虹桥")).toHaveLength(1);
    expect(searchPlaces("")).toHaveLength(suggestedPlaces.length);
  });

  it("按服务端接单时间计算三分钟窗口边界", () => {
    const acceptedAt = "2026-07-12T00:00:00.000Z";
    expect(cancellationRemainingSeconds(acceptedAt, Date.parse("2026-07-12T00:02:59.000Z"))).toBe(1);
    expect(cancellationRemainingSeconds(acceptedAt, Date.parse("2026-07-12T00:03:00.000Z"))).toBe(0);
  });
});
