import type { IncomingMessage, ServerResponse } from "node:http";
import type { DriverLivenessResultCategory } from "@pollycar/contracts";
import type { DriverLivenessService } from "../application/driver-liveness-service.js";
import { readJsonObject } from "./http-boundary.js";
import { mapError } from "./error-mapper.js";
import { createAppRequestContext } from "./request-context.js";

const allowedSyntheticScenarios: readonly DriverLivenessResultCategory[] = [
  "passed",
  "action_mismatch",
  "spoof_suspected",
  "face_not_detected",
  "camera_denied",
  "provider_timeout",
  "provider_unavailable",
  "result_unknown",
];

export function createDriverLivenessHandler(dependencies: {
  service: DriverLivenessService;
  allowedOrigins: readonly string[];
}) {
  return async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://internal");
    const appPath = url.pathname.startsWith(
      "/v1/internal-sandbox/app/driver/liveness/",
    );
    const providerPath =
      url.pathname ===
      "/v1/internal-sandbox/provider-callbacks/driver-liveness";
    if (!appPath && !providerPath) return false;
    const correlationId = String(
      request.headers["x-correlation-id"] ?? crypto.randomUUID(),
    );
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") {
        return send(response, 204, undefined, correlationId);
      }
      if (providerPath) {
        if (request.method !== "POST") return false;
        if (
          request.headers["x-provider-signature"] !==
          "Synthetic signed-driver-liveness-provider"
        ) {
          throw new Error("AUTHORIZATION_DENIED");
        }
        const body = await readLivenessBody(request);
        assertOnlyKeys(body, [
          "callbackId",
          "challengeId",
          "providerSessionReference",
          "occurredAt",
          "status",
          "policyVersion",
          "failureCode",
          "requestDigest",
        ]);
        const status = body.status;
        if (
          status !== "passed" &&
          status !== "failed" &&
          status !== "pending" &&
          status !== "unknown"
        ) {
          throw new Error("VALIDATION_FAILED");
        }
        return send(
          response,
          200,
          await dependencies.service.receiveProviderResult(
            requireString(body, "challengeId", 160),
            status,
            requireString(body, "providerSessionReference", 256),
            requireIdempotencyKey(request),
          ),
          correlationId,
        );
      }

      const context = await createAppRequestContext(request);
      const collectionPath =
        "/v1/internal-sandbox/app/driver/liveness/challenges";
      if (url.pathname === collectionPath && request.method === "POST") {
        const body = await readLivenessBody(request);
        assertOnlyKeys(body, ["deviceId"]);
        return send(
          response,
          200,
          await dependencies.service.createChallenge(
            {
              accountId: context.accountId,
              accountSessionId: context.accountSessionId,
              deviceId: requireString(body, "deviceId", 128),
            },
            requireIdempotencyKey(request),
          ),
          context.correlationId,
        );
      }

      const match = url.pathname.match(
        /^\/v1\/internal-sandbox\/app\/driver\/liveness\/challenges\/([^/]+)(\/complete)?$/,
      );
      if (!match) return false;
      const challengeId = decodeURIComponent(match[1]!);
      const binding = {
        accountId: context.accountId,
        accountSessionId: context.accountSessionId,
        deviceId: requireDeviceId(request),
      };
      if (!match[2] && request.method === "GET") {
        return send(
          response,
          200,
          await dependencies.service.getChallenge(binding, challengeId),
          context.correlationId,
        );
      }
      if (match[2] && request.method === "POST") {
        const body = await readLivenessBody(request);
        assertOnlyKeys(body, ["syntheticScenario"]);
        const scenario = body.syntheticScenario;
        if (
          typeof scenario !== "string" ||
          !allowedSyntheticScenarios.includes(
            scenario as DriverLivenessResultCategory,
          )
        ) {
          throw new Error("VALIDATION_FAILED");
        }
        return send(
          response,
          200,
          await dependencies.service.completeSynthetic(
            binding,
            challengeId,
            scenario as DriverLivenessResultCategory,
            requireIdempotencyKey(request),
          ),
          context.correlationId,
        );
      }
      return false;
    } catch (error) {
      const mapped = mapError(error, correlationId);
      return send(response, mapped.status, mapped.body, correlationId);
    }
  };
}

function requireDeviceId(request: IncomingMessage): string {
  const value = request.headers["x-device-id"];
  if (typeof value !== "string" || value.length < 8 || value.length > 128) {
    throw new Error("VALIDATION_FAILED");
  }
  return value;
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string" || value.length < 8 || value.length > 128) {
    throw new Error("VALIDATION_FAILED");
  }
  return value;
}

function requireString(
  body: Record<string, unknown>,
  field: string,
  maximumLength: number,
): string {
  const value = body[field];
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximumLength
  ) {
    throw new Error("VALIDATION_FAILED");
  }
  return value;
}

function assertOnlyKeys(
  body: Record<string, unknown>,
  allowedKeys: readonly string[],
): void {
  if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
    throw new Error("REAL_BIOMETRIC_DATA_FORBIDDEN");
  }
}

function applyCors(
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: readonly string[],
) {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    throw new Error("AUTHORIZATION_DENIED");
  }
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id, X-Device-Id, X-Provider-Signature",
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
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Correlation-Id": correlationId,
  });
  response.end(body === undefined ? undefined : JSON.stringify(body));
  return true;
}

function readLivenessBody(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  return readJsonObject(request, { maximumBytes: 16 * 1024 });
}
