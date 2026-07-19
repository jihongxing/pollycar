import { createHash, randomUUID } from "node:crypto";
import type {
  AdminExecutiveDecisionItem,
  AdminExecutiveDecisionsMetrics,
  AdminExecutiveDrilldown,
  AdminExecutiveFinanceSafety,
  AdminExecutiveMetricRegistry,
  AdminExecutiveOperationsHealth,
  AdminExecutiveOperatorHealth,
  AdminExecutiveOverview,
  AdminExecutiveSafetyCompliance,
  CreateExecutiveExportRequestCommand,
  ExecutiveDashboardBase,
  ExecutiveExportDecisionCommand,
  ExecutiveExportDownload,
  ExecutiveExportRequest,
  ExecutiveMetricValue,
  ExecutiveDecisionOpinion,
  ExecutiveExportRevocationCommand,
  RecordExecutiveDecisionOpinionCommand,
} from "@pollycar/contracts";
import {
  AdminAccessService,
  type AdminAccessActor,
} from "./admin-access-service.js";
import {
  EncryptedMemoryExecutiveExportArtifactStore,
  InMemoryExecutiveGovernanceStateStore,
  type ExecutiveExportArtifactStore,
  type ExecutiveGovernanceStateStore,
} from "../persistence/admin-governance-file-store.js";

type ScopedFacts = Readonly<{
  operatorIds: readonly string[];
  asOf: string;
}>;

type ExecutiveMetricDraft = Omit<ExecutiveMetricValue, "snapshotKey">;

export interface OperatorExecutiveMetricsPort {
  read(scope: ScopedFacts): Readonly<{
    activeOperators: number;
    operators: readonly Readonly<{
      operatorId: string;
      operatorName: string;
      service: "healthy" | "attention";
      compliance: "healthy" | "attention";
    }>[];
  }>;
}

export interface TripExecutiveMetricsPort {
  read(scope: ScopedFacts): Readonly<{
    validTripCount: number;
    completionRateBasisPoints: number;
    cancellationRateBasisPoints: number;
    matchingDurationP50Seconds: number;
  }>;
}

export interface DispatchExecutiveMetricsPort {
  read(scope: ScopedFacts): Readonly<{
    acceptanceRateBasisPoints: number;
  }>;
}

export interface SupportExecutiveMetricsPort {
  read(scope: ScopedFacts): Readonly<{
    openEscalations: number;
  }>;
}

export interface SafetyExecutiveMetricsPort {
  read(scope: ScopedFacts): Readonly<{
    safetyIncidentRateBasisPoints: number;
    openMajorCases: number;
    restorationReviews: number;
  }>;
}

export interface FinanceExecutiveMetricsPort {
  read(scope: ScopedFacts): Readonly<{
    payoutTimelinessRateBasisPoints: number;
    reconciliationDifferenceRateBasisPoints: number;
    businessDayCloseRateBasisPoints: number;
    allocatedAmountMinor: string;
    nonzeroDifferenceMinor: string;
    unknownPayoutCount: number;
    unclosed: boolean;
  }>;
}

type ExecutivePorts = Readonly<{
  operators: OperatorExecutiveMetricsPort;
  trips: TripExecutiveMetricsPort;
  dispatch: DispatchExecutiveMetricsPort;
  support: SupportExecutiveMetricsPort;
  safety: SafetyExecutiveMetricsPort;
  finance: FinanceExecutiveMetricsPort;
}>;

const allExecutiveRoles = Object.freeze([
  "executive_sponsor",
  "operations_lead",
  "platform_operations_lead",
  "finance_lead",
  "safety_lead",
  "privacy_compliance",
  "operator_executive",
] as const);

const metricDefinitions = Object.freeze([
  definition("trip_completion_rate", "行程完成率", "完成行程数除以已进入匹配的有效行程数", "trip_domain", false, "PT5M"),
  definition("dispatch_acceptance_rate", "接单率", "被车主接受的有效派单数除以有效派单数", "dispatch_domain", false, "PT5M"),
  definition("trip_cancellation_rate", "取消率", "有效取消行程数除以已确认行程数", "trip_domain", false, "PT5M"),
  definition("payout_timeliness_rate", "付款及时率", "按时完成付款数量除以应付款数量", "operator_funds", true, "PT1M"),
  definition("reconciliation_difference_rate", "对账差异率", "差异绝对金额除以对账实际金额", "reconciliation", true, "PT1M"),
  definition("business_day_close_rate", "关账完成率", "已关闭账务日除以应关闭账务日", "reconciliation", true, "PT1M"),
  definition("operator_health", "主体健康度", "服务、资金、安全和合规维度的最严重结果", "multi_domain_rule", false, "PT5M"),
  definition("safety_incident_rate", "安全事件率", "有效安全事件数除以完成行程数", "safety_and_trip_domains", false, "PT1M"),
  definition("valid_trip_count", "有效行程数", "时间窗口内进入匹配的有效行程数量", "trip_domain", false, "PT5M"),
  definition("major_blocker_count", "重大阻断数", "开放硬阻断数量", "multi_domain_rule", false, "PT1M"),
  definition("executive_decision_item_count", "待高层判断事项数", "开放高层待决事项数量", "executive_decision_summary", false, "PT1M"),
  definition("matching_duration_p50", "匹配时长中位数", "有效行程首次接受时长中位数", "trip_and_dispatch_domains", false, "PT5M"),
  definition("allocated_amount_minor", "已分配金额", "已生成资金分配的金额合计", "operator_funds", true, "PT1M"),
  definition("nonzero_difference_minor", "非零差异金额", "开放对账差异绝对金额合计", "reconciliation", true, "PT1M"),
  definition("unknown_payout_count", "未知付款结果数", "权威结果仍未知的付款请求数量", "operator_funds", true, "PT1M"),
  definition("open_major_safety_case_count", "开放重大安全案件数", "开放一级和二级安全案件数量", "safety_cases", false, "PT1M"),
  definition("restoration_review_count", "恢复待复核数", "等待独立恢复复核的安全案件数量", "safety_cases", false, "PT1M"),
  definition("permission_anomaly_count", "权限异常数", "进入治理复核的异常权限访问数量", "audit_and_access_control", false, "PT1M"),
  definition("privacy_request_overdue_count", "隐私请求超时数", "超过处理时限且未关闭的隐私请求数量", "privacy_governance", false, "PT1M"),
]);

