import { describe, expect, it } from "vitest";
import type { AvailableDriverTripView, MessageCenterItem } from "@pollycar/contracts";
import { MemoryAuditLog } from "../adapters/memory-audit.js";
import { MemoryOutbox } from "../adapters/memory-outbox.js";
import { OutboxAuditLog } from "../adapters/outbox-audit.js";
import { MemoryRepository, MemoryTransaction } from "../adapters/memory-repository.js";
import type { NotificationDelivery } from "../ports/communication-delivery.js";
import {
  DispatchService,
  type DispatchOfferRecord,
  type DriverDispatchPresenceRecord,
} from "./dispatch-service.js";
import {
  SyntheticTripService,
  type SyntheticTripRecord,
} from "./synthetic-trip-service.js";

const now = new Date("2026-07-13T12:00:00.000Z");

function setup() {
  const trips = new MemoryRepository<SyntheticTripRecord>();
  const presences = new MemoryRepository<DriverDispatchPresenceRecord>();
  const offers = new MemoryRepository<DispatchOfferRecord>();
  const transaction = new MemoryTransaction();
  const outbox = new MemoryOutbox();
  const audit = new OutboxAuditLog(new MemoryAuditLog(), outbox);
  const notifications = new CapturingNotificationDelivery();
  const tripService = new SyntheticTripService(
    trips,
    transaction,
    audit,
    async () => ({ quotaPolicy: "flex", maxPassengerCount: 3 }),
    () => now,
  );
  const dispatch = new DispatchService(
    trips,
    presences,
    offers,
    transaction,
    audit,
    outbox,
    notifications,
    async (accountId) => {
      const records = await trips.list();
      return records
        .filter(
          ({ value }) =>
            value.passengerAccountId !== accountId &&
            ["paid_pending_match", "scheduled"].includes(value.state),
        )
        .map(({ value, version }) => candidate(value, version));
    },
    (accountId, tripId, expectedVersion, idempotencyKey) =>
      tripService.accept(accountId, tripId, expectedVersion, idempotencyKey),
    async () => {},
    () => now,
  );
  return { trips, presences, offers, outbox, notifications, tripService, dispatch };
}

