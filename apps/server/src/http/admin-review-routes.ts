import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  AdminReviewMaterialReason,
  RejectVehicleReviewAdminCommand,
  ReleaseAdminReviewTaskCommand,
} from "@pollycar/contracts";
import type { AdminReviewTaskService } from "../application/admin-review-task-service.js";
import { createRequestContext } from "./request-context.js";
import { mapError } from "./error-mapper.js";

type RouteDependencies = Readonly<{
  service: AdminReviewTaskService;
  allowedOrigins: readonly string[];
}>;

const materialReasons = new Set<AdminReviewMaterialReason>([
  "insurance_expiry_incomplete",
  "authorization_evidence_incomplete",
  "synthetic_attachment_invalid",
]);
const releaseReasons = new Set<ReleaseAdminReviewTaskCommand["reasonCode"]>([
  "reviewer_unavailable",
  "wrong_queue",
  "needs_supervisor",
]);
const rejectionReasons = new Set<RejectVehicleReviewAdminCommand["reasonCode"]>([
  "vehicle_age_exceeded",
  "vehicle_mileage_exceeded",
  "insurance_requirement_not_met",
  "authorization_remaining_insufficient",
]);

export function createAdminReviewHandler(dependencies: RouteDependencies) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!url.pathname.startsWith("/v1/internal-sandbox/admin/")) return false;
    const correlationId =
      typeof request.headers["x-correlation-id"] === "string"
        ? request.headers["x-correlation-id"]
        : crypto.randomUUID();
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") {
        response.writeHead(204, commonHeaders(correlationId));
        response.end();
        return true;
      }
      const context = createRequestContext(request);
      const taskMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/review-tasks\/([^/]+)(?:\/(.+))?$/,
      );
      if (request.method === "GET" && url.pathname === "/v1/internal-sandbox/admin/review-tasks") {
        return send(response, 200, await dependencies.service.listTasks(), context.correlationId);
      }
      if (taskMatch) {
        const taskId = decodeURIComponent(taskMatch[1]!);
        const action = taskMatch[2];
        if (request.method === "GET" && !action) {
          return send(
            response,
            200,
            await dependencies.service.getTask(taskId, context.reviewerId),
            context.correlationId,
          );
        }
        if (request.method === "GET" && action === "audit") {
          await dependencies.service.getTask(taskId, context.reviewerId);
          return send(
            response,
            200,
            await dependencies.service.listAudit(taskId),
            context.correlationId,
          );
        }
        const idempotencyKey = requireIdempotencyKey(request);
        const body = await readJson(request);
        if (request.method === "POST" && action === "claim") {
          return send(
            response,
            200,
            await dependencies.service.claimTask({
              reviewerId: context.reviewerId,
              taskId,
              expectedTaskVersion: requireNumber(body, "expectedTaskVersion"),
              idempotencyKey,
            }),
            context.correlationId,
          );
        }
        if (request.method === "POST" && action === "lease/renew") {
          return send(
            response,
            200,
            await dependencies.service.renewTask({
              reviewerId: context.reviewerId,
              taskId,
              expectedTaskVersion: requireNumber(body, "expectedTaskVersion"),
              idempotencyKey,
            }),
            context.correlationId,
          );
        }
        if (request.method === "POST" && action === "release") {
          const reasonCode = body.reasonCode;
          if (typeof reasonCode !== "string" || !releaseReasons.has(reasonCode as ReleaseAdminReviewTaskCommand["reasonCode"])) {
            throw new Error("VALIDATION_FAILED");
          }
          return send(
            response,
            200,
            await dependencies.service.releaseTask({
              reviewerId: context.reviewerId,
              taskId,
              reasonCode: reasonCode as ReleaseAdminReviewTaskCommand["reasonCode"],
              expectedTaskVersion: requireNumber(body, "expectedTaskVersion"),
              idempotencyKey,
            }),
            context.correlationId,
          );
        }
        if (request.method === "POST" && action === "material-request-preview") {
          const reason = requireMaterialReason(body);
          return send(
            response,
            200,
            await dependencies.service.previewMaterial(
              taskId,
              context.reviewerId,
              reason,
              idempotencyKey,
            ),
            context.correlationId,
          );
        }
        if (request.method === "POST" && action === "material-request") {
          const reason = requireMaterialReason(body);
          if (body.previewConfirmed !== true) throw new Error("ADMIN_DECISION_REASON_REQUIRED");
          return send(
            response,
            200,
            await dependencies.service.requestMaterial({
              reviewerId: context.reviewerId,
              taskId,
              reason,
              previewConfirmed: true,
              expectedTaskVersion: requireNumber(body, "expectedTaskVersion"),
              expectedVehicleReviewVersion: requireNumber(body, "expectedVehicleReviewVersion"),
              idempotencyKey,
            }),
            context.correlationId,
          );
        }
        if (request.method === "POST" && action === "approve") {
          if (body.previewConfirmed !== true || body.reasonCode !== "approved_standard") {
            throw new Error("ADMIN_DECISION_REASON_REQUIRED");
          }
          return send(
            response,
            200,
            await dependencies.service.approveVehicle({
              reviewerId: context.reviewerId,
              taskId,
              reasonCode: "approved_standard",
              previewConfirmed: true,
              expectedTaskVersion: requireNumber(body, "expectedTaskVersion"),
              expectedVehicleReviewVersion: requireNumber(body, "expectedVehicleReviewVersion"),
              idempotencyKey,
            }),
            context.correlationId,
          );
        }
        if (request.method === "POST" && action === "reject") {
          if (body.previewConfirmed !== true) throw new Error("ADMIN_DECISION_REASON_REQUIRED");
          const reasonCode = requireRejectionReason(body);
          return send(
            response,
            200,
            await dependencies.service.rejectVehicle({
              reviewerId: context.reviewerId,
              taskId,
              reasonCode,
              previewConfirmed: true,
              expectedTaskVersion: requireNumber(body, "expectedTaskVersion"),
              expectedVehicleReviewVersion: requireNumber(body, "expectedVehicleReviewVersion"),
              idempotencyKey,
            }),
            context.correlationId,
          );
        }
      }
      const resultMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/idempotency-results\/([^/]+)$/,
      );
      if (request.method === "GET" && resultMatch) {
        const context = createRequestContext(request);
        const result = dependencies.service.recoverResult(
          context.reviewerId,
          decodeURIComponent(resultMatch[1]!),
        );
        if (!result) throw new Error("IDEMPOTENT_RESULT_NOT_FOUND");
        return send(response, 200, result, context.correlationId);
      }
      return sendError(response, new Error("ADMIN_TASK_NOT_FOUND"), correlationId);
    } catch (error) {
      return sendError(response, error, correlationId);
    }
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

