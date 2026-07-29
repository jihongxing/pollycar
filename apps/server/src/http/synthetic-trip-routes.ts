import type { IncomingMessage, ServerResponse } from "node:http";
import type { SyntheticTripService } from "../application/synthetic-trip-service.js";
import type { MobilityService } from "../application/mobility-service.js";
import { createAppRequestContext } from "./request-context.js";
import { mapError } from "./error-mapper.js";
import type { TripTiming } from "@pollycar/contracts";
import { readJsonObject } from "./http-boundary.js";

export function createSyntheticTripHandler(dependencies: Readonly<{
  service: SyntheticTripService;
  mobility?: MobilityService;
  allowedOrigins: readonly string[];
}>) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith("/v1/internal-sandbox/app/synthetic-trips")) return false;
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
      const context = await createAppRequestContext(request);
      if (url.pathname === "/v1/internal-sandbox/app/synthetic-trips/dashboard" && request.method === "GET") {
        return send(response, 200, await dependencies.service.dashboard(context.accountId), context.correlationId);
      }
      if (url.pathname === "/v1/internal-sandbox/app/synthetic-trips/booking-availability" && request.method === "GET") {
        return send(
          response,
          200,
          dependencies.service.getBookingAvailability(),
          context.correlationId,
        );
      }
      if (url.pathname === "/v1/internal-sandbox/app/synthetic-trips" && request.method === "POST") {
        const body = await readJson(request);
        return send(
          response,
          200,
          await dependencies.service.create(context.accountId, {
            tripId: requireString(body, "tripId"),
            originLabel: requireString(body, "originLabel"),
            destinationLabel: requireString(body, "destinationLabel"),
            passengerCount: requirePassengerCount(body, "passengerCount"),
            ...(body.scene === undefined ? {} : { scene: requireScene(body, "scene") }),
            ...(body.timing === undefined ? {} : { timing: requireTiming(body.timing) }),
            ...(body.estimatedDurationMinutes === undefined
              ? {}
              : { estimatedDurationMinutes: requireEstimatedDuration(body.estimatedDurationMinutes) }),
            idempotencyKey: requireIdempotencyKey(request),
          }),
          context.correlationId,
        );
      }
      const match = url.pathname.match(
        /^\/v1\/internal-sandbox\/app\/synthetic-trips\/([^/]+)\/(payment|reschedule|accept|start|complete|cancel|reconcile-timeout)$/,
      );
      if (!match || request.method !== "POST") return false;
      const tripId = decodeURIComponent(match[1]!);
      const action = match[2]!;
      const body = await readJson(request);
      const expectedVersion = requireVersion(body);
      const idempotencyKey = requireIdempotencyKey(request);
      const result =
        action === "payment"
          ? await dependencies.service.payZeroMoney(context.accountId, tripId, expectedVersion, idempotencyKey)
          : action === "reschedule"
            ? await dependencies.service.reschedule(
                context.accountId,
                tripId,
                expectedVersion,
                idempotencyKey,
                {
                  timing: requireTiming(body.timing),
                  ...(body.originLabel === undefined
                    ? {}
                    : { originLabel: requireString(body, "originLabel") }),
                  ...(body.destinationLabel === undefined
                    ? {}
                    : { destinationLabel: requireString(body, "destinationLabel") }),
                  ...(body.passengerCount === undefined
                    ? {}
                    : { passengerCount: requirePassengerCount(body, "passengerCount") }),
                  ...(body.scene === undefined
                    ? {}
                    : { scene: body.scene === null ? null : requireScene(body, "scene") }),
                  ...(body.estimatedDurationMinutes === undefined
                    ? {}
                    : {
                        estimatedDurationMinutes: requireEstimatedDuration(
                          body.estimatedDurationMinutes,
                        ),
                      }),
                },
              )
          : action === "accept"
            ? await dependencies.service.accept(context.accountId, tripId, expectedVersion, idempotencyKey)
            : action === "start"
              ? await dependencies.service.start(context.accountId, tripId, expectedVersion, idempotencyKey)
              : action === "complete"
                ? await dependencies.service.complete(context.accountId, tripId, expectedVersion, idempotencyKey)
                : action === "cancel"
                  ? await dependencies.service.cancel(
                      context.accountId,
                      tripId,
                      expectedVersion,
                      idempotencyKey,
                      optionalCancellationReason(body),
                      optionalString(body, "note"),
                    )
                  : await dependencies.service.reconcileTimeout(context.accountId, tripId, expectedVersion, idempotencyKey);
      if (action === "accept" && dependencies.mobility) {
        await dependencies.mobility.enrichAcceptedTrip(tripId, context.accountId);
        if (result.state !== "reserved") {
          await dependencies.mobility.markBusy(context.accountId, `${idempotencyKey}:busy`, true);
        }
        const refreshed = await dependencies.service.dashboard(context.accountId);
        return send(
          response,
          200,
          refreshed.activeDriverTrip ??
            refreshed.reservedDriverTrips?.find((trip) => trip.tripId === tripId) ??
            result,
          context.correlationId,
        );
      }
      return send(response, 200, result, context.correlationId);
    } catch (error) {
      const mapped = mapError(error, correlationId);
      return send(response, mapped.status, mapped.body, correlationId);
    }
  };
}

