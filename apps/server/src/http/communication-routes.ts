import type { IncomingMessage, ServerResponse } from "node:http";
import type { CommunicationService } from "../application/communication-service.js";
import type { DataLifecycleService } from "../application/data-lifecycle-service.js";
import { mapError } from "./error-mapper.js";
import { createAppRequestContext } from "./request-context.js";

export function createCommunicationHandler(dependencies: Readonly<{
  service: CommunicationService;
  lifecycle: DataLifecycleService;
  allowedOrigins: readonly string[];
  authenticateSession?: Parameters<typeof createAppRequestContext>[1];
}>) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const chatMatch = url.pathname.match(/^\/v1\/internal-sandbox\/app\/synthetic-trips\/([^/]+)\/chat(?:\/messages)?$/);
    const chatDeleteMatch = url.pathname.match(/^\/v1\/internal-sandbox\/app\/synthetic-trips\/([^/]+)\/chat\/content-deletion$/);
    const centerMatch = url.pathname.match(/^\/v1\/internal-sandbox\/app\/messages(?:\/([^/]+)\/read|\/read-all)?$/);
    if (!chatMatch && !chatDeleteMatch && !centerMatch) return false;
    const correlationId = typeof request.headers["x-correlation-id"] === "string"
      ? request.headers["x-correlation-id"]
      : crypto.randomUUID();
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") return send(response, 204, undefined, correlationId);
      const context = await createAppRequestContext(request, dependencies.authenticateSession);
      if (chatDeleteMatch && request.method === "POST") {
        const tripId = decodeURIComponent(chatDeleteMatch[1]!);
        await dependencies.service.getTripChat(context.accountId, tripId);
        await dependencies.lifecycle.requestChatDeletion(
          context.accountId,
          tripId,
          requireIdempotencyKey(request),
        );
        return send(
          response,
          200,
          await dependencies.service.getTripChat(context.accountId, tripId),
          context.correlationId,
        );
      }
      if (chatMatch) {
        const tripId = decodeURIComponent(chatMatch[1]!);
        if (request.method === "GET" && !url.pathname.endsWith("/messages")) {
          return send(response, 200, await dependencies.service.getTripChat(context.accountId, tripId), context.correlationId);
        }
        if (request.method === "POST" && url.pathname.endsWith("/messages")) {
          const body = await readJson(request);
          return send(response, 200, await dependencies.service.sendTripChatMessage(
            context.accountId,
            tripId,
            requireString(body, "body"),
            requireIdempotencyKey(request),
          ), context.correlationId);
        }
      }
      if (centerMatch) {
        if (request.method === "GET" && !centerMatch[1] && !url.pathname.endsWith("/read-all")) {
          return send(response, 200, await dependencies.service.getMessageCenter(context.accountId), context.correlationId);
        }
        if (request.method === "POST" && centerMatch[1]) {
          return send(response, 200, await dependencies.service.markMessageRead(
            context.accountId,
            decodeURIComponent(centerMatch[1]),
            requireIdempotencyKey(request),
          ), context.correlationId);
        }
        if (request.method === "POST" && url.pathname.endsWith("/read-all")) {
          return send(response, 200, await dependencies.service.markAllMessagesRead(
            context.accountId,
            requireIdempotencyKey(request),
          ), context.correlationId);
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
  if (origin && allowedOrigins.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id, X-Request-Id");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("INVALID_REQUEST");
  return parsed as Record<string, unknown>;
}

function requireString(body: Record<string, unknown>, field: string) {
  if (typeof body[field] !== "string") throw new Error("INVALID_REQUEST");
  return body[field];
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

