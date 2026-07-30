import {
  createHmac,
  randomBytes,
} from "node:crypto";
import type {
  AdminInvitationSummary,
  AdminAuditAction,
  AdminAuditActionCommand,
  AdminAuditActionResult,
  AdminAuditDetail,
  AdminAuditDirectoryItem,
  AdminAuditDirectoryPage,
  AdminAuditDirectoryQuery,
  AdminAuditDomain,
  AdminAuditEvent,
  AdminAuditInvestigation,
  AdminAuditResourceKind,
  AdminAuditTrailEvent,
  AdminRecordActionBlocker,
  AdminRecordActionBlockerCode,
  AdminRecordNextStep,
  AdminRecordNextStepKind,
  AdminCaseAction,
  AdminCaseActionCommand,
  AdminCaseActionResult,
  AdminCaseAuditEvent,
  AdminCaseDetail,
  AdminCaseDirectoryItem,
  AdminCaseDirectoryPage,
  AdminCaseDirectoryQuery,
  AdminCaseKind,
  AdminDataReportActionCommand,
  AdminDataReportActionResult,
  AdminDataReportAuditEvent,
  AdminDataReportDetail,
  AdminDataReportDirectoryItem,
  AdminDataReportDirectoryPage,
  AdminDataReportDirectoryQuery,
  AdminDataReportDomain,
  AdminDataReportMetric,
  AdminEvidenceGrant,
  AdminExecutiveAction,
  AdminExecutiveActionCommand,
  AdminExecutiveActionResult,
  AdminExecutiveAuditEvent,
  AdminExecutiveDetail,
  AdminExecutiveDirectoryItem,
  AdminExecutiveDirectoryPage,
  AdminExecutiveDirectoryQuery,
  AdminExecutiveResourceKind,
  AdminFinanceAction,
  AdminFinanceActionCommand,
  AdminFinanceActionResult,
  AdminFinanceAuditEvent,
  AdminFinanceDetail,
  AdminFinanceDirectoryItem,
  AdminFinanceDirectoryPage,
  AdminFinanceDirectoryQuery,
  AdminFinanceOperationsCommand,
  AdminFinanceResourceKind,
  AdminGlobalSearchGroup,
  AdminGlobalSearchQuery,
  AdminGlobalSearchResponse,
  AdminGlobalSearchResultItem,
  AdminHighRiskApprovalRecord,
  AdminSafetyCaseAction,
  AdminSafetyInvestigation,
  AdminSupportCase,
  AdminSupportCaseAction,
  AdminDriverDetail,
  AdminDriverDirectoryItem,
  AdminDriverDirectoryPage,
  AdminDriverDirectoryQuery,
  AdminLoginChallenge,
  AdminMembershipActionCommand,
  AdminMembershipActionResult,
  AdminMembershipAuditEvent,
  AdminMembershipDetail,
  AdminMembershipDirectoryItem,
  AdminMembershipDirectoryPage,
  AdminMembershipDirectoryQuery,
  AdminMembershipState,
  AdminMfaVerification,
  AdminNavigationDomain,
  AdminNavigationItem,
  AdminNavigationManifest,
  AdminOperatorAction,
  AdminOperatorActionCommand,
  AdminOperatorActionResult,
  AdminOperatorDetail,
  AdminOperatorDirectoryItem,
  AdminOperatorDirectoryPage,
  AdminOperatorDirectoryQuery,
  AdminOperator360,
  AdminOperationsTaskAction,
  AdminOperationsTaskActionCommand,
  AdminOperationsTaskActionResult,
  AdminOperationsTaskDetail,
  AdminOperationsTask,
  AdminOperationsTaskPage,
  AdminOperationsTaskQuery,
  AdminAuthorizationLevel,
  AdminBusinessCapability,
  AdminProductSession,
  AdminReviewMaterialReason,
  AdminReviewTaskDetail,
  AdminTripDetail,
  AdminTripDirectoryItem,
  AdminTripDirectoryPage,
  AdminTripDirectoryQuery,
  AdminTripOperationAction,
  AdminTripOperationActionCommand,
  AdminTripOperationActionResult,
  AdminVehicleDetail,
  AdminVehicleDirectoryItem,
  AdminVehicleDirectoryPage,
  AdminVehicleDirectoryQuery,
  AdminVehicleReviewAction,
  AdminVehicleReviewActionCommand,
  AdminVehicleReviewActionResult,
  AdminWorkIdentitySummary,
  RejectVehicleReviewAdminCommand,
} from "@pollycar/contracts";
import type {
  AdminAccessActor,
  AdminAccessService,
} from "./admin-access-service.js";
import type { AdminOperatorManagementService } from "./admin-operator-management-service.js";
import type { AdminReviewTaskService } from "./admin-review-task-service.js";
import type { AdminTripCaseManagementService } from "./admin-trip-case-management-service.js";
import type {
  AdminFinanceDirectorySource,
  AdminFinanceOperationsService,
} from "./admin-finance-operations-service.js";
import type { ExecutiveDashboardQueryService } from "./executive-dashboard-query-service.js";
import {
  createAdminToken,
  digestAdminValue,
  normalizeAdminEmail,
  safelyCompareAdminCredentials,
} from "./admin-authentication-credentials.js";

type AccountFixture = {
  readonly email: string;
  password: string;
  active: boolean;
  failedCount: number;
  lockedUntil?: number;
  readonly workIdentities: readonly AdminWorkIdentitySummary[];
};

type Challenge = Readonly<{
  challengeId: string;
  email: string;
  expiresAt: number;
}>;

type Selection = Readonly<{
  selectionToken: string;
  email: string;
  expiresAt: number;
}>;

type AdminAuthenticationSecurityPolicy = Readonly<{
  adminLoginMaximumAttempts: number;
  adminAccountLockSeconds: number;
  adminLoginChallengeTtlSeconds: number;
  adminWorkIdentitySelectionTtlSeconds: number;
  adminAccessSessionTtlSeconds: number;
  adminIdleSessionTtlSeconds: number;
  adminAbsoluteSessionTtlSeconds: number;
  adminMfaFreshnessSeconds: number;
}>;

type SessionRecord = {
  accountEmail: string;
  sessionFamilyId: string;
  accessToken: string;
  refreshToken: string;
  usedRefreshTokens: Set<string>;
  workIdentity: AdminWorkIdentitySummary;
  createdAt: number;
  lastUsedAt: number;
  accessExpiresAt: number;
  absoluteExpiresAt: number;
  mfaVerifiedAt: number;
  revoked: boolean;
};

type AdminOperationsTaskAuditEvent =
  AdminOperationsTaskDetail["auditTrail"][number];

type AdminOperationsTaskOperationRecord = Readonly<{
  fingerprint: string;
  result: AdminOperationsTaskActionResult;
}>;

type AdminOperatorOperationRecord = Readonly<{
  fingerprint: string;
  result: AdminOperatorActionResult;
}>;

type AdminOperatorAuditEvent = AdminOperatorDetail["auditTrail"][number];

type AdminVehicleOperationRecord = Readonly<{
  fingerprint: string;
  result: AdminVehicleReviewActionResult;
}>;

type AdminDriverAuditEvent = AdminDriverDetail["auditTrail"][number];

type AdminTripOperationRecord = Readonly<{
  fingerprint: string;
  result: AdminTripOperationActionResult;
}>;

type AdminTripAuditEvent = AdminTripDetail["auditTrail"][number];

type AdminCaseOperationRecord = Readonly<{
  fingerprint: string;
  result: AdminCaseActionResult;
}>;

type AdminFinanceOperationRecord = Readonly<{
  fingerprint: string;
  result: AdminFinanceActionResult;
}>;

type AdminExecutiveOperationRecord = Readonly<{
  fingerprint: string;
  result: AdminExecutiveActionResult;
}>;

type AdminAuditOperationRecord = Readonly<{
  fingerprint: string;
  result: AdminAuditActionResult;
}>;

type AdminDataReportOperationRecord = Readonly<{
  fingerprint: string;
  result: AdminDataReportActionResult;
}>;

type AdminMembershipOperationRecord = Readonly<{
  fingerprint: string;
  result: AdminMembershipActionResult;
}>;

type SyntheticMembershipDefinition = Readonly<{
  membershipId: string;
  internalUserId: string;
  workIdentity: AdminWorkIdentitySummary;
  displayName: string;
  workEmailMasked: string;
}>;

type SyntheticFleetDirectoryRecord = Readonly<{
  driverAccountId: string;
  displayNameMasked: string;
  phoneMasked: string;
  eligibilityState: AdminDriverDirectoryItem["eligibilityState"];
  vehicleId: string;
  plateMasked: string;
  vehicleSummary: string;
  operatorId: string;
  operatorName: string;
  initialReviewState: AdminVehicleDirectoryItem["reviewState"];
  initialReviewVersion: number;
  reviewTaskId?: string;
  updatedAt: string;
}>;

const SYNTHETIC_PASSWORD = "Rego-Internal-2026!";
const SYNTHETIC_TOTP = "826419";
const INVITATION_TOKEN = "invite-platform-access-001";
const invitationExpiresAt = Date.parse("2027-07-15T00:00:00.000Z");

const syntheticFleetDirectory: readonly SyntheticFleetDirectoryRecord[] = [
  {
    driverAccountId: "driver-synthetic-086",
    displayNameMasked: "陈*",
    phoneMasked: "138****7312",
    eligibilityState: "serviceable",
    vehicleId: "vehicle-synthetic-132",
    plateMasked: "沪A·7**21",
    vehicleSummary: "新能源五座轿车",
    operatorId: "operator-huhang",
    operatorName: "沪行出行服务",
    initialReviewState: "approved",
    initialReviewVersion: 9,
    updatedAt: "2026-07-15T08:30:00.000Z",
  },
  {
    driverAccountId: "driver-synthetic-104",
    displayNameMasked: "周*",
    phoneMasked: "139****2048",
    eligibilityState: "restricted",
    vehicleId: "vehicle-synthetic-204",
    plateMasked: "沪B·3**08",
    vehicleSummary: "舒适型五座轿车",
    operatorId: "operator-huhang",
    operatorName: "沪行出行服务",
    initialReviewState: "changes_requested",
    initialReviewVersion: 1,
    reviewTaskId: "task-001",
    updatedAt: "2026-07-15T09:10:00.000Z",
  },
  {
    driverAccountId: "driver-synthetic-118",
    displayNameMasked: "顾*",
    phoneMasked: "137****6621",
    eligibilityState: "restricted",
    vehicleId: "vehicle-synthetic-218",
    plateMasked: "沪C·9**16",
    vehicleSummary: "新能源五座轿车",
    operatorId: "operator-shencheng",
    operatorName: "申城伙伴运营",
    initialReviewState: "under_review",
    initialReviewVersion: 1,
    reviewTaskId: "task-002",
    updatedAt: "2026-07-15T09:20:00.000Z",
  },
  {
    driverAccountId: "driver-synthetic-126",
    displayNameMasked: "林*",
    phoneMasked: "136****5179",
    eligibilityState: "restricted",
    vehicleId: "vehicle-synthetic-226",
    plateMasked: "沪D·5**73",
    vehicleSummary: "紧凑型五座轿车",
    operatorId: "operator-haiwan",
    operatorName: "海湾城市服务",
    initialReviewState: "under_review",
    initialReviewVersion: 1,
    reviewTaskId: "task-003",
    updatedAt: "2026-07-15T09:30:00.000Z",
  },
];

const domainDefinition: Readonly<Record<AdminNavigationDomain, AdminNavigationItem>> =
  Object.freeze({
    workbench: item("workbench", "工作台", "/admin/workbench", [
      ["overview", "我的工作台", "/admin/workbench"],
      ["tasks", "待办任务", "/admin/workbench/tasks"],
    ]),
    organization_accounts: item(
      "organization_accounts",
      "成员与权限",
      "/admin/organization-accounts",
      [["members", "成员与权限", "/admin/organization-accounts/members"]],
    ),
    operator_management: item(
      "operator_management",
      "运营公司",
      "/admin/operators",
      [["directory", "运营公司名录", "/admin/operators"]],
    ),
    driver_vehicle: item("driver_vehicle", "车主与车辆", "/admin/fleet", [
      ["drivers", "车主名录", "/admin/fleet/drivers"],
      ["vehicles", "车辆名录", "/admin/fleet/vehicles"],
    ]),
    trip_operations: item("trip_operations", "行程运营", "/admin/trips", [
      ["operations", "行程任务", "/admin/trips"],
    ]),
    support_safety: item("support_safety", "客服与安全", "/admin/cases", [
      ["support", "客服案件", "/admin/cases/support"],
      ["safety", "安全协作", "/admin/cases/safety"],
    ]),
    finance_operations: item(
      "finance_operations",
      "财务与对账",
      "/admin/finance",
      [["overview", "财务任务名录", "/admin/finance"]],
    ),
    data_reports: item("data_reports", "数据与报表", "/admin/reports", [
      ["operations", "运营报表", "/admin/reports"],
    ]),
    executive_dashboard: item(
      "executive_dashboard",
      "高层驾驶舱",
      "/admin/executive",
      [["overview", "经营概览", "/admin/executive"]],
    ),
    audit_system: item("audit_system", "审计与系统", "/admin/governance", [
      ["audit", "审计记录", "/admin/governance/audit"],
      ["sessions", "会话管理", "/admin/governance/sessions"],
    ]),
  });

const capabilityDomains: Readonly<
  Record<AdminBusinessCapability, readonly AdminNavigationDomain[]>
> = Object.freeze({
  operations_task: ["workbench"],
  operator_governance: ["operator_management", "driver_vehicle"],
  fleet_operation: ["driver_vehicle"],
  fleet_review: ["driver_vehicle"],
  trip_operation: ["trip_operations"],
  support_case: ["trip_operations", "support_safety"],
  safety_investigation: ["driver_vehicle", "trip_operations", "support_safety"],
  safety_restoration_review: ["support_safety"],
  finance_operation: ["finance_operations"],
  finance_review: ["finance_operations", "data_reports"],
  privacy_governance: [
    "support_safety",
    "finance_operations",
    "data_reports",
    "executive_dashboard",
    "audit_system",
  ],
  analytics_read: ["data_reports"],
  audit_read: [
    "organization_accounts",
    "operator_management",
    "driver_vehicle",
    "trip_operations",
    "support_safety",
    "finance_operations",
    "data_reports",
    "audit_system",
  ],
  technical_recovery: ["audit_system"],
  executive_read: ["data_reports", "executive_dashboard"],
  membership_governance: ["organization_accounts", "audit_system"],
});

export class AdminAuthenticationService {
  private readonly accounts = new Map<string, AccountFixture>();
  private readonly challenges = new Map<string, Challenge>();
  private readonly selections = new Map<string, Selection>();
  private readonly sessionsByAccess = new Map<string, SessionRecord>();
  private readonly sessionsByRefresh = new Map<string, SessionRecord>();
  private readonly tasks = createTasks();
  private readonly taskAuditTrails = new Map<
    string,
    AdminOperationsTaskAuditEvent[]
  >();
  private readonly taskOperations = new Map<
    string,
    AdminOperationsTaskOperationRecord
  >();
  private readonly operatorOperations = new Map<
    string,
    AdminOperatorOperationRecord
  >();
  private readonly operatorAuditTrails = new Map<
    string,
    AdminOperatorAuditEvent[]
  >();
  private readonly driverAuditTrails = new Map<
    string,
    AdminDriverAuditEvent[]
  >();
  private readonly vehicleOperations = new Map<
    string,
    AdminVehicleOperationRecord
  >();
  private readonly vehicleViewAuditedAt = new Map<string, number>();
  private readonly tripOperations = new Map<string, AdminTripOperationRecord>();
  private readonly tripAuditTrails = new Map<string, AdminTripAuditEvent[]>();
  private readonly caseOperations = new Map<string, AdminCaseOperationRecord>();
  private readonly caseAuditTrails = new Map<string, AdminCaseAuditEvent[]>();
  private readonly caseViewAuditedAt = new Map<string, number>();
  private readonly financeOperations = new Map<
    string,
    AdminFinanceOperationRecord
  >();
  private readonly financeAuditTrails = new Map<
    string,
    AdminFinanceAuditEvent[]
  >();
  private readonly highRiskApprovalRecords = new Map<
    string,
    AdminHighRiskApprovalRecord
  >();
  private readonly financeViewAuditedAt = new Map<string, number>();
  private readonly executiveOperations = new Map<
    string,
    AdminExecutiveOperationRecord
  >();
  private readonly executiveAuditTrails = new Map<
    string,
    AdminExecutiveAuditEvent[]
  >();
  private readonly executiveViewAuditedAt = new Map<string, number>();
  private readonly auditInvestigations = new Map<
    string,
    AdminAuditInvestigation
  >();
  private readonly auditOperations = new Map<
    string,
    AdminAuditOperationRecord
  >();
  private readonly auditTrails = new Map<string, AdminAuditTrailEvent[]>();
  private readonly auditViewAuditedAt = new Map<string, number>();
  private readonly dataReportVersions = new Map<string, number>();
  private readonly dataReportRefreshedAt = new Map<string, string>();
  private readonly dataReportOperations = new Map<
    string,
    AdminDataReportOperationRecord
  >();
  private readonly dataReportAuditTrails = new Map<
    string,
    AdminDataReportAuditEvent[]
  >();
  private readonly dataReportViewAuditedAt = new Map<string, number>();
  private readonly membershipDefinitions = new Map<
    string,
    SyntheticMembershipDefinition
  >();
  private readonly membershipStates = new Map<string, AdminMembershipState>();
  private readonly membershipVersions = new Map<string, number>();
  private readonly membershipUpdatedAt = new Map<string, string>();
  private readonly membershipAuditTrails = new Map<
    string,
    AdminMembershipAuditEvent[]
  >();
  private readonly membershipOperations = new Map<
    string,
    AdminMembershipOperationRecord
  >();
  private readonly membershipViewAuditedAt = new Map<string, number>();
  private readonly vehicleReviewStates = new Map<
    string,
    Readonly<{
      state: AdminVehicleDirectoryItem["reviewState"];
      version: number;
      updatedAt: string;
    }>
  >(
    syntheticFleetDirectory.map((record) => [
      record.vehicleId,
      {
        state: record.initialReviewState,
        version: record.initialReviewVersion,
        updatedAt: record.updatedAt,
      },
    ]),
  );
  private invitationActivated = false;

  public constructor(
    private readonly authenticationEnabled: boolean,
    private readonly roleMatrixEnabled: boolean,
    private readonly now: () => Date = () => new Date(),
    private readonly operatorManagementEnabled = false,
    private readonly driverVehicleEnabled = false,
    private readonly tripOperationsEnabled = false,
    private readonly caseManagementEnabled = false,
    private readonly financeOperationsEnabled = false,
    private readonly executiveDashboardEnabled = false,
    private readonly cursorSecret = randomBytes(32),
    private readonly auditSystemEnabled = false,
    private readonly dataReportsEnabled = false,
    private readonly organizationAccountsEnabled = false,
    private readonly securityPolicy: AdminAuthenticationSecurityPolicy = {
      adminLoginMaximumAttempts: 5,
      adminAccountLockSeconds: 30 * 60,
      adminLoginChallengeTtlSeconds: 5 * 60,
      adminWorkIdentitySelectionTtlSeconds: 5 * 60,
      adminAccessSessionTtlSeconds: 15 * 60,
      adminIdleSessionTtlSeconds: 30 * 60,
      adminAbsoluteSessionTtlSeconds: 8 * 60 * 60,
      adminMfaFreshnessSeconds: 15 * 60,
    },
  ) {
    for (const account of createAccounts()) this.accounts.set(account.email, account);
    for (const task of this.tasks) {
      const createdAt = new Date(
        new Date(task.updatedAt).getTime() - 60 * 60_000,
      ).toISOString();
      this.taskAuditTrails.set(task.taskId, [
        {
          eventId: `audit-${task.taskId}-created`,
          action: "task_created",
          actorLabel: "任务系统",
          occurredAt: createdAt,
        },
        {
          eventId: `audit-${task.taskId}-scope`,
          action: "scope_checked",
          actorLabel: "权限系统",
          occurredAt: task.updatedAt,
        },
      ]);
    }
    for (const definition of dataReportDefinitions) {
      this.dataReportVersions.set(definition.reportId, 1);
      this.dataReportRefreshedAt.set(
        definition.reportId,
        this.now().toISOString(),
      );
    }
    for (const definition of createMembershipDefinitions(this.accounts)) {
      this.membershipDefinitions.set(definition.membershipId, definition);
      this.membershipStates.set(definition.membershipId, "active");
      this.membershipVersions.set(definition.membershipId, 1);
      this.membershipUpdatedAt.set(
        definition.membershipId,
        this.now().toISOString(),
      );
    }
  }

  public getInvitation(token: string): AdminInvitationSummary {
    this.assertAuthenticationEnabled();
    if (token !== INVITATION_TOKEN || this.invitationActivated) {
      throw new Error("ADMIN_INVITATION_INVALID");
    }
    if (this.now().getTime() >= invitationExpiresAt) throw new Error("ADMIN_INVITATION_EXPIRED");
    return {
      invitationToken: token,
      workEmailMasked: "n***@rego.example",
      organizationName: "PollyCar 平台",
      positionName: "平台账号管理员",
      cityScopes: ["上海"],
      expiresAt: new Date(invitationExpiresAt).toISOString(),
      state: "pending",
      synthetic: true,
    };
  }

  public activateInvitation(
    token: string,
    password: string,
    totpCode: string,
  ): Readonly<{ recoveryCodes: readonly string[]; synthetic: true }> {
    this.getInvitation(token);
    if (password.length < 12 || totpCode !== SYNTHETIC_TOTP) {
      throw new Error("VALIDATION_FAILED");
    }
    const account = this.accounts.get("new.admin@rego.example");
    if (!account) throw new Error("INTERNAL_UNEXPECTED_ERROR");
    account.password = password;
    account.active = true;
    this.invitationActivated = true;
    return {
      recoveryCodes: ["PCAR-A7K9-M2Q4", "PCAR-B8L3-N6R1", "PCAR-C5T2-P9W7"],
      synthetic: true,
    };
  }

  public startLogin(workEmail: string, password: string): AdminLoginChallenge {
    this.assertAuthenticationEnabled();
    const email = normalizeAdminEmail(workEmail);
    const account = this.accounts.get(email);
    const now = this.now().getTime();
    if (!account?.active) throw new Error("ADMIN_CREDENTIAL_INVALID");
    if (account.lockedUntil && account.lockedUntil > now) throw new Error("ADMIN_ACCOUNT_LOCKED");
    if (!safelyCompareAdminCredentials(account.password, password)) {
      account.failedCount += 1;
      if (
        account.failedCount >=
        this.securityPolicy.adminLoginMaximumAttempts
      ) {
        account.failedCount = 0;
        account.lockedUntil =
          now + this.securityPolicy.adminAccountLockSeconds * 1000;
      }
      throw new Error("ADMIN_CREDENTIAL_INVALID");
    }
    account.failedCount = 0;
    delete account.lockedUntil;
    const challengeId = token("challenge");
    const expiresAt =
      now + this.securityPolicy.adminLoginChallengeTtlSeconds * 1000;
    this.challenges.set(challengeId, { challengeId, email, expiresAt });
    return {
      challengeId,
      expiresAt: new Date(expiresAt).toISOString(),
      factor: "totp",
      synthetic: true,
    };
  }

