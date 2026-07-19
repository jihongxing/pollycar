import { createHash, randomUUID } from "node:crypto";
import type {
  AdminAuditEvent,
  AdminFunctionalRole,
  AdminInternalSession,
  AdminOperatorDirectoryEntry,
  AdminOperatorWorkbench,
  AdminOrganizationContext,
  AdminPlatformWorkbench,
} from "@pollycar/contracts";
import {
  InMemoryAdminAuditEventStore,
  type AdminAuditEventStore,
} from "../persistence/admin-governance-file-store.js";

export type AdminAccessActor = Readonly<{
  token: string;
  correlationId: string;
  requestId: string;
}>;

type SyntheticIdentity = Readonly<{
  internalUserId: string;
  displayName: string;
  membershipId: string;
  functionalRoles: readonly AdminFunctionalRole[];
  maximumDataClassification: AdminInternalSession["maximumDataClassification"];
  defaultContext: AdminOrganizationContext;
  availableContexts: readonly AdminOrganizationContext[];
  visibleModules: AdminInternalSession["visibleModules"];
}>;

const platformContext: AdminOrganizationContext = Object.freeze({
  organizationType: "platform",
  organizationId: "platform-pollycar",
  organizationName: "PollyCar 平台",
  cityScopes: Object.freeze(["上海"]),
  operatorScopes: Object.freeze([
    "operator-huhang",
    "operator-shencheng",
    "operator-haiwan",
    "operator-pujiang",
    "operator-hongqiao",
    "operator-nanan",
  ]),
  purpose: "platform_operations",
  fixed: false,
});

const platformObservationContexts: readonly AdminOrganizationContext[] = Object.freeze([
  createOperatorContext("operator-huhang", "沪行出行服务", false, "platform"),
  createOperatorContext("operator-shencheng", "申城伙伴运营", false, "platform"),
  createOperatorContext("operator-haiwan", "海湾城市服务", false, "platform"),
  createOperatorContext("operator-pujiang", "浦江协同运营", false, "platform"),
  createOperatorContext("operator-hongqiao", "虹桥社区出行", false, "platform"),
  createOperatorContext("operator-nanan", "南岸联合服务", false, "platform"),
]);

const operatorContext = createOperatorContext(
  "operator-huhang",
  "沪行出行服务",
  true,
  "operator",
);

const executiveModules = Object.freeze<AdminInternalSession["visibleModules"][number][]>([
  "executive_overview",
  "executive_operations_health",
  "executive_operator_health",
  "executive_finance_safety",
  "executive_safety_compliance",
  "executive_decisions_metrics",
]);