function commonHeaders(correlationId: string): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Correlation-Id": correlationId,
  };
}

function send(response: ServerResponse, status: number, body: unknown, correlationId: string): true {
  response.writeHead(status, commonHeaders(correlationId));
  response.end(JSON.stringify(body));
  return true;
}

function sendError(response: ServerResponse, error: unknown, correlationId: string): true {
  const mapped = mapError(error, correlationId);
  return send(response, mapped.status, mapped.body, correlationId);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("VALIDATION_FAILED");
  }
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const key = request.headers["idempotency-key"];
  if (typeof key !== "string" || key.length < 8 || key.length > 128) {
    throw new Error("VALIDATION_FAILED");
  }
  return key;
}

function requireNumber(body: Record<string, unknown>, field: string): number {
  const value = body[field];
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error("VALIDATION_FAILED");
  return value as number;
}

function requireMaterialReason(body: Record<string, unknown>): AdminReviewMaterialReason {
  const reason = body.reason;
  if (typeof reason !== "string" || !materialReasons.has(reason as AdminReviewMaterialReason)) {
    throw new Error("VALIDATION_FAILED");
  }
  return reason as AdminReviewMaterialReason;
}

function requireRejectionReason(
  body: Record<string, unknown>,
): RejectVehicleReviewAdminCommand["reasonCode"] {
  const reasonCode = body.reasonCode;
  if (
    typeof reasonCode !== "string" ||
    !rejectionReasons.has(reasonCode as RejectVehicleReviewAdminCommand["reasonCode"])
  ) {
    throw new Error("ADMIN_DECISION_REASON_REQUIRED");
  }
  return reasonCode as RejectVehicleReviewAdminCommand["reasonCode"];
}
