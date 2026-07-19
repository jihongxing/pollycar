import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AdminOperatorManagementCommand } from "@pollycar/contracts";
import type { AdminAccessActor } from "../application/admin-access-service.js";
import type { AdminOperatorManagementService } from "../application/admin-operator-management-service.js";
import { mapError } from "./error-mapper.js";

const basePath = "/v1/internal-sandbox/admin/operator-management";

export function createAdminOperatorManagementHandler(
  dependencies: Readonly<{
    service: AdminOperatorManagementService;
    allowedOrigins: readonly string[];
  }>,
) {
  return async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<boolean> => {
    if (!request.url?.startsWith(basePath)) return false;
    const correlationId = correlationIdFor(request);
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") {
        return send(response, 204, undefined, correlationId);
      }
      const actor = createActor(request, correlationId);
      const url = new URL(request.url, "http://127.0.0.1");
      if (request.method === "POST" && url.pathname === `${basePath}/commands`) {
        return send(
          response,
          200,
          dependencies.service.executeCommand(
            actor,
            requireIdempotencyKey(request),
            parseCommand(await readJson(request)),
          ),
          correlationId,
        );
      }
      const route = matchQueryRoute(url.pathname);
      if (!route || request.method !== "GET") return false;
      const body =
        route.resourceType === "operators"
          ? dependencies.service.getOperator360(actor, route.resourceId)
          : route.resourceType === "onboarding-cases"
            ? dependencies.service.getOnboardingCase(actor, route.resourceId)
            : route.resourceType === "drivers"
              ? dependencies.service.getDriver360(actor, route.resourceId)
              : route.resourceType === "vehicles"
                ? dependencies.service.getVehicle360(actor, route.resourceId)
                : dependencies.service.getMigrationCase(actor, route.resourceId);
      return send(response, 200, body, correlationId);
    } catch (error) {
      const mapped = mapError(error, correlationId);
      return send(response, mapped.status, mapped.body, correlationId);
    }
  };
}

function matchQueryRoute(pathname: string):
  | Readonly<{
      resourceType:
        | "operators"
        | "onboarding-cases"
        | "drivers"
        | "vehicles"
        | "migrations";
      resourceId: string;
    }>
  | undefined {
  const match = pathname.match(
    /^\/v1\/internal-sandbox\/admin\/operator-management\/(operators|onboarding-cases|drivers|vehicles|migrations)\/([^/]+)$/,
  );
  if (!match?.[1] || !match[2]) return undefined;
  return {
    resourceType: match[1] as
      | "operators"
      | "onboarding-cases"
      | "drivers"
      | "vehicles"
      | "migrations",
    resourceId: decodeURIComponent(match[2]),
  };
}

function parseCommand(
  body: Record<string, unknown>,
): AdminOperatorManagementCommand {
  const type = requireString(body.type);
  const resourceVersion = requireInteger(body.resourceVersion);
  if (type === "request_onboarding_changes") {
    return {
      type,
      onboardingCaseId: requireString(body.onboardingCaseId),
      reason: requireString(body.reason),
      resourceVersion,
    };
  }
  if (type === "approve_onboarding") {
    return {
      type,
      onboardingCaseId: requireString(body.onboardingCaseId),
      resourceVersion,
    };
  }
  if (type === "grant_city_capability") {
    const capabilityType = requireString(body.capabilityType);
    if (
      ![
        "driver_operations",
        "vehicle_operations",
        "trip_coordination",
        "support_coordination",
        "safety_collaboration",
      ].includes(capabilityType)
    ) {
      throw new Error("VALIDATION_FAILED");
    }
    return {
      type,
      operatorId: requireString(body.operatorId),
      cityCode: requireString(body.cityCode),
      capabilityType:
        capabilityType as Extract<
          AdminOperatorManagementCommand,
          { type: "grant_city_capability" }
        >["capabilityType"],
      resourceVersion,
    };
  }
  if (type === "change_operator_lifecycle") {
    const targetState = requireString(body.targetState);
    if (
      ![
        "candidate",
        "onboarding_review",
        "pending_activation",
        "active",
        "restricted",
        "suspended",
        "exit_pending",
        "exited",
      ].includes(targetState)
    ) {
      throw new Error("VALIDATION_FAILED");
    }
    return {
      type,
      operatorId: requireString(body.operatorId),
      targetState:
        targetState as Extract<
          AdminOperatorManagementCommand,
          { type: "change_operator_lifecycle" }
        >["targetState"],
      reason: requireString(body.reason),
      resourceVersion,
    };
  }
  if (type === "acknowledge_primary_operator_migration") {
    const side = requireString(body.side);
    if (side !== "source" && side !== "target") {
      throw new Error("VALIDATION_FAILED");
    }
    return {
      type,
      migrationCaseId: requireString(body.migrationCaseId),
      side,
      resourceVersion,
    };
  }
  if (type === "review_primary_operator_migration") {
    return {
      type,
      migrationCaseId: requireString(body.migrationCaseId),
      resourceVersion,
    };
  }
  if (type === "schedule_primary_operator_migration") {
    return {
      type,
      migrationCaseId: requireString(body.migrationCaseId),
      effectiveAt: requireString(body.effectiveAt),
      resourceVersion,
    };
  }
  if (type === "apply_primary_operator_migration") {
    return {
      type,
      migrationCaseId: requireString(body.migrationCaseId),
      resourceVersion,
    };
  }
  throw new Error("VALIDATION_FAILED");
}

function createActor(
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
  if (typeof value !== "string" || value.length === 0 || value.length > 256) {
    throw new Error("VALIDATION_FAILED");
  }
  return value;
}

function requireInteger(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error("VALIDATION_FAILED");
  }
  return Number(value);
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