const identities = new Map<string, SyntheticIdentity>([
  [
    "synthetic-platform-access-admin-001",
    createPlatformIdentity(
      "internal-platform-access-admin-001",
      "顾衡",
      "membership-platform-access-admin-001",
      "operator_administrator",
      ["audit"],
      "restricted",
    ),
  ],
  [
    "synthetic-operator-account-admin-001",
    createOperatorIdentity(
      "internal-operator-account-admin-001",
      "沈宁",
      "membership-operator-account-admin-001",
      "operator_administrator",
      ["audit"],
    ),
  ],
  [
    "synthetic-platform-ops-001",
    Object.freeze<SyntheticIdentity>({
      internalUserId: "internal-platform-ops-001",
      displayName: "林岚",
      membershipId: "membership-platform-ops-001",
      functionalRoles: Object.freeze<AdminFunctionalRole[]>([
        "platform_operations_lead",
      ]),
      maximumDataClassification: "sensitive",
      defaultContext: platformContext,
      availableContexts: Object.freeze([platformContext, ...platformObservationContexts]),
      visibleModules: Object.freeze<AdminInternalSession["visibleModules"][number][]>([
        "platform_workbench",
        "operator_directory",
        "notifications",
        "executive_overview",
        "executive_operations_health",
        "executive_operator_health",
        "executive_decisions_metrics",
        "audit",
      ]),
    }),
  ],
  [
    "synthetic-operator-ops-001",
    Object.freeze<SyntheticIdentity>({
      internalUserId: "internal-operator-ops-001",
      displayName: "周宁",
      membershipId: "membership-operator-huhang-001",
      functionalRoles: Object.freeze<AdminFunctionalRole[]>(["operator_operations_lead"]),
      maximumDataClassification: "sensitive",
      defaultContext: operatorContext,
      availableContexts: Object.freeze([operatorContext]),
      visibleModules: Object.freeze<AdminInternalSession["visibleModules"][number][]>([
        "operator_workbench",
        "notifications",
        "audit",
      ]),
    }),
  ],
  [
    "synthetic-reviewer-001",
    createPlatformIdentity(
      "internal-reviewer-001",
      "秦阅",
      "membership-reviewer-001",
      "operations_lead",
      [],
      "restricted",
    ),
  ],
  [
    "synthetic-senior-reviewer-001",
    createPlatformIdentity(
      "internal-senior-reviewer-001",
      "宋衡",
      "membership-senior-reviewer-001",
      "operations_lead",
      ["audit"],
      "restricted",
    ),
  ],
  [
    "synthetic-operator-fleet-001",
    Object.freeze<SyntheticIdentity>({
      internalUserId: "internal-operator-fleet-001",
      displayName: "季川",
      membershipId: "membership-operator-fleet-001",
      functionalRoles: Object.freeze<AdminFunctionalRole[]>([
        "operator_operations_lead",
      ]),
      maximumDataClassification: "sensitive",
      defaultContext: operatorContext,
      availableContexts: Object.freeze([operatorContext]),
      visibleModules: Object.freeze<
        AdminInternalSession["visibleModules"][number][]
      >(["operator_workbench", "notifications", "audit"]),
    }),
  ],
  [
    "synthetic-support-001",
    createPlatformIdentity(
      "internal-support-001",
      "顾言",
      "membership-support-001",
      "customer_support_agent",
      ["support_cases", "trip_directory"],
    ),
  ],
  [
    "synthetic-operator-support-001",
    createOperatorIdentity(
      "internal-operator-support-001",
      "林音",
      "membership-operator-support-001",
      "customer_support_agent",
      ["operator_workbench", "support_cases", "trip_directory", "audit"],
    ),
  ],
  [
    "synthetic-safety-officer-001",
    createPlatformIdentity(
      "internal-safety-officer-001",
      "沈安",
      "membership-safety-officer-001",
      "safety_officer",
      ["safety_cases", "evidence_access", "trip_directory"],
      "restricted",
    ),
  ],
  [
    "synthetic-safety-lead-001",
    createPlatformIdentity(
      "internal-safety-lead-001",
      "韩澄",
      "membership-safety-lead-001",
      "safety_lead",
      ["safety_cases", "evidence_access", "trip_directory", "executive_overview", "executive_operator_health", "executive_safety_compliance", "executive_decisions_metrics", "audit"],
      "restricted",
    ),
  ],
  [
    "synthetic-technical-ops-001",
    createPlatformIdentity(
      "internal-technical-ops-001",
      "许拓",
      "membership-technical-ops-001",
      "technical_operations",
      ["command_recovery", "finance_operations", "audit"],
    ),
  ],
  [
    "synthetic-data-analyst-001",
    createPlatformIdentity(
      "internal-data-analyst-001",
      "程析",
      "membership-data-analyst-001",
      "data_analyst",
      ["data_reports", "audit"],
      "sensitive",
    ),
  ],
  [
    "synthetic-finance-officer-001",
    createPlatformIdentity(
      "internal-finance-officer-001",
      "周敏",
      "membership-finance-officer-001",
      "finance_officer",
      ["finance_operations", "finance_allocation_settlement", "finance_driver_payouts", "finance_refund_reversals", "finance_reconciliation_cases", "finance_business_day_close", "finance_ledger", "audit"],
      "restricted",
    ),
  ],
  [
    "synthetic-finance-lead-001",
    createPlatformIdentity(
      "internal-finance-lead-001",
      "陈衡",
      "membership-finance-lead-001",
      "finance_lead",
      ["finance_operations", "finance_allocation_settlement", "finance_driver_payouts", "finance_refund_reversals", "finance_reconciliation_cases", "finance_business_day_close", "finance_ledger", ...executiveModules, "audit"],
      "restricted",
    ),
  ],
  [
    "synthetic-executive-sponsor-001",
    createPlatformIdentity(
      "internal-executive-sponsor-001",
      "顾明远",
      "membership-executive-sponsor-001",
      "executive_sponsor",
      [...executiveModules, "audit"],
      "restricted",
    ),
  ],
  [
    "synthetic-operations-lead-001",
    createPlatformIdentity(
      "internal-operations-lead-001",
      "林岚",
      "membership-operations-lead-001",
      "operations_lead",
      ["executive_overview", "executive_operations_health", "executive_operator_health", "executive_decisions_metrics", "audit"],
      "sensitive",
    ),
  ],
  [
    "synthetic-privacy-compliance-001",
    createPlatformIdentity(
      "internal-privacy-compliance-001",
      "叶清",
      "membership-privacy-compliance-001",
      "privacy_compliance",
      ["executive_overview", "executive_operator_health", "executive_safety_compliance", "executive_decisions_metrics", "audit"],
      "restricted",
    ),
  ],
  [
    "synthetic-operator-executive-001",
    createOperatorIdentity(
      "internal-operator-executive-001",
      "赵远",
      "membership-operator-executive-001",
      "operator_executive",
      [...executiveModules, "audit"],
    ),
  ],
  [
    "synthetic-operator-finance-officer-001",
    createOperatorIdentity(
      "internal-operator-finance-officer-001",
      "吴清",
      "membership-operator-finance-officer-001",
      "operator_finance_officer",
      ["operator_workbench", "finance_operations", "finance_allocation_settlement", "finance_driver_payouts", "finance_reconciliation_cases", "finance_ledger", "audit"],
    ),
  ],
  [
    "synthetic-operator-finance-lead-001",
    createOperatorIdentity(
      "internal-operator-finance-lead-001",
      "赵岑",
      "membership-operator-finance-lead-001",
      "operator_finance_lead",
      ["operator_workbench", "finance_operations", "finance_allocation_settlement", "finance_driver_payouts", "finance_reconciliation_cases", "finance_ledger", "audit"],
    ),
  ],
  [
    "synthetic-auditor-001",
    createPlatformIdentity(
      "internal-auditor-001",
      "审计员",
      "membership-auditor-001",
      "auditor",
      ["trip_operations", "trip_directory", "support_cases", "safety_cases", "evidence_access", "finance_operations", "finance_allocation_settlement", "finance_driver_payouts", "finance_refund_reversals", "finance_reconciliation_cases", "finance_business_day_close", "finance_ledger", "audit"],
      "restricted",
    ),
  ],
  [
    "synthetic-operator-auditor-001",
    createOperatorIdentity(
      "internal-operator-auditor-001",
      "运营审计员",
      "membership-operator-auditor-001",
      "auditor",
      ["operator_workbench", "audit"],
    ),
  ],
]);

