import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { TransactionalSqlClient } from "./sql-client.js";

export async function runMigrations(
  pool: TransactionalSqlClient,
  directory: string,
): Promise<readonly string[]> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS pollycar_schema_migrations (
       version text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  const files = (await readdir(directory))
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort();
  const applied: string[] = [];
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      const existing = await connection.query(
        "SELECT version FROM pollycar_schema_migrations WHERE version = $1",
        [version],
      ).catch(() => ({ rows: [], rowCount: 0 }));
      if (existing.rowCount === 0) {
        const sql = await readFile(join(directory, file), "utf8");
        await connection.query(sql);
        await connection.query(
          `INSERT INTO pollycar_schema_migrations (version)
           VALUES ($1)
           ON CONFLICT DO NOTHING`,
          [version],
        );
        applied.push(version);
      }
      await connection.query("COMMIT");
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }
  return applied;
}
