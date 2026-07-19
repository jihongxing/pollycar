import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Pool } from "pg";
import { runMigrations } from "./migrations.js";

const connectionString = process.env.POLLYCAR_DATABASE_URL;
if (!connectionString) throw new Error("POLLYCAR_DATABASE_URL_REQUIRED");
if (!connectionString.includes("localhost") && !connectionString.includes("127.0.0.1")) {
  throw new Error("INTERNAL_SANDBOX_DATABASE_MUST_BE_LOCAL");
}

const pool = new Pool({
  connectionString,
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