const operatorDirectory: readonly AdminOperatorDirectoryEntry[] = Object.freeze([
  createDirectoryEntry("operator-huhang", "沪行出行服务", "OP-SH-00018", "赵**", 128, 132, "attention", "无差异；资金操作关闭", 7),
  createDirectoryEntry("operator-shencheng", "申城伙伴运营", "OP-SH-00021", "钱**", 96, 101, "normal", "无差异；资金操作关闭", 2),
  createDirectoryEntry("operator-haiwan", "海湾城市服务", "OP-SH-00027", "孙**", 74, 79, "blocked", "差异 ¥86.40；清算与付款阻断", 5),
  createDirectoryEntry("operator-pujiang", "浦江协同运营", "OP-SH-00031", "周**", 52, 55, "normal", "无差异；资金操作关闭", 1),
  createDirectoryEntry("operator-hongqiao", "虹桥社区出行", "OP-SH-00035", "吴**", 41, 43, "normal", "无差异；资金操作关闭", 0),
  createDirectoryEntry("operator-nanan", "南岸联合服务", "OP-SH-00042", "郑**", 33, 35, "normal", "无差异；资金操作关闭", 3),
]);

export class AdminAccessService {
  private readonly activeContexts = new Map<string, AdminOrganizationContext>();
  private auditEventStore: AdminAuditEventStore =
    new InMemoryAdminAuditEventStore();
  private readonly contextSwitchResults = new Map<string, AdminInternalSession>();
  private readonly operatorManagementEnabled: boolean;
  private readonly tripOperationsEnabled: boolean;
  private readonly caseManagementEnabled: boolean;
  private readonly financeOperationsEnabled: boolean;
  private readonly executiveDashboardEnabled: boolean;
  private readonly now: () => Date;

  public constructor(enabled: boolean, now: () => Date);
  public constructor(
    enabled: boolean,
    operatorManagementEnabled: boolean,
    now?: () => Date,
  );
  public constructor(
    enabled: boolean,
    operatorManagementEnabled: boolean,
    tripOperationsEnabled: boolean,
    caseManagementEnabled: boolean,
    now?: () => Date,
  );
  public constructor(
    enabled: boolean,
    operatorManagementEnabled: boolean,
    tripOperationsEnabled: boolean,
    caseManagementEnabled: boolean,
    financeOperationsEnabled: boolean,
    now?: () => Date,
  );
  public constructor(
    enabled: boolean,
    operatorManagementEnabled: boolean,
    tripOperationsEnabled: boolean,
    caseManagementEnabled: boolean,
    financeOperationsEnabled: boolean,
    executiveDashboardEnabled: boolean,
    now?: () => Date,
  );
  public constructor(
    private readonly enabled: boolean,
    operatorManagementEnabledOrNow: boolean | (() => Date),
    tripOperationsEnabledOrNow: boolean | (() => Date) = false,
    caseManagementEnabled = false,
    financeOperationsEnabledOrNow: boolean | (() => Date) = false,
    executiveDashboardEnabledOrNow: boolean | (() => Date) = false,
    now: () => Date = () => new Date(),
  ) {
    this.operatorManagementEnabled =
      typeof operatorManagementEnabledOrNow === "boolean"
        ? operatorManagementEnabledOrNow
        : false;
    this.tripOperationsEnabled =
      typeof tripOperationsEnabledOrNow === "boolean"
        ? tripOperationsEnabledOrNow
        : false;
    this.caseManagementEnabled = caseManagementEnabled;
    this.financeOperationsEnabled =
      typeof financeOperationsEnabledOrNow === "boolean"
        ? financeOperationsEnabledOrNow
        : false;
    this.executiveDashboardEnabled =
      typeof executiveDashboardEnabledOrNow === "boolean"
        ? executiveDashboardEnabledOrNow
        : false;
    this.now =
      typeof operatorManagementEnabledOrNow === "function"
        ? operatorManagementEnabledOrNow
        : typeof tripOperationsEnabledOrNow === "function"
          ? tripOperationsEnabledOrNow
          : typeof financeOperationsEnabledOrNow === "function"
            ? financeOperationsEnabledOrNow
            : typeof executiveDashboardEnabledOrNow === "function"
              ? executiveDashboardEnabledOrNow
              : now;
  }

  public getSession(actor: AdminAccessActor): AdminInternalSession {
    this.requireEnabled();
    const identity = this.authenticate(actor);
    const context = this.contextFor(identity);
    this.appendAudit(actor, identity, context, {
      eventType: "internal_authentication_succeeded",
      result: "succeeded",
    });
    return this.sessionView(identity, context);
  }

