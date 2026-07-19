import type { Repository, StoredRecord } from "../ports/storage.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

type RecordRow = Readonly<{
  record_key: string;
  version: number;
  payload: unknown;
}>;

export class PostgresRepository<TValue> implements Repository<TValue> {
  public constructor(
    private readonly namespace: string,
    private readonly transaction: PostgresTransaction,
  ) {}

  public async get(key: string): Promise<StoredRecord<TValue> | undefined> {
    const result = await this.transaction.currentClient().query<RecordRow>(
      `SELECT record_key, version, payload
         FROM pollycar_records
        WHERE namespace = $1 AND record_key = $2`,
      [this.namespace, key],
    );
    return result.rows[0] ? mapRecord<TValue>(result.rows[0]) : undefined;
  }

  public async put(
    key: string,
    value: TValue,
    expectedVersion: number,
  ): Promise<StoredRecord<TValue>> {
    assertSynthetic(value);
    const nextVersion = expectedVersion + 1;
    const result =
      expectedVersion === 0
        ? await this.transaction.currentClient().query<RecordRow>(
            `INSERT INTO pollycar_records (namespace, record_key, version, payload, synthetic)
             VALUES ($1, $2, $3, $4::jsonb, true)
             ON CONFLICT DO NOTHING
             RETURNING record_key, version, payload`,
            [this.namespace, key, nextVersion, JSON.stringify(value)],
          )
        : await this.transaction.currentClient().query<RecordRow>(
            `UPDATE pollycar_records
                SET version = $4, payload = $5::jsonb, updated_at = now()
              WHERE namespace = $1 AND record_key = $2 AND version = $3
              RETURNING record_key, version, payload`,
            [this.namespace, key, expectedVersion, nextVersion, JSON.stringify(value)],
          );
    const row = result.rows[0];
    if (!row) throw new Error("STORAGE_CONCURRENT_MODIFICATION");
    return mapRecord<TValue>(row);
  }

  public async list(): Promise<readonly StoredRecord<TValue>[]> {
    const result = await this.transaction.currentClient().query<RecordRow>(
      `SELECT record_key, version, payload
         FROM pollycar_records
        WHERE namespace = $1
        ORDER BY record_key`,
      [this.namespace],
    );
    return result.rows.map(mapRecord<TValue>);
  }
}

function mapRecord<TValue>(row: RecordRow): StoredRecord<TValue> {
  return Object.freeze({
    key: row.record_key,
    version: row.version,
    value: row.payload as TValue,
  });
}

function assertSynthetic(value: unknown): void {
  if (
    typeof value !== "object" ||
    value === null ||
    !("synthetic" in value) ||
    value.synthetic !== true
  ) {
    throw new Error("REAL_DATA_FORBIDDEN");
  }
}
