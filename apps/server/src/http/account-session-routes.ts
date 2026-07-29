import type { IncomingMessage, ServerResponse } from "node:http";
import type { AccountIdentityMode } from "@pollycar/contracts";
import type { AccountSessionService } from "../application/account-session-service.js";
import { mapError } from "./error-mapper.js";
import { readJsonObject } from "./http-boundary.js";

export function createAccountSessionHandler(dependencies: Readonly<{
  service: AccountSessionService;
  allowedOrigins: readonly string[];
}>) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith("/v1/internal-sandbox/app/sessions")) return false;
    const correlationId =
      typeof request.headers["x-correlation-id"] === "string"
        ? request.headers["x-correlation-id"]
        : crypto.randomUUID();
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") {
        response.writeHead(204, headers(correlationId));
        response.end();
        return true;
      }
      if (url.pathname === "/v1/internal-sandbox/app/sessions" && request.method === "POST") {
        const body = await readJson(request);
        return send(response, 201, await dependencies.service.create(requireAccountId(body)), correlationId);
      }
      const token = requireSessionToken(request);
      if (url.pathname === "/v1/internal-sandbox/app/sessions/current" && request.method === "GET") {
        const session = await dependencies.service.authenticate(token);
        if (!session) throw new Error("AUTHENTICATION_REQUIRED");
        return send(response, 200, session, correlationId);
      }
      if (url.pathname === "/v1/internal-sandbox/app/sessions/current/identity" && request.method === "POST") {
        const body = await readJson(request);
        return send(
          response,
          200,
          await dependencies.service.switchIdentity(
            token,
            requireIdentity(body),
            requireIdempotencyKey(request),
          ),
          correlationId,
        );
      }
      if (url.pathname === "/v1/internal-sandbox/app/sessions/current/revoke" && request.method === "POST") {
        return send(
          response,
          200,
          await dependencies.service.revoke(token, requireIdempotencyKey(request)),
          correlationId,
        );
      }
      return false;
    } catch (error) {
      const mapped = mapError(error, correlationId);
      return send(response, mapped.status, mapped.body, correlationId);
    }
  };
}

function requireSessionToken(request: IncomingMessage): string {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Session ")) throw new Error("AUTHENTICATION_REQUIRED");
  return authorization.slice("Session ".length);
}

function requireAccountId(body: Record<string, unknown>) {
  const accountId = body.accountId;
  if (
    accountId !== "synthetic-account-7" &&
    accountId !== "synthetic-passenger-8" &&
    accountId !== "synthetic-unverified-9"
  ) {
    throw new Error("VALIDATION_FAILED");
  }
  return accountId;
}

function requireIdentity(body: Record<string, unknown>): AccountIdentityMode {
  if (body.activeIdentity === "passenger" || body.activeIdentity === "driver") {
    return body.activeIdentity;
  }
  throw new Error("VALIDATION_FAILED");
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string" || value.length < 8 || value.length > 128) {
    throw new Error("VALIDATION_FAILED");
  }
  return value;
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return readJsonObject(request);
}

function applyCors(request: IncomingMessage, response: ServerResponse, allowedOrigins: readonly string[]) {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) throw new Error("AUTHORIZATION_DENIED");
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id, X-Request-Id");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function headers(correlationId: string) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Correlation-Id": correlationId,
  };
}

function send(response: ServerResponse, status: number, body: unknown, correlationId: string): true {
  response.writeHead(status, headers(correlationId));
  response.end(JSON.stringify(body));
  return true;
}
