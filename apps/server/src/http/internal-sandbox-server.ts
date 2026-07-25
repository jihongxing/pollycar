import { createServer, type Server } from "node:http";
import type { FeatureGates } from "@pollycar/contracts";
import { createInternalSandbox } from "../sandbox.js";
import { createAdminReviewHandler } from "./admin-review-routes.js";
import { createAppRequestContext, createRequestContext } from "./request-context.js";
import { mapError } from "./error-mapper.js";
import { createVehicleReviewHandler } from "./vehicle-review-routes.js";
import { createFreeFlexTrialHandler } from "./free-flex-trial-routes.js";
import { createSyntheticTripHandler } from "./synthetic-trip-routes.js";
import { createMobilityHandler } from "./mobility-routes.js";
import { createAdminSafetyHandler } from "./admin-safety-routes.js";
import { createSafetyCaseHandler } from "./safety-case-routes.js";
import { createCommunicationHandler } from "./communication-routes.js";
import { createAdultEligibilityHandler } from "./adult-eligibility-routes.js";
import { createTrustProfileHandler } from "./trust-profile-routes.js";
import { createAccountSessionHandler } from "./account-session-routes.js";
import { createPhoneAuthenticationHandler } from "./phone-authentication-routes.js";
import { createMapLocationHandler } from "./map-location-routes.js";
import { createVehicleLocationHandler } from "./vehicle-location-routes.js";
import { createDispatchHandler } from "./dispatch-routes.js";
import { createAdminAccessHandler } from "./admin-access-routes.js";
import { createAdminOperatorManagementHandler } from "./admin-operator-management-routes.js";
import { createAdminTripCaseManagementHandler } from "./admin-trip-case-management-routes.js";
import { createAdminFinanceOperationsHandler } from "./admin-finance-operations-routes.js";
import { createAdminExecutiveDashboardHandler } from "./admin-executive-dashboard-routes.js";
import { createAdminAuthenticationHandler } from "./admin-authentication-routes.js";

export type InternalSandboxHttpServer = Readonly<{
  url: string;
  server: Server;
  close(): Promise<void>;
  sandbox: ReturnType<typeof createInternalSandbox>;
}>;