export class ExecutiveDashboardQueryService {
  private readonly opinions: ExecutiveDecisionOpinion[];
  private readonly exports: Map<string, ExecutiveExportRequest>;
  private readonly idempotentResults: Map<
    string,
    Readonly<{ digest: string; actorId: string; result: unknown }>
  >;

  public constructor(
    private readonly enabled: boolean,
    private readonly access: AdminAccessService,
    private readonly ports: ExecutivePorts = createSyntheticExecutivePorts(),
    private readonly now: () => Date = () => new Date(),
    private readonly stateStore: ExecutiveGovernanceStateStore =
      new InMemoryExecutiveGovernanceStateStore(),
    private readonly artifactStore: ExecutiveExportArtifactStore =
      new EncryptedMemoryExecutiveExportArtifactStore(),
  ) {
    const state = stateStore.load();
    this.opinions = [...state.opinions];
    this.exports = new Map(
      state.exports.map((exportRequest) => [
        exportRequest.exportRequestId,
        exportRequest,
      ]),
    );
    this.idempotentResults = new Map(
      state.idempotencyRecords.map((record) => [
        record.idempotencyKey,
        Object.freeze({
          digest: record.digest,
          actorId: record.actorId,
          result: record.result,
        }),
      ]),
    );
    this.restoreExportExpiry();
  }

  public getExecutiveOverview(actor: AdminAccessActor): AdminExecutiveOverview {
    const session = this.authorize(actor, "admin_executive.dashboard.read", "executive_overview", "dashboard", "overview", allExecutiveRoles);
    const facts = this.readFacts(session.context.operatorScopes);
    const result = Object.freeze({
      ...this.base(session.context, facts.finance.unclosed ? "unclosed" : "partial", facts.asOf, [
        "客服升级来源处于局部降级，未影响核心经营与资金卡片。",
        ...(facts.finance.unclosed ? ["资金指标包含未关账期间，不可用于正式报告或导出。"] : []),
      ]),
      metrics: this.publishMetrics([
        ratio("trip_completion_rate", "行程完成率", facts.trips.completionRateBasisPoints, facts.asOf),
        ratio("dispatch_acceptance_rate", "接单率", facts.dispatch.acceptanceRateBasisPoints, facts.asOf),
        count("major_blocker_count", "重大阻断数", 3, facts.asOf),
        count("executive_decision_item_count", "待高层判断事项", this.decisionItems(session.context.operatorScopes).length, facts.asOf),
      ], session.context, facts.asOf),
      majorBlockers: Object.freeze([
        blocker("blocker-finance-001", "finance", "blocked", "海湾城市服务存在非零对账差异，清算与付款保持阻断。", "finance_reconciliation_cases"),
        blocker("blocker-safety-001", "safety_compliance", "attention", "一项重大安全案件等待独立恢复复核。", "safety_cases"),
        blocker("blocker-operations-001", "operations", "attention", "浦东新区接单率低于关注阈值。", "trip_operations"),
      ]),
      decisionItemCount: this.decisionItems(session.context.operatorScopes).length,
    });
    this.recordView(actor, "overview");
    return result;
  }

  public getExecutiveOperationsHealth(actor: AdminAccessActor): AdminExecutiveOperationsHealth {
    const session = this.authorize(actor, "admin_executive.operations.read", "executive_operations_health", "dashboard", "operations-health", ["executive_sponsor", "operations_lead", "platform_operations_lead", "operator_executive"]);
    const facts = this.readFacts(session.context.operatorScopes);
    const result = Object.freeze({
      ...this.base(session.context, "ready", facts.asOf),
      metrics: this.publishMetrics([
        ratio("trip_completion_rate", "行程完成率", facts.trips.completionRateBasisPoints, facts.asOf),
        ratio("dispatch_acceptance_rate", "接单率", facts.dispatch.acceptanceRateBasisPoints, facts.asOf),
        ratio("trip_cancellation_rate", "取消率", facts.trips.cancellationRateBasisPoints, facts.asOf),
        duration("matching_duration_p50", "匹配时长中位数", facts.trips.matchingDurationP50Seconds, facts.asOf),
      ], session.context, facts.asOf),
      cities: Object.freeze([
        Object.freeze({ cityCode: "310000", cityName: "上海", completionRateBasisPoints: facts.trips.completionRateBasisPoints, acceptanceRateBasisPoints: facts.dispatch.acceptanceRateBasisPoints, cancellationRateBasisPoints: facts.trips.cancellationRateBasisPoints, matchingDurationP50Seconds: facts.trips.matchingDurationP50Seconds, state: "healthy" as const }),
        Object.freeze({ cityCode: "310115", cityName: "浦东新区", completionRateBasisPoints: 9180, acceptanceRateBasisPoints: 8460, cancellationRateBasisPoints: 760, matchingDurationP50Seconds: 238, state: "attention" as const }),
        Object.freeze({ cityCode: "310101", cityName: "黄浦区", completionRateBasisPoints: 0, acceptanceRateBasisPoints: 0, cancellationRateBasisPoints: 0, matchingDurationP50Seconds: 0, state: "suppressed" as const }),
      ]),
    });
    this.recordView(actor, "operations-health");
    return result;
  }

