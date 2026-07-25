import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { ProductionConfig } from "../config.js";

export interface ProductionReadinessServer {
  readonly url: string;
  readonly server: Server;
  close(): Promise<void>;
}

export async function startProductionReadinessServer(
  config: ProductionConfig,
  readinessProbe: () => Promise<void>,
): Promise<ProductionReadinessServer> {
  const server = createServer((request, response) => {
    void handleRequest(config, readinessProbe, request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.http.port, config.http.host, () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("PRODUCTION_READINESS_SERVER_ADDRESS_UNAVAILABLE");
  }

  return Object.freeze({
    url: `http://${config.http.host}:${address.port}`,
    server,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  });
}

async function handleRequest(
  config: ProductionConfig,
  readinessProbe: () => Promise<void>,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (config.http.requireForwardedHttps && forwardedProtocol(request) !== "https") {
    send(response, 400, {
      code: "PRODUCTION_HTTPS_PROXY_REQUIRED",
      message: "生产服务必须通过受信 HTTPS 代理访问。",
    });
    return;
  }

  const pathname = new URL(request.url ?? "/", config.http.publicBaseUrl).pathname;
  if (request.method === "GET" && pathname === config.monitoring.healthPaths.live) {
    send(response, 200, {
      status: "live",
      service: config.monitoring.serviceName,
    });
    return;
  }
  if (request.method === "GET" && pathname === config.monitoring.healthPaths.ready) {
    try {
      await readinessProbe();
      send(response, 200, {
        status: "ready",
        service: config.monitoring.serviceName,
      });
    } catch {
      send(response, 503, {
        status: "not_ready",
        service: config.monitoring.serviceName,
      });
    }
    return;
  }

  send(response, 503, {
    code: "PRODUCTION_BUSINESS_CAPABILITIES_DISABLED",
    message: "生产基础设施正在就绪，业务能力尚未开放。",
  });
}

function forwardedProtocol(request: IncomingMessage): string | undefined {
  const header = request.headers["x-forwarded-proto"];
  const value = Array.isArray(header) ? header[0] : header;
  return value?.split(",")[0]?.trim().toLowerCase();
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}
