import type {
  AdminAccessClient,
  AdminAuditEvent,
  AdminInternalSession,
  AdminOperatorDirectoryEntry,
  AdminOperatorManagementClient,
  AdminOperatorManagementCommand,
  AdminOperatorManagementCommandResult,
  AdminOperator360,
  AdminOperatorOnboardingCase,
  AdminDriver360,
  AdminVehicle360,
  AdminPrimaryOperatorMigrationCase,
  AdminOperatorWorkbench,
  AdminPlatformWorkbench,
  AdminTrip360,
  AdminTripCaseManagementClient,
  AdminTripCaseManagementCommand,
  AdminTripCaseManagementCommandResult,
  AdminTripOperationsCenter,
  AdminSupportCase,
  AdminSafetyInvestigation,
  AdminEvidenceGrant,
  AdminEvidenceFieldResult,
  AdminCommandRecoveryTask,
  AdminFinanceOperationsClient,
  AdminFinanceOperationsCenter,
  AdminAllocationSettlement,
  AdminDriverPayout,
  AdminRefundReversal,
  AdminReconciliationFundCases,
  AdminBusinessDayClose,
  AdminLedgerTransaction,
  AdminFinanceOperationsCommand,
  AdminFinanceOperationsCommandResult,
  AdminExecutiveDashboardClient,
  AdminExecutiveOverview,
  AdminExecutiveOperationsHealth,
  AdminExecutiveOperatorHealth,
  AdminExecutiveFinanceSafety,
  AdminExecutiveSafetyCompliance,
  AdminExecutiveDecisionsMetrics,
  AdminExecutiveMetricRegistry,
  AdminExecutiveDrilldown,
  RecordExecutiveDecisionOpinionCommand,
  ExecutiveDecisionOpinion,
  CreateExecutiveExportRequestCommand,
  ExecutiveExportRequest,
  ExecutiveExportDecisionCommand,
  ExecutiveExportRevocationCommand,
  ExecutiveExportDownload,
  ApiErrorResponse,
} from "@pollycar/contracts";

export type SyntheticAdminIdentity =
  | "synthetic-platform-ops-001"
  | "synthetic-operator-ops-001"
  | "synthetic-support-001"
  | "synthetic-safety-officer-001"
  | "synthetic-safety-lead-001"
  | "synthetic-technical-ops-001"
  | "synthetic-finance-officer-001"
  | "synthetic-finance-lead-001"
  | "synthetic-operator-finance-officer-001"
  | "synthetic-operator-finance-lead-001"
  | "synthetic-auditor-001"
  | "synthetic-executive-sponsor-001"
  | "synthetic-operations-lead-001"
  | "synthetic-privacy-compliance-001"
  | "synthetic-operator-executive-001";