  public getExecutiveOperatorHealth(actor: AdminAccessActor): AdminExecutiveOperatorHealth {
    const session = this.authorize(actor, "admin_executive.dashboard.read", "executive_operator_health", "dashboard", "operator-health", allExecutiveRoles);
    const facts = this.readFacts(session.context.operatorScopes);
    const operators = facts.operators.operators.map((operator, index) => {
      const finance = index === 1 ? "blocked" as const : "healthy" as const;
      const safety = index === 0 ? "attention" as const : "healthy" as const;
      const health = finance === "blocked" ? "blocked" as const : safety === "attention" ? "attention" as const : "healthy" as const;
      return Object.freeze({
        operatorId: operator.operatorId,
        operatorName: operator.operatorName,
        health,
        dimensions: Object.freeze({ service: operator.service, finance, safety, compliance: operator.compliance }),
        triggerReasons: Object.freeze(finance === "blocked" ? ["nonzero_reconciliation_difference"] : safety === "attention" ? ["restoration_review_pending"] : []),
      });
    });
    const result = Object.freeze({
      ...this.base(session.context, "ready", facts.asOf),
      ruleVersion: "operator-health-v1" as const,
      operators: Object.freeze(operators),
    });
    this.recordView(actor, "operator-health");
    return result;
  }

  public getExecutiveFinanceSafety(actor: AdminAccessActor): AdminExecutiveFinanceSafety {
    const session = this.authorize(actor, "admin_executive.finance.read", "executive_finance_safety", "dashboard", "finance-safety", ["executive_sponsor", "finance_lead", "operator_executive"]);
    const facts = this.readFacts(session.context.operatorScopes);
    const exact = session.functionalRoles.includes("finance_lead");
    if (exact) {
      this.authorize(
        actor,
        "admin_executive.finance.amount.read",
        "executive_finance_safety",
        "finance_aggregate_amount",
        "finance-safety-exact-amounts",
        ["finance_lead"],
        undefined,
        true,
      );
    }
    const metrics: ExecutiveMetricDraft[] = [
      ratio("payout_timeliness_rate", "付款及时率", facts.finance.payoutTimelinessRateBasisPoints, facts.asOf, "unclosed"),
      ratio("reconciliation_difference_rate", "对账差异率", facts.finance.reconciliationDifferenceRateBasisPoints, facts.asOf, "unclosed"),
      ratio("business_day_close_rate", "关账完成率", facts.finance.businessDayCloseRateBasisPoints, facts.asOf, "unclosed"),
      exact
        ? moneyExact("allocated_amount_minor", "已分配金额", facts.finance.allocatedAmountMinor, facts.asOf)
        : moneyBand("allocated_amount_minor", "已分配金额", "¥50 万—¥100 万", facts.asOf),
      exact
        ? moneyExact("nonzero_difference_minor", "非零差异金额", facts.finance.nonzeroDifferenceMinor, facts.asOf)
        : moneyBand("nonzero_difference_minor", "非零差异金额", "¥0—¥1 万", facts.asOf),
      count("unknown_payout_count", "未知付款结果", facts.finance.unknownPayoutCount, facts.asOf, "unclosed"),
    ];
    const result = Object.freeze({
      ...this.base(session.context, "unclosed", facts.asOf, ["资金期间尚未关账，正式报告与导出失败关闭。"]),
      disclosureLevel: exact ? "L3" as const : "L2" as const,
      metrics: this.publishMetrics(metrics, session.context, facts.asOf),
      settlementStatus: "blocked" as const,
      payoutStatus: facts.finance.unknownPayoutCount > 0 ? "attention" as const : "normal" as const,
      exactAmountAccessAllowed: exact,
    });
    this.recordView(actor, "finance-safety");
    return result;
  }

  public getExecutiveSafetyCompliance(actor: AdminAccessActor): AdminExecutiveSafetyCompliance {
    const session = this.authorize(actor, "admin_executive.safety_compliance.read", "executive_safety_compliance", "dashboard", "safety-compliance", ["executive_sponsor", "safety_lead", "privacy_compliance", "operator_executive"]);
    const facts = this.readFacts(session.context.operatorScopes);
    const result = Object.freeze({
      ...this.base(session.context, "ready", facts.asOf),
      metrics: this.publishMetrics([
        ratio("safety_incident_rate", "安全事件率", facts.safety.safetyIncidentRateBasisPoints, facts.asOf),
        count("open_major_safety_case_count", "开放重大安全案件", facts.safety.openMajorCases, facts.asOf),
        count("restoration_review_count", "恢复待复核", facts.safety.restorationReviews, facts.asOf),
        count("permission_anomaly_count", "权限异常", 2, facts.asOf),
        count("privacy_request_overdue_count", "隐私请求超时", 1, facts.asOf),
      ], session.context, facts.asOf),
      majorCases: Object.freeze([
        Object.freeze({ caseId: "SAF-2026-0714-01", severity: "level_1" as const, state: "investigating" as const, summary: "合成重大安全案件正在调查，驾驶舱不返回证据原文。", originalEvidenceAvailable: false as const }),
        Object.freeze({ caseId: "SAF-2026-0713-07", severity: "level_2" as const, state: "awaiting_restoration_review" as const, summary: "恢复建议等待独立复核。", originalEvidenceAvailable: false as const }),
      ]),
      permissionAnomalies: 2,
      privacyRequestsOverdue: 1,
    });
    this.recordView(actor, "safety-compliance");
    return result;
  }

