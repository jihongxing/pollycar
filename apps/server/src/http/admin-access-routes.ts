import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  AdminAccessActor,
  AdminAccessService,
} from "../application/admin-access-service.js";
import { mapError } from "./error-mapper.js";

const basePath = "/v1/internal-sandbox/admin/access";

export function createAdminAccessHandler(dependencies: Readonly<{
  service: AdminAccessService;
  allowedOrigins: readonly string[];
}>) {
  return async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith(basePath)) return false;
    const correlationId = correlationIdFor(request);
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") {
        return send(response, 204, undefined, correlationId);
      }
      const actor = createAdminAccessActor(request, correlationId);
      if (request.method === "GET" && url.pathname === `${basePath}/session`) {
        return send(response, 200, dependencies.service.getSession(actor), correlationId);
      }
      if (
        request.method === "POST" &&
        url.pathname === `${basePath}/context`
      ) {
        const body = await readJson(request);
        const organizationId = requireString(body.organizationId);
        return send(
          response,
          200,
          dependencies.service.switchContext(
            actor,
            organizationId,
            requireIdempotencyKey(request),
          ),
          correlationId,
        );
      }
      if (
        request.method === "GET" &&
        url.pathname === `${basePath}/platform-workbench`
      ) {
        return send(
          response,
          200,
          dependencies.service.getPlatformWorkbench(actor),
          correlationId,
        );
      }
      if (
        request.method === "GET" &&
        url.pathname === `${basePath}/operator-workbench`
      ) {
        return send(
          response,
          200,
          dependencies.service.getOperatorWorkbench(actor),
          correlationId,
        );
      }
      if (
        request.method === "GET" &&
        url.pathname === `${basePath}/operators`
      ) {
        return send(
          response,
          200,
          dependencies.service.listOperatorDirectory(actor),
          correlationId,
        );
      }
      if (request.method === "GET" && url.pathname === `${basePath}/audit`) {
        return send(
          response,
          200,
          dependencies.service.listAuditEvents(actor),
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

function createAdminAccessActor(
  request: IncomingMessage,
  correlationId: string,
): AdminAccessActor {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Sandbox ")) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }
  const token = authorization.slice("Sandbox ".length);
  if (token.length === 0 || token.length > 128) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }
  const requestHeader = request.headers["x-request-id"];
  return {
    token,
    correlationId,
    requestId:
      typeof requestHeader === "string" && requestHeader.length <= 128
        ? requestHeader
        : randomUUID(),
  };
}

function applyCors(
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: readonly string[],
): void {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    throw new Error("AUTHORIZATION_DENIED");
  }
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id, X-Request-Id",
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

async function readJson(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    throw new Error("VALIDATION_FAILED");
  }
}

function requireString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) {
    throw new Error("VALIDATION_FAILED");
  }
  return value;
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string" || value.length < 16 || value.length > 128) {
    throw new Error("VALIDATION_FAILED");
  }
  return value;
}

function correlationIdFor(request: IncomingMessage): string {
  const header = request.headers["x-correlation-id"];
  return typeof header === "string" && header.length <= 128
    ? header
    : randomUUID();
}