  public switchContext(
    actor: AdminAccessActor,
    organizationId: string,
    idempotencyKey: string,
  ): AdminInternalSession {
    this.requireEnabled();
    const identity = this.authenticate(actor);
    const resultKey = `${identity.internalUserId}:${idempotencyKey}`;
    const existing = this.contextSwitchResults.get(resultKey);
    if (existing) return existing;
    const previousContext = this.contextFor(identity);
    if (previousContext.fixed) {
      this.deny(
        actor,
        identity,
        previousContext,
        "switch_organization_context",
        "ADMIN_ORGANIZATION_CONTEXT_FIXED",
        "organization",
        organizationId,
      );
    }
    const nextContext = identity.availableContexts.find(
      (context) => context.organizationId === organizationId,
    );
    if (!nextContext) {
      this.deny(
        actor,
        identity,
        previousContext,
        "switch_organization_context",
        "ADMIN_OPERATOR_SCOPE_FORBIDDEN",
        "organization",
        organizationId,
      );
    }
    this.activeContexts.set(identity.internalUserId, nextContext);
    this.appendAudit(actor, identity, nextContext, {
      eventType: "organization_context_changed",
      result: "succeeded",
      action: "switch_organization_context",
      previousContextDigest: digestContext(previousContext),
      nextContextDigest: digestContext(nextContext),
    });
    const session = this.sessionView(identity, nextContext);
    this.contextSwitchResults.set(resultKey, session);
    return session;
  }

  public getPlatformWorkbench(actor: AdminAccessActor): AdminPlatformWorkbench {
    const { identity, context } = this.authorize(
      actor,
      "get_platform_workbench",
      "platform_workbench",
    );
    if (identity.defaultContext.organizationType !== "platform") {
      this.deny(
        actor,
        identity,
        context,
        "get_platform_workbench",
        "AUTHORIZATION_DENIED",
        "module",
        "platform_workbench",
      );
    }
    const allTasks = [
      createTask("task-platform-001", "operator", "复核运营主体入驻限制解除", "沪行出行服务 · 需独立复核 · 合成案件 OP-20260714-018", "剩余 34 分钟", "high", "operator-huhang"),
      createTask("task-platform-002", "safety", "确认跨主体安全协作是否完成", "两家主体待回执；证据原文对当前角色保持遮蔽", "剩余 1 小时", "high"),
      createTask("task-platform-003", "mobility", "处理主运营关系迁移冲突", "历史关系不可改写；仅允许进入受控迁移流程", "今天 16:00", "medium", "operator-huhang"),
      createTask("task-platform-004", "support", "协调重复投诉跨主体归属", "统一案件保留单一权威状态", "明天 10:00", "normal"),
    ] as const;
    const allOperatorHealth = [
      Object.freeze({
        operatorId: "operator-huhang",
        operatorName: "沪行出行服务",
        status: "attention" as const,
        summary: "运力稳定；1 项入驻复核待完成",
      }),
      Object.freeze({
        operatorId: "operator-shencheng",
        operatorName: "申城伙伴运营",
        status: "normal" as const,
        summary: "服务质量与付款时效均在目标内",
      }),
      Object.freeze({
        operatorId: "operator-haiwan",
        operatorName: "海湾城市服务",
        status: "blocked" as const,
        summary: "存在未关闭对账差异；清算保持阻断",
      }),
    ] as const;
    const platformWide = context.organizationId === "platform-pollycar";
    const allowedOperators = new Set(context.operatorScopes);
    const tasks = platformWide
      ? allTasks
      : allTasks.filter(
          (task) => task.operatorId && allowedOperators.has(task.operatorId),
        );
    const operatorHealth = allOperatorHealth.filter((item) =>
      allowedOperators.has(item.operatorId),
    );
    return Object.freeze({
      context,
      metrics: Object.freeze({
        pendingTasks: platformWide ? 38 : tasks.length,
        dueSoon: platformWide
          ? 7
          : tasks.filter((task) => task.priority === "high").length,
        blockingCases: operatorHealth.filter((item) => item.status === "blocked").length,
        operatorsInScope: context.operatorScopes.length,
      }),
      tasks: Object.freeze(tasks),
      operatorHealth: Object.freeze(operatorHealth),
      realAccountsEnabled: false,
      financeOperationsEnabled: false,
      productionEnabled: false,
      synthetic: true,
    });
  }

  public getOperatorWorkbench(actor: AdminAccessActor): AdminOperatorWorkbench {
    const { identity, context } = this.authorize(
      actor,
      "get_operator_workbench",
      "operator_workbench",
    );
    if (identity.defaultContext.organizationType !== "operator") {
      this.deny(
        actor,
        identity,
        context,
        "get_operator_workbench",
        "AUTHORIZATION_DENIED",
        "module",
        "operator_workbench",
      );
    }
    const operatorId = context.organizationId;
    return Object.freeze({
      context,
      operatorId,
      operatorName: context.organizationName,
      metrics: Object.freeze({
        pendingTasks: 26,
        expiringDocuments: 4,
        scheduledTrips: 18,
        payoutAttention: 3,
      }),
      tasks: Object.freeze([
        createTask("task-operator-001", "mobility", "补齐 2 辆车的证照信息", "车牌号保持部分遮蔽；详情仍按任务目的披露", "剩余 42 分钟", "high", operatorId),
        createTask("task-operator-002", "operator", "确认主运营关系迁移申请", "迁出主体信息只显示必要状态；历史关系不可改写", "今天 15:30", "medium", operatorId),
        createTask("task-operator-003", "mobility", "联系车主确认迟到预约", "只提供本主体关联行程的最小联系入口", "今天 16:10", "medium", operatorId),
        createTask("task-operator-004", "safety", "提交平台安全协作回执", "不可查看调查证据或其他主体信息", "明天 09:00", "normal", operatorId),
      ]),
      financeReadOnly: true,
      crossOperatorAccessAllowed: false,
      realAccountsEnabled: false,
      productionEnabled: false,
      synthetic: true,
    });
  }