  public getExecutiveDecisionItems(actor: AdminAccessActor): AdminExecutiveDecisionsMetrics {
    const session = this.authorize(actor, "admin_executive.decisions.read", "executive_decisions_metrics", "dashboard", "decision-items", allExecutiveRoles);
    const facts = this.readFacts(session.context.operatorScopes);
    const result = Object.freeze({
      ...this.base(session.context, "ready", facts.asOf),
      decisionItems: Object.freeze(this.decisionItems(session.context.operatorScopes)),
      metrics: this.publishMetrics([
        count("executive_decision_item_count", "待高层判断事项", this.decisionItems(session.context.operatorScopes).length, facts.asOf),
      ], session.context, facts.asOf),
    });
    this.recordView(actor, "decision-items");
    return result;
  }

  public getExecutiveMetricRegistry(actor: AdminAccessActor): AdminExecutiveMetricRegistry {
    const session = this.authorize(actor, "admin_executive.metric_registry.read", "executive_decisions_metrics", "metric_registry", "metrics", allExecutiveRoles);
    const result = Object.freeze({
      ...this.base(session.context, "ready", this.now().toISOString()),
      metrics: metricDefinitions,
    });
    this.access.recordExecutiveDashboardEvent(actor, {
      eventType: "executive_metric_definition_viewed",
      action: "admin_executive.metric_registry.read",
      resourceType: "metric_registry",
      resourceId: "metrics",
    });
    return result;
  }

  public listExportRequests(
    actor: AdminAccessActor,
  ): readonly ExecutiveExportRequest[] {
    const session = this.authorize(
      actor,
      "admin_executive.export.read",
      "executive_decisions_metrics",
      "executive_export",
      "collection",
      allExecutiveRoles,
    );
    return Object.freeze(
      [...this.exports.values()]
        .filter(
          (request) =>
            session.context.organizationType === "platform" ||
            request.organizationId === session.context.organizationId,
        )
        .sort(
          (left, right) =>
            right.windowEnd.localeCompare(left.windowEnd) ||
            right.exportRequestId.localeCompare(left.exportRequestId),
        ),
    );
  }

  public getExportRequest(
    actor: AdminAccessActor,
    exportRequestId: string,
  ): ExecutiveExportRequest {
    const session = this.authorize(
      actor,
      "admin_executive.export.read",
      "executive_decisions_metrics",
      "executive_export",
      exportRequestId,
      allExecutiveRoles,
    );
    const request = this.requireExport(exportRequestId);
    if (
      session.context.organizationType === "operator" &&
      request.organizationId !== session.context.organizationId
    ) {
      throw new Error("ADMIN_EXECUTIVE_SCOPE_FORBIDDEN");
    }
    return request;
  }

  public getExecutiveDrilldown(
    actor: AdminAccessActor,
    dimension: AdminExecutiveDrilldown["dimension"],
    dimensionId: string,
  ): AdminExecutiveDrilldown {
    if (!["city", "operator", "product", "time"].includes(dimension)) throw new Error("ADMIN_EXECUTIVE_DRILLDOWN_FORBIDDEN");
    const session = this.authorize(actor, "admin_executive.drilldown.read", "executive_overview", "drilldown", `${dimension}:${dimensionId}`, allExecutiveRoles, dimension === "operator" ? dimensionId : undefined);
    const facts = this.readFacts(session.context.operatorScopes);
    const suppressed = dimensionId === "small-sample";
    const result = Object.freeze({
      ...this.base(session.context, suppressed ? "suppressed" : "ready", facts.asOf, suppressed ? ["样本量低于 10，切片已抑制。"] : []),
      dimension,
      dimensionId,
      metrics: this.publishMetrics(suppressed ? [] : [
        ratio("trip_completion_rate", "行程完成率", facts.trips.completionRateBasisPoints, facts.asOf),
        ratio("dispatch_acceptance_rate", "接单率", facts.dispatch.acceptanceRateBasisPoints, facts.asOf),
      ], session.context, facts.asOf, `${dimension}:${dimensionId}`),
      detailWorkspace: dimension === "operator" ? "operator_management" : "trip_operations",
      personLevelDetailReturned: false as const,
    });
    this.access.recordExecutiveDashboardEvent(actor, {
      eventType: "executive_dashboard_drilldown_viewed",
      action: "admin_executive.drilldown.read",
      resourceType: "drilldown",
      resourceId: `${dimension}:${dimensionId}`,
    });
    return result;
  }

  public recordDecisionOpinion(
    actor: AdminAccessActor,
    idempotencyKey: string,
    command: RecordExecutiveDecisionOpinionCommand,
  ): ExecutiveDecisionOpinion {
    const session = this.authorize(actor, "admin_executive.decision_opinion.record", "executive_decisions_metrics", "decision_item", command.decisionItemId, ["executive_sponsor", "operator_executive"]);
    return this.idempotent(actor, session.internalUserId, idempotencyKey, command, () => {
      if (!this.decisionItems(session.context.operatorScopes).some((item) => item.decisionItemId === command.decisionItemId)) throw new Error("ADMIN_EXECUTIVE_DECISION_OPINION_FORBIDDEN");
      if (!command.decisionCode || !command.reasonCode || !command.responsibleRole || !isFutureDate(command.dueAt, this.now())) {
        throw new Error("VALIDATION_FAILED");
      }
      if (command.supersedesOpinionId && !this.opinions.some((opinion) => opinion.opinionId === command.supersedesOpinionId)) {
        throw new Error("ADMIN_EXECUTIVE_DECISION_OPINION_FORBIDDEN");
      }
      const opinion = Object.freeze({
        opinionId: randomUUID(),
        decisionItemId: command.decisionItemId,
        decisionCode: command.decisionCode,
        reasonCode: command.reasonCode,
        responsibleRole: command.responsibleRole,
        dueAt: command.dueAt,
        recordedBy: session.internalUserId,
        recordedAt: this.now().toISOString(),
        ...(command.supersedesOpinionId ? { supersedesOpinionId: command.supersedesOpinionId } : {}),
        businessStateChanged: false as const,
        appendOnly: true as const,
        synthetic: true as const,
      });
      this.opinions.push(opinion);
      this.access.recordExecutiveDashboardEvent(actor, {
        eventType: "executive_decision_opinion_recorded",
        action: "admin_executive.decision_opinion.record",
        resourceType: "decision_item",
        resourceId: command.decisionItemId,
        reasonCode: command.reasonCode,
      });
      return opinion;
    });
  }

