import type {
  PassengerCount,
  SyntheticTripDashboard,
  SyntheticTripScene,
  SyntheticTripState,
  SyntheticTripRevision,
  SyntheticTripView,
  TripScheduleNotice,
  TripTiming,
} from "@pollycar/contracts";
import { evaluateQuota } from "@pollycar/domain";
import type { AuditLog } from "../ports/audit.js";
import type { Repository, Transaction } from "../ports/storage.js";
import type { GoodwillCancellationService } from "./goodwill-cancellation-service.js";
import { TripBookingAvailabilityService } from "./trip-booking-availability-service.js";
import { KeyedAcceptanceGate, type AcceptanceGate } from "./acceptance-gate.js";

export type SyntheticTripRecord = Readonly<{
  tripId: string;
  passengerAccountId: string;
  driverAccountId?: string;
  lastReleasedDriverAccountId?: string;
  state: SyntheticTripState;
  originLabel: string;
  destinationLabel: string;
  passengerCount: PassengerCount;
  scene?: SyntheticTripScene;
  timing?: TripTiming;
  estimatedDurationMinutes?: number;
  scheduleNotices?: readonly TripScheduleNotice[];
  createdAt: string;
  acceptedAt?: string;
  driverEnRouteAt?: string;
  driverArrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  closureReason?: "passenger_cancelled" | "driver_cancelled" | "payment_timeout" | "matching_timeout";
  cancellation?: Readonly<{
    reason?: "plans_changed" | "pickup_incorrect" | "wait_too_long" | "driver_or_vehicle_concern" | "other";
    note?: string;
    cancelledAt: string;
    cancelledBy: "passenger" | "driver" | "system";
    realFeeAmountMinor: 0;
    currency: "CNY";
    withinFreeWindow: boolean;
    responsibility: "passenger" | "driver" | "platform" | "shared" | "manual_review";
    nonFinancialRemedy: "none" | "priority_rematch" | "driver_quota_exemption" | "goodwill_cancellation" | "manual_review";
    automaticallyDetermined: true;
    goodwill?: Readonly<{
      recordId: string;
      actor: "passenger" | "driver";
      state: "consumed";
      consumedAt: string;
      synthetic: true;
    }>;
  }>;
  passengerProfile?: Readonly<{
    accountId: string;
    displayName: string;
    avatarUrl?: string;
    gender: "female" | "male";
    genderSource: "verified_identity_document";
    genderDisclosure: "eligible_driver_pre_acceptance" | "matched_passenger_post_acceptance";
    synthetic: true;
  }>;
  driverProfile?: Readonly<{
    accountId: string;
    displayName: string;
    avatarUrl?: string;
    gender: "female" | "male";
    genderSource: "verified_identity_document";
    genderDisclosure: "eligible_driver_pre_acceptance" | "matched_passenger_post_acceptance";
    synthetic: true;
  }>;
  vehicleProfile?: Readonly<{
    vehicleId: string;
    color: string;
    make: string;
    model: string;
    licensePlate: string;
    maxPassengerCount: PassengerCount;
    synthetic: true;
  }>;
  boardingCode?: string;
  boardingCodeExpiresAt?: string;
  boardingCodeFailedAttempts?: number;
  boardingCodeLockedUntil?: string;
  recovery?: Readonly<{
    state: "driver_acceptance_released" | "cancellation_confirmed" | "timeout_closed";
    recoveredAt: string;
    source?: "idempotency_replay" | "state_reconciliation" | "timeout_worker";
  }>;
  quotaPolicy?: "base" | "flex";
  processedKeys: readonly string[];
  synthetic: true;
}>;

export class SyntheticTripService {
  public constructor(
    private readonly repository: Repository<SyntheticTripRecord>,
    private readonly transaction: Transaction,
    private readonly audit: AuditLog,
    private readonly driverEligibility: (
      accountId: string,
    ) => Promise<
      Readonly<{ quotaPolicy: "base" | "flex"; maxPassengerCount: PassengerCount }> | undefined
    >,
    private readonly now: () => Date,
    private readonly releaseDriver: (accountId: string, idempotencyKey: string) => Promise<void> = async () => {},
    private readonly isInternalTimeoutExecutor: (accountId: string) => boolean = () => false,
    private readonly goodwillCancellations?: GoodwillCancellationService,
    private readonly listQuotaHistory?: (
      accountId: string,
    ) => Promise<readonly Readonly<{ occurredAt: Date }>[]> ,
    private readonly bookingAvailability = new TripBookingAvailabilityService(now),
    private readonly acceptanceGate: AcceptanceGate = new KeyedAcceptanceGate(),
  ) {}