  public listOperatorDirectory(
    actor: AdminAccessActor,
  ): readonly AdminOperatorDirectoryEntry[] {
    const { identity, context } = this.authorize(
      actor,
      "list_operator_directory",
      "operator_directory",
    );
    if (identity.defaultContext.organizationType !== "platform") {
      this.deny(
        actor,
        identity,
        context,
        "list_operator_directory",
        "AUTHORIZATION_DENIED",
        "operator_directory",
        "all",
      );
    }
    const allowedOperators = new Set(context.operatorScopes);
    return operatorDirectory.filter((operator) =>
      allowedOperators.has(operator.operatorId),
    );
  }

  public listAuditEvents(actor: AdminAccessActor): readonly AdminAuditEvent[] {
    const { context } = this.authorize(actor, "list_audit_events", "audit");
    return Object.freeze(
      this.auditEventStore.list().filter(
        (event) =>
          context.organizationType === "platform" ||
          event.organizationId === context.organizationId,
      ),
    );
  }

  public recordAuditSystemEvent(
    actor: AdminAccessActor,
    event: Readonly<{
      eventType:
        | "audit_event_viewed"
        | "audit_investigation_opened"
        | "audit_investigation_assigned"
        | "audit_investigation_note_added"
        | "audit_investigation_resolved"
        | "audit_investigation_reopened"
        | "data_report_viewed"
        | "data_report_refreshed";
      action: string;
      resourceType: string;
      resourceId: string;
      reasonCode?: string;
    }>,
  ): void {
    this.recordOperatorManagementEvent(actor, event);
  }

  public recordOrganizationAccountEvent(
    actor: AdminAccessActor,
    event: Readonly<{
      eventType:
        | "admin_membership_viewed"
        | "admin_membership_suspended"
        | "admin_membership_restored";
      action: string;
      resourceType: "admin_membership";
      resourceId: string;
      reasonCode?: string;
    }>,
  ): void {
    this.recordOperatorManagementEvent(actor, event);
  }

  public attachAuditEventStore(store: AdminAuditEventStore): void {
    if (this.auditEventStore.list().length > 0) {
      throw new Error("ADMIN_AUDIT_STORE_ALREADY_ACTIVE");
    }
    this.auditEventStore = store;
  }

  public authorizeOperatorManagement(
    actor: AdminAccessActor,
    request: Readonly<{
      action: string;
      module: Extract<
        AdminInternalSession["visibleModules"][number],
        | "operator_management"
        | "operator_onboarding"
        | "driver_directory"
        | "vehicle_directory"
        | "primary_operator_relationships"
      >;
      resourceType: string;
      resourceId: string;
      operatorId?: string;
      operatorIds?: readonly string[];
      platformOnly?: boolean;
    }>,
  ): AdminInternalSession {
    this.requireEnabled();
    if (!this.operatorManagementEnabled) throw new Error("FEATURE_DISABLED");
    const identity = this.authenticate(actor);
    const context = this.contextFor(identity);
    const visibleModules = this.visibleModulesFor(identity);
    if (!visibleModules.includes(request.module)) {
      this.deny(
        actor,
        identity,
        context,
        request.action,
        "AUTHORIZATION_DENIED",
        request.resourceType,
        request.resourceId,
      );
    }
    const platform =
      identity.defaultContext.organizationType === "platform";
    if (request.platformOnly && !platform) {
      this.deny(
        actor,
        identity,
        context,
        request.action,
        "AUTHORIZATION_DENIED",
        request.resourceType,
        request.resourceId,
      );
    }
    const requestedOperators = request.operatorIds ??
      (request.operatorId ? [request.operatorId] : []);
    if (
      requestedOperators.length > 0 &&
      !requestedOperators.some((operatorId) =>
        context.operatorScopes.includes(operatorId),
      )
    ) {
      this.deny(
        actor,
        identity,
        context,
        request.action,
        "ADMIN_OPERATOR_SCOPE_FORBIDDEN",
        request.resourceType,
        request.resourceId,
      );
    }
    this.appendAudit(actor, identity, context, {
      eventType: "access_allowed",
      result: "allowed",
      action: request.action,
      accessDecisionId: randomUUID(),
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      reasonCode: "authorized",
    });
    return this.sessionView(identity, context);
  }

