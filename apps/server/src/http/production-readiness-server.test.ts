import { request } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createProductionConfig } from "../config.js";
import {
  startProductionReadinessServer,
  type ProductionReadinessServer,
} from "./production-readiness-server.js";
import type { ProductionConfig } from "../config.js";

const environment = {
  POLLYCAR_PRODUCTION_DATABASE_URL:
    "postgresql://pollycar@db.pollycar.example:5432/pollycar?sslmode=require",
  POLLYCAR_PRODUCTION_DATABASE_CA_PATH: "/run/secrets/postgres-ca.crt",
  POLLYCAR_PRODUCTION_PUBLIC_BASE_URL: "https://api.pollycar.example",
  POLLYCAR_PRODUCTION_ALLOWED_ORIGINS: "https://app.pollycar.example",
  POLLYCAR_SECRET_PROVIDER_REFERENCE: "vault://pollycar/production",
  POLLYCAR_OTLP_ENDPOINT: "https://otel.pollycar.example",
  POLLYCAR_PRODUCTION_HOST: "127.0.0.1",
};

const servers: ProductionReadinessServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("生产基础设施就绪服务", () => {
  it("只公开 HTTPS 代理后的存活和就绪检查", async () => {
    const server = await startProductionReadinessServer(
      createTestConfig(),
      async () => undefined,
    );
    servers.push(server);

    await expect(get(server, "/health/live")).resolves.toMatchObject({
      status: 200,
      body: {
        status: "live",
        service: "pollycar-server",
      },
    });
    await expect(get(server, "/health/ready")).resolves.toMatchObject({
      status: 200,
      body: {
        status: "ready",
      },
    });
    await expect(get(server, "/v1/trips")).resolves.toMatchObject({
      status: 503,
      body: {
        code: "PRODUCTION_BUSINESS_CAPABILITIES_DISABLED",
      },
    });
  });

  it("拒绝绕过 HTTPS 代理，并在 PostgreSQL 未就绪时返回不可用", async () => {
    const server = await startProductionReadinessServer(
      createTestConfig(),
      async () => {
        throw new Error("database unavailable");
      },
    );
    servers.push(server);

    await expect(get(server, "/health/live", false)).resolves.toMatchObject({
      status: 400,
      body: {
        code: "PRODUCTION_HTTPS_PROXY_REQUIRED",
      },
    });
    await expect(get(server, "/health/ready")).resolves.toMatchObject({
      status: 503,
      body: {
        status: "not_ready",
      },
    });
  });
});

function get(
  server: ProductionReadinessServer,
  path: string,
  forwardedHttps = true,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const url = new URL(server.url);
  return new Promise((resolve, reject) => {
    const httpRequest = request({
      host: url.hostname,
      port: url.port,
      path,
      method: "GET",
      headers: forwardedHttps ? { "x-forwarded-proto": "https" } : {},
    }, (response) => {
      let raw = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        raw += chunk;
      });
      response.on("end", () => {
        resolve({
          status: response.statusCode ?? 0,
          body: JSON.parse(raw) as Record<string, unknown>,
        });
      });
    });
    httpRequest.once("error", reject);
    httpRequest.end();
  });
}

function createTestConfig(): ProductionConfig {
  const config = createProductionConfig(environment);
  return Object.freeze({
    ...config,
    http: Object.freeze({
      ...config.http,
      port: 0,
    }),
  });
}
