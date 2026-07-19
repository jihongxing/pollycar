import type { SyntheticTripRecord } from "../application/synthetic-trip-service.js";
import type { Repository, StoredRecord } from "../ports/storage.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

type TripRow = Readonly<{
  trip_id: string;
  trip_version: number;
  payload: unknown;
}>;

export class PostgresSyntheticTripRepository implements Repository<SyntheticTripRecord> {
  public constructor(private readonly transaction: PostgresTransaction) {}

  public async get(key: string): Promise<StoredRecord<SyntheticTripRecord> | undefined> {
    const result = await this.transaction.currentClient().query<TripRow>(
      `SELECT trip_id, trip_version, payload
         FROM pollycar_synthetic_trips
        WHERE trip_id = $1`,
      [key],
    );
    return result.rows[0] ? mapTrip(result.rows[0]) : undefined;
  }

  public async put(
    key: string,
    value: SyntheticTripRecord,
    expectedVersion: number,
  ): Promise<StoredRecord<SyntheticTripRecord>> {
    return this.transaction.run(async () => {
      if (!value.synthetic) throw new Error("REAL_DATA_FORBIDDEN");
      const nextVersion = expectedVersion + 1;
      const client = this.transaction.currentClient();
      let result;
      try {
        result =
          expectedVersion === 0
            ? await client.query<TripRow>(
            `INSERT INTO pollycar_synthetic_trips
              (trip_id, trip_version, passenger_account_id, driver_account_id, trip_state, quota_policy,
                timing_mode, requested_pickup_starts_at, requested_pickup_ends_at, estimated_duration_minutes,
                driver_occupied_window, payload, synthetic, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::tstzrange, $12::jsonb, true, $13)
             ON CONFLICT DO NOTHING
             RETURNING trip_id, trip_version, payload`,
            [
              key,
              nextVersion,
              value.passengerAccountId,
              value.driverAccountId ?? null,
              value.state,
              value.quotaPolicy ?? null,
              value.timing?.mode ?? "immediate",
              value.timing?.requestedPickupStartsAt ?? null,
              value.timing?.requestedPickupEndsAt ?? null,
              value.estimatedDurationMinutes ?? null,
              driverOccupiedWindow(value),
              JSON.stringify(value),
              value.createdAt,
            ],
            )
          : await client.query<TripRow>(
            `UPDATE pollycar_synthetic_trips
                SET trip_version = $3,
                    driver_account_id = $4,
                    trip_state = $5,
                    quota_policy = $6,
                    timing_mode = $7,
                    requested_pickup_starts_at = $8,
                    requested_pickup_ends_at = $9,
                    estimated_duration_minutes = $10,
                    driver_occupied_window = $11::tstzrange,
                    payload = $12::jsonb,
                    updated_at = now()
              WHERE trip_id = $1 AND trip_version = $2
              RETURNING trip_id, trip_version, payload`,
            [
              key,
              expectedVersion,
              nextVersion,
              value.driverAccountId ?? null,
              value.state,
              value.quotaPolicy ?? null,
              value.timing?.mode ?? "immediate",
              value.timing?.requestedPickupStartsAt ?? null,
              value.timing?.requestedPickupEndsAt ?? null,
              value.estimatedDurationMinutes ?? null,
              driverOccupiedWindow(value),
              JSON.stringify(value),
            ],
            );
      } catch (error) {
        const constraint = postgresConstraint(error);
        if (constraint === "pollycar_synthetic_trips_one_active_immediate_driver") {
          throw new Error("DRIVER_ALREADY_BUSY");
        }
        if (constraint === "pollycar_synthetic_trips_driver_schedule_exclusion") {
          throw new Error("TRIP_SCHEDULE_CONFLICT");
        }
        throw error;
      }
      const row = result.rows[0];
      if (!row) throw new Error("STORAGE_CONCURRENT_MODIFICATION");
      await this.persistIdempotencyKeys(value, nextVersion);
      await this.synchronizeQuota(value);
      return mapTrip(row);
    });
  }