  public recordOperatorManagementEvent(
    actor: AdminAccessActor,
    event: Readonly<{
      eventType: Exclude<
        AdminAuditEvent["eventType"],
        | "internal_authentication_succeeded"
        | "organization_context_changed"
        | "access_allowed"
        | "access_denied"
      >;
      action: string;
      resourceType: string;
      resourceId: string;
      reasonCode?: string;
    }>,
  ): void {
    const identity = this.authenticate(actor);
    const context = this.contextFor(identity);
    this.appendAudit(actor, identity, context, {
      eventType: event.eventType,
      result: "succeeded",
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      ...(event.reasonCode ? { reasonCode: event.reasonCode } : {}),
    });
  }

  public authorizeTripCaseManagement(
    actor: AdminAccessActor,
    request: Readonly<{
      action: string;
      module: Extract<
        AdminInternalSession["visibleModules"][number],
        | "trip_operations"
        | "trip_directory"
        | "support_cases"
        | "safety_cases"
        | "evidence_access"
        | "command_recovery"
      >;
      resourceType: string;
      resourceId: string;
      operatorId?: string;
      operatorIds?: readonly string[];
      allowedRoles?: readonly AdminFunctionalRole[];
      tripGateRequired?: boolean;
      caseGateRequired?: boolean;
    }>,
  ): AdminInternalSession {
    this.requireEnabled();
    if (request.tripGateRequired && !this.tripOperationsEnabled) {
      throw new Error("FEATURE_DISABLED");
    }
    if (request.caseGateRequired && !this.caseManagementEnabled) {
      throw new Error("FEATURE_DISABLED");
    }
    const identity = this.authenticate(actor);
    const context = this.contextFor(identity);
    if (!this.visibleModulesFor(identity).includes(request.module)) {
      this.deny(
        actor,
        identity,
        context,
        request.action,
        "AUTHORIZATION_DENIED",
        request.resourceType,
        request.resourceId,
      );
    }
    if (
      request.allowedRoles &&
      !request.allowedRoles.some((role) => identity.functionalRoles.includes(role))
    ) {
      this.deny(
        actor,
        identity,
        context,
        request.action,
        "AUTHORIZATION_DENIED",
        request.resourceType,
        request.resourceId,
      );
    }
    const requestedOperators = request.operatorIds ??
      (request.operatorId ? [request.operatorId] : []);
    if (
      requestedOperators.length > 0 &&
      !requestedOperators.some((operatorId) =>
        context.operatorScopes.includes(operatorId),
      )
    ) {
      this.deny(
        actor,
        identity,
        context,
        request.action,
        "ADMIN_TRIP_SCOPE_FORBIDDEN",
        request.resourceType,
        request.resourceId,
      );
    }
    this.appendAudit(actor, identity, context, {
      eventType: "access_allowed",
      result: "allowed",
      action: request.action,
      accessDecisionId: randomUUID(),
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      reasonCode: "authorized",
    });
    return this.sessionView(identity, context);
  }

  public recordTripCaseManagementEvent(
    actor: AdminAccessActor,
    event: Readonly<{
      eventType: Exclude<
        AdminAuditEvent["eventType"],
        | "internal_authentication_succeeded"
        | "organization_context_changed"
        | "access_allowed"
        | "access_denied"
      >;
      action: string;
      resourceType: string;
      resourceId: string;
      reasonCode?: string;
    }>,
  ): void {
    this.recordOperatorManagementEvent(actor, event);
  }

  public authorizeFinanceOperations(
    actor: AdminAccessActor,
    request: Readonly<{
      action: string;
      module: Extract<
        AdminInternalSession["visibleModules"][number],
        | "finance_operations"
        | "finance_allocation_settlement"
        | "finance_driver_payouts"
        | "finance_refund_reversals"
        | "finance_reconciliation_cases"
        | "finance_business_day_close"
        | "finance_ledger"
      >;
      resourceType: string;
      resourceId: string;
      operatorId?: string;
      allowedRoles: readonly AdminFunctionalRole[];
      platformOnly?: boolean;
    }>,
  ): AdminInternalSession {
    this.requireEnabled();
    if (!this.financeOperationsEnabled) throw new Error("FEATURE_DISABLED");
    const identity = this.authenticate(actor);
    const context = this.contextFor(identity);
    if (
      !this.visibleModulesFor(identity).includes(request.module) ||
      !request.allowedRoles.some((role) => identity.functionalRoles.includes(role))
    ) {
      this.deny(actor, identity, context, request.action, "AUTHORIZATION_DENIED", request.resourceType, request.resourceId);
    }
    if (request.platformOnly && identity.defaultContext.organizationType !== "platform") {
      this.deny(actor, identity, context, request.action, "ADMIN_FINANCE_SCOPE_FORBIDDEN", request.resourceType, request.resourceId);
    }
    if (request.operatorId && !context.operatorScopes.includes(request.operatorId)) {
      this.deny(actor, identity, context, request.action, "ADMIN_FINANCE_SCOPE_FORBIDDEN", request.resourceType, request.resourceId);
    }
    this.appendAudit(actor, identity, context, {
      eventType: "access_allowed",
      result: "allowed",
      action: request.action,
      accessDecisionId: randomUUID(),
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      reasonCode: "authorized",
    });
    return this.sessionView(identity, context);
  }

