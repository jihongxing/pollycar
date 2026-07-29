import type { IncomingMessage, ServerResponse } from "node:http";

export const DEFAULT_JSON_BODY_LIMIT_BYTES = 256 * 1024;

export async function readJsonObject(
  request: IncomingMessage,
  options: Readonly<{
    maximumBytes?: number;
    invalidErrorCode?: string;
    tooLargeErrorCode?: string;
  }> = {},
): Promise<Record<string, unknown>> {
  const invalidErrorCode = options.invalidErrorCode ?? "VALIDATION_FAILED";
  const tooLargeErrorCode = options.tooLargeErrorCode ?? "PAYLOAD_TOO_LARGE";
  const raw = await readRequestBody(
    request,
    options.maximumBytes ?? DEFAULT_JSON_BODY_LIMIT_BYTES,
    tooLargeErrorCode,
  );
  if (raw.length === 0) return {};
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(invalidErrorCode);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.message === tooLargeErrorCode) throw error;
    throw new Error(invalidErrorCode);
  }
}

export async function readRequestText(
  request: IncomingMessage,
  maximumBytes = DEFAULT_JSON_BODY_LIMIT_BYTES,
): Promise<string> {
  return (await readRequestBody(request, maximumBytes, "PAYLOAD_TOO_LARGE")).toString("utf8");
}

export function applyCors(
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: readonly string[],
  allowedMethods = "GET, POST, OPTIONS",
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
  response.setHeader("Access-Control-Allow-Methods", allowedMethods);
}

export function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  correlationId: string,
  extraHeaders: Readonly<Record<string, string>> = {},
): true {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Correlation-Id": correlationId,
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
  return true;
}

async function readRequestBody(
  request: IncomingMessage,
  maximumBytes: number,
  tooLargeErrorCode: string,
): Promise<Buffer> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new Error("HTTP_BODY_LIMIT_INVALID");
  }
  const declaredLength = parseContentLength(request.headers["content-length"]);
  if (declaredLength !== undefined && declaredLength > maximumBytes) {
    throw new Error(tooLargeErrorCode);
  }
  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    receivedBytes += buffer.length;
    if (receivedBytes > maximumBytes) {
      throw new Error(tooLargeErrorCode);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, receivedBytes);
}

function parseContentLength(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) throw new Error("VALIDATION_FAILED");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("VALIDATION_FAILED");
  }
  return parsed;
}
