import { afterEach, describe, expect, it } from "vitest";

import {
  clearIdentityScopedJourneyState,
  identityRedirectForScreen,
  readDriverHistoryFilter,
  readDriverOrder,
  readPassengerHistoryFilter,
  readPassengerTripDetail,
  rememberDriverHistoryFilter,
  rememberDriverOrder,
  rememberPassengerHistoryFilter,
  rememberPassengerTripDetail,
} from "./journey-continuity";

describe("journey continuity", () => {
  afterEach(() => {
    clearIdentityScopedJourneyState();
  });

  it("restores selected passenger and driver records with list filters", () => {
    rememberPassengerTripDetail("trip-7", "message");
    rememberPassengerHistoryFilter("completed");
    rememberDriverOrder("order-9");
    rememberDriverHistoryFilter("cancelled");

    expect(readPassengerTripDetail()).toEqual({
      tripId: "trip-7",
      origin: "message",
    });
    expect(readPassengerHistoryFilter()).toBe("completed");
    expect(readDriverOrder()).toBe("order-9");
    expect(readDriverHistoryFilter()).toBe("cancelled");
  });

  it("clears identity-scoped navigation without retaining stale records", () => {
    rememberPassengerTripDetail("trip-7", "history");
    rememberDriverOrder("order-9");

    clearIdentityScopedJourneyState();

    expect(readPassengerTripDetail()).toBeUndefined();
    expect(readDriverOrder()).toBeUndefined();
    expect(readPassengerHistoryFilter()).toBe("all");
    expect(readDriverHistoryFilter()).toBe("all");
  });

  it("redirects identity-restricted deep links to the correct home", () => {
    expect(identityRedirectForScreen("driver-history", "passenger")).toBe(
      "ride-home",
    );
    expect(identityRedirectForScreen("ride-history", "owner")).toBe(
      "driver-home",
    );
    expect(identityRedirectForScreen("message-center", "owner")).toBeUndefined();
  });
});