  public recordFinanceOperationsEvent(
    actor: AdminAccessActor,
    event: Readonly<{
      eventType: "finance_operation_changed" | "finance_review_recorded" | "finance_amount_viewed" | "finance_command_recovery_queried";
      action: string;
      resourceType: string;
      resourceId: string;
      reasonCode?: string;
    }>,
  ): void {
    this.recordOperatorManagementEvent(actor, event);
  }

  public authorizeExecutiveDashboard(
    actor: AdminAccessActor,
    request: Readonly<{
      action: string;
      module: Extract<
        AdminInternalSession["visibleModules"][number],
        | "executive_overview"
        | "executive_operations_health"
        | "executive_operator_health"
        | "executive_finance_safety"
        | "executive_safety_compliance"
        | "executive_decisions_metrics"
      >;
      resourceType: string;
      resourceId: string;
      allowedRoles: readonly AdminFunctionalRole[];
      operatorId?: string;
      platformOnly?: boolean;
    }>,
  ): AdminInternalSession {
    this.requireEnabled();
    if (!this.executiveDashboardEnabled) throw new Error("FEATURE_DISABLED");
    const identity = this.authenticate(actor);
    const context = this.contextFor(identity);
    if (
      !this.visibleModulesFor(identity).includes(request.module) ||
      !request.allowedRoles.some((role) => identity.functionalRoles.includes(role))
    ) {
      this.deny(actor, identity, context, request.action, "AUTHORIZATION_DENIED", request.resourceType, request.resourceId);
    }
    if (request.platformOnly && context.organizationType !== "platform") {
      this.deny(actor, identity, context, request.action, "ADMIN_EXECUTIVE_SCOPE_FORBIDDEN", request.resourceType, request.resourceId);
    }
    if (request.operatorId && !context.operatorScopes.includes(request.operatorId)) {
      this.deny(actor, identity, context, request.action, "ADMIN_EXECUTIVE_SCOPE_FORBIDDEN", request.resourceType, request.resourceId);
    }
    this.appendAudit(actor, identity, context, {
      eventType: "access_allowed",
      result: "allowed",
      action: request.action,
      accessDecisionId: randomUUID(),
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      reasonCode: "authorized",
    });
    return this.sessionView(identity, context);
  }

  public recordExecutiveDashboardEvent(
    actor: AdminAccessActor,
    event: Readonly<{
      eventType:
        | "executive_dashboard_viewed"
        | "executive_dashboard_filter_changed"
        | "executive_dashboard_drilldown_viewed"
        | "executive_metric_definition_viewed"
        | "executive_decision_opinion_recorded"
        | "executive_export_requested"
        | "executive_export_privacy_reviewed"
        | "executive_export_domain_reviewed"
        | "executive_export_revoked"
        | "executive_export_downloaded";
      action: string;
      resourceType: string;
      resourceId: string;
      reasonCode?: string;
    }>,
  ): void {
    this.recordOperatorManagementEvent(actor, event);
  }

  private authorize(
    actor: AdminAccessActor,
    action: string,
    module: AdminInternalSession["visibleModules"][number],
  ): Readonly<{ identity: SyntheticIdentity; context: AdminOrganizationContext }> {
    this.requireEnabled();
    const identity = this.authenticate(actor);
    const context = this.contextFor(identity);
    if (!identity.visibleModules.includes(module)) {
      this.deny(
        actor,
        identity,
        context,
        action,
        "AUTHORIZATION_DENIED",
        "module",
        module,
      );
    }
    const accessDecisionId = randomUUID();
    this.appendAudit(actor, identity, context, {
      eventType: "access_allowed",
      result: "allowed",
      action,
      accessDecisionId,
      resourceType: "module",
      resourceId: module,
      reasonCode: "authorized",
    });
    return { identity, context };
  }

  private deny(
    actor: AdminAccessActor,
    identity: SyntheticIdentity,
    context: AdminOrganizationContext,
    action: string,
    reasonCode: string,
    resourceType: string,
    resourceId: string,
  ): never {
    this.appendAudit(actor, identity, context, {
      eventType: "access_denied",
      result: "denied",
      action,
      accessDecisionId: randomUUID(),
      resourceType,
      resourceId,
      reasonCode,
    });
    throw new Error(reasonCode);
  }

  private authenticate(actor: AdminAccessActor): SyntheticIdentity {
    const identity = identities.get(actor.token);
    if (!identity) throw new Error("AUTHENTICATION_REQUIRED");
    return identity;
  }

  private contextFor(identity: SyntheticIdentity): AdminOrganizationContext {
    return this.activeContexts.get(identity.internalUserId) ?? identity.defaultContext;
  }

  private sessionView(
    identity: SyntheticIdentity,
    context: AdminOrganizationContext,
  ): AdminInternalSession {
    return Object.freeze({
      internalUserId: identity.internalUserId,
      displayName: identity.displayName,
      membershipId: identity.membershipId,
      functionalRoles: identity.functionalRoles,
      maximumDataClassification: identity.maximumDataClassification,
      context,
      availableContexts: identity.availableContexts,
      visibleModules: this.visibleModulesFor(identity),
      temporaryGrants: Object.freeze([]),
      synthetic: true,
    });
  }

