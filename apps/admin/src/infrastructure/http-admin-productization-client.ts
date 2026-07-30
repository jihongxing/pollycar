import type {
  AdminAuditActionCommand,
  AdminAuditActionResult,
  AdminAuditDetail,
  AdminAuditDirectoryPage,
  AdminAuditDirectoryQuery,
  AdminAuditResourceKind,
  AdminCaseActionCommand,
  AdminCaseActionResult,
  AdminCaseDetail,
  AdminCaseDirectoryPage,
  AdminCaseDirectoryQuery,
  AdminCaseKind,
  AdminDataReportActionCommand,
  AdminDataReportActionResult,
  AdminDataReportDetail,
  AdminDataReportDirectoryPage,
  AdminDataReportDirectoryQuery,
  AdminDriverDetail,
  AdminDriverDirectoryPage,
  AdminDriverDirectoryQuery,
  AdminExecutiveActionCommand,
  AdminExecutiveActionResult,
  AdminExecutiveDetail,
  AdminExecutiveDirectoryPage,
  AdminExecutiveDirectoryQuery,
  AdminExecutiveResourceKind,
  AdminFinanceActionCommand,
  AdminFinanceActionResult,
  AdminFinanceDetail,
  AdminFinanceDirectoryPage,
  AdminFinanceDirectoryQuery,
  AdminFinanceResourceKind,
  AdminGlobalSearchQuery,
  AdminGlobalSearchResponse,
  AdminInvitationSummary,
  AdminMembershipActionCommand,
  AdminMembershipActionResult,
  AdminMembershipDetail,
  AdminMembershipDirectoryPage,
  AdminMembershipDirectoryQuery,
  AdminLoginChallenge,
  AdminMfaVerification,
  AdminOperatorActionCommand,
  AdminOperatorActionResult,
  AdminOperatorDetail,
  AdminOperatorDirectoryPage,
  AdminOperatorDirectoryQuery,
  AdminNavigationManifest,
  AdminOperationsTaskActionCommand,
  AdminOperationsTaskActionResult,
  AdminOperationsTaskDetail,
  AdminOperationsTaskPage,
  AdminOperationsTaskQuery,
  AdminProductizationClient,
  AdminProductSession,
  AdminTripDetail,
  AdminTripDirectoryPage,
  AdminTripDirectoryQuery,
  AdminTripOperationActionCommand,
  AdminTripOperationActionResult,
  AdminVehicleDetail,
  AdminVehicleDirectoryPage,
  AdminVehicleDirectoryQuery,
  AdminVehicleReviewActionCommand,
  AdminVehicleReviewActionResult,
  ApiErrorResponse,
} from "@pollycar/contracts";

