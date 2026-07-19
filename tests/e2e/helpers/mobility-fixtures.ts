import type { Page } from "@playwright/test";

type TripState =
  | "paid_pending_match"
  | "accepted"
  | "driver_arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

export function syntheticTrip(
  state: TripState = "accepted",
  tripId = "synthetic-trip-mobility-e2e",
  passengerCount: 1 | 2 | 3 = 2,
  now = Date.now(),
) {
  const acceptedAt = new Date(now - 30_000).toISOString();
  return {
    tripId,
    passengerAccountId: "synthetic-passenger-8",
    driverAccountId: state === "paid_pending_match" ? undefined : "synthetic-account-7",
    state,
    version: 4,
    originLabel: "人民广场",
    destinationLabel: "上海虹桥站",
    passengerCount,
    scene: "airport",
    passengerProfile: {
      accountId: "synthetic-passenger-8",
      displayName: "林女士",
      avatarUrl: "https://example.invalid/rider.png",
      gender: "female",
      genderSource: "verified_identity_document",
      genderDisclosure: "eligible_driver_pre_acceptance",
      rating: { average: 4.8, ratingCount: 36 },
      synthetic: true,
    },
    driverProfile: {
      accountId: "synthetic-account-7",
      displayName: "陈先生",
      avatarUrl: "https://example.invalid/driver.png",
      gender: "male",
      genderSource: "verified_identity_document",
      genderDisclosure: "matched_passenger_post_acceptance",
      rating: { average: 4.9, ratingCount: 128 },
      synthetic: true,
    },
    vehicle: {
      vehicleId: "synthetic-vehicle-e2e",
      color: "深空灰",
      make: "比亚迪",
      model: "汉 EV",
      licensePlate: "沪A·S1234",
      maxPassengerCount: 3,
      synthetic: true,
    },
    pickupVerification: {
      code: "2861",
      expiresAt: new Date(now + 10 * 60_000).toISOString(),
      synthetic: true,
    },
    cancellationEligibility: {
      tripId,
      eligible: state === "accepted" || state === "driver_arrived",
      acceptedAt,
      expiresAt: new Date(now + 150_000).toISOString(),
      remainingSeconds: 150,
      determinedByServer: true,
    },
    payment: {
      amountMinor: 0,
      currency: "CNY",
      realPayment: false,
      state: state === "paid_pending_match" || state === "accepted" || state === "driver_arrived" || state === "in_progress"
        ? "paid_pending_match"
        : "closed",
    },
    createdAt: new Date(now - 5 * 60_000).toISOString(),
    ...(state !== "paid_pending_match" ? { acceptedAt } : {}),
    ...(state === "driver_arrived" || state === "in_progress" || state === "completed"
      ? { startedAt: new Date(now - 60_000).toISOString() }
      : {}),
    ...(state === "completed" ? { completedAt: new Date(now).toISOString() } : {}),
    recovery: { state: "none" },
    synthetic: true,
  };
}

export async function mockMobilityDashboard(
  page: Page,
  options: {
    passengerTrip?: ReturnType<typeof syntheticTrip>;
    passengerTrips?: ReturnType<typeof syntheticTrip>[];
    availableDriverTrips?: ReturnType<typeof syntheticTrip>[];
    activeDriverTrip?: ReturnType<typeof syntheticTrip>;
    reservedDriverTrips?: ReturnType<typeof syntheticTrip>[];
  } = {},
) {
  await page.route("**/v1/internal-sandbox/app/synthetic-trips/dashboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        availableDriverTrips: options.availableDriverTrips ?? [],
        productionEnabled: false,
        realPayment: false,
        shanghaiPilot: false,
        ...(options.passengerTrip ? { passengerTrip: options.passengerTrip } : {}),
        ...(options.passengerTrips ? { passengerTrips: options.passengerTrips } : {}),
        ...(options.activeDriverTrip ? { activeDriverTrip: options.activeDriverTrip } : {}),
        ...(options.reservedDriverTrips
          ? { reservedDriverTrips: options.reservedDriverTrips }
          : {}),
      }),
    });
  });
}
