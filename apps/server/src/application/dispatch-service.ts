import type {
  DispatchOfferView,
  DriverDispatchLocation,
  DriverDispatchOffersView,
  DriverDispatchPresenceView,
  SyntheticTripView,
  AvailableDriverTripView,
} from "@pollycar/contracts";
import type { AuditLog } from "../ports/audit.js";
import type { NotificationDelivery } from "../ports/communication-delivery.js";
import type { Outbox } from "../ports/outbox.js";
import type { Repository, Transaction } from "../ports/storage.js";
import type { SyntheticTripRecord } from "./synthetic-trip-service.js";
import type { DriverOnlineAuthorization } from "./mobility-service.js";

export type DriverDispatchPresenceRecord = Readonly<{
  accountId: string;
  state: "online" | "offline";
  location?: DriverDispatchLocation;
  locationFreshUntil?: string;
  updatedAt: string;
  processedKeys: readonly string[];
  synthetic: true;
}>;

export type DispatchOfferRecord = DispatchOfferView &
  Readonly<{
    processedKeys: readonly string[];
  }>;

const locationFreshnessMs = 2 * 60 * 1000;
const offerTtlMs = 30 * 1000;
const maximumRadiusMeters = 10_000;

export class DispatchService {
  public constructor(
    private readonly trips: Repository<SyntheticTripRecord>,
    private readonly presences: Repository<DriverDispatchPresenceRecord>,
    private readonly offers: Repository<DispatchOfferRecord>,
    private readonly transaction: Transaction,
    private readonly audit: AuditLog,
    private readonly outbox: Outbox,
    private readonly notificationDelivery: NotificationDelivery,
    private readonly listAvailableTrips: (
      accountId: string,
    ) => Promise<readonly AvailableDriverTripView[]>,
    private readonly acceptTrip: (
      accountId: string,
      tripId: string,
      expectedVersion: number,
      idempotencyKey: string,
    ) => Promise<SyntheticTripView>,
    private readonly setDriverAvailability: (
      accountId: string,
      state: "online" | "offline",
      idempotencyKey: string,
      onlineAuthorization?: DriverOnlineAuthorization,
    ) => Promise<void>,
    private readonly now: () => Date,
  ) {}

  public updatePresence(
    accountId: string,
    state: "online" | "offline",
    location: DriverDispatchLocation | undefined,
    idempotencyKey: string,
    onlineAuthorization?: DriverOnlineAuthorization,
  ): Promise<DriverDispatchPresenceView> {
    return this.transaction.run(async () => {
      const stored = await this.presences.get(accountId);
      const current = stored?.value;
      if (current?.processedKeys.includes(idempotencyKey)) return this.presenceView(current);
      if (state === "online" && !location) throw new Error("VALIDATION_FAILED");
      if (location) this.validateLocation(location);
      await this.setDriverAvailability(
        accountId,
        state,
        `${idempotencyKey}:availability`,
        onlineAuthorization,
      );
      const updatedAt = this.now().toISOString();
      const next: DriverDispatchPresenceRecord = {
        accountId,
        state,
        ...(state === "online" && location
          ? {
              location,
              locationFreshUntil: new Date(
                new Date(location.capturedAt).getTime() + locationFreshnessMs,
              ).toISOString(),
            }
          : {}),
        updatedAt,
        processedKeys: [...(current?.processedKeys ?? []), idempotencyKey],
        synthetic: true,
      };
      const saved = await this.presences.put(accountId, next, stored?.version ?? 0);
      await this.audit.append({
        id: `audit-dispatch-presence-${accountId}-${saved.version}`,
        actorId: accountId,
        action: "driver_dispatch_presence_updated",
        subjectType: "driver_dispatch_presence",
        subjectId: accountId,
        occurredAt: updatedAt,
        outcome: "succeeded",
        reasonCode: state,
        correlationId: idempotencyKey,
        synthetic: true,
      });
      return this.presenceView(saved.value);
    });
  }

  public async listOffers(accountId: string): Promise<DriverDispatchOffersView> {
    await this.processMatchableTrips();
    await this.deliverPendingNotifications();
    const storedPresence = await this.presences.get(accountId);
    if (!storedPresence || storedPresence.value.state === "offline") return this.offersView([]);
    const presence = await this.requireFreshPresence(accountId);
    if (presence.state !== "online") return this.offersView([]);
    const records = await this.offers.list();
    const active: DispatchOfferView[] = [];
    for (const stored of records) {
      if (stored.value.driverAccountId !== accountId) continue;
      if (stored.value.state === "offered" && this.isExpired(stored.value)) {
        await this.offers.put(
          stored.key,
          { ...stored.value, state: "expired" },
          stored.version,
        );
        continue;
      }
      if (stored.value.state === "offered" || stored.value.state === "viewed") {
        active.push(this.offerView(stored.value));
      }
    }
    return this.offersView(active.sort((left, right) => left.distanceMeters - right.distanceMeters));
  }