  public verifyMfa(challengeId: string, totpCode: string): AdminMfaVerification {
    this.assertAuthenticationEnabled();
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.expiresAt <= this.now().getTime()) {
      throw new Error("ADMIN_LOGIN_CHALLENGE_EXPIRED");
    }
    if (totpCode !== SYNTHETIC_TOTP) throw new Error("ADMIN_MFA_INVALID");
    this.challenges.delete(challengeId);
    const selectionToken = token("selection");
    const expiresAt =
      this.now().getTime() +
      this.securityPolicy.adminWorkIdentitySelectionTtlSeconds * 1000;
    this.selections.set(selectionToken, {
      selectionToken,
      email: challenge.email,
      expiresAt,
    });
    const workIdentities = this.accounts
      .get(challenge.email)!
      .workIdentities.filter((identity) => this.isWorkIdentityActive(identity));
    if (workIdentities.length === 0) throw new Error("ADMIN_CREDENTIAL_INVALID");
    return {
      selectionToken,
      workIdentities,
      expiresAt: new Date(expiresAt).toISOString(),
      synthetic: true,
    };
  }

  public selectWorkIdentity(
    selectionToken: string,
    workIdentityId: string,
  ): AdminProductSession {
    this.assertRoleMatrixEnabled();
    const selection = this.selections.get(selectionToken);
    if (!selection || selection.expiresAt <= this.now().getTime()) {
      throw new Error("ADMIN_WORK_IDENTITY_SELECTION_EXPIRED");
    }
    const account = this.accounts.get(selection.email)!;
    const identity = account.workIdentities.find(
      (candidate) => candidate.workIdentityId === workIdentityId,
    );
    if (!identity) throw new Error("ADMIN_WORK_IDENTITY_FORBIDDEN");
    if (!this.isWorkIdentityActive(identity)) {
      throw new Error("ADMIN_WORK_IDENTITY_FORBIDDEN");
    }
    this.selections.delete(selectionToken);
    this.revokeOldestIfNeeded(selection.email);
    return this.issueSession(identity, selection.email);
  }

  public switchWorkIdentity(
    accessToken: string,
    workIdentityId: string,
  ): AdminProductSession {
    const current = this.authenticate(accessToken);
    const now = this.now().getTime();
    if (
      current.mfaVerifiedAt +
        this.securityPolicy.adminMfaFreshnessSeconds * 1000 <=
      now
    ) {
      throw new Error("ADMIN_AUTH_MFA_FRESHNESS_REQUIRED");
    }
    const account = this.accounts.get(current.accountEmail);
    const identity = account?.workIdentities.find(
      (candidate) => candidate.workIdentityId === workIdentityId,
    );
    if (!identity || !this.isWorkIdentityActive(identity)) {
      throw new Error("ADMIN_WORK_IDENTITY_FORBIDDEN");
    }
    if (identity.workIdentityId === current.workIdentity.workIdentityId) {
      return this.toSession(current);
    }
    current.revoked = true;
    this.sessionsByAccess.delete(current.accessToken);
    this.revokeOldestIfNeeded(current.accountEmail);
    return this.issueSession(identity, current.accountEmail, current.mfaVerifiedAt);
  }

  public refreshSession(refreshToken: string): AdminProductSession {
    this.assertRoleMatrixEnabled();
    const record = this.sessionsByRefresh.get(refreshToken);
    if (!record) throw new Error("REFRESH_SESSION_EXPIRED");
    if (record.usedRefreshTokens.has(refreshToken)) {
      record.revoked = true;
      throw new Error("REFRESH_TOKEN_REPLAYED");
    }
    this.assertRefreshable(record);
    record.usedRefreshTokens.add(refreshToken);
    this.sessionsByAccess.delete(record.accessToken);
    record.accessToken = token("admin-access");
    record.refreshToken = token("admin-refresh");
    record.accessExpiresAt = this.now().getTime() + 15 * 60_000;
    record.lastUsedAt = this.now().getTime();
    this.sessionsByAccess.set(record.accessToken, record);
    this.sessionsByRefresh.set(record.refreshToken, record);
    return this.toSession(record);
  }

  public logout(accessToken: string): void {
    const record = this.sessionsByAccess.get(accessToken);
    if (record) record.revoked = true;
  }

  public getNavigation(accessToken: string): AdminNavigationManifest {
    return this.navigationFor(this.authenticate(accessToken));
  }

  public async searchAcrossDomains(
    accessToken: string,
    query: AdminGlobalSearchQuery,
    dependencies: Readonly<{
      operatorManagement: AdminOperatorManagementService;
      adminReviews: AdminReviewTaskService;
      tripCaseManagement: AdminTripCaseManagementService;
      financeOperations: AdminFinanceOperationsService;
      executiveDashboard: ExecutiveDashboardQueryService;
      adminAccess: AdminAccessService;
      requestContext: Readonly<{ correlationId: string; requestId: string }>;
    }>,
  ): Promise<AdminGlobalSearchResponse> {
    const session = this.authenticate(accessToken);
    const normalizedQuery = validateGlobalSearchQuery(query.query);
    const limitPerDomain = query.limitPerDomain ?? 5;
    if (![3, 5, 10].includes(limitPerDomain)) {
      throw new Error("VALIDATION_FAILED");
    }
    const navigation = this.navigationFor(session);
    const visibleDomains = navigation.items
      .filter((item) =>
        item.availability === "available" &&
        navigation.routePermissions.includes(`${item.id}:read`),
      );
    const groups: AdminGlobalSearchGroup[] = [];

    for (const navigationItem of visibleDomains) {
      const result = await this.searchDomain(
        accessToken,
        normalizedQuery,
        limitPerDomain,
        navigationItem,
        dependencies,
      );
      if (result.items.length > 0) groups.push(result);
    }

    const totalResults = groups.reduce(
      (total, group) => total + group.items.length,
      0,
    );
    dependencies.adminAccess.recordGlobalSearchEvent(
      actorFor(session, dependencies.requestContext),
      {
        queryDigest: digest(normalizedQuery),
        searchedDomains: visibleDomains.map((item) => item.id),
        resultCount: totalResults,
      },
    );
    return {
      groups,
      totalResults,
      asOf: this.now().toISOString(),
      synthetic: true,
    };
  }

  private async searchDomain(
    accessToken: string,
    query: string,
    limit: number,
    navigationItem: AdminNavigationItem,
    dependencies: Readonly<{
      operatorManagement: AdminOperatorManagementService;
      adminReviews: AdminReviewTaskService;
      tripCaseManagement: AdminTripCaseManagementService;
      financeOperations: AdminFinanceOperationsService;
      executiveDashboard: ExecutiveDashboardQueryService;
      adminAccess: AdminAccessService;
      requestContext: Readonly<{ correlationId: string; requestId: string }>;
    }>,
  ): Promise<AdminGlobalSearchGroup> {
    let items: AdminGlobalSearchResultItem[] = [];
    let hasMore = false;

    switch (navigationItem.id) {
      case "workbench": {
        const page = this.listOperationsTasks(accessToken, {
          search: query,
          pageSize: 25,
        });
        items = page.items.map((item) => ({
          resultId: item.taskId,
          domain: navigationItem.id,
          kind: "task",
          title: item.title,
          description: `${item.operatorName} · ${operationsTaskStatusLabel(item.status)}`,
          route: `/admin/workbench/tasks/${encodeURIComponent(item.taskId)}`,
        }));
        hasMore = page.pageInfo.hasNextPage || items.length > limit;
        break;
      }
      case "organization_accounts": {
        const page = this.listMemberships(accessToken, {
          search: query,
          pageSize: 25,
        });
        items = page.items.map((item) => ({
          resultId: item.membershipId,
          domain: navigationItem.id,
          kind: "membership",
          title: item.displayName,
          description: `${item.organizationName} · ${item.positionName}`,
          route: `/admin/organization-accounts/${encodeURIComponent(item.membershipId)}`,
        }));
        hasMore = page.pageInfo.hasNextPage || items.length > limit;
        break;
      }
      case "operator_management": {
        const page = this.listOperators(
          accessToken,
          { search: query, pageSize: 25 },
          dependencies.operatorManagement,
          dependencies.requestContext,
        );
        items = page.items.map((item) => ({
          resultId: item.operatorId,
          domain: navigationItem.id,
          kind: "operator",
          title: item.operatorName,
          description: item.cityNames.join("、") || "运营主体",
          route: `/admin/operators/${encodeURIComponent(item.operatorId)}`,
        }));
        hasMore = page.pageInfo.hasNextPage || items.length > limit;
        break;
      }
      case "driver_vehicle": {
        const [drivers, vehicles] = await Promise.all([
          this.listDrivers(
            accessToken,
            { search: query, pageSize: 25 },
            dependencies.adminReviews,
          ),
          this.listVehicles(
            accessToken,
            { search: query, pageSize: 25 },
            dependencies.adminReviews,
          ),
        ]);
        items = [
          ...drivers.items.map((item) => ({
            resultId: item.driverAccountId,
            domain: navigationItem.id,
            kind: "driver" as const,
            title: item.displayNameMasked,
            description: `${item.operatorName} · 车主档案`,
            route: `/admin/fleet/drivers/${encodeURIComponent(item.driverAccountId)}`,
          })),
          ...vehicles.items.map((item) => ({
            resultId: item.vehicleId,
            domain: navigationItem.id,
            kind: "vehicle" as const,
            title: item.plateMasked,
            description: `${item.driverNameMasked} · ${item.vehicleSummary}`,
            route: `/admin/fleet/vehicles/${encodeURIComponent(item.vehicleId)}`,
          })),
        ];
        hasMore = drivers.pageInfo.hasNextPage ||
          vehicles.pageInfo.hasNextPage ||
          items.length > limit;
        break;
      }
      case "trip_operations": {
        const page = this.listTrips(
          accessToken,
          { search: query, pageSize: 25 },
          dependencies.tripCaseManagement,
          dependencies.requestContext,
        );
        items = page.items.map((item) => ({
          resultId: item.tripId,
          domain: navigationItem.id,
          kind: "trip",
          title: item.routeSummary,
          description: `${item.operatorName} · ${item.tripId}`,
          route: `/admin/trips/${encodeURIComponent(item.tripId)}`,
        }));
        hasMore = page.pageInfo.hasNextPage || items.length > limit;
        break;
      }
      case "support_safety": {
        const page = this.listCases(
          accessToken,
          { search: query, pageSize: 25 },
          dependencies.tripCaseManagement,
          dependencies.requestContext,
        );
        items = page.items.map((item) => ({
          resultId: item.caseId,
          domain: navigationItem.id,
          kind: "case",
          title: item.summary,
          description: `${item.operatorName} · ${item.kind === "support" ? "客服案件" : "安全事件"}`,
          route: `/admin/cases/${item.kind}/${encodeURIComponent(item.caseId)}`,
        }));
        hasMore = page.pageInfo.hasNextPage || items.length > limit;
        break;
      }
      case "finance_operations": {
        const page = this.listFinanceResources(
          accessToken,
          { search: query, pageSize: 25 },
          dependencies.financeOperations,
          dependencies.requestContext,
        );
        items = page.items.map((item) => ({
          resultId: item.resourceId,
          domain: navigationItem.id,
          kind: "finance",
          title: item.summary,
          description: item.operatorName ?? "平台财务事项",
          route: `/admin/finance/${item.kind}/${encodeURIComponent(item.resourceId)}`,
        }));
        hasMore = page.pageInfo.hasNextPage || items.length > limit;
        break;
      }
      case "data_reports": {
        const page = this.listDataReports(
          accessToken,
          { search: query, pageSize: 25 },
          dependencies.adminAccess,
          dependencies.requestContext,
        );
        items = page.items.map((item) => ({
          resultId: item.reportId,
          domain: navigationItem.id,
          kind: "report",
          title: item.title,
          description: item.summary,
          route: `/admin/reports/${encodeURIComponent(item.reportId)}`,
        }));
        hasMore = page.pageInfo.hasNextPage || items.length > limit;
        break;
      }
      case "executive_dashboard": {
        const page = this.listExecutiveResources(
          accessToken,
          { search: query, pageSize: 25 },
          dependencies.executiveDashboard,
          dependencies.requestContext,
        );
        items = page.items.map((item) => ({
          resultId: item.resourceId,
          domain: navigationItem.id,
          kind: "executive",
          title: item.title,
          description: executiveSearchDescription(item),
          route: `/admin/executive/${item.kind}/${encodeURIComponent(item.resourceId)}`,
        }));
        hasMore = page.pageInfo.hasNextPage || items.length > limit;
        break;
      }
      case "audit_system": {
        const page = this.listAuditResources(
          accessToken,
          { search: query, pageSize: 25 },
          dependencies.adminAccess,
          dependencies.requestContext,
        );
        items = page.items.map((item) => ({
          resultId: item.resourceId,
          domain: navigationItem.id,
          kind: "audit",
          title: item.title,
          description: `${item.organizationName} · ${item.summary}`,
          route: `/admin/governance/${item.kind}/${encodeURIComponent(item.resourceId)}`,
        }));
        hasMore = page.pageInfo.hasNextPage || items.length > limit;
        break;
      }
    }

    return {
      domain: navigationItem.id,
      label: navigationItem.label,
      items: items.slice(0, limit),
      hasMore,
    };
  }

  public listOperationsTasks(
    accessToken: string,
    query: AdminOperationsTaskQuery,
  ): AdminOperationsTaskPage {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "workbench");
    const pageSize = query.pageSize ?? 25;
    if (![25, 50, 100].includes(pageSize) || (query.after && query.before)) {
      throw new Error("ADMIN_PAGINATION_INVALID");
    }
    const scopeDigest = digest(
      `${session.workIdentity.type}:${session.workIdentity.organizationId}`,
    );
    const queryDigest = digest(
      JSON.stringify({
        search: query.search?.trim().toLowerCase() ?? "",
        status: query.status ?? "",
        sort: query.sort ?? "due_at_asc",
        pageSize,
      }),
    );
    let rows = this.tasks.filter(
      (task) =>
        session.workIdentity.type === "platform" ||
        task.operatorName === session.workIdentity.organizationName,
    );
    if (query.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      rows = rows.filter((task) =>
        `${task.title} ${task.operatorName} ${task.assigneeName}`
          .toLowerCase()
          .includes(search),
      );
    }
    if (query.status) rows = rows.filter((task) => task.status === query.status);
    rows = [...rows].sort(
      query.sort === "updated_at_desc"
        ? (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            right.taskId.localeCompare(left.taskId)
        : (left, right) =>
            left.dueAt.localeCompare(right.dueAt) ||
            left.taskId.localeCompare(right.taskId),
    );

    let start = 0;
    if (query.after) {
      const cursor = this.readCursor(query.after, queryDigest, scopeDigest);
      start = cursor.offset + 1;
    }
    if (query.before) {
      const cursor = this.readCursor(query.before, queryDigest, scopeDigest);
      start = Math.max(0, cursor.offset - pageSize);
    }
    const items = rows.slice(start, start + pageSize);
    const end = start + items.length - 1;
    return {
      items,
      pageInfo: {
        hasNextPage: end + 1 < rows.length,
        hasPreviousPage: start > 0,
        startCursor:
          items.length > 0
            ? this.signCursor(start, queryDigest, scopeDigest)
            : null,
        endCursor:
          items.length > 0
            ? this.signCursor(end, queryDigest, scopeDigest)
            : null,
        approximateTotal: rows.length,
      },
      queryDigest,
      scopeDigest,
      asOf: this.now().toISOString(),
      synthetic: true,
    };
  }

  public getOperationsTask(
    accessToken: string,
    taskId: string,
  ): AdminOperationsTaskDetail {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "workbench");
    return this.operationsTaskDetail(session, this.requireVisibleTask(session, taskId));
  }

  public performOperationsTaskAction(
    accessToken: string,
    taskId: string,
    command: AdminOperationsTaskActionCommand,
  ): AdminOperationsTaskActionResult {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "workbench");
    if (!command.idempotencyKey.trim() || (command.note?.length ?? 0) > 300) {
      throw new Error("VALIDATION_FAILED");
    }
    const task = this.requireVisibleTask(session, taskId);
    const operationKey =
      `${session.workIdentity.workIdentityId}:${taskId}:${command.idempotencyKey}`;
    const fingerprint = digest(JSON.stringify({
      action: command.action,
      expectedVersion: command.expectedVersion,
      note: command.note?.trim() ?? "",
    }));
    const existing = this.taskOperations.get(operationKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error("CONFLICT_IDEMPOTENCY_KEY_REUSED");
      }
      return { ...existing.result, idempotentReplay: true };
    }
    if (!operationPermissions(session.workIdentity).includes(command.action)) {
      throw new Error("AUTHORIZATION_DENIED");
    }
    if (!allowedActionsFor(task, session.workIdentity).includes(command.action)) {
      throw new Error("ADMIN_OPERATIONS_TASK_ACTION_INVALID");
    }
    if (task.version !== command.expectedVersion) {
      throw new Error("ADMIN_RESOURCE_VERSION_CONFLICT");
    }

    const nextStatus = nextStatusFor(command.action);
    const occurredAt = this.now().toISOString();
    const nextTask: AdminOperationsTask = {
      ...task,
      status: nextStatus,
      version: task.version + 1,
      updatedAt: occurredAt,
      ...(command.action === "assign"
        ? { assigneeName: session.workIdentity.positionName }
        : {}),
      ...(nextStatus === "completed" ? { completedAt: occurredAt } : {}),
    };
    const taskIndex = this.tasks.findIndex((candidate) => candidate.taskId === taskId);
    this.tasks[taskIndex] = nextTask;
    this.taskAuditTrails.get(taskId)!.push({
      eventId: `audit-${taskId}-${nextTask.version}-${command.action}`,
      action: auditActionFor(command.action),
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.positionName,
      occurredAt,
      previousStatus: task.status,
      nextStatus,
      ...(command.note?.trim() ? { note: command.note.trim() } : {}),
    });
    const result: AdminOperationsTaskActionResult = {
      operationId: token("task-operation"),
      resultState: "confirmed",
      idempotentReplay: false,
      detail: this.operationsTaskDetail(session, nextTask),
      synthetic: true,
    };
    this.taskOperations.set(operationKey, { fingerprint, result });
    return result;
  }

  public listOperators(
    accessToken: string,
    query: AdminOperatorDirectoryQuery,
    operatorManagement: AdminOperatorManagementService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminOperatorDirectoryPage {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "operator_management");
    const allItems = operatorManagement.listOperatorDirectory(
      actorFor(session, requestContext),
    );
    const normalizedSearch = query.search?.trim().toLocaleLowerCase("zh-CN");
    const filtered = allItems.filter((operator) => {
      if (
        normalizedSearch &&
        !`${operator.operatorName} ${operator.syntheticReference}`
          .toLocaleLowerCase("zh-CN")
          .includes(normalizedSearch)
      ) {
        return false;
      }
      return !query.lifecycleState ||
        operator.lifecycleState === query.lifecycleState;
    });
    const sorted = [...filtered].sort((left, right) =>
      query.sort === "updated_at_desc"
        ? right.updatedAt.localeCompare(left.updatedAt) ||
          left.operatorId.localeCompare(right.operatorId)
        : left.operatorName.localeCompare(right.operatorName, "zh-CN") ||
          left.operatorId.localeCompare(right.operatorId),
    );
    const pageSize = query.pageSize ?? 25;
    const queryDigest = digest(JSON.stringify({
      search: normalizedSearch ?? "",
      lifecycleState: query.lifecycleState ?? "",
      sort: query.sort ?? "operator_name_asc",
      pageSize,
    }));
    const scopeDigest = this.navigationFor(session).scopeDigest;
    const afterCursor = query.after
      ? this.readCursor(query.after, queryDigest, scopeDigest)
      : undefined;
    const beforeCursor = query.before
      ? this.readCursor(query.before, queryDigest, scopeDigest)
      : undefined;
    if (afterCursor && beforeCursor) {
      throw new Error("VALIDATION_FAILED");
    }
    const start = beforeCursor
      ? Math.max(0, beforeCursor.offset - pageSize)
      : afterCursor
        ? afterCursor.offset + 1
        : 0;
    const items = sorted.slice(start, start + pageSize);
    const end = start + items.length - 1;
    return {
      summary: {
        totalOperators: allItems.length,
        activeOperators: allItems.filter((operator) =>
          operator.lifecycleState === "active"
        ).length,
        attentionOperators: allItems.filter((operator) =>
          ["restricted", "suspended", "onboarding_review"].includes(
            operator.lifecycleState,
          )
        ).length,
        activeDrivers: allItems.reduce(
          (total, operator) => total + operator.activeDrivers,
          0,
        ),
        activeVehicles: allItems.reduce(
          (total, operator) => total + operator.activeVehicles,
          0,
        ),
      },
      items,
      pageInfo: {
        hasNextPage: end + 1 < sorted.length,
        hasPreviousPage: start > 0,
        startCursor:
          items.length > 0
            ? this.signCursor(start, queryDigest, scopeDigest)
            : null,
        endCursor:
          items.length > 0
            ? this.signCursor(end, queryDigest, scopeDigest)
            : null,
        approximateTotal: sorted.length,
      },
      queryDigest,
      scopeDigest,
      asOf: this.now().toISOString(),
      synthetic: true,
    };
  }

  public getOperator(
    accessToken: string,
    operatorId: string,
    operatorManagement: AdminOperatorManagementService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminOperatorDetail {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "operator_management");
    const actor = actorFor(session, requestContext);
    const profile = operatorManagement.getOperator360(actor, operatorId);
    const operator = operatorManagement.getOperatorDirectoryItem(actor, operatorId);
    const auditTrail = this.operatorAuditTrails.get(operatorId) ?? [];
    const occurredAt = this.now().toISOString();
    const lastEvent = auditTrail.at(-1);
    if (
      !lastEvent ||
      lastEvent.action !== "operator_profile_viewed" ||
      lastEvent.actorLabel !== session.workIdentity.organizationName ||
      lastEvent.actorRole !== session.workIdentity.positionName ||
      new Date(occurredAt).getTime() -
        new Date(lastEvent.occurredAt).getTime() > 1_000
    ) {
      auditTrail.push({
        eventId: token("operator-audit-view"),
        action: "operator_profile_viewed",
        actorLabel: session.workIdentity.organizationName,
        actorRole: session.workIdentity.positionName,
        occurredAt,
      });
    }
    this.operatorAuditTrails.set(operatorId, auditTrail);
    return operatorDetailFor(session, operator, profile, auditTrail);
  }

  public performOperatorAction(
    accessToken: string,
    operatorId: string,
    command: AdminOperatorActionCommand,
    operatorManagement: AdminOperatorManagementService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminOperatorActionResult {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "operator_management");
    if (
      !command.idempotencyKey.trim() ||
      !command.note.trim() ||
      command.note.length > 300
    ) {
      throw new Error("VALIDATION_FAILED");
    }
    const actor = actorFor(session, requestContext);
    const current = operatorManagement.getOperatorDirectoryItem(actor, operatorId);
    const operationKey =
      `${session.workIdentity.workIdentityId}:${operatorId}:${command.idempotencyKey}`;
    const fingerprint = digest(JSON.stringify({
      action: command.action,
      expectedVersion: command.expectedVersion,
      note: command.note.trim(),
    }));
    const existing = this.operatorOperations.get(operationKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error("CONFLICT_IDEMPOTENCY_KEY_REUSED");
      }
      return { ...existing.result, idempotentReplay: true };
    }
    if (!allowedOperatorActionsFor(current, session.workIdentity).includes(command.action)) {
      throw new Error("ADMIN_OPERATOR_ACTION_INVALID");
    }
    if (current.resourceVersion !== command.expectedVersion) {
      throw new Error("ADMIN_RESOURCE_VERSION_CONFLICT");
    }
    const nextState = nextOperatorStateFor(command.action);
    operatorManagement.executeCommand(actor, command.idempotencyKey, {
      type: "change_operator_lifecycle",
      operatorId,
      targetState: nextState,
      reason: command.note.trim(),
      resourceVersion: command.expectedVersion,
    });
    const updated = operatorManagement.getOperatorDirectoryItem(actor, operatorId);
    const auditTrail = this.operatorAuditTrails.get(operatorId) ?? [];
    auditTrail.push({
      eventId: token("operator-audit-action"),
      action: command.action === "restrict"
        ? "operator_restricted"
        : "operator_reactivated",
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.positionName,
      occurredAt: this.now().toISOString(),
      previousState: current.lifecycleState,
      nextState: updated.lifecycleState,
      note: command.note.trim(),
    });
    this.operatorAuditTrails.set(operatorId, auditTrail);
    const profile = operatorManagement.getOperator360(actor, operatorId);
    const result: AdminOperatorActionResult = {
      operationId: token("operator-operation"),
      resultState: "confirmed",
      idempotentReplay: false,
      detail: operatorDetailFor(session, updated, profile, auditTrail),
      synthetic: true,
    };
    this.operatorOperations.set(operationKey, { fingerprint, result });
    return result;
  }

  public async listDrivers(
    accessToken: string,
    query: AdminDriverDirectoryQuery,
    adminReviews: AdminReviewTaskService,
  ): Promise<AdminDriverDirectoryPage> {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "driver_vehicle");
    const pageSize = validatePageSize(query.pageSize, query.after, query.before);
    const scopeDigest = fleetScopeDigest(session);
    const queryDigest = digest(JSON.stringify({
      search: query.search?.trim().toLowerCase() ?? "",
      eligibilityState: query.eligibilityState ?? "",
      sort: query.sort ?? "driver_name_asc",
      pageSize,
    }));
    const tasks = await adminReviews.listTasks();
    const taskById = new Map(tasks.map((task) => [task.taskId, task]));
    let rows = this.visibleFleetRecords(session).map((record) =>
      driverDirectoryItemFor(record, taskById.get(record.reviewTaskId ?? "")),
    );
    const summaryRows = [...rows];
    if (query.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      rows = rows.filter((driver) =>
        `${driver.displayNameMasked} ${driver.phoneMasked} ${driver.operatorName} ${driver.driverAccountId}`
          .toLowerCase()
          .includes(search),
      );
    }
    if (query.eligibilityState) {
      rows = rows.filter((driver) =>
        driver.eligibilityState === query.eligibilityState,
      );
    }
    rows = [...rows].sort(
      query.sort === "updated_at_desc"
        ? (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            right.driverAccountId.localeCompare(left.driverAccountId)
        : (left, right) =>
            left.displayNameMasked.localeCompare(right.displayNameMasked, "zh-CN") ||
            left.driverAccountId.localeCompare(right.driverAccountId),
    );
    const page = this.paginateFleetRows(
      rows,
      pageSize,
      query.after,
      query.before,
      queryDigest,
      scopeDigest,
    );
    return {
      summary: {
        totalDrivers: summaryRows.length,
        serviceableDrivers: summaryRows.filter((item) =>
          item.eligibilityState === "serviceable"
        ).length,
        restrictedDrivers: summaryRows.filter((item) =>
          item.eligibilityState === "restricted"
        ).length,
        reviewAttentionDrivers: summaryRows.filter((item) =>
          item.reviewAttentionCount > 0
        ).length,
      },
      items: page.items,
      pageInfo: page.pageInfo,
      queryDigest,
      scopeDigest,
      asOf: this.now().toISOString(),
      synthetic: true,
    };
  }

  public async getDriver(
    accessToken: string,
    driverAccountId: string,
    operatorManagement: AdminOperatorManagementService,
    adminReviews: AdminReviewTaskService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): Promise<AdminDriverDetail> {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "driver_vehicle");
    const record = this.requireVisibleFleetRecord(
      session,
      "driver",
      driverAccountId,
    );
    const profile = operatorManagement.getDriver360(
      actorFor(session, requestContext),
      driverAccountId,
    );
    const tasks = await adminReviews.listTasks();
    const taskById = new Map(tasks.map((task) => [task.taskId, task]));
    const driver = driverDirectoryItemFor(
      record,
      taskById.get(record.reviewTaskId ?? ""),
    );
    const auditTrail = this.driverAuditTrails.get(driverAccountId) ?? [];
    const last = auditTrail.at(-1);
    const occurredAt = this.now().toISOString();
    if (
      !last ||
      last.actorLabel !== session.workIdentity.organizationName ||
      this.now().getTime() - Date.parse(last.occurredAt) >= 1_000
    ) {
      auditTrail.push({
        eventId: token("driver-audit-view"),
        action: "driver_profile_viewed",
        actorLabel: session.workIdentity.organizationName,
        actorRole: session.workIdentity.positionName,
        occurredAt,
      });
      this.driverAuditTrails.set(driverAccountId, auditTrail);
    }
    return {
      driver,
      profile,
      organizationScope: organizationScopeFor(session),
      linkedVehicles: [
        vehicleDirectoryItemFor(
          record,
          this.vehicleReviewStates.get(record.vehicleId)!,
          taskById.get(record.reviewTaskId ?? ""),
        ),
      ],
      ...driverActionSummaryFor(driver, session.workIdentity),
      auditTrail: [...auditTrail],
      synthetic: true,
    };
  }

  public async listVehicles(
    accessToken: string,
    query: AdminVehicleDirectoryQuery,
    adminReviews: AdminReviewTaskService,
  ): Promise<AdminVehicleDirectoryPage> {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "driver_vehicle");
    const pageSize = validatePageSize(query.pageSize, query.after, query.before);
    const scopeDigest = fleetScopeDigest(session);
    const queryDigest = digest(JSON.stringify({
      search: query.search?.trim().toLowerCase() ?? "",
      reviewState: query.reviewState ?? "",
      sort: query.sort ?? "plate_asc",
      pageSize,
    }));
    const tasks = await adminReviews.listTasks();
    const taskById = new Map(tasks.map((task) => [task.taskId, task]));
    let rows = this.visibleFleetRecords(session).map((record) =>
      vehicleDirectoryItemFor(
        record,
        this.vehicleReviewStates.get(record.vehicleId)!,
        taskById.get(record.reviewTaskId ?? ""),
      ),
    );
    const summaryRows = [...rows];
    if (query.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      rows = rows.filter((vehicle) =>
        `${vehicle.plateMasked} ${vehicle.vehicleSummary} ${vehicle.driverNameMasked} ${vehicle.operatorName} ${vehicle.vehicleId}`
          .toLowerCase()
          .includes(search),
      );
    }
    if (query.reviewState) {
      rows = rows.filter((vehicle) => vehicle.reviewState === query.reviewState);
    }
    rows = [...rows].sort(
      query.sort === "updated_at_desc"
        ? (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            right.vehicleId.localeCompare(left.vehicleId)
        : (left, right) =>
            left.plateMasked.localeCompare(right.plateMasked, "zh-CN") ||
            left.vehicleId.localeCompare(right.vehicleId),
    );
    const page = this.paginateFleetRows(
      rows,
      pageSize,
      query.after,
      query.before,
      queryDigest,
      scopeDigest,
    );
    return {
      summary: {
        totalVehicles: summaryRows.length,
        approvedVehicles: countFleetState(summaryRows, "approved"),
        underReviewVehicles: countFleetState(summaryRows, "under_review"),
        changesRequestedVehicles: countFleetState(summaryRows, "changes_requested"),
        rejectedVehicles: countFleetState(summaryRows, "rejected"),
        openReviewTasks: summaryRows.filter((item) =>
          item.reviewTaskStatus !== undefined &&
          item.reviewTaskStatus !== "completed"
        ).length,
      },
      items: page.items,
      pageInfo: page.pageInfo,
      queryDigest,
      scopeDigest,
      asOf: this.now().toISOString(),
      synthetic: true,
    };
  }

  public async getVehicle(
    accessToken: string,
    vehicleId: string,
    operatorManagement: AdminOperatorManagementService,
    adminReviews: AdminReviewTaskService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): Promise<AdminVehicleDetail> {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "driver_vehicle");
    const record = this.requireVisibleFleetRecord(session, "vehicle", vehicleId);
    return this.vehicleDetailFor(
      session,
      record,
      operatorManagement,
      adminReviews,
      requestContext,
      true,
    );
  }

  public async performVehicleReviewAction(
    accessToken: string,
    vehicleId: string,
    command: AdminVehicleReviewActionCommand,
    operatorManagement: AdminOperatorManagementService,
    adminReviews: AdminReviewTaskService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): Promise<AdminVehicleReviewActionResult> {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "driver_vehicle");
    if (!command.idempotencyKey.trim()) throw new Error("VALIDATION_FAILED");
    const record = this.requireVisibleFleetRecord(session, "vehicle", vehicleId);
    if (!record.reviewTaskId) throw new Error("ADMIN_REVIEW_TASK_NOT_FOUND");
    const operationKey =
      `${session.workIdentity.workIdentityId}:${vehicleId}:${command.idempotencyKey}`;
    const fingerprint = digest(JSON.stringify({
      action: command.action,
      expectedTaskVersion: command.expectedTaskVersion,
      expectedVehicleReviewVersion: command.expectedVehicleReviewVersion,
      reasonCode: command.reasonCode ?? "",
    }));
    const existing = this.vehicleOperations.get(operationKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error("CONFLICT_IDEMPOTENCY_KEY_REUSED");
      }
      return {
        ...existing.result,
        idempotentReplay: true,
      };
    }
    const task = await adminReviews.getTaskSnapshot(record.reviewTaskId);
    const allowedActions = allowedVehicleActionsFor(
      task,
      session.workIdentity,
      session.workIdentity.workIdentityId,
    );
    if (!allowedActions.includes(command.action)) {
      throw new Error("AUTHORIZATION_DENIED");
    }
    const reviewerId = session.workIdentity.workIdentityId;
    if (command.action === "claim") {
      await adminReviews.claimTask({
        reviewerId,
        taskId: record.reviewTaskId,
        expectedTaskVersion: command.expectedTaskVersion,
        idempotencyKey: command.idempotencyKey,
      });
    } else if (command.action === "request_material") {
      if (!isMaterialReason(command.reasonCode)) {
        throw new Error("VALIDATION_FAILED");
      }
      await adminReviews.previewMaterial(
        record.reviewTaskId,
        reviewerId,
        command.reasonCode,
        `${command.idempotencyKey}-preview`,
      );
      const updated = await adminReviews.requestMaterial({
        reviewerId,
        taskId: record.reviewTaskId,
        reason: command.reasonCode,
        previewConfirmed: true,
        expectedTaskVersion: command.expectedTaskVersion,
        expectedVehicleReviewVersion: command.expectedVehicleReviewVersion,
        idempotencyKey: command.idempotencyKey,
      });
      this.vehicleReviewStates.set(vehicleId, {
        state: "changes_requested",
        version: updated.vehicleReviewVersion,
        updatedAt: this.now().toISOString(),
      });
    } else if (command.action === "approve") {
      const updated = await adminReviews.approveVehicle({
        reviewerId,
        taskId: record.reviewTaskId,
        reasonCode: "approved_standard",
        previewConfirmed: true,
        expectedTaskVersion: command.expectedTaskVersion,
        expectedVehicleReviewVersion: command.expectedVehicleReviewVersion,
        idempotencyKey: command.idempotencyKey,
      });
      this.vehicleReviewStates.set(vehicleId, {
        state: "approved",
        version: updated.vehicleReviewVersion,
        updatedAt: this.now().toISOString(),
      });
    } else {
      if (!isRejectionReason(command.reasonCode)) {
        throw new Error("VALIDATION_FAILED");
      }
      const updated = await adminReviews.rejectVehicle({
        reviewerId,
        taskId: record.reviewTaskId,
        reasonCode: command.reasonCode,
        previewConfirmed: true,
        expectedTaskVersion: command.expectedTaskVersion,
        expectedVehicleReviewVersion: command.expectedVehicleReviewVersion,
        idempotencyKey: command.idempotencyKey,
      });
      this.vehicleReviewStates.set(vehicleId, {
        state: "rejected",
        version: updated.vehicleReviewVersion,
        updatedAt: this.now().toISOString(),
      });
    }
    const result: AdminVehicleReviewActionResult = {
      operationId: token("vehicle-review-operation"),
      resultState: "confirmed",
      idempotentReplay: false,
      detail: await this.vehicleDetailFor(
        session,
        record,
        operatorManagement,
        adminReviews,
        requestContext,
        false,
      ),
      synthetic: true,
    };
    this.vehicleOperations.set(operationKey, { fingerprint, result });
    return result;
  }

  public listTrips(
    accessToken: string,
    query: AdminTripDirectoryQuery,
    tripCaseManagement: AdminTripCaseManagementService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminTripDirectoryPage {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "trip_operations");
    this.assertTripOperationsEnabled();
    const pageSize = validatePageSize(query.pageSize, query.after, query.before);
    const scopeDigest = tripScopeDigest(session);
    const queryDigest = digest(JSON.stringify({
      search: query.search?.trim().toLowerCase() ?? "",
      authoritativeState: query.authoritativeState ?? "",
      operationState: query.operationState ?? "",
      sort: query.sort ?? "updated_at_desc",
      pageSize,
    }));
    const source = tripCaseManagement.listTripDirectory(
      actorFor(session, requestContext),
    );
    const taskByTripId = new Map(
      source.tasks.map((task) => [task.tripId, task]),
    );
    let rows = source.trips.map((trip) =>
      tripDirectoryItemFor(trip, taskByTripId.get(trip.tripId)),
    );
    const summaryRows = [...rows];
    if (query.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      rows = rows.filter((trip) =>
        `${trip.tripId} ${trip.operatorName} ${trip.routeSummary} ${trip.passengerMasked} ${trip.driverMasked} ${trip.vehicleMasked}`
          .toLowerCase()
          .includes(search),
      );
    }
    if (query.authoritativeState) {
      rows = rows.filter(
        (trip) => trip.authoritativeState === query.authoritativeState,
      );
    }
    if (query.operationState) {
      rows = rows.filter(
        (trip) => trip.operationState === query.operationState,
      );
    }
    rows = [...rows].sort(
      query.sort === "trip_id_asc"
        ? (left, right) => left.tripId.localeCompare(right.tripId)
        : (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            right.tripId.localeCompare(left.tripId),
    );
    const page = this.paginateFleetRows(
      rows,
      pageSize,
      query.after,
      query.before,
      queryDigest,
      scopeDigest,
    );
    return {
      summary: {
        totalTrips: summaryRows.length,
        activeTrips: summaryRows.filter((trip) =>
          !["completed", "unfulfilled", "cancelled"].includes(
            trip.authoritativeState,
          ),
        ).length,
        attentionTrips: summaryRows.filter((trip) =>
          trip.authoritativeState === "safety_frozen" ||
          trip.priority === "high" ||
          trip.priority === "urgent",
        ).length,
        safetyFrozenTrips: summaryRows.filter(
          (trip) => trip.authoritativeState === "safety_frozen",
        ).length,
        awaitingAuthoritativeResultTrips: summaryRows.filter(
          (trip) => trip.operationState === "awaiting_authoritative_result",
        ).length,
      },
      items: page.items,
      pageInfo: page.pageInfo,
      queryDigest,
      scopeDigest,
      asOf: this.now().toISOString(),
      synthetic: true,
    };
  }

  public getTrip(
    accessToken: string,
    tripId: string,
    tripCaseManagement: AdminTripCaseManagementService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminTripDetail {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "trip_operations");
    this.assertTripOperationsEnabled();
    const detail = this.tripDetailFor(
      session,
      tripId,
      tripCaseManagement,
      requestContext,
    );
    const auditTrail = this.tripAuditTrails.get(tripId) ?? [];
    auditTrail.push({
      eventId: token("trip-audit-view"),
      action: "trip_profile_viewed",
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.positionName,
      occurredAt: this.now().toISOString(),
    });
    this.tripAuditTrails.set(tripId, auditTrail);
    return {
      ...detail,
      auditTrail: [...auditTrail],
    };
  }

  public performTripOperationAction(
    accessToken: string,
    tripId: string,
    command: AdminTripOperationActionCommand,
    tripCaseManagement: AdminTripCaseManagementService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminTripOperationActionResult {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "trip_operations");
    this.assertTripOperationsEnabled();
    if (
      !command.idempotencyKey.trim() ||
      !Number.isInteger(command.expectedTaskVersion) ||
      command.expectedTaskVersion < 1 ||
      !Number.isInteger(command.expectedTripVersion) ||
      command.expectedTripVersion < 1 ||
      (command.action === "request_domain_action" &&
        (!command.reasonCode?.trim() || command.reasonCode.length > 100))
    ) {
      throw new Error("VALIDATION_FAILED");
    }
    const operationKey =
      `${session.workIdentity.workIdentityId}:${tripId}:${command.idempotencyKey}`;
    const fingerprint = digest(JSON.stringify({
      action: command.action,
      expectedTaskVersion: command.expectedTaskVersion,
      expectedTripVersion: command.expectedTripVersion,
      reasonCode: command.reasonCode?.trim() ?? "",
    }));
    const existing = this.tripOperations.get(operationKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error("CONFLICT_IDEMPOTENCY_KEY_REUSED");
      }
      return { ...existing.result, idempotentReplay: true };
    }
    const actor = actorFor(session, requestContext);
    const profile = tripCaseManagement.getTrip360(actor, tripId);
    const task = tripCaseManagement.getTripOperationTask(actor, tripId);
    if (!task) throw new Error("ADMIN_TRIP_TASK_NOT_FOUND");
    if (
      profile.authoritativeVersion !== command.expectedTripVersion ||
      task.resourceVersion !== command.expectedTaskVersion
    ) {
      throw new Error("ADMIN_RESOURCE_VERSION_CONFLICT");
    }
    if (
      !allowedTripActionsFor(task.state, session.workIdentity)
        .includes(command.action)
    ) {
      throw new Error("ADMIN_TRIP_OPERATION_ACTION_INVALID");
    }
    const previousState = task.state;
    tripCaseManagement.executeCommand(
      actor,
      command.idempotencyKey,
      command.action === "triage"
        ? {
            type: "triage_trip_operation",
            taskId: task.taskId,
            resourceVersion: command.expectedTaskVersion,
          }
        : {
            type: "request_trip_domain_action",
            taskId: task.taskId,
            expectedTripVersion: command.expectedTripVersion,
            reasonCode: command.reasonCode!.trim(),
            resourceVersion: command.expectedTaskVersion,
          },
    );
    const updatedTask = tripCaseManagement.getTripOperationTask(actor, tripId)!;
    const auditTrail = this.tripAuditTrails.get(tripId) ?? [];
    auditTrail.push({
      eventId: token("trip-audit-action"),
      action: command.action === "triage"
        ? "trip_operation_triaged"
        : "trip_domain_action_requested",
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.positionName,
      occurredAt: this.now().toISOString(),
      previousState,
      nextState: updatedTask.state,
      ...(command.reasonCode?.trim()
        ? { reasonCode: command.reasonCode.trim() }
        : {}),
    });
    this.tripAuditTrails.set(tripId, auditTrail);
    const result: AdminTripOperationActionResult = {
      operationId: token("trip-operation"),
      resultState: "confirmed",
      idempotentReplay: false,
      detail: this.tripDetailFor(
        session,
        tripId,
        tripCaseManagement,
        requestContext,
      ),
      synthetic: true,
    };
    this.tripOperations.set(operationKey, { fingerprint, result });
    return result;
  }

  private tripDetailFor(
    session: SessionRecord,
    tripId: string,
    tripCaseManagement: AdminTripCaseManagementService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminTripDetail {
    const actor = actorFor(session, requestContext);
    const profile = tripCaseManagement.getTrip360(actor, tripId);
    const operationTask = tripCaseManagement.getTripOperationTask(actor, tripId);
    const actionSummary = operationTask
      ? tripActionSummaryFor(operationTask.state, session.workIdentity)
      : tripActionSummaryWithoutTask(session.workIdentity);
    return {
      trip: tripDirectoryItemFor(profile, operationTask),
      profile,
      ...(operationTask ? { operationTask } : {}),
      relatedCases: {
        ...(profile.relatedSupportCaseId
          ? { supportCaseId: profile.relatedSupportCaseId }
          : {}),
        ...(profile.relatedSafetyCaseId
          ? { safetyCaseId: profile.relatedSafetyCaseId }
          : {}),
      },
      organizationScope: organizationScopeFor(session),
      ...actionSummary,
      auditTrail: [...(this.tripAuditTrails.get(tripId) ?? [])],
      directTripMutationAllowed: false,
      synthetic: true,
    };
  }

  public listCases(
    accessToken: string,
    query: AdminCaseDirectoryQuery,
    tripCaseManagement: AdminTripCaseManagementService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminCaseDirectoryPage {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "support_safety");
    this.assertCaseManagementEnabled();
    this.assertTripOperationsEnabled();
    const pageSize = validatePageSize(query.pageSize, query.after, query.before);
    const scopeDigest = caseScopeDigest(session);
    const queryDigest = digest(JSON.stringify({
      search: query.search?.trim().toLowerCase() ?? "",
      kind: query.kind ?? "",
      supportState: query.supportState ?? "",
      safetyState: query.safetyState ?? "",
      sort: query.sort ?? "updated_at_desc",
      pageSize,
    }));
    const actor = actorFor(session, requestContext);
    const source = tripCaseManagement.listCaseDirectory(actor);
    const supportRows = source.supportCases.map((supportCase) => {
      const trip = tripCaseManagement.getTrip360(actor, supportCase.tripId);
      return caseDirectoryItemForSupport(supportCase, trip.operatorName);
    });
    const safetyRows = source.safetyInvestigations.map((investigation) => {
      const trip = tripCaseManagement.getTrip360(actor, investigation.tripId);
      return caseDirectoryItemForSafety(
        investigation,
        trip.operatorId,
        trip.operatorName,
      );
    });
    const summaryRows = [...supportRows, ...safetyRows];
    let rows = [...summaryRows];
    if (query.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      rows = rows.filter((item) =>
        `${item.caseId} ${item.tripId} ${item.operatorName} ${item.summary}`
          .toLowerCase()
          .includes(search),
      );
    }
    if (query.kind) {
      rows = rows.filter((item) => item.kind === query.kind);
    }
    if (query.supportState) {
      rows = rows.filter(
        (item) =>
          item.kind === "support" && item.state === query.supportState,
      );
    }
    if (query.safetyState) {
      rows = rows.filter(
        (item) =>
          item.kind === "safety" && item.state === query.safetyState,
      );
    }
    rows.sort(
      query.sort === "case_id_asc"
        ? (left, right) => left.caseId.localeCompare(right.caseId)
        : (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            right.caseId.localeCompare(left.caseId),
    );
    const page = this.paginateFleetRows(
      rows,
      pageSize,
      query.after,
      query.before,
      queryDigest,
      scopeDigest,
    );
    return {
      summary: {
        totalCases: summaryRows.length,
        supportCases: supportRows.length,
        safetyCases: safetyRows.length,
        activeCases: summaryRows.filter((item) =>
          item.kind === "support"
            ? item.state !== "resolved" && item.state !== "closed"
            : item.state !== "completed",
        ).length,
        severeSafetyCases: safetyRows.filter(
          (item) => item.severity === "sev1" || item.severity === "sev2",
        ).length,
        awaitingIndependentReviewCases: safetyRows.filter(
          (item) => item.state === "awaiting_independent_review",
        ).length,
      },
      items: page.items,
      pageInfo: page.pageInfo,
      queryDigest,
      scopeDigest,
      asOf: this.now().toISOString(),
      synthetic: true,
    };
  }

  public getCase(
    accessToken: string,
    kind: AdminCaseKind,
    caseId: string,
    tripCaseManagement: AdminTripCaseManagementService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminCaseDetail {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "support_safety");
    this.assertCaseManagementEnabled();
    this.assertTripOperationsEnabled();
    const detail = this.caseDetailFor(
      session,
      kind,
      caseId,
      tripCaseManagement,
      requestContext,
    );
    const auditKey = caseAuditKey(kind, caseId);
    const auditTrail = this.caseAuditTrails.get(auditKey) ?? [];
    const viewAuditKey =
      `${session.workIdentity.workIdentityId}:${auditKey}`;
    const lastAuditedAt = this.caseViewAuditedAt.get(viewAuditKey) ?? 0;
    if (this.now().getTime() - lastAuditedAt >= 1_000) {
      auditTrail.push({
        eventId: token("case-audit-view"),
        action: "case_profile_viewed",
        actorLabel: session.workIdentity.organizationName,
        actorRole: session.workIdentity.positionName,
        occurredAt: this.now().toISOString(),
      });
      this.caseViewAuditedAt.set(viewAuditKey, this.now().getTime());
    }
    this.caseAuditTrails.set(auditKey, auditTrail);
    return {
      ...detail,
      auditTrail: [...auditTrail],
    };
  }

  public performCaseAction(
    accessToken: string,
    kind: AdminCaseKind,
    caseId: string,
    command: AdminCaseActionCommand,
    tripCaseManagement: AdminTripCaseManagementService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminCaseActionResult {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "support_safety");
    this.assertCaseManagementEnabled();
    this.assertTripOperationsEnabled();
    if (
      !command.idempotencyKey.trim() ||
      !Number.isInteger(command.expectedVersion) ||
      command.expectedVersion < 1 ||
      (command.note !== undefined &&
        (!command.note.trim() || command.note.length > 500))
    ) {
      throw new Error("VALIDATION_FAILED");
    }
    if (
      (kind === "support" && !isSupportCaseAction(command.action)) ||
      (kind === "safety" && !isSafetyCaseAction(command.action))
    ) {
      throw new Error("ADMIN_CASE_ACTION_INVALID");
    }
    const operationKey =
      `${session.workIdentity.workIdentityId}:${kind}:${caseId}:${command.idempotencyKey}`;
    const fingerprint = digest(JSON.stringify({
      ...command,
      note: command.note?.trim() ?? "",
    }));
    const existing = this.caseOperations.get(operationKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error("CONFLICT_IDEMPOTENCY_KEY_REUSED");
      }
      return { ...existing.result, idempotentReplay: true };
    }
    const actor = actorFor(session, requestContext);
    const detail = this.caseDetailFor(
      session,
      kind,
      caseId,
      tripCaseManagement,
      requestContext,
    );
    if (!detail.allowedActions.includes(command.action as never)) {
      throw new Error("ADMIN_CASE_ACTION_INVALID");
    }

    let previousState: string;
    let eventAction: AdminCaseAuditEvent["action"] | undefined;
    if (detail.kind === "support") {
      const supportAction = command.action as AdminSupportCaseAction;
      if (detail.profile.resourceVersion !== command.expectedVersion) {
        throw new Error("ADMIN_RESOURCE_VERSION_CONFLICT");
      }
      previousState = detail.profile.state;
      if (supportAction.startsWith("escalate_")) {
        tripCaseManagement.executeCommand(actor, command.idempotencyKey, {
          type: "escalate_support_case",
          supportCaseId: caseId,
          target: supportAction.slice("escalate_".length) as
            | "operations"
            | "safety"
            | "finance",
          resourceVersion: command.expectedVersion,
        });
        eventAction = "support_case_escalated";
      } else {
        tripCaseManagement.executeCommand(actor, command.idempotencyKey, {
          type: "update_support_case",
          supportCaseId: caseId,
          targetState: supportTargetState(supportAction),
          resourceVersion: command.expectedVersion,
        });
        eventAction = "support_case_state_changed";
      }
    } else {
      const safetyAction = command.action as AdminSafetyCaseAction;
      const selectedGrant = command.evidenceGrantId
        ? detail.evidenceGrants.find(
            (grant) => grant.grantId === command.evidenceGrantId,
          )
        : undefined;
      previousState = selectedGrant?.state ?? detail.investigation.investigationState;
      if (
        safetyAction === "approve_evidence" ||
        safetyAction === "revoke_evidence"
      ) {
        if (!selectedGrant) throw new Error("VALIDATION_FAILED");
        if (selectedGrant.resourceVersion !== command.expectedVersion) {
          throw new Error("ADMIN_RESOURCE_VERSION_CONFLICT");
        }
      } else if (detail.investigation.resourceVersion !== command.expectedVersion) {
        throw new Error("ADMIN_RESOURCE_VERSION_CONFLICT");
      }
      switch (safetyAction) {
        case "submit_investigation":
          tripCaseManagement.executeCommand(actor, command.idempotencyKey, {
            type: "submit_safety_investigation",
            safetyCaseId: caseId,
            resourceVersion: command.expectedVersion,
          });
          eventAction = "safety_investigation_submitted";
          break;
        case "restore_access":
        case "uphold_freeze":
          tripCaseManagement.executeCommand(actor, command.idempotencyKey, {
            type: "review_safety_restoration",
            safetyCaseId: caseId,
            outcome:
              command.action === "restore_access"
                ? "restore_access"
                : "uphold_freeze",
            resourceVersion: command.expectedVersion,
          });
          eventAction = "safety_restoration_reviewed";
          break;
        case "request_evidence":
          const ttlMinutes = command.ttlMinutes;
          if (
            !command.ticketId?.trim() ||
            !command.purposeCode ||
            !command.requestedFields?.length ||
            !Number.isInteger(ttlMinutes) ||
            ttlMinutes === undefined ||
            ttlMinutes < 1 ||
            ttlMinutes > 30
          ) {
            throw new Error("VALIDATION_FAILED");
          }
          tripCaseManagement.executeCommand(actor, command.idempotencyKey, {
            type: "request_evidence_access",
            safetyCaseId: caseId,
            ticketId: command.ticketId.trim(),
            purposeCode: command.purposeCode,
            requestedFields: command.requestedFields,
            ttlMinutes,
          });
          eventAction = "evidence_access_requested";
          break;
        case "approve_evidence":
          tripCaseManagement.executeCommand(actor, command.idempotencyKey, {
            type: "approve_evidence_access",
            grantId: command.evidenceGrantId!,
            resourceVersion: command.expectedVersion,
          });
          eventAction = "evidence_access_approved";
          break;
        case "revoke_evidence":
          tripCaseManagement.executeCommand(actor, command.idempotencyKey, {
            type: "revoke_evidence_access",
            grantId: command.evidenceGrantId!,
            resourceVersion: command.expectedVersion,
          });
          eventAction = "evidence_access_revoked";
          break;
      }
    }
    if (!eventAction) throw new Error("ADMIN_CASE_ACTION_INVALID");
    const approvalRecordId =
      kind === "safety"
        ? this.recordSafetyApproval(
            session,
            caseId,
            command.action as AdminSafetyCaseAction,
            command.note?.trim(),
          )
        : undefined;

    const updated = this.caseDetailFor(
      session,
      kind,
      caseId,
      tripCaseManagement,
      requestContext,
    );
    const nextState = updated.kind === "support"
      ? updated.profile.state
      : command.evidenceGrantId
        ? updated.evidenceGrants.find(
            (grant) => grant.grantId === command.evidenceGrantId,
          )?.state ?? updated.investigation.investigationState
        : updated.investigation.investigationState;
    const auditKey = caseAuditKey(kind, caseId);
    const auditTrail = this.caseAuditTrails.get(auditKey) ?? [];
    auditTrail.push({
      eventId: token("case-audit-action"),
      action: eventAction,
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.positionName,
      occurredAt: this.now().toISOString(),
      previousState,
      nextState,
      ...(command.note?.trim() ? { note: command.note.trim() } : {}),
      ...(approvalRecordId ? { approvalRecordId } : {}),
    });
    this.caseAuditTrails.set(auditKey, auditTrail);
    const result: AdminCaseActionResult = {
      operationId: token("case-operation"),
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        ...updated,
        auditTrail: [...auditTrail],
      },
      synthetic: true,
    } as AdminCaseActionResult;
    this.caseOperations.set(operationKey, { fingerprint, result });
    return result;
  }

  private caseDetailFor(
    session: SessionRecord,
    kind: AdminCaseKind,
    caseId: string,
    tripCaseManagement: AdminTripCaseManagementService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminCaseDetail {
    const actor = actorFor(session, requestContext);
    if (kind === "support") {
      const profile = tripCaseManagement.getSupportCase(actor, caseId);
      const trip = tripCaseManagement.getTrip360(actor, profile.tripId);
      return {
        kind,
        case: caseDirectoryItemForSupport(profile, trip.operatorName),
        profile,
        trip,
        organizationScope: organizationScopeFor(session),
        allowedActions: allowedSupportActionsFor(
          profile.state,
          session.workIdentity,
        ),
        auditTrail: [
          ...(this.caseAuditTrails.get(caseAuditKey(kind, caseId)) ?? []),
        ],
        synthetic: true,
      };
    }
    const investigation = tripCaseManagement.getSafetyInvestigation(
      actor,
      caseId,
    );
    const trip = tripCaseManagement.getTrip360(actor, investigation.tripId);
    const evidenceGrants =
      tripCaseManagement.listEvidenceGrantsForSafetyCase(actor, caseId);
    const actionSummary = safetyActionSummaryFor(
      investigation,
      evidenceGrants,
      session.workIdentity,
    );
    return {
      kind,
      case: caseDirectoryItemForSafety(
        investigation,
        trip.operatorId,
        trip.operatorName,
      ),
      investigation,
      trip,
      evidenceGrants,
      organizationScope: organizationScopeFor(session),
      ...actionSummary,
      approvalRecords: this.approvalRecordsFor("safety_case", caseId),
      auditTrail: [
        ...(this.caseAuditTrails.get(caseAuditKey(kind, caseId)) ?? []),
      ],
      synthetic: true,
    };
  }

  public listFinanceResources(
    accessToken: string,
    query: AdminFinanceDirectoryQuery,
    financeOperations: AdminFinanceOperationsService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminFinanceDirectoryPage {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "finance_operations");
    this.assertFinanceOperationsEnabled();
    const pageSize = validatePageSize(query.pageSize, query.after, query.before);
    const scopeDigest = financeScopeDigest(session);
    const queryDigest = digest(JSON.stringify({
      search: query.search?.trim().toLowerCase() ?? "",
      kind: query.kind ?? "",
      state: query.state ?? "",
      blocking: query.blocking ?? "",
      sort: query.sort ?? "updated_at_desc",
      pageSize,
    }));
    const source = financeOperations.listDirectorySource(
      actorFor(session, requestContext),
    );
    const summaryRows = financeDirectoryItemsFor(source);
    let rows = [...summaryRows];
    if (query.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      rows = rows.filter((item) =>
        `${item.resourceId} ${item.operatorName ?? ""} ${item.summary} ${item.businessDate ?? ""}`
          .toLowerCase()
          .includes(search),
      );
    }
    if (query.kind) {
      rows = rows.filter((item) => item.kind === query.kind);
    }
    if (query.state) {
      rows = rows.filter((item) => item.state === query.state);
    }
    if (query.blocking !== undefined) {
      rows = rows.filter((item) => item.blocking === query.blocking);
    }
    rows.sort(
      query.sort === "resource_id_asc"
        ? (left, right) => left.resourceId.localeCompare(right.resourceId)
        : (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            right.resourceId.localeCompare(left.resourceId),
    );
    const page = this.paginateFleetRows(
      rows,
      pageSize,
      query.after,
      query.before,
      queryDigest,
      scopeDigest,
    );
    return {
      summary: {
        totalResources: summaryRows.length,
        blockingResources: summaryRows.filter((item) => item.blocking).length,
        awaitingIndependentReview: summaryRows.filter((item) =>
          item.state === "ready" || item.state === "awaiting_review",
        ).length,
        unknownResults: summaryRows.filter(
          (item) => item.state === "unknown",
        ).length,
        openReconciliationRuns: summaryRows.filter(
          (item) =>
            item.kind === "reconciliation" && item.state !== "closed",
        ).length,
        readyBusinessDays: summaryRows.filter(
          (item) =>
            item.kind === "business_day" && item.state === "ready",
        ).length,
      },
      items: page.items,
      pageInfo: page.pageInfo,
      queryDigest,
      scopeDigest,
      asOf: this.now().toISOString(),
      synthetic: true,
    };
  }

  public getFinanceResource(
    accessToken: string,
    kind: AdminFinanceResourceKind,
    resourceId: string,
    financeOperations: AdminFinanceOperationsService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminFinanceDetail {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "finance_operations");
    this.assertFinanceOperationsEnabled();
    return this.financeDetailFor(
      session,
      kind,
      resourceId,
      financeOperations,
      requestContext,
      true,
    );
  }

  public performFinanceAction(
    accessToken: string,
    kind: AdminFinanceResourceKind,
    resourceId: string,
    command: AdminFinanceActionCommand,
    financeOperations: AdminFinanceOperationsService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminFinanceActionResult {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "finance_operations");
    this.assertFinanceOperationsEnabled();
    const operationKey =
      `${session.workIdentity.workIdentityId}:${kind}:${resourceId}:${command.idempotencyKey}`;
    const fingerprint = digest(JSON.stringify({ kind, resourceId, command }));
    const existing = this.financeOperations.get(operationKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error("CONFLICT_IDEMPOTENCY_KEY_REUSED");
      }
      return { ...existing.result, idempotentReplay: true };
    }
    const detail = this.financeDetailFor(
      session,
      kind,
      resourceId,
      financeOperations,
      requestContext,
      false,
    );
    if (!detail.allowedActions.includes(command.action)) {
      throw new Error("ADMIN_FINANCE_ACTION_INVALID");
    }
    if (detail.item.resourceVersion !== command.expectedVersion) {
      throw new Error("ADMIN_RESOURCE_VERSION_CONFLICT");
    }
    const actionResourceId =
      detail.kind === "reconciliation"
        ? detail.actionResourceId
        : resourceId;
    if (!actionResourceId) throw new Error("ADMIN_FINANCE_ACTION_INVALID");
    financeOperations.executeCommand(
      actorFor(session, requestContext),
      command.idempotencyKey,
      financeCommandFor(command, actionResourceId),
    );
    const approvalRecordId = this.recordFinanceApproval(
      session,
      kind,
      resourceId,
      command,
    );
    const updated = this.financeDetailFor(
      session,
      kind,
      resourceId,
      financeOperations,
      requestContext,
      false,
    );
    const auditKey = financeAuditKey(kind, resourceId);
    const auditTrail = this.financeAuditTrails.get(auditKey) ?? [];
    auditTrail.push({
      eventId: token("finance-audit-action"),
      action: command.action.startsWith("review_")
        ? "finance_review_recorded"
        : "finance_operation_submitted",
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.positionName,
      occurredAt: this.now().toISOString(),
      previousState: detail.item.state,
      nextState: updated.item.state,
      reasonCode: command.reasonCode,
      ...(approvalRecordId ? { approvalRecordId } : {}),
    });
    this.financeAuditTrails.set(auditKey, auditTrail);
    const result: AdminFinanceActionResult = {
      operationId: token("finance-operation"),
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        ...updated,
        auditTrail: [...auditTrail],
      } as AdminFinanceDetail,
      synthetic: true,
    };
    this.financeOperations.set(operationKey, { fingerprint, result });
    return result;
  }

  private financeDetailFor(
    session: SessionRecord,
    kind: AdminFinanceResourceKind,
    resourceId: string,
    financeOperations: AdminFinanceOperationsService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
    auditView: boolean,
  ): AdminFinanceDetail {
    const actor = actorFor(session, requestContext);
    const item = financeDirectoryItemsFor(
      financeOperations.listDirectorySource(actor),
    ).find(
      (candidate) =>
        candidate.kind === kind && candidate.resourceId === resourceId,
    );
    if (!item) throw new Error("ADMIN_FINANCE_RESOURCE_NOT_FOUND");
    const auditKey = financeAuditKey(kind, resourceId);
    if (auditView) {
      const viewKey = `${session.workIdentity.workIdentityId}:${auditKey}`;
      const now = this.now().getTime();
      if (now - (this.financeViewAuditedAt.get(viewKey) ?? 0) >= 1_000) {
        const auditTrail = this.financeAuditTrails.get(auditKey) ?? [];
        auditTrail.push({
          eventId: token("finance-audit-view"),
          action: "finance_profile_viewed",
          actorLabel: session.workIdentity.organizationName,
          actorRole: session.workIdentity.positionName,
          occurredAt: this.now().toISOString(),
        });
        this.financeAuditTrails.set(auditKey, auditTrail);
        this.financeViewAuditedAt.set(viewKey, now);
      }
    }
    const base = {
      item,
      organizationScope: organizationScopeFor(session),
      approvalRecords: this.approvalRecordsFor("finance_record", resourceId),
      auditTrail: [...(this.financeAuditTrails.get(auditKey) ?? [])],
      directBalanceMutationAllowed: false as const,
      realMoneyMovementAllowed: false as const,
      synthetic: true as const,
    };
    switch (kind) {
      case "settlement": {
        const record = financeOperations.getAllocationSettlement(
          actor,
          resourceId,
        );
        return {
          ...base,
          kind,
          record,
          ...financeActionSummaryFor(
            kind,
            record,
            session.workIdentity,
          ),
        };
      }
      case "payout": {
        const record = financeOperations.getDriverPayout(actor, resourceId);
        return {
          ...base,
          kind,
          record,
          ...financeActionSummaryFor(
            kind,
            record,
            session.workIdentity,
          ),
        };
      }
      case "refund_reversal": {
        const record = financeOperations.getRefundReversal(actor, resourceId);
        return {
          ...base,
          kind,
          record,
          ...financeActionSummaryFor(
            kind,
            record,
            session.workIdentity,
          ),
        };
      }
      case "reconciliation": {
        const record = financeOperations.getReconciliationFundCases(
          actor,
          resourceId,
        );
        const actionSummary = financeActionSummaryFor(
          kind,
          record,
          session.workIdentity,
        );
        const actionResourceId = reconciliationActionResourceId(
          record,
          actionSummary.allowedActions[0],
        );
        return {
          ...base,
          kind,
          record,
          ...actionSummary,
          ...(actionResourceId ? { actionResourceId } : {}),
        };
      }
      case "business_day": {
        const record = financeOperations.getBusinessDayClose(actor, resourceId);
        return {
          ...base,
          kind,
          record,
          ...financeActionSummaryFor(
            kind,
            record,
            session.workIdentity,
          ),
        };
      }
      case "ledger": {
        const record = financeOperations.getLedgerTransaction(actor, resourceId);
        return {
          ...base,
          kind,
          record,
          allowedActions: [],
          actionBlockers: [],
          nextSteps: [recordNextStep("NONE", "查看账本记录")],
        };
      }
    }
  }

  private approvalRecordsFor(
    resourceKind: AdminHighRiskApprovalRecord["resourceKind"],
    resourceId: string,
  ): readonly AdminHighRiskApprovalRecord[] {
    return [...this.highRiskApprovalRecords.values()]
      .filter(
        (record) =>
          record.resourceKind === resourceKind &&
          record.resourceId === resourceId,
      )
      .sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) ||
          right.approvalId.localeCompare(left.approvalId),
      );
  }

  private recordSafetyApproval(
    session: SessionRecord,
    resourceId: string,
    action: AdminSafetyCaseAction,
    note?: string,
  ): string | undefined {
    if (action === "submit_investigation") {
      return this.createApprovalRecord(
        session,
        "support_safety",
        "safety_case",
        resourceId,
        "review_safety_restoration",
        note,
      ).approvalId;
    }
    if (action === "request_evidence") {
      return this.createApprovalRecord(
        session,
        "support_safety",
        "safety_case",
        resourceId,
        "approve_evidence",
        note,
      ).approvalId;
    }
    const requestedAction =
      action === "restore_access" || action === "uphold_freeze"
        ? "review_safety_restoration"
        : action === "approve_evidence" || action === "revoke_evidence"
          ? "approve_evidence"
          : undefined;
    if (!requestedAction) return undefined;
    const state =
      action === "uphold_freeze"
        ? "declined"
        : action === "revoke_evidence"
          ? "revoked"
          : "approved";
    return this.decideApprovalRecord(
      session,
      "support_safety",
      "safety_case",
      resourceId,
      requestedAction,
      state,
      note,
    ).approvalId;
  }

  private recordFinanceApproval(
    session: SessionRecord,
    _kind: AdminFinanceResourceKind,
    resourceId: string,
    command: AdminFinanceActionCommand,
  ): string | undefined {
    const requestedAction = financeRequestedReviewActionFor(command.action);
    if (!requestedAction) return undefined;
    if (!command.action.startsWith("review_")) {
      return this.createApprovalRecord(
        session,
        "finance",
        "finance_record",
        resourceId,
        requestedAction,
        command.reasonCode,
      ).approvalId;
    }
    return this.decideApprovalRecord(
      session,
      "finance",
      "finance_record",
      resourceId,
      requestedAction,
      "approved",
      command.reasonCode,
    ).approvalId;
  }

  private createApprovalRecord(
    session: SessionRecord,
    domain: AdminHighRiskApprovalRecord["domain"],
    resourceKind: AdminHighRiskApprovalRecord["resourceKind"],
    resourceId: string,
    requestedAction: string,
    note?: string,
  ): AdminHighRiskApprovalRecord {
    const occurredAt = this.now().toISOString();
    const record: AdminHighRiskApprovalRecord = {
      approvalId: token("approval"),
      domain,
      resourceKind,
      resourceId,
      organizationType: session.workIdentity.type,
      organizationId: session.workIdentity.organizationId,
      organizationName: session.workIdentity.organizationName,
      requestedAction,
      state: "pending",
      requester: approvalActorFor(session, occurredAt),
      ...(note ? { decisionNote: note } : {}),
      separationRequired: true,
      resourceVersion: 1,
      updatedAt: occurredAt,
      synthetic: true,
    };
    this.highRiskApprovalRecords.set(record.approvalId, record);
    return record;
  }

  private decideApprovalRecord(
    session: SessionRecord,
    domain: AdminHighRiskApprovalRecord["domain"],
    resourceKind: AdminHighRiskApprovalRecord["resourceKind"],
    resourceId: string,
    requestedAction: string,
    state: Exclude<AdminHighRiskApprovalRecord["state"], "pending">,
    note?: string,
  ): AdminHighRiskApprovalRecord {
    const pending = [...this.highRiskApprovalRecords.values()]
      .filter(
        (record) =>
          record.domain === domain &&
          record.resourceKind === resourceKind &&
          record.resourceId === resourceId &&
          record.requestedAction === requestedAction &&
          record.state === "pending",
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    const current =
      pending ??
      this.createApprovalRecord(
        {
          ...session,
          workIdentity: {
            ...session.workIdentity,
            workIdentityId: `legacy-requester:${resourceId}`,
            positionName: "原经办人",
          },
        },
        domain,
        resourceKind,
        resourceId,
        requestedAction,
      );
    const occurredAt = this.now().toISOString();
    const decided: AdminHighRiskApprovalRecord = {
      ...current,
      state,
      reviewer: approvalActorFor(session, occurredAt),
      ...(note ? { decisionNote: note } : {}),
      resourceVersion: current.resourceVersion + 1,
      updatedAt: occurredAt,
    };
    this.highRiskApprovalRecords.set(decided.approvalId, decided);
    return decided;
  }

  public listExecutiveResources(
    accessToken: string,
    query: AdminExecutiveDirectoryQuery,
    executiveDashboard: ExecutiveDashboardQueryService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminExecutiveDirectoryPage {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "executive_dashboard");
    this.assertExecutiveDashboardEnabled();
    const pageSize = validatePageSize(query.pageSize, query.after, query.before);
    const scopeDigest = executiveScopeDigest(session);
    const queryDigest = digest(JSON.stringify({
      search: query.search?.trim().toLowerCase() ?? "",
      kind: query.kind ?? "",
      state: query.state ?? "",
      domain: query.domain ?? "",
      blocking: query.blocking ?? "",
      sort: query.sort ?? "updated_at_desc",
      pageSize,
    }));
    const actor = actorFor(session, requestContext);
    const overview = executiveDashboard.getExecutiveOverview(actor);
    const decisions = executiveDashboard.getExecutiveDecisionItems(actor);
    const operatorHealth = executiveDashboard.getExecutiveOperatorHealth(actor);
    const metricRegistry = executiveDashboard.getExecutiveMetricRegistry(actor);
    const exports = executiveDashboard.listExportRequests(actor);
    const sourceRows = executiveDirectoryItemsFor({
      overview,
      decisions,
      operatorHealth,
      metricRegistry,
      exports,
    });
    let rows = [...sourceRows];
    if (query.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      rows = rows.filter((item) =>
        `${item.resourceId} ${item.operatorName ?? ""} ${item.title} ${item.summary}`
          .toLowerCase()
          .includes(search),
      );
    }
    if (query.kind) rows = rows.filter((item) => item.kind === query.kind);
    if (query.state) rows = rows.filter((item) => item.state === query.state);
    if (query.domain) rows = rows.filter((item) => item.domain === query.domain);
    if (query.blocking !== undefined) {
      rows = rows.filter((item) => item.blocking === query.blocking);
    }
    rows.sort(
      query.sort === "resource_id_asc"
        ? (left, right) => left.resourceId.localeCompare(right.resourceId)
        : (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            right.resourceId.localeCompare(left.resourceId),
    );
    const page = this.paginateFleetRows(
      rows,
      pageSize,
      query.after,
      query.before,
      queryDigest,
      scopeDigest,
    );
    return {
      summary: {
        totalResources: sourceRows.length,
        openDecisionItems: sourceRows.filter(
          (item) => item.kind === "decision_item" && item.state === "open",
        ).length,
        blockingOperators: sourceRows.filter(
          (item) => item.kind === "operator_health" && item.blocking,
        ).length,
        exportsAwaitingReview: sourceRows.filter(
          (item) =>
            item.kind === "export_request" &&
            (item.state === "awaiting_privacy_review" ||
              item.state === "awaiting_domain_review"),
        ).length,
        unavailableMetrics: sourceRows.filter(
          (item) => item.kind === "metric" && item.state === "unavailable",
        ).length,
        pageState: overview.pageState,
      },
      headlineMetrics: overview.metrics,
      notices: overview.notices,
      items: page.items,
      pageInfo: page.pageInfo,
      queryDigest,
      scopeDigest,
      asOf: overview.asOf,
      synthetic: true,
    };
  }

  public getExecutiveResource(
    accessToken: string,
    kind: AdminExecutiveResourceKind,
    resourceId: string,
    executiveDashboard: ExecutiveDashboardQueryService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminExecutiveDetail {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "executive_dashboard");
    this.assertExecutiveDashboardEnabled();
    return this.executiveDetailFor(
      session,
      kind,
      resourceId,
      executiveDashboard,
      requestContext,
      true,
    );
  }

  public performExecutiveAction(
    accessToken: string,
    kind: AdminExecutiveResourceKind,
    resourceId: string,
    command: AdminExecutiveActionCommand,
    executiveDashboard: ExecutiveDashboardQueryService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminExecutiveActionResult {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "executive_dashboard");
    this.assertExecutiveDashboardEnabled();
    if (!command.idempotencyKey.trim()) throw new Error("VALIDATION_FAILED");
    const operationKey =
      `${session.workIdentity.workIdentityId}:${kind}:${resourceId}:${command.idempotencyKey}`;
    const fingerprint = digest(JSON.stringify({ kind, resourceId, command }));
    const existing = this.executiveOperations.get(operationKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error("CONFLICT_IDEMPOTENCY_KEY_REUSED");
      }
      return { ...existing.result, idempotentReplay: true };
    }
    const actor = actorFor(session, requestContext);
    let detail: AdminExecutiveDetail;
    let download:
      | import("@pollycar/contracts").ExecutiveExportDownload
      | undefined;
    if (command.action === "create_export_request") {
      if (
        kind !== "export_request" ||
        resourceId !== "new" ||
        !command.domain ||
        !command.purpose?.trim() ||
        !command.fieldSet?.length ||
        !command.windowStart ||
        !command.windowEnd
      ) {
        throw new Error("VALIDATION_FAILED");
      }
      const created = executiveDashboard.createExportRequest(
        actor,
        command.idempotencyKey,
        {
          domain: command.domain,
          purpose: command.purpose.trim(),
          fieldSet: command.fieldSet,
          windowStart: command.windowStart,
          windowEnd: command.windowEnd,
        },
      );
      detail = this.executiveDetailFor(
        session,
        "export_request",
        created.exportRequestId,
        executiveDashboard,
        requestContext,
        false,
      );
    } else {
      const current = this.executiveDetailFor(
        session,
        kind,
        resourceId,
        executiveDashboard,
        requestContext,
        false,
      );
      if (!current.allowedActions.includes(command.action)) {
        throw new Error("ADMIN_EXECUTIVE_OPERATION_FORBIDDEN");
      }
      if (
        command.expectedVersion === undefined ||
        current.item.resourceVersion !== command.expectedVersion
      ) {
        throw new Error("ADMIN_RESOURCE_VERSION_CONFLICT");
      }
      performExecutiveDomainAction(
        executiveDashboard,
        actor,
        current,
        command,
      );
      if (command.action === "download_export") {
        download = executiveDashboard.downloadExport(actor, resourceId);
      }
      detail = this.executiveDetailFor(
        session,
        kind,
        resourceId,
        executiveDashboard,
        requestContext,
        false,
      );
    }
    const auditKey = executiveAuditKey(detail.kind, detail.item.resourceId);
    const auditTrail = this.executiveAuditTrails.get(auditKey) ?? [];
    auditTrail.push({
      eventId: token("executive-audit-action"),
      action: executiveAuditActionFor(command.action),
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.positionName,
      occurredAt: this.now().toISOString(),
      ...(command.reasonCode ? { reasonCode: command.reasonCode } : {}),
    });
    this.executiveAuditTrails.set(auditKey, auditTrail);
    const result: AdminExecutiveActionResult = {
      operationId: token("executive-operation"),
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        ...detail,
        auditTrail: [...auditTrail],
      } as AdminExecutiveDetail,
      ...(download ? { download } : {}),
      synthetic: true,
    };
    this.executiveOperations.set(operationKey, { fingerprint, result });
    return result;
  }

  private executiveDetailFor(
    session: SessionRecord,
    kind: AdminExecutiveResourceKind,
    resourceId: string,
    executiveDashboard: ExecutiveDashboardQueryService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
    auditView: boolean,
  ): AdminExecutiveDetail {
    const actor = actorFor(session, requestContext);
    const overview = executiveDashboard.getExecutiveOverview(actor);
    const decisions = executiveDashboard.getExecutiveDecisionItems(actor);
    const operatorHealth = executiveDashboard.getExecutiveOperatorHealth(actor);
    const metricRegistry = executiveDashboard.getExecutiveMetricRegistry(actor);
    const exports = executiveDashboard.listExportRequests(actor);
    const item = executiveDirectoryItemsFor({
      overview,
      decisions,
      operatorHealth,
      metricRegistry,
      exports,
    }).find(
      (candidate) =>
        candidate.kind === kind && candidate.resourceId === resourceId,
    );
    if (!item) throw new Error("ADMIN_EXECUTIVE_RESOURCE_NOT_FOUND");
    const auditKey = executiveAuditKey(kind, resourceId);
    if (auditView) {
      const viewKey = `${session.workIdentity.workIdentityId}:${auditKey}`;
      const now = this.now().getTime();
      if (now - (this.executiveViewAuditedAt.get(viewKey) ?? 0) >= 1_000) {
        const auditTrail = this.executiveAuditTrails.get(auditKey) ?? [];
        auditTrail.push({
          eventId: token("executive-audit-view"),
          action: "executive_resource_viewed",
          actorLabel: session.workIdentity.organizationName,
          actorRole: session.workIdentity.positionName,
          occurredAt: this.now().toISOString(),
        });
        this.executiveAuditTrails.set(auditKey, auditTrail);
        this.executiveViewAuditedAt.set(viewKey, now);
      }
    }
    const base = {
      item,
      organizationScope: organizationScopeFor(session),
      auditTrail: [...(this.executiveAuditTrails.get(auditKey) ?? [])],
      directBusinessApprovalAllowed: false as const,
      personLevelDrilldownAllowed: false as const,
      containsRealData: false as const,
      synthetic: true as const,
    };
    switch (kind) {
      case "decision_item": {
        const record = decisions.decisionItems.find(
          (candidate) => candidate.decisionItemId === resourceId,
        );
        if (!record) throw new Error("ADMIN_EXECUTIVE_RESOURCE_NOT_FOUND");
        return {
          ...base,
          kind,
          record,
          allowedActions:
            hasCapability(session.workIdentity, "executive_read")
              ? ["record_decision_opinion"]
              : [],
        };
      }
      case "export_request": {
        const record = executiveDashboard.getExportRequest(actor, resourceId);
        return {
          ...base,
          kind,
          record,
          allowedActions: allowedExecutiveExportActionsFor(
            record,
            session.workIdentity,
            session.workIdentity.workIdentityId,
          ),
        };
      }
      case "operator_health": {
        const record = operatorHealth.operators.find(
          (candidate) => candidate.operatorId === resourceId,
        );
        if (!record) throw new Error("ADMIN_EXECUTIVE_RESOURCE_NOT_FOUND");
        return { ...base, kind, record, allowedActions: [] };
      }
      case "metric": {
        const definition = metricRegistry.metrics.find(
          (candidate) => candidate.metricId === resourceId,
        );
        if (!definition) throw new Error("ADMIN_EXECUTIVE_RESOURCE_NOT_FOUND");
        const snapshot = overview.metrics.find(
          (candidate) => candidate.metricId === resourceId,
        );
        return {
          ...base,
          kind,
          record: {
            definition,
            ...(snapshot ? { snapshot } : {}),
          },
          allowedActions: [],
        };
      }
    }
  }

  public listAuditResources(
    accessToken: string,
    query: AdminAuditDirectoryQuery,
    adminAccess: AdminAccessService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminAuditDirectoryPage {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "audit_system");
    this.assertAuditSystemEnabled();
    const events = this.visibleAuditEvents(
      session,
      adminAccess.listAuditEvents(actorFor(session, requestContext)),
    );
    const investigations = [...this.auditInvestigations.values()].filter(
      (investigation) =>
        session.workIdentity.type === "platform" ||
        investigation.organizationId === session.workIdentity.organizationId,
    );
    const approvals = [...this.highRiskApprovalRecords.values()].filter(
      (approval) =>
        session.workIdentity.type === "platform" ||
        approval.organizationId === session.workIdentity.organizationId,
    );
    const eventItems = events.map(auditEventDirectoryItem);
    const investigationItems = investigations.map(
      auditInvestigationDirectoryItem,
    );
    const approvalItems = approvals.map(auditApprovalDirectoryItem);
    const allItems = [...eventItems, ...investigationItems, ...approvalItems];
    const search = query.search?.trim().toLocaleLowerCase("zh-CN");
    const filtered = allItems.filter(
      (item) =>
        (!query.kind || item.kind === query.kind) &&
        (!query.domain || item.domain === query.domain) &&
        (!query.result || item.result === query.result) &&
        (!search ||
          [
            item.resourceId,
            item.title,
            item.summary,
            item.organizationName,
            item.actorRole,
            item.correlationId,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value).toLocaleLowerCase("zh-CN").includes(search),
            )),
    );
    const sorted = filtered.sort((left, right) =>
      query.sort === "resource_id_asc"
        ? left.resourceId.localeCompare(right.resourceId)
        : right.occurredAt.localeCompare(left.occurredAt) ||
          right.resourceId.localeCompare(left.resourceId)
    );
    const pageSize = validatePageSize(
      query.pageSize,
      query.after,
      query.before,
    );
    const queryDigest = digest(
      JSON.stringify({
        search: query.search?.trim() ?? "",
        kind: query.kind ?? "",
        domain: query.domain ?? "",
        result: query.result ?? "",
        sort: query.sort ?? "occurred_at_desc",
        pageSize,
      }),
    );
    const scopeDigest = auditScopeDigest(session);
    const page = this.paginateFleetRows(
      sorted,
      pageSize,
      query.after,
      query.before,
      queryDigest,
      scopeDigest,
    );
    return {
      summary: {
        totalResources: allItems.length,
        deniedEvents: events.filter((event) => event.result === "denied").length,
        highRiskEvents: events.filter(isHighRiskAuditEvent).length,
        openInvestigations: investigations.filter(
          (investigation) => investigation.state !== "resolved",
        ).length,
        pendingApprovals: approvals.filter(
          (approval) => approval.state === "pending",
        ).length,
        integrityWarnings: 0,
      },
      items: page.items,
      pageInfo: page.pageInfo,
      queryDigest,
      scopeDigest,
      asOf: this.now().toISOString(),
      synthetic: true,
    };
  }

  public getAuditResource(
    accessToken: string,
    kind: AdminAuditResourceKind,
    resourceId: string,
    adminAccess: AdminAccessService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminAuditDetail {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "audit_system");
    this.assertAuditSystemEnabled();
    return this.auditDetailFor(
      session,
      kind,
      resourceId,
      adminAccess,
      requestContext,
      true,
    );
  }

  public performAuditAction(
    accessToken: string,
    kind: AdminAuditResourceKind,
    resourceId: string,
    command: AdminAuditActionCommand,
    adminAccess: AdminAccessService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminAuditActionResult {
    const session = this.authenticate(accessToken);
    this.assertDomainRead(session, "audit_system");
    this.assertAuditSystemEnabled();
    if (!command.idempotencyKey.trim() || !command.reasonCode.trim()) {
      throw new Error("VALIDATION_FAILED");
    }
    const operationKey =
      `${session.workIdentity.workIdentityId}:${kind}:${resourceId}:${command.idempotencyKey}`;
    const fingerprint = digest(JSON.stringify({ kind, resourceId, command }));
    const existing = this.auditOperations.get(operationKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error("CONFLICT_IDEMPOTENCY_KEY_REUSED");
      }
      return { ...existing.result, idempotentReplay: true };
    }
    const current = this.auditDetailFor(
      session,
      kind,
      resourceId,
      adminAccess,
      requestContext,
      false,
    );
    if (!current.allowedActions.includes(command.action)) {
      throw new Error("ADMIN_AUDIT_OPERATION_FORBIDDEN");
    }
    if (current.item.resourceVersion !== command.expectedVersion) {
      throw new Error("ADMIN_RESOURCE_VERSION_CONFLICT");
    }
    const actor = actorFor(session, requestContext);
    let investigation: AdminAuditInvestigation;
    let previousState: AdminAuditInvestigation["state"] | undefined;
    if (command.action === "open_investigation") {
      if (current.kind !== "event") throw new Error("VALIDATION_FAILED");
      const investigationId = token("audit-investigation");
      const occurredAt = this.now().toISOString();
      investigation = Object.freeze({
        investigationId,
        sourceEventId: current.record.event.eventId,
        domain: current.item.domain,
        state: "open",
        title: `调查：${current.item.title}`,
        reasonCode: command.reasonCode.trim(),
        organizationType: current.item.organizationType,
        organizationId: current.item.organizationId,
        organizationName: current.item.organizationName,
        notes: Object.freeze([]),
        resourceVersion: 1,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        synthetic: true,
      });
      this.auditInvestigations.set(investigationId, investigation);
    } else {
      if (current.kind !== "investigation") throw new Error("VALIDATION_FAILED");
      previousState = current.record.state;
      investigation = updateAuditInvestigation(
        current.record,
        command,
        session.workIdentity.workIdentityId,
        this.now().toISOString(),
      );
      this.auditInvestigations.set(investigation.investigationId, investigation);
    }
    const actionEvent = auditTrailEventFor(
      command.action,
      session,
      previousState,
      investigation.state,
      command.note?.trim() || command.reasonCode.trim(),
      this.now().toISOString(),
    );
    const trailKey = auditTrailKey("investigation", investigation.investigationId);
    const trail = this.auditTrails.get(trailKey) ?? [];
    trail.push(actionEvent);
    this.auditTrails.set(trailKey, trail);
    adminAccess.recordAuditSystemEvent(actor, {
      eventType: auditEventTypeForAction(command.action),
      action: command.action,
      resourceType: "audit_investigation",
      resourceId: investigation.investigationId,
      reasonCode: command.reasonCode.trim(),
    });
    const detail = this.auditDetailFor(
      session,
      "investigation",
      investigation.investigationId,
      adminAccess,
      requestContext,
      false,
    );
    const result: AdminAuditActionResult = {
      operationId: token("audit-operation"),
      resultState: "confirmed",
      idempotentReplay: false,
      detail,
      synthetic: true,
    };
    this.auditOperations.set(operationKey, { fingerprint, result });
    return result;
  }

  public listDataReports(
    accessToken: string,
    query: AdminDataReportDirectoryQuery,
    adminAccess: AdminAccessService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminDataReportDirectoryPage {
    const session = this.authenticate(accessToken);
    this.assertDataReportsEnabled();
    this.assertDomainRead(session, "data_reports");
    const pageSize = query.pageSize ?? 25;
    if (![25, 50, 100].includes(pageSize) || (query.after && query.before)) {
      throw new Error("ADMIN_PAGINATION_INVALID");
    }
    const scopeDigest = digest(
      `${session.workIdentity.type}:${session.workIdentity.organizationId}:data_reports`,
    );
    const queryDigest = digest(JSON.stringify({
      search: query.search?.trim().toLowerCase() ?? "",
      domain: query.domain ?? "",
      state: query.state ?? "",
      sort: query.sort ?? "refreshed_at_desc",
      pageSize,
    }));
    let rows = dataReportDefinitions.map((definition) =>
      this.dataReportDirectoryItem(
        session,
        definition.reportId,
        adminAccess,
        requestContext,
      ),
    );
    if (query.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      rows = rows.filter((item) =>
        `${item.title} ${item.summary} ${item.reportId}`
          .toLowerCase()
          .includes(search),
      );
    }
    if (query.domain) rows = rows.filter((item) => item.domain === query.domain);
    if (query.state) rows = rows.filter((item) => item.state === query.state);
    rows = [...rows].sort(
      query.sort === "report_id_asc"
        ? (left, right) => left.reportId.localeCompare(right.reportId)
        : (left, right) =>
            right.refreshedAt.localeCompare(left.refreshedAt) ||
            left.reportId.localeCompare(right.reportId),
    );
    const page = this.paginateFleetRows(
      rows,
      pageSize,
      query.after,
      query.before,
      queryDigest,
      scopeDigest,
    );
    return {
      summary: {
        totalReports: rows.length,
        readyReports: rows.filter((item) => item.state === "ready").length,
        partialReports: rows.filter((item) => item.state === "partial").length,
        staleReports: rows.filter((item) => item.state === "stale").length,
        totalMetrics: rows.reduce((sum, item) => sum + item.metricCount, 0),
      },
      items: page.items,
      pageInfo: page.pageInfo,
      queryDigest,
      scopeDigest,
      asOf: this.now().toISOString(),
      synthetic: true,
    };
  }

  public getDataReport(
    accessToken: string,
    reportId: string,
    adminAccess: AdminAccessService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminDataReportDetail {
    const session = this.authenticate(accessToken);
    this.assertDataReportsEnabled();
    this.assertDomainRead(session, "data_reports");
    return this.dataReportDetailFor(
      session,
      reportId,
      adminAccess,
      requestContext,
      true,
    );
  }

  public performDataReportAction(
    accessToken: string,
    reportId: string,
    command: AdminDataReportActionCommand,
    adminAccess: AdminAccessService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminDataReportActionResult {
    const session = this.authenticate(accessToken);
    this.assertDataReportsEnabled();
    this.assertDomainRead(session, "data_reports");
    const current = this.dataReportDetailFor(
      session,
      reportId,
      adminAccess,
      requestContext,
      false,
    );
    if (!current.allowedActions.includes(command.action)) {
      throw new Error("ADMIN_DATA_REPORT_OPERATION_FORBIDDEN");
    }
    const operationKey =
      `${session.workIdentity.workIdentityId}:${command.idempotencyKey}`;
    const fingerprint = digest(JSON.stringify({
      reportId,
      ...command,
    }));
    const previous = this.dataReportOperations.get(operationKey);
    if (previous) {
      if (previous.fingerprint !== fingerprint) {
        throw new Error("CONFLICT_IDEMPOTENCY_KEY_REUSED");
      }
      return {
        ...previous.result,
        idempotentReplay: true,
      };
    }
    if (current.item.resourceVersion !== command.expectedVersion) {
      throw new Error("ADMIN_RESOURCE_VERSION_CONFLICT");
    }
    const nextVersion = current.item.resourceVersion + 1;
    const occurredAt = this.now().toISOString();
    this.dataReportVersions.set(reportId, nextVersion);
    this.dataReportRefreshedAt.set(reportId, occurredAt);
    const trail = this.dataReportAuditTrails.get(reportId) ?? [];
    trail.push({
      eventId: token("data-report-audit"),
      action: "data_report_refreshed",
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.positionName,
      occurredAt,
      previousVersion: current.item.resourceVersion,
      nextVersion,
      reasonCode: command.reasonCode,
    });
    this.dataReportAuditTrails.set(reportId, trail);
    adminAccess.recordAuditSystemEvent(actorFor(session, requestContext), {
      eventType: "data_report_refreshed",
      action: "refresh_report",
      resourceType: "data_report",
      resourceId: reportId,
      reasonCode: command.reasonCode,
    });
    const result: AdminDataReportActionResult = {
      operationId: token("data-report-operation"),
      resultState: "confirmed",
      idempotentReplay: false,
      detail: this.dataReportDetailFor(
        session,
        reportId,
        adminAccess,
        requestContext,
        false,
      ),
      synthetic: true,
    };
    this.dataReportOperations.set(operationKey, { fingerprint, result });
    return result;
  }

  public listMemberships(
    accessToken: string,
    query: AdminMembershipDirectoryQuery,
  ): AdminMembershipDirectoryPage {
    const session = this.authenticate(accessToken);
    this.assertOrganizationAccountsEnabled();
    this.assertDomainRead(session, "organization_accounts");
    const pageSize = query.pageSize ?? 25;
    if (![25, 50, 100].includes(pageSize) || (query.after && query.before)) {
      throw new Error("ADMIN_PAGINATION_INVALID");
    }
    const scopeDigest = membershipScopeDigest(session);
    const queryDigest = digest(JSON.stringify({
      search: query.search?.trim().toLowerCase() ?? "",
      organizationType: query.organizationType ?? "",
      state: query.state ?? "",
      authorizationLevel: query.authorizationLevel ?? "",
      capability: query.capability ?? "",
      sort: query.sort ?? "updated_at_desc",
      pageSize,
    }));
    let rows = [...this.membershipDefinitions.values()]
      .filter((definition) => this.membershipVisibleTo(session, definition))
      .map((definition) => this.membershipDirectoryItem(definition));
    if (query.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      rows = rows.filter((item) =>
        `${item.displayName} ${item.workEmailMasked} ${item.organizationName} ${item.positionName}`
          .toLowerCase()
          .includes(search),
      );
    }
    if (query.organizationType) {
      rows = rows.filter(
        (item) => item.organizationType === query.organizationType,
      );
    }
    if (query.state) rows = rows.filter((item) => item.state === query.state);
    if (query.authorizationLevel) {
      rows = rows.filter(
        (item) => item.authorizationLevel === query.authorizationLevel,
      );
    }
    if (query.capability) {
      rows = rows.filter((item) => item.capabilities.includes(query.capability!));
    }
    rows = [...rows].sort(
      query.sort === "display_name_asc"
        ? (left, right) =>
            left.displayName.localeCompare(right.displayName, "zh-CN") ||
            left.membershipId.localeCompare(right.membershipId)
        : (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            left.membershipId.localeCompare(right.membershipId),
    );
    const page = this.paginateFleetRows(
      rows,
      pageSize,
      query.after,
      query.before,
      queryDigest,
      scopeDigest,
    );
    return {
      summary: {
        totalMemberships: rows.length,
        activeMemberships: rows.filter((item) => item.state === "active").length,
        suspendedMemberships: rows.filter((item) => item.state === "suspended").length,
        activeSessions: rows.reduce(
          (total, item) => total + item.activeSessionCount,
          0,
        ),
      },
      items: page.items,
      pageInfo: page.pageInfo,
      queryDigest,
      scopeDigest,
      asOf: this.now().toISOString(),
      synthetic: true,
    };
  }

  public getMembership(
    accessToken: string,
    membershipId: string,
    adminAccess: AdminAccessService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminMembershipDetail {
    const session = this.authenticate(accessToken);
    this.assertOrganizationAccountsEnabled();
    this.assertDomainRead(session, "organization_accounts");
    return this.membershipDetailFor(
      session,
      membershipId,
      adminAccess,
      requestContext,
      true,
    );
  }

  public performMembershipAction(
    accessToken: string,
    membershipId: string,
    command: AdminMembershipActionCommand,
    adminAccess: AdminAccessService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminMembershipActionResult {
    const session = this.authenticate(accessToken);
    this.assertOrganizationAccountsEnabled();
    this.assertDomainRead(session, "organization_accounts");
    const definition = this.requireVisibleMembership(session, membershipId);
    if (
      !hasCapability(session.workIdentity, "membership_governance")
    ) {
      throw new Error("ADMIN_MEMBERSHIP_OPERATION_FORBIDDEN");
    }
    if (definition.workIdentity.workIdentityId === session.workIdentity.workIdentityId) {
      throw new Error("ADMIN_MEMBERSHIP_SELF_SUSPEND_FORBIDDEN");
    }
    const operationKey =
      `${session.workIdentity.workIdentityId}:${membershipId}:${command.idempotencyKey}`;
    const fingerprint = digest(JSON.stringify({
      action: command.action,
      expectedVersion: command.expectedVersion,
      reasonCode: command.reasonCode.trim(),
    }));
    const existing = this.membershipOperations.get(operationKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error("IDEMPOTENCY_KEY_REUSED");
      }
      return {
        ...existing.result,
        idempotentReplay: true,
      };
    }
    const currentVersion = this.membershipVersions.get(membershipId) ?? 1;
    if (command.expectedVersion !== currentVersion) {
      throw new Error("ADMIN_RESOURCE_VERSION_CONFLICT");
    }
    const previousState = this.membershipStates.get(membershipId) ?? "active";
    const nextState =
      command.action === "suspend_membership" ? "suspended" : "active";
    if (previousState === nextState) {
      throw new Error("ADMIN_MEMBERSHIP_STATE_INVALID");
    }
    this.membershipStates.set(membershipId, nextState);
    this.membershipVersions.set(membershipId, currentVersion + 1);
    this.membershipUpdatedAt.set(membershipId, this.now().toISOString());
    if (nextState === "suspended") {
      this.revokeSessionsForWorkIdentity(definition.workIdentity.workIdentityId);
    }
    const eventType =
      command.action === "suspend_membership"
        ? "admin_membership_suspended"
        : "admin_membership_restored";
    const event: AdminMembershipAuditEvent = {
      eventId: token("membership-audit"),
      action: eventType,
      actorLabel: session.workIdentity.positionName,
      actorRole: session.workIdentity.positionName,
      occurredAt: this.now().toISOString(),
      previousState,
      nextState,
      reasonCode: command.reasonCode.trim(),
    };
    const trail = this.membershipAuditTrails.get(membershipId) ?? [];
    trail.push(event);
    this.membershipAuditTrails.set(membershipId, trail);
    adminAccess.recordOrganizationAccountEvent(
      actorFor(session, requestContext),
      {
        eventType,
        action: command.action,
        resourceType: "admin_membership",
        resourceId: membershipId,
        reasonCode: command.reasonCode.trim(),
      },
    );
    const result: AdminMembershipActionResult = {
      operationId: token("membership-operation"),
      resultState: "confirmed",
      idempotentReplay: false,
      detail: this.membershipDetailFor(
        session,
        membershipId,
        adminAccess,
        requestContext,
        false,
      ),
      synthetic: true,
    };
    this.membershipOperations.set(operationKey, { fingerprint, result });
    return result;
  }

  private membershipDetailFor(
    session: SessionRecord,
    membershipId: string,
    adminAccess: AdminAccessService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
    auditView: boolean,
  ): AdminMembershipDetail {
    const definition = this.requireVisibleMembership(session, membershipId);
    if (auditView) {
      const key = `${session.workIdentity.workIdentityId}:${membershipId}`;
      const now = this.now().getTime();
      if ((this.membershipViewAuditedAt.get(key) ?? 0) + 1_000 <= now) {
        this.membershipViewAuditedAt.set(key, now);
        const event: AdminMembershipAuditEvent = {
          eventId: token("membership-audit"),
          action: "admin_membership_viewed",
          actorLabel: session.workIdentity.positionName,
          actorRole: session.workIdentity.positionName,
          occurredAt: this.now().toISOString(),
        };
        const trail = this.membershipAuditTrails.get(membershipId) ?? [];
        trail.push(event);
        this.membershipAuditTrails.set(membershipId, trail);
        adminAccess.recordOrganizationAccountEvent(
          actorFor(session, requestContext),
          {
            eventType: "admin_membership_viewed",
            action: "view_membership",
            resourceType: "admin_membership",
            resourceId: membershipId,
          },
        );
      }
    }
    return {
      item: this.membershipDirectoryItem(definition),
      authorizationBinding: {
        authorizationLevel: definition.workIdentity.authorizationLevel,
        capabilities: definition.workIdentity.capabilities,
        positionName: definition.workIdentity.positionName,
        source: "authoritative_membership",
        mutable: false,
      },
      scopeBindings: {
        organizationId: definition.workIdentity.organizationId,
        organizationName: definition.workIdentity.organizationName,
        cityScopes: definition.workIdentity.cityScopes,
      },
      allowedActions: allowedMembershipActions(
        session,
        definition,
        this.membershipStates.get(membershipId) ?? "active",
      ),
      auditTrail: [...(this.membershipAuditTrails.get(membershipId) ?? [])],
      capabilityBoundary: {
        realAccountAvailable: false,
        roleMutationAvailable: false,
        invitationAvailable: false,
        directPermissionBindingAvailable: false,
      },
      synthetic: true,
    };
  }

  private membershipDirectoryItem(
    definition: SyntheticMembershipDefinition,
  ): AdminMembershipDirectoryItem {
    return {
      membershipId: definition.membershipId,
      internalUserId: definition.internalUserId,
      workIdentityId: definition.workIdentity.workIdentityId,
      displayName: definition.displayName,
      workEmailMasked: definition.workEmailMasked,
      organizationType: definition.workIdentity.type,
      organizationId: definition.workIdentity.organizationId,
      organizationName: definition.workIdentity.organizationName,
      authorizationLevel: definition.workIdentity.authorizationLevel,
      capabilities: definition.workIdentity.capabilities,
      positionName: definition.workIdentity.positionName,
      state: this.membershipStates.get(definition.membershipId) ?? "active",
      activeSessionCount: this.activeSessionCount(
        definition.workIdentity.workIdentityId,
      ),
      resourceVersion: this.membershipVersions.get(definition.membershipId) ?? 1,
      updatedAt:
        this.membershipUpdatedAt.get(definition.membershipId) ??
        this.now().toISOString(),
      synthetic: true,
    };
  }

  private requireVisibleMembership(
    session: SessionRecord,
    membershipId: string,
  ): SyntheticMembershipDefinition {
    const definition = this.membershipDefinitions.get(membershipId);
    if (!definition || !this.membershipVisibleTo(session, definition)) {
      throw new Error("ADMIN_MEMBERSHIP_NOT_FOUND");
    }
    return definition;
  }

  private membershipVisibleTo(
    session: SessionRecord,
    definition: SyntheticMembershipDefinition,
  ): boolean {
    return (
      session.workIdentity.type === "platform" ||
      definition.workIdentity.organizationId ===
        session.workIdentity.organizationId
    );
  }

  private activeSessionCount(workIdentityId: string): number {
    return [...new Set(this.sessionsByAccess.values())].filter(
      (record) =>
        !record.revoked &&
        record.workIdentity.workIdentityId === workIdentityId,
    ).length;
  }

  private revokeSessionsForWorkIdentity(workIdentityId: string): void {
    for (const record of new Set(this.sessionsByAccess.values())) {
      if (record.workIdentity.workIdentityId === workIdentityId) {
        record.revoked = true;
      }
    }
  }

  private isWorkIdentityActive(identity: AdminWorkIdentitySummary): boolean {
    const membership = [...this.membershipDefinitions.values()].find(
      (definition) =>
        definition.workIdentity.workIdentityId === identity.workIdentityId,
    );
    return (
      !membership ||
      (this.membershipStates.get(membership.membershipId) ?? "active") ===
        "active"
    );
  }

  private dataReportDetailFor(
    session: SessionRecord,
    reportId: string,
    adminAccess: AdminAccessService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
    auditView: boolean,
  ): AdminDataReportDetail {
    const definition = dataReportDefinitions.find(
      (candidate) => candidate.reportId === reportId,
    );
    if (!definition) throw new Error("ADMIN_DATA_REPORT_NOT_FOUND");
    const item = this.dataReportDirectoryItem(
      session,
      reportId,
      adminAccess,
      requestContext,
    );
    if (auditView) {
      const viewKey = `${session.workIdentity.workIdentityId}:${reportId}`;
      const now = this.now().getTime();
      if (now - (this.dataReportViewAuditedAt.get(viewKey) ?? 0) >= 1_000) {
        const trail = this.dataReportAuditTrails.get(reportId) ?? [];
        trail.push({
          eventId: token("data-report-view"),
          action: "data_report_viewed",
          actorLabel: session.workIdentity.organizationName,
          actorRole: session.workIdentity.positionName,
          occurredAt: new Date(now).toISOString(),
        });
        this.dataReportAuditTrails.set(reportId, trail);
        this.dataReportViewAuditedAt.set(viewKey, now);
        adminAccess.recordAuditSystemEvent(actorFor(session, requestContext), {
          eventType: "data_report_viewed",
          action: "view_report",
          resourceType: "data_report",
          resourceId: reportId,
        });
      }
    }
    return {
      item,
      metrics: this.dataReportMetrics(
        session,
        definition.domain,
        adminAccess,
        requestContext,
      ),
      allowedActions: allowedDataReportActions(
        definition.domain,
        session.workIdentity,
      ),
      auditTrail: [...(this.dataReportAuditTrails.get(reportId) ?? [])],
      sourceBoundary: {
        aggregateOnly: true,
        personLevelDataAvailable: false,
        realDataAvailable: false,
        exportAvailable: false,
      },
      synthetic: true,
    };
  }

  private dataReportDirectoryItem(
    session: SessionRecord,
    reportId: string,
    adminAccess: AdminAccessService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): AdminDataReportDirectoryItem {
    const definition = dataReportDefinitions.find(
      (candidate) => candidate.reportId === reportId,
    );
    if (!definition) throw new Error("ADMIN_DATA_REPORT_NOT_FOUND");
    const metrics = this.dataReportMetrics(
      session,
      definition.domain,
      adminAccess,
      requestContext,
    );
    const state = metrics.some((metric) => metric.state === "unavailable")
      ? "partial"
      : "ready";
    return {
      reportId,
      domain: definition.domain,
      title: definition.title,
      summary: definition.summary,
      state,
      organizationId: session.workIdentity.organizationId,
      organizationName: session.workIdentity.organizationName,
      metricCount: metrics.length,
      resourceVersion: this.dataReportVersions.get(reportId) ?? 1,
      refreshedAt:
        this.dataReportRefreshedAt.get(reportId) ?? this.now().toISOString(),
      synthetic: true,
    };
  }

  private dataReportMetrics(
    session: SessionRecord,
    domain: AdminDataReportDomain,
    adminAccess: AdminAccessService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
  ): readonly AdminDataReportMetric[] {
    const asOf = this.now().toISOString();
    const visibleTasks = this.tasks.filter(
      (task) =>
        session.workIdentity.type === "platform" ||
        task.operatorName === session.workIdentity.organizationName,
    );
    const events = this.visibleAuditEvents(
      session,
      adminAccess.listAuditEvents(actorFor(session, requestContext)),
    );
    if (domain === "operations") {
      return [
        reportMetric("operations_total_tasks", "范围内任务", visibleTasks.length, asOf, "operations_task_store"),
        reportMetric("operations_open_tasks", "未完成任务", visibleTasks.filter((task) => task.status !== "completed").length, asOf, "operations_task_store"),
        reportMetric("operations_blocked_tasks", "受阻任务", visibleTasks.filter((task) => task.status === "blocked").length, asOf, "operations_task_store"),
      ];
    }
    const domainEvents = events.filter((event) =>
      domain === "finance"
        ? event.eventType.startsWith("finance_")
        : domain === "safety_compliance"
          ? event.eventType.startsWith("safety_") ||
            event.eventType.startsWith("support_") ||
            event.eventType.startsWith("evidence_")
          : true,
    );
    return [
      reportMetric(`${domain}_event_count`, "审计事件数", domainEvents.length, asOf, "admin_audit_event_store"),
      reportMetric(`${domain}_denied_count`, "拒绝结果", domainEvents.filter((event) => event.result === "denied").length, asOf, "admin_audit_event_store"),
      reportMetric(`${domain}_organization_count`, "涉及组织", new Set(domainEvents.map((event) => event.organizationId)).size, asOf, "admin_audit_event_store"),
    ];
  }

  private auditDetailFor(
    session: SessionRecord,
    kind: AdminAuditResourceKind,
    resourceId: string,
    adminAccess: AdminAccessService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
    auditView: boolean,
  ): AdminAuditDetail {
    const actor = actorFor(session, requestContext);
    const events = this.visibleAuditEvents(
      session,
      adminAccess.listAuditEvents(actor),
    );
    let detail: AdminAuditDetail;
    if (kind === "event") {
      const eventIndex = events.findIndex((event) => event.eventId === resourceId);
      if (eventIndex < 0) throw new Error("ADMIN_AUDIT_RESOURCE_NOT_FOUND");
      const event = events[eventIndex]!;
      const linkedInvestigation = [...this.auditInvestigations.values()].find(
        (investigation) => investigation.sourceEventId === event.eventId,
      );
      const item = auditEventDirectoryItem(event);
      detail = {
        kind,
        item,
        record: {
          event,
          ...(linkedInvestigation
            ? { linkedInvestigationId: linkedInvestigation.investigationId }
            : {}),
        },
        allowedActions:
          hasCapability(session.workIdentity, "technical_recovery") &&
          !linkedInvestigation
            ? ["open_investigation"]
            : [],
        auditTrail: [
          ...(this.auditTrails.get(auditTrailKey(kind, resourceId)) ?? []),
        ],
        integrity: {
          canonicalPayloadDigest: digest(JSON.stringify(event)),
          ...(eventIndex > 0
            ? {
                previousEventDigest: digest(
                  JSON.stringify(events[eventIndex - 1]),
                ),
              }
            : {}),
          appendOnly: true,
          rawSensitivePayloadAvailable: false,
        },
        synthetic: true,
      };
    } else if (kind === "investigation") {
      const investigation = this.auditInvestigations.get(resourceId);
      if (
        !investigation ||
        (session.workIdentity.type === "operator" &&
          investigation.organizationId !== session.workIdentity.organizationId)
      ) {
        throw new Error("ADMIN_AUDIT_RESOURCE_NOT_FOUND");
      }
      detail = {
        kind,
        item: auditInvestigationDirectoryItem(investigation),
        record: investigation,
        allowedActions: allowedAuditInvestigationActionsFor(
          investigation,
          session.workIdentity,
        ),
        auditTrail: [
          ...(this.auditTrails.get(auditTrailKey(kind, resourceId)) ?? []),
        ],
        integrity: {
          canonicalPayloadDigest: digest(JSON.stringify(investigation)),
          appendOnly: true,
          rawSensitivePayloadAvailable: false,
        },
        synthetic: true,
      };
    } else {
      const approval = this.highRiskApprovalRecords.get(resourceId);
      if (
        !approval ||
        (session.workIdentity.type === "operator" &&
          approval.organizationId !== session.workIdentity.organizationId)
      ) {
        throw new Error("ADMIN_AUDIT_RESOURCE_NOT_FOUND");
      }
      detail = {
        kind,
        item: auditApprovalDirectoryItem(approval),
        record: approval,
        allowedActions: [],
        auditTrail: [
          ...(this.auditTrails.get(auditTrailKey(kind, resourceId)) ?? []),
        ],
        integrity: {
          canonicalPayloadDigest: digest(JSON.stringify(approval)),
          appendOnly: true,
          rawSensitivePayloadAvailable: false,
        },
        synthetic: true,
      };
    }
    if (auditView) {
      const viewKey =
        `${session.workIdentity.workIdentityId}:${kind}:${resourceId}`;
      const now = this.now().getTime();
      if (now - (this.auditViewAuditedAt.get(viewKey) ?? 0) >= 1_000) {
        const trailKey = auditTrailKey(kind, resourceId);
        const trail = this.auditTrails.get(trailKey) ?? [];
        trail.push({
          eventId: token("audit-view"),
          action: "audit_resource_viewed",
          actorLabel: session.workIdentity.organizationName,
          actorRole: session.workIdentity.positionName,
          occurredAt: new Date(now).toISOString(),
        });
        this.auditTrails.set(trailKey, trail);
        this.auditViewAuditedAt.set(viewKey, now);
        adminAccess.recordAuditSystemEvent(actor, {
          eventType: "audit_event_viewed",
          action: "audit_resource_viewed",
          resourceType: `audit_${kind}`,
          resourceId,
        });
        detail = {
          ...detail,
          auditTrail: [...trail],
        } as AdminAuditDetail;
      }
    }
    return detail;
  }

  private visibleAuditEvents(
    session: SessionRecord,
    events: readonly AdminAuditEvent[],
  ): readonly AdminAuditEvent[] {
    return events.filter(
      (event) =>
        session.workIdentity.type === "platform" ||
        event.organizationId === session.workIdentity.organizationId,
    );
  }

  private visibleFleetRecords(
    session: SessionRecord,
  ): readonly SyntheticFleetDirectoryRecord[] {
    return syntheticFleetDirectory.filter((record) =>
      session.workIdentity.type === "platform" ||
      record.operatorId === session.workIdentity.organizationId
    );
  }

  private requireVisibleFleetRecord(
    session: SessionRecord,
    kind: "driver" | "vehicle",
    resourceId: string,
  ): SyntheticFleetDirectoryRecord {
    const record = this.visibleFleetRecords(session).find((candidate) =>
      kind === "driver"
        ? candidate.driverAccountId === resourceId
        : candidate.vehicleId === resourceId
    );
    if (!record) throw new Error("ADMIN_FLEET_RESOURCE_NOT_FOUND");
    return record;
  }

  private paginateFleetRows<TRow>(
    rows: readonly TRow[],
    pageSize: number,
    after: string | undefined,
    before: string | undefined,
    queryDigest: string,
    scopeDigest: string,
  ): Readonly<{
    items: readonly TRow[];
    pageInfo: AdminDriverDirectoryPage["pageInfo"];
  }> {
    let start = 0;
    if (after) {
      const cursor = this.readCursor(after, queryDigest, scopeDigest);
      start = cursor.offset + 1;
    }
    if (before) {
      const cursor = this.readCursor(before, queryDigest, scopeDigest);
      start = Math.max(0, cursor.offset - pageSize);
    }
    const items = rows.slice(start, start + pageSize);
    const end = start + items.length - 1;
    return {
      items,
      pageInfo: {
        hasNextPage: end + 1 < rows.length,
        hasPreviousPage: start > 0,
        startCursor: items.length > 0
          ? this.signCursor(start, queryDigest, scopeDigest)
          : null,
        endCursor: items.length > 0
          ? this.signCursor(end, queryDigest, scopeDigest)
          : null,
        approximateTotal: rows.length,
      },
    };
  }

  private async vehicleDetailFor(
    session: SessionRecord,
    record: SyntheticFleetDirectoryRecord,
    operatorManagement: AdminOperatorManagementService,
    adminReviews: AdminReviewTaskService,
    requestContext: Readonly<{ correlationId: string; requestId: string }>,
    auditView: boolean,
  ): Promise<AdminVehicleDetail> {
    const state = this.vehicleReviewStates.get(record.vehicleId)!;
    const rawProfile = operatorManagement.getVehicle360(
      actorFor(session, requestContext),
      record.vehicleId,
    );
    const profile = {
      ...rawProfile,
      review: {
        ...rawProfile.review,
        state: state.state,
        resourceVersion: state.version,
      },
    };
    let reviewTask: AdminReviewTaskDetail | undefined;
    let auditTrail: AdminVehicleDetail["auditTrail"] = [];
    if (record.reviewTaskId) {
      const auditKey =
        `${session.workIdentity.workIdentityId}:${record.reviewTaskId}`;
      const lastAuditedAt = this.vehicleViewAuditedAt.get(auditKey) ?? 0;
      if (auditView && this.now().getTime() - lastAuditedAt >= 1_000) {
        reviewTask = await adminReviews.viewTaskSnapshot(
          record.reviewTaskId,
          session.workIdentity.workIdentityId,
        );
        this.vehicleViewAuditedAt.set(auditKey, this.now().getTime());
      } else {
        reviewTask = await adminReviews.getTaskSnapshot(record.reviewTaskId);
      }
      auditTrail = [...await adminReviews.listAudit(record.reviewTaskId)];
    }
    const actionSummary = reviewTask
      ? vehicleActionSummaryFor(
          reviewTask,
          session.workIdentity,
          session.workIdentity.workIdentityId,
        )
      : vehicleActionSummaryWithoutTask(session.workIdentity);
    return {
      vehicle: vehicleDirectoryItemFor(record, state, reviewTask),
      profile,
      driver: driverDirectoryItemFor(record, reviewTask),
      organizationScope: organizationScopeFor(session),
      ...(reviewTask ? { reviewTask } : {}),
      ...actionSummary,
      auditTrail,
      synthetic: true,
    };
  }

  private requireVisibleTask(
    session: SessionRecord,
    taskId: string,
  ): AdminOperationsTask {
    const task = this.tasks.find((candidate) => candidate.taskId === taskId);
    if (
      !task ||
      (session.workIdentity.type === "operator" &&
        task.operatorName !== session.workIdentity.organizationName)
    ) {
      throw new Error("ADMIN_OPERATIONS_TASK_NOT_FOUND");
    }
    return task;
  }

  private operationsTaskDetail(
    session: SessionRecord,
    task: AdminOperationsTask,
  ): AdminOperationsTaskDetail {
    const actionSummary = operationsTaskActionSummaryFor(
      task,
      session.workIdentity,
    );
    return {
      task,
      organizationScope: {
        organizationId: session.workIdentity.organizationId,
        organizationName: session.workIdentity.organizationName,
        cityScopes: session.workIdentity.cityScopes,
      },
      ...actionSummary,
      auditTrail: [...(this.taskAuditTrails.get(task.taskId) ?? [])],
      synthetic: true,
    };
  }

  private authenticate(accessToken: string): SessionRecord {
    this.assertRoleMatrixEnabled();
    const record = this.sessionsByAccess.get(accessToken);
    const now = this.now().getTime();
    if (
      !record ||
      record.revoked ||
      record.accessExpiresAt <= now ||
      record.absoluteExpiresAt <= now ||
      record.lastUsedAt +
          this.securityPolicy.adminIdleSessionTtlSeconds * 1000 <=
        now ||
      !this.isWorkIdentityActive(record.workIdentity)
    ) {
      throw new Error("SESSION_EXPIRED");
    }
    record.lastUsedAt = now;
    return record;
  }

  private assertRefreshable(record: SessionRecord): void {
    const now = this.now().getTime();
    if (
      record.revoked ||
      record.absoluteExpiresAt <= now ||
      record.lastUsedAt +
          this.securityPolicy.adminIdleSessionTtlSeconds * 1000 <=
        now
    ) {
      throw new Error("REFRESH_SESSION_EXPIRED");
    }
  }

  private issueSession(
    identity: AdminWorkIdentitySummary,
    accountEmail: string,
    mfaVerifiedAt = this.now().getTime(),
  ): AdminProductSession {
    const now = this.now().getTime();
    const record: SessionRecord = {
      accountEmail,
      sessionFamilyId: token("session-family"),
      accessToken: token("admin-access"),
      refreshToken: token("admin-refresh"),
      usedRefreshTokens: new Set(),
      workIdentity: identity,
      createdAt: now,
      lastUsedAt: now,
      accessExpiresAt:
        now + this.securityPolicy.adminAccessSessionTtlSeconds * 1000,
      absoluteExpiresAt:
        now + this.securityPolicy.adminAbsoluteSessionTtlSeconds * 1000,
      mfaVerifiedAt,
      revoked: false,
    };
    this.sessionsByAccess.set(record.accessToken, record);
    this.sessionsByRefresh.set(record.refreshToken, record);
    return this.toSession(record);
  }

  private toSession(record: SessionRecord): AdminProductSession {
    return {
      accessToken: record.accessToken,
      refreshToken: record.refreshToken,
      sessionFamilyId: record.sessionFamilyId,
      workIdentity: record.workIdentity,
      navigation: this.navigationFor(record),
      accessTokenExpiresAt: new Date(record.accessExpiresAt).toISOString(),
      absoluteExpiresAt: new Date(record.absoluteExpiresAt).toISOString(),
      idleExpiresAt: new Date(
        record.lastUsedAt +
          this.securityPolicy.adminIdleSessionTtlSeconds * 1000,
      ).toISOString(),
      synthetic: true,
    };
  }

  private navigationFor(record: SessionRecord): AdminNavigationManifest {
    const domains = domainsFor(record.workIdentity);
    return {
      navigationVersion: "2026-07-30.1",
      workIdentityId: record.workIdentity.workIdentityId,
      organizationContext: {
        organizationType: record.workIdentity.type,
        organizationId: record.workIdentity.organizationId,
        organizationName: record.workIdentity.organizationName,
        cityScopes: record.workIdentity.cityScopes,
        operatorScopes:
          record.workIdentity.type === "platform"
            ? ["operator-huhang", "operator-shencheng", "operator-haiwan"]
            : [record.workIdentity.organizationId],
        purpose:
          record.workIdentity.type === "platform"
            ? "platform_operations"
            : "operator_operations",
        fixed: record.workIdentity.type === "operator",
      },
      authorizationLevel: record.workIdentity.authorizationLevel,
      capabilities: record.workIdentity.capabilities,
      items: domains.map((domain) => {
        const definition = domainDefinition[domain];
        if (
          domain === "operator_management" &&
          this.operatorManagementEnabled
        ) {
          const { unavailableReason: _unavailableReason, ...available } =
            definition;
          return {
            ...available,
            availability: "available" as const,
          };
        }
        if (
          domain === "driver_vehicle" &&
          this.driverVehicleEnabled
        ) {
          const { unavailableReason: _unavailableReason, ...available } =
            definition;
          return {
            ...available,
            availability: "available" as const,
          };
        }
        if (
          domain === "trip_operations" &&
          this.tripOperationsEnabled
        ) {
          const { unavailableReason: _unavailableReason, ...available } =
            definition;
          return {
            ...available,
            availability: "available" as const,
          };
        }
        if (
          domain === "support_safety" &&
          this.tripOperationsEnabled &&
          this.caseManagementEnabled
        ) {
          const { unavailableReason: _unavailableReason, ...available } =
            definition;
          return {
            ...available,
            availability: "available" as const,
          };
        }
        if (
          domain === "finance_operations" &&
          this.financeOperationsEnabled
        ) {
          const { unavailableReason: _unavailableReason, ...available } =
            definition;
          return {
            ...available,
            availability: "available" as const,
          };
        }
        if (
          domain === "executive_dashboard" &&
          this.executiveDashboardEnabled
        ) {
          const { unavailableReason: _unavailableReason, ...available } =
            definition;
          return {
            ...available,
            availability: "available" as const,
          };
        }
        if (domain === "audit_system" && this.auditSystemEnabled) {
          const { unavailableReason: _unavailableReason, ...available } =
            definition;
          return {
            ...available,
            availability: "available" as const,
          };
        }
        if (domain === "data_reports" && this.dataReportsEnabled) {
          const { unavailableReason: _unavailableReason, ...available } =
            definition;
          return {
            ...available,
            availability: "available" as const,
          };
        }
        if (
          domain === "organization_accounts" &&
          this.organizationAccountsEnabled
        ) {
          const { unavailableReason: _unavailableReason, ...available } =
            definition;
          return {
            ...available,
            availability: "available" as const,
          };
        }
        return definition;
      }),
      routePermissions: domains.map((domain) => `${domain}:read`),
      operationPermissions: operationPermissions(record.workIdentity),
      fieldProfiles: [record.workIdentity.maximumDataClassification],
      exportProfiles: exportProfiles(record.workIdentity),
      scopeDigest: digest(
        `${record.workIdentity.type}:${record.workIdentity.organizationId}`,
      ),
      expiresAt: new Date(record.absoluteExpiresAt).toISOString(),
      synthetic: true,
    };
  }

  private revokeOldestIfNeeded(email: string): void {
    const identityIds = new Set(
      this.accounts.get(email)?.workIdentities.map((identity) => identity.workIdentityId),
    );
    const active = [...new Set(this.sessionsByAccess.values())]
      .filter(
        (session) =>
          !session.revoked && identityIds.has(session.workIdentity.workIdentityId),
      )
      .sort((left, right) => left.createdAt - right.createdAt);
    if (active.length >= 3) active[0]!.revoked = true;
  }

  private signCursor(
    offset: number,
    queryDigest: string,
    scopeDigest: string,
  ): string {
    const payload = Buffer.from(
      JSON.stringify({ offset, queryDigest, scopeDigest }),
    ).toString("base64url");
    const signature = createHmac("sha256", this.cursorSecret)
      .update(payload)
      .digest("base64url");
    return `${payload}.${signature}`;
  }

  private readCursor(
    value: string,
    queryDigest: string,
    scopeDigest: string,
  ): Readonly<{ offset: number }> {
    const [payload, signature] = value.split(".");
    if (!payload || !signature) throw new Error("ADMIN_CURSOR_INVALID");
    const expected = createHmac("sha256", this.cursorSecret)
      .update(payload)
      .digest("base64url");
    if (!safelyCompareAdminCredentials(expected, signature)) {
      throw new Error("ADMIN_CURSOR_INVALID");
    }
    try {
      const parsed = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      ) as { offset?: unknown; queryDigest?: unknown; scopeDigest?: unknown };
      if (
        !Number.isInteger(parsed.offset) ||
        Number(parsed.offset) < 0 ||
        parsed.queryDigest !== queryDigest ||
        parsed.scopeDigest !== scopeDigest
      ) {
        throw new Error("ADMIN_CURSOR_SCOPE_MISMATCH");
      }
      return { offset: Number(parsed.offset) };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "ADMIN_CURSOR_SCOPE_MISMATCH"
      ) {
        throw error;
      }
      throw new Error("ADMIN_CURSOR_INVALID");
    }
  }

  private assertAuthenticationEnabled(): void {
    if (!this.authenticationEnabled) throw new Error("FEATURE_DISABLED");
  }

  private assertRoleMatrixEnabled(): void {
    this.assertAuthenticationEnabled();
    if (!this.roleMatrixEnabled) throw new Error("FEATURE_DISABLED");
  }

  private assertTripOperationsEnabled(): void {
    if (!this.tripOperationsEnabled) throw new Error("FEATURE_DISABLED");
  }

  private assertCaseManagementEnabled(): void {
    if (!this.caseManagementEnabled) throw new Error("FEATURE_DISABLED");
  }

  private assertFinanceOperationsEnabled(): void {
    if (!this.financeOperationsEnabled) throw new Error("FEATURE_DISABLED");
  }

  private assertExecutiveDashboardEnabled(): void {
    if (!this.executiveDashboardEnabled) throw new Error("FEATURE_DISABLED");
  }

  private assertAuditSystemEnabled(): void {
    if (!this.auditSystemEnabled) throw new Error("FEATURE_DISABLED");
  }

  private assertDataReportsEnabled(): void {
    if (!this.dataReportsEnabled) throw new Error("FEATURE_DISABLED");
  }

  private assertOrganizationAccountsEnabled(): void {
    if (!this.organizationAccountsEnabled) throw new Error("FEATURE_DISABLED");
  }

  private assertDomainRead(
    session: SessionRecord,
    domain: AdminNavigationDomain,
  ): void {
    if (!domainsFor(session.workIdentity).includes(domain)) {
      throw new Error("AUTHORIZATION_DENIED");
    }
  }
}

function item(
  id: AdminNavigationDomain,
  label: string,
  route: string,
  children: readonly (readonly [string, string, string])[],
): AdminNavigationItem {
  return {
    id,
    label,
    route,
    availability: id === "workbench" ? "available" : "unavailable",
    ...(id === "workbench" ? {} : { unavailableReason: "not_implemented" as const }),
    children: children.map(([childId, childLabel, childRoute]) => ({
      id: childId,
      label: childLabel,
      route: childRoute,
    })),
  };
}

function createAccounts(): readonly AccountFixture[] {
  const platformOperations = identity(
    "synthetic-platform-ops-001",
    "platform",
    "platform-pollycar",
    "PollyCar 平台",
    "level_2",
    [
      "operations_task",
      "operator_governance",
      "fleet_operation",
      "trip_operation",
      "analytics_read",
      "executive_read",
    ],
    "平台运营负责人",
    "sensitive",
  );
  const operatorOperations = identity(
    "synthetic-operator-ops-001",
    "operator",
    "operator-huhang",
    "沪行出行服务",
    "level_2",
    [
      "operations_task",
      "operator_governance",
      "fleet_operation",
      "trip_operation",
      "analytics_read",
    ],
    "运营公司运营负责人",
    "sensitive",
  );
  return [
    account("access.admin@rego.example", [
      identity("synthetic-platform-access-admin-001", "platform", "platform-pollycar", "PollyCar 平台", "level_3", ["membership_governance"], "平台账号管理员", "restricted"),
    ]),
    account("operator.admin@rego.example", [
      identity("synthetic-operator-account-admin-001", "operator", "operator-huhang", "沪行出行服务", "level_2", ["membership_governance"], "运营公司账号管理员", "restricted"),
    ]),
    account("ops@rego.example", [
      platformOperations,
      identity("synthetic-operations-officer-001", "platform", "platform-pollycar", "PollyCar 平台", "level_1", ["operations_task", "operator_governance", "fleet_operation", "trip_operation", "analytics_read"], "平台运营专员", "sensitive"),
      identity("synthetic-operator-management-officer-001", "platform", "platform-pollycar", "PollyCar 平台", "level_2", ["operator_governance", "fleet_operation"], "运营公司管理专员", "sensitive"),
    ]),
    account("lin.yun@rego.example", [platformOperations, operatorOperations]),
    account("finance@rego.example", [
      identity("synthetic-finance-officer-001", "platform", "platform-pollycar", "PollyCar 平台", "level_1", ["finance_operation"], "平台财务经办", "restricted"),
      identity("synthetic-finance-lead-001", "platform", "platform-pollycar", "PollyCar 平台", "level_2", ["finance_operation", "finance_review", "analytics_read", "executive_read"], "平台财务负责人", "restricted"),
      identity("synthetic-operator-finance-officer-001", "operator", "operator-huhang", "沪行出行服务", "level_1", ["finance_operation"], "运营公司财务经办", "restricted"),
      identity("synthetic-operator-finance-lead-001", "operator", "operator-huhang", "沪行出行服务", "level_2", ["finance_operation", "finance_review", "analytics_read"], "运营公司财务负责人", "restricted"),
    ]),
    account("support@rego.example", [
      identity("synthetic-support-001", "platform", "platform-pollycar", "PollyCar 平台", "level_1", ["operations_task", "trip_operation", "support_case"], "平台客服", "sensitive"),
      identity("synthetic-support-lead-001", "platform", "platform-pollycar", "PollyCar 平台", "level_2", ["operations_task", "trip_operation", "support_case", "analytics_read"], "平台客服负责人", "sensitive"),
      identity("synthetic-operator-support-001", "operator", "operator-huhang", "沪行出行服务", "level_1", ["operations_task", "trip_operation", "support_case"], "运营公司客服", "sensitive"),
    ]),
    account("review@rego.example", [
      identity("synthetic-reviewer-001", "platform", "platform-pollycar", "PollyCar 平台", "level_1", ["fleet_review"], "车辆审核员", "restricted"),
      identity("synthetic-senior-reviewer-001", "platform", "platform-pollycar", "PollyCar 平台", "level_2", ["operator_governance", "fleet_review"], "高级车辆审核员", "restricted"),
    ]),
    account("fleet@rego.example", [
      identity("synthetic-operator-fleet-001", "operator", "operator-huhang", "沪行出行服务", "level_1", ["fleet_operation"], "运营公司运力专员", "sensitive"),
    ]),
    account("safety@rego.example", [
      identity("synthetic-safety-officer-001", "platform", "platform-pollycar", "PollyCar 平台", "level_1", ["safety_investigation"], "平台安全专员", "restricted"),
      identity("synthetic-safety-lead-001", "platform", "platform-pollycar", "PollyCar 平台", "level_2", ["safety_investigation", "safety_restoration_review", "analytics_read", "executive_read"], "平台安全负责人", "restricted"),
      identity("synthetic-operator-safety-liaison-001", "operator", "operator-huhang", "沪行出行服务", "level_1", ["safety_investigation"], "运营公司安全联络人", "sensitive"),
    ]),
    account("audit@rego.example", [
      identity("synthetic-auditor-001", "platform", "platform-pollycar", "PollyCar 平台", "level_3", ["audit_read"], "平台审计", "restricted"),
      identity("synthetic-operator-auditor-001", "operator", "operator-huhang", "沪行出行服务", "level_2", ["audit_read"], "运营公司审计", "restricted"),
    ]),
    account("technical@rego.example", [
      identity("synthetic-technical-ops-001", "platform", "platform-pollycar", "PollyCar 平台", "level_3", ["technical_recovery"], "平台技术运维", "restricted"),
    ]),
    account("analytics@rego.example", [
      identity("synthetic-data-analyst-001", "platform", "platform-pollycar", "PollyCar 平台", "level_1", ["analytics_read"], "数据分析人员", "sensitive"),
    ]),
    account("executive@rego.example", [
      identity("synthetic-executive-sponsor-001", "platform", "platform-pollycar", "PollyCar 平台", "level_3", ["executive_read"], "项目决策人", "sensitive"),
      identity("synthetic-operator-executive-001", "operator", "operator-huhang", "沪行出行服务", "level_2", ["executive_read"], "运营主体负责人", "sensitive"),
    ]),
    account("governance@rego.example", [
      identity("synthetic-privacy-compliance-001", "platform", "platform-pollycar", "PollyCar 平台", "level_3", ["privacy_governance"], "隐私合规负责人", "restricted"),
    ]),
    account("new.admin@rego.example", [
      identity("synthetic-platform-ops-001", "platform", "platform-pollycar", "PollyCar 平台", "level_3", ["membership_governance"], "平台账号管理员", "sensitive"),
    ], false),
  ];
}

function account(
  email: string,
  workIdentities: readonly AdminWorkIdentitySummary[],
  active = true,
): AccountFixture {
  return {
    email,
    password: SYNTHETIC_PASSWORD,
    active,
    failedCount: 0,
    workIdentities,
  };
}

function identity(
  workIdentityId: string,
  type: "platform" | "operator",
  organizationId: string,
  organizationName: string,
  authorizationLevel: AdminAuthorizationLevel,
  capabilities: readonly AdminBusinessCapability[],
  positionName: string,
  maximumDataClassification: AdminWorkIdentitySummary["maximumDataClassification"],
): AdminWorkIdentitySummary {
  if (type === "operator" && authorizationLevel === "level_3") {
    throw new Error("ADMIN_OPERATOR_LEVEL_3_FORBIDDEN");
  }
  return {
    workIdentityId,
    legacyAccessToken: workIdentityId,
    type,
    organizationId,
    organizationName,
    authorizationLevel,
    capabilities,
    positionName,
    cityScopes: ["上海"],
    maximumDataClassification,
    synthetic: true,
  };
}

function createTasks(): AdminOperationsTask[] {
  const operators = ["沪行出行服务", "申城伙伴运营", "海湾城市服务"];
  const domains: readonly AdminOperationsTask["domain"][] = [
    "operator",
    "driver_vehicle",
    "trip",
    "support_safety",
  ];
  const statuses: readonly AdminOperationsTask["status"][] = [
    "unassigned",
    "processing",
    "waiting_review",
    "blocked",
  ];
  return Array.from({ length: 72 }, (_, index) => ({
    taskId: `OPS-${String(index + 1).padStart(4, "0")}`,
    title: `${["主体资料复核", "车辆资格跟进", "行程异常协作", "客服案件回访"][index % 4]} ${index + 1}`,
    operatorName: operators[index % operators.length]!,
    domain: domains[index % domains.length]!,
    assigneeName: index % 5 === 0 ? "待分派" : ["林岚", "周宁", "顾言"][index % 3]!,
    dueAt: new Date(Date.UTC(2026, 6, 15 + (index % 12), 9 + (index % 8))).toISOString(),
    status: statuses[index % statuses.length]!,
    priority: index % 9 === 0 ? "high" : index % 4 === 0 ? "attention" : "normal",
    version: 1,
    updatedAt: new Date(
      Date.UTC(2026, 6, 14 + (index % 12), 8 + (index % 8)),
    ).toISOString(),
    synthetic: true,
  }));
}

function allowedActionsFor(
  task: AdminOperationsTask,
  identity: AdminWorkIdentitySummary,
): readonly AdminOperationsTaskAction[] {
  const permissions = operationPermissions(identity);
  const action = ({
    unassigned: "assign",
    processing: "process",
    blocked: "process",
    waiting_review: "review",
    completed: undefined,
  } as const)[task.status];
  return action && permissions.includes(action) ? [action] : [];
}

function operationsTaskActionSummaryFor(
  task: AdminOperationsTask,
  identity: AdminWorkIdentitySummary,
): Readonly<{
  allowedActions: readonly AdminOperationsTaskAction[];
  actionBlockers: readonly AdminRecordActionBlocker[];
  nextSteps: readonly AdminRecordNextStep[];
}> {
  const allowedActions = allowedActionsFor(task, identity);
  if (allowedActions.length > 0) {
    return {
      allowedActions,
      actionBlockers: [],
      nextSteps: allowedActions.map((action) =>
        recordNextStep(
          "EXECUTE_ACTION",
          action === "assign"
            ? "分派任务"
            : action === "process"
              ? "继续处理任务"
              : "完成负责人复核",
          action,
        ),
      ),
    };
  }
  if (task.status === "completed") {
    return {
      allowedActions,
      actionBlockers: [
        recordActionBlocker(
          "process",
          "ALREADY_COMPLETED",
          "任务已经完成，不能再次处理。",
          recordNextStep("NONE", "查看处理记录"),
        ),
      ],
      nextSteps: [recordNextStep("NONE", "查看处理记录")],
    };
  }
  const expectedAction = ({
    unassigned: "assign",
    processing: "process",
    blocked: "process",
    waiting_review: "review",
  } as const)[task.status];
  if (!hasCapability(identity, "operations_task")) {
    const nextStep = recordNextStep("CONTACT_OWNER", "联系任务负责人");
    return {
      allowedActions,
      actionBlockers: [
        recordActionBlocker(
          expectedAction,
          "NO_CAPABILITY",
          "当前工作身份没有运营任务处理能力。",
          nextStep,
        ),
      ],
      nextSteps: [nextStep],
    };
  }
  const nextStep =
    task.status === "waiting_review"
      ? recordNextStep("SUBMIT_REVIEW", "等待运营负责人复核")
      : task.status === "unassigned"
        ? recordNextStep("WAIT", "等待运营负责人分派")
        : recordNextStep("WAIT", "等待任务执行员处理");
  return {
    allowedActions,
    actionBlockers: [
      recordActionBlocker(
        expectedAction,
        "REQUIRES_REVIEW",
        task.status === "waiting_review"
          ? "该任务需要运营负责人完成复核。"
          : task.status === "unassigned"
            ? "该任务需要运营负责人先行分派。"
            : "该任务当前由执行员继续处理。",
        nextStep,
      ),
    ],
    nextSteps: [nextStep],
  };
}

function allowedOperatorActionsFor(
  operator: AdminOperatorDirectoryItem,
  identity: AdminWorkIdentitySummary,
): readonly AdminOperatorAction[] {
  if (
    identity.type !== "platform" ||
    !hasCapability(identity, "operator_governance") ||
    !isAtLeast(identity, "level_2")
  ) {
    return [];
  }
  if (operator.lifecycleState === "active") return ["restrict"];
  if (operator.lifecycleState === "restricted") return ["reactivate"];
  return [];
}

function driverDirectoryItemFor(
  record: SyntheticFleetDirectoryRecord,
  task?: Readonly<{ status: AdminReviewTaskDetail["status"] }>,
): AdminDriverDirectoryItem {
  return {
    driverAccountId: record.driverAccountId,
    displayNameMasked: record.displayNameMasked,
    phoneMasked: record.phoneMasked,
    operatorId: record.operatorId,
    operatorName: record.operatorName,
    eligibilityState: record.eligibilityState,
    vehicleCount: 1,
    reviewAttentionCount:
      task && task.status !== "completed" ? 1 : 0,
    updatedAt: record.updatedAt,
    synthetic: true,
  };
}

function vehicleDirectoryItemFor(
  record: SyntheticFleetDirectoryRecord,
  review: Readonly<{
    state: AdminVehicleDirectoryItem["reviewState"];
    version: number;
    updatedAt: string;
  }>,
  task?: Readonly<{
    taskId?: string;
    status: AdminReviewTaskDetail["status"];
  }>,
): AdminVehicleDirectoryItem {
  return {
    vehicleId: record.vehicleId,
    plateMasked: record.plateMasked,
    vehicleSummary: record.vehicleSummary,
    driverAccountId: record.driverAccountId,
    driverNameMasked: record.displayNameMasked,
    operatorId: record.operatorId,
    operatorName: record.operatorName,
    reviewState: review.state,
    ...(record.reviewTaskId
      ? {
          reviewTaskId: record.reviewTaskId,
          ...(task ? { reviewTaskStatus: task.status } : {}),
        }
      : {}),
    resourceVersion: review.version,
    updatedAt: review.updatedAt,
    synthetic: true,
  };
}

function allowedVehicleActionsFor(
  task: AdminReviewTaskDetail,
  identity: AdminWorkIdentitySummary,
  workIdentityId: string,
): readonly AdminVehicleReviewAction[] {
  if (!hasCapability(identity, "fleet_review")) return [];
  if (["available", "released", "expired"].includes(task.status)) {
    return ["claim"];
  }
  if (
    task.status !== "in_progress" ||
    task.lease?.ownerId !== workIdentityId
  ) {
    return [];
  }
  const actions: AdminVehicleReviewAction[] = ["request_material"];
  if (!isAtLeast(identity, "level_2")) return actions;
  actions.push("reject");
  if (
    task.insuranceExpiryStatus === "complete" &&
    task.authorizationEvidenceStatus === "complete" &&
    task.attachmentValidationStatus === "valid"
  ) {
    actions.push("approve");
  }
  return actions;
}

function vehicleActionSummaryFor(
  task: AdminReviewTaskDetail,
  identity: AdminWorkIdentitySummary,
  workIdentityId: string,
): Readonly<{
  allowedActions: readonly AdminVehicleReviewAction[];
  actionBlockers: readonly AdminRecordActionBlocker[];
  nextSteps: readonly AdminRecordNextStep[];
}> {
  const allowedActions = allowedVehicleActionsFor(
    task,
    identity,
    workIdentityId,
  );
  const actionBlockers: AdminRecordActionBlocker[] = [];
  if (!hasCapability(identity, "fleet_review")) {
    const nextStep = recordNextStep("CONTACT_OWNER", "联系车辆审核负责人");
    actionBlockers.push(
      recordActionBlocker(
        "claim",
        "NO_CAPABILITY",
        "当前工作身份没有车辆审核能力。",
        nextStep,
      ),
    );
    return { allowedActions, actionBlockers, nextSteps: [nextStep] };
  }
  if (["completed", "cancelled"].includes(task.status)) {
    const nextStep = recordNextStep("NONE", "查看审核记录");
    actionBlockers.push(
      recordActionBlocker(
        "claim",
        "ALREADY_COMPLETED",
        "车辆审核任务已经结束。",
        nextStep,
      ),
    );
    return { allowedActions, actionBlockers, nextSteps: [nextStep] };
  }
  if (
    task.status === "in_progress" &&
    task.lease?.ownerId !== workIdentityId
  ) {
    const nextStep = recordNextStep("WAIT", "等待当前审核人释放任务");
    actionBlockers.push(
      recordActionBlocker(
        "request_material",
        "LEASE_NOT_OWNED",
        "该审核任务正在由其他审核人处理。",
        nextStep,
      ),
    );
    return { allowedActions, actionBlockers, nextSteps: [nextStep] };
  }
  if (
    task.status === "in_progress" &&
    task.lease?.ownerId === workIdentityId &&
    !isAtLeast(identity, "level_2")
  ) {
    const nextStep = recordNextStep(
      "SUBMIT_REVIEW",
      "完成材料处理后提交负责人复核",
    );
    actionBlockers.push(
      recordActionBlocker(
        "approve",
        "REQUIRES_REVIEW",
        "车辆最终通过需要运营负责人复核。",
        nextStep,
      ),
      recordActionBlocker(
        "reject",
        "REQUIRES_REVIEW",
        "车辆最终拒绝需要运营负责人复核。",
        nextStep,
      ),
    );
  }
  if (
    task.status === "in_progress" &&
    isAtLeast(identity, "level_2") &&
    !allowedActions.includes("approve")
  ) {
    const nextStep = recordNextStep(
      "REQUEST_MATERIAL",
      "先补齐车辆审核材料",
      "request_material",
    );
    actionBlockers.push(
      recordActionBlocker(
        "approve",
        "MISSING_MATERIAL",
        "车辆材料尚未满足通过条件。",
        nextStep,
      ),
    );
  }
  const nextSteps =
    allowedActions.length > 0
      ? allowedActions.map((action) =>
          recordNextStep(
            action === "request_material"
              ? "REQUEST_MATERIAL"
              : "EXECUTE_ACTION",
            vehicleActionStepLabel(action),
            action,
          ),
        )
      : actionBlockers.map((item) => item.nextStep);
  return {
    allowedActions,
    actionBlockers,
    nextSteps: uniqueNextSteps(nextSteps),
  };
}

function vehicleActionSummaryWithoutTask(
  identity: AdminWorkIdentitySummary,
): Readonly<{
  allowedActions: readonly AdminVehicleReviewAction[];
  actionBlockers: readonly AdminRecordActionBlocker[];
  nextSteps: readonly AdminRecordNextStep[];
}> {
  const nextStep = hasCapability(identity, "fleet_review")
    ? recordNextStep("NONE", "当前车辆没有待处理审核任务")
    : recordNextStep("CONTACT_OWNER", "联系车辆运营负责人");
  return {
    allowedActions: [],
    actionBlockers: [
      recordActionBlocker(
        "claim",
        hasCapability(identity, "fleet_review")
          ? "INVALID_RECORD_STATE"
          : "NO_CAPABILITY",
        hasCapability(identity, "fleet_review")
          ? "当前车辆没有可认领的审核任务。"
          : "当前工作身份没有车辆审核能力。",
        nextStep,
      ),
    ],
    nextSteps: [nextStep],
  };
}

function driverActionSummaryFor(
  driver: AdminDriverDirectoryItem,
  identity: AdminWorkIdentitySummary,
): Readonly<{
  allowedActions: readonly [];
  actionBlockers: readonly AdminRecordActionBlocker[];
  nextSteps: readonly AdminRecordNextStep[];
}> {
  if (
    !hasCapability(identity, "fleet_operation") &&
    !hasCapability(identity, "fleet_review")
  ) {
    const nextStep = recordNextStep("CONTACT_OWNER", "联系车主运营负责人");
    return {
      allowedActions: [],
      actionBlockers: [
        recordActionBlocker(
          "manage_driver",
          "NO_CAPABILITY",
          "当前工作身份没有车主运营能力。",
          nextStep,
        ),
      ],
      nextSteps: [nextStep],
    };
  }
  if (driver.eligibilityState === "restricted") {
    const nextStep = recordNextStep(
      "REQUEST_PLATFORM_REVIEW",
      identity.type === "operator"
        ? "提交平台恢复申请"
        : "进入平台资格复核",
    );
    return {
      allowedActions: [],
      actionBlockers: [
        recordActionBlocker(
          "restore_driver",
          "REQUIRES_PLATFORM_REVIEW",
          "车主当前受平台资格限制，不能在本页直接恢复。",
          nextStep,
        ),
      ],
      nextSteps: [nextStep],
    };
  }
  if (driver.reviewAttentionCount > 0) {
    const nextStep = recordNextStep(
      "SUBMIT_REVIEW",
      "处理关联车辆的待审核事项",
    );
    return {
      allowedActions: [],
      actionBlockers: [
        recordActionBlocker(
          "activate_driver",
          "REQUIRES_REVIEW",
          "车主仍有关联车辆审核事项未完成。",
          nextStep,
        ),
      ],
      nextSteps: [nextStep],
    };
  }
  return {
    allowedActions: [],
    actionBlockers: [],
    nextSteps: [recordNextStep("NONE", "当前无需处理")],
  };
}

function organizationScopeFor(
  session: SessionRecord,
): AdminVehicleDetail["organizationScope"] {
  return {
    organizationId: session.workIdentity.organizationId,
    organizationName: session.workIdentity.organizationName,
    cityScopes: session.workIdentity.cityScopes,
  };
}

function tripDirectoryItemFor(
  profile: import("@pollycar/contracts").AdminTrip360,
  task?: import("@pollycar/contracts").AdminTripOperationTask,
): AdminTripDirectoryItem {
  const updatedAt = new Date(
    Date.UTC(2026, 6, 15, 8, Math.min(profile.authoritativeVersion, 59)),
  ).toISOString();
  return {
    tripId: profile.tripId,
    operatorId: profile.operatorId,
    operatorName: profile.operatorName,
    authoritativeState: profile.authoritativeState,
    authoritativeVersion: profile.authoritativeVersion,
    routeSummary: profile.routeSummary,
    passengerMasked: profile.passengerMasked,
    driverMasked: profile.driverMasked,
    vehicleMasked: profile.vehicleMasked,
    ...(task
      ? {
          operationTaskId: task.taskId,
          operationCategory: task.category,
          operationState: task.state,
          priority: task.priority,
        }
      : {}),
    ...(profile.relatedSupportCaseId
      ? { relatedSupportCaseId: profile.relatedSupportCaseId }
      : {}),
    ...(profile.relatedSafetyCaseId
      ? { relatedSafetyCaseId: profile.relatedSafetyCaseId }
      : {}),
    updatedAt,
    synthetic: true,
  };
}

function allowedTripActionsFor(
  state: import("@pollycar/contracts").AdminTripOperationTask["state"],
  identity: AdminWorkIdentitySummary,
): readonly AdminTripOperationAction[] {
  if (
    !hasCapability(identity, "trip_operation") ||
    !isAtLeast(identity, "level_2")
  ) {
    return [];
  }
  if (state === "detected") return ["triage"];
  if (state === "triaged" || state === "coordinating") {
    return ["request_domain_action"];
  }
  return [];
}

function tripActionSummaryFor(
  state: import("@pollycar/contracts").AdminTripOperationTask["state"],
  identity: AdminWorkIdentitySummary,
): Readonly<{
  allowedActions: readonly AdminTripOperationAction[];
  actionBlockers: readonly AdminRecordActionBlocker[];
  nextSteps: readonly AdminRecordNextStep[];
}> {
  const allowedActions = allowedTripActionsFor(state, identity);
  if (allowedActions.length > 0) {
    return {
      allowedActions,
      actionBlockers: [],
      nextSteps: allowedActions.map((action) =>
        recordNextStep(
          "EXECUTE_ACTION",
          action === "triage" ? "完成异常分诊" : "提交领域处理申请",
          action,
        ),
      ),
    };
  }
  const expectedAction =
    state === "detected" ? "triage" : "request_domain_action";
  if (!hasCapability(identity, "trip_operation")) {
    const nextStep = recordNextStep("CONTACT_OWNER", "联系行程运营负责人");
    return {
      allowedActions,
      actionBlockers: [
        recordActionBlocker(
          expectedAction,
          "NO_CAPABILITY",
          "当前工作身份没有行程运营能力。",
          nextStep,
        ),
      ],
      nextSteps: [nextStep],
    };
  }
  if (!isAtLeast(identity, "level_2")) {
    const nextStep = recordNextStep(
      "SUBMIT_REVIEW",
      "提交运营负责人处理",
    );
    return {
      allowedActions,
      actionBlockers: [
        recordActionBlocker(
          expectedAction,
          "REQUIRES_REVIEW",
          "该行程操作需要运营负责人执行。",
          nextStep,
        ),
      ],
      nextSteps: [nextStep],
    };
  }
  const nextStep = recordNextStep("NONE", "查看行程处理记录");
  return {
    allowedActions,
    actionBlockers: [
      recordActionBlocker(
        expectedAction,
        "INVALID_RECORD_STATE",
        "当前行程任务状态不允许继续执行该操作。",
        nextStep,
      ),
    ],
    nextSteps: [nextStep],
  };
}

function tripActionSummaryWithoutTask(
  identity: AdminWorkIdentitySummary,
): Readonly<{
  allowedActions: readonly AdminTripOperationAction[];
  actionBlockers: readonly AdminRecordActionBlocker[];
  nextSteps: readonly AdminRecordNextStep[];
}> {
  const nextStep = hasCapability(identity, "trip_operation")
    ? recordNextStep("NONE", "当前行程没有待处理运营任务")
    : recordNextStep("CONTACT_OWNER", "联系行程运营负责人");
  return {
    allowedActions: [],
    actionBlockers: [
      recordActionBlocker(
        "triage",
        hasCapability(identity, "trip_operation")
          ? "INVALID_RECORD_STATE"
          : "NO_CAPABILITY",
        hasCapability(identity, "trip_operation")
          ? "当前行程没有可处理的运营任务。"
          : "当前工作身份没有行程运营能力。",
        nextStep,
      ),
    ],
    nextSteps: [nextStep],
  };
}

function recordNextStep(
  kind: AdminRecordNextStepKind,
  label: string,
  action?: string,
): AdminRecordNextStep {
  return {
    kind,
    label,
    ...(action ? { action } : {}),
  };
}

function recordActionBlocker(
  action: string,
  code: AdminRecordActionBlockerCode,
  reason: string,
  nextStep: AdminRecordNextStep,
): AdminRecordActionBlocker {
  return { action, code, reason, nextStep };
}

function uniqueNextSteps(
  steps: readonly AdminRecordNextStep[],
): readonly AdminRecordNextStep[] {
  const seen = new Set<string>();
  return steps.filter((step) => {
    const key = `${step.kind}:${step.action ?? ""}:${step.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function vehicleActionStepLabel(action: AdminVehicleReviewAction): string {
  return {
    claim: "认领车辆审核",
    request_material: "请求补充车辆材料",
    approve: "确认车辆通过",
    reject: "确认车辆不通过",
  }[action];
}

function tripScopeDigest(session: SessionRecord): string {
  return digest(
    `${session.workIdentity.type}:${session.workIdentity.organizationId}:trip_operations`,
  );
}

function caseScopeDigest(session: SessionRecord): string {
  return digest(
    `${session.workIdentity.type}:${session.workIdentity.organizationId}:support_safety`,
  );
}

function caseAuditKey(kind: AdminCaseKind, caseId: string): string {
  return `${kind}:${caseId}`;
}

function financeAuditKey(
  kind: AdminFinanceResourceKind,
  resourceId: string,
): string {
  return `${kind}:${resourceId}`;
}

function financeScopeDigest(session: SessionRecord): string {
  return digest(
    `${session.workIdentity.type}:${session.workIdentity.organizationId}:finance_operations`,
  );
}

function financeDirectoryItemsFor(
  source: AdminFinanceDirectorySource,
): readonly AdminFinanceDirectoryItem[] {
  const rows: AdminFinanceDirectoryItem[] = [];
  for (const record of source.settlements) {
    rows.push({
      resourceId: record.settlementBatchId,
      kind: "settlement",
      operatorId: record.operatorId,
      operatorName: record.operatorName,
      businessDate: record.businessDate,
      state: record.state,
      summary: `${record.operatorName}分配结算批次`,
      blocking: record.blockers.length > 0 || record.state === "blocked",
      resourceVersion: record.resourceVersion,
      updatedAt: syntheticFinanceUpdatedAt("settlement", record.resourceVersion),
      synthetic: true,
    });
  }
  for (const record of source.payouts) {
    rows.push({
      resourceId: record.payoutBatchId,
      kind: "payout",
      operatorId: record.operatorId,
      operatorName: record.operatorName,
      businessDate: record.businessDate,
      state: record.state,
      summary: `${record.operatorName}车主付款批次`,
      blocking: record.blockers.length > 0 ||
        record.state === "blocked" ||
        record.state === "unknown",
      resourceVersion: record.resourceVersion,
      updatedAt: syntheticFinanceUpdatedAt("payout", record.resourceVersion),
      synthetic: true,
    });
  }
  for (const record of source.refundReversals) {
    rows.push({
      resourceId: record.financeCaseId,
      kind: "refund_reversal",
      operatorId: record.operatorId,
      operatorName: financeOperatorName(record.operatorId),
      state: record.state,
      summary: "退款与完整冲正案件",
      blocking: record.providerResult === "failed",
      resourceVersion: record.resourceVersion,
      updatedAt: syntheticFinanceUpdatedAt(
        "refund_reversal",
        record.resourceVersion,
      ),
      synthetic: true,
    });
  }
  for (const record of source.reconciliations) {
    const operatorIds = [
      ...new Set([
        ...record.differences.map((item) => item.operatorId),
        ...record.fundCases.map((item) => item.operatorId),
      ]),
    ];
    const operatorId = operatorIds.length === 1 ? operatorIds[0] : undefined;
    rows.push({
      resourceId: record.reconciliationRunId,
      kind: "reconciliation",
      ...(operatorId
        ? {
            operatorId,
            operatorName: financeOperatorName(operatorId),
          }
        : {}),
      businessDate: record.businessDate,
      state: record.state,
      summary:
        operatorIds.length > 1
          ? "跨运营公司对账运行"
          : `${operatorId ? financeOperatorName(operatorId) : "平台"}对账运行`,
      blocking:
        record.differences.some((item) => item.state !== "resolved") ||
        record.fundCases.some(
          (item) => item.blocking && item.state === "open",
        ),
      resourceVersion: record.resourceVersion,
      updatedAt: syntheticFinanceUpdatedAt(
        "reconciliation",
        record.resourceVersion,
      ),
      synthetic: true,
    });
  }
  for (const record of source.businessDays) {
    rows.push({
      resourceId: record.businessDate,
      kind: "business_day",
      businessDate: record.businessDate,
      state: record.state,
      summary: `${record.businessDate} 财务营业日`,
      blocking:
        !record.allRunsClosed ||
        !record.fourSourcesPresent ||
        !record.zeroDifference ||
        record.blockingFundCases > 0,
      resourceVersion: record.resourceVersion,
      updatedAt: syntheticFinanceUpdatedAt(
        "business_day",
        record.resourceVersion,
      ),
      synthetic: true,
    });
  }
  for (const record of source.ledgerTransactions) {
    rows.push({
      resourceId: record.ledgerTransactionId,
      kind: "ledger",
      operatorId: record.operatorId,
      operatorName: financeOperatorName(record.operatorId),
      state: "posted",
      summary: `账本交易 ${record.globalSequence}`,
      blocking: false,
      resourceVersion: 1,
      updatedAt: syntheticFinanceUpdatedAt("ledger", 1),
      synthetic: true,
    });
  }
  return Object.freeze(rows);
}

function syntheticFinanceUpdatedAt(
  kind: AdminFinanceResourceKind,
  resourceVersion: number,
): string {
  const minuteBase: Readonly<Record<AdminFinanceResourceKind, number>> = {
    settlement: 5,
    payout: 15,
    refund_reversal: 25,
    reconciliation: 35,
    business_day: 45,
    ledger: 55,
  };
  return new Date(
    Date.UTC(
      2026,
      6,
      16,
      8,
      Math.min(minuteBase[kind] + resourceVersion, 59),
    ),
  ).toISOString();
}

function financeOperatorName(operatorId: string): string {
  return ({
    "operator-huhang": "沪行出行服务",
    "operator-shencheng": "申城出行服务",
    "operator-haiwan": "海湾城市服务",
  } as Record<string, string>)[operatorId] ?? "授权运营公司";
}

function allowedFinanceActionsFor(
  kind: AdminFinanceResourceKind,
  record: AdminFinanceDetail["record"],
  identity: AdminWorkIdentitySummary,
): readonly AdminFinanceAction[] {
  if (
    !hasCapability(identity, "finance_operation") &&
    !hasCapability(identity, "finance_review")
  ) {
    return [];
  }
  const canPrepare =
    hasCapability(identity, "finance_operation") &&
    identity.authorizationLevel === "level_1";
  const canReview =
    hasCapability(identity, "finance_review") &&
    isAtLeast(identity, "level_2");
  const reviewerId = internalUserIdFor(identity);
  switch (kind) {
    case "settlement": {
      const settlement = record as Extract<
        AdminFinanceDetail,
        { kind: "settlement" }
      >["record"];
      if (
        canPrepare &&
        identity.type === "platform" &&
        settlement.state === "eligible" &&
        settlement.blockers.length === 0
      ) {
        return ["prepare_operator_settlement"];
      }
      if (
        canReview &&
        identity.type === "platform" &&
        settlement.state === "ready" &&
        settlement.preparedBy !== reviewerId
      ) {
        return ["review_operator_settlement"];
      }
      return [];
    }
    case "payout": {
      const payout = record as Extract<
        AdminFinanceDetail,
        { kind: "payout" }
      >["record"];
      if (
        canPrepare &&
        identity.type === "operator" &&
        payout.state === "eligible" &&
        payout.blockers.length === 0
      ) {
        return ["prepare_driver_payout"];
      }
      if (
        canReview &&
        identity.type === "operator" &&
        payout.state === "awaiting_review" &&
        payout.preparedBy !== reviewerId
      ) {
        return ["review_driver_payout"];
      }
      if (
        canReview &&
        identity.type === "operator" &&
        payout.state === "approved"
      ) {
        return ["request_driver_payout"];
      }
      return [];
    }
    case "refund_reversal": {
      const refund = record as Extract<
        AdminFinanceDetail,
        { kind: "refund_reversal" }
      >["record"];
      return canPrepare &&
        identity.type === "platform" &&
        refund.state === "liability_formed"
        ? ["request_refund", "request_full_reversal"]
        : [];
    }
    case "reconciliation": {
      const reconciliation = record as Extract<
        AdminFinanceDetail,
        { kind: "reconciliation" }
      >["record"];
      if (
        canPrepare &&
        reconciliation.differences.some((item) => item.state === "open")
      ) {
        return ["submit_reconciliation_resolution"];
      }
      if (
        canReview &&
        reconciliation.differences.some(
          (item) =>
            item.state === "awaiting_review" &&
            Boolean(item.evidenceReference) &&
            item.resolvedBy !== reviewerId,
        )
      ) {
        return ["review_reconciliation_resolution"];
      }
      return [];
    }
    case "business_day": {
      const businessDay = record as Extract<
        AdminFinanceDetail,
        { kind: "business_day" }
      >["record"];
      if (
        canPrepare &&
        identity.type === "platform" &&
        businessDay.state === "ready" &&
        businessDay.allRunsClosed &&
        businessDay.fourSourcesPresent &&
        businessDay.zeroDifference &&
        businessDay.blockingFundCases === 0
      ) {
        return ["prepare_business_day_close"];
      }
      if (
        canReview &&
        identity.type === "platform" &&
        businessDay.state === "awaiting_review" &&
        businessDay.preparedBy !== reviewerId
      ) {
        return ["review_business_day_close"];
      }
      return [];
    }
    case "ledger":
      return [];
  }
}

function financeActionSummaryFor(
  kind: AdminFinanceResourceKind,
  record: AdminFinanceDetail["record"],
  identity: AdminWorkIdentitySummary,
): Readonly<{
  allowedActions: readonly AdminFinanceAction[];
  actionBlockers: readonly AdminRecordActionBlocker[];
  nextSteps: readonly AdminRecordNextStep[];
}> {
  const allowedActions = allowedFinanceActionsFor(kind, record, identity);
  const reviewAction = financeReviewActionFor(kind, record);
  if (reviewAction && financeReviewerConflicts(kind, record, internalUserIdFor(identity))) {
    const nextStep = recordNextStep(
      "WAIT",
      "由其他具备财务复核能力的负责人完成独立复核",
    );
    return {
      allowedActions,
      actionBlockers: [
        recordActionBlocker(
          reviewAction,
          "REQUIRES_INDEPENDENT_REVIEW",
          "该记录由当前账号制单，不能由同一人完成复核。",
          nextStep,
        ),
      ],
      nextSteps: [nextStep],
    };
  }
  if (allowedActions.length > 0) {
    return {
      allowedActions,
      actionBlockers: [],
      nextSteps: allowedActions.map((action) =>
        recordNextStep("EXECUTE_ACTION", financeActionStepLabel(action), action)
      ),
    };
  }
  const nextStep =
    hasCapability(identity, "finance_operation") ||
      hasCapability(identity, "finance_review")
      ? recordNextStep("NONE", "查看财务处理记录")
      : recordNextStep("CONTACT_OWNER", "联系财务运营负责人");
  return {
    allowedActions,
    actionBlockers: [
      recordActionBlocker(
        reviewAction ?? "finance_operation",
        hasCapability(identity, "finance_operation") ||
            hasCapability(identity, "finance_review")
          ? "INVALID_RECORD_STATE"
          : "NO_CAPABILITY",
        hasCapability(identity, "finance_operation") ||
            hasCapability(identity, "finance_review")
          ? "当前财务记录状态没有可执行操作。"
          : "当前工作身份没有财务处理能力。",
        nextStep,
      ),
    ],
    nextSteps: [nextStep],
  };
}

function financeReviewActionFor(
  kind: AdminFinanceResourceKind,
  record: AdminFinanceDetail["record"],
): AdminFinanceAction | undefined {
  if (
    kind === "settlement" &&
    (record as Extract<AdminFinanceDetail, { kind: "settlement" }>["record"])
        .state === "ready"
  ) {
    return "review_operator_settlement";
  }
  if (
    kind === "payout" &&
    (record as Extract<AdminFinanceDetail, { kind: "payout" }>["record"])
        .state === "awaiting_review"
  ) {
    return "review_driver_payout";
  }
  if (
    kind === "reconciliation" &&
    "differences" in record &&
    record.differences.some((item) => item.state === "awaiting_review")
  ) {
    return "review_reconciliation_resolution";
  }
  if (
    kind === "business_day" &&
    (record as Extract<AdminFinanceDetail, { kind: "business_day" }>["record"])
        .state === "awaiting_review"
  ) {
    return "review_business_day_close";
  }
  return undefined;
}

function financeRequestedReviewActionFor(
  action: AdminFinanceAction,
): AdminFinanceAction | undefined {
  const actions: Partial<Record<AdminFinanceAction, AdminFinanceAction>> = {
    prepare_operator_settlement: "review_operator_settlement",
    review_operator_settlement: "review_operator_settlement",
    prepare_driver_payout: "review_driver_payout",
    review_driver_payout: "review_driver_payout",
    submit_reconciliation_resolution: "review_reconciliation_resolution",
    review_reconciliation_resolution: "review_reconciliation_resolution",
    prepare_business_day_close: "review_business_day_close",
    review_business_day_close: "review_business_day_close",
  };
  return actions[action];
}

function financeReviewerConflicts(
  kind: AdminFinanceResourceKind,
  record: AdminFinanceDetail["record"],
  reviewerId: string,
): boolean {
  if ((kind === "settlement" || kind === "payout" || kind === "business_day") &&
    "preparedBy" in record) {
    return record.preparedBy === reviewerId;
  }
  return kind === "reconciliation" &&
    "differences" in record &&
    record.differences.some(
      (item) =>
        item.state === "awaiting_review" && item.resolvedBy === reviewerId,
    );
}

function financeActionStepLabel(action: AdminFinanceAction): string {
  return ({
    prepare_operator_settlement: "提交运营公司结算制单",
    review_operator_settlement: "完成运营公司结算复核",
    prepare_driver_payout: "提交车主付款制单",
    review_driver_payout: "完成车主付款复核",
    request_driver_payout: "请求执行车主付款",
    request_refund: "提交退款请求",
    request_full_reversal: "提交全额冲正请求",
    submit_reconciliation_resolution: "提交对账差异处理",
    review_reconciliation_resolution: "完成对账差异复核",
    prepare_business_day_close: "提交营业日关账",
    review_business_day_close: "完成营业日关账复核",
  } as Partial<Record<AdminFinanceAction, string>>)[action] ?? "处理财务记录";
}

function reconciliationActionResourceId(
  record: Extract<
    AdminFinanceDetail,
    { kind: "reconciliation" }
  >["record"],
  action: AdminFinanceAction | undefined,
): string | undefined {
  if (action === "submit_reconciliation_resolution") {
    return record.differences.find((item) => item.state === "open")
      ?.reconciliationItemId;
  }
  if (action === "review_reconciliation_resolution") {
    return record.differences.find(
      (item) =>
        item.state === "awaiting_review" && Boolean(item.evidenceReference),
    )?.reconciliationItemId;
  }
  return undefined;
}

function financeCommandFor(
  command: AdminFinanceActionCommand,
  resourceId: string,
): AdminFinanceOperationsCommand {
  if (command.action === "submit_reconciliation_resolution") {
    if (!command.evidenceReference?.trim()) {
      throw new Error("ADMIN_FINANCE_RESOLUTION_EVIDENCE_REQUIRED");
    }
    return {
      type: command.action,
      resourceId,
      resourceVersion: command.expectedVersion,
      reasonCode: command.reasonCode,
      evidenceReference: command.evidenceReference.trim(),
    };
  }
  return {
    type: command.action,
    resourceId,
    resourceVersion: command.expectedVersion,
    reasonCode: command.reasonCode,
  };
}

function executiveScopeDigest(session: SessionRecord): string {
  return digest(
    `${session.workIdentity.type}:${session.workIdentity.organizationId}:executive_dashboard`,
  );
}

const dataReportDefinitions: readonly Readonly<{
  reportId: string;
  domain: AdminDataReportDomain;
  title: string;
  summary: string;
}>[] = Object.freeze([
  Object.freeze({
    reportId: "operations-health",
    domain: "operations",
    title: "运营任务健康报表",
    summary: "范围内运营任务总量、未完成量与受阻量的去标识聚合。",
  }),
  Object.freeze({
    reportId: "finance-control",
    domain: "finance",
    title: "财务控制事件报表",
    summary: "财务与对账操作、拒绝结果和组织覆盖的审计聚合。",
  }),
  Object.freeze({
    reportId: "safety-compliance",
    domain: "safety_compliance",
    title: "安全合规事件报表",
    summary: "客服、安全与证据访问事件的去标识审计聚合。",
  }),
  Object.freeze({
    reportId: "audit-activity",
    domain: "audit",
    title: "统一审计活动报表",
    summary: "统一事件仓中的访问、操作与组织覆盖情况。",
  }),
]);

function allowedDataReportActions(
  domain: AdminDataReportDomain,
  identity: AdminWorkIdentitySummary,
): readonly ["refresh_report"] | readonly [] {
  if (!hasCapability(identity, "analytics_read")) return [];
  if (identity.authorizationLevel === "level_1") return ["refresh_report"];
  if (domain === "operations" && hasCapability(identity, "operations_task")) {
    return ["refresh_report"];
  }
  if (domain === "finance" && hasCapability(identity, "finance_review")) {
    return ["refresh_report"];
  }
  if (
    domain === "safety_compliance" &&
    hasCapability(identity, "safety_restoration_review")
  ) {
    return ["refresh_report"];
  }
  if (domain === "audit" && hasCapability(identity, "privacy_governance")) {
    return ["refresh_report"];
  }
  return [];
}

function createMembershipDefinitions(
  accounts: ReadonlyMap<string, AccountFixture>,
): readonly SyntheticMembershipDefinition[] {
  const definitions = new Map<string, SyntheticMembershipDefinition>();
  for (const account of accounts.values()) {
    for (const workIdentity of account.workIdentities) {
      if (definitions.has(workIdentity.workIdentityId)) continue;
      const suffix = workIdentity.workIdentityId.replace(/^synthetic-/, "");
      definitions.set(workIdentity.workIdentityId, {
        membershipId: `membership-${suffix}`,
        internalUserId: `internal-${suffix}`,
        workIdentity,
        displayName: membershipDisplayName(workIdentity.workIdentityId),
        workEmailMasked: maskWorkEmail(account.email),
      });
    }
  }
  return [...definitions.values()];
}

function membershipDisplayName(workIdentityId: string): string {
  const names: Readonly<Record<string, string>> = {
    "synthetic-platform-access-admin-001": "顾衡",
    "synthetic-operator-account-admin-001": "沈宁",
    "synthetic-platform-ops-001": "林岚",
    "synthetic-operator-ops-001": "周宁",
    "synthetic-finance-officer-001": "许澄",
    "synthetic-finance-lead-001": "程岩",
    "synthetic-operator-finance-officer-001": "方晴",
    "synthetic-operator-finance-lead-001": "陆衡",
    "synthetic-support-001": "顾言",
    "synthetic-operator-support-001": "苏禾",
    "synthetic-reviewer-001": "秦阅",
    "synthetic-senior-reviewer-001": "闻岚",
    "synthetic-operator-fleet-001": "陈舟",
    "synthetic-safety-officer-001": "宋安",
    "synthetic-safety-lead-001": "韩澄",
    "synthetic-auditor-001": "唐审",
    "synthetic-operator-auditor-001": "顾谨",
    "synthetic-technical-ops-001": "程维",
    "synthetic-data-analyst-001": "程析",
    "synthetic-executive-sponsor-001": "陆衡",
    "synthetic-operator-executive-001": "吴岚",
    "synthetic-privacy-compliance-001": "叶清",
  };
  return names[workIdentityId] ?? "内部成员";
}

function maskWorkEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

function membershipScopeDigest(session: SessionRecord): string {
  return digest(
    `${session.workIdentity.type}:${session.workIdentity.organizationId}:organization_accounts`,
  );
}

function allowedMembershipActions(
  session: SessionRecord,
  definition: SyntheticMembershipDefinition,
  state: AdminMembershipState,
): readonly import("@pollycar/contracts").AdminMembershipAction[] {
  if (
    definition.workIdentity.workIdentityId ===
    session.workIdentity.workIdentityId
  ) {
    return [];
  }
  if (
    !hasCapability(session.workIdentity, "membership_governance")
  ) {
    return [];
  }
  return state === "active"
    ? ["suspend_membership"]
    : ["restore_membership"];
}

function reportMetric(
  metricId: string,
  label: string,
  value: number,
  asOf: string,
  source: string,
): AdminDataReportMetric {
  return Object.freeze({
    metricId,
    label,
    displayValue: String(value),
    state: "ready",
    asOf,
    source,
    synthetic: true,
  });
}

function executiveAuditKey(
  kind: AdminExecutiveResourceKind,
  resourceId: string,
): string {
  return `${kind}:${resourceId}`;
}

function executiveDirectoryItemsFor(source: Readonly<{
  overview: import("@pollycar/contracts").AdminExecutiveOverview;
  decisions: import("@pollycar/contracts").AdminExecutiveDecisionsMetrics;
  operatorHealth: import("@pollycar/contracts").AdminExecutiveOperatorHealth;
  metricRegistry: import("@pollycar/contracts").AdminExecutiveMetricRegistry;
  exports: readonly import("@pollycar/contracts").ExecutiveExportRequest[];
}>): readonly AdminExecutiveDirectoryItem[] {
  const snapshots = new Map(
    source.overview.metrics.map((metric) => [metric.metricId, metric]),
  );
  return Object.freeze([
    ...source.decisions.decisionItems.map((item) =>
      Object.freeze({
        resourceId: item.decisionItemId,
        kind: "decision_item" as const,
        domain: item.domain,
        ...(item.operatorId
          ? {
              operatorId: item.operatorId,
              operatorName: financeOperatorName(item.operatorId),
            }
          : {}),
        state: item.state,
        title: item.title,
        summary: item.summary,
        blocking: false,
        resourceVersion: item.opinions.length + 1,
        updatedAt:
          item.opinions.at(-1)?.recordedAt ?? source.decisions.asOf,
        synthetic: true as const,
      }),
    ),
    ...source.exports.map((item) =>
      Object.freeze({
        resourceId: item.exportRequestId,
        kind: "export_request" as const,
        domain: item.domain,
        state: item.state,
        title: `${executiveDomainLabel(item.domain)}受控导出`,
        summary: item.purpose,
        blocking: false,
        resourceVersion: item.resourceVersion,
        updatedAt:
          item.downloadedAt ??
          item.approvedAt ??
          item.expiresAt ??
          item.windowEnd,
        synthetic: true as const,
      }),
    ),
    ...source.operatorHealth.operators.map((item) =>
      Object.freeze({
        resourceId: item.operatorId,
        kind: "operator_health" as const,
        operatorId: item.operatorId,
        operatorName: item.operatorName,
        state: item.health,
        title: `${item.operatorName}健康度`,
        summary:
          item.triggerReasons.length > 0
            ? item.triggerReasons.join("、")
            : "当前未触发关注规则",
        blocking: item.health === "blocked",
        resourceVersion: 1,
        updatedAt: source.operatorHealth.asOf,
        synthetic: true as const,
      }),
    ),
    ...source.metricRegistry.metrics.map((item) => {
      const snapshot = snapshots.get(item.metricId);
      return Object.freeze({
        resourceId: item.metricId,
        kind: "metric" as const,
        state: snapshot?.state ?? "ready",
        title: item.name,
        summary: item.definition,
        blocking: snapshot?.state === "unavailable",
        resourceVersion: Number.parseInt(
          item.metricVersion.replace(/\D/g, ""),
          10,
        ) || 1,
        updatedAt: snapshot?.asOf ?? source.metricRegistry.asOf,
        synthetic: true as const,
      });
    }),
  ]);
}

function allowedExecutiveExportActionsFor(
  record: import("@pollycar/contracts").ExecutiveExportRequest,
  identity: AdminWorkIdentitySummary,
  workIdentityId: string,
): readonly AdminExecutiveAction[] {
  if (
    record.state === "awaiting_privacy_review" &&
    hasCapability(identity, "privacy_governance")
  ) {
    return ["privacy_approve_export", "privacy_reject_export"];
  }
  if (record.state === "awaiting_domain_review") {
    const hasDomainReviewCapability =
      (record.domain === "operations" &&
        hasCapability(identity, "operations_task") &&
        isAtLeast(identity, "level_2")) ||
      (record.domain === "finance" &&
        hasCapability(identity, "finance_review")) ||
      (record.domain === "safety_compliance" &&
        hasCapability(identity, "safety_restoration_review"));
    if (hasDomainReviewCapability) {
      return ["domain_approve_export", "domain_reject_export"];
    }
  }
  if (record.state === "approved") {
    const hasDomainReviewCapability =
      (record.domain === "operations" &&
        hasCapability(identity, "operations_task") &&
        isAtLeast(identity, "level_2")) ||
      (record.domain === "finance" &&
        hasCapability(identity, "finance_review")) ||
      (record.domain === "safety_compliance" &&
        hasCapability(identity, "safety_restoration_review"));
    return [
      ...(hasCapability(identity, "privacy_governance") ||
      hasDomainReviewCapability
        ? (["revoke_export"] as const)
        : []),
      ...(record.requesterWorkIdentityId === workIdentityId
        ? (["download_export"] as const)
        : []),
    ];
  }
  return [];
}

function auditEventDirectoryItem(
  event: AdminAuditEvent,
): AdminAuditDirectoryItem {
  const domain = auditDomainForEvent(event);
  return {
    resourceId: event.eventId,
    kind: "event",
    domain,
    title: auditEventTitle(event),
    summary: [
      event.action,
      event.resourceType,
      event.resourceId,
      event.reasonCode,
    ]
      .filter(Boolean)
      .join(" · ") || "系统记录了一次受控访问或状态变化",
    organizationType: event.organizationType,
    organizationId: event.organizationId,
    organizationName: auditOrganizationName(
      event.organizationType,
      event.organizationId,
    ),
    result: event.result,
    actorRole: event.actorInternalUserId,
    correlationId: event.correlationId,
    blocking: event.result === "denied",
    resourceVersion: 1,
    occurredAt: event.occurredAt,
    synthetic: true,
  };
}

function auditInvestigationDirectoryItem(
  investigation: AdminAuditInvestigation,
): AdminAuditDirectoryItem {
  return {
    resourceId: investigation.investigationId,
    kind: "investigation",
    domain: investigation.domain,
    title: investigation.title,
    summary: investigation.reasonCode,
    organizationType: investigation.organizationType,
    organizationId: investigation.organizationId,
    organizationName: investigation.organizationName,
    result: investigation.state,
    ...(investigation.assigneeWorkIdentityId
      ? { actorRole: investigation.assigneeWorkIdentityId }
      : {}),
    blocking: investigation.state !== "resolved",
    resourceVersion: investigation.resourceVersion,
    occurredAt: investigation.updatedAt,
    synthetic: true,
  };
}

function auditApprovalDirectoryItem(
  approval: AdminHighRiskApprovalRecord,
): AdminAuditDirectoryItem {
  return {
    resourceId: approval.approvalId,
    kind: "approval",
    domain: approval.domain,
    title:
      approval.domain === "finance"
        ? "财务独立复核"
        : approval.requestedAction === "approve_evidence"
          ? "证据访问审批"
          : "安全恢复复核",
    summary: approval.requestedAction,
    organizationType: approval.organizationType,
    organizationId: approval.organizationId,
    organizationName: approval.organizationName,
    result: approval.state,
    actorRole:
      approval.reviewer?.actorRole ?? approval.requester.actorRole,
    blocking: approval.state === "pending",
    resourceVersion: approval.resourceVersion,
    occurredAt: approval.updatedAt,
    synthetic: true,
  };
}

function auditDomainForEvent(event: AdminAuditEvent): AdminAuditDomain {
  if (
    event.eventType.includes("authentication") ||
    event.eventType.includes("session_") ||
    event.eventType.includes("organization_context")
  ) {
    return "authentication";
  }
  if (
    event.eventType === "access_allowed" ||
    event.eventType === "access_denied"
  ) {
    return "access";
  }
  if (
    event.eventType.startsWith("operator_") ||
    event.eventType.startsWith("onboarding_") ||
    event.eventType.startsWith("city_capability")
  ) {
    return "operator";
  }
  if (
    event.eventType.startsWith("entity_360") ||
    event.eventType.startsWith("migration_")
  ) {
    return "driver_vehicle";
  }
  if (
    event.eventType.startsWith("trip_") ||
    event.eventType.startsWith("collaboration_")
  ) {
    return "trip";
  }
  if (
    event.eventType.startsWith("support_") ||
    event.eventType.startsWith("safety_") ||
    event.eventType.startsWith("evidence_")
  ) {
    return "support_safety";
  }
  if (
    event.eventType.startsWith("finance_") ||
    event.eventType.startsWith("command_recovery")
  ) {
    return "finance";
  }
  if (event.eventType.startsWith("executive_")) return "executive";
  if (event.eventType.startsWith("audit_")) return "audit_system";
  return "access";
}

function auditEventTitle(event: AdminAuditEvent): string {
  const labels: Partial<Record<AdminAuditEvent["eventType"], string>> = {
    internal_authentication_succeeded: "后台认证成功",
    organization_context_changed: "组织上下文切换",
    access_allowed: "访问决策允许",
    access_denied: "访问决策拒绝",
    operator_profile_viewed: "运营主体资料查看",
    operator_lifecycle_changed: "运营主体生命周期变更",
    entity_360_viewed: "车主或车辆详情查看",
    trip_operation_task_changed: "行程运营任务变更",
    support_case_changed: "客服案件状态变更",
    safety_investigation_submitted: "安全调查提交",
    finance_operation_changed: "财务操作状态变更",
    finance_review_recorded: "财务独立复核",
    executive_decision_opinion_recorded: "高层治理意见记录",
    executive_export_requested: "高层受控导出申请",
    executive_export_downloaded: "高层受控导出下载",
    admin_global_search_performed: "跨域搜索已执行",
    audit_event_viewed: "审计资源查看",
    audit_investigation_opened: "审计调查创建",
    audit_investigation_assigned: "审计调查分派",
    audit_investigation_note_added: "审计调查追加记录",
    audit_investigation_resolved: "审计调查解决",
    audit_investigation_reopened: "审计调查重新打开",
  };
  return labels[event.eventType] ?? event.eventType;
}

function auditOrganizationName(
  organizationType: AdminAuditEvent["organizationType"],
  organizationId: string,
): string {
  if (organizationType === "platform") return "PollyCar 平台";
  if (organizationType === "governance") return "治理观察范围";
  return (
    syntheticFleetDirectory.find(
      (record) => record.operatorId === organizationId,
    )?.operatorName ?? organizationId
  );
}

function isHighRiskAuditEvent(event: AdminAuditEvent): boolean {
  return (
    event.result === "denied" ||
    event.eventType.includes("review") ||
    event.eventType.includes("lifecycle_changed") ||
    event.eventType.includes("restoration") ||
    event.eventType.includes("export") ||
    event.eventType.includes("finance_operation")
  );
}

function allowedAuditInvestigationActionsFor(
  investigation: AdminAuditInvestigation,
  identity: AdminWorkIdentitySummary,
): readonly AdminAuditAction[] {
  if (!hasCapability(identity, "technical_recovery")) return [];
  if (investigation.state === "resolved") return ["reopen_investigation"];
  if (investigation.state === "open") {
    return [
      "assign_investigation",
      "add_investigation_note",
      "resolve_investigation",
    ];
  }
  return ["add_investigation_note", "resolve_investigation"];
}

function updateAuditInvestigation(
  current: AdminAuditInvestigation,
  command: AdminAuditActionCommand,
  actorWorkIdentityId: string,
  occurredAt: string,
): AdminAuditInvestigation {
  let state = current.state;
  let assigneeWorkIdentityId = current.assigneeWorkIdentityId;
  let notes = current.notes;
  if (command.action === "assign_investigation") {
    if (!command.assigneeWorkIdentityId?.trim()) {
      throw new Error("VALIDATION_FAILED");
    }
    state = "in_review";
    assigneeWorkIdentityId = command.assigneeWorkIdentityId.trim();
  } else if (command.action === "add_investigation_note") {
    if (!command.note?.trim()) throw new Error("VALIDATION_FAILED");
    notes = Object.freeze([
      ...current.notes,
      Object.freeze({
        noteId: token("audit-note"),
        authorWorkIdentityId: actorWorkIdentityId,
        content: command.note.trim(),
        occurredAt,
      }),
    ]);
  } else if (command.action === "resolve_investigation") {
    state = "resolved";
  } else if (command.action === "reopen_investigation") {
    state = "open";
  } else {
    throw new Error("ADMIN_AUDIT_OPERATION_FORBIDDEN");
  }
  return Object.freeze({
    ...current,
    state,
    ...(assigneeWorkIdentityId ? { assigneeWorkIdentityId } : {}),
    notes,
    resourceVersion: current.resourceVersion + 1,
    updatedAt: occurredAt,
  });
}

function auditTrailEventFor(
  action: AdminAuditAction,
  session: SessionRecord,
  previousState: AdminAuditInvestigation["state"] | undefined,
  nextState: AdminAuditInvestigation["state"],
  note: string,
  occurredAt: string,
): AdminAuditTrailEvent {
  const actions: Record<AdminAuditAction, AdminAuditTrailEvent["action"]> = {
    open_investigation: "audit_investigation_opened",
    assign_investigation: "audit_investigation_assigned",
    add_investigation_note: "audit_investigation_note_added",
    resolve_investigation: "audit_investigation_resolved",
    reopen_investigation: "audit_investigation_reopened",
  };
  return {
    eventId: token("audit-trail"),
    action: actions[action],
    actorLabel: session.workIdentity.organizationName,
    actorRole: session.workIdentity.positionName,
    occurredAt,
    ...(previousState ? { previousState } : {}),
    nextState,
    note,
  };
}

function auditEventTypeForAction(
  action: AdminAuditAction,
): Extract<
  AdminAuditEvent["eventType"],
  `audit_${string}`
> {
  const eventTypes: Record<
    AdminAuditAction,
    Extract<AdminAuditEvent["eventType"], `audit_${string}`>
  > = {
    open_investigation: "audit_investigation_opened",
    assign_investigation: "audit_investigation_assigned",
    add_investigation_note: "audit_investigation_note_added",
    resolve_investigation: "audit_investigation_resolved",
    reopen_investigation: "audit_investigation_reopened",
  };
  return eventTypes[action];
}

function auditTrailKey(
  kind: AdminAuditResourceKind,
  resourceId: string,
): string {
  return `${kind}:${resourceId}`;
}

function auditScopeDigest(session: SessionRecord): string {
  return digest(
    `${session.workIdentity.type}:${session.workIdentity.organizationId}:audit_system`,
  );
}

function performExecutiveDomainAction(
  service: ExecutiveDashboardQueryService,
  actor: AdminAccessActor,
  detail: AdminExecutiveDetail,
  command: AdminExecutiveActionCommand,
): void {
  const expectedVersion = command.expectedVersion;
  if (expectedVersion === undefined) throw new Error("VALIDATION_FAILED");
  switch (command.action) {
    case "record_decision_opinion": {
      if (
        detail.kind !== "decision_item" ||
        !command.decisionCode?.trim() ||
        !command.reasonCode?.trim() ||
        !command.responsibleRole?.trim() ||
        !command.dueAt
      ) {
        throw new Error("VALIDATION_FAILED");
      }
      service.recordDecisionOpinion(actor, command.idempotencyKey, {
        decisionItemId: detail.item.resourceId,
        decisionCode: command.decisionCode.trim(),
        reasonCode: command.reasonCode.trim(),
        responsibleRole: command.responsibleRole.trim(),
        dueAt: command.dueAt,
        resourceVersion: expectedVersion,
        ...(command.supersedesOpinionId
          ? { supersedesOpinionId: command.supersedesOpinionId }
          : {}),
      });
      return;
    }
    case "privacy_approve_export":
    case "privacy_reject_export":
      service.reviewExportPrivacy(
        actor,
        detail.item.resourceId,
        command.idempotencyKey,
        {
          decision:
            command.action === "privacy_approve_export" ? "approve" : "reject",
          reasonCode: command.reasonCode?.trim() || "executive_review",
          resourceVersion: expectedVersion,
        },
      );
      return;
    case "domain_approve_export":
    case "domain_reject_export":
      service.reviewExportDomain(
        actor,
        detail.item.resourceId,
        command.idempotencyKey,
        {
          decision:
            command.action === "domain_approve_export" ? "approve" : "reject",
          reasonCode: command.reasonCode?.trim() || "executive_review",
          resourceVersion: expectedVersion,
        },
      );
      return;
    case "revoke_export":
      service.revokeExport(
        actor,
        detail.item.resourceId,
        command.idempotencyKey,
        {
          reasonCode: command.reasonCode?.trim() || "executive_revocation",
          resourceVersion: expectedVersion,
        },
      );
      return;
    case "download_export":
      return;
    case "create_export_request":
      throw new Error("ADMIN_EXECUTIVE_OPERATION_FORBIDDEN");
  }
}

function executiveAuditActionFor(
  action: AdminExecutiveAction,
): AdminExecutiveAuditEvent["action"] {
  if (action === "record_decision_opinion") {
    return "executive_decision_opinion_recorded";
  }
  if (action === "create_export_request") return "executive_export_requested";
  if (
    action === "privacy_approve_export" ||
    action === "privacy_reject_export"
  ) {
    return "executive_export_privacy_reviewed";
  }
  if (
    action === "domain_approve_export" ||
    action === "domain_reject_export"
  ) {
    return "executive_export_domain_reviewed";
  }
  if (action === "revoke_export") return "executive_export_revoked";
  return "executive_export_downloaded";
}

function executiveDomainLabel(
  domain: import("@pollycar/contracts").ExecutiveExportDomain,
): string {
  return {
    operations: "运营",
    finance: "财务",
    safety_compliance: "安全合规",
  }[domain];
}

function executiveSearchDescription(
  item: AdminExecutiveDirectoryItem,
): string {
  return ({
    restoration_review_pending: "安全恢复仍在等待独立复核",
    nonzero_reconciliation_difference: "仍有未闭环的对账差异",
  } as Record<string, string>)[item.summary] ?? item.summary;
}

function caseDirectoryItemForSupport(
  supportCase: AdminSupportCase,
  operatorName: string,
): AdminCaseDirectoryItem {
  return {
    caseId: supportCase.supportCaseId,
    kind: "support",
    tripId: supportCase.tripId,
    operatorId: supportCase.operatorId,
    operatorName,
    state: supportCase.state,
    category: supportCase.category,
    summary: productCaseText(supportCase.userSummary),
    resourceVersion: supportCase.resourceVersion,
    updatedAt: syntheticCaseUpdatedAt(supportCase.resourceVersion),
    synthetic: true,
  };
}

function caseDirectoryItemForSafety(
  investigation: AdminSafetyInvestigation,
  operatorId: string,
  operatorName: string,
): AdminCaseDirectoryItem {
  return {
    caseId: investigation.safetyCaseId,
    kind: "safety",
    tripId: investigation.tripId,
    operatorId,
    operatorName,
    state: investigation.investigationState,
    severity: investigation.severity,
    summary: investigation.blockers.some((blocker) => blocker.blocking)
      ? "安全处置仍有阻断项"
      : "安全调查等待下一步处理",
    resourceVersion: investigation.resourceVersion,
    updatedAt: syntheticCaseUpdatedAt(investigation.resourceVersion),
    synthetic: true,
  };
}

function syntheticCaseUpdatedAt(resourceVersion: number): string {
  return new Date(
    Date.UTC(2026, 6, 16, 7, Math.min(resourceVersion, 59)),
  ).toISOString();
}

function productCaseText(value: string): string {
  return value
    .replaceAll("（合成摘要）", "")
    .replaceAll("（合成路线）", "")
    .replace(/^合成/, "");
}

function allowedSupportActionsFor(
  state: AdminSupportCase["state"],
  identity: AdminWorkIdentitySummary,
): readonly AdminSupportCaseAction[] {
  if (!hasCapability(identity, "support_case")) {
    return [];
  }
  if (state === "closed") return ["reopen"];
  if (state === "resolved") return ["close", "reopen"];
  if (state === "open") return ["continue_investigation", "close"];
  if (state === "escalated") {
    return [
      "continue_investigation",
      "await_internal",
      "resolve",
      "close",
    ];
  }
  if (state === "awaiting_user" || state === "awaiting_internal") {
    return [
      "continue_investigation",
      "resolve",
      "close",
      "escalate_operations",
      "escalate_safety",
      "escalate_finance",
    ];
  }
  if (state === "investigating") {
    return [
      "await_user",
      "await_internal",
      "resolve",
      "close",
      "escalate_operations",
      "escalate_safety",
      "escalate_finance",
    ];
  }
  return [
    "continue_investigation",
    "await_user",
    "await_internal",
    "resolve",
    "close",
    "escalate_operations",
    "escalate_safety",
    "escalate_finance",
  ];
}

function allowedSafetyActionsFor(
  investigation: AdminSafetyInvestigation,
  evidenceGrants: readonly AdminEvidenceGrant[],
  identity: AdminWorkIdentitySummary,
): readonly AdminSafetyCaseAction[] {
  const actions: AdminSafetyCaseAction[] = [];
  const internalUserId = internalUserIdFor(identity);
  if (
    hasCapability(identity, "safety_investigation") &&
    identity.authorizationLevel === "level_1" &&
    investigation.investigationState === "investigating"
  ) {
    actions.push("submit_investigation");
  }
  if (
    hasCapability(identity, "safety_restoration_review") &&
    investigation.investigationState === "awaiting_independent_review" &&
    internalUserId !== investigation.investigationOwnerInternalUserId &&
    internalUserId !== investigation.freezeActorInternalUserId
  ) {
    if (!investigation.blockers.some((blocker) => blocker.blocking)) {
      actions.push("restore_access");
    }
    actions.push("uphold_freeze");
  }
  if (hasCapability(identity, "safety_investigation")) {
    actions.push("request_evidence");
  }
  if (
    hasCapability(identity, "safety_restoration_review") &&
    evidenceGrants.some(
      (grant) =>
        grant.state === "requested" &&
        grant.requestedByInternalUserId !== internalUserId,
    )
  ) {
    actions.push("approve_evidence");
  }
  if (
    hasCapability(identity, "safety_restoration_review") &&
    evidenceGrants.some(
      (grant) => grant.state === "approved" || grant.state === "active",
    )
  ) {
    actions.push("revoke_evidence");
  }
  return actions;
}

function safetyActionSummaryFor(
  investigation: AdminSafetyInvestigation,
  evidenceGrants: readonly AdminEvidenceGrant[],
  identity: AdminWorkIdentitySummary,
): Readonly<{
  allowedActions: readonly AdminSafetyCaseAction[];
  actionBlockers: readonly AdminRecordActionBlocker[];
  nextSteps: readonly AdminRecordNextStep[];
}> {
  const allowedActions = allowedSafetyActionsFor(
    investigation,
    evidenceGrants,
    identity,
  );
  const internalUserId = internalUserIdFor(identity);
  const blockers: AdminRecordActionBlocker[] = [];
  if (
    hasCapability(identity, "safety_restoration_review") &&
    investigation.investigationState === "awaiting_independent_review" &&
    (
      internalUserId === investigation.investigationOwnerInternalUserId ||
      internalUserId === investigation.freezeActorInternalUserId
    )
  ) {
    const nextStep = recordNextStep(
      "WAIT",
      "由其他安全复核负责人完成独立复核",
    );
    blockers.push(
      recordActionBlocker(
        "restore_access",
        "REQUIRES_INDEPENDENT_REVIEW",
        "当前账号参与了调查或冻结，不能复核本次安全恢复。",
        nextStep,
      ),
      recordActionBlocker(
        "uphold_freeze",
        "REQUIRES_INDEPENDENT_REVIEW",
        "当前账号参与了调查或冻结，不能作出独立复核结论。",
        nextStep,
      ),
    );
  } else if (
    investigation.investigationState === "awaiting_independent_review" &&
    investigation.blockers.some((blocker) => blocker.blocking)
  ) {
    const nextStep = recordNextStep("WAIT", "先处理全部安全阻断项");
    blockers.push(
      recordActionBlocker(
        "restore_access",
        "RISK_RESTRICTION",
        "仍有未解除的安全阻断，暂时不能恢复访问。",
        nextStep,
      ),
    );
  }
  if (
    hasCapability(identity, "safety_restoration_review") &&
    evidenceGrants.some(
      (grant) =>
        grant.state === "requested" &&
        grant.requestedByInternalUserId === internalUserId,
    )
  ) {
    const nextStep = recordNextStep(
      "WAIT",
      "由其他安全复核负责人审批证据访问",
    );
    blockers.push(
      recordActionBlocker(
        "approve_evidence",
        "REQUIRES_INDEPENDENT_REVIEW",
        "证据访问申请不能由申请人本人批准。",
        nextStep,
      ),
    );
  }
  const allowedSteps = allowedActions.map((action) =>
    recordNextStep("EXECUTE_ACTION", safetyActionStepLabel(action), action)
  );
  const nextSteps = uniqueNextSteps([
    ...allowedSteps,
    ...blockers.map((blocker) => blocker.nextStep),
  ]);
  return {
    allowedActions,
    actionBlockers: blockers,
    nextSteps: nextSteps.length > 0
      ? nextSteps
      : [recordNextStep("NONE", "查看安全处理记录")],
  };
}

function safetyActionStepLabel(action: AdminSafetyCaseAction): string {
  return ({
    submit_investigation: "提交安全调查结论",
    restore_access: "批准恢复访问",
    uphold_freeze: "维持安全冻结",
    request_evidence: "申请证据访问",
    approve_evidence: "批准证据访问",
    revoke_evidence: "撤销证据访问",
  } as Record<AdminSafetyCaseAction, string>)[action];
}

function internalUserIdFor(identity: AdminWorkIdentitySummary): string {
  return identity.workIdentityId.replace(/^synthetic-/, "internal-");
}

function approvalActorFor(
  session: SessionRecord,
  occurredAt: string,
): AdminHighRiskApprovalRecord["requester"] {
  return {
    workIdentityId: session.workIdentity.workIdentityId,
    actorLabel: session.workIdentity.organizationName,
    actorRole: session.workIdentity.positionName,
    occurredAt,
  };
}

function supportTargetState(
  action: AdminSupportCaseAction,
): AdminSupportCase["state"] {
  switch (action) {
    case "continue_investigation":
      return "investigating";
    case "await_user":
      return "awaiting_user";
    case "await_internal":
      return "awaiting_internal";
    case "resolve":
      return "resolved";
    case "close":
      return "closed";
    case "reopen":
      return "reopened";
    case "escalate_operations":
    case "escalate_safety":
    case "escalate_finance":
      throw new Error("ADMIN_CASE_ACTION_INVALID");
  }
}

function isSupportCaseAction(
  action: AdminCaseAction,
): action is AdminSupportCaseAction {
  return [
    "continue_investigation",
    "await_user",
    "await_internal",
    "resolve",
    "close",
    "reopen",
    "escalate_operations",
    "escalate_safety",
    "escalate_finance",
  ].includes(action);
}

function isSafetyCaseAction(
  action: AdminCaseAction,
): action is AdminSafetyCaseAction {
  return [
    "submit_investigation",
    "restore_access",
    "uphold_freeze",
    "request_evidence",
    "approve_evidence",
    "revoke_evidence",
  ].includes(action);
}

function fleetScopeDigest(session: SessionRecord): string {
  return digest(
    `${session.workIdentity.type}:${session.workIdentity.organizationId}:driver_vehicle`,
  );
}

function validatePageSize(
  requested: 25 | 50 | 100 | undefined,
  after?: string,
  before?: string,
): 25 | 50 | 100 {
  const pageSize = requested ?? 25;
  if (![25, 50, 100].includes(pageSize) || (after && before)) {
    throw new Error("ADMIN_PAGINATION_INVALID");
  }
  return pageSize;
}

function countFleetState(
  rows: readonly AdminVehicleDirectoryItem[],
  state: AdminVehicleDirectoryItem["reviewState"],
): number {
  return rows.filter((item) => item.reviewState === state).length;
}

function isMaterialReason(
  reason: AdminVehicleReviewActionCommand["reasonCode"],
): reason is AdminReviewMaterialReason {
  return [
    "insurance_expiry_incomplete",
    "authorization_evidence_incomplete",
    "synthetic_attachment_invalid",
  ].includes(reason ?? "");
}

function isRejectionReason(
  reason: AdminVehicleReviewActionCommand["reasonCode"],
): reason is RejectVehicleReviewAdminCommand["reasonCode"] {
  return [
    "vehicle_age_exceeded",
    "vehicle_mileage_exceeded",
    "insurance_requirement_not_met",
    "authorization_remaining_insufficient",
  ].includes(reason ?? "");
}

function nextOperatorStateFor(
  action: AdminOperatorAction,
): AdminOperatorDirectoryItem["lifecycleState"] {
  return action === "restrict" ? "restricted" : "active";
}

function actorFor(
  session: SessionRecord,
  requestContext: Readonly<{ correlationId: string; requestId: string }>,
): AdminAccessActor {
  return {
    token: session.workIdentity.legacyAccessToken,
    correlationId: requestContext.correlationId,
    requestId: requestContext.requestId,
  };
}

function operatorDetailFor(
  session: SessionRecord,
  operator: AdminOperatorDirectoryItem,
  profile: AdminOperator360,
  auditTrail: readonly AdminOperatorAuditEvent[],
): AdminOperatorDetail {
  return {
    operator: {
      ...operator,
      contactMasked: profile.contactMasked,
      capabilities: profile.capabilities,
      blockers: profile.blockers,
    },
    organizationScope: {
      organizationId: session.workIdentity.organizationId,
      organizationName: session.workIdentity.organizationName,
      cityScopes: session.workIdentity.cityScopes,
    },
    allowedActions: allowedOperatorActionsFor(
      operator,
      session.workIdentity,
    ),
    auditTrail: [...auditTrail],
    synthetic: true,
  };
}

function nextStatusFor(
  action: AdminOperationsTaskAction,
): AdminOperationsTask["status"] {
  return ({
    assign: "processing",
    process: "waiting_review",
    review: "completed",
  } as const)[action];
}

function auditActionFor(
  action: AdminOperationsTaskAction,
): AdminOperationsTaskAuditEvent["action"] {
  return ({
    assign: "task_assigned",
    process: "task_processed",
    review: "task_reviewed",
  } as const)[action];
}

function operationPermissions(
  identity: AdminWorkIdentitySummary,
): readonly string[] {
  const permissions = new Set<string>(["read"]);
  if (hasCapability(identity, "operations_task")) {
    permissions.add(
      identity.authorizationLevel === "level_1" ? "process" : "assign",
    );
    if (isAtLeast(identity, "level_2")) permissions.add("review");
  }
  if (hasCapability(identity, "fleet_review")) {
    permissions.add("fleet:claim");
    permissions.add("fleet:request_material");
    if (isAtLeast(identity, "level_2")) {
      permissions.add("fleet:approve");
      permissions.add("fleet:reject");
    }
  }
  if (
    hasCapability(identity, "operator_governance") &&
    isAtLeast(identity, "level_2")
  ) {
    permissions.add("operator:restrict");
    permissions.add("operator:reactivate");
  }
  if (
    hasCapability(identity, "trip_operation") &&
    isAtLeast(identity, "level_2")
  ) {
    permissions.add("trip:triage");
    permissions.add("trip:request_domain_action");
  }
  return [...permissions];
}

function exportProfiles(
  identity: AdminWorkIdentitySummary,
): readonly string[] {
  if (
    hasCapability(identity, "finance_operation") ||
    hasCapability(identity, "finance_review") ||
    hasCapability(identity, "audit_read") ||
    hasCapability(identity, "privacy_governance")
  ) {
    return ["controlled"];
  }
  if (
    hasCapability(identity, "analytics_read") ||
    hasCapability(identity, "executive_read") ||
    isAtLeast(identity, "level_2")
  ) {
    return ["scoped"];
  }
  return ["none"];
}

function hasCapability(
  identity: Pick<AdminWorkIdentitySummary, "capabilities">,
  capability: AdminBusinessCapability,
): boolean {
  return identity.capabilities.includes(capability);
}

function isAtLeast(
  identity: Pick<AdminWorkIdentitySummary, "authorizationLevel">,
  minimum: AdminAuthorizationLevel,
): boolean {
  const rank: Readonly<Record<AdminAuthorizationLevel, number>> = {
    level_1: 1,
    level_2: 2,
    level_3: 3,
  };
  return rank[identity.authorizationLevel] >= rank[minimum];
}

function domainsFor(
  identity: Pick<AdminWorkIdentitySummary, "capabilities" | "type">,
): readonly AdminNavigationDomain[] {
  const domains = new Set<AdminNavigationDomain>(["workbench"]);
  for (const capability of identity.capabilities) {
    for (const domain of capabilityDomains[capability]) domains.add(domain);
  }
  if (
    identity.type === "operator" &&
    !hasCapability(identity, "membership_governance")
  ) {
    domains.delete("organization_accounts");
  }
  return [...domains];
}

function token(prefix: string): string {
  return createAdminToken(prefix);
}

function digest(value: string): string {
  return digestAdminValue(value);
}

function validateGlobalSearchQuery(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 80) {
    throw new Error("VALIDATION_FAILED");
  }
  return normalized;
}

function operationsTaskStatusLabel(
  status: AdminOperationsTask["status"],
): string {
  return ({
    unassigned: "待分派",
    processing: "处理中",
    waiting_review: "待复核",
    blocked: "受阻",
    completed: "已完成",
  } as const)[status];
}
