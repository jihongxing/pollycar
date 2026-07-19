import { randomInt } from "node:crypto";
import type {
  AvailableDriverTripView,
  DriverOrderDetail,
  DriverOrderState,
  DriverOrderSummary,
  DriverWalletView,
  PassengerCount,
  PickupVerification,
  TripCancellationEligibility,
  TripCancellationReason,
  TripPartyPublicProfile,
  VehiclePublicSummary,
} from "@pollycar/contracts";
import type { AuditLog } from "../ports/audit.js";
import type { Repository, Transaction } from "../ports/storage.js";
import type { SyntheticTripRecord } from "./synthetic-trip-service.js";
import type { GoodwillCancellationService } from "./goodwill-cancellation-service.js";

export type DriverAvailabilityState = "offline" | "online" | "busy";

export type DriverAvailabilityRecord = Readonly<{
  accountId: string;
  state: DriverAvailabilityState;
  returnOnlineAfterTrip: boolean;
  updatedAt: string;
  processedKeys: readonly string[];
  synthetic: true;
}>;

export type CompletionIntentRecord = Readonly<{
  token: string;
  tripId: string;
  driverAccountId: string;
  tripVersion: number;
  expiresAt: string;
  consumedAt?: string;
  synthetic: true;
}>;

type DriverEligibility = Readonly<{
  quotaPolicy: "base" | "flex";
  maxPassengerCount: PassengerCount;
  vehicle?: VehiclePublicSummary;
}> | undefined;

export class MobilityService {
  public constructor(
    private readonly tripRepository: Repository<SyntheticTripRecord>,
    private readonly availabilityRepository: Repository<DriverAvailabilityRecord>,
    private readonly completionIntentRepository: Repository<CompletionIntentRecord>,
    private readonly transaction: Transaction,
    private readonly audit: AuditLog,
    private readonly driverEligibility: (accountId: string) => Promise<DriverEligibility>,
    private readonly now: () => Date,
    private readonly decoratePublicProfile: (
      profile: TripPartyPublicProfile,
    ) => Promise<TripPartyPublicProfile> = async (profile) => profile,
    private readonly goodwillCancellations?: GoodwillCancellationService,
  ) {}

  public async getAvailability(accountId: string) {
    const record = await this.availabilityRepository.get(accountId);
    return this.availabilityView(record?.value ?? this.defaultAvailability(accountId));
  }

  public setAvailability(
    accountId: string,
    requestedState: "online" | "offline",
    returnOnlineAfterTrip: boolean,
    idempotencyKey: string,
  ) {
    return this.transaction.run(async () => {
      const stored = await this.availabilityRepository.get(accountId);
      const current = stored?.value ?? this.defaultAvailability(accountId);
      if (current.processedKeys.includes(idempotencyKey)) return this.availabilityView(current);
      if (current.state === "busy") throw new Error("DRIVER_AVAILABILITY_BUSY");
      if (requestedState === "online" && !(await this.driverEligibility(accountId))) {
        throw new Error("QUOTA_DRIVER_INELIGIBLE");
      }
      const next: DriverAvailabilityRecord = {
        ...current,
        state: requestedState,
        returnOnlineAfterTrip,
        updatedAt: this.now().toISOString(),
        processedKeys: [...current.processedKeys, idempotencyKey],
      };
      const saved = await this.availabilityRepository.put(accountId, next, stored?.version ?? 0);
      await this.appendAudit(accountId, "driver_availability_changed", accountId, requestedState, idempotencyKey);
      return this.availabilityView(saved.value);
    });
  }

  public async listAvailableTrips(accountId: string): Promise<readonly AvailableDriverTripView[]> {
    const availability = await this.getAvailability(accountId);
    if (availability.state !== "online") return [];
    const eligibility = await this.driverEligibility(accountId);
    if (!eligibility) return [];
    const trips = await this.tripRepository.list();
    const candidates = trips.filter(
        ({ value }) =>
          ["paid_pending_match", "scheduled"].includes(value.state) &&
          value.passengerAccountId !== accountId &&
          value.passengerCount <= eligibility.maxPassengerCount,
      );
    const available = await Promise.all(candidates.map(async ({ value, version }) => ({
        tripId: value.tripId,
        version,
        state: value.state as "paid_pending_match" | "scheduled",
        originLabel: value.originLabel,
        destinationLabel: value.destinationLabel,
        passengerCount: value.passengerCount,
        ...(value.scene ? { scene: value.scene } : {}),
        ...(value.timing ? { timing: value.timing } : {}),
        ...(value.estimatedDurationMinutes
          ? { estimatedDurationMinutes: value.estimatedDurationMinutes }
          : {}),
        passengerProfile: await this.decoratePublicProfile(this.preAcceptancePassenger(
          value.passengerProfile ?? this.syntheticPassenger(value.passengerAccountId),
        )),
        synthetic: true as const,
      })));
    for (const trip of available) {
      await this.appendProfileDisclosureAudit(
        accountId,
        trip.tripId,
        "trip_profile.passenger.pre_acceptance_view",
      );
    }
    return available;
  }