  public createExportRequest(
    actor: AdminAccessActor,
    idempotencyKey: string,
    command: CreateExecutiveExportRequestCommand,
  ): ExecutiveExportRequest {
    const session = this.authorize(actor, "admin_executive.export.request", "executive_decisions_metrics", "executive_export", "new", allExecutiveRoles);
    return this.idempotent(actor, session.internalUserId, idempotencyKey, command, () => {
      if (!command.purpose.trim()) throw new Error("ADMIN_EXECUTIVE_EXPORT_PURPOSE_REQUIRED");
      if (command.fieldSet.length === 0 || !command.windowStart || !command.windowEnd) throw new Error("VALIDATION_FAILED");
      if (command.fieldSet.some((field) => field.includes(":"))) throw new Error("ADMIN_EXECUTIVE_EXPORT_DOMAIN_MIXED_FORBIDDEN");
      if (command.domain === "finance") {
        let financeFacts: ReturnType<ExecutiveDashboardQueryService["readFacts"]>["finance"];
        try {
          financeFacts = this.readFacts(session.context.operatorScopes).finance;
        } catch {
          throw new Error("SERVICE_UNAVAILABLE");
        }
        if (financeFacts.unclosed) {
          throw new Error("ADMIN_EXECUTIVE_UNCLOSED_DATA_RESTRICTED");
        }
      }
      const exportRequest = Object.freeze({
        exportRequestId: randomUUID(),
        domain: command.domain,
        organizationType: session.context.organizationType,
        organizationId: session.context.organizationId,
        organizationName: session.context.organizationName,
        purpose: command.purpose,
        fieldSet: Object.freeze([...command.fieldSet]),
        windowStart: command.windowStart,
        windowEnd: command.windowEnd,
        state: "awaiting_privacy_review" as const,
        requesterInternalUserId: session.internalUserId,
        requesterWorkIdentityId: actor.token,
        resourceVersion: 1,
        encryptedAtRest: true as const,
        singleUse: true as const,
        synthetic: true as const,
      });
      this.exports.set(exportRequest.exportRequestId, exportRequest);
      this.access.recordExecutiveDashboardEvent(actor, {
        eventType: "executive_export_requested",
        action: "admin_executive.export.request",
        resourceType: "executive_export",
        resourceId: exportRequest.exportRequestId,
      });
      return exportRequest;
    });
  }

  public reviewExportPrivacy(
    actor: AdminAccessActor,
    exportRequestId: string,
    idempotencyKey: string,
    command: ExecutiveExportDecisionCommand,
  ): ExecutiveExportRequest {
    const session = this.authorize(actor, "admin_executive.export.privacy_approve", "executive_decisions_metrics", "executive_export", exportRequestId, ["privacy_compliance"]);
    return this.idempotent(actor, session.internalUserId, idempotencyKey, command, () => {
      const current = this.requireExport(exportRequestId);
      if (current.requesterInternalUserId === session.internalUserId) throw new Error("ADMIN_EXECUTIVE_EXPORT_REVIEWER_CONFLICT");
      if (current.state !== "awaiting_privacy_review" || current.resourceVersion !== command.resourceVersion) throw new Error("VERSION_CONFLICT");
      const next = Object.freeze({
        ...current,
        state: command.decision === "approve" ? "awaiting_domain_review" as const : "rejected" as const,
        privacyReviewerInternalUserId: session.internalUserId,
        resourceVersion: current.resourceVersion + 1,
      });
      if (command.decision === "reject") {
        this.artifactStore.delete(exportRequestId);
      }
      this.exports.set(exportRequestId, next);
      this.access.recordExecutiveDashboardEvent(actor, {
        eventType: "executive_export_privacy_reviewed",
        action: "admin_executive.export.privacy_approve",
        resourceType: "executive_export",
        resourceId: exportRequestId,
        reasonCode: command.reasonCode,
      });
      return next;
    });
  }

