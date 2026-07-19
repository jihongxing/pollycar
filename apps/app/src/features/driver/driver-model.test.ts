import { describe, expect, it } from "vitest";

import {
  canAcceptDriverTrip,
  canDriverGoOnline,
  filterDriverOrders,
  publicGenderLabel,
  resolveDriverAvailability,
  summarizeDriverToday,
  type DriverEligibility,
  type DriverOrderDetail,
} from "./driver-model";

const eligible: DriverEligibility = {
  vehicleApproved: true,
  qualificationActive: true,
  quotaAvailable: true,
  safetyClear: true,
};

const baseOrder: DriverOrderDetail = {
  id: "trip-1",
  state: "completed",
  pickupLabel: "人民广场",
  destinationLabel: "徐家汇",
  passengerCount: 2,
  syntheticAmountCents: 1880,
  createdAt: "2026-07-12T08:00:00.000Z",
  rider: {
    displayName: "林女士",
    gender: "female",
  },
  settlementSummary: "仅合成记录",
};

describe("driver model", () => {
  it("requires every eligibility condition before going online", () => {
    expect(canDriverGoOnline(eligible)).toBe(true);
    expect(canDriverGoOnline({ ...eligible, quotaAvailable: false })).toBe(false);
    expect(resolveDriverAvailability(true, { ...eligible, safetyClear: false }, false)).toBe(
      "blocked",
    );
  });

  it("keeps active trips busy even when online is requested", () => {
    expect(resolveDriverAvailability(true, eligible, true)).toBe("busy");
  });

  it("accepts only matching trips within vehicle capacity while online", () => {
    expect(
      canAcceptDriverTrip(
        "online",
        { passengerCount: 2, state: "paid_pending_match" },
        2,
      ),
    ).toBe(true);
    expect(
      canAcceptDriverTrip(
        "online",
        { passengerCount: 3, state: "paid_pending_match" },
        2,
      ),
    ).toBe(false);
    expect(
      canAcceptDriverTrip(
        "offline",
        { passengerCount: 1, state: "paid_pending_match" },
        3,
      ),
    ).toBe(false);
  });

  it("filters order history and summarizes completed synthetic amount", () => {
    const activeOrder = { ...baseOrder, id: "trip-2", state: "accepted" as const };
    const cancelledOrder = { ...baseOrder, id: "trip-3", state: "cancelled" as const };
    const orders = [baseOrder, activeOrder, cancelledOrder];

    expect(filterDriverOrders(orders, "active")).toEqual([activeOrder]);
    expect(filterDriverOrders(orders, "cancelled")).toEqual([cancelledOrder]);
    expect(summarizeDriverToday(orders, "2026-07-12")).toEqual({
      completedOrders: 1,
      activeOrders: 1,
      syntheticAmountCents: 1880,
    });
  });

  it("does not infer undisclosed gender", () => {
    expect(publicGenderLabel("female")).toBe("♀");
    expect(publicGenderLabel("male")).toBe("♂");
    expect(publicGenderLabel("undisclosed")).toBe("未公开");
  });
});
