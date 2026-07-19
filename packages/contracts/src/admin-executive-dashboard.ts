import type { AdminOrganizationContext } from "./admin-access.js";

export type ExecutiveDashboardPageState =
  | "ready"
  | "partial"
  | "stale"
  | "unclosed"
  | "suppressed"
  | "unavailable"
  | "scope_denied"
  | "feature_disabled";

export type ExecutiveMetricValue = Readonly<{
  metricId: string;
  metricVersion: string;
  label: string;
  valueType: "basis_points" | "count" | "seconds" | "money_band" | "money_exact" | "health";
  value: number | string;
  displayValue: string;
  state: ExecutiveDashboardPageState;
  asOf: string;
  sourceStatus: "available" | "degraded" | "unavailable";
  closeStatus: "not_required" | "closed" | "unclosed";
  snapshotKey: Readonly<{
    metricId: string;
    metricVersion: string;
    windowStart: string;
    windowEnd: string;
    dimensionKey: string;
    organizationScopeDigest: string;
    asOf: string;
  }>;
  synthetic: true;
}>;

export type ExecutiveDashboardBase = Readonly<{
  context: AdminOrganizationContext;
  pageState: ExecutiveDashboardPageState;
  asOf: string;
  dataWindow: Readonly<{ start: string; end: string; timezone: "Asia/Shanghai" }>;
  notices: readonly string[];
  clientRecalculationAllowed: false;
  containsRealData: false;
  synthetic: true;
}>;

export type AdminExecutiveOverview = ExecutiveDashboardBase & Readonly<{
  metrics: readonly ExecutiveMetricValue[];
  majorBlockers: readonly Readonly<{
    blockerId: string;
    domain: "operations" | "finance" | "safety_compliance";
    severity: "attention" | "blocked";
    summary: string;
    sourceWorkspace: string;
  }>[];
  decisionItemCount: number;
}>;

export type AdminExecutiveOperationsHealth = ExecutiveDashboardBase & Readonly<{
  metrics: readonly ExecutiveMetricValue[];
  cities: readonly Readonly<{
    cityCode: string;
    cityName: string;
    completionRateBasisPoints: number;
    acceptanceRateBasisPoints: number;
    cancellationRateBasisPoints: number;
    matchingDurationP50Seconds: number;
    state: "healthy" | "attention" | "suppressed";
  }>[];
}>;

export type AdminExecutiveOperatorHealth = ExecutiveDashboardBase & Readonly<{
  ruleVersion: "operator-health-v1";
  operators: readonly Readonly<{
    operatorId: string;
    operatorName: string;
    health: "healthy" | "attention" | "blocked" | "unavailable";
    dimensions: Readonly<{
      service: "healthy" | "attention" | "blocked" | "unavailable";
      finance: "healthy" | "attention" | "blocked" | "unavailable";
      safety: "healthy" | "attention" | "blocked" | "unavailable";
      compliance: "healthy" | "attention" | "blocked" | "unavailable";
    }>;
    triggerReasons: readonly string[];
  }>[];
}>;

export type AdminExecutiveFinanceSafety = ExecutiveDashboardBase & Readonly<{
  disclosureLevel: "L2" | "L3";
  metrics: readonly ExecutiveMetricValue[];
  settlementStatus: "normal" | "attention" | "blocked";
  payoutStatus: "normal" | "attention" | "blocked";
  exactAmountAccessAllowed: boolean;
}>;

export type AdminExecutiveSafetyCompliance = ExecutiveDashboardBase & Readonly<{
  metrics: readonly ExecutiveMetricValue[];
  majorCases: readonly Readonly<{
    caseId: string;
    severity: "level_1" | "level_2";
    state: "investigating" | "awaiting_restoration_review";
    summary: string;
    originalEvidenceAvailable: false;
  }>[];
  permissionAnomalies: number;
  privacyRequestsOverdue: number;
}>;

export type ExecutiveDecisionOpinion = Readonly<{
  opinionId: string;
  decisionItemId: string;
  decisionCode: string;
  reasonCode: string;
  responsibleRole: string;
  dueAt: string;
  recordedBy: string;
  recordedAt: string;
  supersedesOpinionId?: string;
  businessStateChanged: false;
  appendOnly: true;
  synthetic: true;
}>;

export type AdminExecutiveDecisionItem = Readonly<{
  decisionItemId: string;
  operatorId?: string;
  domain: "operations" | "finance" | "safety_compliance";
  title: string;
  summary: string;
  responsibleRole: string;
  dueAt: string;
  state: "open";
  sourceWorkspace: string;
  opinions: readonly ExecutiveDecisionOpinion[];
  directApprovalAllowed: false;
  synthetic: true;
}>;

