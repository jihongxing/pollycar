import type { IncomingMessage, ServerResponse } from "node:http";
import type { DriverOrderState } from "@pollycar/contracts";
import type { MobilityService } from "../application/mobility-service.js";
import type { DispatchService } from "../application/dispatch-service.js";
import { mapError } from "./error-mapper.js";
import { createAppRequestContext } from "./request-context.js";
import { readJsonObject } from "./http-boundary.js";

export function createMobilityHandler(dependencies: {
  service: MobilityService;
  dispatch?: DispatchService;
  allowedOrigins: readonly string[];
}) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://internal");
    if (!url.pathname.startsWith("/v1/internal-sandbox/app/")) return false;
    const correlationId = String(request.headers["x-correlation-id"] ?? crypto.randomUUID());
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") return send(response, 204, undefined, correlationId);
      const context = await createAppRequestContext(request);

      if (url.pathname === "/v1/internal-sandbox/app/driver/availability") {
        if (request.method === "GET") {
          return send(response, 200, await dependencies.service.getAvailability(context.accountId), context.correlationId);
        }
        if (request.method === "POST") {
          const body = await readJson(request);
          const state = body.state;
          if (state !== "online" && state !== "offline") throw new Error("VALIDATION_FAILED");
          return send(
            response,
            200,
            await dependencies.service.setAvailability(
              context.accountId,
              state,
              body.returnOnlineAfterTrip !== false,
              requireIdempotencyKey(request),
            ),
            context.correlationId,
          );
        }
      }

      if (url.pathname === "/v1/internal-sandbox/app/driver/available-trips" && request.method === "GET") {
        const trips = dependencies.dispatch
          ? (await dependencies.dispatch.listOffers(context.accountId)).offers.map((offer) => offer.trip)
          : await dependencies.service.listAvailableTrips(context.accountId);
        return send(response, 200, trips, context.correlationId);
      }

      if (url.pathname === "/v1/internal-sandbox/app/driver/orders" && request.method === "GET") {
        const requestedState = url.searchParams.get("state");
        if (requestedState && !isDriverOrderState(requestedState)) {
          throw new Error("VALIDATION_FAILED");
        }
        const state = requestedState && isDriverOrderState(requestedState) ? requestedState : undefined;
        return send(
          response,
          200,
          await dependencies.service.listDriverOrders(context.accountId, state),
          context.correlationId,
        );
      }

      const orderMatch = url.pathname.match(/^\/v1\/internal-sandbox\/app\/driver\/orders\/([^/]+)$/);
      if (orderMatch && request.method === "GET") {
        return send(
          response,
          200,
          await dependencies.service.getDriverOrder(context.accountId, decodeURIComponent(orderMatch[1]!)),
          context.correlationId,
        );
      }

      if (url.pathname === "/v1/internal-sandbox/app/driver/finance/overview" && request.method === "GET") {
        return send(response, 200, dependencies.service.getFinanceOverview(), context.correlationId);
      }
      if (url.pathname === "/v1/internal-sandbox/app/driver/finance/bank-card-capability" && request.method === "GET") {
        return send(response, 200, dependencies.service.getBankCardCapability(), context.correlationId);
      }
      if (url.pathname === "/v1/internal-sandbox/app/driver/finance/withdrawal-capability" && request.method === "GET") {
        return send(response, 200, dependencies.service.getWithdrawalCapability(), context.correlationId);
      }
      if (
        url.pathname.startsWith("/v1/internal-sandbox/app/driver/finance/") &&
        request.method !== "GET"
      ) {
        throw new Error("REAL_FINANCIAL_DATA_FORBIDDEN");
      }

      const eligibilityMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/app\/synthetic-trips\/([^/]+)\/cancellation-eligibility$/,
      );
      if (eligibilityMatch && request.method === "GET") {
        return send(
          response,
          200,
          await dependencies.service.getCancellationEligibility(
            context.accountId,
            decodeURIComponent(eligibilityMatch[1]!),
          ),
          context.correlationId,
        );
      }

      const verificationMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/app\/synthetic-trips\/([^/]+)\/pickup-verification$/,
      );
      if (verificationMatch && request.method === "GET") {
        return send(
          response,
          200,
          await dependencies.service.getPickupVerification(
            context.accountId,
            decodeURIComponent(verificationMatch[1]!),
          ),
          context.correlationId,
        );
      }

      const actionMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/app\/synthetic-trips\/([^/]+)\/(driver-en-route|driver-arrived|verify-boarding|cancel-accepted|completion-intents|complete-with-intent)$/,
      );
      if (!actionMatch || request.method !== "POST") return false;
      const tripId = decodeURIComponent(actionMatch[1]!);
      const action = actionMatch[2]!;
      const body = await readJson(request);
      const expectedVersion = requireVersion(body);
      const idempotencyKey = requireIdempotencyKey(request);
      const result =
        action === "driver-en-route"
          ? await dependencies.service.markDriverEnRoute(context.accountId, tripId, expectedVersion, idempotencyKey)
          : action === "driver-arrived"
            ? await dependencies.service.markDriverArrived(context.accountId, tripId, expectedVersion, idempotencyKey)
            : action === "verify-boarding"
              ? await dependencies.service.verifyBoarding(
                  context.accountId,
                  tripId,
                  expectedVersion,
                  requireString(body, "code", 12),
                  idempotencyKey,
                )
              : action === "cancel-accepted"
                ? await dependencies.service.cancelAcceptedTrip(
                    context.accountId,
                    tripId,
                    expectedVersion,
                    idempotencyKey,
                    optionalReason(body.reason),
                    optionalString(body.note, 200),
                  )
                : action === "completion-intents"
                  ? await dependencies.service.createCompletionIntent(
                      context.accountId,
                      tripId,
                      expectedVersion,
                      idempotencyKey,
                    )
                  : await dependencies.service.completeWithIntent(
                      context.accountId,
                      tripId,
                      expectedVersion,
                      requireString(body, "completionIntentToken", 256),
                      idempotencyKey,
                    );
      return send(response, 200, result, context.correlationId);
    } catch (error) {
      const mapped = mapError(error, correlationId);
      return send(response, mapped.status, mapped.body, correlationId);
    }
  };
}

