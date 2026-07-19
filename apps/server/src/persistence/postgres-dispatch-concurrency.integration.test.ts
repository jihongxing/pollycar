import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { MemoryAuditLog } from "../adapters/memory-audit.js";
import {
  SyntheticTripService,
  type SyntheticTripRecord,
} from "../application/synthetic-trip-service.js";
import { PostgresSyntheticTripRepository } from "./postgres-synthetic-trip-repository.js";
import { PostgresTransaction } from "./postgres-transaction.js";

const databaseUrl = process.env.POLLYCAR_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;
const testPrefix = `dispatch-integration-${Date.now()}`;
const now = new Date("2026-07-13T12:00:00.000Z");

describePostgres("PostgreSQL 派单原子并发", () => {
  const pool = new Pool({
    connectionString: databaseUrl,
    application_name: "pollycar-dispatch-concurrency-test",
    max: 8,
  });

  afterEach(async () => {
    await pool.query(
      `DELETE FROM pollycar_driver_quota_occupancies
        WHERE trip_id LIKE $1`,
      [`${testPrefix}%`],
    );
    await pool.query(
      `DELETE FROM pollycar_idempotency_keys
        WHERE namespace = 'synthetic_trip'
          AND aggregate_id LIKE $1`,
      [`${testPrefix}%`],
    );
    await pool.query(
      `DELETE FROM pollycar_synthetic_trips
        WHERE trip_id LIKE $1`,
      [`${testPrefix}%`],
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it("跨连接并发仍保证订单唯一、车主唯一、预约不重叠和幂等重放", async () => {
    const firstRuntime = createRuntime(pool);
    const secondRuntime = createRuntime(pool);

    const sharedTrip = await seedImmediate(firstRuntime.repository, `${testPrefix}-shared`);
    const sharedResults = await Promise.allSettled([
      firstRuntime.service.accept(
        "postgres-driver-a",
        sharedTrip.value.tripId,
        sharedTrip.version,
        `${testPrefix}-shared-a`,
      ),
      secondRuntime.service.accept(
        "postgres-driver-b",
        sharedTrip.value.tripId,
        sharedTrip.version,
        `${testPrefix}-shared-b`,
      ),
    ]);
    expect(fulfilledCount(sharedResults)).toBe(1);
    expect(rejectedMessages(sharedResults)).toContain("TRIP_ALREADY_ASSIGNED");

    const busyFirst = await seedImmediate(firstRuntime.repository, `${testPrefix}-busy-first`);
    const busySecond = await seedImmediate(firstRuntime.repository, `${testPrefix}-busy-second`);
    const busyResults = await Promise.allSettled([
      firstRuntime.service.accept(
        "postgres-driver-busy",
        busyFirst.value.tripId,
        busyFirst.version,
        `${testPrefix}-busy-a`,
      ),
      secondRuntime.service.accept(
        "postgres-driver-busy",
        busySecond.value.tripId,
        busySecond.version,
        `${testPrefix}-busy-b`,
      ),
    ]);
    expect(fulfilledCount(busyResults)).toBe(1);
    expect(rejectedMessages(busyResults)).toContain("DRIVER_ALREADY_BUSY");

    const scheduledFirst = await seedScheduled(
      firstRuntime.repository,
      `${testPrefix}-scheduled-first`,
      "2026-07-13T14:00:00.000Z",
    );
    const scheduledSecond = await seedScheduled(
      firstRuntime.repository,
      `${testPrefix}-scheduled-second`,
      "2026-07-13T14:30:00.000Z",
    );
    const scheduledResults = await Promise.allSettled([
      firstRuntime.service.accept(
        "postgres-driver-scheduled",
        scheduledFirst.value.tripId,
        scheduledFirst.version,
        `${testPrefix}-scheduled-a`,
      ),
      secondRuntime.service.accept(
        "postgres-driver-scheduled",
        scheduledSecond.value.tripId,
        scheduledSecond.version,
        `${testPrefix}-scheduled-b`,
      ),
    ]);
    expect(fulfilledCount(scheduledResults)).toBe(1);
    expect(rejectedMessages(scheduledResults)).toContain("TRIP_SCHEDULE_CONFLICT");

    const replayTrip = await seedImmediate(firstRuntime.repository, `${testPrefix}-replay`);
    const accepted = await firstRuntime.service.accept(
      "postgres-driver-replay",
      replayTrip.value.tripId,
      replayTrip.version,
      `${testPrefix}-replay-key`,
    );
    const replayed = await secondRuntime.service.accept(
      "postgres-driver-replay",
      replayTrip.value.tripId,
      replayTrip.version,
      `${testPrefix}-replay-key`,
    );
    expect(replayed).toEqual(accepted);
  });
});

function createRuntime(pool: Pool) {
  const transaction = new PostgresTransaction(pool);
  const repository = new PostgresSyntheticTripRepository(transaction);
  return {
    repository,
    service: new SyntheticTripService(
      repository,
      transaction,
      new MemoryAuditLog(),
      async () => ({ quotaPolicy: "flex", maxPassengerCount: 3 }),
      () => now,
    ),
  };
}

function seedImmediate(
  repository: PostgresSyntheticTripRepository,
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

function seedScheduled(
  repository: PostgresSyntheticTripRepository,
  tripId: string,
  startsAt: string,
) {
  const record: SyntheticTripRecord = {
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
      requestedPickupEndsAt: new Date(
        new Date(startsAt).getTime() + 10 * 60 * 1000,
      ).toISOString(),
    },
    estimatedDurationMinutes: 60,
    createdAt: now.toISOString(),
    processedKeys: [],
    synthetic: true,
  };
  return repository.put(tripId, record, 0);
}

function fulfilledCount(results: readonly PromiseSettledResult<unknown>[]): number {
  return results.filter((result) => result.status === "fulfilled").length;
}

function rejectedMessages(results: readonly PromiseSettledResult<unknown>[]): readonly string[] {
  return results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason)
    .filter((reason): reason is Error => reason instanceof Error)
    .map((reason) => reason.message);
}