export async function startInternalSandboxHttpServer(
  options: Readonly<{
    port?: number;
    now?: () => Date;
    featureGates?: Partial<FeatureGates>;
    allowedOrigins?: readonly string[];
    executiveStateDir?: string;
    avatarObjectDirectory?: string;
  }> = {},
): Promise<InternalSandboxHttpServer> {
  const sandbox = createInternalSandbox(
    options.now ?? (() => new Date()),
    {
      ...(options.featureGates ? { featureGates: options.featureGates } : {}),
      ...(options.allowedOrigins ? { allowedOrigins: options.allowedOrigins } : {}),
      ...(options.executiveStateDir
        ? { executiveStateDir: options.executiveStateDir }
        : {}),
      ...(options.avatarObjectDirectory
        ? { avatarObjectDirectory: options.avatarObjectDirectory }
        : {}),
    },
  );
  if (!sandbox.config.featureGates.internalSandbox) throw new Error("INTERNAL_SANDBOX_DISABLED");
  await sandbox.ready;
  const handler = createAdminReviewHandler({
    service: sandbox.adminReviews,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const vehicleReviewHandler = createVehicleReviewHandler({
    service: sandbox.vehicleReviews,
    adminReviews: sandbox.adminReviews,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const freeFlexTrialHandler = createFreeFlexTrialHandler({
    service: sandbox.freeFlexTrial,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const syntheticTripHandler = createSyntheticTripHandler({
    service: sandbox.syntheticTrips,
    mobility: sandbox.mobility,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const mobilityHandler = createMobilityHandler({
    service: sandbox.mobility,
    dispatch: sandbox.dispatch,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const dispatchHandler = createDispatchHandler({
    service: sandbox.dispatch,
    mobility: sandbox.mobility,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const adminSafetyHandler = createAdminSafetyHandler({
    service: sandbox.safetyCases,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const safetyCaseHandler = createSafetyCaseHandler({
    service: sandbox.safetyCases,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const communicationHandler = createCommunicationHandler({
    service: sandbox.communications,
    lifecycle: sandbox.dataLifecycle,
    allowedOrigins: sandbox.config.http.allowedOrigins,
    authenticateSession: (token) => sandbox.accountSessions.authenticate(token),
  });
  const adultEligibilityHandler = createAdultEligibilityHandler({
    service: sandbox.adultEligibility,
    allowedOrigins: sandbox.config.http.allowedOrigins,
    authenticateSession: (token) => sandbox.accountSessions.authenticate(token),
  });
  const trustProfileHandler = createTrustProfileHandler({
    service: sandbox.trustProfiles,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const accountSessionHandler = createAccountSessionHandler({
    service: sandbox.accountSessions,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const phoneAuthenticationHandler = createPhoneAuthenticationHandler({
    service: sandbox.phoneAuthentication,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const mapLocationHandler = createMapLocationHandler({
    service: sandbox.mapLocations,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const vehicleLocationHandler = createVehicleLocationHandler({
    service: sandbox.vehicleLocations,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const adminAccessHandler = createAdminAccessHandler({
    service: sandbox.adminAccess,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const adminAuthenticationHandler = createAdminAuthenticationHandler({
    service: sandbox.adminAuthentication,
    operatorManagement: sandbox.adminOperatorManagement,
    adminReviews: sandbox.adminReviews,
    tripCaseManagement: sandbox.adminTripCaseManagement,
    financeOperations: sandbox.adminFinanceOperations,
    executiveDashboard: sandbox.executiveDashboard,
    adminAccess: sandbox.adminAccess,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const adminOperatorManagementHandler = createAdminOperatorManagementHandler({
    service: sandbox.adminOperatorManagement,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const adminTripCaseManagementHandler = createAdminTripCaseManagementHandler({
    service: sandbox.adminTripCaseManagement,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const adminFinanceOperationsHandler = createAdminFinanceOperationsHandler({
    service: sandbox.adminFinanceOperations,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const adminExecutiveDashboardHandler = createAdminExecutiveDashboardHandler({
    service: sandbox.executiveDashboard,
    allowedOrigins: sandbox.config.http.allowedOrigins,
  });
  const server = createServer(async (request, response) => {
    if (
      request.method === "OPTIONS" &&
      request.url?.startsWith("/v1/internal-sandbox/admin/")
    ) {
      const origin = request.headers.origin;
      if (origin && !sandbox.config.http.allowedOrigins.includes(origin)) {
        const correlationId = crypto.randomUUID();
        const mapped = mapError(new Error("AUTHORIZATION_DENIED"), correlationId);
        response.writeHead(mapped.status, {
          ...corsResponseHeaders(request.headers.origin, sandbox.config.http.allowedOrigins),
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Correlation-Id": correlationId,
        });
        response.end(JSON.stringify(mapped.body));
        return;
      }
      response.writeHead(204, {
        ...corsResponseHeaders(origin, sandbox.config.http.allowedOrigins),
        "Access-Control-Allow-Headers":
          "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id, X-Request-Id",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Cache-Control": "no-store",
      });
      response.end();
      return;
    }
    if (request.url === "/v1/internal-sandbox/health" && request.method === "GET") {
      try {
        const context = createRequestContext(request);
        response.writeHead(200, {
          ...corsResponseHeaders(request.headers.origin, sandbox.config.http.allowedOrigins),
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Correlation-Id": context.correlationId,
        });
        response.end(JSON.stringify(await sandbox.health.readiness()));
      } catch (error) {
        const correlationId = crypto.randomUUID();
        const mapped = mapError(error, correlationId);
        response.writeHead(mapped.status, {
          ...corsResponseHeaders(request.headers.origin, sandbox.config.http.allowedOrigins),
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Correlation-Id": correlationId,
        });
        response.end(JSON.stringify(mapped.body));
      }
      return;
    }
    if (
      request.method !== "OPTIONS" &&
      request.url?.startsWith("/v1/internal-sandbox/app/") &&
      !request.url.startsWith("/v1/internal-sandbox/app/adult-eligibility") &&
      !request.url.startsWith("/v1/internal-sandbox/app/sessions")
    ) {
      try {
        const context = await createAppRequestContext(
          request,
          (token) => sandbox.accountSessions.authenticate(token),
        );
        authorizeIdentity(context.activeIdentity, request.url, request.method);
        const verification = await sandbox.adultEligibility.get(context.accountId);
        if (!verification.businessAccessAllowed) throw new Error("ADULT_ELIGIBILITY_REQUIRED");
        request.headers.authorization = "Sandbox verified-app-session";
        request.headers["x-verified-account-id"] = context.accountId;
        request.headers["x-verified-active-identity"] = context.activeIdentity;
      } catch (error) {
        const correlationId = crypto.randomUUID();
        const mapped = mapError(error, correlationId);
        response.writeHead(mapped.status, {
          ...corsResponseHeaders(request.headers.origin, sandbox.config.http.allowedOrigins),
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Correlation-Id": correlationId,
        });
        response.end(JSON.stringify(mapped.body));
        return;
      }
    }
    if (
      sandbox.config.featureGates.syntheticAdminRoleAccessMatrix &&
      request.method !== "OPTIONS" &&
      request.url?.startsWith("/v1/internal-sandbox/admin/") &&
      !request.url.startsWith("/v1/internal-sandbox/admin/auth/") &&
      !request.url.startsWith("/v1/internal-sandbox/admin/navigation") &&
      !request.url.startsWith("/v1/internal-sandbox/admin/operations/tasks") &&
      request.headers.authorization?.startsWith("Sandbox ")
    ) {
      const correlationId = crypto.randomUUID();
      const mapped = mapError(
        new Error("AUTHENTICATION_REQUIRED"),
        correlationId,
      );
      response.writeHead(mapped.status, {
        ...corsResponseHeaders(request.headers.origin, sandbox.config.http.allowedOrigins),
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Correlation-Id": correlationId,
      });
      response.end(JSON.stringify(mapped.body));
      return;
    }
    if (
      !(await phoneAuthenticationHandler(request, response)) &&
      !(await accountSessionHandler(request, response)) &&
      !(await mapLocationHandler(request, response)) &&
      !(await vehicleLocationHandler(request, response)) &&
      !(await dispatchHandler(request, response)) &&
      !(await adultEligibilityHandler(request, response)) &&
      !(await trustProfileHandler(request, response)) &&
      !(await freeFlexTrialHandler(request, response)) &&
      !(await communicationHandler(request, response)) &&
      !(await safetyCaseHandler(request, response)) &&
      !(await adminAuthenticationHandler(request, response)) &&
      !(await adminAccessHandler(request, response)) &&
      !(await adminOperatorManagementHandler(request, response)) &&
      !(await adminTripCaseManagementHandler(request, response)) &&
      !(await adminFinanceOperationsHandler(request, response)) &&
      !(await adminExecutiveDashboardHandler(request, response)) &&
      !(await adminSafetyHandler(request, response)) &&
      !(await mobilityHandler(request, response)) &&
      !(await syntheticTripHandler(request, response)) &&
      !(await handler(request, response)) &&
      !(await vehicleReviewHandler(request, response))
    ) {
      response.writeHead(404, {
        ...corsResponseHeaders(request.headers.origin, sandbox.config.http.allowedOrigins),
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify({ error: { code: "NOT_FOUND" } }));
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? sandbox.config.http.port, sandbox.config.http.host, () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("HTTP_LISTEN_FAILED");
  return {
    url: `http://${sandbox.config.http.host}:${address.port}`,
    server,
    sandbox,
    close: async () => {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await sandbox.close();
    },
  };
}

function corsResponseHeaders(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): Record<string, string> {
  return {
    Vary: "Origin",
    ...(origin && allowedOrigins.includes(origin)
      ? { "Access-Control-Allow-Origin": origin }
      : {}),
  };
}

function authorizeIdentity(
  activeIdentity: "passenger" | "driver",
  url: string | undefined,
  method: string | undefined,
): void {
  const path = url ?? "";
  const driverOnly =
    path.includes("/driver-availability") ||
    path.includes("/available-trips") ||
    path.includes("/driver-orders") ||
    path.includes("/finance") ||
    path.includes("/completion-intents") ||
    /\/(accept|start|complete|driver-en-route|driver-arrived|verify-boarding|complete-with-intent)$/.test(path);
  const passengerOnly =
    path === "/v1/internal-sandbox/app/synthetic-trips/booking-availability" ||
    (method === "POST" &&
      (path === "/v1/internal-sandbox/app/synthetic-trips" ||
        /\/(payment|reschedule)$/.test(path)));
  if (driverOnly && activeIdentity !== "driver") throw new Error("SESSION_IDENTITY_MISMATCH");
  if (passengerOnly && activeIdentity !== "passenger") throw new Error("SESSION_IDENTITY_MISMATCH");
}