export class HttpAdminAccessClient
  implements
    AdminAccessClient,
    AdminOperatorManagementClient,
    AdminTripCaseManagementClient,
    AdminFinanceOperationsClient,
    AdminExecutiveDashboardClient
{
  public constructor(
    private readonly baseUrl: string,
    private readonly identity: SyntheticAdminIdentity,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  public getSession(): Promise<AdminInternalSession> {
    return this.request("/v1/internal-sandbox/admin/access/session");
  }

  public switchContext(organizationId: string): Promise<AdminInternalSession> {
    return this.request("/v1/internal-sandbox/admin/access/context", {
      method: "POST",
      headers: {
        "Idempotency-Key": createIdentifier("admin-context-switch"),
      },
      body: JSON.stringify({ organizationId }),
    });
  }

  public getPlatformWorkbench(): Promise<AdminPlatformWorkbench> {
    return this.request(
      "/v1/internal-sandbox/admin/access/platform-workbench",
    );
  }

  public getOperatorWorkbench(): Promise<AdminOperatorWorkbench> {
    return this.request(
      "/v1/internal-sandbox/admin/access/operator-workbench",
    );
  }

  public listOperatorDirectory(): Promise<
    readonly AdminOperatorDirectoryEntry[]
  > {
    return this.request("/v1/internal-sandbox/admin/access/operators");
  }

  public listAuditEvents(): Promise<readonly AdminAuditEvent[]> {
    return this.request("/v1/internal-sandbox/admin/access/audit");
  }

  public getOperator360(operatorId: string): Promise<AdminOperator360> {
    return this.request(
      `/v1/internal-sandbox/admin/operator-management/operators/${operatorId}`,
    );
  }

  public getOnboardingCase(
    onboardingCaseId: string,
  ): Promise<AdminOperatorOnboardingCase> {
    return this.request(
      `/v1/internal-sandbox/admin/operator-management/onboarding-cases/${onboardingCaseId}`,
    );
  }

  public getDriver360(driverAccountId: string): Promise<AdminDriver360> {
    return this.request(
      `/v1/internal-sandbox/admin/operator-management/drivers/${driverAccountId}`,
    );
  }

  public getVehicle360(vehicleId: string): Promise<AdminVehicle360> {
    return this.request(
      `/v1/internal-sandbox/admin/operator-management/vehicles/${vehicleId}`,
    );
  }

  public getMigrationCase(
    migrationCaseId: string,
  ): Promise<AdminPrimaryOperatorMigrationCase> {
    return this.request(
      `/v1/internal-sandbox/admin/operator-management/migrations/${migrationCaseId}`,
    );
  }

  public executeOperatorManagementCommand(
    command: AdminOperatorManagementCommand,
  ): Promise<AdminOperatorManagementCommandResult> {
    return this.request(
      "/v1/internal-sandbox/admin/operator-management/commands",
      {
        method: "POST",
        headers: {
          "Idempotency-Key": createIdentifier(`admin-${command.type}`),
        },
        body: JSON.stringify(command),
      },
    );
  }

  public getTripOperationsCenter(): Promise<AdminTripOperationsCenter> {
    return this.request(
      "/v1/internal-sandbox/admin/trip-case-management/trip-operations",
    );
  }

  public getTrip360(tripId: string): Promise<AdminTrip360> {
    return this.request(
      `/v1/internal-sandbox/admin/trip-case-management/trips/${tripId}`,
    );
  }

  public getSupportCase(supportCaseId: string): Promise<AdminSupportCase> {
    return this.request(
      `/v1/internal-sandbox/admin/trip-case-management/support-cases/${supportCaseId}`,
    );
  }

  public getSafetyInvestigation(
    safetyCaseId: string,
  ): Promise<AdminSafetyInvestigation> {
    return this.request(
      `/v1/internal-sandbox/admin/trip-case-management/safety-cases/${safetyCaseId}`,
    );
  }

  public getEvidenceGrant(grantId: string): Promise<AdminEvidenceGrant> {
    return this.request(
      `/v1/internal-sandbox/admin/trip-case-management/evidence-grants/${grantId}`,
    );
  }

  public readEvidenceField(
    grantId: string,
    field: AdminEvidenceFieldResult["field"],
  ): Promise<AdminEvidenceFieldResult> {
    return this.request(
      `/v1/internal-sandbox/admin/trip-case-management/evidence-grants/${grantId}/fields/${field}`,
    );
  }

  public getCommandRecoveryTask(
    recoveryTaskId: string,
  ): Promise<AdminCommandRecoveryTask> {
    return this.request(
      `/v1/internal-sandbox/admin/trip-case-management/recovery-tasks/${recoveryTaskId}`,
    );
  }

  public executeTripCaseManagementCommand(
    command: AdminTripCaseManagementCommand,
  ): Promise<AdminTripCaseManagementCommandResult> {
    return this.request(
      "/v1/internal-sandbox/admin/trip-case-management/commands",
      {
        method: "POST",
        headers: {
          "Idempotency-Key": createIdentifier(`admin-${command.type}`),
        },
        body: JSON.stringify(command),
      },
    );
  }

  public getFinanceOperationsCenter(): Promise<AdminFinanceOperationsCenter> {
    return this.request("/v1/internal-sandbox/admin/finance-operations/operations-center");
  }

  public getAllocationSettlement(settlementBatchId: string): Promise<AdminAllocationSettlement> {
    return this.request(`/v1/internal-sandbox/admin/finance-operations/allocation-settlements/${settlementBatchId}`);
  }

  public getDriverPayout(payoutBatchId: string): Promise<AdminDriverPayout> {
    return this.request(`/v1/internal-sandbox/admin/finance-operations/driver-payouts/${payoutBatchId}`);
  }

  public getRefundReversal(financeCaseId: string): Promise<AdminRefundReversal> {
    return this.request(`/v1/internal-sandbox/admin/finance-operations/refund-reversals/${financeCaseId}`);
  }

  public getReconciliationFundCases(reconciliationRunId: string): Promise<AdminReconciliationFundCases> {
    return this.request(`/v1/internal-sandbox/admin/finance-operations/reconciliation-runs/${reconciliationRunId}`);
  }

  public getBusinessDayClose(businessDate: string): Promise<AdminBusinessDayClose> {
    return this.request(`/v1/internal-sandbox/admin/finance-operations/business-days/${businessDate}`);
  }

  public getLedgerTransaction(ledgerTransactionId: string): Promise<AdminLedgerTransaction> {
    return this.request(`/v1/internal-sandbox/admin/finance-operations/ledger-transactions/${ledgerTransactionId}`);
  }

  public executeFinanceOperationsCommand(
    command: AdminFinanceOperationsCommand,
  ): Promise<AdminFinanceOperationsCommandResult> {
    return this.request("/v1/internal-sandbox/admin/finance-operations/commands", {
      method: "POST",
      headers: {
        "Idempotency-Key": createIdentifier(`admin-finance-${command.type}`),
      },
      body: JSON.stringify(command),
    });
  }

  public getExecutiveOverview(): Promise<AdminExecutiveOverview> {
    return this.request("/v1/internal-sandbox/admin/executive-dashboard/overview");
  }

  public getExecutiveOperationsHealth(): Promise<AdminExecutiveOperationsHealth> {
    return this.request("/v1/internal-sandbox/admin/executive-dashboard/operations-health");
  }

  public getExecutiveOperatorHealth(): Promise<AdminExecutiveOperatorHealth> {
    return this.request("/v1/internal-sandbox/admin/executive-dashboard/operator-health");
  }

  public getExecutiveFinanceSafety(): Promise<AdminExecutiveFinanceSafety> {
    return this.request("/v1/internal-sandbox/admin/executive-dashboard/finance-safety");
  }

  public getExecutiveSafetyCompliance(): Promise<AdminExecutiveSafetyCompliance> {
    return this.request("/v1/internal-sandbox/admin/executive-dashboard/safety-compliance");
  }

  public getExecutiveDecisionItems(): Promise<AdminExecutiveDecisionsMetrics> {
    return this.request("/v1/internal-sandbox/admin/executive-dashboard/decision-items");
  }

  public getExecutiveMetricRegistry(): Promise<AdminExecutiveMetricRegistry> {
    return this.request("/v1/internal-sandbox/admin/executive-dashboard/metrics");
  }

  public getExecutiveDrilldown(
    dimension: AdminExecutiveDrilldown["dimension"],
    dimensionId: string,
  ): Promise<AdminExecutiveDrilldown> {
    return this.request(`/v1/internal-sandbox/admin/executive-dashboard/drilldowns/${dimension}/${encodeURIComponent(dimensionId)}`);
  }

  public recordExecutiveDecisionOpinion(
    command: RecordExecutiveDecisionOpinionCommand,
  ): Promise<ExecutiveDecisionOpinion> {
    return this.executiveWrite("/v1/internal-sandbox/admin/executive-dashboard/decision-opinions", command);
  }

  public createExecutiveExportRequest(
    command: CreateExecutiveExportRequestCommand,
  ): Promise<ExecutiveExportRequest> {
    return this.executiveWrite("/v1/internal-sandbox/admin/executive-dashboard/export-requests", command);
  }

  public reviewExecutiveExportPrivacy(
    exportRequestId: string,
    command: ExecutiveExportDecisionCommand,
  ): Promise<ExecutiveExportRequest> {
    return this.executiveWrite(`/v1/internal-sandbox/admin/executive-dashboard/export-requests/${exportRequestId}/privacy-decision`, command);
  }

  public reviewExecutiveExportDomain(
    exportRequestId: string,
    command: ExecutiveExportDecisionCommand,
  ): Promise<ExecutiveExportRequest> {
    return this.executiveWrite(`/v1/internal-sandbox/admin/executive-dashboard/export-requests/${exportRequestId}/domain-decision`, command);
  }

  public revokeExecutiveExport(
    exportRequestId: string,
    command: ExecutiveExportRevocationCommand,
  ): Promise<ExecutiveExportRequest> {
    return this.executiveWrite(`/v1/internal-sandbox/admin/executive-dashboard/export-requests/${exportRequestId}/revocation`, command);
  }

  public downloadExecutiveExport(exportRequestId: string): Promise<ExecutiveExportDownload> {
    return this.request(`/v1/internal-sandbox/admin/executive-dashboard/export-requests/${exportRequestId}/download`);
  }

  private executiveWrite<TResult>(path: string, body: unknown): Promise<TResult> {
    return this.request(path, {
      method: "POST",
      headers: { "Idempotency-Key": createIdentifier("admin-executive") },
      body: JSON.stringify(body),
    });
  }

  private async request<TResult>(
    path: string,
    init: RequestInit = {},
  ): Promise<TResult> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Sandbox ${this.identity}`,
          "Content-Type": "application/json",
          "X-Correlation-Id": createIdentifier("admin-correlation"),
          "X-Request-Id": createIdentifier("admin-request"),
          ...init.headers,
        },
      });
    } catch {
      throw new Error(init.method === "POST" ? "UNKNOWN_RESULT" : "SERVICE_UNAVAILABLE");
    }
    if (!response.ok) {
      const payload = (await response.json()) as ApiErrorResponse;
      throw new Error(payload.error.code);
    }
    return (await response.json()) as TResult;
  }
}

function createIdentifier(prefix: string): string {
  return typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
