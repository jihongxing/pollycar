import type { IncomingMessage, ServerResponse } from "node:http";
import type { SafetyCaseService } from "../application/safety-case-service.js";
import { mapError } from "./error-mapper.js";
import { createSafetyRequestContext } from "./request-context.js";

export function createAdminSafetyHandler(dependencies: Readonly<{
  service: SafetyCaseService;
  allowedOrigins: readonly string[];
}>) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith("/v1/internal-sandbox/admin/safety-cases")) return false;
    const correlationId =
      typeof request.headers["x-correlation-id"] === "string"
        ? request.headers["x-correlation-id"]
        : crypto.randomUUID();
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") return send(response, 204, undefined, correlationId);
      const context = createSafetyRequestContext(request);
      if (request.method === "GET" && url.pathname === "/v1/internal-sandbox/admin/safety-cases") {
        return send(response, 200, await dependencies.service.listForSafetyOfficer(), context.correlationId);
      }
      const match = url.pathname.match(/^\/v1\/internal-sandbox\/admin\/safety-cases\/([^/]+)(?:\/resolution)?$/);
      if (!match) return false;
      const caseId = decodeURIComponent(match[1]!);
      if (request.method === "GET" && !url.pathname.endsWith("/resolution")) {
        return send(response, 200, await dependencies.service.getForSafetyOfficer(caseId), context.correlationId);
      }
      if (request.method === "POST" && url.pathname.endsWith("/resolution")) {
        const body = await readJson(request);
        const outcome = body.outcome;
        if (outcome !== "restore_access" && outcome !== "uphold_freeze") throw new Error("VALIDATION_FAILED");
        return send(
          response,
          200,
          await dependencies.service.resolveForSafetyOfficer(
            caseId,
            requireVersion(body),
            outcome,
            requireIdempotencyKey(request),
          ),
          context.correlationId,
        );
      }
      return false;
    } catch (error) {
      const mapped = mapError(error, correlationId);
      return send(response, mapped.status, mapped.body, correlationId);
    }
  };
}

function applyCors(request: IncomingMessage, response: ServerResponse, allowedOrigins: readonly string[]) {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) throw new Error("AUTHORIZATION_DENIED");
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id, X-Request-Id");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function send(response: ServerResponse, status: number, body: unknown, correlationId: string): true {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Correlation-Id": correlationId,
  });
  response.end(body === undefined ? undefined : JSON.stringify(body));
  return true;
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new Error("VALIDATION_FAILED");
  }
}

function requireVersion(body: Record<string, unknown>): number {
  if (!Number.isInteger(body.expectedVersion) || (body.expectedVersion as number) < 0) throw new Error("VALIDATION_FAILED");
  return body.expectedVersion as number;
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string" || value.length < 8 || value.length > 128) throw new Error("VALIDATION_FAILED");
  return value;
}