  public reviewExportDomain(
    actor: AdminAccessActor,
    exportRequestId: string,
    idempotencyKey: string,
    command: ExecutiveExportDecisionCommand,
  ): ExecutiveExportRequest {
    const current = this.requireExport(exportRequestId);
    const roles = current.domain === "operations"
      ? ["operations_lead", "platform_operations_lead"] as const
      : current.domain === "finance"
        ? ["finance_lead"] as const
        : ["safety_lead"] as const;
    const session = this.authorize(actor, "admin_executive.export.domain_approve", "executive_decisions_metrics", "executive_export", exportRequestId, roles);
    return this.idempotent(actor, session.internalUserId, idempotencyKey, command, () => {
      if (current.requesterInternalUserId === session.internalUserId) throw new Error("ADMIN_EXECUTIVE_EXPORT_REVIEWER_CONFLICT");
      if (current.state !== "awaiting_domain_review" || current.resourceVersion !== command.resourceVersion) throw new Error("VERSION_CONFLICT");
      const approved = command.decision === "approve";
      const approvedAt = this.now();
      const next = Object.freeze({
        ...current,
        state: approved ? "approved" as const : "rejected" as const,
        domainReviewerInternalUserId: session.internalUserId,
        ...(approved ? {
          approvedAt: approvedAt.toISOString(),
          expiresAt: new Date(approvedAt.getTime() + 30 * 60 * 1000).toISOString(),
        } : {}),
        resourceVersion: current.resourceVersion + 1,
      });
      if (approved) {
        this.artifactStore.write(
          exportRequestId,
          this.renderExportArtifact(next),
        );
      } else {
        this.artifactStore.delete(exportRequestId);
      }
      this.exports.set(exportRequestId, next);
      if (approved) this.scheduleExportExpiry(next);
      this.access.recordExecutiveDashboardEvent(actor, {
        eventType: "executive_export_domain_reviewed",
        action: "admin_executive.export.domain_approve",
        resourceType: "executive_export",
        resourceId: exportRequestId,
        reasonCode: command.reasonCode,
      });
      return next;
    });
  }

  public revokeExport(
    actor: AdminAccessActor,
    exportRequestId: string,
    idempotencyKey: string,
    command: ExecutiveExportRevocationCommand,
  ): ExecutiveExportRequest {
    const session = this.authorize(actor, "admin_executive.export.revoke", "executive_decisions_metrics", "executive_export", exportRequestId, ["privacy_compliance", "operations_lead", "platform_operations_lead", "finance_lead", "safety_lead"]);
    return this.idempotent(actor, session.internalUserId, idempotencyKey, command, () => {
      const current = this.requireExport(exportRequestId);
      if (current.state !== "approved" || current.resourceVersion !== command.resourceVersion) throw new Error("VERSION_CONFLICT");
      const next = Object.freeze({ ...current, state: "revoked" as const, resourceVersion: current.resourceVersion + 1 });
      this.artifactStore.delete(exportRequestId);
      this.exports.set(exportRequestId, next);
      this.access.recordExecutiveDashboardEvent(actor, {
        eventType: "executive_export_revoked",
        action: "admin_executive.export.revoke",
        resourceType: "executive_export",
        resourceId: exportRequestId,
        reasonCode: command.reasonCode,
      });
      return next;
    });
  }

  public downloadExport(actor: AdminAccessActor, exportRequestId: string): ExecutiveExportDownload {
    const session = this.authorize(actor, "admin_executive.export.download", "executive_decisions_metrics", "executive_export", exportRequestId, allExecutiveRoles);
    const current = this.requireExport(exportRequestId);
    if (current.requesterInternalUserId !== session.internalUserId) throw new Error("ADMIN_EXECUTIVE_EXPORT_FORBIDDEN");
    if (current.state !== "approved" || !current.expiresAt) throw new Error("ADMIN_EXECUTIVE_EXPORT_FORBIDDEN");
    if (new Date(current.expiresAt).getTime() <= this.now().getTime()) {
      this.artifactStore.delete(exportRequestId);
      this.exports.set(exportRequestId, Object.freeze({ ...current, state: "expired", resourceVersion: current.resourceVersion + 1 }));
      this.persistState();
      throw new Error("ADMIN_EXECUTIVE_EXPORT_EXPIRED");
    }
    const content = this.artifactStore.readAndDelete(exportRequestId);
    const downloadedAt = this.now().toISOString();
    this.exports.set(exportRequestId, Object.freeze({ ...current, state: "downloaded", downloadedAt, resourceVersion: current.resourceVersion + 1 }));
    this.persistState();
    this.access.recordExecutiveDashboardEvent(actor, {
      eventType: "executive_export_downloaded",
      action: "admin_executive.export.download",
      resourceType: "executive_export",
      resourceId: exportRequestId,
    });
    return Object.freeze({
      exportRequestId,
      fileName: `executive-${current.domain}-${exportRequestId}.csv`,
      mediaType: "text/csv",
      contentBase64: content.toString("base64"),
      deletedAfterDownload: true,
      synthetic: true,
    });
  }

  private authorize(
    actor: AdminAccessActor,
    action: string,
    module: Parameters<AdminAccessService["authorizeExecutiveDashboard"]>[1]["module"],
    resourceType: string,
    resourceId: string,
    allowedRoles: Parameters<AdminAccessService["authorizeExecutiveDashboard"]>[1]["allowedRoles"],
    operatorId?: string,
    platformOnly = false,
  ) {
    if (!this.enabled) throw new Error("FEATURE_DISABLED");
    return this.access.authorizeExecutiveDashboard(actor, {
      action,
      module,
      resourceType,
      resourceId,
      allowedRoles,
      ...(operatorId ? { operatorId } : {}),
      ...(platformOnly ? { platformOnly: true } : {}),
    });
  }

  private readFacts(operatorIds: readonly string[]) {
    const asOf = this.now().toISOString();
    const scope = Object.freeze({ operatorIds, asOf });
    return Object.freeze({
      asOf,
      operators: this.ports.operators.read(scope),
      trips: this.ports.trips.read(scope),
      dispatch: this.ports.dispatch.read(scope),
      support: this.ports.support.read(scope),
      safety: this.ports.safety.read(scope),
      finance: this.ports.finance.read(scope),
    });
  }

