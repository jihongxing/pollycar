import type { IncomingMessage, ServerResponse } from "node:http";
import type { SyntheticAvatarAsset } from "@pollycar/contracts";
import type { TrustProfileService } from "../application/trust-profile-service.js";
import { mapError } from "./error-mapper.js";
import { createAppRequestContext } from "./request-context.js";

export function createTrustProfileHandler(dependencies: Readonly<{
  service: TrustProfileService;
  allowedOrigins: readonly string[];
}>) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const ratingMatch = url.pathname.match(/^\/v1\/internal-sandbox\/app\/synthetic-trips\/([^/]+)\/rating$/);
    const profile = url.pathname === "/v1/internal-sandbox/app/trust-profile";
    const avatar = url.pathname === "/v1/internal-sandbox/app/trust-profile/avatar";
    const fairness = url.pathname === "/v1/internal-sandbox/app/trust-profile/fairness";
    if (!ratingMatch && !profile && !avatar && !fairness) return false;
    const correlationId = typeof request.headers["x-correlation-id"] === "string"
      ? request.headers["x-correlation-id"]
      : crypto.randomUUID();
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") return send(response, 204, undefined, correlationId);
      const context = await createAppRequestContext(request);
      if (profile && request.method === "GET") {
        return send(response, 200, await dependencies.service.getProfile(context.accountId), context.correlationId);
      }
      if (avatar && request.method === "POST") {
        const body = await readJson(request);
        const asset = body.asset;
        if (asset !== "avatar-city-blue" && asset !== "avatar-warm-gray" && asset !== "avatar-plum") {
          throw new Error("VALIDATION_FAILED");
        }
        return send(response, 200, await dependencies.service.submitAvatar(
          context.accountId,
          asset as SyntheticAvatarAsset,
          requireIdempotencyKey(request),
          context.correlationId,
        ), context.correlationId);
      }
      if (fairness && request.method === "GET") {
        return send(response, 200, await dependencies.service.getFairnessReport(), context.correlationId);
      }
      if (ratingMatch) {
        const tripId = decodeURIComponent(ratingMatch[1]!);
        if (request.method === "GET") {
          return send(response, 200, await dependencies.service.getRating(context.accountId, tripId), context.correlationId);
        }
        if (request.method === "POST") {
          const body = await readJson(request);
          if (![1, 2, 3, 4, 5].includes(Number(body.score))) throw new Error("VALIDATION_FAILED");
          return send(response, 200, await dependencies.service.submitRating(context.accountId, {
            tripId,
            score: Number(body.score) as 1 | 2 | 3 | 4 | 5,
            tags: Array.isArray(body.tags) ? body.tags as never[] : [],
            ...(typeof body.note === "string" ? { note: body.note } : {}),
            idempotencyKey: requireIdempotencyKey(request),
          }, context.correlationId), context.correlationId);
        }
      }
      return send(response, 405, { error: { code: "METHOD_NOT_ALLOWED" } }, correlationId);
    } catch (error) {
      const mapped = mapError(error, correlationId);
      return send(response, mapped.status, mapped.body, correlationId);
    }
  };
}

function applyCors(request: IncomingMessage, response: ServerResponse, allowedOrigins: readonly string[]) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.includes(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("VALIDATION_FAILED");
  return parsed as Record<string, unknown>;
}

function requireIdempotencyKey(request: IncomingMessage) {
  const key = request.headers["idempotency-key"];
  if (typeof key !== "string" || !key) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  return key;
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