  public async markBusy(accountId: string, idempotencyKey: string, allowLegacyOffline = false): Promise<void> {
    const stored = await this.availabilityRepository.get(accountId);
    const current = stored?.value ?? this.defaultAvailability(accountId);
    if (current.state !== "online" && !(allowLegacyOffline && current.state === "offline")) {
      throw new Error("DRIVER_NOT_ONLINE");
    }
    await this.availabilityRepository.put(
      accountId,
      {
        ...current,
        state: "busy",
        updatedAt: this.now().toISOString(),
        processedKeys: [...current.processedKeys, idempotencyKey],
      },
      stored?.version ?? 0,
    );
  }

  public async releaseDriver(accountId: string, idempotencyKey: string): Promise<void> {
    const stored = await this.availabilityRepository.get(accountId);
    if (!stored) return;
    if (stored.value.processedKeys.includes(idempotencyKey)) return;
    await this.availabilityRepository.put(
      accountId,
      {
        ...stored.value,
        state: stored.value.returnOnlineAfterTrip ? "online" : "offline",
        updatedAt: this.now().toISOString(),
        processedKeys: [...stored.value.processedKeys, idempotencyKey],
      },
      stored.version,
    );
  }

  public async enrichAcceptedTrip(tripId: string, driverAccountId: string): Promise<void> {
    const trip = await this.requireTrip(tripId);
    const eligibility = await this.driverEligibility(driverAccountId);
    if (!eligibility) throw new Error("QUOTA_DRIVER_INELIGIBLE");
    const acceptedAt = trip.value.acceptedAt ?? this.now().toISOString();
    const next: SyntheticTripRecord = {
      ...trip.value,
      passengerProfile: await this.decoratePublicProfile(this.preAcceptancePassenger(
        trip.value.passengerProfile ?? this.syntheticPassenger(trip.value.passengerAccountId),
      )),
      driverProfile: await this.decoratePublicProfile(
        this.postAcceptanceDriver(this.syntheticDriver(driverAccountId)),
      ),
      vehicleProfile: eligibility.vehicle ?? this.syntheticVehicle(driverAccountId, eligibility.maxPassengerCount),
      boardingCode: this.boardingCode(),
      boardingCodeExpiresAt: new Date(new Date(acceptedAt).getTime() + 30 * 60 * 1000).toISOString(),
      boardingCodeFailedAttempts: 0,
    };
    await this.tripRepository.put(tripId, next, trip.version);
    await this.appendProfileDisclosureAudit(
      trip.value.passengerAccountId,
      tripId,
      "trip_profile.driver.post_acceptance_view",
    );
  }

  public async markDriverEnRoute(accountId: string, tripId: string, expectedVersion: number, idempotencyKey: string) {
    return this.updateTrip(accountId, tripId, expectedVersion, ["accepted", "preparing"], idempotencyKey, (current) => ({
      ...current,
      state: "driver_en_route",
      driverEnRouteAt: this.now().toISOString(),
    }), "driver_en_route");
  }

  public async markDriverArrived(accountId: string, tripId: string, expectedVersion: number, idempotencyKey: string) {
    return this.updateTrip(accountId, tripId, expectedVersion, ["driver_en_route"], idempotencyKey, (current) => ({
      ...current,
      state: "driver_arrived",
      driverArrivedAt: this.now().toISOString(),
    }), "driver_arrived");
  }

