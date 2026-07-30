import { describe, expect, it, vi } from "vitest";

import { HttpMobilityClient } from "./http-mobility-client";

describe("HttpMobilityClient 契约路径", () => {
  it("使用 Server 已实现的车主和行程操作路径", async () => {
    const requests: Array<{ url: string; method: string }> = [];
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, method: init?.method ?? "GET" });
      if (url.endsWith("/driver/offers")) {
        return jsonResponse({
          offers: [
            {
              offerId: "offer-synthetic-trip-1-synthetic-driver",
              tripId: "synthetic-trip-1",
              tripVersion: 2,
              driverAccountId: "synthetic-driver",
              state: "offered",
              dispatchRound: 1,
              distanceMeters: 800,
              offeredAt: "2026-07-13T12:00:00.000Z",
              expiresAt: "2026-07-13T12:00:30.000Z",
              trip: {
                tripId: "synthetic-trip-1",
                version: 2,
                state: "paid_pending_match",
                originLabel: "人民广场",
                destinationLabel: "徐家汇",
                passengerCount: 1,
                passengerProfile: {
                  accountId: "synthetic-passenger-1",
                  displayName: "林女士",
                  gender: "undisclosed",
                  synthetic: true,
                },
                synthetic: true,
              },
              synthetic: true,
            },
          ],
          serverTime: "2026-07-13T12:00:00.000Z",
          productionEnabled: false,
          realPushEnabled: false,
          synthetic: true,
        });
      }
      if (url.endsWith("/driver/availability")) {
        return jsonResponse({
          accountId: "synthetic-driver",
          state: "online",
          returnOnlineAfterTrip: true,
          livenessRequiredBeforeNextOnline: false,
          updatedAt: "2026-07-13T12:00:00.000Z",
          productionEnabled: false,
          synthetic: true,
        });
      }
      return jsonResponse({ synthetic: true });
    });
    const client = new HttpMobilityClient("http://internal", fetcher as typeof fetch);

    const available = await client.listAvailableTrips();
    await client.setDriverAvailability(
      "online",
      true,
      "synthetic-liveness-authorization-token",
    );
    await client.getFinanceOverview();
    await client.verifyBoarding("synthetic-trip-1", 2, "1234");

    expect(available[0]?.passengerProfile.accountId).toBe("synthetic-passenger-1");
    expect(requests.map(({ url, method }) => `${method} ${url}`)).toEqual([
      "GET http://internal/v1/internal-sandbox/app/driver/offers",
      "POST http://internal/v1/internal-sandbox/app/driver/dispatch-presence",
      "GET http://internal/v1/internal-sandbox/app/driver/availability",
      "GET http://internal/v1/internal-sandbox/app/driver/finance/overview",
      "POST http://internal/v1/internal-sandbox/app/synthetic-trips/synthetic-trip-1/verify-boarding",
    ]);
  });
});

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}
