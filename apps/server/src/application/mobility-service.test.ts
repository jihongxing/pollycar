import { describe, expect, it } from "vitest";
import { MemoryAuditLog } from "../adapters/memory-audit.js";
import { MemoryRepository, MemoryTransaction } from "../adapters/memory-repository.js";
import {
  MobilityService,
  type CompletionIntentRecord,
  type DriverAvailabilityRecord,
} from "./mobility-service.js";
import type { SyntheticTripRecord } from "./synthetic-trip-service.js";

function setup(now = new Date("2026-07-12T10:00:00.000Z")) {
  const trips = new MemoryRepository<SyntheticTripRecord>();
  const availability = new MemoryRepository<DriverAvailabilityRecord>();
  const intents = new MemoryRepository<CompletionIntentRecord>();
  const audit = new MemoryAuditLog();
  let clock = now;
  const service = new MobilityService(
    trips,
    availability,
    intents,
    new MemoryTransaction(),
    audit,
    async () => ({
      quotaPolicy: "base",
      maxPassengerCount: 3,
      vehicle: {
        vehicleId: "synthetic-vehicle-driver",
        color: "银色",
        make: "合成品牌",
        model: "合成车型",
        licensePlate: "沪A·TEST",
        maxPassengerCount: 3,
        synthetic: true,
      },
    }),
    () => clock,
  );
  return {
    service,
    trips,
    availability,
    intents,
    audit,
    advance(milliseconds: number) {
      clock = new Date(clock.getTime() + milliseconds);
    },
  };
}

async function seedTrip(
  repository: MemoryRepository<SyntheticTripRecord>,
  overrides: Partial<SyntheticTripRecord> = {},
) {
  return repository.put(
    "synthetic-trip-1",
    {
      tripId: "synthetic-trip-1",
      passengerAccountId: "synthetic-passenger-8",
      state: "paid_pending_match",
      originLabel: "合成起点",
      destinationLabel: "合成终点",
      passengerCount: 1,
      createdAt: "2026-07-12T09:00:00.000Z",
      processedKeys: [],
      synthetic: true,
      ...overrides,
    },
    0,
  );
}