  private appendAudit(
    actor: AdminAccessActor,
    identity: SyntheticIdentity,
    context: AdminOrganizationContext,
    event: Omit<
      AdminAuditEvent,
      | "eventId"
      | "occurredAt"
      | "actorInternalUserId"
      | "actorMembershipId"
      | "organizationType"
      | "organizationId"
      | "requestId"
      | "correlationId"
      | "synthetic"
    >,
  ): void {
    this.auditEventStore.append(
      Object.freeze({
        eventId: randomUUID(),
        occurredAt: this.now().toISOString(),
        actorInternalUserId: identity.internalUserId,
        actorMembershipId: identity.membershipId,
        organizationType: context.organizationType,
        organizationId: context.organizationId,
        requestId: actor.requestId,
        correlationId: actor.correlationId,
        synthetic: true,
        ...event,
      }),
    );
  }

  private requireEnabled(): void {
    if (!this.enabled) throw new Error("FEATURE_DISABLED");
  }

  private visibleModulesFor(
    identity: SyntheticIdentity,
  ): AdminInternalSession["visibleModules"] {
    const modules = identity.visibleModules.filter(
      (module) =>
        (this.financeOperationsEnabled || !module.startsWith("finance_")) &&
        (this.executiveDashboardEnabled || !module.startsWith("executive_")),
    );
    if (this.operatorManagementEnabled) {
      modules.push(
        "operator_management",
        "driver_directory",
        "vehicle_directory",
        "primary_operator_relationships",
      );
      if (identity.defaultContext.organizationType === "platform") {
        modules.push("operator_onboarding");
      }
    }
    if (
      this.tripOperationsEnabled &&
      identity.functionalRoles.some((role) =>
        role === "platform_operations_lead" ||
        role === "operator_operations_lead"
      )
    ) {
      modules.push("trip_operations", "trip_directory");
    }
    if (
      this.caseManagementEnabled &&
      identity.functionalRoles.includes("platform_operations_lead")
    ) {
      modules.push("support_cases");
    }
    if (this.financeOperationsEnabled) {
      for (const module of identity.visibleModules) {
        if (module.startsWith("finance_")) modules.push(module);
      }
    }
    return Object.freeze([...new Set(modules)]);
  }
}

function createOperatorIdentity(
  internalUserId: string,
  displayName: string,
  membershipId: string,
  role: AdminFunctionalRole,
  visibleModules: AdminInternalSession["visibleModules"],
): SyntheticIdentity {
  return Object.freeze({
    internalUserId,
    displayName,
    membershipId,
    functionalRoles: Object.freeze([role]),
    maximumDataClassification: "restricted",
    defaultContext: operatorContext,
    availableContexts: Object.freeze([operatorContext]),
    visibleModules: Object.freeze([...visibleModules]),
  });
}

function createPlatformIdentity(
  internalUserId: string,
  displayName: string,
  membershipId: string,
  role: AdminFunctionalRole,
  visibleModules: AdminInternalSession["visibleModules"],
  maximumDataClassification: AdminInternalSession["maximumDataClassification"] = "sensitive",
): SyntheticIdentity {
  return Object.freeze({
    internalUserId,
    displayName,
    membershipId,
    functionalRoles: Object.freeze([role]),
    maximumDataClassification,
    defaultContext: platformContext,
    availableContexts: Object.freeze([platformContext]),
    visibleModules: Object.freeze([...visibleModules]),
  });
}

function createOperatorContext(
  organizationId: string,
  organizationName: string,
  fixed: boolean,
  organizationType: "platform" | "operator",
): AdminOrganizationContext {
  return Object.freeze({
    organizationType,
    organizationId,
    organizationName,
    cityScopes: Object.freeze(["上海"]),
    operatorScopes: Object.freeze([organizationId]),
    purpose:
      organizationType === "platform"
        ? "platform_operations"
        : "operator_operations",
    fixed,
  });
}

function createDirectoryEntry(
  operatorId: string,
  operatorName: string,
  syntheticReference: string,
  contactMasked: string,
  activeDrivers: number,
  activeVehicles: number,
  serviceStatus: AdminOperatorDirectoryEntry["serviceStatus"],
  financeGateSummary: string,
  pendingTaskCount: number,
): AdminOperatorDirectoryEntry {
  return Object.freeze({
    operatorId,
    operatorName,
    syntheticReference,
    contactMasked,
    cities: Object.freeze(["上海"]),
    capabilities: Object.freeze(["运力", "行程协作"]),
    activeDrivers,
    activeVehicles,
    serviceStatus,
    financeGateSummary,
    pendingTaskCount,
    lifecycleActionsAllowed: false,
    sensitiveFieldsMasked: true,
    synthetic: true,
  });
}

function createTask(
  taskId: string,
  category: "operator" | "safety" | "mobility" | "support",
  title: string,
  description: string,
  dueLabel: string,
  priority: "high" | "medium" | "normal",
  operatorId?: string,
) {
  return Object.freeze({
    taskId,
    category,
    title,
    description,
    dueLabel,
    priority,
    ...(operatorId ? { operatorId } : {}),
    synthetic: true as const,
  });
}

function digestContext(context: AdminOrganizationContext): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        organizationType: context.organizationType,
        organizationId: context.organizationId,
        cityScopes: context.cityScopes,
        operatorScopes: context.operatorScopes,
        purpose: context.purpose,
      }),
    )
    .digest("hex");
}
