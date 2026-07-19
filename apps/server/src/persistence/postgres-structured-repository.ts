import type { Repository, StoredRecord } from "../ports/storage.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

type RecordRow = Readonly<{ record_key: string; version: number; payload: unknown }>;

const allowedTables = new Set([
  "pollycar_trip_chats",
  "pollycar_message_centers",
  "pollycar_location_lifecycle",
  "pollycar_identity_verifications",
  "pollycar_safety_cases",
  "pollycar_temporary_chats",
  "pollycar_phone_accounts",
  "pollycar_phone_challenges",
  "pollycar_auth_devices",
  "pollycar_refresh_sessions",
  "pollycar_account_sessions",
  "pollycar_driver_dispatch_presence",
  "pollycar_dispatch_offers",
]);

export class PostgresStructuredRepository<TValue> implements Repository<TValue> {
  public constructor(
    private readonly table: string,
    private readonly transaction: PostgresTransaction,
  ) {
    if (!allowedTables.has(table)) throw new Error("POSTGRES_TABLE_NOT_ALLOWED");
  }

  public async get(key: string): Promise<StoredRecord<TValue> | undefined> {
    const result = await this.transaction.currentClient().query<RecordRow>(
      `SELECT record_key, version, payload FROM ${this.table} WHERE record_key = $1`,
      [key],
    );
    return result.rows[0] ? mapRecord<TValue>(result.rows[0]) : undefined;
  }

  public async put(key: string, value: TValue, expectedVersion: number): Promise<StoredRecord<TValue>> {
    assertSynthetic(value);
    const nextVersion = expectedVersion + 1;
    const result = expectedVersion === 0
      ? await this.transaction.currentClient().query<RecordRow>(
          `INSERT INTO ${this.table} (record_key, version, payload, synthetic)
           VALUES ($1, $2, $3::jsonb, true)
           ON CONFLICT DO NOTHING
           RETURNING record_key, version, payload`,
          [key, nextVersion, JSON.stringify(value)],
        )
      : await this.transaction.currentClient().query<RecordRow>(
          `UPDATE ${this.table}
              SET version = $3, payload = $4::jsonb, updated_at = now()
            WHERE record_key = $1 AND version = $2
            RETURNING record_key, version, payload`,
          [key, expectedVersion, nextVersion, JSON.stringify(value)],
        );
    const row = result.rows[0];
    if (!row) throw new Error("STORAGE_CONCURRENT_MODIFICATION");
    return mapRecord<TValue>(row);
  }

  public async list(): Promise<readonly StoredRecord<TValue>[]> {
    const result = await this.transaction.currentClient().query<RecordRow>(
      `SELECT record_key, version, payload FROM ${this.table} ORDER BY record_key`,
    );
    return result.rows.map(mapRecord<TValue>);
  }
}

function mapRecord<TValue>(row: RecordRow): StoredRecord<TValue> {
  return Object.freeze({ key: row.record_key, version: row.version, value: row.payload as TValue });
}

function assertSynthetic(value: unknown): void {
  if (typeof value !== "object" || value === null || !("synthetic" in value) || value.synthetic !== true) {
    throw new Error("REAL_DATA_FORBIDDEN");
  }
}