  public async getPickupVerification(accountId: string, tripId: string): Promise<PickupVerification> {
    const trip = await this.requireTrip(tripId);
    if (trip.value.passengerAccountId !== accountId) throw new Error("TRIP_FORBIDDEN");
    if (!trip.value.boardingCode) throw new Error("TRIP_INVALID_STATE");
    return {
      code: trip.value.boardingCode,
      ...(trip.value.boardingCodeExpiresAt ? { expiresAt: trip.value.boardingCodeExpiresAt } : {}),
      synthetic: true,
    };
  }

  public async verifyBoarding(
    accountId: string,
    tripId: string,
    expectedVersion: number,
    code: string,
    idempotencyKey: string,
  ) {
    return this.transaction.run(async () => {
      const stored = await this.requireTrip(tripId);
      if (stored.value.driverAccountId !== accountId) throw new Error("TRIP_FORBIDDEN");
      if (stored.value.processedKeys.includes(idempotencyKey)) {
        return this.tripView(stored.value, stored.version);
      }
      if (stored.version !== expectedVersion) throw new Error("STORAGE_CONCURRENT_MODIFICATION");
      if (stored.value.state !== "driver_arrived") throw new Error("TRIP_INVALID_STATE");
      if (
        stored.value.boardingCodeLockedUntil &&
        this.now().getTime() < new Date(stored.value.boardingCodeLockedUntil).getTime()
      ) {
        await this.appendDeniedAudit(accountId, "boarding_verification_locked", tripId, idempotencyKey);
        throw new Error("TRIP_BOARDING_CODE_LOCKED");
      }
      if (
        stored.value.boardingCodeExpiresAt &&
        this.now().getTime() >= new Date(stored.value.boardingCodeExpiresAt).getTime()
      ) {
        await this.appendDeniedAudit(accountId, "boarding_verification_expired", tripId, idempotencyKey);
        throw new Error("TRIP_BOARDING_CODE_EXPIRED");
      }
      if (!stored.value.boardingCode || stored.value.boardingCode !== code) {
        const failedAttempts = (stored.value.boardingCodeFailedAttempts ?? 0) + 1;
        const lockedUntil =
          failedAttempts >= 5 ? new Date(this.now().getTime() + 5 * 60 * 1000).toISOString() : undefined;
        await this.tripRepository.put(
          tripId,
          {
            ...stored.value,
            boardingCodeFailedAttempts: failedAttempts,
            ...(lockedUntil ? { boardingCodeLockedUntil: lockedUntil } : {}),
          },
          stored.version,
        );
        await this.appendDeniedAudit(
          accountId,
          lockedUntil ? "boarding_verification_locked" : "boarding_verification_failed",
          tripId,
          idempotencyKey,
        );
        throw new Error(lockedUntil ? "TRIP_BOARDING_CODE_LOCKED" : "TRIP_BOARDING_CODE_INVALID");
      }
      const next: SyntheticTripRecord = {
        ...stored.value,
        state: "in_progress",
        startedAt: this.now().toISOString(),
        boardingCodeFailedAttempts: 0,
        processedKeys: [...stored.value.processedKeys, idempotencyKey],
      };
      const saved = await this.tripRepository.put(tripId, next, stored.version);
      await this.appendAudit(accountId, "boarding_verified", tripId, saved.value.state, idempotencyKey);
      return this.tripView(saved.value, saved.version);
    });
  }

  public async getCancellationEligibility(accountId: string, tripId: string): Promise<TripCancellationEligibility> {
    const trip = await this.requireTrip(tripId);
    const actor =
      trip.value.passengerAccountId === accountId
        ? "passenger"
        : trip.value.driverAccountId === accountId
          ? "driver"
          : undefined;
    if (!actor) throw new Error("TRIP_FORBIDDEN");
    const serverTime = this.now().toISOString();
    const acceptedAt = trip.value.acceptedAt;
    const deadlineAt = acceptedAt
      ? new Date(new Date(acceptedAt).getTime() + 3 * 60 * 1000).toISOString()
      : undefined;
    const eligibleStates =
      actor === "passenger"
        ? ["reserved", "preparing", "accepted", "driver_en_route", "driver_arrived"]
        : ["reserved", "preparing", "accepted", "driver_en_route"];
    const goodwill = this.goodwillCancellations
      ? await this.goodwillCancellations.evaluate(accountId, actor, trip.value.state)
      : undefined;
    return {
      eligible: eligibleStates.includes(String(trip.value.state)) && acceptedAt !== undefined,
      policy: "accepted_cancellation_responsibility",
      mode:
        !eligibleStates.includes(String(trip.value.state))
          ? "not_available"
          : actor === "passenger" && deadlineAt && this.now().getTime() < new Date(deadlineAt).getTime()
            ? "free_window"
            : "responsibility_assessment",
      ...(acceptedAt ? { acceptedAt } : {}),
      ...(deadlineAt ? { deadlineAt } : {}),
      serverTime,
      reasonRequired:
        actor === "driver" ||
        (deadlineAt !== undefined && this.now().getTime() >= new Date(deadlineAt).getTime()),
      noteRequired: false,
      realFeeAmountMinor: 0,
      currency: "CNY",
      determinedByServer: true,
      ...(goodwill ? { goodwill } : {}),
    };
  }