  public async acceptOffer(
    accountId: string,
    offerId: string,
    expectedTripVersion: number,
    idempotencyKey: string,
  ): Promise<SyntheticTripView> {
    await this.requireFreshPresence(accountId);
    return this.transaction.run(async () => {
      const stored = await this.offers.get(offerId);
      if (!stored) throw new Error("TRIP_OFFER_EXPIRED");
      const offer = stored.value;
      if (offer.driverAccountId !== accountId) throw new Error("TRIP_FORBIDDEN");
      if (offer.processedKeys.includes(idempotencyKey) && offer.state === "accepted") {
        return this.acceptTrip(
          accountId,
          offer.tripId,
          expectedTripVersion,
          idempotencyKey,
        );
      }
      if (!["offered", "viewed"].includes(offer.state) || this.isExpired(offer)) {
        if (offer.state === "offered" || offer.state === "viewed") {
          await this.offers.put(offerId, { ...offer, state: "expired" }, stored.version);
        }
        throw new Error("TRIP_OFFER_EXPIRED");
      }

      const accepted = await this.acceptTrip(
        accountId,
        offer.tripId,
        expectedTripVersion,
        idempotencyKey,
      );
      await this.offers.put(
        offerId,
        {
          ...offer,
          state: "accepted",
          processedKeys: [...offer.processedKeys, idempotencyKey],
        },
        stored.version,
      );
      await this.withdrawCompetingOffers(offer.tripId, offerId, idempotencyKey);
      await this.audit.append({
        id: `audit-dispatch-offer-${offerId}-${accepted.version}`,
        actorId: accountId,
        action: "dispatch_offer_accepted",
        subjectType: "dispatch_offer",
        subjectId: offerId,
        occurredAt: this.now().toISOString(),
        outcome: "succeeded",
        reasonCode: accepted.state,
        correlationId: idempotencyKey,
        synthetic: true,
      });
      return accepted;
    });
  }

  public async processMatchableTrips(limit = 50): Promise<number> {
    const events = await this.outbox.claim(limit, ["trip_matchable"]);
    for (const event of events) {
      try {
        await this.createOffers(event.aggregateId);
        await this.outbox.markPublished(event.eventId, this.now().toISOString());
      } catch {
        await this.outbox.markFailed(
          event.eventId,
          new Date(this.now().getTime() + 5_000).toISOString(),
        );
      }
    }
    return events.length;
  }

  public async deliverPendingNotifications(limit = 100): Promise<number> {
    const events = await this.outbox.claim(limit, ["driver_offer_available"]);
    for (const event of events) {
      const driverAccountId = String(event.payload.driverAccountId ?? "");
      const offerId = String(event.payload.offerId ?? "");
      const tripId = String(event.payload.tripId ?? "");
      if (!driverAccountId || !offerId || !tripId) {
        await this.outbox.markPublished(event.eventId, this.now().toISOString());
        continue;
      }
      await this.notificationDelivery.deliver(driverAccountId, {
        itemId: `dispatch-${offerId}`,
        category: "trip_service",
        title: "附近有新的行程需求",
        body: "请打开车主订单查看仍然有效的接单邀请。",
        occurredAt: event.occurredAt,
        pinned: false,
        target: { kind: "trip", tripId },
        synthetic: true,
      });
      await this.outbox.markPublished(event.eventId, this.now().toISOString());
    }
    return events.length;
  }

  private async createOffers(tripId: string): Promise<void> {
    const trip = await this.trips.get(tripId);
    if (!trip || !["paid_pending_match", "scheduled"].includes(trip.value.state)) return;
    const pickup = syntheticPickupLocation(trip.value);
    for (const presence of await this.presences.list()) {
      if (!this.isFreshOnline(presence.value)) continue;
      const candidates = await this.listAvailableTrips(presence.value.accountId);
      const candidate = candidates.find((item) => item.tripId === tripId);
      if (!candidate || !presence.value.location) continue;
      const distanceMeters = Math.round(distanceBetween(presence.value.location, pickup));
      if (distanceMeters > maximumRadiusMeters) continue;
      const dispatchRound = distanceMeters <= 3_000 ? 1 : distanceMeters <= 6_000 ? 2 : 3;
      const offerId = `offer-${tripId}-${presence.value.accountId}`;
      const existing = await this.offers.get(offerId);
      if (existing) continue;
      const offeredAt = this.now().toISOString();
      const offer: DispatchOfferRecord = {
        offerId,
        tripId,
        tripVersion: trip.version,
        driverAccountId: presence.value.accountId,
        state: "offered",
        dispatchRound,
        distanceMeters,
        offeredAt,
        expiresAt: new Date(this.now().getTime() + offerTtlMs).toISOString(),
        trip: { ...candidate, dispatchOfferId: offerId },
        processedKeys: [],
        synthetic: true,
      };
      try {
        await this.offers.put(offerId, offer, 0);
      } catch (error) {
        if (error instanceof Error && error.message === "STORAGE_CONCURRENT_MODIFICATION") continue;
        throw error;
      }
      await this.outbox.append({
        eventId: `dispatch-notification-${offerId}`,
        aggregateType: "dispatch_offer",
        aggregateId: offerId,
        eventType: "driver_offer_available",
        payload: {
          driverAccountId: presence.value.accountId,
          offerId,
          tripId,
        },
        occurredAt: offeredAt,
        synthetic: true,
      });
    }
  }

