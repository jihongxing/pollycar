import { describe, expect, it } from "vitest";
import { MemoryAuditLog } from "../adapters/memory-audit.js";
import { MemoryRepository } from "../adapters/memory-repository.js";
import { VehicleLocationService, type VehicleLocationRecord } from "./vehicle-location-service.js";

describe("VehicleLocationService", () => {
  it("按阶段限制上传频率并最小化精度", async () => {
    let now = new Date("2026-07-13T08:00:00.000Z");
    const service = new VehicleLocationService(
      new MemoryRepository<VehicleLocationRecord>(),
      new MemoryAuditLog(),
      () => now,
    );
    await service.setStage("trip-1", "driver-1", "driver_en_route");
    const first = await service.upload("driver-1", update(now, 1), "one");
    expect(first.update?.location.latitude).toBe(31.23046);
    now = new Date(now.getTime() + 5_000);
    await expect(service.upload("driver-1", update(now, 2), "two"))
      .rejects.toThrow("VEHICLE_LOCATION_TOO_FREQUENT");
    now = new Date(now.getTime() + 5_000);
    await expect(service.upload("driver-1", update(now, 2), "two")).resolves.toMatchObject({
      freshness: "fresh",
      uploadIntervalSeconds: 10,
    });
  });

  it("位置按十五、三十和六十秒进入老化、陈旧和不可用", async () => {
    let now = new Date("2026-07-13T08:00:00.000Z");
    const service = new VehicleLocationService(
      new MemoryRepository<VehicleLocationRecord>(),
      new MemoryAuditLog(),
      () => now,
    );
    await service.setStage("trip-1", "driver-1", "in_progress");
    await service.upload("driver-1", update(now, 1), "one");
    now = new Date(now.getTime() + 15_000);
    expect((await service.get("synthetic-passenger-8", "trip-1")).freshness).toBe("aging");
    now = new Date(now.getTime() + 15_000);
    expect((await service.get("synthetic-passenger-8", "trip-1")).freshness).toBe("stale");
    now = new Date(now.getTime() + 30_000);
    const unavailable = await service.get("synthetic-passenger-8", "trip-1");
    expect(unavailable.freshness).toBe("unavailable");
    expect("update" in unavailable).toBe(false);
  });

  it("行程关闭停止上传并在安全证据锁下阻止清理", async () => {
    let now = new Date("2026-07-13T08:00:00.000Z");
    const records = new MemoryRepository<VehicleLocationRecord>();
    const service = new VehicleLocationService(records, new MemoryAuditLog(), () => now);
    await service.setStage("trip-1", "driver-1", "accepted");
    await service.setEvidenceHold("trip-1", true);
    await service.setStage("trip-1", "driver-1", "closed");
    await expect(service.upload("driver-1", update(now, 1), "one"))
      .rejects.toThrow("VEHICLE_LOCATION_STREAM_STOPPED");
    now = new Date(now.getTime() + 3_600_001);
    expect(await service.purgeExpired()).toEqual({ deleted: 0, blockedByHold: 1 });
    await service.setEvidenceHold("trip-1", false);
    expect(await service.purgeExpired()).toEqual({ deleted: 1, blockedByHold: 0 });
  });
});

function update(capturedAt: Date, sequence: number) {
  return {
    tripId: "trip-1",
    accountId: "driver-1",
    sequence,
    capturedAt: capturedAt.toISOString(),
    location: { latitude: 31.230456, longitude: 121.473712, coordinateSystem: "gcj02" as const },
    accuracyMeters: 12.4,
    speedMetersPerSecond: 8.44,
    headingDegrees: 87,
    appState: "foreground" as const,
  };
}