export type AdminExecutiveDecisionsMetrics = ExecutiveDashboardBase & Readonly<{
  decisionItems: readonly AdminExecutiveDecisionItem[];
  metrics: readonly ExecutiveMetricValue[];
}>;

export type AdminExecutiveMetricRegistry = ExecutiveDashboardBase & Readonly<{
  metrics: readonly Readonly<{
    metricId: string;
    metricVersion: string;
    name: string;
    definition: string;
    source: string;
    closeRequired: boolean;
    freshnessTarget: string;
    allowedDimensions: readonly ("city" | "operator" | "product" | "time")[];
  }>[];
}>;

export type AdminExecutiveDrilldown = ExecutiveDashboardBase & Readonly<{
  dimension: "city" | "operator" | "product" | "time";
  dimensionId: string;
  metrics: readonly ExecutiveMetricValue[];
  detailWorkspace: string;
  personLevelDetailReturned: false;
}>;

export type RecordExecutiveDecisionOpinionCommand = Readonly<{
  decisionItemId: string;
  decisionCode: string;
  reasonCode: string;
  responsibleRole: string;
  dueAt: string;
  resourceVersion: number;
  supersedesOpinionId?: string;
}>;

export type ExecutiveExportDomain = "operations" | "finance" | "safety_compliance";
export type ExecutiveExportState =
  | "awaiting_privacy_review"
  | "awaiting_domain_review"
  | "approved"
  | "downloaded"
  | "rejected"
  | "revoked"
  | "expired";

export type ExecutiveExportRequest = Readonly<{
  exportRequestId: string;
  domain: ExecutiveExportDomain;
  organizationType: AdminOrganizationContext["organizationType"];
  organizationId: string;
  organizationName: string;
  purpose: string;
  fieldSet: readonly string[];
  windowStart: string;
  windowEnd: string;
  state: ExecutiveExportState;
  requesterInternalUserId: string;
  requesterWorkIdentityId: string;
  privacyReviewerInternalUserId?: string;
  domainReviewerInternalUserId?: string;
  approvedAt?: string;
  expiresAt?: string;
  downloadedAt?: string;
  resourceVersion: number;
  encryptedAtRest: true;
  singleUse: true;
  synthetic: true;
}>;

export type CreateExecutiveExportRequestCommand = Readonly<{
  domain: ExecutiveExportDomain;
  purpose: string;
  fieldSet: readonly string[];
  windowStart: string;
  windowEnd: string;
}>;

export type ExecutiveExportDecisionCommand = Readonly<{
  decision: "approve" | "reject";
  reasonCode: string;
  resourceVersion: number;
}>;

export type ExecutiveExportRevocationCommand = Readonly<{
  reasonCode: string;
  resourceVersion: number;
}>;

export type ExecutiveExportDownload = Readonly<{
  exportRequestId: string;
  fileName: string;
  mediaType: "text/csv";
  contentBase64: string;
  deletedAfterDownload: true;
  synthetic: true;
}>;

export interface AdminExecutiveDashboardClient {
  getExecutiveOverview(): Promise<AdminExecutiveOverview>;
  getExecutiveOperationsHealth(): Promise<AdminExecutiveOperationsHealth>;
  getExecutiveOperatorHealth(): Promise<AdminExecutiveOperatorHealth>;
  getExecutiveFinanceSafety(): Promise<AdminExecutiveFinanceSafety>;
  getExecutiveSafetyCompliance(): Promise<AdminExecutiveSafetyCompliance>;
  getExecutiveDecisionItems(): Promise<AdminExecutiveDecisionsMetrics>;
  getExecutiveMetricRegistry(): Promise<AdminExecutiveMetricRegistry>;
  getExecutiveDrilldown(
    dimension: AdminExecutiveDrilldown["dimension"],
    dimensionId: string,
  ): Promise<AdminExecutiveDrilldown>;
  recordExecutiveDecisionOpinion(
    command: RecordExecutiveDecisionOpinionCommand,
  ): Promise<ExecutiveDecisionOpinion>;
  createExecutiveExportRequest(
    command: CreateExecutiveExportRequestCommand,
  ): Promise<ExecutiveExportRequest>;
  reviewExecutiveExportPrivacy(
    exportRequestId: string,
    command: ExecutiveExportDecisionCommand,
  ): Promise<ExecutiveExportRequest>;
  reviewExecutiveExportDomain(
    exportRequestId: string,
    command: ExecutiveExportDecisionCommand,
  ): Promise<ExecutiveExportRequest>;
  revokeExecutiveExport(
    exportRequestId: string,
    command: ExecutiveExportRevocationCommand,
  ): Promise<ExecutiveExportRequest>;
  downloadExecutiveExport(exportRequestId: string): Promise<ExecutiveExportDownload>;
}