  public getBookingAvailability() {
    return this.bookingAvailability.getAvailability();
  }

  public async dashboard(accountId: string): Promise<SyntheticTripDashboard> {
    await this.reconcileScheduleStates();
    const trips = await this.repository.list();
    const eligibility = await this.driverEligibility(accountId);
    const passengerTrips = trips
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.value.passengerAccountId === accountId)
      .sort(
        (left, right) =>
          new Date(right.item.value.createdAt).getTime() -
            new Date(left.item.value.createdAt).getTime() ||
          right.index - left.index,
      )
      .map(({ item }) => item);
    const passengerTrip = passengerTrips[0];
    const activeDriverTrip = trips.find(
      (item) =>
        item.value.driverAccountId === accountId &&
        ["preparing", "accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(
          item.value.state,
        ),
    );
    return {
      ...(passengerTrip ? { passengerTrip: this.toView(passengerTrip.value, passengerTrip.version) } : {}),
      passengerTrips: passengerTrips.map((item) => this.toView(item.value, item.version)),
      availableDriverTrips: trips
        .filter(
          (item) =>
            ["paid_pending_match", "scheduled"].includes(item.value.state) &&
            item.value.passengerAccountId !== accountId &&
            eligibility !== undefined &&
            item.value.passengerCount <= eligibility.maxPassengerCount,
        )
        .map((item) => this.toView(item.value, item.version)),
      reservedDriverTrips: trips
        .filter(
          (item) =>
            item.value.driverAccountId === accountId &&
            item.value.state === "reserved",
        )
        .map((item) => this.toView(item.value, item.version)),
      ...(activeDriverTrip
        ? { activeDriverTrip: this.toView(activeDriverTrip.value, activeDriverTrip.version) }
        : {}),
      productionEnabled: false,
      realPayment: false,
      shanghaiPilot: false,
    };
  }

  public async create(
    accountId: string,
    input: Readonly<{
      tripId: string;
      originLabel: string;
      destinationLabel: string;
      passengerCount?: PassengerCount;
      scene?: SyntheticTripScene;
      timing?: TripTiming;
      estimatedDurationMinutes?: number;
      idempotencyKey: string;
    }>,
  ): Promise<SyntheticTripView> {
    return this.transaction.run(async () => {
      const timing = this.bookingAvailability.validate(
        input.timing ?? {
          mode: "immediate",
          timezone: "Asia/Shanghai",
          selectionSource: "immediate",
        },
      );
      const record: SyntheticTripRecord = {
        tripId: input.tripId,
        passengerAccountId: accountId,
        state: "pending_payment",
        originLabel: input.originLabel,
        destinationLabel: input.destinationLabel,
        passengerCount: input.passengerCount ?? 1,
        ...(input.scene ? { scene: input.scene } : {}),
        timing,
        ...(input.estimatedDurationMinutes
          ? { estimatedDurationMinutes: Math.max(1, Math.min(240, input.estimatedDurationMinutes)) }
          : {}),
        ...(timing.mode === "scheduled"
          ? {
              scheduleNotices: this.createScheduleNotices(timing),
            }
          : {}),
        createdAt: this.now().toISOString(),
        processedKeys: [input.idempotencyKey],
        synthetic: true,
      };
      const saved = await this.repository.put(input.tripId, record, 0);
      await this.appendAudit(record, saved.version, accountId, "synthetic_trip_created", input.idempotencyKey);
      return this.toView(saved.value, saved.version);
    });
  }

  public payZeroMoney(
    accountId: string,
    tripId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<SyntheticTripView> {
    return this.update(accountId, tripId, expectedVersion, idempotencyKey, "pending_payment", (current) => {
      if (current.passengerAccountId !== accountId) throw new Error("TRIP_FORBIDDEN");
      return {
        ...current,
        state: current.timing?.mode === "scheduled" ? "scheduled" : "paid_pending_match",
      };
    }, "zero_money_payment_completed");
  }

  public reschedule(
    accountId: string,
    tripId: string,
    expectedVersion: number,
    idempotencyKey: string,
    revision: SyntheticTripRevision,
  ): Promise<SyntheticTripView> {
    return this.update(
      accountId,
      tripId,
      expectedVersion,
      idempotencyKey,
      "scheduled",
      (current) => {
        if (current.passengerAccountId !== accountId) throw new Error("TRIP_FORBIDDEN");
        const validated = this.bookingAvailability.validate(revision.timing);
        if (validated.mode !== "scheduled") throw new Error("TRIP_PICKUP_TIME_INVALID");
        if (revision.originLabel !== undefined && !revision.originLabel.trim()) {
          throw new Error("VALIDATION_FAILED");
        }
        if (revision.destinationLabel !== undefined && !revision.destinationLabel.trim()) {
          throw new Error("VALIDATION_FAILED");
        }
        if (
          revision.estimatedDurationMinutes !== undefined &&
          (!Number.isInteger(revision.estimatedDurationMinutes) ||
            revision.estimatedDurationMinutes < 1 ||
            revision.estimatedDurationMinutes > 240)
        ) {
          throw new Error("VALIDATION_FAILED");
        }
        const currentWithoutClearedScene =
          revision.scene === null ? withoutScene(current) : current;
        return {
          ...currentWithoutClearedScene,
          ...(revision.originLabel !== undefined
            ? { originLabel: revision.originLabel.trim() }
            : {}),
          ...(revision.destinationLabel !== undefined
            ? { destinationLabel: revision.destinationLabel.trim() }
            : {}),
          ...(revision.passengerCount !== undefined
            ? { passengerCount: revision.passengerCount }
            : {}),
          ...(revision.scene !== undefined && revision.scene !== null
            ? { scene: revision.scene }
            : {}),
          timing: validated,
          ...(revision.estimatedDurationMinutes !== undefined
            ? { estimatedDurationMinutes: revision.estimatedDurationMinutes }
            : {}),
          scheduleNotices: this.createScheduleNotices(validated),
        };
      },
      "synthetic_trip_rescheduled",
    );
  }

  public async accept(
    accountId: string,
    tripId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<SyntheticTripView> {
    return this.acceptanceGate.run([`driver:${accountId}`, `trip:${tripId}`], async () => {
      try {
        return await this.transaction.run(async () => {
          const stored = await this.repository.get(tripId);
          if (!stored) throw new Error("TRIP_NOT_FOUND");
          if (stored.value.passengerAccountId === accountId) {
            throw new Error("TRIP_SELF_ACCEPT_FORBIDDEN");
          }
          if (stored.value.processedKeys.includes(idempotencyKey)) {
            if (stored.value.driverAccountId !== accountId) throw new Error("TRIP_FORBIDDEN");
            return this.toView(stored.value, stored.version);
          }
          if (stored.value.driverAccountId && stored.value.driverAccountId !== accountId) {
            throw new Error("TRIP_ALREADY_ASSIGNED");
          }
          if (!["paid_pending_match", "scheduled"].includes(stored.value.state)) {
            if (stored.value.state === "pending_payment") throw new Error("TRIP_PAYMENT_REQUIRED");
            if (stored.value.driverAccountId && stored.value.driverAccountId !== accountId) {
              throw new Error("TRIP_ALREADY_ASSIGNED");
            }
            throw new Error("TRIP_INVALID_STATE");
          }

          const eligibility = await this.driverEligibility(accountId);
          if (!eligibility) throw new Error("QUOTA_DRIVER_INELIGIBLE");
          const allTrips = await this.repository.list();
          if (stored.value.timing?.mode !== "scheduled") {
            const activeImmediateTrip = allTrips.find(
              ({ value }) =>
                value.tripId !== tripId &&
                value.driverAccountId === accountId &&
                value.timing?.mode !== "scheduled" &&
                isBlockingImmediateTrip(value, this.now()),
            );
            if (activeImmediateTrip) throw new Error("DRIVER_ALREADY_BUSY");
          }

          const history = this.listQuotaHistory
            ? await this.listQuotaHistory(accountId)
            : allTrips
                .filter(
                  (item) =>
                    item.value.driverAccountId === accountId &&
                    (item.value.completedAt ||
                      (item.value.acceptedAt && item.value.state !== "cancelled")),
                )
                .map((item) => ({
                  occurredAt: new Date(item.value.completedAt ?? item.value.acceptedAt!),
                }));
          const quota = evaluateQuota(eligibility.quotaPolicy, history, this.now());
          if (!quota.ok) throw new Error(quota.errorCode);
          if (stored.value.timing?.mode === "scheduled") {
            await this.assertNoScheduleConflict(accountId, stored.value);
          }
          if (stored.value.passengerCount > eligibility.maxPassengerCount) {
            throw new Error("TRIP_PASSENGER_CAPACITY_EXCEEDED");
          }

          const next: SyntheticTripRecord = {
            ...stored.value,
            state: stored.value.timing?.mode === "scheduled" ? "reserved" : "accepted",
            driverAccountId: accountId,
            acceptedAt: this.now().toISOString(),
            quotaPolicy: eligibility.quotaPolicy,
            processedKeys: [...stored.value.processedKeys, idempotencyKey],
            ...(stored.value.timing?.mode === "scheduled"
              ? {
                  scheduleNotices: (stored.value.scheduleNotices ?? []).map((notice) =>
                    notice.kind === "accepted" ? { ...notice, delivered: true } : notice,
                  ),
                }
              : {}),
          };
          const saved = await this.repository.put(tripId, next, expectedVersion);
          await this.appendAudit(
            saved.value,
            saved.version,
            accountId,
            "synthetic_trip_accepted",
            idempotencyKey,
          );
          return this.toView(saved.value, saved.version);
        });
      } catch (error) {
        if (error instanceof Error && error.message === "STORAGE_CONCURRENT_MODIFICATION") {
          const latest = await this.repository.get(tripId);
          if (
            latest &&
            latest.value.driverAccountId &&
            latest.value.driverAccountId !== accountId
          ) {
            throw new Error("TRIP_ALREADY_ASSIGNED");
          }
        }
        throw error;
      }
    });
  }

  public start(
    accountId: string,
    tripId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<SyntheticTripView> {
    return this.updateAny(accountId, tripId, expectedVersion, idempotencyKey, ["reserved", "preparing", "accepted", "driver_en_route", "driver_arrived"], (current) => {
      if (current.driverAccountId !== accountId) throw new Error("TRIP_FORBIDDEN");
      if (current.timing?.mode === "scheduled") {
        const startsAt = new Date(current.timing.requestedPickupStartsAt!).getTime();
        if (this.now().getTime() < startsAt - 30 * 60 * 1000) {
          throw new Error("TRIP_SCHEDULE_NOT_READY");
        }
      }
      return { ...current, state: "in_progress", startedAt: this.now().toISOString() };
    }, "synthetic_trip_started");
  }

  public complete(
    accountId: string,
    tripId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<SyntheticTripView> {
    return this.update(accountId, tripId, expectedVersion, idempotencyKey, "in_progress", (current) => {
      if (current.driverAccountId !== accountId) throw new Error("TRIP_FORBIDDEN");
      return { ...current, state: "completed", completedAt: this.now().toISOString() };
    }, "synthetic_trip_completed");
  }

  public async cancel(
    accountId: string,
    tripId: string,
    expectedVersion: number,
    idempotencyKey: string,
    reason?: "plans_changed" | "pickup_incorrect" | "wait_too_long" | "driver_or_vehicle_concern" | "other",
    note?: string,
  ): Promise<SyntheticTripView> {
    const before = await this.repository.get(tripId);
    if (!before) throw new Error("TRIP_NOT_FOUND");
    if (
      before.value.processedKeys.includes(idempotencyKey) &&
      (before.value.passengerAccountId === accountId ||
        before.value.driverAccountId === accountId ||
        before.value.lastReleasedDriverAccountId === accountId)
    ) {
      return this.toView(before.value, before.version);
    }
    const actor =
      before.value.passengerAccountId === accountId
        ? "passenger"
        : before.value.driverAccountId === accountId
          ? "driver"
          : undefined;
    if (!actor) throw new Error("TRIP_FORBIDDEN");
    const withinFreeWindow =
      actor === "passenger" &&
      (!["accepted", "reserved", "preparing"].includes(before.value.state) ||
        !before.value.acceptedAt ||
        this.now().getTime() < new Date(before.value.acceptedAt).getTime() + 3 * 60 * 1000);
    if (!withinFreeWindow && !reason) throw new Error("TRIP_CANCELLATION_REASON_REQUIRED");
    const goodwillEligible =
      this.goodwillCancellations !== undefined &&
      !withinFreeWindow &&
      reason === "plans_changed" &&
      ["accepted", "reserved", "preparing", "driver_en_route"].includes(before.value.state)
        ? await this.goodwillCancellations.evaluate(accountId, actor, before.value.state)
        : undefined;
    const goodwill = goodwillEligible?.eligible
      ? await this.goodwillCancellations?.reserve(
          accountId,
          tripId,
          actor,
          before.value.state,
          idempotencyKey,
        )
      : undefined;
    try {
      const reopensScheduledMatching =
        actor === "driver" &&
        before.value.timing?.mode === "scheduled" &&
        ["reserved", "preparing"].includes(before.value.state);
      const result = await this.updateAny(
        accountId,
        tripId,
        expectedVersion,
        idempotencyKey,
        ["pending_payment", "paid_pending_match", "scheduled", "reserved", "preparing", "accepted", "driver_en_route"],
        (current) => {
          if (note && note.length > 200) throw new Error("TRIP_CANCELLATION_NOTE_TOO_LONG");
          const assessment = cancellationAssessment(
            reason,
            current.state,
            withinFreeWindow,
            actor,
            Boolean(goodwill),
          );
          const cancelledAt = this.now().toISOString();
          if (reopensScheduledMatching) {
            const {
              driverAccountId: _driverAccountId,
              acceptedAt: _acceptedAt,
              driverEnRouteAt: _driverEnRouteAt,
              driverArrivedAt: _driverArrivedAt,
              quotaPolicy: _quotaPolicy,
              ...released
            } = current;
            return {
              ...released,
              state: "scheduled",
              lastReleasedDriverAccountId: accountId,
              scheduleNotices: (current.scheduleNotices ?? []).map((notice) =>
                notice.kind === "accepted" || notice.kind === "unmatched"
                  ? { ...notice, delivered: notice.kind === "unmatched" }
                  : notice,
              ),
              recovery: {
                state: "driver_acceptance_released",
                recoveredAt: cancelledAt,
                source: "state_reconciliation",
              },
            };
          }
          return {
            ...current,
            state: "cancelled",
            cancelledAt,
            closureReason: actor === "passenger" ? "passenger_cancelled" : "driver_cancelled",
            cancellation: {
              ...(reason ? { reason } : {}),
              ...(note ? { note } : {}),
              cancelledAt,
              cancelledBy: actor,
              realFeeAmountMinor: 0,
              currency: "CNY",
              withinFreeWindow,
              ...assessment,
              automaticallyDetermined: true,
              ...(goodwill
                ? {
                    goodwill: {
                      recordId: goodwill.recordId,
                      actor,
                      state: "consumed" as const,
                      consumedAt: cancelledAt,
                      synthetic: true as const,
                    },
                  }
                : {}),
            },
            recovery: {
              state: "cancellation_confirmed",
              recoveredAt: cancelledAt,
              source: "state_reconciliation",
            },
          };
        },
        reopensScheduledMatching ? "synthetic_trip_driver_released" : "synthetic_trip_cancelled",
      );
      if (goodwill?.state === "reserved") {
        await this.goodwillCancellations?.transition(goodwill.recordId, "consumed");
      }
      if (
        actor === "passenger" &&
        before.value.driverAccountId &&
        !before.value.processedKeys.includes(idempotencyKey)
      ) {
        await this.releaseDriver(before.value.driverAccountId, `${idempotencyKey}:release-driver`);
      }
      return result;
    } catch (error) {
      if (goodwill?.state === "reserved") {
        await this.goodwillCancellations?.transition(goodwill.recordId, "restored");
      }
      throw error;
    }
  }

  public async reconcileTimeout(
    accountId: string,
    tripId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<SyntheticTripView> {
    const before = await this.repository.get(tripId);
    if (!before) throw new Error("TRIP_NOT_FOUND");
    const participant =
      before.value.passengerAccountId === accountId || before.value.driverAccountId === accountId;
    if (!participant && !this.isInternalTimeoutExecutor(accountId)) throw new Error("TRIP_FORBIDDEN");
    const result = await this.updateAny(
      accountId,
      tripId,
      expectedVersion,
      idempotencyKey,
      ["pending_payment", "paid_pending_match", "scheduled", "reserved", "preparing", "accepted"],
      (current) => {
        const elapsedMs = this.now().getTime() - new Date(current.acceptedAt ?? current.createdAt).getTime();
        if (["accepted", "reserved", "preparing"].includes(current.state)) {
          if (elapsedMs < 15 * 60 * 1000) throw new Error("TRIP_TIMEOUT_NOT_REACHED");
          const {
            driverAccountId: _driverAccountId,
            acceptedAt: _acceptedAt,
            quotaPolicy: _quotaPolicy,
            ...released
          } = current;
          return {
            ...released,
            state: current.timing?.mode === "scheduled" ? "scheduled" : "paid_pending_match",
            recovery: {
              state: "driver_acceptance_released",
              recoveredAt: this.now().toISOString(),
            },
          };
        }
        if (current.state === "scheduled") {
          const endsAt = new Date(current.timing?.requestedPickupEndsAt ?? current.createdAt).getTime();
          if (this.now().getTime() <= endsAt) throw new Error("TRIP_TIMEOUT_NOT_REACHED");
          return {
            ...current,
            state: "unfulfilled",
            closureReason: "matching_timeout",
            recovery: {
              state: "timeout_closed",
              recoveredAt: this.now().toISOString(),
              source: "timeout_worker",
            },
          };
        }
        const timeoutMs = current.state === "pending_payment" ? 15 * 60 * 1000 : 30 * 60 * 1000;
        if (elapsedMs < timeoutMs) throw new Error("TRIP_TIMEOUT_NOT_REACHED");
        return {
          ...current,
          state: "cancelled",
          cancelledAt: this.now().toISOString(),
          closureReason: current.state === "pending_payment" ? "payment_timeout" : "matching_timeout",
          recovery: {
            state: "timeout_closed",
            recoveredAt: this.now().toISOString(),
            source: "timeout_worker",
          },
        };
      },
      "synthetic_trip_timeout_reconciled",
    );
    if (result.recovery?.state === "driver_acceptance_released" && before.value.driverAccountId) {
      await this.releaseDriver(before.value.driverAccountId, `${idempotencyKey}:release-driver`);
    }
    return result;
  }

  private async update(
    actorId: string,
    tripId: string,
    expectedVersion: number,
    idempotencyKey: string,
    requiredState: SyntheticTripState,
    update: (current: SyntheticTripRecord) => SyntheticTripRecord,
    action: string,
  ): Promise<SyntheticTripView> {
    return this.transaction.run(async () => {
      const stored = await this.repository.get(tripId);
      if (!stored) throw new Error("TRIP_NOT_FOUND");
      this.authorizeBeforeIdempotency(actorId, stored.value, action);
      if (stored.value.processedKeys.includes(idempotencyKey)) return this.toView(stored.value, stored.version);
      if (stored.version !== expectedVersion) throw new Error("STORAGE_CONCURRENT_MODIFICATION");
      if (stored.value.state !== requiredState) {
        if (requiredState === "paid_pending_match" && stored.value.state === "pending_payment") {
          throw new Error("TRIP_PAYMENT_REQUIRED");
        }
        throw new Error("TRIP_INVALID_STATE");
      }
      const next = update(stored.value);
      const saved = await this.repository.put(
        tripId,
        { ...next, processedKeys: [...next.processedKeys, idempotencyKey] },
        expectedVersion,
      );
      await this.appendAudit(saved.value, saved.version, actorId, action, idempotencyKey);
      return this.toView(saved.value, saved.version);
    });
  }

  private async updateAny(
    actorId: string,
    tripId: string,
    expectedVersion: number,
    idempotencyKey: string,
    allowedStates: readonly SyntheticTripState[],
    update: (current: SyntheticTripRecord) => SyntheticTripRecord,
    action: string,
  ): Promise<SyntheticTripView> {
    return this.transaction.run(async () => {
      const stored = await this.repository.get(tripId);
      if (!stored) throw new Error("TRIP_NOT_FOUND");
      this.authorizeBeforeIdempotency(actorId, stored.value, action);
      if (stored.value.processedKeys.includes(idempotencyKey)) return this.toView(stored.value, stored.version);
      if (stored.version !== expectedVersion) throw new Error("STORAGE_CONCURRENT_MODIFICATION");
      if (!allowedStates.includes(stored.value.state)) throw new Error("TRIP_INVALID_STATE");
      const next = update(stored.value);
      const saved = await this.repository.put(
        tripId,
        { ...next, processedKeys: [...next.processedKeys, idempotencyKey] },
        expectedVersion,
      );
      await this.appendAudit(saved.value, saved.version, actorId, action, idempotencyKey);
      return this.toView(saved.value, saved.version);
    });
  }

  private appendAudit(
    record: SyntheticTripRecord,
    version: number,
    actorId: string,
    action: string,
    correlationId: string,
  ) {
    return this.audit.append({
      id: `audit-trip-${record.tripId}-${version}`,
      occurredAt: this.now().toISOString(),
      actorId,
      action,
      subjectType: "synthetic_trip",
      subjectId: record.tripId,
      outcome: "succeeded",
      reasonCode: record.state,
      correlationId,
      synthetic: true,
    });
  }

  private authorizeBeforeIdempotency(
    actorId: string,
    record: SyntheticTripRecord,
    action: string,
  ): void {
    if (action === "synthetic_trip_accepted") {
      if (record.passengerAccountId === actorId) throw new Error("TRIP_SELF_ACCEPT_FORBIDDEN");
      if (record.driverAccountId && record.driverAccountId !== actorId) {
        throw new Error("TRIP_FORBIDDEN");
      }
      return;
    }
    if (
      action === "zero_money_payment_completed" ||
      action === "synthetic_trip_rescheduled" ||
      action === "synthetic_trip_cancelled"
    ) {
      if (record.passengerAccountId !== actorId && record.driverAccountId !== actorId) {
        throw new Error("TRIP_FORBIDDEN");
      }
      return;
    }
    if (
      action === "synthetic_trip_started" ||
      action === "synthetic_trip_completed"
    ) {
      if (record.driverAccountId !== actorId) throw new Error("TRIP_FORBIDDEN");
      return;
    }
    if (action === "synthetic_trip_timeout_reconciled") {
      const participant =
        record.passengerAccountId === actorId || record.driverAccountId === actorId;
      if (!participant && !this.isInternalTimeoutExecutor(actorId)) throw new Error("TRIP_FORBIDDEN");
    }
  }

  private toView(record: SyntheticTripRecord, version: number): SyntheticTripView {
    const paymentState =
      record.state === "pending_payment"
        ? "pending_payment"
        : record.state === "completed" || record.state === "cancelled" || record.state === "unfulfilled"
          ? "closed"
          : "paid_pending_match";
    return {
      tripId: record.tripId,
      passengerAccountId: record.passengerAccountId,
      ...(record.driverAccountId ? { driverAccountId: record.driverAccountId } : {}),
      state: record.state,
      version,
      originLabel: record.originLabel,
      destinationLabel: record.destinationLabel,
      passengerCount: record.passengerCount,
      ...(record.scene ? { scene: record.scene } : {}),
      timing: record.timing ?? {
        mode: "immediate",
        timezone: "Asia/Shanghai",
        selectionSource: "immediate",
      },
      ...(record.estimatedDurationMinutes
        ? { estimatedDurationMinutes: record.estimatedDurationMinutes }
        : {}),
      ...(record.scheduleNotices ? { scheduleNotices: record.scheduleNotices } : {}),
      payment: { amountMinor: 0, currency: "CNY", realPayment: false, state: paymentState },
      ...(record.quotaPolicy ? { quotaPolicy: record.quotaPolicy } : {}),
      createdAt: record.createdAt,
      ...(record.acceptedAt ? { acceptedAt: record.acceptedAt } : {}),
      ...(record.startedAt ? { startedAt: record.startedAt } : {}),
      ...(record.completedAt ? { completedAt: record.completedAt } : {}),
      ...(record.cancelledAt ? { cancelledAt: record.cancelledAt } : {}),
      ...(record.closureReason ? { closureReason: record.closureReason } : {}),
      ...(record.cancellation ? { cancellation: record.cancellation } : {}),
      recovery: record.recovery ?? { state: "none" },
      synthetic: true,
    };
  }

  private async assertNoScheduleConflict(
    driverAccountId: string,
    candidate: SyntheticTripRecord,
  ): Promise<void> {
    if (candidate.timing?.mode !== "scheduled") return;
    const candidateWindow = occupiedWindow(candidate);
    const conflict = (await this.repository.list()).some(({ value }) => {
      if (
        value.driverAccountId !== driverAccountId ||
        value.timing?.mode !== "scheduled" ||
        !["reserved", "preparing", "driver_en_route", "driver_arrived", "in_progress"].includes(
          value.state,
        )
      ) {
        return false;
      }
      const currentWindow = occupiedWindow(value);
      return (
        candidateWindow.startsAt < currentWindow.endsAt &&
        currentWindow.startsAt < candidateWindow.endsAt
      );
    });
    if (conflict) throw new Error("TRIP_SCHEDULE_CONFLICT");
  }

  private async reconcileScheduleStates(): Promise<void> {
    const now = this.now().getTime();
    for (const stored of await this.repository.list()) {
      const timing = stored.value.timing;
      if (timing?.mode !== "scheduled") continue;
      const startsAt = new Date(timing.requestedPickupStartsAt!).getTime();
      const endsAt = new Date(timing.requestedPickupEndsAt!).getTime();
      let nextState: SyntheticTripState | undefined;
      if (stored.value.state === "reserved" && now >= startsAt - 30 * 60 * 1000) {
        nextState = "preparing";
      } else if (stored.value.state === "scheduled" && now > endsAt) {
        nextState = "unfulfilled";
      }
      const scheduleNotices = (stored.value.scheduleNotices ?? []).map((notice) => ({
        ...notice,
        delivered: notice.delivered || new Date(notice.dueAt).getTime() <= now,
      }));
      const noticesChanged = scheduleNotices.some(
        (notice, index) =>
          notice.delivered !== stored.value.scheduleNotices?.[index]?.delivered,
      );
      if (!nextState && !noticesChanged) continue;
      try {
        const next = {
          ...stored.value,
          ...(nextState ? { state: nextState } : {}),
          scheduleNotices,
        };
        await this.repository.put(stored.key, next, stored.version);
      } catch (error) {
        if (!(error instanceof Error && error.message === "STORAGE_CONCURRENT_MODIFICATION")) {
          throw error;
        }
      }
    }
  }

  private createScheduleNotices(timing: TripTiming): readonly TripScheduleNotice[] {
    const startsAt = new Date(timing.requestedPickupStartsAt!).getTime();
    const createdAt = this.now().getTime();
    const notices: TripScheduleNotice[] = [
      { kind: "created", dueAt: new Date(createdAt).toISOString(), delivered: true },
      { kind: "accepted", dueAt: new Date(createdAt).toISOString(), delivered: false },
      { kind: "two_hours", dueAt: new Date(startsAt - 2 * 60 * 60 * 1000).toISOString(), delivered: false },
      { kind: "thirty_minutes", dueAt: new Date(startsAt - 30 * 60 * 1000).toISOString(), delivered: false },
      { kind: "unmatched", dueAt: new Date(startsAt - 30 * 60 * 1000).toISOString(), delivered: false },
    ];
    if (startsAt - createdAt > 24 * 60 * 60 * 1000) {
      notices.push({
        kind: "day_before",
        dueAt: new Date(startsAt - 24 * 60 * 60 * 1000).toISOString(),
        delivered: false,
      });
    }
    return notices;
  }
}

function occupiedWindow(record: SyntheticTripRecord) {
  const startsAt = new Date(record.timing!.requestedPickupStartsAt!).getTime();
  const endsAt = new Date(record.timing!.requestedPickupEndsAt!).getTime();
  return {
    startsAt: startsAt - 20 * 60 * 1000,
    endsAt:
      endsAt +
      (record.estimatedDurationMinutes ?? 45) * 60 * 1000 +
      15 * 60 * 1000,
  };
}

function isBlockingImmediateTrip(record: SyntheticTripRecord, now: Date): boolean {
  if (["driver_en_route", "driver_arrived", "in_progress", "safety_frozen"].includes(record.state)) {
    return true;
  }
  if (record.state !== "accepted" || !record.acceptedAt) return false;
  return now.getTime() < new Date(record.acceptedAt).getTime() + 15 * 60 * 1000;
}

function withoutScene(record: SyntheticTripRecord): SyntheticTripRecord {
  const { scene: _scene, ...recordWithoutScene } = record;
  return recordWithoutScene;
}

function cancellationAssessment(
  reason: "plans_changed" | "pickup_incorrect" | "wait_too_long" | "driver_or_vehicle_concern" | "other" | undefined,
  state: SyntheticTripState,
  withinFreeWindow: boolean,
  actor: "passenger" | "driver",
  goodwillUsed: boolean,
) {
  if (goodwillUsed) {
    return { responsibility: actor, nonFinancialRemedy: "goodwill_cancellation" as const };
  }
  if (withinFreeWindow) {
    return { responsibility: "passenger" as const, nonFinancialRemedy: "none" as const };
  }
  if (actor === "driver") {
    return { responsibility: "driver" as const, nonFinancialRemedy: "priority_rematch" as const };
  }
  if (reason === "driver_or_vehicle_concern") {
    return { responsibility: "driver" as const, nonFinancialRemedy: "priority_rematch" as const };
  }
  if (reason === "wait_too_long") {
    return state === "driver_arrived"
      ? { responsibility: "passenger" as const, nonFinancialRemedy: "driver_quota_exemption" as const }
      : { responsibility: "driver" as const, nonFinancialRemedy: "priority_rematch" as const };
  }
  if (reason === "pickup_incorrect") {
    return { responsibility: "shared" as const, nonFinancialRemedy: "priority_rematch" as const };
  }
  if (reason === "plans_changed") {
    return { responsibility: "passenger" as const, nonFinancialRemedy: "driver_quota_exemption" as const };
  }
  return { responsibility: "manual_review" as const, nonFinancialRemedy: "manual_review" as const };
}
