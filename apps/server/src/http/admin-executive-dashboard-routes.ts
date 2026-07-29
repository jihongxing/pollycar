import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  CreateExecutiveExportRequestCommand,
  ExecutiveExportDecisionCommand,
  ExecutiveExportRevocationCommand,
  RecordExecutiveDecisionOpinionCommand,
} from "@pollycar/contracts";
import type { AdminAccessActor } from "../application/admin-access-service.js";
import type { ExecutiveDashboardQueryService } from "../application/executive-dashboard-query-service.js";
import { mapError } from "./error-mapper.js";
import { readJsonObject } from "./http-boundary.js";

export function createAdminExecutiveDashboardHandler(
  dependencies: Readonly<{
    service: ExecutiveDashboardQueryService;
    allowedOrigins: readonly string[];
  }>,
) {
  return async function handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<boolean> {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (!pathname.startsWith("/v1/internal-sandbox/admin/executive-dashboard/")) return false;
    const correlationId = correlationIdFor(request);
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") return send(response, 204, undefined, correlationId);
      const actor = createActor(request, correlationId);

      if (request.method === "GET") {
        const queryResult = query(dependencies.service, actor, pathname);
        if (queryResult !== undefined) return send(response, 200, queryResult, correlationId);
      }

      if (request.method === "POST" && pathname === "/v1/internal-sandbox/admin/executive-dashboard/decision-opinions") {
        const body = await readJson(request);
        const command: RecordExecutiveDecisionOpinionCommand = {
          decisionItemId: requireString(body.decisionItemId),
          decisionCode: requireString(body.decisionCode),
          reasonCode: requireString(body.reasonCode),
          responsibleRole: requireString(body.responsibleRole),
          dueAt: requireString(body.dueAt),
          resourceVersion: requireInteger(body.resourceVersion),
          ...(typeof body.supersedesOpinionId === "string" ? { supersedesOpinionId: body.supersedesOpinionId } : {}),
        };
        return send(response, 200, dependencies.service.recordDecisionOpinion(actor, requireIdempotencyKey(request), command), correlationId);
      }

      if (request.method === "POST" && pathname === "/v1/internal-sandbox/admin/executive-dashboard/export-requests") {
        const body = await readJson(request);
        const domain = requireString(body.domain);
        if (!["operations", "finance", "safety_compliance"].includes(domain)) throw new Error("VALIDATION_FAILED");
        const command: CreateExecutiveExportRequestCommand = {
          domain: domain as CreateExecutiveExportRequestCommand["domain"],
          purpose: requireString(body.purpose),
          fieldSet: requireStringArray(body.fieldSet),
          windowStart: requireString(body.windowStart),
          windowEnd: requireString(body.windowEnd),
        };
        return send(response, 200, dependencies.service.createExportRequest(actor, requireIdempotencyKey(request), command), correlationId);
      }

      const exportAction = pathname.match(/^\/v1\/internal-sandbox\/admin\/executive-dashboard\/export-requests\/([^/]+)\/(privacy-decision|domain-decision|revocation)$/);
      if (request.method === "POST" && exportAction?.[1] && exportAction[2]) {
        const body = await readJson(request);
        const exportRequestId = decodeURIComponent(exportAction[1]);
        const idempotencyKey = requireIdempotencyKey(request);
        if (exportAction[2] === "revocation") {
          const command: ExecutiveExportRevocationCommand = {
            reasonCode: requireString(body.reasonCode),
            resourceVersion: requireInteger(body.resourceVersion),
          };
          return send(response, 200, dependencies.service.revokeExport(actor, exportRequestId, idempotencyKey, command), correlationId);
        }
        const decision = requireString(body.decision);
        if (!["approve", "reject"].includes(decision)) throw new Error("VALIDATION_FAILED");
        const command: ExecutiveExportDecisionCommand = {
          decision: decision as ExecutiveExportDecisionCommand["decision"],
          reasonCode: requireString(body.reasonCode),
          resourceVersion: requireInteger(body.resourceVersion),
        };
        const result = exportAction[2] === "privacy-decision"
          ? dependencies.service.reviewExportPrivacy(actor, exportRequestId, idempotencyKey, command)
          : dependencies.service.reviewExportDomain(actor, exportRequestId, idempotencyKey, command);
        return send(response, 200, result, correlationId);
      }

      return false;
    } catch (error) {
      const mapped = mapError(error, correlationId);
      return send(response, mapped.status, mapped.body, correlationId);
    }
  };
}

function query(
  service: ExecutiveDashboardQueryService,
  actor: AdminAccessActor,
  pathname: string,
): unknown {
  const base = "/v1/internal-sandbox/admin/executive-dashboard/";
  if (pathname === `${base}overview`) return service.getExecutiveOverview(actor);
  if (pathname === `${base}operations-health`) return service.getExecutiveOperationsHealth(actor);
  if (pathname === `${base}operator-health`) return service.getExecutiveOperatorHealth(actor);
  if (pathname === `${base}finance-safety`) return service.getExecutiveFinanceSafety(actor);
  if (pathname === `${base}safety-compliance`) return service.getExecutiveSafetyCompliance(actor);
  if (pathname === `${base}decision-items`) return service.getExecutiveDecisionItems(actor);
  if (pathname === `${base}metrics`) return service.getExecutiveMetricRegistry(actor);
  const drilldown = pathname.match(/^\/v1\/internal-sandbox\/admin\/executive-dashboard\/drilldowns\/(city|operator|product|time)\/([^/]+)$/);
  if (drilldown?.[1] && drilldown[2]) {
    return service.getExecutiveDrilldown(actor, drilldown[1] as "city" | "operator" | "product" | "time", decodeURIComponent(drilldown[2]));
  }
  const download = pathname.match(/^\/v1\/internal-sandbox\/admin\/executive-dashboard\/export-requests\/([^/]+)\/download$/);
  if (download?.[1]) return service.downloadExport(actor, decodeURIComponent(download[1]));
  return undefined;
}

function createActor(request: IncomingMessage, correlationId: string): AdminAccessActor {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Sandbox ")) throw new Error("AUTHENTICATION_REQUIRED");
  return {
    token: authorization.slice("Sandbox ".length),
    correlationId,
    requestId: typeof request.headers["x-request-id"] === "string" ? request.headers["x-request-id"] : randomUUID(),
  };
}

function applyCors(
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: readonly string[],
): void {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) throw new Error("AUTHORIZATION_DENIED");
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id, X-Request-Id");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return readJsonObject(request);
}

function requireString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) throw new Error("VALIDATION_FAILED");
  return value;
}

function requireStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50 || value.some((item) => typeof item !== "string" || item.length === 0 || item.length > 128)) {
    throw new Error("VALIDATION_FAILED");
  }
  return value as string[];
}

function requireInteger(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new Error("VALIDATION_FAILED");
  return Number(value);
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string" || value.length < 16 || value.length > 128) throw new Error("VALIDATION_FAILED");
  return value;
}

function correlationIdFor(request: IncomingMessage): string {
  const value = request.headers["x-correlation-id"];
  return typeof value === "string" && value.length <= 128 ? value : randomUUID();
}