  private base(
    context: ExecutiveDashboardBase["context"],
    pageState: ExecutiveDashboardBase["pageState"],
    asOf: string,
    notices: readonly string[] = [],
  ): ExecutiveDashboardBase {
    const end = new Date(asOf);
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    return Object.freeze({
      context,
      pageState,
      asOf,
      dataWindow: Object.freeze({ start: start.toISOString(), end: end.toISOString(), timezone: "Asia/Shanghai" as const }),
      notices: Object.freeze([...notices]),
      clientRecalculationAllowed: false,
      containsRealData: false,
      synthetic: true,
    });
  }

  private publishMetrics(
    drafts: readonly ExecutiveMetricDraft[],
    context: ExecutiveDashboardBase["context"],
    asOf: string,
    dimensionKey = "all",
  ): readonly ExecutiveMetricValue[] {
    const windowEnd = new Date(asOf);
    const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);
    const organizationScopeDigest = createHash("sha256")
      .update(JSON.stringify({
        organizationType: context.organizationType,
        organizationId: context.organizationId,
        cityScopes: context.cityScopes,
        operatorScopes: context.operatorScopes,
      }))
      .digest("hex");
    return Object.freeze(drafts.map((draft) => Object.freeze({
      ...draft,
      snapshotKey: Object.freeze({
        metricId: draft.metricId,
        metricVersion: draft.metricVersion,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        dimensionKey,
        organizationScopeDigest,
        asOf,
      }),
    })));
  }

  private decisionItems(
    operatorIds: readonly string[],
  ): readonly AdminExecutiveDecisionItem[] {
    const items = [
      item("decision-operator-haiwan", "operations", "海湾城市服务限制状态复核", "资金差异未闭环，需确认继续限制或启动退出评估。", "operations_lead", "2026-07-16T10:00:00.000Z", "operator_management", "operator-haiwan"),
      item("decision-finance-difference", "finance", "长期非零资金差异", "四方事实源仍有 ¥86.40 合成差异。", "finance_lead", "2026-07-15T10:00:00.000Z", "finance_reconciliation_cases", "operator-haiwan"),
      item("decision-safety-restoration", "safety_compliance", "重大安全案件恢复边界", "独立恢复复核尚未完成。", "safety_lead", "2026-07-15T06:00:00.000Z", "safety_cases", "operator-huhang"),
    ];
    return Object.freeze(
      items
        .filter((value) => !value.operatorId || operatorIds.includes(value.operatorId))
        .map((value) => Object.freeze({
          ...value,
          opinions: Object.freeze(this.opinions.filter((opinion) => opinion.decisionItemId === value.decisionItemId)),
        })),
    );
  }

  private recordView(actor: AdminAccessActor, resourceId: string): void {
    this.access.recordExecutiveDashboardEvent(actor, {
      eventType: "executive_dashboard_viewed",
      action: "admin_executive.dashboard.read",
      resourceType: "dashboard",
      resourceId,
    });
  }

  private requireExport(exportRequestId: string): ExecutiveExportRequest {
    const value = this.exports.get(exportRequestId);
    if (!value) throw new Error("ADMIN_EXECUTIVE_EXPORT_FORBIDDEN");
    return value;
  }

  private idempotent<TResult>(
    actor: AdminAccessActor,
    actorId: string,
    idempotencyKey: string,
    input: unknown,
    operation: () => TResult,
  ): TResult {
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128) throw new Error("VALIDATION_FAILED");
    const digest = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const existing = this.idempotentResults.get(idempotencyKey);
    if (existing) {
      if (existing.digest !== digest || existing.actorId !== actorId) throw new Error("CONFLICT_IDEMPOTENCY_KEY_REUSED");
      return existing.result as TResult;
    }
    const result = operation();
    this.idempotentResults.set(idempotencyKey, Object.freeze({ digest, actorId, result }));
    this.persistState();
    return result;
  }

  private persistState(): void {
    this.stateStore.save(
      Object.freeze({
        opinions: Object.freeze([...this.opinions]),
        exports: Object.freeze([...this.exports.values()]),
        idempotencyRecords: Object.freeze(
          [...this.idempotentResults.entries()].map(
            ([idempotencyKey, record]) =>
              Object.freeze({
                idempotencyKey,
                digest: record.digest,
                actorId: record.actorId,
                result: record.result,
              }),
          ),
        ),
      }),
    );
  }

  private renderExportArtifact(exportRequest: ExecutiveExportRequest): Buffer {
    const rows = [
      ["字段", "值"],
      ["职责域", exportRequest.domain],
      ["用途", exportRequest.purpose],
      ["时间窗口", `${exportRequest.windowStart}/${exportRequest.windowEnd}`],
      ...exportRequest.fieldSet.map((field) => [field, "合成聚合值"]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${value.replaceAll("\"", "\"\"")}"`)
          .join(","),
      )
      .join("\n");
    return Buffer.from(`${csv}\n`, "utf8");
  }

  private restoreExportExpiry(): void {
    let changed = false;
    for (const exportRequest of this.exports.values()) {
      if (exportRequest.state !== "approved" || !exportRequest.expiresAt) {
        continue;
      }
      if (new Date(exportRequest.expiresAt).getTime() <= this.now().getTime()) {
        this.artifactStore.delete(exportRequest.exportRequestId);
        this.exports.set(
          exportRequest.exportRequestId,
          Object.freeze({
            ...exportRequest,
            state: "expired" as const,
            resourceVersion: exportRequest.resourceVersion + 1,
          }),
        );
        changed = true;
      } else {
        this.scheduleExportExpiry(exportRequest);
      }
    }
    if (changed) this.persistState();
  }

  private scheduleExportExpiry(exportRequest: ExecutiveExportRequest): void {
    if (!exportRequest.expiresAt) return;
    const delay = Math.max(
      0,
      new Date(exportRequest.expiresAt).getTime() - this.now().getTime(),
    );
    const timer = setTimeout(() => {
      const current = this.exports.get(exportRequest.exportRequestId);
      if (
        current?.state !== "approved" ||
        current.expiresAt !== exportRequest.expiresAt
      ) {
        return;
      }
      this.artifactStore.delete(exportRequest.exportRequestId);
      this.exports.set(
        exportRequest.exportRequestId,
        Object.freeze({
          ...current,
          state: "expired" as const,
          resourceVersion: current.resourceVersion + 1,
        }),
      );
      this.persistState();
    }, Math.min(delay, 2_147_483_647));
    timer.unref();
  }
}

