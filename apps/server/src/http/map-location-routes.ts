import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  GeoPoint,
  PlaceSearchRequest,
  ReverseGeocodeRequest,
  RoutePlanningRequest,
} from "@pollycar/contracts";
import type { MapLocationService } from "../application/map-location-service.js";
import { mapError } from "./error-mapper.js";
import { createAppRequestContext } from "./request-context.js";
import { readJsonObject } from "./http-boundary.js";

export function createMapLocationHandler(dependencies: Readonly<{
  service: MapLocationService;
  allowedOrigins: readonly string[];
}>) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const search = url.pathname === "/v1/internal-sandbox/app/map/places/search";
    const reverse = url.pathname === "/v1/internal-sandbox/app/map/reverse-geocode";
    const route = url.pathname === "/v1/internal-sandbox/app/map/routes/driving";
    if (!search && !reverse && !route) return false;
    const correlationId = typeof request.headers["x-correlation-id"] === "string"
      ? request.headers["x-correlation-id"]
      : crypto.randomUUID();
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") return send(response, 204, undefined, correlationId);
      const context = await createAppRequestContext(request);
      if (search && request.method === "GET") {
        const requestValue: PlaceSearchRequest = {
          query: url.searchParams.get("query") ?? "",
          limit: Number(url.searchParams.get("limit") ?? "10"),
          ...(url.searchParams.get("city_code") ? { cityCode: url.searchParams.get("city_code")! } : {}),
          ...(readPointFromQuery(url, "bias") ? { biasLocation: readPointFromQuery(url, "bias")! } : {}),
        };
        return send(response, 200, await dependencies.service.search(context.accountId, requestValue), context.correlationId);
      }
      if (reverse && request.method === "POST") {
        requireIdempotencyKey(request);
        const body = await readJson(request);
        const requestValue: ReverseGeocodeRequest = {
          location: readPoint(body.location),
          radiusMeters: Number(body.radiusMeters ?? 50),
        };
        return send(response, 200, await dependencies.service.reverseGeocode(requestValue), context.correlationId);
      }
      if (route && request.method === "POST") {
        requireIdempotencyKey(request);
        const body = await readJson(request);
        const strategy = body.strategy;
        if (strategy !== "fastest" && strategy !== "avoid_congestion" && strategy !== "avoid_tolls") {
          throw new Error("MAP_ROUTE_INVALID");
        }
        const requestValue: RoutePlanningRequest = {
          origin: readPoint(body.origin),
          destination: readPoint(body.destination),
          strategy,
          includeTraffic: body.includeTraffic === true,
        };
        return send(response, 200, await dependencies.service.planRoute(requestValue), context.correlationId);
      }
      return send(response, 405, { error: { code: "METHOD_NOT_ALLOWED" } }, correlationId);
    } catch (error) {
      const mapped = mapError(error, correlationId);
      return send(response, mapped.status, mapped.body, correlationId);
    }
  };
}

function readPoint(value: unknown): GeoPoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("MAP_COORDINATE_INVALID");
  const record = value as Record<string, unknown>;
  if (record.coordinateSystem !== "wgs84" && record.coordinateSystem !== "gcj02") {
    throw new Error("MAP_COORDINATE_SYSTEM_REQUIRED");
  }
  return {
    latitude: Number(record.latitude),
    longitude: Number(record.longitude),
    coordinateSystem: record.coordinateSystem,
  };
}

function readPointFromQuery(url: URL, prefix: string): GeoPoint | undefined {
  const latitude = url.searchParams.get(`${prefix}_latitude`);
  const longitude = url.searchParams.get(`${prefix}_longitude`);
  const coordinateSystem = url.searchParams.get(`${prefix}_coordinate_system`);
  if (latitude === null && longitude === null && coordinateSystem === null) return undefined;
  return readPoint({ latitude, longitude, coordinateSystem });
}

function applyCors(request: IncomingMessage, response: ServerResponse, allowedOrigins: readonly string[]) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.includes(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string" || !value) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  return value;
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return readJsonObject(request, { invalidErrorCode: "VALIDATION_INVALID_REQUEST" });
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
