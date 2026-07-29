import type { IncomingMessage, ServerResponse } from "node:http";
import type { RealNameVerificationService } from "../application/real-name-verification-service.js";
import { createAppRequestContext, createRequestContext } from "./request-context.js";
import { mapError } from "./error-mapper.js";
import { readJsonObject, readRequestText } from "./http-boundary.js";

export function createAdultEligibilityHandler(dependencies: Readonly<{
  service: RealNameVerificationService;
  allowedOrigins: readonly string[];
  authenticateSession?: Parameters<typeof createAppRequestContext>[1];
}>) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith("/v1/internal-sandbox/")) return false;
    const isApp = url.pathname.startsWith("/v1/internal-sandbox/app/adult-eligibility");
    const isAdmin = url.pathname.startsWith("/v1/internal-sandbox/admin/adult-eligibility");
    const isProviderCallback =
      url.pathname === "/v1/internal-sandbox/provider-callbacks/adult-eligibility";
    if (!isApp && !isAdmin && !isProviderCallback) return false;
    const correlationId = header(request, "x-correlation-id") ?? crypto.randomUUID();
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") return send(response, 204, undefined, correlationId);
      if (isProviderCallback) {
        if (request.method !== "POST") return false;
        const rawBody = await readText(request);
        const callback = JSON.parse(rawBody) as { accountId?: unknown; callbackId?: unknown };
        const callbackId = text(callback.callbackId);
        if (idempotency(request) !== callbackId) throw new Error("VALIDATION_FAILED");
        return send(
          response,
          200,
          await dependencies.service.applyProviderCallback(
            text(callback.accountId),
            header(request, "x-provider-signature") ?? "",
            rawBody,
          ),
          correlationId,
        );
      }
      if (isAdmin) {
        const context = createRequestContext(request);
        if (url.pathname === "/v1/internal-sandbox/admin/adult-eligibility" && request.method === "GET") {
          return send(response, 200, await dependencies.service.listProviderTraces(), context.correlationId);
        }
        const traceMatch = url.pathname.match(/^\/v1\/internal-sandbox\/admin\/adult-eligibility\/([^/]+)$/);
        if (traceMatch && request.method === "GET") {
          return send(
            response,
            200,
            await dependencies.service.getProviderTrace(decodeURIComponent(traceMatch[1]!)),
            context.correlationId,
          );
        }
        const match = url.pathname.match(/^\/v1\/internal-sandbox\/admin\/adult-eligibility\/([^/]+)\/appeal-review$/);
        if (!match || request.method !== "POST") return false;
        const body = await readJson(request);
        return send(response, 200, await dependencies.service.reviewAppeal({
          accountId: decodeURIComponent(match[1]!),
          expectedVersion: integer(body.expectedVersion),
          decision: body.decision === "approve" ? "approve" : body.decision === "reject" ? "reject" : invalid(),
        }, context.reviewerId, idempotency(request)), context.correlationId);
      }
      const context = await createAppRequestContext(
        request,
        dependencies.authenticateSession,
        { requireBusinessAccess: false },
      );
      const action = url.pathname.replace("/v1/internal-sandbox/app/adult-eligibility", "").replace(/^\//, "");
      if (request.method === "GET" && !action) {
        return send(response, 200, await dependencies.service.get(context.accountId), context.correlationId);
      }
      const body = await readJson(request);
      const expectedVersion = integer(body.expectedVersion);
      const key = idempotency(request);
      if (request.method === "POST" && action === "authorization") {
        return send(response, 200, await dependencies.service.authorize({
          accountId: context.accountId,
          expectedVersion,
          privacyNoticeVersion: text(body.privacyNoticeVersion),
          identityProcessingAuthorized: truth(body.identityProcessingAuthorized),
          biometricProcessingAuthorized: truth(body.biometricProcessingAuthorized),
          thirdPartyProcessingAuthorized: truth(body.thirdPartyProcessingAuthorized),
        }, key), context.correlationId);
      }
      if (request.method === "POST" && action === "documents") {
        return send(response, 200, await dependencies.service.saveDocument({
          accountId: context.accountId,
          expectedVersion,
          side: body.side === "front" ? "front" : body.side === "back" ? "back" : invalid(),
          fileName: text(body.fileName),
          mimeType: body.mimeType === "image/jpeg" ? "image/jpeg" : body.mimeType === "image/png" ? "image/png" : invalid(),
          syntheticDocument: truth(body.syntheticDocument),
        }, key), context.correlationId);
      }
      if (request.method === "POST" && action === "submission") {
        return send(response, 200, await dependencies.service.submit({
          accountId: context.accountId,
          expectedVersion,
          syntheticFaceCapture: truth(body.syntheticFaceCapture),
          ...(typeof body.syntheticScenario === "string"
            ? { syntheticScenario: syntheticScenario(body.syntheticScenario) }
            : {}),
        }, key), context.correlationId);
      }
      if (request.method === "POST" && action === "sdk-session") {
        return send(response, 200, await dependencies.service.createSdkSession({
          accountId: context.accountId,
          expectedVersion,
          ...(typeof body.syntheticScenario === "string"
            ? { syntheticScenario: syntheticScenario(body.syntheticScenario) }
            : {}),
        }, key), context.correlationId);
      }
      if (request.method === "POST" && action === "provider-result") {
        return send(
          response,
          200,
          await dependencies.service.refreshProviderResult(context.accountId, key),
          context.correlationId,
        );
      }
      if (request.method === "POST" && action === "appeal") {
        return send(response, 200, await dependencies.service.submitAppeal({
          accountId: context.accountId,
          expectedVersion,
          reason: text(body.reason),
        }, key), context.correlationId);
      }
      return false;
    } catch (error) {
      const mapped = mapError(error, correlationId);
      return send(response, mapped.status, mapped.body, correlationId);
    }
  };
}

function applyCors(request: IncomingMessage, response: ServerResponse, allowed: readonly string[]) {
  const origin = request.headers.origin;
  if (origin && !allowed.includes(origin)) throw new Error("AUTHORIZATION_DENIED");
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}
function send(response: ServerResponse, status: number, body: unknown, correlationId: string): true {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Correlation-Id": correlationId });
  response.end(body === undefined ? undefined : JSON.stringify(body));
  return true;
}
async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return readJsonObject(request);
}
async function readText(request: IncomingMessage): Promise<string> {
  return readRequestText(request);
}
function idempotency(request: IncomingMessage): string {
  const value = header(request, "idempotency-key");
  if (!value || value.length < 8) throw new Error("VALIDATION_FAILED");
  return value;
}
function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === "string" ? value : undefined;
}
function integer(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0) return invalid();
  return value as number;
}
function text(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 500) return invalid();
  return value;
}
function truth(value: unknown): true {
  if (value !== true) return invalid();
  return true;
}
function invalid(): never { throw new Error("VALIDATION_FAILED"); }
function syntheticScenario(value: string) {
  const allowed = [
    "passed",
    "document_invalid",
    "document_expired",
    "underage",
    "liveness_failed",
    "face_mismatch",
    "provider_timeout",
    "provider_unavailable",
    "result_unknown",
  ] as const;
  const matched = allowed.find((item) => item === value);
  return matched ?? invalid();
}

