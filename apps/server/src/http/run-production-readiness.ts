import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { loadProductionReadinessServerConfig } from "@pollycar/configuration";
import { createProductionPoolConnectionString } from "../persistence/production-postgres.js";
import { startProductionReadinessServer } from "./production-readiness-server.js";

const config = loadProductionReadinessServerConfig();
const databaseCertificateAuthority = await readFile(
  config.persistence.caCertificatePath,
  "utf8",
);
const pool = new Pool({
  connectionString: createProductionPoolConnectionString(config.persistence.databaseUrl),
  max: config.persistence.maximumPoolSize,
  connectionTimeoutMillis: config.persistence.connectionTimeoutMilliseconds,
  ssl: {
    ca: databaseCertificateAuthority,
    rejectUnauthorized: true,
  },
});

const server = await startProductionReadinessServer(config, async () => {
  await pool.query("select 1");
});

console.log(JSON.stringify({
  event: "production_infrastructure_readiness_started",
  service: config.monitoring.serviceName,
  releaseMode: config.releaseMode,
  healthUrl: server.url,
  otlpEndpoint: config.monitoring.otlpEndpoint,
}));

async function shutdown(signal: string): Promise<void> {
  console.log(JSON.stringify({
    event: "production_infrastructure_readiness_stopping",
    signal,
    service: config.monitoring.serviceName,
  }));
  await server.close();
  await pool.end();
  process.exit(0);
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