export function createSyntheticExecutivePorts(): ExecutivePorts {
  return Object.freeze({
    operators: Object.freeze({
      read: (scope: ScopedFacts) => {
        const all = [
          { operatorId: "operator-huhang", operatorName: "沪行出行服务", service: "attention" as const, compliance: "healthy" as const },
          { operatorId: "operator-haiwan", operatorName: "海湾城市服务", service: "healthy" as const, compliance: "healthy" as const },
          { operatorId: "operator-shencheng", operatorName: "申城伙伴运营", service: "healthy" as const, compliance: "attention" as const },
        ];
        const operators = all.filter((operator) => scope.operatorIds.includes(operator.operatorId));
        return Object.freeze({
          activeOperators: operators.length,
          operators: Object.freeze(operators.map((operator) => Object.freeze(operator))),
        });
      },
    }),
    trips: Object.freeze({
      read: () => Object.freeze({ validTripCount: 1842, completionRateBasisPoints: 9360, cancellationRateBasisPoints: 620, matchingDurationP50Seconds: 196 }),
    }),
    dispatch: Object.freeze({
      read: () => Object.freeze({ acceptanceRateBasisPoints: 8870 }),
    }),
    support: Object.freeze({
      read: () => Object.freeze({ openEscalations: 4 }),
    }),
    safety: Object.freeze({
      read: () => Object.freeze({ safetyIncidentRateBasisPoints: 12, openMajorCases: 2, restorationReviews: 1 }),
    }),
    finance: Object.freeze({
      read: () => Object.freeze({
        payoutTimelinessRateBasisPoints: 9740,
        reconciliationDifferenceRateBasisPoints: 8,
        businessDayCloseRateBasisPoints: 9230,
        allocatedAmountMinor: "78643210",
        nonzeroDifferenceMinor: "8640",
        unknownPayoutCount: 1,
        unclosed: true,
      }),
    }),
  });
}

function definition(
  metricId: string,
  name: string,
  definitionText: string,
  source: string,
  closeRequired: boolean,
  freshnessTarget: string,
) {
  return Object.freeze({
    metricId,
    metricVersion: "v1",
    name,
    definition: definitionText,
    source,
    closeRequired,
    freshnessTarget,
    allowedDimensions: Object.freeze(["city", "operator", "product", "time"] as const),
  });
}

function metric(
  metricId: string,
  label: string,
  valueType: ExecutiveMetricValue["valueType"],
  value: number | string,
  displayValue: string,
  asOf: string,
  closeStatus: ExecutiveMetricValue["closeStatus"] = "not_required",
): ExecutiveMetricDraft {
  return Object.freeze({
    metricId,
    metricVersion: "v1",
    label,
    valueType,
    value,
    displayValue,
    state: closeStatus === "unclosed" ? "unclosed" : "ready",
    asOf,
    sourceStatus: "available",
    closeStatus,
    synthetic: true,
  });
}

function ratio(metricId: string, label: string, value: number, asOf: string, closeStatus?: ExecutiveMetricValue["closeStatus"]) {
  return metric(metricId, label, "basis_points", value, `${(value / 100).toFixed(1)}%`, asOf, closeStatus);
}

function count(metricId: string, label: string, value: number, asOf: string, closeStatus?: ExecutiveMetricValue["closeStatus"]) {
  return metric(metricId, label, "count", value, String(value), asOf, closeStatus);
}

function duration(metricId: string, label: string, value: number, asOf: string) {
  return metric(metricId, label, "seconds", value, `${Math.floor(value / 60)} 分 ${value % 60} 秒`, asOf);
}

function moneyExact(metricId: string, label: string, value: string, asOf: string) {
  return metric(metricId, label, "money_exact", value, formatMoney(value), asOf, "unclosed");
}

function moneyBand(metricId: string, label: string, value: string, asOf: string) {
  return metric(metricId, label, "money_band", value, value, asOf, "unclosed");
}

function formatMoney(minor: string): string {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(Number(minor) / 100);
}

function blocker(
  blockerId: string,
  domain: "operations" | "finance" | "safety_compliance",
  severity: "attention" | "blocked",
  summary: string,
  sourceWorkspace: string,
) {
  return Object.freeze({ blockerId, domain, severity, summary, sourceWorkspace });
}

function item(
  decisionItemId: string,
  domain: "operations" | "finance" | "safety_compliance",
  title: string,
  summary: string,
  responsibleRole: string,
  dueAt: string,
  sourceWorkspace: string,
  operatorId?: string,
) {
  return {
    decisionItemId,
    ...(operatorId ? { operatorId } : {}),
    domain,
    title,
    summary,
    responsibleRole,
    dueAt,
    state: "open" as const,
    sourceWorkspace,
    directApprovalAllowed: false as const,
    synthetic: true as const,
  };
}

function isFutureDate(value: string, now: Date): boolean {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > now.getTime();
}