function requireTiming(value: unknown): TripTiming {
  if (!value || typeof value !== "object") throw new Error("TRIP_PICKUP_TIME_INVALID");
  const timing = value as Record<string, unknown>;
  const mode = timing.mode;
  const selectionSource = timing.selectionSource;
  const timezone = timing.timezone;
  if (!["immediate", "scheduled"].includes(String(mode))) {
    throw new Error("TRIP_PICKUP_TIME_INVALID");
  }
  if (!["immediate", "quick_slot", "calendar_slot"].includes(String(selectionSource))) {
    throw new Error("TRIP_PICKUP_TIME_INVALID");
  }
  if (typeof timezone !== "string") throw new Error("TRIP_PICKUP_TIME_INVALID");
  return {
    mode: mode as TripTiming["mode"],
    timezone,
    selectionSource: selectionSource as TripTiming["selectionSource"],
    ...(typeof timing.requestedPickupStartsAt === "string"
      ? { requestedPickupStartsAt: timing.requestedPickupStartsAt }
      : {}),
    ...(typeof timing.requestedPickupEndsAt === "string"
      ? { requestedPickupEndsAt: timing.requestedPickupEndsAt }
      : {}),
  };
}

function requireEstimatedDuration(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 240
  ) {
    throw new Error("VALIDATION_FAILED");
  }
  return value;
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
  return readJsonObject(request);
}

function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || value.length < 1 || value.length > 128) throw new Error("VALIDATION_FAILED");
  if (!value.startsWith("synthetic-") && field === "tripId") throw new Error("REAL_DATA_FORBIDDEN");
  return value;
}

function requireVersion(body: Record<string, unknown>): number {
  const value = body.expectedVersion;
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error("VALIDATION_FAILED");
  return value as number;
}

function requirePassengerCount(body: Record<string, unknown>, field: string): 1 | 2 | 3 {
  const value = body[field];
  if (value !== 1 && value !== 2 && value !== 3) throw new Error("VALIDATION_FAILED");
  return value;
}

function requireScene(
  body: Record<string, unknown>,
  field: string,
): "commute" | "airport" | "medical" | "other" {
  const value = body[field];
  if (!["commute", "airport", "medical", "other"].includes(String(value))) {
    throw new Error("VALIDATION_FAILED");
  }
  return value as "commute" | "airport" | "medical" | "other";
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string" || value.length < 8 || value.length > 128) throw new Error("VALIDATION_FAILED");
  return value;
}

function optionalString(body: Record<string, unknown>, field: string): string | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error("VALIDATION_FAILED");
  return value;
}

function optionalCancellationReason(body: Record<string, unknown>) {
  const value = body.reason;
  if (value === undefined) return undefined;
  if (!["plans_changed", "pickup_incorrect", "wait_too_long", "driver_or_vehicle_concern", "other"].includes(String(value))) {
    throw new Error("VALIDATION_FAILED");
  }
  return value as "plans_changed" | "pickup_incorrect" | "wait_too_long" | "driver_or_vehicle_concern" | "other";
}