  public async cancelAcceptedTrip(
    accountId: string,
    tripId: string,
    expectedVersion: number,
    idempotencyKey: string,
    reason?: TripCancellationReason,
    note?: string,
  ) {
    if (note && note.length > 200) throw new Error("TRIP_CANCELLATION_NOTE_TOO_LONG");
    const updated = await this.updateTrip(accountId, tripId, expectedVersion, ["reserved", "preparing", "accepted", "driver_en_route", "driver_arrived"], idempotencyKey, (current) => {
      const deadline = new Date(current.acceptedAt!).getTime() + 3 * 60 * 1000;
      if (this.now().getTime() >= deadline) throw new Error("TRIP_CANCELLATION_WINDOW_EXPIRED");
      const cancelledAt = this.now().toISOString();
      return {
        ...current,
        state: "cancelled",
        cancelledAt,
        closureReason: "passenger_cancelled",
        cancellation: {
          ...(reason ? { reason } : {}),
          ...(note ? { note } : {}),
          cancelledAt,
          cancelledBy: "passenger",
          realFeeAmountMinor: 0,
          currency: "CNY",
          withinFreeWindow: true,
          responsibility: "passenger",
          nonFinancialRemedy: "none",
          automaticallyDetermined: true,
        },
      };
    }, "accepted_trip_cancelled", true);
    if (updated.driverAccountId) {
      await this.releaseDriver(updated.driverAccountId, `${idempotencyKey}:release-driver`);
    }
    return updated;
  }

  public async createCompletionIntent(
    accountId: string,
    tripId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ) {
    const trip = await this.requireTrip(tripId);
    if (trip.version !== expectedVersion) throw new Error("STORAGE_CONCURRENT_MODIFICATION");
    if (trip.value.driverAccountId !== accountId) throw new Error("TRIP_FORBIDDEN");
    if (trip.value.state !== "in_progress") throw new Error("TRIP_INVALID_STATE");
    const existing = await this.completionIntentRepository.get(idempotencyKey);
    if (existing) return existing.value;
    const record: CompletionIntentRecord = {
      token: `synthetic-completion-${idempotencyKey}`,
      tripId,
      driverAccountId: accountId,
      tripVersion: expectedVersion,
      expiresAt: new Date(this.now().getTime() + 30_000).toISOString(),
      synthetic: true,
    };
    return (await this.completionIntentRepository.put(idempotencyKey, record, 0)).value;
  }

  public async completeWithIntent(
    accountId: string,
    tripId: string,
    expectedVersion: number,
    token: string,
    idempotencyKey: string,
  ) {
    const intents = await this.completionIntentRepository.list();
    const intent = intents.find(({ value }) => value.token === token);
    if (!intent) throw new Error("TRIP_COMPLETION_INTENT_INVALID");
    if (intent.value.consumedAt) throw new Error("TRIP_COMPLETION_INTENT_CONSUMED");
    if (this.now().getTime() >= new Date(intent.value.expiresAt).getTime()) {
      throw new Error("TRIP_COMPLETION_INTENT_EXPIRED");
    }
    if (
      intent.value.tripId !== tripId ||
      intent.value.driverAccountId !== accountId ||
      intent.value.tripVersion !== expectedVersion
    ) {
      throw new Error("TRIP_COMPLETION_INTENT_INVALID");
    }
    const completed = await this.updateTrip(accountId, tripId, expectedVersion, ["in_progress"], idempotencyKey, (current) => ({
      ...current,
      state: "completed",
      completedAt: this.now().toISOString(),
    }), "trip_completed_with_intent");
    await this.completionIntentRepository.put(
      intent.key,
      { ...intent.value, consumedAt: this.now().toISOString() },
      intent.version,
    );
    await this.releaseDriver(accountId, idempotencyKey);
    return completed;
  }