  private async withdrawCompetingOffers(
    tripId: string,
    acceptedOfferId: string,
    correlationId: string,
  ): Promise<void> {
    for (const stored of await this.offers.list()) {
      if (
        stored.value.tripId !== tripId ||
        stored.value.offerId === acceptedOfferId ||
        !["offered", "viewed"].includes(stored.value.state)
      ) {
        continue;
      }
      await this.offers.put(
        stored.key,
        { ...stored.value, state: "withdrawn" },
        stored.version,
      );
      await this.outbox.append({
        eventId: `dispatch-withdrawn-${stored.value.offerId}`,
        aggregateType: "dispatch_offer",
        aggregateId: stored.value.offerId,
        eventType: "dispatch_offer_withdrawn",
        payload: {
          driverAccountId: stored.value.driverAccountId,
          offerId: stored.value.offerId,
          tripId,
          correlationId,
        },
        occurredAt: this.now().toISOString(),
        synthetic: true,
      });
    }
  }

  private async requireFreshPresence(accountId: string): Promise<DriverDispatchPresenceRecord> {
    const stored = await this.presences.get(accountId);
    if (!stored || stored.value.state !== "online") throw new Error("DRIVER_NOT_ONLINE");
    if (!this.isFreshOnline(stored.value)) throw new Error("DRIVER_LOCATION_STALE");
    return stored.value;
  }

  private isFreshOnline(presence: DriverDispatchPresenceRecord): boolean {
    return (
      presence.state === "online" &&
      Boolean(presence.location) &&
      Boolean(presence.locationFreshUntil) &&
      new Date(presence.locationFreshUntil!).getTime() >= this.now().getTime()
    );
  }

  private validateLocation(location: DriverDispatchLocation): void {
    if (
      location.synthetic !== true ||
      location.coordinateSystem !== "gcj02" ||
      !Number.isFinite(location.latitude) ||
      location.latitude < -90 ||
      location.latitude > 90 ||
      !Number.isFinite(location.longitude) ||
      location.longitude < -180 ||
      location.longitude > 180 ||
      !Number.isFinite(location.accuracyMeters) ||
      location.accuracyMeters < 0 ||
      location.accuracyMeters > 500
    ) {
      throw new Error("VALIDATION_FAILED");
    }
    const capturedAt = new Date(location.capturedAt).getTime();
    if (!Number.isFinite(capturedAt) || Math.abs(this.now().getTime() - capturedAt) > locationFreshnessMs) {
      throw new Error("DRIVER_LOCATION_STALE");
    }
  }

  private isExpired(offer: DispatchOfferRecord): boolean {
    return new Date(offer.expiresAt).getTime() < this.now().getTime();
  }

  private presenceView(record: DriverDispatchPresenceRecord): DriverDispatchPresenceView {
    return {
      accountId: record.accountId,
      state: record.state,
      ...(record.location ? { location: record.location } : {}),
      ...(record.locationFreshUntil ? { locationFreshUntil: record.locationFreshUntil } : {}),
      updatedAt: record.updatedAt,
      productionEnabled: false,
      realLocationEnabled: false,
      backgroundLocationEnabled: false,
      synthetic: true,
    };
  }

  private offerView(record: DispatchOfferRecord): DispatchOfferView {
    const { processedKeys: _processedKeys, ...view } = record;
    return view;
  }

  private offersView(offers: readonly DispatchOfferView[]): DriverDispatchOffersView {
    return {
      offers,
      serverTime: this.now().toISOString(),
      productionEnabled: false,
      realPushEnabled: false,
      synthetic: true,
    };
  }
}

function syntheticPickupLocation(
  trip: SyntheticTripRecord,
): Readonly<{ latitude: number; longitude: number }> {
  const text = `${trip.tripId}:${trip.originLabel}`;
  let hash = 0;
  for (const character of text) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return {
    latitude: 31.2304 + ((hash % 2001) - 1000) / 100_000,
    longitude: 121.4737 + ((Math.floor(hash / 2001) % 2001) - 1000) / 100_000,
  };
}

function distanceBetween(
  left: Readonly<{ latitude: number; longitude: number }>,
  right: Readonly<{ latitude: number; longitude: number }>,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const leftLatitude = radians(left.latitude);
  const rightLatitude = radians(right.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
