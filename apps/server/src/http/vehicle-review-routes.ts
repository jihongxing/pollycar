import type { IncomingMessage, ServerResponse } from "node:http";
import type { VehicleReviewService } from "../application/vehicle-review-service.js";
import type { AdminReviewTaskService } from "../application/admin-review-task-service.js";
import { createAppRequestContext } from "./request-context.js";
import { mapError } from "./error-mapper.js";

type RouteDependencies = Readonly<{
  service: VehicleReviewService;
  adminReviews: AdminReviewTaskService;
  allowedOrigins: readonly string[];
}>;

export function createVehicleReviewHandler(dependencies: RouteDependencies) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith("/v1/internal-sandbox/app/vehicle-reviews/")) return false;
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
      const context = await createAppRequestContext(request);
      const match = url.pathname.match(
        /^\/v1\/internal-sandbox\/app\/vehicle-reviews\/([^/]+)(?:\/(.+))?$/,
      );
      if (!match) return sendError(response, new Error("VEHICLE_REVIEW_NOT_FOUND"), correlationId);
      const applicationId = decodeURIComponent(match[1]!);
      const action = match[2];
      if (request.method === "GET" && !action) {
        return send(
          response,
          200,
          await dependencies.service.get(applicationId, context.accountId),
          context.correlationId,
        );
      }
      const idempotencyKey = requireIdempotencyKey(request);
      const body = await readJson(request);
      if (request.method === "POST" && action === "draft") {
        const syntheticAttachmentId = requireString(body, "syntheticAttachmentId");
        if (!syntheticAttachmentId.startsWith("synthetic-")) throw new Error("REAL_DATA_FORBIDDEN");
        return send(
          response,
          200,
          await dependencies.service.saveDraft({
            accountId: context.accountId,
            applicationId,
            vehicleType: requireString(body, "vehicleType"),
            maxPassengerCount: requirePassengerCount(body, "maxPassengerCount"),
            insuranceExpiresOn: requireDate(body, "insuranceExpiresOn"),
            syntheticAttachmentId,
            expectedVersion: requireNumber(body, "expectedVersion"),
            idempotencyKey,
          }),
          context.correlationId,
        );
      }
      if (request.method === "POST" && action === "submit") {
        const view = await dependencies.service.submit({
          accountId: context.accountId,
          applicationId,
          expectedVersion: requireNumber(body, "expectedVersion"),
          idempotencyKey,
        });
        await dependencies.adminReviews.registerSubmittedVehicleReview(view);
        return send(
          response,
          200,
          view,
          context.correlationId,
        );
      }
      if (request.method === "POST" && action === "material-resubmit") {
        const syntheticAttachmentId = requireString(body, "syntheticAttachmentId");
        if (!syntheticAttachmentId.startsWith("synthetic-")) throw new Error("REAL_DATA_FORBIDDEN");
        return send(
          response,
          200,
          await dependencies.service.resubmitMaterial({
            accountId: context.accountId,
            applicationId,
            insuranceExpiresOn: requireDate(body, "insuranceExpiresOn"),
            syntheticAttachmentId,
            expectedVersion: requireNumber(body, "expectedVersion"),
            idempotencyKey,
          }),
          context.correlationId,
        );
      }
      return sendError(response, new Error("VEHICLE_REVIEW_NOT_FOUND"), context.correlationId);
    } catch (error) {
      return sendError(response, error, correlationId);
    }
  };
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

function sendError(response: ServerResponse, error: unknown, correlationId: string): true {
  const mapped = mapError(error, correlationId);
  return send(response, mapped.status, mapped.body, correlationId);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("VALIDATION_FAILED");
  }
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const key = request.headers["idempotency-key"];
  if (typeof key !== "string" || key.length < 8 || key.length > 128) {
    throw new Error("VALIDATION_FAILED");
  }
  return key;
}

function requireNumber(body: Record<string, unknown>, field: string): number {
  const value = body[field];
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error("VALIDATION_FAILED");
  return value as number;
}

function requirePassengerCount(body: Record<string, unknown>, field: string): 1 | 2 | 3 {
  const value = body[field];
  if (value !== 1 && value !== 2 && value !== 3) throw new Error("VALIDATION_FAILED");
  return value;
}

function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || value.length < 1 || value.length > 128) {
    throw new Error("VALIDATION_FAILED");
  }
  return value;
}

function requireDate(body: Record<string, unknown>, field: string): string {
  const value = requireString(body, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("VALIDATION_FAILED");
  return value;
}

