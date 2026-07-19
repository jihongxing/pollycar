import { describe, expect, it } from "vitest";
import { TripBookingAvailabilityService } from "./trip-booking-availability-service.js";

describe("预约时间可用性服务", () => {
  it("生成最近四个连续十分钟快捷时段和滚动七十二小时上限", () => {
    const service = new TripBookingAvailabilityService(
      () => new Date("2026-07-13T06:25:00.000Z"),
    );
    const result = service.getAvailability();
    expect(result.latestScheduledAt).toBe("2026-07-16T06:25:00.000Z");
    expect(result.quickSlots.map((slot) => [slot.startsAt, slot.endsAt])).toEqual([
      ["2026-07-13T07:00:00.000Z", "2026-07-13T07:10:00.000Z"],
      ["2026-07-13T07:10:00.000Z", "2026-07-13T07:20:00.000Z"],
      ["2026-07-13T07:20:00.000Z", "2026-07-13T07:30:00.000Z"],
      ["2026-07-13T07:30:00.000Z", "2026-07-13T07:40:00.000Z"],
    ]);
  });

  it("拒绝过近、过远和非十分钟预约", () => {
    const service = new TripBookingAvailabilityService(
      () => new Date("2026-07-13T06:25:00.000Z"),
    );
    expect(() =>
      service.validate({
        mode: "scheduled",
        timezone: "Asia/Shanghai",
        selectionSource: "calendar_slot",
        requestedPickupStartsAt: "2026-07-13T06:50:00.000Z",
        requestedPickupEndsAt: "2026-07-13T07:00:00.000Z",
      }),
    ).toThrow("TRIP_PICKUP_TIME_TOO_SOON");
    expect(() =>
      service.validate({
        mode: "scheduled",
        timezone: "Asia/Shanghai",
        selectionSource: "calendar_slot",
        requestedPickupStartsAt: "2026-07-16T06:30:00.000Z",
        requestedPickupEndsAt: "2026-07-16T06:40:00.000Z",
      }),
    ).toThrow("TRIP_PICKUP_TIME_TOO_FAR");
  });
});
