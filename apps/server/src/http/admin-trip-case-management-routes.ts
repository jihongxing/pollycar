import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  AdminEvidenceFieldResult,
  AdminTripCaseManagementCommand,
} from "@pollycar/contracts";
import type { AdminAccessActor } from "../application/admin-access-service.js";
import type { AdminTripCaseManagementService } from "../application/admin-trip-case-management-service.js";
import { mapError } from "./error-mapper.js";

const basePath = "/v1/internal-sandbox/admin/trip-case-management";

export function createAdminTripCaseManagementHandler(
  dependencies: Readonly<{
    service: AdminTripCaseManagementService;
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
      if (request.method !== "GET") return false;
      if (url.pathname === `${basePath}/trip-operations`) {
        return send(
          response,
          200,
          dependencies.service.getTripOperationsCenter(actor),
          correlationId,
        );
      }
      const route = matchQueryRoute(url.pathname);
      if (!route) return false;
      const body =
        route.resourceType === "trips"
          ? dependencies.service.getTrip360(actor, route.resourceId)
          : route.resourceType === "support-cases"
            ? dependencies.service.getSupportCase(actor, route.resourceId)
            : route.resourceType === "safety-cases"
              ? dependencies.service.getSafetyInvestigation(actor, route.resourceId)
              : route.resourceType === "recovery-tasks"
                ? dependencies.service.getCommandRecoveryTask(actor, route.resourceId)
                : route.field
                  ? dependencies.service.readEvidenceField(
                      actor,
                      route.resourceId,
                      route.field,
                    )
                  : dependencies.service.getEvidenceGrant(actor, route.resourceId);
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
        | "trips"
        | "support-cases"
        | "safety-cases"
        | "evidence-grants"
        | "recovery-tasks";
      resourceId: string;
      field?: AdminEvidenceFieldResult["field"];
    }>
  | undefined {
  const evidenceField = pathname.match(
    /^\/v1\/internal-sandbox\/admin\/trip-case-management\/evidence-grants\/([^/]+)\/fields\/([^/]+)$/,
  );
  if (evidenceField?.[1] && evidenceField[2]) {
    const field = evidenceField[2];
    if (
      !["chat_reference", "raw_chat", "location_window", "full_location_trace"].includes(
        field,
      )
    ) {
      throw new Error("VALIDATION_FAILED");
    }
    return {
      resourceType: "evidence-grants",
      resourceId: decodeURIComponent(evidenceField[1]),
      field: field as AdminEvidenceFieldResult["field"],
    };
  }
  const match = pathname.match(
    /^\/v1\/internal-sandbox\/admin\/trip-case-management\/(trips|support-cases|safety-cases|evidence-grants|recovery-tasks)\/([^/]+)$/,
  );
  if (!match?.[1] || !match[2]) return undefined;
  return {
    resourceType: match[1] as
      | "trips"
      | "support-cases"
      | "safety-cases"
      | "evidence-grants"
      | "recovery-tasks",
    resourceId: decodeURIComponent(match[2]),
  };
}

function parseCommand(body: Record<string, unknown>): AdminTripCaseManagementCommand {
  const type = requireString(body.type);
  if (type === "request_evidence_access") {
    const purposeCode = requireString(body.purposeCode);
    if (!["safety_investigation", "appeal_review", "emergency_response"].includes(purposeCode)) {
      throw new Error("VALIDATION_FAILED");
    }
    const requestedFields = requireStringArray(body.requestedFields);
    if (
      requestedFields.some(
        (field) =>
          !["chat_reference", "raw_chat", "location_window", "full_location_trace"].includes(
            field,
          ),
      )
    ) {
      throw new Error("VALIDATION_FAILED");
    }
    return {
      type,
      safetyCaseId: requireString(body.safetyCaseId),
      ticketId: requireString(body.ticketId),
      purposeCode: purposeCode as Extract<
        AdminTripCaseManagementCommand,
        { type: "request_evidence_access" }
      >["purposeCode"],
      requestedFields: requestedFields as Extract<
        AdminTripCaseManagementCommand,
        { type: "request_evidence_access" }
      >["requestedFields"],
      ttlMinutes: requireInteger(body.ttlMinutes),
    };
  }
  const resourceVersion = requireInteger(body.resourceVersion);
  switch (type) {
    case "triage_trip_operation":
      return { type, taskId: requireString(body.taskId), resourceVersion };
    case "request_trip_domain_action":
      return {
        type,
        taskId: requireString(body.taskId),
        expectedTripVersion: requireInteger(body.expectedTripVersion),
        reasonCode: requireString(body.reasonCode),
        resourceVersion,
      };
    case "update_support_case":
      return {
        type,
        supportCaseId: requireString(body.supportCaseId),
        targetState: requireSupportState(body.targetState),
        resourceVersion,
      };
    case "escalate_support_case":
      return {
        type,
        supportCaseId: requireString(body.supportCaseId),
        target: requireEscalationTarget(body.target),
        resourceVersion,
      };
    case "submit_safety_investigation":
      return { type, safetyCaseId: requireString(body.safetyCaseId), resourceVersion };
    case "review_safety_restoration":
      return {
        type,
        safetyCaseId: requireString(body.safetyCaseId),
        outcome: requireRestorationOutcome(body.outcome),
        resourceVersion,
      };
    case "approve_evidence_access":
    case "revoke_evidence_access":
      return { type, grantId: requireString(body.grantId), resourceVersion };
    case "query_command_recovery":
      return {
        type,
        recoveryTaskId: requireString(body.recoveryTaskId),
        resourceVersion,
      };
    default:
      throw new Error("VALIDATION_FAILED");
  }
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
  if (!token || token.length > 128) throw new Error("AUTHENTICATION_REQUIRED");
  const requestId = request.headers["x-request-id"];
  return {
    token,
    correlationId,
    requestId:
      typeof requestId === "string" && requestId.length <= 128
        ? requestId
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

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
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

function requireStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 4) {
    throw new Error("VALIDATION_FAILED");
  }
  return value.map(requireString);
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

function requireSupportState(
  value: unknown,
): Extract<AdminTripCaseManagementCommand, { type: "update_support_case" }>["targetState"] {
  const state = requireString(value);
  if (
    ![
      "open",
      "assigned",
      "investigating",
      "awaiting_user",
      "awaiting_internal",
      "escalated",
      "resolved",
      "closed",
      "reopened",
    ].includes(state)
  ) {
    throw new Error("VALIDATION_FAILED");
  }
  return state as Extract<
    AdminTripCaseManagementCommand,
    { type: "update_support_case" }
  >["targetState"];
}

function requireEscalationTarget(
  value: unknown,
): Extract<AdminTripCaseManagementCommand, { type: "escalate_support_case" }>["target"] {
  const target = requireString(value);
  if (!["operations", "safety", "finance"].includes(target)) {
    throw new Error("VALIDATION_FAILED");
  }
  return target as Extract<
    AdminTripCaseManagementCommand,
    { type: "escalate_support_case" }
  >["target"];
}

function requireRestorationOutcome(
  value: unknown,
): Extract<AdminTripCaseManagementCommand, { type: "review_safety_restoration" }>["outcome"] {
  const outcome = requireString(value);
  if (!["restore_access", "uphold_freeze"].includes(outcome)) {
    throw new Error("VALIDATION_FAILED");
  }
  return outcome as Extract<
    AdminTripCaseManagementCommand,
    { type: "review_safety_restoration" }
  >["outcome"];
}