describe("DispatchService", () => {
  it("仅向十公里内位置新鲜的在线车主生成邀请并投递通知", async () => {
    const context = setup();
    const trip = await seedTrip(context.trips, "trip-nearby");
    await online(context.dispatch, "driver-near", 31.2304, 121.4737);
    await online(context.dispatch, "driver-far", 31.4304, 121.6737);
    await appendMatchable(context.outbox, trip.value.tripId);

    const nearby = await context.dispatch.listOffers("driver-near");
    const far = await context.dispatch.listOffers("driver-far");

    expect(nearby.offers).toHaveLength(1);
    expect(nearby.offers[0]?.distanceMeters).toBeLessThanOrEqual(10_000);
    expect(far.offers).toEqual([]);
    expect(context.notifications.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: "driver-near",
          item: expect.objectContaining({ title: "附近有新的行程需求" }),
        }),
      ]),
    );
  });

  it("双车主同时抢同一单时仅一个成功", async () => {
    const context = setup();
    const trip = await seedTrip(context.trips, "trip-two-drivers");
    await online(context.dispatch, "driver-a", 31.2304, 121.4737);
    await online(context.dispatch, "driver-b", 31.2305, 121.4738);
    await appendMatchable(context.outbox, trip.value.tripId);
    const [offerA] = (await context.dispatch.listOffers("driver-a")).offers;
    const [offerB] = (await context.dispatch.listOffers("driver-b")).offers;

    const results = await Promise.allSettled([
      context.dispatch.acceptOffer("driver-a", offerA!.offerId, trip.version, "accept-driver-a"),
      context.dispatch.acceptOffer("driver-b", offerB!.offerId, trip.version, "accept-driver-b"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(rejectionMessage(results)).toBe("TRIP_ALREADY_ASSIGNED");
    const stored = await context.trips.get(trip.value.tripId);
    expect(["driver-a", "driver-b"]).toContain(stored?.value.driverAccountId);
  });

  it("同一车主同时抢两个即时订单时仅一个成功", async () => {
    const context = setup();
    const first = await seedTrip(context.trips, "trip-driver-first");
    const second = await seedTrip(context.trips, "trip-driver-second");
    await online(context.dispatch, "driver-one", 31.2304, 121.4737);
    await appendMatchable(context.outbox, first.value.tripId);
    await appendMatchable(context.outbox, second.value.tripId);
    const offers = (await context.dispatch.listOffers("driver-one")).offers;

    const results = await Promise.allSettled(
      offers.map((offer, index) =>
        context.dispatch.acceptOffer(
          "driver-one",
          offer.offerId,
          offer.tripVersion,
          `accept-one-${index}`,
        ),
      ),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(rejectionMessage(results)).toBe("DRIVER_ALREADY_BUSY");
  });

  it("预约占用时间重叠时第二个接单失败", async () => {
    const context = setup();
    const first = await seedScheduledTrip(
      context.trips,
      "trip-scheduled-first",
      "2026-07-13T14:00:00.000Z",
    );
    const second = await seedScheduledTrip(
      context.trips,
      "trip-scheduled-second",
      "2026-07-13T14:30:00.000Z",
    );
    await online(context.dispatch, "driver-scheduled", 31.2304, 121.4737);
    await appendMatchable(context.outbox, first.value.tripId);
    await appendMatchable(context.outbox, second.value.tripId);
    const offers = (await context.dispatch.listOffers("driver-scheduled")).offers;
    const firstOffer = offers.find((offer) => offer.tripId === first.value.tripId)!;
    const secondOffer = offers.find((offer) => offer.tripId === second.value.tripId)!;

    await expect(
      context.dispatch.acceptOffer(
        "driver-scheduled",
        firstOffer.offerId,
        first.version,
        "accept-scheduled-first",
      ),
    ).resolves.toMatchObject({ state: "reserved" });
    await expect(
      context.dispatch.acceptOffer(
        "driver-scheduled",
        secondOffer.offerId,
        second.version,
        "accept-scheduled-second",
      ),
    ).rejects.toThrow("TRIP_SCHEDULE_CONFLICT");
  });

  it("响应丢失后使用原幂等键返回首次成功结果", async () => {
    const context = setup();
    const trip = await seedTrip(context.trips, "trip-response-lost");
    await online(context.dispatch, "driver-retry", 31.2304, 121.4737);
    await appendMatchable(context.outbox, trip.value.tripId);
    const [offer] = (await context.dispatch.listOffers("driver-retry")).offers;

    const accepted = await context.dispatch.acceptOffer(
      "driver-retry",
      offer!.offerId,
      trip.version,
      "accept-response-lost",
    );
    const replayed = await context.dispatch.acceptOffer(
      "driver-retry",
      offer!.offerId,
      trip.version,
      "accept-response-lost",
    );

    expect(replayed).toEqual(accepted);
  });
});

async function online(
  dispatch: DispatchService,
  accountId: string,
  latitude: number,
  longitude: number,
) {
  return dispatch.updatePresence(
    accountId,
    "online",
    {
      latitude,
      longitude,
      coordinateSystem: "gcj02",
      accuracyMeters: 20,
      capturedAt: now.toISOString(),
      synthetic: true,
    },
    `presence-${accountId}`,
  );
}

async function appendMatchable(outbox: MemoryOutbox, tripId: string) {
  await outbox.append({
    eventId: `matchable-${tripId}`,
    aggregateType: "synthetic_trip",
    aggregateId: tripId,
    eventType: "trip_matchable",
    payload: {},
    occurredAt: now.toISOString(),
    synthetic: true,
  });
}

async function seedTrip(
  repository: MemoryRepository<SyntheticTripRecord>,
  tripId: string,
) {
  return repository.put(
    tripId,
    {
      tripId,
      passengerAccountId: `passenger-${tripId}`,
      state: "paid_pending_match",
      originLabel: "合成起点",
      destinationLabel: "合成终点",
      passengerCount: 1,
      timing: {
        mode: "immediate",
        timezone: "Asia/Shanghai",
        selectionSource: "immediate",
      },
      createdAt: now.toISOString(),
      processedKeys: [],
      synthetic: true,
    },
    0,
  );
}

async function seedScheduledTrip(
  repository: MemoryRepository<SyntheticTripRecord>,
  tripId: string,
  startsAt: string,
) {
  return repository.put(
    tripId,
    {
      tripId,
      passengerAccountId: `passenger-${tripId}`,
      state: "scheduled",
      originLabel: "合成预约起点",
      destinationLabel: "合成预约终点",
      passengerCount: 1,
      timing: {
        mode: "scheduled",
        timezone: "Asia/Shanghai",
        selectionSource: "calendar_slot",
        requestedPickupStartsAt: startsAt,
        requestedPickupEndsAt: new Date(new Date(startsAt).getTime() + 10 * 60 * 1000).toISOString(),
      },
      estimatedDurationMinutes: 60,
      createdAt: now.toISOString(),
      processedKeys: [],
      synthetic: true,
    },
    0,
  );
}

function candidate(record: SyntheticTripRecord, version: number): AvailableDriverTripView {
  return {
    tripId: record.tripId,
    version,
    state: record.state as "paid_pending_match" | "scheduled",
    originLabel: record.originLabel,
    destinationLabel: record.destinationLabel,
    passengerCount: record.passengerCount,
    ...(record.timing ? { timing: record.timing } : {}),
    ...(record.estimatedDurationMinutes
      ? { estimatedDurationMinutes: record.estimatedDurationMinutes }
      : {}),
    passengerProfile: {
      accountId: record.passengerAccountId,
      displayName: "合成乘车人",
      gender: "female",
      genderSource: "verified_identity_document",
      genderDisclosure: "eligible_driver_pre_acceptance",
      synthetic: true,
    },
    synthetic: true,
  };
}

function rejectionMessage(results: readonly PromiseSettledResult<unknown>[]): string | undefined {
  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  return rejected?.reason instanceof Error ? rejected.reason.message : undefined;
}

class CapturingNotificationDelivery implements NotificationDelivery {
  public readonly items: Array<Readonly<{ accountId: string; item: MessageCenterItem }>> = [];

  public async deliver(accountId: string, item: MessageCenterItem): Promise<void> {
    this.items.push({ accountId, item });
  }
}

