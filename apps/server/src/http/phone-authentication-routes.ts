import type { IncomingMessage, ServerResponse } from "node:http";
import type { PhoneAuthenticationService } from "../application/phone-authentication-service.js";
import { mapError } from "./error-mapper.js";

export function createPhoneAuthenticationHandler(dependencies: Readonly<{
  service: PhoneAuthenticationService;
  allowedOrigins: readonly string[];
}>) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith("/v1/auth/")) return false;
    const correlationId = typeof request.headers["x-correlation-id"] === "string"
      ? request.headers["x-correlation-id"] : crypto.randomUUID();
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") return send(response, 204, undefined, correlationId);
      const body = await readJson(request);
      if (url.pathname === "/v1/auth/phone/code" && request.method === "POST") {
        return send(response, 201, await dependencies.service.requestCode(body as never), correlationId);
      }
      if (url.pathname === "/v1/auth/phone/verify" && request.method === "POST") {
        return send(response, 200, await dependencies.service.verify(body as never), correlationId);
      }
      if (url.pathname === "/v1/auth/session/refresh" && request.method === "POST") {
        return send(response, 200, await dependencies.service.refresh(body as never), correlationId);
      }
      return false;
    } catch (error) {
      const mapped = mapError(error, correlationId);
      return send(response, mapped.status, mapped.body, correlationId);
    }
  };
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
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

function applyCors(request: IncomingMessage, response: ServerResponse, allowedOrigins: readonly string[]) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.includes(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key, X-Correlation-Id");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}
