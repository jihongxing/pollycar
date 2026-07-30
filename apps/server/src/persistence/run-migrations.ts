import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadSandboxMigrationConfig } from "@pollycar/configuration";
import { Pool } from "pg";
import { runMigrations } from "./migrations.js";

const config = loadSandboxMigrationConfig();

const pool = new Pool({
  connectionString: config.databaseUrl,
  application_name: "pollycar-internal-sandbox-migrations",
  max: 1,
});
try {
  const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "../../migrations");
  const applied = await runMigrations(pool, migrationsDirectory);
  console.log(`数据库迁移完成：${applied.length === 0 ? "无新增迁移" : applied.join(", ")}`);
} finally {
  await pool.end();
}
