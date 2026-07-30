import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Pool } from "pg";
import { loadProductionReadinessServerConfig } from "@pollycar/configuration";
import { runMigrations } from "./migrations.js";
import { createProductionPoolConnectionString } from "./production-postgres.js";

const config = loadProductionReadinessServerConfig();
const databaseCertificateAuthority = await readFile(
  config.persistence.caCertificatePath,
  "utf8",
);
const pool = new Pool({
  connectionString: createProductionPoolConnectionString(config.persistence.databaseUrl),
  application_name: "pollycar-production-readiness-migrations",
  max: 1,
  connectionTimeoutMillis: config.persistence.connectionTimeoutMilliseconds,
  ssl: {
    ca: databaseCertificateAuthority,
    rejectUnauthorized: true,
  },
});

try {
  const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "../../migrations");
  const applied = await runMigrations(pool, migrationsDirectory);
  console.log(JSON.stringify({
    event: "production_readiness_migrations_completed",
    appliedCount: applied.length,
  }));
} finally {
  await pool.end();
}
