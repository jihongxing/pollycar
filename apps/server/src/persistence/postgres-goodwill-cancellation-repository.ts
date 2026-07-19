import type { GoodwillCancellationRecord } from "../application/goodwill-cancellation-service.js";
import type { Repository, StoredRecord } from "../ports/storage.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

type GoodwillRow = Readonly<{
  record_id: string;
  record_version: number;
  payload: unknown;
}>;

export class PostgresGoodwillCancellationRepository
  implements Repository<GoodwillCancellationRecord>
{
  public constructor(private readonly transaction: PostgresTransaction) {}

  public async get(key: string): Promise<StoredRecord<GoodwillCancellationRecord> | undefined> {
    const result = await this.transaction.currentClient().query<GoodwillRow>(
      `SELECT record_id, record_version, payload
         FROM pollycar_goodwill_cancellations
        WHERE record_id = $1`,
      [key],
    );
    return result.rows[0] ? mapRecord(result.rows[0]) : undefined;
  }

  public async put(
    key: string,
    value: GoodwillCancellationRecord,
    expectedVersion: number,
  ): Promise<StoredRecord<GoodwillCancellationRecord>> {
    return this.transaction.run(async () => {
      if (!value.synthetic) throw new Error("REAL_DATA_FORBIDDEN");
      const result =
        expectedVersion === 0
          ? await this.transaction.currentClient().query<GoodwillRow>(
            `INSERT INTO pollycar_goodwill_cancellations
               (record_id, record_version, account_id, trip_id, actor, record_state, reserved_at, consumed_at, restored_at, idempotency_key, payload, synthetic)
             VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, true)
             ON CONFLICT DO NOTHING
             RETURNING record_id, record_version, payload`,
            [key, value.accountId, value.tripId, value.actor, value.state, value.reservedAt, value.consumedAt ?? null, value.restoredAt ?? null, value.idempotencyKey, JSON.stringify(value)],
            )
          : await this.transaction.currentClient().query<GoodwillRow>(
            `UPDATE pollycar_goodwill_cancellations
                SET record_version = record_version + 1,
                    record_state = $3,
                    consumed_at = $4,
                    restored_at = $5,
                    payload = $6::jsonb,
                    updated_at = now()
              WHERE record_id = $1 AND record_version = $2
              RETURNING record_id, record_version, payload`,
            [key, expectedVersion, value.state, value.consumedAt ?? null, value.restoredAt ?? null, JSON.stringify(value)],
            );
      const row = result.rows[0];
      if (!row) throw new Error("STORAGE_CONCURRENT_MODIFICATION");
      return mapRecord(row);
    });
  }

  public async list(): Promise<readonly StoredRecord<GoodwillCancellationRecord>[]> {
    const result = await this.transaction.currentClient().query<GoodwillRow>(
      `SELECT record_id, record_version, payload
         FROM pollycar_goodwill_cancellations
        ORDER BY reserved_at, record_id`,
    );
    return result.rows.map(mapRecord);
  }
}

function mapRecord(row: GoodwillRow): StoredRecord<GoodwillCancellationRecord> {
  return Object.freeze({
    key: row.record_id,
    version: Number(row.record_version),
    value: row.payload as GoodwillCancellationRecord,
  });
}
