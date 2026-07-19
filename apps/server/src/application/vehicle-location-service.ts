import type {
  GeoPoint,
  VehicleLocationStage,
  VehicleLocationUpdate,
  VehicleLocationView,
} from "@pollycar/contracts";
import type { AuditLog } from "../ports/audit.js";
import type { Repository } from "../ports/storage.js";
import { validateGeoPoint } from "../adapters/synthetic-map-provider.js";

export type VehicleLocationRecord = Readonly<{
  tripId: string;
  driverAccountId: string;
  stage: VehicleLocationStage;
  latest?: VehicleLocationUpdate;
  receivedAt?: string;
  evidenceHold: boolean;
  closedAt?: string;
  deletedAt?: string;
  processedKeys: readonly string[];
  synthetic: true;
}>;

export class VehicleLocationService {
  public constructor(
    private readonly records: Repository<VehicleLocationRecord>,
    private readonly audit: AuditLog,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async setStage(
    tripId: string,
    driverAccountId: string,
    stage: VehicleLocationStage,
  ): Promise<VehicleLocationView> {
    const stored = await this.records.get(tripId);
    const closed = stage === "closed";
    const value: VehicleLocationRecord = {
      tripId,
      driverAccountId,
      stage,
      ...(closed ? {} : stored?.value.latest ? { latest: stored.value.latest } : {}),
      ...(closed ? {} : stored?.value.receivedAt ? { receivedAt: stored.value.receivedAt } : {}),
      evidenceHold: stored?.value.evidenceHold ?? false,
      ...(closed ? { closedAt: this.now().toISOString() } : {}),
      processedKeys: stored?.value.processedKeys ?? [],
      synthetic: true,
    };
    await this.records.put(tripId, value, stored?.version ?? 0);
    if (closed) await this.auditSummary(value, "vehicle_location_stream_stopped", "TRIP_CLOSED");
    return this.toView(value);
  }

  public async upload(
    accountId: string,
    update: VehicleLocationUpdate,
    idempotencyKey: string,
  ): Promise<VehicleLocationView> {
    validateGeoPoint(update.location);
    if (update.accountId !== accountId) throw new Error("VEHICLE_LOCATION_FORBIDDEN");
    if (!Number.isFinite(update.accuracyMeters) || update.accuracyMeters < 3 || update.accuracyMeters > 500) {
      throw new Error("VEHICLE_LOCATION_ACCURACY_INVALID");
    }
    const stored = await this.records.get(update.tripId);
    if (!stored || stored.value.driverAccountId !== accountId) throw new Error("VEHICLE_LOCATION_FORBIDDEN");
    if (stored.value.stage === "closed") throw new Error("VEHICLE_LOCATION_STREAM_STOPPED");
    const processedKey = `${accountId}:${idempotencyKey}`;
    if (stored.value.processedKeys.includes(processedKey)) return this.toView(stored.value);
    const interval = intervalFor(stored.value.stage);
    if (stored.value.receivedAt) {
      const elapsed = Date.parse(update.capturedAt) - Date.parse(stored.value.receivedAt);
      if (elapsed < interval * 1_000) throw new Error("VEHICLE_LOCATION_TOO_FREQUENT");
    }
    if (stored.value.latest && update.sequence <= stored.value.latest.sequence) {
      throw new Error("VEHICLE_LOCATION_SEQUENCE_INVALID");
    }
    const capturedAt = Date.parse(update.capturedAt);
    if (!Number.isFinite(capturedAt) || Math.abs(this.now().getTime() - capturedAt) > 120_000) {
      throw new Error("VEHICLE_LOCATION_TIMESTAMP_INVALID");
    }
    const minimized = minimize(update);
    const value: VehicleLocationRecord = {
      ...stored.value,
      latest: minimized,
      receivedAt: this.now().toISOString(),
      processedKeys: [...stored.value.processedKeys, processedKey],
    };
    await this.records.put(update.tripId, value, stored.version);
    return this.toView(value);
  }

  public async get(accountId: string, tripId: string): Promise<VehicleLocationView> {
    const stored = await this.records.get(tripId);
    if (!stored || stored.value.deletedAt) return unavailable(this.now, "trip_not_active");
    if (stored.value.driverAccountId !== accountId && !accountId.startsWith("synthetic-passenger")) {
      throw new Error("VEHICLE_LOCATION_FORBIDDEN");
    }
    return this.toView(stored.value);
  }

  public async setEvidenceHold(tripId: string, enabled: boolean): Promise<void> {
    const stored = await this.records.get(tripId);
    if (!stored) return;
    await this.records.put(tripId, { ...stored.value, evidenceHold: enabled }, stored.version);
    await this.auditSummary(
      stored.value,
      enabled ? "vehicle_location_evidence_hold_applied" : "vehicle_location_evidence_hold_released",
      enabled ? "SAFETY_EVIDENCE" : "HOLD_RELEASED",
    );
  }

  public async purgeExpired(retentionMilliseconds = 60 * 60_000): Promise<Readonly<{
    deleted: number;
    blockedByHold: number;
  }>> {
    let deleted = 0;
    let blockedByHold = 0;
    for (const stored of await this.records.list()) {
      if (!stored.value.closedAt || this.now().getTime() - Date.parse(stored.value.closedAt) < retentionMilliseconds) continue;
      if (stored.value.evidenceHold) {
        blockedByHold += 1;
        continue;
      }
      const { latest: _latest, receivedAt: _receivedAt, ...summary } = stored.value;
      await this.records.put(stored.key, {
        ...summary,
        deletedAt: this.now().toISOString(),
      }, stored.version);
      deleted += 1;
      await this.auditSummary(stored.value, "vehicle_location_data_deleted", "RETENTION_EXPIRED");
    }
    return { deleted, blockedByHold };
  }

  private toView(record: VehicleLocationRecord): VehicleLocationView {
    if (record.stage === "closed") return unavailable(this.now, "trip_closed");
    const interval = intervalFor(record.stage);
    if (!record.latest || !record.receivedAt) {
      return {
        freshness: "unavailable",
        receivedAt: this.now().toISOString(),
        uploadIntervalSeconds: interval,
        stopped: false,
        realLocationEnabled: false,
        synthetic: true,
      };
    }
    const ageSeconds = Math.max(0, Math.floor((this.now().getTime() - Date.parse(record.receivedAt)) / 1_000));
    return {
      ...(ageSeconds < 60 ? { update: record.latest } : {}),
      freshness: ageSeconds >= 60 ? "unavailable" : ageSeconds >= 30 ? "stale" : ageSeconds >= 15 ? "aging" : "fresh",
      receivedAt: record.receivedAt,
      nextUploadAllowedAt: new Date(Date.parse(record.receivedAt) + interval * 1_000).toISOString(),
      uploadIntervalSeconds: interval,
      stopped: false,
      realLocationEnabled: false,
      synthetic: true,
    };
  }

  private async auditSummary(record: VehicleLocationRecord, action: string, reasonCode: string): Promise<void> {
    await this.audit.append({
      id: crypto.randomUUID(),
      occurredAt: this.now().toISOString(),
      actorId: "location-lifecycle",
      action,
      subjectType: "vehicle_location_summary",
      subjectId: record.tripId,
      outcome: "succeeded",
      reasonCode,
      correlationId: `${record.stage}:${record.latest?.sequence ?? 0}`,
      synthetic: true,
    });
  }
}

function intervalFor(stage: VehicleLocationStage): 3 | 5 | 10 {
  if (stage === "in_progress") return 3;
  if (stage === "driver_arrived") return 5;
  return 10;
}

function minimize(update: VehicleLocationUpdate): VehicleLocationUpdate {
  return {
    ...update,
    location: {
      latitude: Number(update.location.latitude.toFixed(5)),
      longitude: Number(update.location.longitude.toFixed(5)),
      coordinateSystem: update.location.coordinateSystem,
    },
    accuracyMeters: Math.round(update.accuracyMeters),
    ...(update.speedMetersPerSecond === undefined
      ? {}
      : { speedMetersPerSecond: Number(update.speedMetersPerSecond.toFixed(1)) }),
    ...(update.headingDegrees === undefined
      ? {}
      : { headingDegrees: Math.round(update.headingDegrees / 5) * 5 }),
  };
}

function unavailable(
  now: () => Date,
  reason: NonNullable<VehicleLocationView["stopReason"]>,
): VehicleLocationView {
  return {
    freshness: "unavailable",
    receivedAt: now().toISOString(),
    uploadIntervalSeconds: 10,
    stopped: true,
    stopReason: reason,
    realLocationEnabled: false,
    synthetic: true,
  };
}