  public async list(): Promise<readonly StoredRecord<SyntheticTripRecord>[]> {
    const result = await this.transaction.currentClient().query<TripRow>(
      `SELECT trip_id, trip_version, payload
         FROM pollycar_synthetic_trips
        ORDER BY created_at, trip_id`,
    );
    return result.rows.map(mapTrip);
  }

  private async persistIdempotencyKeys(value: SyntheticTripRecord, version: number): Promise<void> {
    for (const idempotencyKey of value.processedKeys) {
      const result = await this.transaction.currentClient().query(
        `INSERT INTO pollycar_idempotency_keys
           (namespace, idempotency_key, aggregate_id, aggregate_version, synthetic)
         VALUES ('synthetic_trip', $1, $2, $3, true)
         ON CONFLICT (namespace, idempotency_key) DO UPDATE
           SET aggregate_version = EXCLUDED.aggregate_version
         WHERE pollycar_idempotency_keys.aggregate_id = EXCLUDED.aggregate_id`,
        [idempotencyKey, value.tripId, version],
      );
      if (result.rowCount === 0) throw new Error("CONFLICT_IDEMPOTENCY_KEY_REUSED");
    }
  }

  private async synchronizeQuota(value: SyntheticTripRecord): Promise<void> {
    if (!value.driverAccountId || !value.acceptedAt || !value.quotaPolicy) return;
    const outcome = quotaOutcome(value);
    await this.transaction.currentClient().query(
      `INSERT INTO pollycar_driver_quota_occupancies
         (trip_id, driver_account_id, quota_policy, occupancy_state, occupied_at, released_at, finalized_at, reason, synthetic)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       ON CONFLICT (trip_id) DO UPDATE
         SET occupancy_state = EXCLUDED.occupancy_state,
             released_at = EXCLUDED.released_at,
             finalized_at = EXCLUDED.finalized_at,
             reason = EXCLUDED.reason,
             updated_at = now()`,
      [
        value.tripId,
        value.driverAccountId,
        value.quotaPolicy,
        outcome.state,
        value.acceptedAt,
        outcome.state === "released" ? value.cancelledAt ?? new Date().toISOString() : null,
        outcome.state === "finalized" ? value.completedAt ?? value.cancelledAt ?? new Date().toISOString() : null,
        outcome.reason,
      ],
    );
  }
}

function quotaOutcome(value: SyntheticTripRecord) {
  if (value.state === "completed") return { state: "finalized", reason: "trip_completed" } as const;
  if (value.state !== "cancelled") return { state: "occupied", reason: "trip_accepted" } as const;
  if (
    value.cancellation?.nonFinancialRemedy === "goodwill_cancellation" ||
    value.cancellation?.cancelledBy === "passenger" ||
    value.closureReason === "matching_timeout"
  ) {
    return { state: "released", reason: value.closureReason ?? "goodwill_cancellation" } as const;
  }
  return { state: "finalized", reason: value.closureReason ?? "driver_responsible_cancellation" } as const;
}

function mapTrip(row: TripRow): StoredRecord<SyntheticTripRecord> {
  return Object.freeze({
    key: row.trip_id,
    version: row.trip_version,
    value: row.payload as SyntheticTripRecord,
  });
}

function postgresConstraint(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("constraint" in error)) return undefined;
  return typeof error.constraint === "string" ? error.constraint : undefined;
}

function driverOccupiedWindow(value: SyntheticTripRecord): string | null {
  const startsAt = value.timing?.requestedPickupStartsAt;
  if (value.timing?.mode !== "scheduled" || !startsAt) return null;
  const pickupTime = new Date(startsAt).getTime();
  const occupiedStartsAt = new Date(pickupTime - 30 * 60 * 1000).toISOString();
  const occupiedEndsAt = new Date(
    pickupTime + ((value.estimatedDurationMinutes ?? 60) + 15) * 60 * 1000,
  ).toISOString();
  return `[${occupiedStartsAt},${occupiedEndsAt})`;
}