  public async listDriverOrders(accountId: string, state?: DriverOrderState): Promise<readonly DriverOrderSummary[]> {
    const trips = await this.tripRepository.list();
    return trips
      .filter(({ value }) => value.driverAccountId === accountId)
      .map(({ value }) => this.orderSummary(value))
      .filter((order) => !state || order.state === state)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  }

  public async getDriverOrder(accountId: string, tripId: string): Promise<DriverOrderDetail> {
    const trip = await this.requireTrip(tripId);
    if (trip.value.driverAccountId !== accountId) throw new Error("TRIP_FORBIDDEN");
    const summary = this.orderSummary(trip.value);
    return {
      ...summary,
      timeline: [
        { event: "created", occurredAt: trip.value.createdAt },
        ...(trip.value.acceptedAt ? [{ event: "accepted" as const, occurredAt: trip.value.acceptedAt }] : []),
        ...(trip.value.startedAt ? [{ event: "started" as const, occurredAt: trip.value.startedAt }] : []),
        ...(trip.value.completedAt ? [{ event: "completed" as const, occurredAt: trip.value.completedAt }] : []),
        ...(trip.value.cancelledAt ? [{ event: "cancelled" as const, occurredAt: trip.value.cancelledAt }] : []),
      ],
      realOrderEnabled: false,
      realSettlementEnabled: false,
    };
  }

  public getFinanceOverview(): DriverWalletView {
    return {
      withdrawableAmountMinor: 0,
      pendingSettlementAmountMinor: 0,
      totalIncomeAmountMinor: 0,
      currency: "CNY",
      bankCards: [],
      entries: [],
      withdrawals: [],
      realPaymentEnabled: false,
      realSettlementEnabled: false,
      realBankCardBindingEnabled: false,
      realWithdrawalEnabled: false,
      synthetic: true,
    };
  }

  public getBankCardCapability() {
    return {
      availability: "disabled" as const,
      realPayment: false,
      realDataAccepted: false,
      syntheticCardEntryAllowed: false,
      reason: "external_payment_and_identity_approval_required" as const,
    };
  }

  public getWithdrawalCapability() {
    return {
      availability: "disabled" as const,
      realFunds: false,
      requestAccepted: false,
      reason: "real_payment_gate_closed" as const,
    };
  }

  private async updateTrip(
    accountId: string,
    tripId: string,
    expectedVersion: number,
    allowedStates: readonly string[],
    idempotencyKey: string,
    mutate: (current: SyntheticTripRecord) => SyntheticTripRecord,
    reason: string,
    passengerOnly = false,
  ) {
    return this.transaction.run(async () => {
      const stored = await this.requireTrip(tripId);
      if (passengerOnly) {
        if (stored.value.passengerAccountId !== accountId) throw new Error("TRIP_FORBIDDEN");
      } else if (stored.value.driverAccountId !== accountId) {
        throw new Error("TRIP_FORBIDDEN");
      }
      if (stored.value.processedKeys.includes(idempotencyKey)) return this.tripView(stored.value, stored.version);
      if (stored.version !== expectedVersion) throw new Error("STORAGE_CONCURRENT_MODIFICATION");
      if (!allowedStates.includes(stored.value.state)) throw new Error("TRIP_INVALID_STATE");
      const next = mutate({
        ...stored.value,
        processedKeys: [...stored.value.processedKeys, idempotencyKey],
      });
      const saved = await this.tripRepository.put(tripId, next, stored.version);
      await this.appendAudit(accountId, reason, tripId, saved.value.state, idempotencyKey);
      return this.tripView(saved.value, saved.version);
    });
  }

  private async requireTrip(tripId: string) {
    const trip = await this.tripRepository.get(tripId);
    if (!trip) throw new Error("TRIP_NOT_FOUND");
    return trip;
  }

  private tripView(record: SyntheticTripRecord, version: number) {
    return { ...record, version };
  }

