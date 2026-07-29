import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { TransactionalSqlClient } from "./sql-client.js";

const migrationLockName = "pollycar_schema_migrations";

export async function runMigrations(
  pool: TransactionalSqlClient,
  directory: string,
): Promise<readonly string[]> {
  const connection = await pool.connect();
  try {
    await connection.query(
      "SELECT pg_advisory_lock(hashtext($1))",
      [migrationLockName],
    );
    await connection.query(
      `CREATE TABLE IF NOT EXISTS pollycar_schema_migrations (
         version text PRIMARY KEY,
         checksum text,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    await connection.query(
      "ALTER TABLE pollycar_schema_migrations ADD COLUMN IF NOT EXISTS checksum text",
    );
    const files = (await readdir(directory))
      .filter((file) => /^\d+.*\.sql$/.test(file))
      .sort();
    const applied: string[] = [];
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const sql = await readFile(join(directory, file), "utf8");
      const checksum = sha256(sql);
      await connection.query("BEGIN");
      try {
        const existing = await connection.query<{
          version: string;
          checksum: string | null;
        }>(
        "SELECT version, checksum FROM pollycar_schema_migrations WHERE version = $1",
        [version],
        );
        const recorded = existing.rows[0];
        if (recorded?.checksum && recorded.checksum !== checksum) {
          throw new Error(`MIGRATION_CHECKSUM_MISMATCH:${version}`);
        }
        if (!recorded) {
          await connection.query(sql);
          await connection.query(
            `INSERT INTO pollycar_schema_migrations (version, checksum)
             VALUES ($1, $2)`,
            [version, checksum],
          );
          applied.push(version);
        } else if (!recorded.checksum) {
          await connection.query(
            "UPDATE pollycar_schema_migrations SET checksum = $2 WHERE version = $1",
            [version, checksum],
          );
        }
        await connection.query("COMMIT");
      } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
      }
    }
    return applied;
  } finally {
    await connection.query(
      "SELECT pg_advisory_unlock(hashtext($1))",
      [migrationLockName],
    ).catch(() => undefined);
    connection.release();
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
