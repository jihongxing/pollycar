import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  AdminAuditAction,
  AdminAuditDirectoryQuery,
  AdminAuditResourceKind,
  AdminCaseAction,
  AdminCaseDirectoryQuery,
  AdminCaseKind,
  AdminDataReportDirectoryQuery,
  AdminDriverDirectoryQuery,
  AdminExecutiveAction,
  AdminExecutiveDirectoryQuery,
  AdminExecutiveResourceKind,
  AdminFinanceAction,
  AdminFinanceDirectoryQuery,
  AdminFinanceResourceKind,
  AdminMembershipDirectoryQuery,
  AdminOperatorAction,
  AdminOperatorDirectoryQuery,
  AdminOperationsTaskAction,
  AdminOperationsTaskQuery,
  AdminTripDirectoryQuery,
  AdminTripOperationAction,
  AdminVehicleDirectoryQuery,
  AdminVehicleReviewAction,
  AdminVehicleReviewActionCommand,
} from "@pollycar/contracts";
import type { AdminAccessService } from "../application/admin-access-service.js";
import type { AdminAuthenticationService } from "../application/admin-authentication-service.js";
import type { AdminOperatorManagementService } from "../application/admin-operator-management-service.js";
import type { AdminReviewTaskService } from "../application/admin-review-task-service.js";
import type { AdminTripCaseManagementService } from "../application/admin-trip-case-management-service.js";
import type { AdminFinanceOperationsService } from "../application/admin-finance-operations-service.js";
import type { ExecutiveDashboardQueryService } from "../application/executive-dashboard-query-service.js";
import { mapError } from "./error-mapper.js";
import { readJsonObject } from "./http-boundary.js";

const basePath = "/v1/internal-sandbox/admin";

