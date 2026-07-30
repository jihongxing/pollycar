import type { IncomingMessage, ServerResponse } from "node:http";
import type { FreeFlexTrialService } from "../application/free-flex-trial-service.js";
import { createAppRequestContext, createRequestContext } from "./request-context.js";
import { mapError } from "./error-mapper.js";
import { readJsonObject } from "./http-boundary.js";

export function createFreeFlexTrialHandler(dependencies: Readonly<{
  service: FreeFlexTrialService;
  allowedOrigins: readonly string[];
}>) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!isFreeFlexTrialPath(url.pathname)) return false;
    const correlationId =
      typeof request.headers["x-correlation-id"] === "string"
        ? request.headers["x-correlation-id"]
        : crypto.randomUUID();
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") {
        response.writeHead(204, commonHeaders(correlationId));
        response.end();
        return true;
      }
      if (url.pathname === "/v1/internal-sandbox/app/free-flex-trial") {
        const context = await createAppRequestContext(request);
        if (request.method === "GET") {
          return send(response, 200, await dependencies.service.get(context.accountId), context.correlationId);
        }
        if (request.method === "POST") {
          const body = await readJson(request);
          return send(
            response,
            200,
            await dependencies.service.submit(
              context.accountId,
              requireVersion(body),
              requireIdempotencyKey(request),
            ),
            context.correlationId,
          );
        }
      }
      if (url.pathname === "/v1/internal-sandbox/app/free-flex-trial/confirmation") {
        const context = await createAppRequestContext(request);
        if (request.method === "POST") {
          const body = await readJson(request);
          return send(
            response,
            200,
            await dependencies.service.confirmAndActivate(
              context.accountId,
              requireVersion(body),
              requireIdempotencyKey(request),
            ),
            context.correlationId,
          );
        }
      }
      if (url.pathname === "/v1/internal-sandbox/admin/free-flex-trial/approval") {
        const context = createRequestContext(request);
        if (request.method === "POST") {
          const body = await readJson(request);
          return send(
            response,
            200,
            await dependencies.service.approve(
              requireString(body, "accountId"),
              requireVersion(body),
              requireIdempotencyKey(request),
            ),
            context.correlationId,
          );
        }
      }
      return false;
    } catch (error) {
      const mapped = mapError(error, correlationId);
      return send(response, mapped.status, mapped.body, correlationId);
    }
  };
}

function isFreeFlexTrialPath(pathname: string): boolean {
  return (
    pathname === "/v1/internal-sandbox/app/free-flex-trial" ||
    pathname === "/v1/internal-sandbox/app/free-flex-trial/confirmation" ||
    pathname === "/v1/internal-sandbox/admin/free-flex-trial/approval"
  );
}

function applyCors(
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: readonly string[],
): void {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) throw new Error("AUTHORIZATION_DENIED");
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id",
  );
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function commonHeaders(correlationId: string): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Correlation-Id": correlationId,
  };
}

function send(response: ServerResponse, status: number, body: unknown, correlationId: string): true {
  response.writeHead(status, commonHeaders(correlationId));
  response.end(JSON.stringify(body));
  return true;
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return readJsonObject(request);
}

function requireVersion(body: Record<string, unknown>): number {
  const value = body.expectedVersion;
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error("VALIDATION_FAILED");
  return value as number;
}

function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || value.length < 1 || value.length > 128) {
    throw new Error("VALIDATION_FAILED");
  }
  return value;
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string" || value.length < 8 || value.length > 128) {
    throw new Error("VALIDATION_FAILED");
  }
  return value;
}