describe("MobilityService", () => {
  it("默认离线，只有上线后才展示可接订单", async () => {
    const context = setup();
    await seedTrip(context.trips);

    expect(await context.service.listAvailableTrips("synthetic-driver")).toEqual([]);
    await context.service.setAvailability("synthetic-driver", "online", true, "availability-online");

    const available = await context.service.listAvailableTrips("synthetic-driver");
    expect(available).toHaveLength(1);
    expect(available[0]?.passengerProfile.gender).toBe("female");
    expect(available[0]?.passengerProfile.genderDisclosure).toBe(
      "eligible_driver_pre_acceptance",
    );
    await expect(context.audit.query("trip_party_profile", "synthetic-trip-1")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: "synthetic-driver",
          action: "trip_profile.passenger.pre_acceptance_view",
        }),
      ]),
    );
  });

  it("接单后写入双方公开资料和上车确认码", async () => {
    const context = setup();
    await seedTrip(context.trips, {
      state: "accepted",
      driverAccountId: "synthetic-driver",
      acceptedAt: "2026-07-12T09:59:00.000Z",
    });

    await context.service.enrichAcceptedTrip("synthetic-trip-1", "synthetic-driver");
    const stored = await context.trips.get("synthetic-trip-1");

    expect(stored?.value.passengerProfile?.synthetic).toBe(true);
    expect(stored?.value.driverProfile?.accountId).toBe("synthetic-driver");
    expect(stored?.value.driverProfile?.genderDisclosure).toBe(
      "matched_passenger_post_acceptance",
    );
    expect(stored?.value.vehicleProfile?.licensePlate).toBe("沪A·TEST");
    expect(stored?.value.boardingCode).toMatch(/^\d{4}$/);
    await expect(
      context.service.getPickupVerification("synthetic-driver", "synthetic-trip-1"),
    ).rejects.toThrow("TRIP_FORBIDDEN");
    await expect(
      context.service.getPickupVerification("synthetic-passenger-8", "synthetic-trip-1"),
    ).resolves.toMatchObject({ code: stored?.value.boardingCode });
    await expect(context.audit.query("trip_party_profile", "synthetic-trip-1")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: "synthetic-passenger-8",
          action: "trip_profile.driver.post_acceptance_view",
        }),
      ]),
    );
  });

  it("离线或无资格车主不能获得乘车人头像与性别", async () => {
    const trips = new MemoryRepository<SyntheticTripRecord>();
    const availability = new MemoryRepository<DriverAvailabilityRecord>();
    const audit = new MemoryAuditLog();
    const service = new MobilityService(
      trips,
      availability,
      new MemoryRepository<CompletionIntentRecord>(),
      new MemoryTransaction(),
      audit,
      async () => undefined,
      () => new Date("2026-07-12T10:00:00.000Z"),
    );
    await seedTrip(trips);
    await expect(service.listAvailableTrips("unqualified-driver")).resolves.toEqual([]);
    await expect(
      service.setAvailability("unqualified-driver", "online", true, "online-unqualified"),
    ).rejects.toThrow("QUOTA_DRIVER_INELIGIBLE");
    await expect(service.listAvailableTrips("unqualified-driver")).resolves.toEqual([]);
    await expect(audit.query("trip_party_profile", "synthetic-trip-1")).resolves.toEqual([]);
  });

  it("待接订单顺序只由仓储顺序和容量决定，不读取性别", async () => {
    const context = setup();
    await seedTrip(context.trips, {
      tripId: "synthetic-trip-1",
      passengerProfile: {
        accountId: "passenger-female",
        displayName: "甲",
        gender: "female",
        genderSource: "verified_identity_document",
        genderDisclosure: "eligible_driver_pre_acceptance",
        synthetic: true,
      },
    });
    await context.trips.put("synthetic-trip-2", {
      tripId: "synthetic-trip-2",
      passengerAccountId: "passenger-male",
      state: "paid_pending_match",
      originLabel: "合成起点二",
      destinationLabel: "合成终点二",
      passengerCount: 1,
      passengerProfile: {
        accountId: "passenger-male",
        displayName: "乙",
        gender: "male",
        genderSource: "verified_identity_document",
        genderDisclosure: "eligible_driver_pre_acceptance",
        synthetic: true,
      },
      createdAt: "2026-07-12T09:01:00.000Z",
      processedKeys: [],
      synthetic: true,
    }, 0);
    await context.service.setAvailability("synthetic-driver", "online", true, "online-order");
    const available = await context.service.listAvailableTrips("synthetic-driver");
    expect(available.map((trip) => trip.tripId)).toEqual([
      "synthetic-trip-1",
      "synthetic-trip-2",
    ]);
  });

  it("三分钟内允许无原因取消，边界时拒绝", async () => {
    const allowed = setup(new Date("2026-07-12T10:02:59.000Z"));
    await seedTrip(allowed.trips, {
      state: "accepted",
      driverAccountId: "synthetic-driver",
      acceptedAt: "2026-07-12T10:00:00.000Z",
    });

    const cancelled = await allowed.service.cancelAcceptedTrip(
      "synthetic-passenger-8",
      "synthetic-trip-1",
      1,
      "cancel-within-window",
    );
    expect(cancelled.state).toBe("cancelled");

    const expired = setup(new Date("2026-07-12T10:03:00.000Z"));
    await seedTrip(expired.trips, {
      state: "accepted",
      driverAccountId: "synthetic-driver",
      acceptedAt: "2026-07-12T10:00:00.000Z",
    });
    await expect(
      expired.service.cancelAcceptedTrip(
        "synthetic-passenger-8",
        "synthetic-trip-1",
        1,
        "cancel-expired-window",
      ),
    ).rejects.toThrow("TRIP_CANCELLATION_WINDOW_EXPIRED");
  });

  it("到达后必须使用正确且未过期的上车确认码", async () => {
    const context = setup();
    await seedTrip(context.trips, {
      state: "driver_arrived",
      driverAccountId: "synthetic-driver",
      acceptedAt: "2026-07-12T09:50:00.000Z",
      boardingCode: "1234",
      boardingCodeExpiresAt: "2026-07-12T10:10:00.000Z",
    });

    await expect(
      context.service.verifyBoarding(
        "synthetic-driver",
        "synthetic-trip-1",
        1,
        "9999",
        "verify-wrong-code",
      ),
    ).rejects.toThrow("TRIP_BOARDING_CODE_INVALID");

    const refreshed = await context.trips.get("synthetic-trip-1");
    const started = await context.service.verifyBoarding(
      "synthetic-driver",
      "synthetic-trip-1",
      refreshed!.version,
      "1234",
      "verify-right-code",
    );
    expect(started.state).toBe("in_progress");
  });

  it("连续五次错误上车码后锁定并记录拒绝审计", async () => {
    const context = setup();
    await seedTrip(context.trips, {
      state: "driver_arrived" as never,
      driverAccountId: "synthetic-driver",
      boardingCode: "1234",
      boardingCodeExpiresAt: "2026-07-12T10:10:00.000Z",
    });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const current = await context.trips.get("synthetic-trip-1");
      await expect(
        context.service.verifyBoarding(
          "synthetic-driver",
          "synthetic-trip-1",
          current!.version,
          "9999",
          `verify-wrong-${attempt}`,
        ),
      ).rejects.toThrow(attempt === 5 ? "TRIP_BOARDING_CODE_LOCKED" : "TRIP_BOARDING_CODE_INVALID");
    }

    const locked = await context.trips.get("synthetic-trip-1");
    expect(locked?.value.boardingCodeFailedAttempts).toBe(5);
    expect(locked?.value.boardingCodeLockedUntil).toBe("2026-07-12T10:05:00.000Z");
    const auditEntries = await context.audit.query("synthetic_trip", "synthetic-trip-1");
    expect(auditEntries.filter((entry) => entry.outcome === "denied")).toHaveLength(5);
  });

  it("幂等命中前仍校验参与者授权", async () => {
    const context = setup();
    await seedTrip(context.trips, {
      state: "accepted",
      driverAccountId: "synthetic-driver",
      acceptedAt: "2026-07-12T10:00:00.000Z",
      processedKeys: ["known-key"],
    });

    await expect(
      context.service.cancelAcceptedTrip(
        "unrelated-account",
        "synthetic-trip-1",
        1,
        "known-key",
      ),
    ).rejects.toThrow("TRIP_FORBIDDEN");
  });

  it("乘客取消后按车主偏好释放接单占用", async () => {
    const context = setup();
    await context.availability.put(
      "synthetic-driver",
      {
        accountId: "synthetic-driver",
        state: "busy",
        returnOnlineAfterTrip: true,
        updatedAt: "2026-07-12T09:59:00.000Z",
        processedKeys: [],
        synthetic: true,
      },
      0,
    );
    await seedTrip(context.trips, {
      state: "accepted",
      driverAccountId: "synthetic-driver",
      acceptedAt: "2026-07-12T10:00:00.000Z",
    });

    await context.service.cancelAcceptedTrip(
      "synthetic-passenger-8",
      "synthetic-trip-1",
      1,
      "cancel-and-release",
    );

    await expect(context.service.getAvailability("synthetic-driver")).resolves.toMatchObject({
      state: "online",
    });
  });

  it("完成行程必须消费一次性短期完成意图", async () => {
    const context = setup();
    await seedTrip(context.trips, {
      state: "in_progress",
      driverAccountId: "synthetic-driver",
      acceptedAt: "2026-07-12T09:30:00.000Z",
      startedAt: "2026-07-12T09:45:00.000Z",
    });

    const intent = await context.service.createCompletionIntent(
      "synthetic-driver",
      "synthetic-trip-1",
      1,
      "completion-intent-1",
    );
    const completed = await context.service.completeWithIntent(
      "synthetic-driver",
      "synthetic-trip-1",
      1,
      intent.token,
      "complete-with-intent",
    );
    expect(completed.state).toBe("completed");

    await expect(
      context.service.completeWithIntent(
        "synthetic-driver",
        "synthetic-trip-1",
        1,
        intent.token,
        "complete-with-intent-again",
      ),
    ).rejects.toThrow("TRIP_COMPLETION_INTENT_CONSUMED");
  });

  it("订单查询隔离车主，资金能力保持只读关闭", async () => {
    const context = setup();
    await seedTrip(context.trips, {
      state: "completed",
      driverAccountId: "synthetic-driver",
      acceptedAt: "2026-07-12T09:20:00.000Z",
      startedAt: "2026-07-12T09:30:00.000Z",
      completedAt: "2026-07-12T10:00:00.000Z",
    });

    expect(await context.service.listDriverOrders("other-driver")).toEqual([]);
    await expect(context.service.getDriverOrder("other-driver", "synthetic-trip-1")).rejects.toThrow(
      "TRIP_FORBIDDEN",
    );
    expect(context.service.getFinanceOverview()).toMatchObject({
      withdrawableAmountMinor: 0,
      realPaymentEnabled: false,
      realBankCardBindingEnabled: false,
      realWithdrawalEnabled: false,
      synthetic: true,
    });
  });
});
