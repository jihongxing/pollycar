import { afterEach, describe, expect, it } from "vitest";
import { startInternalSandboxHttpServer, type InternalSandboxHttpServer } from "./internal-sandbox-server.js";

describe("车辆位置 HTTP 闭环", () => {
  let running: InternalSandboxHttpServer | undefined;
  afterEach(async () => running?.close());

  it("支持阶段建立、上传、乘车人读取和关闭停止", async () => {
    let now = new Date("2026-07-13T08:00:00.000Z");
    running = await startInternalSandboxHttpServer({ port: 0, now: () => now });
    await running.sandbox.vehicleLocations.setStage("trip-location-1", "synthetic-account-7", "driver_en_route");
    const upload = await fetch(`${running.url}/v1/internal-sandbox/app/synthetic-trips/trip-location-1/vehicle-location`, {
      method: "POST",
      headers: {
        Authorization: "Sandbox synthetic-account-7",
        "Content-Type": "application/json",
        "Idempotency-Key": "location-upload-1",
      },
      body: JSON.stringify({
        tripId: "trip-location-1",
        accountId: "synthetic-account-7",
        sequence: 1,
        capturedAt: now.toISOString(),
        location: { latitude: 31.230456, longitude: 121.473712, coordinateSystem: "gcj02" },
        accuracyMeters: 12,
        appState: "foreground",
      }),
    });
    expect(upload.status).toBe(200);
    const passengerView = await fetch(
      `${running.url}/v1/internal-sandbox/app/synthetic-trips/trip-location-1/vehicle-location`,
      { headers: { Authorization: "Sandbox synthetic-passenger-8" } },
    );
    expect(await passengerView.json()).toMatchObject({
      freshness: "fresh",
      update: { sequence: 1 },
      realLocationEnabled: false,
    });
    await running.sandbox.vehicleLocations.setStage("trip-location-1", "synthetic-account-7", "closed");
    now = new Date(now.getTime() + 10_000);
    const stopped = await fetch(`${running.url}/v1/internal-sandbox/app/synthetic-trips/trip-location-1/vehicle-location`, {
      method: "POST",
      headers: {
        Authorization: "Sandbox synthetic-account-7",
        "Content-Type": "application/json",
        "Idempotency-Key": "location-upload-2",
      },
      body: JSON.stringify({
        tripId: "trip-location-1",
        accountId: "synthetic-account-7",
        sequence: 2,
        capturedAt: now.toISOString(),
        location: { latitude: 31.23045, longitude: 121.47371, coordinateSystem: "gcj02" },
        accuracyMeters: 12,
        appState: "foreground",
      }),
    });
    expect(stopped.status).toBe(409);
    expect(await stopped.json()).toMatchObject({ error: { code: "VEHICLE_LOCATION_STREAM_STOPPED" } });
  });
});