  private orderSummary(record: SyntheticTripRecord): DriverOrderSummary {
    const tripState = String(record.state);
    const state =
      tripState === "paid_pending_match"
        ? "available"
        : tripState === "driver_en_route" || tripState === "driver_arrived"
          ? "accepted"
          : tripState as DriverOrderState;
    return {
      orderId: record.tripId,
      tripId: record.tripId,
      state,
      origin: this.place(`${record.tripId}-origin`, record.originLabel),
      destination: this.place(`${record.tripId}-destination`, record.destinationLabel),
      passengerCount: record.passengerCount,
      amountMinor: 0,
      currency: "CNY",
      occurredAt:
        record.completedAt ?? record.cancelledAt ?? record.startedAt ?? record.acceptedAt ?? record.createdAt,
      synthetic: true,
    };
  }

  private place(placeId: string, label: string) {
    return { placeId, label, kind: "poi" as const, source: "manual" as const, synthetic: true as const };
  }

  private defaultAvailability(accountId: string): DriverAvailabilityRecord {
    return {
      accountId,
      state: "offline",
      returnOnlineAfterTrip: true,
      updatedAt: this.now().toISOString(),
      processedKeys: [],
      synthetic: true,
    };
  }

  private availabilityView(record: DriverAvailabilityRecord) {
    return {
      accountId: record.accountId,
      state: record.state,
      returnOnlineAfterTrip: record.returnOnlineAfterTrip,
      updatedAt: record.updatedAt,
      productionEnabled: false as const,
      synthetic: true as const,
    };
  }

  private syntheticPassenger(accountId: string): TripPartyPublicProfile {
    return {
      accountId,
      displayName: "乘车人",
      avatarUrl: `https://example.invalid/${accountId}.png`,
      gender: "female",
      genderSource: "verified_identity_document",
      genderDisclosure: "eligible_driver_pre_acceptance",
      rating: { average: 5, ratingCount: 1 },
      synthetic: true,
    };
  }

  private syntheticDriver(accountId: string): TripPartyPublicProfile {
    return {
      accountId,
      displayName: "车主",
      avatarUrl: `https://example.invalid/${accountId}.png`,
      gender: "male",
      genderSource: "verified_identity_document",
      genderDisclosure: "matched_passenger_post_acceptance",
      rating: { average: 5, ratingCount: 1 },
      synthetic: true,
    };
  }

  private preAcceptancePassenger(profile: TripPartyPublicProfile): TripPartyPublicProfile {
    return { ...profile, genderDisclosure: "eligible_driver_pre_acceptance" };
  }

  private postAcceptanceDriver(profile: TripPartyPublicProfile): TripPartyPublicProfile {
    return { ...profile, genderDisclosure: "matched_passenger_post_acceptance" };
  }

  private appendProfileDisclosureAudit(actorId: string, tripId: string, action: string) {
    return this.audit.append({
      id: `audit-profile-${tripId}-${actorId}-${action}`,
      occurredAt: this.now().toISOString(),
      actorId,
      action,
      subjectType: "trip_party_profile",
      subjectId: tripId,
      outcome: "succeeded",
      reasonCode: "transaction_stage_disclosure",
      correlationId: `${tripId}-${actorId}-${action}`,
      synthetic: true,
    });
  }

  private syntheticVehicle(accountId: string, maxPassengerCount: PassengerCount): VehiclePublicSummary {
    return {
      vehicleId: `synthetic-vehicle-${accountId}`,
      color: "深空灰",
      make: "合成品牌",
      model: "合成车型",
      licensePlate: "沪A·TEST",
      maxPassengerCount,
      synthetic: true,
    };
  }

  private boardingCode() {
    return String(randomInt(0, 10_000)).padStart(4, "0");
  }

  private appendDeniedAudit(actorId: string, reasonCode: string, subjectId: string, correlationId: string) {
    return this.audit.append({
      id: `${subjectId}:${reasonCode}:${correlationId}`,
      occurredAt: this.now().toISOString(),
      actorId,
      action: "boarding_verification",
      subjectType: "synthetic_trip",
      subjectId,
      outcome: "denied",
      reasonCode,
      correlationId,
      synthetic: true,
    });
  }

  private appendAudit(actorId: string, action: string, subjectId: string, reasonCode: string, correlationId: string) {
    return this.audit.append({
      id: `${subjectId}:${action}:${correlationId}`,
      occurredAt: this.now().toISOString(),
      actorId,
      action,
      subjectType: "synthetic_trip",
      subjectId,
      outcome: "succeeded",
      reasonCode,
      correlationId,
      synthetic: true,
    });
  }
}