function isDriverOrderState(value: string): value is DriverOrderState {
  return ["available", "accepted", "in_progress", "completed", "cancelled"].includes(value);
}

function applyCors(request: IncomingMessage, response: ServerResponse, allowedOrigins: readonly string[]) {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) throw new Error("AUTHORIZATION_DENIED");
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id");
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
  return readJsonObject(request);
}

function requireVersion(body: Record<string, unknown>) {
  if (!Number.isInteger(body.expectedVersion) || Number(body.expectedVersion) < 0) throw new Error("VALIDATION_FAILED");
  return Number(body.expectedVersion);
}

function requireIdempotencyKey(request: IncomingMessage) {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string" || value.length < 8 || value.length > 128) throw new Error("VALIDATION_FAILED");
  return value;
}

function requireString(body: Record<string, unknown>, field: string, maxLength: number) {
  const value = body[field];
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength) throw new Error("VALIDATION_FAILED");
  return value;
}

function optionalString(value: unknown, maxLength: number) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maxLength) throw new Error("VALIDATION_FAILED");
  return value || undefined;
}

function optionalReason(value: unknown) {
  if (value === undefined) return undefined;
  const allowed = ["plans_changed", "pickup_incorrect", "wait_too_long", "driver_or_vehicle_concern", "other"];
  if (typeof value !== "string" || !allowed.includes(value)) throw new Error("TRIP_CANCELLATION_REASON_INVALID");
  return value as "plans_changed" | "pickup_incorrect" | "wait_too_long" | "driver_or_vehicle_concern" | "other";
}