export class HttpAdminProductizationClient implements AdminProductizationClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  public getInvitation(invitationToken: string): Promise<AdminInvitationSummary> {
    return this.request(`/v1/internal-sandbox/admin/auth/invitations/${encodeURIComponent(invitationToken)}`);
  }

  public activateInvitation(
    invitationToken: string,
    password: string,
    totpCode: string,
  ): Promise<Readonly<{ recoveryCodes: readonly string[]; synthetic: true }>> {
    return this.request(`/v1/internal-sandbox/admin/auth/invitations/${encodeURIComponent(invitationToken)}/activate`, {
      method: "POST",
      body: JSON.stringify({ password, totpCode }),
    });
  }

  public startLogin(workEmail: string, password: string): Promise<AdminLoginChallenge> {
    return this.request("/v1/internal-sandbox/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ workEmail, password }),
    });
  }

  public verifyMfa(challengeId: string, totpCode: string): Promise<AdminMfaVerification> {
    return this.request("/v1/internal-sandbox/admin/auth/mfa/verify", {
      method: "POST",
      body: JSON.stringify({ challengeId, totpCode }),
    });
  }

  public selectWorkIdentity(
    selectionToken: string,
    workIdentityId: string,
  ): Promise<AdminProductSession> {
    return this.requestProductSession("/v1/internal-sandbox/admin/auth/work-identities/select", {
      method: "POST",
      body: JSON.stringify({ selectionToken, workIdentityId }),
    });
  }

  public switchWorkIdentity(
    accessToken: string,
    workIdentityId: string,
  ): Promise<AdminProductSession> {
    return this.requestProductSession("/v1/internal-sandbox/admin/auth/work-identities/switch", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ workIdentityId }),
    });
  }

  public refreshSession(refreshToken: string): Promise<AdminProductSession> {
    return this.requestProductSession("/v1/internal-sandbox/admin/auth/session/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  }

  public logout(accessToken: string): Promise<void> {
    return this.request("/v1/internal-sandbox/admin/auth/session/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  public getNavigation(accessToken: string): Promise<AdminNavigationManifest> {
    return this.request("/v1/internal-sandbox/admin/navigation", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  public searchAcrossDomains(
    accessToken: string,
    query: AdminGlobalSearchQuery,
  ): Promise<AdminGlobalSearchResponse> {
    const parameters = new URLSearchParams({
      query: query.query,
      ...(query.limitPerDomain
        ? { limit_per_domain: String(query.limitPerDomain) }
        : {}),
    });
    return this.request(
      `/v1/internal-sandbox/admin/search?${parameters.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  public listOperationsTasks(
    accessToken: string,
    query: AdminOperationsTaskQuery,
  ): Promise<AdminOperationsTaskPage> {
    const parameters = new URLSearchParams();
    if (query.pageSize) parameters.set("page_size", String(query.pageSize));
    if (query.after) parameters.set("after", query.after);
    if (query.before) parameters.set("before", query.before);
    if (query.search) parameters.set("search", query.search);
    if (query.status) parameters.set("status", query.status);
    if (query.sort) parameters.set("sort", query.sort);
    return this.request(`/v1/internal-sandbox/admin/operations/tasks?${parameters}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  public getOperationsTask(
    accessToken: string,
    taskId: string,
  ): Promise<AdminOperationsTaskDetail> {
    return this.request(
      `/v1/internal-sandbox/admin/operations/tasks/${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  public performOperationsTaskAction(
    accessToken: string,
    taskId: string,
    command: AdminOperationsTaskActionCommand,
  ): Promise<AdminOperationsTaskActionResult> {
    return this.request(
      `/v1/internal-sandbox/admin/operations/tasks/${encodeURIComponent(taskId)}/actions/${command.action}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Idempotency-Key": command.idempotencyKey,
        },
        body: JSON.stringify({
          expectedVersion: command.expectedVersion,
          ...(command.note ? { note: command.note } : {}),
        }),
      },
    );
  }

  public listOperators(
    accessToken: string,
    query: AdminOperatorDirectoryQuery,
  ): Promise<AdminOperatorDirectoryPage> {
    const parameters = new URLSearchParams();
    if (query.pageSize) parameters.set("page_size", String(query.pageSize));
    if (query.after) parameters.set("after", query.after);
    if (query.before) parameters.set("before", query.before);
    if (query.search) parameters.set("search", query.search);
    if (query.lifecycleState) {
      parameters.set("lifecycle_state", query.lifecycleState);
    }
    if (query.sort) parameters.set("sort", query.sort);
    return this.request(`/v1/internal-sandbox/admin/operators?${parameters}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  public getOperator(
    accessToken: string,
    operatorId: string,
  ): Promise<AdminOperatorDetail> {
    return this.request(
      `/v1/internal-sandbox/admin/operators/${encodeURIComponent(operatorId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  public performOperatorAction(
    accessToken: string,
    operatorId: string,
    command: AdminOperatorActionCommand,
  ): Promise<AdminOperatorActionResult> {
    return this.request(
      `/v1/internal-sandbox/admin/operators/${encodeURIComponent(operatorId)}/actions/${command.action}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Idempotency-Key": command.idempotencyKey,
        },
        body: JSON.stringify({
          expectedVersion: command.expectedVersion,
          note: command.note,
        }),
      },
    );
  }

  public listDrivers(
    accessToken: string,
    query: AdminDriverDirectoryQuery,
  ): Promise<AdminDriverDirectoryPage> {
    return this.request(
      `/v1/internal-sandbox/admin/fleet/drivers?${fleetQueryParameters(
        query,
        "eligibility_state",
        query.eligibilityState,
      )}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  public getDriver(
    accessToken: string,
    driverAccountId: string,
  ): Promise<AdminDriverDetail> {
    return this.request(
      `/v1/internal-sandbox/admin/fleet/drivers/${encodeURIComponent(driverAccountId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  public listVehicles(
    accessToken: string,
    query: AdminVehicleDirectoryQuery,
  ): Promise<AdminVehicleDirectoryPage> {
    return this.request(
      `/v1/internal-sandbox/admin/fleet/vehicles?${fleetQueryParameters(
        query,
        "review_state",
        query.reviewState,
      )}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  public getVehicle(
    accessToken: string,
    vehicleId: string,
  ): Promise<AdminVehicleDetail> {
    return this.request(
      `/v1/internal-sandbox/admin/fleet/vehicles/${encodeURIComponent(vehicleId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  public performVehicleReviewAction(
    accessToken: string,
    vehicleId: string,
    command: AdminVehicleReviewActionCommand,
  ): Promise<AdminVehicleReviewActionResult> {
    return this.request(
      `/v1/internal-sandbox/admin/fleet/vehicles/${encodeURIComponent(vehicleId)}/actions/${command.action}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Idempotency-Key": command.idempotencyKey,
        },
        body: JSON.stringify({
          expectedTaskVersion: command.expectedTaskVersion,
          expectedVehicleReviewVersion: command.expectedVehicleReviewVersion,
          ...(command.reasonCode ? { reasonCode: command.reasonCode } : {}),
        }),
      },
    );
  }

  public listTrips(
    accessToken: string,
    query: AdminTripDirectoryQuery,
  ): Promise<AdminTripDirectoryPage> {
    const parameters = new URLSearchParams();
    if (query.pageSize) parameters.set("page_size", String(query.pageSize));
    if (query.after) parameters.set("after", query.after);
    if (query.before) parameters.set("before", query.before);
    if (query.search) parameters.set("search", query.search);
    if (query.authoritativeState) {
      parameters.set("authoritative_state", query.authoritativeState);
    }
    if (query.operationState) {
      parameters.set("operation_state", query.operationState);
    }
    if (query.sort) parameters.set("sort", query.sort);
    return this.request(`/v1/internal-sandbox/admin/trips?${parameters}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  public getTrip(
    accessToken: string,
    tripId: string,
  ): Promise<AdminTripDetail> {
    return this.request(
      `/v1/internal-sandbox/admin/trips/${encodeURIComponent(tripId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  public performTripOperationAction(
    accessToken: string,
    tripId: string,
    command: AdminTripOperationActionCommand,
  ): Promise<AdminTripOperationActionResult> {
    return this.request(
      `/v1/internal-sandbox/admin/trips/${encodeURIComponent(tripId)}/actions/${command.action}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Idempotency-Key": command.idempotencyKey,
        },
        body: JSON.stringify({
          expectedTaskVersion: command.expectedTaskVersion,
          expectedTripVersion: command.expectedTripVersion,
          ...(command.reasonCode ? { reasonCode: command.reasonCode } : {}),
        }),
      },
    );
  }

  public listCases(
    accessToken: string,
    query: AdminCaseDirectoryQuery,
  ): Promise<AdminCaseDirectoryPage> {
    const parameters = new URLSearchParams();
    if (query.pageSize) parameters.set("page_size", String(query.pageSize));
    if (query.after) parameters.set("after", query.after);
    if (query.before) parameters.set("before", query.before);
    if (query.search) parameters.set("search", query.search);
    if (query.kind) parameters.set("kind", query.kind);
    if (query.supportState) {
      parameters.set("support_state", query.supportState);
    }
    if (query.safetyState) parameters.set("safety_state", query.safetyState);
    if (query.sort) parameters.set("sort", query.sort);
    return this.request(`/v1/internal-sandbox/admin/cases?${parameters}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  public getCase(
    accessToken: string,
    kind: AdminCaseKind,
    caseId: string,
  ): Promise<AdminCaseDetail> {
    return this.request(
      `/v1/internal-sandbox/admin/cases/${kind}/${encodeURIComponent(caseId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  public performCaseAction(
    accessToken: string,
    kind: AdminCaseKind,
    caseId: string,
    command: AdminCaseActionCommand,
  ): Promise<AdminCaseActionResult> {
    return this.request(
      `/v1/internal-sandbox/admin/cases/${kind}/${encodeURIComponent(caseId)}/actions/${command.action}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Idempotency-Key": command.idempotencyKey,
        },
        body: JSON.stringify({
          expectedVersion: command.expectedVersion,
          ...(command.note ? { note: command.note } : {}),
          ...(command.evidenceGrantId
            ? { evidenceGrantId: command.evidenceGrantId }
            : {}),
          ...(command.ticketId ? { ticketId: command.ticketId } : {}),
          ...(command.purposeCode
            ? { purposeCode: command.purposeCode }
            : {}),
          ...(command.requestedFields
            ? { requestedFields: command.requestedFields }
            : {}),
          ...(command.ttlMinutes !== undefined
            ? { ttlMinutes: command.ttlMinutes }
            : {}),
        }),
      },
    );
  }

  public listFinanceResources(
    accessToken: string,
    query: AdminFinanceDirectoryQuery,
  ): Promise<AdminFinanceDirectoryPage> {
    const parameters = new URLSearchParams();
    if (query.pageSize) parameters.set("page_size", String(query.pageSize));
    if (query.after) parameters.set("after", query.after);
    if (query.before) parameters.set("before", query.before);
    if (query.search) parameters.set("search", query.search);
    if (query.kind) parameters.set("kind", query.kind);
    if (query.state) parameters.set("state", query.state);
    if (query.blocking !== undefined) {
      parameters.set("blocking", String(query.blocking));
    }
    if (query.sort) parameters.set("sort", query.sort);
    return this.request(`/v1/internal-sandbox/admin/finance?${parameters}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  public getFinanceResource(
    accessToken: string,
    kind: AdminFinanceResourceKind,
    resourceId: string,
  ): Promise<AdminFinanceDetail> {
    return this.request(
      `/v1/internal-sandbox/admin/finance/${encodeURIComponent(kind)}/${encodeURIComponent(resourceId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  public performFinanceAction(
    accessToken: string,
    kind: AdminFinanceResourceKind,
    resourceId: string,
    command: AdminFinanceActionCommand,
  ): Promise<AdminFinanceActionResult> {
    return this.request(
      `/v1/internal-sandbox/admin/finance/${encodeURIComponent(kind)}/${encodeURIComponent(resourceId)}/actions/${encodeURIComponent(command.action)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Idempotency-Key": command.idempotencyKey,
        },
        body: JSON.stringify({
          expectedVersion: command.expectedVersion,
          reasonCode: command.reasonCode,
          ...(command.evidenceReference
            ? { evidenceReference: command.evidenceReference }
            : {}),
        }),
      },
    );
  }

  public listExecutiveResources(
    accessToken: string,
    query: AdminExecutiveDirectoryQuery,
  ): Promise<AdminExecutiveDirectoryPage> {
    const parameters = new URLSearchParams();
    if (query.pageSize) parameters.set("page_size", String(query.pageSize));
    if (query.after) parameters.set("after", query.after);
    if (query.before) parameters.set("before", query.before);
    if (query.search) parameters.set("search", query.search);
    if (query.kind) parameters.set("kind", query.kind);
    if (query.state) parameters.set("state", query.state);
    if (query.domain) parameters.set("domain", query.domain);
    if (query.blocking !== undefined) {
      parameters.set("blocking", String(query.blocking));
    }
    if (query.sort) parameters.set("sort", query.sort);
    return this.request(`/v1/internal-sandbox/admin/executive?${parameters}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  public getExecutiveResource(
    accessToken: string,
    kind: AdminExecutiveResourceKind,
    resourceId: string,
  ): Promise<AdminExecutiveDetail> {
    return this.request(
      `/v1/internal-sandbox/admin/executive/${encodeURIComponent(kind)}/${encodeURIComponent(resourceId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  public performExecutiveAction(
    accessToken: string,
    kind: AdminExecutiveResourceKind,
    resourceId: string,
    command: AdminExecutiveActionCommand,
  ): Promise<AdminExecutiveActionResult> {
    return this.request(
      `/v1/internal-sandbox/admin/executive/${encodeURIComponent(kind)}/${encodeURIComponent(resourceId)}/actions/${encodeURIComponent(command.action)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Idempotency-Key": command.idempotencyKey,
        },
        body: JSON.stringify({
          ...(command.expectedVersion !== undefined
            ? { expectedVersion: command.expectedVersion }
            : {}),
          ...(command.reasonCode ? { reasonCode: command.reasonCode } : {}),
          ...(command.decisionCode
            ? { decisionCode: command.decisionCode }
            : {}),
          ...(command.responsibleRole
            ? { responsibleRole: command.responsibleRole }
            : {}),
          ...(command.dueAt ? { dueAt: command.dueAt } : {}),
          ...(command.supersedesOpinionId
            ? { supersedesOpinionId: command.supersedesOpinionId }
            : {}),
          ...(command.domain ? { domain: command.domain } : {}),
          ...(command.purpose ? { purpose: command.purpose } : {}),
          ...(command.fieldSet ? { fieldSet: command.fieldSet } : {}),
          ...(command.windowStart ? { windowStart: command.windowStart } : {}),
          ...(command.windowEnd ? { windowEnd: command.windowEnd } : {}),
        }),
      },
    );
  }

  public listAuditResources(
    accessToken: string,
    query: AdminAuditDirectoryQuery,
  ): Promise<AdminAuditDirectoryPage> {
    const parameters = new URLSearchParams();
    if (query.pageSize) parameters.set("page_size", String(query.pageSize));
    if (query.after) parameters.set("after", query.after);
    if (query.before) parameters.set("before", query.before);
    if (query.search) parameters.set("search", query.search);
    if (query.kind) parameters.set("kind", query.kind);
    if (query.domain) parameters.set("domain", query.domain);
    if (query.result) parameters.set("result", query.result);
    if (query.sort) parameters.set("sort", query.sort);
    return this.request(`/v1/internal-sandbox/admin/audit?${parameters}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  public getAuditResource(
    accessToken: string,
    kind: AdminAuditResourceKind,
    resourceId: string,
  ): Promise<AdminAuditDetail> {
    return this.request(
      `/v1/internal-sandbox/admin/audit/${encodeURIComponent(kind)}/${encodeURIComponent(resourceId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  public performAuditAction(
    accessToken: string,
    kind: AdminAuditResourceKind,
    resourceId: string,
    command: AdminAuditActionCommand,
  ): Promise<AdminAuditActionResult> {
    return this.request(
      `/v1/internal-sandbox/admin/audit/${encodeURIComponent(kind)}/${encodeURIComponent(resourceId)}/actions/${encodeURIComponent(command.action)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Idempotency-Key": command.idempotencyKey,
        },
        body: JSON.stringify({
          expectedVersion: command.expectedVersion,
          reasonCode: command.reasonCode,
          ...(command.note ? { note: command.note } : {}),
          ...(command.assigneeWorkIdentityId
            ? { assigneeWorkIdentityId: command.assigneeWorkIdentityId }
            : {}),
        }),
      },
    );
  }

  public listDataReports(
    accessToken: string,
    query: AdminDataReportDirectoryQuery,
  ): Promise<AdminDataReportDirectoryPage> {
    const parameters = new URLSearchParams();
    if (query.pageSize) parameters.set("page_size", String(query.pageSize));
    if (query.after) parameters.set("after", query.after);
    if (query.before) parameters.set("before", query.before);
    if (query.search) parameters.set("search", query.search);
    if (query.domain) parameters.set("domain", query.domain);
    if (query.state) parameters.set("state", query.state);
    if (query.sort) parameters.set("sort", query.sort);
    return this.request(`/v1/internal-sandbox/admin/reports?${parameters}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  public getDataReport(
    accessToken: string,
    reportId: string,
  ): Promise<AdminDataReportDetail> {
    return this.request(
      `/v1/internal-sandbox/admin/reports/${encodeURIComponent(reportId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  public performDataReportAction(
    accessToken: string,
    reportId: string,
    command: AdminDataReportActionCommand,
  ): Promise<AdminDataReportActionResult> {
    return this.request(
      `/v1/internal-sandbox/admin/reports/${encodeURIComponent(reportId)}/actions/${command.action}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Idempotency-Key": command.idempotencyKey,
        },
        body: JSON.stringify({
          expectedVersion: command.expectedVersion,
          reasonCode: command.reasonCode,
        }),
      },
    );
  }

  public listMemberships(
    accessToken: string,
    query: AdminMembershipDirectoryQuery,
  ): Promise<AdminMembershipDirectoryPage> {
    const parameters = new URLSearchParams();
    if (query.pageSize) parameters.set("page_size", String(query.pageSize));
    if (query.after) parameters.set("after", query.after);
    if (query.before) parameters.set("before", query.before);
    if (query.search) parameters.set("search", query.search);
    if (query.organizationType) {
      parameters.set("organization_type", query.organizationType);
    }
    if (query.state) parameters.set("state", query.state);
    if (query.authorizationLevel) {
      parameters.set("authorization_level", query.authorizationLevel);
    }
    if (query.capability) parameters.set("capability", query.capability);
    if (query.sort) parameters.set("sort", query.sort);
    return this.request(
      `/v1/internal-sandbox/admin/memberships?${parameters}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  public getMembership(
    accessToken: string,
    membershipId: string,
  ): Promise<AdminMembershipDetail> {
    return this.request(
      `/v1/internal-sandbox/admin/memberships/${encodeURIComponent(membershipId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  public performMembershipAction(
    accessToken: string,
    membershipId: string,
    command: AdminMembershipActionCommand,
  ): Promise<AdminMembershipActionResult> {
    return this.request(
      `/v1/internal-sandbox/admin/memberships/${encodeURIComponent(membershipId)}/actions/${command.action}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Idempotency-Key": command.idempotencyKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expectedVersion: command.expectedVersion,
          reasonCode: command.reasonCode,
        }),
      },
    );
  }

  private async requestProductSession(
    path: string,
    init: RequestInit,
  ): Promise<AdminProductSession> {
    const value = await this.request<unknown>(path, init);
    if (!isAdminProductSession(value)) {
      throw new Error("ADMIN_SESSION_CONTRACT_INVALID");
    }
    return value;
  }

  private async request<TResult>(path: string, init: RequestInit = {}): Promise<TResult> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "X-Correlation-Id": identifier("admin-product"),
          "X-Request-Id": identifier("admin-request"),
          ...init.headers,
        },
      });
    } catch {
      throw new Error("SERVICE_UNAVAILABLE");
    }
    if (!response.ok) {
      const payload = (await response.json()) as ApiErrorResponse;
      throw new Error(payload.error.code);
    }
    if (response.status === 204) return undefined as TResult;
    return (await response.json()) as TResult;
  }
}

function isAdminProductSession(value: unknown): value is AdminProductSession {
  if (!isRecord(value) || !isRecord(value.workIdentity) || !isRecord(value.navigation)) {
    return false;
  }
  return (
    typeof value.accessToken === "string" &&
    typeof value.refreshToken === "string" &&
    typeof value.sessionFamilyId === "string" &&
    isAuthorizationLevel(value.workIdentity.authorizationLevel) &&
    Array.isArray(value.workIdentity.capabilities) &&
    value.workIdentity.capabilities.every((capability) =>
      typeof capability === "string"
    ) &&
    Array.isArray(value.navigation.items) &&
    Array.isArray(value.navigation.routePermissions)
  );
}

function isAuthorizationLevel(
  value: unknown,
): value is AdminProductSession["workIdentity"]["authorizationLevel"] {
  return value === "level_1" || value === "level_2" || value === "level_3";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fleetQueryParameters(
  query: Readonly<{
    pageSize?: 25 | 50 | 100;
    after?: string;
    before?: string;
    search?: string;
    sort?: string;
  }>,
  stateKey: string,
  stateValue: string | undefined,
): URLSearchParams {
  const parameters = new URLSearchParams();
  if (query.pageSize) parameters.set("page_size", String(query.pageSize));
  if (query.after) parameters.set("after", query.after);
  if (query.before) parameters.set("before", query.before);
  if (query.search) parameters.set("search", query.search);
  if (stateValue) parameters.set(stateKey, stateValue);
  if (query.sort) parameters.set("sort", query.sort);
  return parameters;
}

function identifier(prefix: string): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}`;
}
