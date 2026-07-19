import type { IncomingMessage, ServerResponse } from "node:http";
import type { SafetyCaseView } from "@pollycar/contracts";
import type { SafetyCaseService } from "../application/safety-case-service.js";
import { createAppRequestContext, createSafetyRequestContext } from "./request-context.js";
import { mapError } from "./error-mapper.js";

export function createSafetyCaseHandler(dependencies: Readonly<{
  service: SafetyCaseService;
  allowedOrigins: readonly string[];
}>) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith("/v1/internal-sandbox/")) return false;
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
      const tripMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/app\/synthetic-trips\/([^/]+)\/safety(?:\/(messages|reports))?$/,
      );
      if (tripMatch) {
        const context = await createAppRequestContext(request);
        const tripId = decodeURIComponent(tripMatch[1]!);
        const action = tripMatch[2];
        if (request.method === "GET" && !action) {
          return send(response, 200, await dependencies.service.dashboard(context.accountId, tripId), context.correlationId);
        }
        const body = await readJson(request);
        if (request.method === "POST" && action === "messages") {
          return send(
            response,
            200,
            await dependencies.service.sendMessage(
              context.accountId,
              tripId,
              requireString(body, "body"),
              requireIdempotencyKey(request),
            ),
            context.correlationId,
          );
        }
        if (request.method === "POST" && action === "reports") {
          return send(
            response,
            200,
            await dependencies.service.report(
              context.accountId,
              tripId,
              requireReason(body),
              requireIdempotencyKey(request),
            ),
            context.correlationId,
          );
        }
      }
      const appealMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/app\/safety-cases\/([^/]+)\/appeal$/,
      );
      if (appealMatch && request.method === "POST") {
        const context = await createAppRequestContext(request);
        const body = await readJson(request);
        return send(
          response,
          200,
          await dependencies.service.appeal(
            context.accountId,
            decodeURIComponent(appealMatch[1]!),
            requireVersion(body),
            requireIdempotencyKey(request),
          ),
          context.correlationId,
        );
      }
      const resolutionMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/safety\/cases\/([^/]+)\/resolution$/,
      );
      if (resolutionMatch && request.method === "POST") {
        const context = createSafetyRequestContext(request);
        const body = await readJson(request);
        const caseId = decodeURIComponent(resolutionMatch[1]!);
        return send(
          response,
          200,
          await dependencies.service.resolve(
            caseId.replace(/^safety-/, ""),
            requireVersion(body),
            requireOutcome(body),
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
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id");
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

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("VALIDATION_FAILED");
  }
}

function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || value.length < 1 || value.length > 128) throw new Error("VALIDATION_FAILED");
  return value;
}

function requireVersion(body: Record<string, unknown>) {
  const value = body.expectedVersion;
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error("VALIDATION_FAILED");
  return value as number;
}

function requireReason(body: Record<string, unknown>): SafetyCaseView["reasonCode"] {
  const value = body.reasonCode;
  if (value !== "unsafe_behavior" && value !== "harassment" && value !== "identity_concern") {
    throw new Error("VALIDATION_FAILED");
  }
  return value;
}

function requireOutcome(body: Record<string, unknown>): "restore_access" | "uphold_freeze" {
  const value = body.outcome;
  if (value !== "restore_access" && value !== "uphold_freeze") throw new Error("VALIDATION_FAILED");
  return value;
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string" || value.length < 8 || value.length > 128) throw new Error("VALIDATION_FAILED");
  return value;
}

