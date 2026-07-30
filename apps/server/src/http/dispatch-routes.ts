import type { IncomingMessage, ServerResponse } from "node:http";
import type { DriverDispatchLocation } from "@pollycar/contracts";
import type { DispatchService } from "../application/dispatch-service.js";
import type { MobilityService } from "../application/mobility-service.js";
import { mapError } from "./error-mapper.js";
import { createAppRequestContext } from "./request-context.js";
import { readJsonObject } from "./http-boundary.js";

export function createDispatchHandler(dependencies: {
  service: DispatchService;
  mobility: MobilityService;
  allowedOrigins: readonly string[];
}) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://internal");
    if (!url.pathname.startsWith("/v1/internal-sandbox/app/driver/")) return false;
    const correlationId = String(request.headers["x-correlation-id"] ?? crypto.randomUUID());
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") return false;
      const context = await createAppRequestContext(request);

      if (
        url.pathname === "/v1/internal-sandbox/app/driver/dispatch-presence" &&
        request.method === "POST"
      ) {
        const body = await readJson(request);
        const state = body.state;
        if (state !== "online" && state !== "offline") throw new Error("VALIDATION_FAILED");
        return send(
          response,
          200,
          await dependencies.service.updatePresence(
            context.accountId,
            state,
            state === "online" ? requireLocation(body.location) : undefined,
            requireIdempotencyKey(request),
            state === "online"
              ? {
                  accountId: context.accountId,
                  accountSessionId: context.accountSessionId,
                  deviceId: requireString(body, "deviceId", 128),
                  ...optionalStringProperty(
                    body,
                    "livenessAuthorizationToken",
                    512,
                  ),
                }
              : undefined,
          ),
          context.correlationId,
        );
      }

      if (
        url.pathname === "/v1/internal-sandbox/app/driver/offers" &&
        request.method === "GET"
      ) {
        return send(
          response,
          200,
          await dependencies.service.listOffers(context.accountId),
          context.correlationId,
        );
      }

      const acceptMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/app\/driver\/offers\/([^/]+)\/accept$/,
      );
      if (acceptMatch && request.method === "POST") {
        const body = await readJson(request);
        const idempotencyKey = requireIdempotencyKey(request);
        const result = await dependencies.service.acceptOffer(
          context.accountId,
          decodeURIComponent(acceptMatch[1]!),
          requireVersion(body.expectedTripVersion),
          idempotencyKey,
        );
        await dependencies.mobility.enrichAcceptedTrip(result.tripId, context.accountId);
        if (result.state !== "reserved") {
          await dependencies.mobility.markBusy(
            context.accountId,
            `${idempotencyKey}:busy`,
            true,
          );
        }
        return send(response, 200, result, context.correlationId);
      }
      return false;
    } catch (error) {
      const mapped = mapError(error, correlationId);
      return send(response, mapped.status, mapped.body, correlationId);
    }
  };
}

function requireLocation(value: unknown): DriverDispatchLocation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("VALIDATION_FAILED");
  }
  const location = value as Record<string, unknown>;
  if (
    typeof location.latitude !== "number" ||
    typeof location.longitude !== "number" ||
    location.coordinateSystem !== "gcj02" ||
    typeof location.accuracyMeters !== "number" ||
    typeof location.capturedAt !== "string" ||
    location.synthetic !== true
  ) {
    throw new Error("VALIDATION_FAILED");
  }
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    coordinateSystem: "gcj02",
    accuracyMeters: location.accuracyMeters,
    capturedAt: location.capturedAt,
    synthetic: true,
  };
}

function requireVersion(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new Error("VALIDATION_FAILED");
  return Number(value);
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string" || value.length < 8 || value.length > 128) {
    throw new Error("VALIDATION_FAILED");
  }
  return value;
}

function requireString(
  body: Record<string, unknown>,
  field: string,
  maximumLength: number,
): string {
  const value = body[field];
  if (
    typeof value !== "string" ||
    value.length < 8 ||
    value.length > maximumLength
  ) {
    throw new Error("VALIDATION_FAILED");
  }
  return value;
}

function optionalStringProperty(
  body: Record<string, unknown>,
  field: string,
  maximumLength: number,
): Readonly<{ livenessAuthorizationToken?: string }> {
  const value = body[field];
  if (value === undefined) return {};
  if (
    typeof value !== "string" ||
    value.length < 8 ||
    value.length > maximumLength
  ) {
    throw new Error("VALIDATION_FAILED");
  }
  return { livenessAuthorizationToken: value };
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return readJsonObject(request);
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
    "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id, X-Device-Id",
  );
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function send(
  response: ServerResponse,
  status: number,
  body: unknown,
  correlationId: string,
): true {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Correlation-Id": correlationId,
  });
  response.end(body === undefined ? undefined : JSON.stringify(body));
  return true;
}
