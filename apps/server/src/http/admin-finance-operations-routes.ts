import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AdminFinanceOperationsCommand } from "@pollycar/contracts";
import type { AdminAccessActor } from "../application/admin-access-service.js";
import type { AdminFinanceOperationsService } from "../application/admin-finance-operations-service.js";
import { mapError } from "./error-mapper.js";

const basePath = "/v1/internal-sandbox/admin/finance-operations";

export function createAdminFinanceOperationsHandler(
  dependencies: Readonly<{
    service: AdminFinanceOperationsService;
    allowedOrigins: readonly string[];
  }>,
) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    if (!request.url?.startsWith(basePath)) return false;
    const correlationId = correlationIdFor(request);
    try {
      applyCors(request, response, dependencies.allowedOrigins);
      if (request.method === "OPTIONS") return send(response, 204, undefined, correlationId);
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
      if (url.pathname === `${basePath}/operations-center`) {
        return send(response, 200, dependencies.service.getOperationsCenter(actor), correlationId);
      }
      const route = matchQueryRoute(url.pathname);
      if (!route) return false;
      const result =
        route.resourceType === "allocation-settlements"
          ? dependencies.service.getAllocationSettlement(actor, route.resourceId)
          : route.resourceType === "driver-payouts"
            ? dependencies.service.getDriverPayout(actor, route.resourceId)
            : route.resourceType === "refund-reversals"
              ? dependencies.service.getRefundReversal(actor, route.resourceId)
              : route.resourceType === "reconciliation-runs"
                ? dependencies.service.getReconciliationFundCases(actor, route.resourceId)
                : route.resourceType === "business-days"
                  ? dependencies.service.getBusinessDayClose(actor, route.resourceId)
                  : dependencies.service.getLedgerTransaction(actor, route.resourceId);
      return send(response, 200, result, correlationId);
    } catch (error) {
      const mapped = mapError(error, correlationId);
      return send(response, mapped.status, mapped.body, correlationId);
    }
  };
}

function matchQueryRoute(pathname: string): Readonly<{
  resourceType:
    | "allocation-settlements"
    | "driver-payouts"
    | "refund-reversals"
    | "reconciliation-runs"
    | "business-days"
    | "ledger-transactions";
  resourceId: string;
}> | undefined {
  const match = pathname.match(
    /^\/v1\/internal-sandbox\/admin\/finance-operations\/(allocation-settlements|driver-payouts|refund-reversals|reconciliation-runs|business-days|ledger-transactions)\/([^/]+)$/,
  );
  if (!match?.[1] || !match[2]) return undefined;
  return {
    resourceType: match[1] as
      | "allocation-settlements"
      | "driver-payouts"
      | "refund-reversals"
      | "reconciliation-runs"
      | "business-days"
      | "ledger-transactions",
    resourceId: decodeURIComponent(match[2]),
  };
}

function parseCommand(body: Record<string, unknown>): AdminFinanceOperationsCommand {
  const type = requireString(body.type);
  const allowed = [
    "prepare_operator_settlement",
    "review_operator_settlement",
    "prepare_driver_payout",
    "review_driver_payout",
    "request_driver_payout",
    "request_refund",
    "request_full_reversal",
    "submit_reconciliation_resolution",
    "review_reconciliation_resolution",
    "prepare_business_day_close",
    "review_business_day_close",
    "query_finance_command_recovery",
  ] as const;
  if (!allowed.includes(type as typeof allowed[number])) throw new Error("VALIDATION_FAILED");
  const common = {
    type: type as AdminFinanceOperationsCommand["type"],
    resourceId: requireString(body.resourceId),
    resourceVersion: requireInteger(body.resourceVersion),
    reasonCode: requireString(body.reasonCode),
  };
  if (type === "submit_reconciliation_resolution") {
    return {
      ...common,
      type,
      evidenceReference: requireString(body.evidenceReference),
    };
  }
  return common as AdminFinanceOperationsCommand;
}

function createActor(request: IncomingMessage, correlationId: string): AdminAccessActor {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Sandbox ")) throw new Error("AUTHENTICATION_REQUIRED");
  return {
    token: authorization.slice("Sandbox ".length),
    correlationId,
    requestId:
      typeof request.headers["x-request-id"] === "string"
        ? request.headers["x-request-id"]
        : randomUUID(),
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
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new Error("VALIDATION_FAILED");
  }
}

function requireString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 256) throw new Error("VALIDATION_FAILED");
  return value;
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
  const header = request.headers["x-correlation-id"];
  return typeof header === "string" && header.length <= 128 ? header : randomUUID();
}
