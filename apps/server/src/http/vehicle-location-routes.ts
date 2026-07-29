import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { VehicleLocationStage, VehicleLocationUpdate } from "@pollycar/contracts";
import type { VehicleLocationService } from "../application/vehicle-location-service.js";
import { createAppRequestContext } from "./request-context.js";
import { mapError } from "./error-mapper.js";
import { readJsonObject } from "./http-boundary.js";

export function createVehicleLocationHandler(dependencies: Readonly<{
  service: VehicleLocationService;
  allowedOrigins: readonly string[];
}>) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const match = url.pathname.match(/^\/v1\/internal-sandbox\/app\/synthetic-trips\/([^/]+)\/vehicle-location(?:\/(stage))?$/);
    if (!match) return false;
    const correlationId = typeof request.headers["x-correlation-id"] === "string"
      ? request.headers["x-correlation-id"]
      : crypto.randomUUID();
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") return send(response, 204, undefined, correlationId);
      const context = await createAppRequestContext(request);
      const tripId = decodeURIComponent(match[1]!);
      if (!match[2] && request.method === "GET") {
        return send(response, 200, await dependencies.service.get(context.accountId, tripId), context.correlationId);
      }
      if (!match[2] && request.method === "POST") {
        const body = await readJson(request);
        const update = body as unknown as VehicleLocationUpdate;
        if (update.tripId !== tripId) throw new Error("VEHICLE_LOCATION_TRIP_MISMATCH");
        return send(response, 200, await dependencies.service.upload(
          context.accountId,
          update,
          requireIdempotencyKey(request),
        ), context.correlationId);
      }
      if (match[2] && request.method === "POST") {
        const body = await readJson(request);
        const stage = body.stage;
        if (!isStage(stage)) throw new Error("VEHICLE_LOCATION_STAGE_INVALID");
        return send(response, 200, await dependencies.service.setStage(tripId, context.accountId, stage), context.correlationId);
      }
      return send(response, 405, { error: { code: "METHOD_NOT_ALLOWED" } }, correlationId);
    } catch (error) {
      const mapped = mapError(error, correlationId);
      return send(response, mapped.status, mapped.body, correlationId);
    }
  };
}

function isStage(value: unknown): value is VehicleLocationStage {
  return ["accepted", "driver_en_route", "driver_arrived", "in_progress", "closed"].includes(String(value));
}

function applyCors(request: IncomingMessage, response: ServerResponse, allowedOrigins: readonly string[]) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.includes(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return readJsonObject(request, { invalidErrorCode: "VALIDATION_INVALID_REQUEST" });
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string" || !value) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  return value;
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