export function createAdminAuthenticationHandler(
  dependencies: Readonly<{
    service: AdminAuthenticationService;
    operatorManagement: AdminOperatorManagementService;
    adminReviews: AdminReviewTaskService;
    tripCaseManagement: AdminTripCaseManagementService;
    financeOperations: AdminFinanceOperationsService;
    executiveDashboard: ExecutiveDashboardQueryService;
    adminAccess: AdminAccessService;
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
      if (request.method === "OPTIONS") return send(response, 204, undefined, correlationId);
      const url = new URL(request.url, "http://127.0.0.1");
      const invitationMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/auth\/invitations\/([^/]+)$/,
      );
      if (invitationMatch?.[1] && request.method === "GET") {
        return send(response, 200, dependencies.service.getInvitation(decodeURIComponent(invitationMatch[1])), correlationId);
      }
      const activationMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/auth\/invitations\/([^/]+)\/activate$/,
      );
      if (activationMatch?.[1] && request.method === "POST") {
        const body = await readJson(request);
        return send(
          response,
          200,
          dependencies.service.activateInvitation(
            decodeURIComponent(activationMatch[1]),
            requireString(body.password),
            requireString(body.totpCode),
          ),
          correlationId,
        );
      }
      if (url.pathname === `${basePath}/auth/login` && request.method === "POST") {
        const body = await readJson(request);
        return send(response, 200, dependencies.service.startLogin(requireString(body.workEmail), requireString(body.password)), correlationId);
      }
      if (url.pathname === `${basePath}/auth/mfa/verify` && request.method === "POST") {
        const body = await readJson(request);
        return send(response, 200, dependencies.service.verifyMfa(requireString(body.challengeId), requireString(body.totpCode)), correlationId);
      }
      if (url.pathname === `${basePath}/auth/work-identities/select` && request.method === "POST") {
        const body = await readJson(request);
        return send(response, 200, dependencies.service.selectWorkIdentity(requireString(body.selectionToken), requireString(body.workIdentityId)), correlationId);
      }
      if (url.pathname === `${basePath}/auth/work-identities/switch` && request.method === "POST") {
        const body = await readJson(request);
        return send(response, 200, dependencies.service.switchWorkIdentity(requireBearer(request), requireString(body.workIdentityId)), correlationId);
      }
      if (url.pathname === `${basePath}/auth/session/refresh` && request.method === "POST") {
        const body = await readJson(request);
        return send(response, 200, dependencies.service.refreshSession(requireString(body.refreshToken)), correlationId);
      }
      if (url.pathname === `${basePath}/auth/session/logout` && request.method === "POST") {
        dependencies.service.logout(requireBearer(request));
        return send(response, 204, undefined, correlationId);
      }
      if (url.pathname === `${basePath}/navigation` && request.method === "GET") {
        return send(response, 200, dependencies.service.getNavigation(requireBearer(request)), correlationId);
      }
      if (url.pathname === `${basePath}/search` && request.method === "GET") {
        return send(response, 200, await dependencies.service.searchAcrossDomains(
          requireBearer(request),
          parseGlobalSearchQuery(url),
          {
            operatorManagement: dependencies.operatorManagement,
            adminReviews: dependencies.adminReviews,
            tripCaseManagement: dependencies.tripCaseManagement,
            financeOperations: dependencies.financeOperations,
            executiveDashboard: dependencies.executiveDashboard,
            adminAccess: dependencies.adminAccess,
            requestContext: requestContext(request, correlationId),
          },
        ), correlationId);
      }
      if (url.pathname === `${basePath}/memberships` && request.method === "GET") {
        return send(response, 200, dependencies.service.listMemberships(
          requireBearer(request),
          parseMembershipQuery(url),
        ), correlationId);
      }
      const membershipActionMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/memberships\/([^/]+)\/actions\/(suspend_membership|restore_membership)$/,
      );
      if (membershipActionMatch?.[1] && membershipActionMatch[2] && request.method === "POST") {
        const body = await readJson(request);
        const expectedVersion = Number(body.expectedVersion);
        if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
          throw new Error("VALIDATION_FAILED");
        }
        return send(response, 200, dependencies.service.performMembershipAction(
          requireBearer(request),
          decodeURIComponent(membershipActionMatch[1]),
          {
            action: membershipActionMatch[2] as "suspend_membership" | "restore_membership",
            idempotencyKey: requireHeader(request, "idempotency-key"),
            expectedVersion,
            reasonCode: requireString(body.reasonCode),
          },
          dependencies.adminAccess,
          requestContext(request, correlationId),
        ), correlationId);
      }
      const membershipMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/memberships\/([^/]+)$/,
      );
      if (membershipMatch?.[1] && request.method === "GET") {
        return send(response, 200, dependencies.service.getMembership(
          requireBearer(request),
          decodeURIComponent(membershipMatch[1]),
          dependencies.adminAccess,
          requestContext(request, correlationId),
        ), correlationId);
      }
      if (url.pathname === `${basePath}/reports` && request.method === "GET") {
        return send(response, 200, dependencies.service.listDataReports(
          requireBearer(request),
          parseDataReportQuery(url),
          dependencies.adminAccess,
          requestContext(request, correlationId),
        ), correlationId);
      }
      const dataReportActionMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/reports\/([^/]+)\/actions\/refresh_report$/,
      );
      if (dataReportActionMatch?.[1] && request.method === "POST") {
        const body = await readJson(request);
        const expectedVersion = Number(body.expectedVersion);
        if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
          throw new Error("VALIDATION_FAILED");
        }
        return send(response, 200, dependencies.service.performDataReportAction(
          requireBearer(request),
          decodeURIComponent(dataReportActionMatch[1]),
          {
            action: "refresh_report",
            idempotencyKey: requireHeader(request, "idempotency-key"),
            expectedVersion,
            reasonCode: requireString(body.reasonCode),
          },
          dependencies.adminAccess,
          requestContext(request, correlationId),
        ), correlationId);
      }
      const dataReportMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/reports\/([^/]+)$/,
      );
      if (dataReportMatch?.[1] && request.method === "GET") {
        return send(response, 200, dependencies.service.getDataReport(
          requireBearer(request),
          decodeURIComponent(dataReportMatch[1]),
          dependencies.adminAccess,
          requestContext(request, correlationId),
        ), correlationId);
      }
      if (url.pathname === `${basePath}/operations/tasks` && request.method === "GET") {
        return send(response, 200, dependencies.service.listOperationsTasks(requireBearer(request), parseQuery(url)), correlationId);
      }
      if (url.pathname === `${basePath}/operators` && request.method === "GET") {
        return send(
          response,
          200,
          dependencies.service.listOperators(
            requireBearer(request),
            parseOperatorQuery(url),
            dependencies.operatorManagement,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      if (url.pathname === `${basePath}/fleet/drivers` && request.method === "GET") {
        return send(
          response,
          200,
          await dependencies.service.listDrivers(
            requireBearer(request),
            parseDriverQuery(url),
            dependencies.adminReviews,
          ),
          correlationId,
        );
      }
      if (url.pathname === `${basePath}/fleet/vehicles` && request.method === "GET") {
        return send(
          response,
          200,
          await dependencies.service.listVehicles(
            requireBearer(request),
            parseVehicleQuery(url),
            dependencies.adminReviews,
          ),
          correlationId,
        );
      }
      if (url.pathname === `${basePath}/trips` && request.method === "GET") {
        return send(
          response,
          200,
          dependencies.service.listTrips(
            requireBearer(request),
            parseTripQuery(url),
            dependencies.tripCaseManagement,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      if (url.pathname === `${basePath}/cases` && request.method === "GET") {
        return send(
          response,
          200,
          dependencies.service.listCases(
            requireBearer(request),
            parseCaseQuery(url),
            dependencies.tripCaseManagement,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      if (url.pathname === `${basePath}/finance` && request.method === "GET") {
        return send(
          response,
          200,
          dependencies.service.listFinanceResources(
            requireBearer(request),
            parseFinanceQuery(url),
            dependencies.financeOperations,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      if (url.pathname === `${basePath}/executive` && request.method === "GET") {
        return send(
          response,
          200,
          dependencies.service.listExecutiveResources(
            requireBearer(request),
            parseExecutiveQuery(url),
            dependencies.executiveDashboard,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      if (url.pathname === `${basePath}/audit` && request.method === "GET") {
        return send(
          response,
          200,
          dependencies.service.listAuditResources(
            requireBearer(request),
            parseAuditQuery(url),
            dependencies.adminAccess,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      const auditActionMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/audit\/([^/]+)\/([^/]+)\/actions\/([^/]+)$/,
      );
      if (
        auditActionMatch?.[1] &&
        auditActionMatch[2] &&
        auditActionMatch[3] &&
        request.method === "POST"
      ) {
        const body = await readJson(request);
        const expectedVersion = Number(body.expectedVersion);
        if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
          throw new Error("VALIDATION_FAILED");
        }
        return send(
          response,
          200,
          dependencies.service.performAuditAction(
            requireBearer(request),
            requireAuditKind(decodeURIComponent(auditActionMatch[1])),
            decodeURIComponent(auditActionMatch[2]),
            {
              action: requireAuditAction(
                decodeURIComponent(auditActionMatch[3]),
              ),
              idempotencyKey: requireHeader(request, "idempotency-key"),
              expectedVersion,
              reasonCode: requireString(body.reasonCode),
              ...(typeof body.note === "string" ? { note: body.note } : {}),
              ...(typeof body.assigneeWorkIdentityId === "string"
                ? { assigneeWorkIdentityId: body.assigneeWorkIdentityId }
                : {}),
            },
            dependencies.adminAccess,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      const auditDetailMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/audit\/([^/]+)\/([^/]+)$/,
      );
      if (
        auditDetailMatch?.[1] &&
        auditDetailMatch[2] &&
        request.method === "GET"
      ) {
        return send(
          response,
          200,
          dependencies.service.getAuditResource(
            requireBearer(request),
            requireAuditKind(decodeURIComponent(auditDetailMatch[1])),
            decodeURIComponent(auditDetailMatch[2]),
            dependencies.adminAccess,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      const executiveActionMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/executive\/([^/]+)\/([^/]+)\/actions\/([^/]+)$/,
      );
      if (
        executiveActionMatch?.[1] &&
        executiveActionMatch[2] &&
        executiveActionMatch[3] &&
        request.method === "POST"
      ) {
        const body = await readJson(request);
        const expectedVersion =
          body.expectedVersion === undefined
            ? undefined
            : Number(body.expectedVersion);
        if (
          expectedVersion !== undefined &&
          (!Number.isInteger(expectedVersion) || expectedVersion < 1)
        ) {
          throw new Error("VALIDATION_FAILED");
        }
        const domain =
          typeof body.domain === "string" &&
          ["operations", "finance", "safety_compliance"].includes(body.domain)
            ? body.domain as "operations" | "finance" | "safety_compliance"
            : undefined;
        return send(
          response,
          200,
          dependencies.service.performExecutiveAction(
            requireBearer(request),
            requireExecutiveKind(
              decodeURIComponent(executiveActionMatch[1]),
            ),
            decodeURIComponent(executiveActionMatch[2]),
            {
              action: requireExecutiveAction(
                decodeURIComponent(executiveActionMatch[3]),
              ),
              idempotencyKey: requireHeader(request, "idempotency-key"),
              ...(expectedVersion !== undefined ? { expectedVersion } : {}),
              ...(typeof body.reasonCode === "string"
                ? { reasonCode: body.reasonCode }
                : {}),
              ...(typeof body.decisionCode === "string"
                ? { decisionCode: body.decisionCode }
                : {}),
              ...(typeof body.responsibleRole === "string"
                ? { responsibleRole: body.responsibleRole }
                : {}),
              ...(typeof body.dueAt === "string" ? { dueAt: body.dueAt } : {}),
              ...(typeof body.supersedesOpinionId === "string"
                ? { supersedesOpinionId: body.supersedesOpinionId }
                : {}),
              ...(domain ? { domain } : {}),
              ...(typeof body.purpose === "string"
                ? { purpose: body.purpose }
                : {}),
              ...(Array.isArray(body.fieldSet) &&
              body.fieldSet.every((item) => typeof item === "string")
                ? { fieldSet: body.fieldSet as string[] }
                : {}),
              ...(typeof body.windowStart === "string"
                ? { windowStart: body.windowStart }
                : {}),
              ...(typeof body.windowEnd === "string"
                ? { windowEnd: body.windowEnd }
                : {}),
            },
            dependencies.executiveDashboard,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      const executiveDetailMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/executive\/([^/]+)\/([^/]+)$/,
      );
      if (
        executiveDetailMatch?.[1] &&
        executiveDetailMatch[2] &&
        request.method === "GET"
      ) {
        return send(
          response,
          200,
          dependencies.service.getExecutiveResource(
            requireBearer(request),
            requireExecutiveKind(
              decodeURIComponent(executiveDetailMatch[1]),
            ),
            decodeURIComponent(executiveDetailMatch[2]),
            dependencies.executiveDashboard,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      const financeActionMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/finance\/([^/]+)\/([^/]+)\/actions\/([^/]+)$/,
      );
      if (
        financeActionMatch?.[1] &&
        financeActionMatch[2] &&
        financeActionMatch[3] &&
        request.method === "POST"
      ) {
        const body = await readJson(request);
        const expectedVersion = Number(body.expectedVersion);
        if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
          throw new Error("VALIDATION_FAILED");
        }
        return send(
          response,
          200,
          dependencies.service.performFinanceAction(
            requireBearer(request),
            requireFinanceKind(decodeURIComponent(financeActionMatch[1])),
            decodeURIComponent(financeActionMatch[2]),
            {
              action: requireFinanceAction(
                decodeURIComponent(financeActionMatch[3]),
              ),
              expectedVersion,
              idempotencyKey: requireHeader(request, "idempotency-key"),
              reasonCode: requireString(body.reasonCode),
              ...(typeof body.evidenceReference === "string"
                ? { evidenceReference: body.evidenceReference }
                : {}),
            },
            dependencies.financeOperations,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      const financeDetailMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/finance\/([^/]+)\/([^/]+)$/,
      );
      if (
        financeDetailMatch?.[1] &&
        financeDetailMatch[2] &&
        request.method === "GET"
      ) {
        return send(
          response,
          200,
          dependencies.service.getFinanceResource(
            requireBearer(request),
            requireFinanceKind(decodeURIComponent(financeDetailMatch[1])),
            decodeURIComponent(financeDetailMatch[2]),
            dependencies.financeOperations,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      const caseActionMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/cases\/([^/]+)\/([^/]+)\/actions\/([^/]+)$/,
      );
      if (
        caseActionMatch?.[1] &&
        caseActionMatch[2] &&
        caseActionMatch[3] &&
        request.method === "POST"
      ) {
        const body = await readJson(request);
        const expectedVersion = Number(body.expectedVersion);
        if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
          throw new Error("VALIDATION_FAILED");
        }
        return send(
          response,
          200,
          dependencies.service.performCaseAction(
            requireBearer(request),
            requireCaseKind(decodeURIComponent(caseActionMatch[1])),
            decodeURIComponent(caseActionMatch[2]),
            {
              action: requireCaseAction(
                decodeURIComponent(caseActionMatch[3]),
              ),
              expectedVersion,
              idempotencyKey: requireHeader(request, "idempotency-key"),
              ...(typeof body.note === "string" ? { note: body.note } : {}),
              ...(typeof body.evidenceGrantId === "string"
                ? { evidenceGrantId: body.evidenceGrantId }
                : {}),
              ...(typeof body.ticketId === "string"
                ? { ticketId: body.ticketId }
                : {}),
              ...optionalEvidencePurpose(body.purposeCode),
              ...optionalEvidenceFields(body.requestedFields),
              ...(body.ttlMinutes !== undefined
                ? { ttlMinutes: Number(body.ttlMinutes) }
                : {}),
            },
            dependencies.tripCaseManagement,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      const caseDetailMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/cases\/([^/]+)\/([^/]+)$/,
      );
      if (
        caseDetailMatch?.[1] &&
        caseDetailMatch[2] &&
        request.method === "GET"
      ) {
        return send(
          response,
          200,
          dependencies.service.getCase(
            requireBearer(request),
            requireCaseKind(decodeURIComponent(caseDetailMatch[1])),
            decodeURIComponent(caseDetailMatch[2]),
            dependencies.tripCaseManagement,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      const tripActionMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/trips\/([^/]+)\/actions\/([^/]+)$/,
      );
      if (
        tripActionMatch?.[1] &&
        tripActionMatch[2] &&
        request.method === "POST"
      ) {
        const body = await readJson(request);
        const expectedTaskVersion = Number(body.expectedTaskVersion);
        const expectedTripVersion = Number(body.expectedTripVersion);
        if (
          !Number.isInteger(expectedTaskVersion) ||
          expectedTaskVersion < 1 ||
          !Number.isInteger(expectedTripVersion) ||
          expectedTripVersion < 1
        ) {
          throw new Error("VALIDATION_FAILED");
        }
        return send(
          response,
          200,
          dependencies.service.performTripOperationAction(
            requireBearer(request),
            decodeURIComponent(tripActionMatch[1]),
            {
              action: requireTripAction(
                decodeURIComponent(tripActionMatch[2]),
              ),
              expectedTaskVersion,
              expectedTripVersion,
              idempotencyKey: requireHeader(request, "idempotency-key"),
              ...(typeof body.reasonCode === "string"
                ? { reasonCode: body.reasonCode }
                : {}),
            },
            dependencies.tripCaseManagement,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      const tripDetailMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/trips\/([^/]+)$/,
      );
      if (tripDetailMatch?.[1] && request.method === "GET") {
        return send(
          response,
          200,
          dependencies.service.getTrip(
            requireBearer(request),
            decodeURIComponent(tripDetailMatch[1]),
            dependencies.tripCaseManagement,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      const vehicleActionMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/fleet\/vehicles\/([^/]+)\/actions\/([^/]+)$/,
      );
      if (
        vehicleActionMatch?.[1] &&
        vehicleActionMatch[2] &&
        request.method === "POST"
      ) {
        const body = await readJson(request);
        const expectedTaskVersion = Number(body.expectedTaskVersion);
        const expectedVehicleReviewVersion = Number(
          body.expectedVehicleReviewVersion,
        );
        if (
          !Number.isInteger(expectedTaskVersion) ||
          expectedTaskVersion < 1 ||
          !Number.isInteger(expectedVehicleReviewVersion) ||
          expectedVehicleReviewVersion < 1
        ) {
          throw new Error("VALIDATION_FAILED");
        }
        return send(
          response,
          200,
          await dependencies.service.performVehicleReviewAction(
            requireBearer(request),
            decodeURIComponent(vehicleActionMatch[1]),
            {
              action: requireVehicleAction(
                decodeURIComponent(vehicleActionMatch[2]),
              ),
              expectedTaskVersion,
              expectedVehicleReviewVersion,
              idempotencyKey: requireHeader(request, "idempotency-key"),
              ...optionalVehicleReason(body.reasonCode),
            },
            dependencies.operatorManagement,
            dependencies.adminReviews,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      const driverDetailMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/fleet\/drivers\/([^/]+)$/,
      );
      if (driverDetailMatch?.[1] && request.method === "GET") {
        return send(
          response,
          200,
          await dependencies.service.getDriver(
            requireBearer(request),
            decodeURIComponent(driverDetailMatch[1]),
            dependencies.operatorManagement,
            dependencies.adminReviews,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      const vehicleDetailMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/fleet\/vehicles\/([^/]+)$/,
      );
      if (vehicleDetailMatch?.[1] && request.method === "GET") {
        return send(
          response,
          200,
          await dependencies.service.getVehicle(
            requireBearer(request),
            decodeURIComponent(vehicleDetailMatch[1]),
            dependencies.operatorManagement,
            dependencies.adminReviews,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      const operatorActionMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/operators\/([^/]+)\/actions\/([^/]+)$/,
      );
      if (
        operatorActionMatch?.[1] &&
        operatorActionMatch[2] &&
        request.method === "POST"
      ) {
        const body = await readJson(request);
        const expectedVersion = Number(body.expectedVersion);
        if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
          throw new Error("VALIDATION_FAILED");
        }
        return send(
          response,
          200,
          dependencies.service.performOperatorAction(
            requireBearer(request),
            decodeURIComponent(operatorActionMatch[1]),
            {
              action: requireOperatorAction(
                decodeURIComponent(operatorActionMatch[2]),
              ),
              expectedVersion,
              idempotencyKey: requireHeader(request, "idempotency-key"),
              note: requireString(body.note),
            },
            dependencies.operatorManagement,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      const operatorDetailMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/operators\/([^/]+)$/,
      );
      if (operatorDetailMatch?.[1] && request.method === "GET") {
        return send(
          response,
          200,
          dependencies.service.getOperator(
            requireBearer(request),
            decodeURIComponent(operatorDetailMatch[1]),
            dependencies.operatorManagement,
            requestContext(request, correlationId),
          ),
          correlationId,
        );
      }
      const taskActionMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/operations\/tasks\/([^/]+)\/actions\/([^/]+)$/,
      );
      if (taskActionMatch?.[1] && taskActionMatch[2] && request.method === "POST") {
        const body = await readJson(request);
        const action = requireTaskAction(decodeURIComponent(taskActionMatch[2]));
        const expectedVersion = Number(body.expectedVersion);
        if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
          throw new Error("VALIDATION_FAILED");
        }
        return send(
          response,
          200,
          dependencies.service.performOperationsTaskAction(
            requireBearer(request),
            decodeURIComponent(taskActionMatch[1]),
            {
              action,
              expectedVersion,
              idempotencyKey: requireHeader(request, "idempotency-key"),
              ...(typeof body.note === "string" && body.note.trim()
                ? { note: body.note }
                : {}),
            },
          ),
          correlationId,
        );
      }
      const taskDetailMatch = url.pathname.match(
        /^\/v1\/internal-sandbox\/admin\/operations\/tasks\/([^/]+)$/,
      );
      if (taskDetailMatch?.[1] && request.method === "GET") {
        return send(
          response,
          200,
          dependencies.service.getOperationsTask(
            requireBearer(request),
            decodeURIComponent(taskDetailMatch[1]),
          ),
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

function parseQuery(url: URL): AdminOperationsTaskQuery {
  const pageSizeValue = url.searchParams.get("page_size");
  const pageSize = pageSizeValue ? Number(pageSizeValue) : undefined;
  const statusValue = url.searchParams.get("status");
  const sortValue = url.searchParams.get("sort");
  if (
    (pageSize !== undefined && ![25, 50, 100].includes(pageSize)) ||
    (statusValue && !["unassigned", "processing", "waiting_review", "blocked", "completed"].includes(statusValue)) ||
    (sortValue && !["due_at_asc", "updated_at_desc"].includes(sortValue))
  ) {
    throw new Error("ADMIN_PAGINATION_INVALID");
  }
  return {
    ...(pageSize ? { pageSize: pageSize as 25 | 50 | 100 } : {}),
    ...(url.searchParams.get("after") ? { after: url.searchParams.get("after")! } : {}),
    ...(url.searchParams.get("before") ? { before: url.searchParams.get("before")! } : {}),
    ...(url.searchParams.get("search") ? { search: url.searchParams.get("search")! } : {}),
    ...(statusValue ? { status: statusValue as NonNullable<AdminOperationsTaskQuery["status"]> } : {}),
    ...(sortValue ? { sort: sortValue as NonNullable<AdminOperationsTaskQuery["sort"]> } : {}),
  };
}

function parseOperatorQuery(url: URL): AdminOperatorDirectoryQuery {
  const pageSizeValue = url.searchParams.get("page_size");
  const pageSize = pageSizeValue ? Number(pageSizeValue) : undefined;
  const lifecycleState = url.searchParams.get("lifecycle_state");
  const sort = url.searchParams.get("sort");
  if (
    (pageSize !== undefined && ![25, 50, 100].includes(pageSize)) ||
    (lifecycleState &&
      ![
        "candidate",
        "onboarding_review",
        "pending_activation",
        "active",
        "restricted",
        "suspended",
        "exit_pending",
        "exited",
      ].includes(lifecycleState)) ||
    (sort && !["operator_name_asc", "updated_at_desc"].includes(sort))
  ) {
    throw new Error("ADMIN_PAGINATION_INVALID");
  }
  return {
    ...(pageSize ? { pageSize: pageSize as 25 | 50 | 100 } : {}),
    ...(url.searchParams.get("after") ? { after: url.searchParams.get("after")! } : {}),
    ...(url.searchParams.get("before") ? { before: url.searchParams.get("before")! } : {}),
    ...(url.searchParams.get("search") ? { search: url.searchParams.get("search")! } : {}),
    ...(lifecycleState
      ? {
          lifecycleState:
            lifecycleState as NonNullable<
              AdminOperatorDirectoryQuery["lifecycleState"]
            >,
        }
      : {}),
    ...(sort
      ? { sort: sort as NonNullable<AdminOperatorDirectoryQuery["sort"]> }
      : {}),
  };
}

function parseDriverQuery(url: URL): AdminDriverDirectoryQuery {
  const pageSizeValue = url.searchParams.get("page_size");
  const pageSize = pageSizeValue ? Number(pageSizeValue) : undefined;
  const eligibilityState = url.searchParams.get("eligibility_state");
  const sort = url.searchParams.get("sort");
  if (
    (pageSize !== undefined && ![25, 50, 100].includes(pageSize)) ||
    (eligibilityState &&
      !["serviceable", "restricted"].includes(eligibilityState)) ||
    (sort && !["driver_name_asc", "updated_at_desc"].includes(sort))
  ) {
    throw new Error("ADMIN_PAGINATION_INVALID");
  }
  return {
    ...(pageSize ? { pageSize: pageSize as 25 | 50 | 100 } : {}),
    ...(url.searchParams.get("after")
      ? { after: url.searchParams.get("after")! }
      : {}),
    ...(url.searchParams.get("before")
      ? { before: url.searchParams.get("before")! }
      : {}),
    ...(url.searchParams.get("search")
      ? { search: url.searchParams.get("search")! }
      : {}),
    ...(eligibilityState
      ? {
          eligibilityState:
            eligibilityState as NonNullable<
              AdminDriverDirectoryQuery["eligibilityState"]
            >,
        }
      : {}),
    ...(sort
      ? { sort: sort as NonNullable<AdminDriverDirectoryQuery["sort"]> }
      : {}),
  };
}

function parseVehicleQuery(url: URL): AdminVehicleDirectoryQuery {
  const pageSizeValue = url.searchParams.get("page_size");
  const pageSize = pageSizeValue ? Number(pageSizeValue) : undefined;
  const reviewState = url.searchParams.get("review_state");
  const sort = url.searchParams.get("sort");
  if (
    (pageSize !== undefined && ![25, 50, 100].includes(pageSize)) ||
    (reviewState &&
      ![
        "approved",
        "under_review",
        "changes_requested",
        "rejected",
      ].includes(reviewState)) ||
    (sort && !["plate_asc", "updated_at_desc"].includes(sort))
  ) {
    throw new Error("ADMIN_PAGINATION_INVALID");
  }
  return {
    ...(pageSize ? { pageSize: pageSize as 25 | 50 | 100 } : {}),
    ...(url.searchParams.get("after")
      ? { after: url.searchParams.get("after")! }
      : {}),
    ...(url.searchParams.get("before")
      ? { before: url.searchParams.get("before")! }
      : {}),
    ...(url.searchParams.get("search")
      ? { search: url.searchParams.get("search")! }
      : {}),
    ...(reviewState
      ? {
          reviewState:
            reviewState as NonNullable<
              AdminVehicleDirectoryQuery["reviewState"]
            >,
        }
      : {}),
    ...(sort
      ? { sort: sort as NonNullable<AdminVehicleDirectoryQuery["sort"]> }
      : {}),
  };
}

function parseTripQuery(url: URL): AdminTripDirectoryQuery {
  const pageSizeValue = url.searchParams.get("page_size");
  const pageSize = pageSizeValue ? Number(pageSizeValue) : undefined;
  const authoritativeState = url.searchParams.get("authoritative_state");
  const operationState = url.searchParams.get("operation_state");
  const sort = url.searchParams.get("sort");
  const authoritativeStates = [
    "pending_payment",
    "paid_pending_match",
    "scheduled",
    "reserved",
    "preparing",
    "accepted",
    "driver_en_route",
    "driver_arrived",
    "in_progress",
    "safety_frozen",
    "completed",
    "unfulfilled",
    "cancelled",
  ];
  const operationStates = [
    "detected",
    "triaged",
    "coordinating",
    "awaiting_authoritative_result",
    "resolved",
    "closed",
  ];
  if (
    (pageSize !== undefined && ![25, 50, 100].includes(pageSize)) ||
    (authoritativeState &&
      !authoritativeStates.includes(authoritativeState)) ||
    (operationState && !operationStates.includes(operationState)) ||
    (sort && !["updated_at_desc", "trip_id_asc"].includes(sort))
  ) {
    throw new Error("ADMIN_PAGINATION_INVALID");
  }
  return {
    ...(pageSize ? { pageSize: pageSize as 25 | 50 | 100 } : {}),
    ...(url.searchParams.get("after")
      ? { after: url.searchParams.get("after")! }
      : {}),
    ...(url.searchParams.get("before")
      ? { before: url.searchParams.get("before")! }
      : {}),
    ...(url.searchParams.get("search")
      ? { search: url.searchParams.get("search")! }
      : {}),
    ...(authoritativeState
      ? {
          authoritativeState:
            authoritativeState as NonNullable<
              AdminTripDirectoryQuery["authoritativeState"]
            >,
        }
      : {}),
    ...(operationState
      ? {
          operationState:
            operationState as NonNullable<
              AdminTripDirectoryQuery["operationState"]
            >,
        }
      : {}),
    ...(sort
      ? { sort: sort as NonNullable<AdminTripDirectoryQuery["sort"]> }
      : {}),
  };
}

function requireTaskAction(value: string): AdminOperationsTaskAction {
  if (value === "assign" || value === "process" || value === "review") return value;
  throw new Error("VALIDATION_FAILED");
}

function requireOperatorAction(value: string): AdminOperatorAction {
  if (value === "restrict" || value === "reactivate") return value;
  throw new Error("VALIDATION_FAILED");
}

function requireVehicleAction(value: string): AdminVehicleReviewAction {
  if (
    value === "claim" ||
    value === "request_material" ||
    value === "approve" ||
    value === "reject"
  ) {
    return value;
  }
  throw new Error("VALIDATION_FAILED");
}

function requireTripAction(value: string): AdminTripOperationAction {
  if (value === "triage" || value === "request_domain_action") return value;
  throw new Error("VALIDATION_FAILED");
}

function requireCaseKind(value: string): AdminCaseKind {
  if (value === "support" || value === "safety") return value;
  throw new Error("VALIDATION_FAILED");
}

function requireCaseAction(value: string): AdminCaseAction {
  if (
    value === "continue_investigation" ||
    value === "await_user" ||
    value === "await_internal" ||
    value === "resolve" ||
    value === "close" ||
    value === "reopen" ||
    value === "escalate_operations" ||
    value === "escalate_safety" ||
    value === "escalate_finance" ||
    value === "submit_investigation" ||
    value === "restore_access" ||
    value === "uphold_freeze" ||
    value === "request_evidence" ||
    value === "approve_evidence" ||
    value === "revoke_evidence"
  ) {
    return value;
  }
  throw new Error("VALIDATION_FAILED");
}

function requireFinanceKind(value: string): AdminFinanceResourceKind {
  if (
    value === "settlement" ||
    value === "payout" ||
    value === "refund_reversal" ||
    value === "reconciliation" ||
    value === "business_day" ||
    value === "ledger"
  ) {
    return value;
  }
  throw new Error("VALIDATION_FAILED");
}

function requireFinanceAction(value: string): AdminFinanceAction {
  if (
    value === "prepare_operator_settlement" ||
    value === "review_operator_settlement" ||
    value === "prepare_driver_payout" ||
    value === "review_driver_payout" ||
    value === "request_driver_payout" ||
    value === "request_refund" ||
    value === "request_full_reversal" ||
    value === "submit_reconciliation_resolution" ||
    value === "review_reconciliation_resolution" ||
    value === "prepare_business_day_close" ||
    value === "review_business_day_close" ||
    value === "query_finance_command_recovery"
  ) {
    return value;
  }
  throw new Error("VALIDATION_FAILED");
}

function requireExecutiveKind(value: string): AdminExecutiveResourceKind {
  if (
    value === "decision_item" ||
    value === "export_request" ||
    value === "operator_health" ||
    value === "metric"
  ) {
    return value;
  }
  throw new Error("VALIDATION_FAILED");
}

function requireExecutiveAction(value: string): AdminExecutiveAction {
  if (
    value === "record_decision_opinion" ||
    value === "create_export_request" ||
    value === "privacy_approve_export" ||
    value === "privacy_reject_export" ||
    value === "domain_approve_export" ||
    value === "domain_reject_export" ||
    value === "revoke_export" ||
    value === "download_export"
  ) {
    return value;
  }
  throw new Error("VALIDATION_FAILED");
}

function requireAuditKind(value: string): AdminAuditResourceKind {
  if (
    value === "event" ||
    value === "investigation" ||
    value === "approval"
  ) {
    return value;
  }
  throw new Error("VALIDATION_FAILED");
}

function requireAuditAction(value: string): AdminAuditAction {
  if (
    value === "open_investigation" ||
    value === "assign_investigation" ||
    value === "add_investigation_note" ||
    value === "resolve_investigation" ||
    value === "reopen_investigation"
  ) {
    return value;
  }
  throw new Error("VALIDATION_FAILED");
}

function parseCaseQuery(url: URL): AdminCaseDirectoryQuery {
  const pageSize = url.searchParams.get("page_size")
    ? Number(url.searchParams.get("page_size"))
    : undefined;
  const kind = url.searchParams.get("kind");
  const supportState = url.searchParams.get("support_state");
  const safetyState = url.searchParams.get("safety_state");
  const sort = url.searchParams.get("sort");
  const supportStates = [
    "open",
    "assigned",
    "investigating",
    "awaiting_user",
    "awaiting_internal",
    "escalated",
    "resolved",
    "closed",
    "reopened",
  ];
  const safetyStates = [
    "unassigned",
    "assigned",
    "investigating",
    "awaiting_independent_review",
    "completed",
  ];
  if (
    (pageSize !== undefined && ![25, 50, 100].includes(pageSize)) ||
    (kind && kind !== "support" && kind !== "safety") ||
    (supportState && !supportStates.includes(supportState)) ||
    (safetyState && !safetyStates.includes(safetyState)) ||
    (sort && sort !== "updated_at_desc" && sort !== "case_id_asc")
  ) {
    throw new Error("ADMIN_PAGINATION_INVALID");
  }
  return {
    ...(pageSize ? { pageSize: pageSize as 25 | 50 | 100 } : {}),
    ...(url.searchParams.get("after")
      ? { after: url.searchParams.get("after")! }
      : {}),
    ...(url.searchParams.get("before")
      ? { before: url.searchParams.get("before")! }
      : {}),
    ...(url.searchParams.get("search")
      ? { search: url.searchParams.get("search")! }
      : {}),
    ...(kind ? { kind: kind as AdminCaseKind } : {}),
    ...(supportState
      ? {
          supportState:
            supportState as NonNullable<AdminCaseDirectoryQuery["supportState"]>,
        }
      : {}),
    ...(safetyState
      ? {
          safetyState:
            safetyState as NonNullable<AdminCaseDirectoryQuery["safetyState"]>,
        }
      : {}),
    ...(sort
      ? { sort: sort as NonNullable<AdminCaseDirectoryQuery["sort"]> }
      : {}),
  };
}

function parseFinanceQuery(url: URL): AdminFinanceDirectoryQuery {
  const pageSize = url.searchParams.get("page_size")
    ? Number(url.searchParams.get("page_size"))
    : undefined;
  const kind = url.searchParams.get("kind");
  const state = url.searchParams.get("state");
  const blocking = url.searchParams.get("blocking");
  const sort = url.searchParams.get("sort");
  const states = [
    "eligible",
    "ready",
    "awaiting_review",
    "approved",
    "processing",
    "succeeded",
    "blocked",
    "unknown",
    "liability_formed",
    "refund_requested",
    "refund_succeeded",
    "reversal_requested",
    "reversal_succeeded",
    "differences_found",
    "closed",
    "open",
    "posted",
  ];
  if (
    (pageSize !== undefined && ![25, 50, 100].includes(pageSize)) ||
    (kind &&
      ![
        "settlement",
        "payout",
        "refund_reversal",
        "reconciliation",
        "business_day",
        "ledger",
      ].includes(kind)) ||
    (state && !states.includes(state)) ||
    (blocking && blocking !== "true" && blocking !== "false") ||
    (sort &&
      sort !== "updated_at_desc" &&
      sort !== "resource_id_asc")
  ) {
    throw new Error("ADMIN_PAGINATION_INVALID");
  }
  return {
    ...(pageSize ? { pageSize: pageSize as 25 | 50 | 100 } : {}),
    ...(url.searchParams.get("after")
      ? { after: url.searchParams.get("after")! }
      : {}),
    ...(url.searchParams.get("before")
      ? { before: url.searchParams.get("before")! }
      : {}),
    ...(url.searchParams.get("search")
      ? { search: url.searchParams.get("search")! }
      : {}),
    ...(kind ? { kind: kind as AdminFinanceResourceKind } : {}),
    ...(state
      ? {
          state:
            state as NonNullable<AdminFinanceDirectoryQuery["state"]>,
        }
      : {}),
    ...(blocking ? { blocking: blocking === "true" } : {}),
    ...(sort
      ? { sort: sort as NonNullable<AdminFinanceDirectoryQuery["sort"]> }
      : {}),
  };
}

function parseExecutiveQuery(url: URL): AdminExecutiveDirectoryQuery {
  const pageSize = url.searchParams.get("page_size")
    ? Number(url.searchParams.get("page_size"))
    : undefined;
  const kind = url.searchParams.get("kind");
  const state = url.searchParams.get("state");
  const domain = url.searchParams.get("domain");
  const blocking = url.searchParams.get("blocking");
  const sort = url.searchParams.get("sort");
  const states = [
    "open",
    "awaiting_privacy_review",
    "awaiting_domain_review",
    "approved",
    "downloaded",
    "rejected",
    "revoked",
    "expired",
    "healthy",
    "attention",
    "blocked",
    "unavailable",
    "ready",
    "partial",
    "stale",
    "unclosed",
    "suppressed",
    "scope_denied",
    "feature_disabled",
  ];
  if (
    (pageSize !== undefined && ![25, 50, 100].includes(pageSize)) ||
    (kind &&
      ![
        "decision_item",
        "export_request",
        "operator_health",
        "metric",
      ].includes(kind)) ||
    (state && !states.includes(state)) ||
    (domain &&
      !["operations", "finance", "safety_compliance"].includes(domain)) ||
    (blocking && blocking !== "true" && blocking !== "false") ||
    (sort &&
      sort !== "updated_at_desc" &&
      sort !== "resource_id_asc")
  ) {
    throw new Error("ADMIN_PAGINATION_INVALID");
  }
  return {
    ...(pageSize ? { pageSize: pageSize as 25 | 50 | 100 } : {}),
    ...(url.searchParams.get("after")
      ? { after: url.searchParams.get("after")! }
      : {}),
    ...(url.searchParams.get("before")
      ? { before: url.searchParams.get("before")! }
      : {}),
    ...(url.searchParams.get("search")
      ? { search: url.searchParams.get("search")! }
      : {}),
    ...(kind ? { kind: kind as AdminExecutiveResourceKind } : {}),
    ...(state
      ? {
          state:
            state as NonNullable<AdminExecutiveDirectoryQuery["state"]>,
        }
      : {}),
    ...(domain
      ? {
          domain:
            domain as NonNullable<AdminExecutiveDirectoryQuery["domain"]>,
        }
      : {}),
    ...(blocking ? { blocking: blocking === "true" } : {}),
    ...(sort
      ? { sort: sort as NonNullable<AdminExecutiveDirectoryQuery["sort"]> }
      : {}),
  };
}

function parseAuditQuery(url: URL): AdminAuditDirectoryQuery {
  const pageSize = url.searchParams.get("page_size")
    ? Number(url.searchParams.get("page_size"))
    : undefined;
  const kind = url.searchParams.get("kind");
  const domain = url.searchParams.get("domain");
  const result = url.searchParams.get("result");
  const sort = url.searchParams.get("sort");
  const domains = [
    "authentication",
    "access",
    "operator",
    "driver_vehicle",
    "trip",
    "support_safety",
    "finance",
    "executive",
    "audit_system",
  ];
  const results = [
    "succeeded",
    "allowed",
    "denied",
    "open",
    "in_review",
    "resolved",
  ];
  if (
    (pageSize !== undefined && ![25, 50, 100].includes(pageSize)) ||
    (kind &&
      kind !== "event" &&
      kind !== "investigation" &&
      kind !== "approval") ||
    (domain && !domains.includes(domain)) ||
    (result && !results.includes(result)) ||
    (sort && sort !== "occurred_at_desc" && sort !== "resource_id_asc")
  ) {
    throw new Error("ADMIN_PAGINATION_INVALID");
  }
  return {
    ...(pageSize ? { pageSize: pageSize as 25 | 50 | 100 } : {}),
    ...(url.searchParams.get("after")
      ? { after: url.searchParams.get("after")! }
      : {}),
    ...(url.searchParams.get("before")
      ? { before: url.searchParams.get("before")! }
      : {}),
    ...(url.searchParams.get("search")
      ? { search: url.searchParams.get("search")! }
      : {}),
    ...(kind ? { kind: kind as AdminAuditResourceKind } : {}),
    ...(domain
      ? { domain: domain as NonNullable<AdminAuditDirectoryQuery["domain"]> }
      : {}),
    ...(result
      ? { result: result as NonNullable<AdminAuditDirectoryQuery["result"]> }
      : {}),
    ...(sort
      ? { sort: sort as NonNullable<AdminAuditDirectoryQuery["sort"]> }
      : {}),
  };
}

function parseDataReportQuery(url: URL): AdminDataReportDirectoryQuery {
  const pageSize = url.searchParams.get("page_size");
  const domain = url.searchParams.get("domain");
  const state = url.searchParams.get("state");
  const sort = url.searchParams.get("sort");
  return {
    ...(pageSize ? { pageSize: Number(pageSize) as 25 | 50 | 100 } : {}),
    ...(url.searchParams.get("after")
      ? { after: url.searchParams.get("after")! }
      : {}),
    ...(url.searchParams.get("before")
      ? { before: url.searchParams.get("before")! }
      : {}),
    ...(url.searchParams.get("search")
      ? { search: url.searchParams.get("search")! }
      : {}),
    ...(domain
      ? { domain: domain as NonNullable<AdminDataReportDirectoryQuery["domain"]> }
      : {}),
    ...(state
      ? { state: state as NonNullable<AdminDataReportDirectoryQuery["state"]> }
      : {}),
    ...(sort
      ? { sort: sort as NonNullable<AdminDataReportDirectoryQuery["sort"]> }
      : {}),
  };
}

function parseMembershipQuery(url: URL): AdminMembershipDirectoryQuery {
  const pageSize = url.searchParams.get("page_size");
  const organizationType = url.searchParams.get("organization_type");
  const state = url.searchParams.get("state");
  const authorizationLevel = url.searchParams.get("authorization_level");
  const capability = url.searchParams.get("capability");
  const sort = url.searchParams.get("sort");
  return {
    ...(pageSize ? { pageSize: Number(pageSize) as 25 | 50 | 100 } : {}),
    ...(url.searchParams.get("after")
      ? { after: url.searchParams.get("after")! }
      : {}),
    ...(url.searchParams.get("before")
      ? { before: url.searchParams.get("before")! }
      : {}),
    ...(url.searchParams.get("search")
      ? { search: url.searchParams.get("search")! }
      : {}),
    ...(organizationType
      ? { organizationType: organizationType as "platform" | "operator" }
      : {}),
    ...(state
      ? { state: state as NonNullable<AdminMembershipDirectoryQuery["state"]> }
      : {}),
    ...(authorizationLevel
      ? {
          authorizationLevel:
            authorizationLevel as NonNullable<
              AdminMembershipDirectoryQuery["authorizationLevel"]
            >,
        }
      : {}),
    ...(capability
      ? {
          capability:
            capability as NonNullable<
              AdminMembershipDirectoryQuery["capability"]
            >,
        }
      : {}),
    ...(sort
      ? { sort: sort as NonNullable<AdminMembershipDirectoryQuery["sort"]> }
      : {}),
  };
}

function parseGlobalSearchQuery(
  url: URL,
): import("@pollycar/contracts").AdminGlobalSearchQuery {
  const query = url.searchParams.get("query");
  const limit = url.searchParams.get("limit_per_domain");
  if (!query) throw new Error("VALIDATION_FAILED");
  if (limit && !["3", "5", "10"].includes(limit)) {
    throw new Error("VALIDATION_FAILED");
  }
  return {
    query,
    ...(limit
      ? { limitPerDomain: Number(limit) as 3 | 5 | 10 }
      : {}),
  };
}

function optionalEvidencePurpose(
  value: unknown,
): Pick<
  import("@pollycar/contracts").AdminCaseActionCommand,
  "purposeCode"
> {
  if (value === undefined) return {};
  if (
    value !== "safety_investigation" &&
    value !== "appeal_review" &&
    value !== "emergency_response"
  ) {
    throw new Error("VALIDATION_FAILED");
  }
  return { purposeCode: value };
}

function optionalEvidenceFields(
  value: unknown,
): Pick<
  import("@pollycar/contracts").AdminCaseActionCommand,
  "requestedFields"
> {
  if (value === undefined) return {};
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (field) =>
        field !== "chat_reference" &&
        field !== "raw_chat" &&
        field !== "location_window" &&
        field !== "full_location_trace",
    )
  ) {
    throw new Error("VALIDATION_FAILED");
  }
  return {
    requestedFields: value as NonNullable<
      import("@pollycar/contracts").AdminCaseActionCommand["requestedFields"]
    >,
  };
}

function optionalVehicleReason(
  value: unknown,
): Pick<AdminVehicleReviewActionCommand, "reasonCode"> {
  if (value === undefined) return {};
  if (
    typeof value !== "string" ||
    ![
      "insurance_expiry_incomplete",
      "authorization_evidence_incomplete",
      "synthetic_attachment_invalid",
      "vehicle_age_exceeded",
      "vehicle_mileage_exceeded",
      "insurance_requirement_not_met",
      "authorization_remaining_insufficient",
    ].includes(value)
  ) {
    throw new Error("VALIDATION_FAILED");
  }
  return {
    reasonCode: value as NonNullable<
      AdminVehicleReviewActionCommand["reasonCode"]
    >,
  };
}

function requestContext(
  request: IncomingMessage,
  correlationId: string,
): Readonly<{ correlationId: string; requestId: string }> {
  const requestId = request.headers["x-request-id"];
  return {
    correlationId,
    requestId:
      typeof requestId === "string" && requestId.length <= 128
        ? requestId
        : randomUUID(),
  };
}

function requireBearer(request: IncomingMessage): string {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) throw new Error("AUTHENTICATION_REQUIRED");
  return authorization.slice("Bearer ".length);
}

function requireHeader(request: IncomingMessage, name: string): string {
  const value = request.headers[name];
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    throw new Error("VALIDATION_FAILED");
  }
  return value;
}

function requireString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    throw new Error("VALIDATION_FAILED");
  }
  return value;
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return readJsonObject(request);
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

function correlationIdFor(request: IncomingMessage): string {
  const header = request.headers["x-correlation-id"];
  return typeof header === "string" && header.length <= 128 ? header : randomUUID();
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
