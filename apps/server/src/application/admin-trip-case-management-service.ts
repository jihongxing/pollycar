import { createHash, randomUUID } from "node:crypto";
import type {
  AdminCommandRecoveryTask,
  AdminEvidenceFieldResult,
  AdminEvidenceGrant,
  AdminFunctionalRole,
  AdminSafetyInvestigation,
  AdminSupportCase,
  AdminTrip360,
  AdminTripCaseManagementCommand,
  AdminTripCaseManagementCommandResult,
  AdminTripOperationTask,
  AdminTripOperationsCenter,
} from "@pollycar/contracts";
import {
  AdminAccessService,
  type AdminAccessActor,
} from "./admin-access-service.js";

type SyntheticTripSnapshot = Omit<AdminTrip360, "context">;
type MutableSupportCase = Omit<AdminSupportCase, "context">;
type MutableSafetyInvestigation = Omit<AdminSafetyInvestigation, "context">;
type MutableEvidenceGrant = Omit<AdminEvidenceGrant, "context">;
type MutableRecoveryTask = Omit<AdminCommandRecoveryTask, "context">;

const tripSnapshots = new Map<string, SyntheticTripSnapshot>([
  [
    "trip-synthetic-8421",
    Object.freeze({
      tripId: "trip-synthetic-8421",
      operatorId: "operator-huhang",
      operatorName: "沪行出行服务",
      authoritativeState: "safety_frozen",
      authoritativeVersion: 27,
      routeSummary: "上海虹桥站 → 徐汇滨江（合成路线）",
      passengerMasked: "乘客 13**",
      driverMasked: "车主 27**",
      vehicleMasked: "沪A·S8**1",
      relatedSupportCaseId: "support-synthetic-114",
      relatedSafetyCaseId: "safety-synthetic-8421",
      financeReadOnly: true,
      operatorSnapshotImmutable: true,
      directTripMutationAllowed: false,
      synthetic: true,
    }),
  ],
  [
    "trip-synthetic-8466",
    Object.freeze({
      tripId: "trip-synthetic-8466",
      operatorId: "operator-shencheng",
      operatorName: "申城伙伴运营",
      authoritativeState: "scheduled",
      authoritativeVersion: 11,
      routeSummary: "静安寺 → 浦东机场（合成路线）",
      passengerMasked: "乘客 18**",
      driverMasked: "车主 36**",
      vehicleMasked: "沪B·P6**8",
      relatedSupportCaseId: "support-synthetic-114",
      financeReadOnly: true,
      operatorSnapshotImmutable: true,
      directTripMutationAllowed: false,
      synthetic: true,
    }),
  ],
]);

export class AdminTripCaseManagementService {
  private readonly operationTasks = new Map<string, AdminTripOperationTask>([
    [
      "trip-task-synthetic-8421",
      Object.freeze({
        taskId: "trip-task-synthetic-8421",
        tripId: "trip-synthetic-8421",
        operatorId: "operator-huhang",
        operatorName: "沪行出行服务",
        category: "cross_operator",
        state: "coordinating",
        priority: "urgent",
        summary: "安全冻结后的隔离协作，仅披露任务摘要",
        resourceVersion: 4,
        synthetic: true,
      }),
    ],
    [
      "trip-task-synthetic-8466",
      Object.freeze({
        taskId: "trip-task-synthetic-8466",
        tripId: "trip-synthetic-8466",
        operatorId: "operator-shencheng",
        operatorName: "申城伙伴运营",
        category: "schedule",
        state: "detected",
        priority: "high",
        summary: "计划接驾时间临近，等待权威行程状态",
        resourceVersion: 2,
        synthetic: true,
      }),
    ],
  ]);
  private readonly supportCases = new Map<string, MutableSupportCase>([
    [
      "support-synthetic-114",
      Object.freeze({
        supportCaseId: "support-synthetic-114",
        tripId: "trip-synthetic-8466",
        operatorId: "operator-shencheng",
        category: "schedule",
        state: "investigating",
        resourceVersion: 5,
        ownerInternalUserId: "internal-support-001",
        userSummary: "乘客询问计划接驾时间（合成摘要）",
        investigationSummary: "等待行程领域返回权威结果",
        safetyEvidenceAvailable: false,
        financeMutationAllowed: false,
        synthetic: true,
      }),
    ],
    [
      "support-synthetic-8421",
      Object.freeze({
        supportCaseId: "support-synthetic-8421",
        tripId: "trip-synthetic-8421",
        operatorId: "operator-huhang",
        category: "safety_referral",
        state: "awaiting_internal",
        resourceVersion: 3,
        ownerInternalUserId: "internal-operator-support-001",
        userSummary: "乘客询问安全冻结后的行程安排（合成摘要）",
        investigationSummary: "等待安全团队给出可披露的处置结论",
        safetyEvidenceAvailable: false,
        financeMutationAllowed: false,
        synthetic: true,
      }),
    ],
  ]);
  private readonly safetyInvestigations = new Map<string, MutableSafetyInvestigation>([
    [
      "safety-synthetic-8421",
      Object.freeze({
        safetyCaseId: "safety-synthetic-8421",
        tripId: "trip-synthetic-8421",
        authoritativeState: "open_frozen",
        investigationState: "investigating",
        severity: "sev2",
        resourceVersion: 6,
        freezeActorInternalUserId: "internal-safety-officer-001",
        investigationOwnerInternalUserId: "internal-safety-officer-001",
        blockers: Object.freeze([
          Object.freeze({
            blockerType: "emergency_response",
            summary: "合成应急协作尚未关闭",
            blocking: true,
          }),
          Object.freeze({
            blockerType: "evidence_hold",
            summary: "合成证据保全仍有效",
            blocking: true,
          }),
        ]),
        independentReviewRequired: true,
        synthetic: true,
      }),
    ],
  ]);
  private readonly evidenceGrants = new Map<string, MutableEvidenceGrant>();
  private readonly recoveryTasks = new Map<string, MutableRecoveryTask>([
    [
      "recovery-synthetic-017",
      Object.freeze({
        recoveryTaskId: "recovery-synthetic-017",
        originalCommandType: "request_trip_domain_action",
        targetResourceId: "trip-task-synthetic-8421",
        idempotencyKeyDigest: digest("unknown-original-command"),
        state: "open",
        resourceVersion: 3,
        duplicateCommandAllowed: false,
        businessDecisionAllowedForTechnicalOperations: false,
        synthetic: true,
      }),
    ],
  ]);
  private readonly commandResults = new Map<
    string,
    Readonly<{
      requestDigest: string;
      result: AdminTripCaseManagementCommandResult;
    }>
  >();

  public constructor(
    private readonly tripOperationsEnabled: boolean,
    private readonly caseManagementEnabled: boolean,
    private readonly access: AdminAccessService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public getTripOperationsCenter(
    actor: AdminAccessActor,
  ): AdminTripOperationsCenter {
    this.requireTripEnabled();
    const session = this.access.authorizeTripCaseManagement(actor, {
      action: "list_trip_operation_tasks",
      module: "trip_operations",
      resourceType: "trip_operation_task",
      resourceId: "collection",
      allowedRoles: ["platform_operations_lead", "operator_operations_lead"],
      tripGateRequired: true,
    });
    const tasks = [...this.operationTasks.values()].filter((task) =>
      session.context.operatorScopes.includes(task.operatorId)
    );
    return Object.freeze({
      context: session.context,
      tasks: Object.freeze(tasks),
      metrics: Object.freeze({
        detected: tasks.filter((task) => task.state === "detected").length,
        awaitingAuthoritativeResult: tasks.filter(
          (task) => task.state === "awaiting_authoritative_result",
        ).length,
        crossOperator: tasks.filter((task) => task.category === "cross_operator").length,
        safetyFrozen: tasks.filter(
          (task) => tripSnapshots.get(task.tripId)?.authoritativeState === "safety_frozen",
        ).length,
      }),
      directTripMutationAllowed: false,
      synthetic: true,
    });
  }

  public listTripDirectory(
    actor: AdminAccessActor,
  ): Readonly<{
    context: AdminTrip360["context"];
    trips: readonly AdminTrip360[];
    tasks: readonly AdminTripOperationTask[];
  }> {
    this.requireTripEnabled();
    const session = this.access.authorizeTripCaseManagement(actor, {
      action: "list_trip_directory",
      module: "trip_directory",
      resourceType: "trip",
      resourceId: "collection",
      allowedRoles: [
        "platform_operations_lead",
        "operator_operations_lead",
        "customer_support_agent",
        "safety_officer",
        "safety_lead",
        "auditor",
      ],
      tripGateRequired: true,
    });
    const trips = [...this.tripSnapshots().values()]
      .filter((trip) => session.context.operatorScopes.includes(trip.operatorId))
      .map((trip) => Object.freeze({ context: session.context, ...trip }));
    const visibleTripIds = new Set(trips.map((trip) => trip.tripId));
    return Object.freeze({
      context: session.context,
      trips: Object.freeze(trips),
      tasks: Object.freeze(
        [...this.operationTasks.values()].filter((task) =>
          visibleTripIds.has(task.tripId),
        ),
      ),
    });
  }

  public getTrip360(actor: AdminAccessActor, tripId: string): AdminTrip360 {
    this.requireTripEnabled();
    const trip = required(this.tripSnapshots(), tripId, "ADMIN_TRIP_NOT_FOUND");
    const session = this.access.authorizeTripCaseManagement(actor, {
      action: "view_trip_360",
      module: "trip_directory",
      resourceType: "trip",
      resourceId: tripId,
      operatorId: trip.operatorId,
      allowedRoles: [
        "platform_operations_lead",
        "operator_operations_lead",
        "customer_support_agent",
        "safety_officer",
        "safety_lead",
        "auditor",
      ],
      tripGateRequired: true,
    });
    return Object.freeze({ context: session.context, ...trip });
  }

  public getTripOperationTask(
    actor: AdminAccessActor,
    tripId: string,
  ): AdminTripOperationTask | undefined {
    this.getTrip360(actor, tripId);
    return [...this.operationTasks.values()].find(
      (task) => task.tripId === tripId,
    );
  }

  public listCaseDirectory(
    actor: AdminAccessActor,
  ): Readonly<{
    context: AdminTrip360["context"];
    supportCases: readonly AdminSupportCase[];
    safetyInvestigations: readonly AdminSafetyInvestigation[];
  }> {
    this.requireCaseEnabled();
    let context: AdminTrip360["context"] | undefined;
    let supportCases: readonly AdminSupportCase[] = [];
    let safetyInvestigations: readonly AdminSafetyInvestigation[] = [];

    try {
      const supportSession = this.access.authorizeTripCaseManagement(actor, {
        action: "list_support_cases",
        module: "support_cases",
        resourceType: "support_case",
        resourceId: "collection",
        allowedRoles: ["customer_support_agent", "platform_operations_lead", "auditor"],
        caseGateRequired: true,
      });
      context = supportSession.context;
      supportCases = [...this.supportCases.values()]
        .filter((item) =>
          supportSession.context.operatorScopes.includes(item.operatorId),
        )
        .map((item) => Object.freeze({ context: supportSession.context, ...item }));
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "AUTHORIZATION_DENIED") {
        throw error;
      }
    }

    try {
      const safetySession = this.access.authorizeTripCaseManagement(actor, {
        action: "list_safety_cases",
        module: "safety_cases",
        resourceType: "safety_case",
        resourceId: "collection",
        allowedRoles: ["safety_officer", "safety_lead", "auditor"],
        caseGateRequired: true,
      });
      context ??= safetySession.context;
      safetyInvestigations = [...this.safetyInvestigations.values()]
        .filter((item) => {
          const trip = this.tripSnapshots().get(item.tripId);
          return Boolean(
            trip &&
              safetySession.context.operatorScopes.includes(trip.operatorId),
          );
        })
        .map((item) =>
          Object.freeze({ context: safetySession.context, ...item }),
        );
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "AUTHORIZATION_DENIED") {
        throw error;
      }
    }

    if (!context) throw new Error("AUTHORIZATION_DENIED");
    return Object.freeze({
      context,
      supportCases: Object.freeze(supportCases),
      safetyInvestigations: Object.freeze(safetyInvestigations),
    });
  }

  public getSupportCase(
    actor: AdminAccessActor,
    supportCaseId: string,
  ): AdminSupportCase {
    this.requireCaseEnabled();
    const supportCase = required(
      this.supportCases,
      supportCaseId,
      "ADMIN_SUPPORT_CASE_NOT_FOUND",
    );
    const session = this.access.authorizeTripCaseManagement(actor, {
      action: "view_support_case",
      module: "support_cases",
      resourceType: "support_case",
      resourceId: supportCaseId,
      operatorId: supportCase.operatorId,
      allowedRoles: ["customer_support_agent", "platform_operations_lead", "auditor"],
      caseGateRequired: true,
    });
    return Object.freeze({ context: session.context, ...supportCase });
  }

  public getSafetyInvestigation(
    actor: AdminAccessActor,
    safetyCaseId: string,
  ): AdminSafetyInvestigation {
    this.requireCaseEnabled();
    const investigation = required(
      this.safetyInvestigations,
      safetyCaseId,
      "ADMIN_SAFETY_CASE_NOT_FOUND",
    );
    const trip = required(
      this.tripSnapshots(),
      investigation.tripId,
      "ADMIN_TRIP_NOT_FOUND",
    );
    const session = this.access.authorizeTripCaseManagement(actor, {
      action: "view_safety_investigation",
      module: "safety_cases",
      resourceType: "safety_case",
      resourceId: safetyCaseId,
      operatorId: trip.operatorId,
      allowedRoles: ["safety_officer", "safety_lead", "auditor"],
      caseGateRequired: true,
    });
    return Object.freeze({ context: session.context, ...investigation });
  }

  public getEvidenceGrant(
    actor: AdminAccessActor,
    grantId: string,
  ): AdminEvidenceGrant {
    this.requireCaseEnabled();
    const grant = required(
      this.evidenceGrants,
      grantId,
      "ADMIN_EVIDENCE_GRANT_NOT_FOUND",
    );
    const session = this.authorizeEvidence(actor, grant, "view_evidence_grant");
    return Object.freeze({ context: session.context, ...grant });
  }

  public listEvidenceGrantsForSafetyCase(
    actor: AdminAccessActor,
    safetyCaseId: string,
  ): readonly AdminEvidenceGrant[] {
    this.requireCaseEnabled();
    const investigation = required(
      this.safetyInvestigations,
      safetyCaseId,
      "ADMIN_SAFETY_CASE_NOT_FOUND",
    );
    const session = this.authorizeSafety(
      actor,
      investigation,
      "list_evidence_grants",
      ["safety_officer", "safety_lead", "auditor"],
      "evidence_access",
    );
    return Object.freeze(
      [...this.evidenceGrants.values()]
        .filter((grant) => grant.safetyCaseId === safetyCaseId)
        .map((grant) => Object.freeze({ context: session.context, ...grant })),
    );
  }

  public readEvidenceField(
    actor: AdminAccessActor,
    grantId: string,
    field: AdminEvidenceFieldResult["field"],
  ): AdminEvidenceFieldResult {
    this.requireCaseEnabled();
    const grant = required(
      this.evidenceGrants,
      grantId,
      "ADMIN_EVIDENCE_GRANT_NOT_FOUND",
    );
    this.authorizeEvidence(actor, grant, "read_evidence_field");
    if (!grant.requestedFields.includes(field)) {
      throw new Error("ADMIN_EVIDENCE_FIELD_NOT_GRANTED");
    }
    if (new Date(grant.expiresAt).getTime() <= this.now().getTime()) {
      throw new Error("ADMIN_EVIDENCE_GRANT_EXPIRED");
    }
    if (field === "raw_chat" && !grant.dualApprovalSatisfied) {
      throw new Error("ADMIN_EVIDENCE_DUAL_APPROVAL_REQUIRED");
    }
    if (grant.state !== "approved" && grant.state !== "active") {
      throw new Error("ADMIN_EVIDENCE_GRANT_INACTIVE");
    }
    this.access.recordTripCaseManagementEvent(actor, {
      eventType: "evidence_field_viewed",
      action: "read_evidence_field",
      resourceType: "evidence_grant",
      resourceId: grantId,
      reasonCode: field,
    });
    return Object.freeze({
      grantId,
      field,
      value: evidenceValue(field),
      expiresAt: grant.expiresAt,
      synthetic: true,
    });
  }

  public getCommandRecoveryTask(
    actor: AdminAccessActor,
    recoveryTaskId: string,
  ): AdminCommandRecoveryTask {
    this.requireCaseEnabled();
    const task = required(
      this.recoveryTasks,
      recoveryTaskId,
      "ADMIN_RECOVERY_TASK_NOT_FOUND",
    );
    const session = this.access.authorizeTripCaseManagement(actor, {
      action: "view_command_recovery",
      module: "command_recovery",
      resourceType: "recovery_task",
      resourceId: recoveryTaskId,
      allowedRoles: ["technical_operations"],
      caseGateRequired: true,
    });
    return Object.freeze({ context: session.context, ...task });
  }

  public executeCommand(
    actor: AdminAccessActor,
    idempotencyKey: string,
    command: AdminTripCaseManagementCommand,
  ): AdminTripCaseManagementCommandResult {
    if (!idempotencyKey.trim()) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
    const replayKey = `${actor.token}:${idempotencyKey}`;
    const requestDigest = digest(JSON.stringify(command));
    const existing = this.commandResults.get(replayKey);
    if (existing) {
      if (existing.requestDigest !== requestDigest) {
        throw new Error("CONFLICT_IDEMPOTENCY_KEY_REUSED");
      }
      return existing.result;
    }
    const session = this.access.getSession(actor);
    if (
      session.functionalRoles.includes("technical_operations") &&
      command.type !== "query_command_recovery"
    ) {
      throw new Error("ADMIN_RECOVERY_BUSINESS_DECISION_FORBIDDEN");
    }

    const result = this.executeNewCommand(actor, command);
    this.commandResults.set(replayKey, Object.freeze({ requestDigest, result }));
    return result;
  }

  private executeNewCommand(
    actor: AdminAccessActor,
    command: AdminTripCaseManagementCommand,
  ): AdminTripCaseManagementCommandResult {
    switch (command.type) {
      case "triage_trip_operation":
        return this.triageTripOperation(actor, command);
      case "request_trip_domain_action":
        return this.requestTripDomainAction(actor, command);
      case "update_support_case":
        return this.updateSupportCase(actor, command);
      case "escalate_support_case":
        return this.escalateSupportCase(actor, command);
      case "submit_safety_investigation":
        return this.submitSafetyInvestigation(actor, command);
      case "review_safety_restoration":
        return this.reviewSafetyRestoration(actor, command);
      case "request_evidence_access":
        return this.requestEvidenceAccess(actor, command);
      case "approve_evidence_access":
        return this.approveEvidenceAccess(actor, command);
      case "revoke_evidence_access":
        return this.revokeEvidenceAccess(actor, command);
      case "query_command_recovery":
        return this.queryCommandRecovery(actor, command);
    }
  }

  private triageTripOperation(
    actor: AdminAccessActor,
    command: Extract<AdminTripCaseManagementCommand, { type: "triage_trip_operation" }>,
  ): AdminTripCaseManagementCommandResult {
    this.requireTripEnabled();
    const task = required(this.operationTasks, command.taskId, "ADMIN_TRIP_TASK_NOT_FOUND");
    this.authorizeTripTask(actor, task, "triage_trip_operation");
    if (task.state !== "detected") {
      throw new Error("ADMIN_TRIP_OPERATION_ACTION_INVALID");
    }
    assertVersion(task.resourceVersion, command.resourceVersion);
    const next = Object.freeze({ ...task, state: "triaged" as const, resourceVersion: task.resourceVersion + 1 });
    this.operationTasks.set(task.taskId, next);
    this.access.recordTripCaseManagementEvent(actor, {
      eventType: "trip_operation_task_changed",
      action: command.type,
      resourceType: "trip_operation_task",
      resourceId: task.taskId,
    });
    return result(command.type, "trip_operation_task", task.taskId, next.resourceVersion, next.state);
  }

  private requestTripDomainAction(
    actor: AdminAccessActor,
    command: Extract<AdminTripCaseManagementCommand, { type: "request_trip_domain_action" }>,
  ): AdminTripCaseManagementCommandResult {
    this.requireTripEnabled();
    const task = required(this.operationTasks, command.taskId, "ADMIN_TRIP_TASK_NOT_FOUND");
    this.authorizeTripTask(actor, task, "request_trip_domain_action");
    if (task.state !== "triaged" && task.state !== "coordinating") {
      throw new Error("ADMIN_TRIP_OPERATION_ACTION_INVALID");
    }
    assertVersion(task.resourceVersion, command.resourceVersion);
    const trip = required(this.tripSnapshots(), task.tripId, "ADMIN_TRIP_NOT_FOUND");
    assertVersion(trip.authoritativeVersion, command.expectedTripVersion);
    const next = Object.freeze({
      ...task,
      state: "awaiting_authoritative_result" as const,
      resourceVersion: task.resourceVersion + 1,
    });
    this.operationTasks.set(task.taskId, next);
    this.access.recordTripCaseManagementEvent(actor, {
      eventType: "trip_domain_action_requested",
      action: command.type,
      resourceType: "trip_operation_task",
      resourceId: task.taskId,
      reasonCode: command.reasonCode,
    });
    return result(command.type, "trip_operation_task", task.taskId, next.resourceVersion, next.state);
  }

  private updateSupportCase(
    actor: AdminAccessActor,
    command: Extract<AdminTripCaseManagementCommand, { type: "update_support_case" }>,
  ): AdminTripCaseManagementCommandResult {
    this.requireCaseEnabled();
    const supportCase = required(this.supportCases, command.supportCaseId, "ADMIN_SUPPORT_CASE_NOT_FOUND");
    this.authorizeSupportCase(actor, supportCase, "update_support_case");
    assertVersion(supportCase.resourceVersion, command.resourceVersion);
    if (!canTransitionSupportCase(supportCase.state, command.targetState)) {
      throw new Error("ADMIN_CASE_ACTION_INVALID");
    }
    const next = Object.freeze({
      ...supportCase,
      state: command.targetState,
      resourceVersion: supportCase.resourceVersion + 1,
    });
    this.supportCases.set(supportCase.supportCaseId, next);
    this.access.recordTripCaseManagementEvent(actor, {
      eventType: "support_case_changed",
      action: command.type,
      resourceType: "support_case",
      resourceId: supportCase.supportCaseId,
    });
    return result(command.type, "support_case", supportCase.supportCaseId, next.resourceVersion, next.state);
  }

  private escalateSupportCase(
    actor: AdminAccessActor,
    command: Extract<AdminTripCaseManagementCommand, { type: "escalate_support_case" }>,
  ): AdminTripCaseManagementCommandResult {
    this.requireCaseEnabled();
    const supportCase = required(this.supportCases, command.supportCaseId, "ADMIN_SUPPORT_CASE_NOT_FOUND");
    this.authorizeSupportCase(actor, supportCase, "escalate_support_case");
    assertVersion(supportCase.resourceVersion, command.resourceVersion);
    if (!canTransitionSupportCase(supportCase.state, "escalated")) {
      throw new Error("ADMIN_CASE_ACTION_INVALID");
    }
    const next = Object.freeze({
      ...supportCase,
      state: "escalated" as const,
      resourceVersion: supportCase.resourceVersion + 1,
      investigationSummary: `已隔离升级至 ${command.target}，未披露受限字段`,
    });
    this.supportCases.set(supportCase.supportCaseId, next);
    this.access.recordTripCaseManagementEvent(actor, {
      eventType: "support_case_escalated",
      action: command.type,
      resourceType: "support_case",
      resourceId: supportCase.supportCaseId,
      reasonCode: command.target,
    });
    return result(command.type, "support_case", supportCase.supportCaseId, next.resourceVersion, next.state);
  }

  private submitSafetyInvestigation(
    actor: AdminAccessActor,
    command: Extract<AdminTripCaseManagementCommand, { type: "submit_safety_investigation" }>,
  ): AdminTripCaseManagementCommandResult {
    this.requireCaseEnabled();
    const investigation = required(this.safetyInvestigations, command.safetyCaseId, "ADMIN_SAFETY_CASE_NOT_FOUND");
    this.authorizeSafety(actor, investigation, "submit_safety_investigation", ["safety_officer"]);
    assertVersion(investigation.resourceVersion, command.resourceVersion);
    if (investigation.investigationState !== "investigating") {
      throw new Error("ADMIN_CASE_ACTION_INVALID");
    }
    const next = Object.freeze({
      ...investigation,
      investigationState: "awaiting_independent_review" as const,
      resourceVersion: investigation.resourceVersion + 1,
    });
    this.safetyInvestigations.set(investigation.safetyCaseId, next);
    this.access.recordTripCaseManagementEvent(actor, {
      eventType: "safety_investigation_submitted",
      action: command.type,
      resourceType: "safety_case",
      resourceId: investigation.safetyCaseId,
    });
    return result(command.type, "safety_case", investigation.safetyCaseId, next.resourceVersion, next.investigationState);
  }

  private reviewSafetyRestoration(
    actor: AdminAccessActor,
    command: Extract<AdminTripCaseManagementCommand, { type: "review_safety_restoration" }>,
  ): AdminTripCaseManagementCommandResult {
    this.requireCaseEnabled();
    const investigation = required(this.safetyInvestigations, command.safetyCaseId, "ADMIN_SAFETY_CASE_NOT_FOUND");
    const session = this.authorizeSafety(
      actor,
      investigation,
      "review_safety_restoration",
      ["safety_lead"],
    );
    assertVersion(investigation.resourceVersion, command.resourceVersion);
    if (investigation.investigationState !== "awaiting_independent_review") {
      throw new Error("ADMIN_CASE_ACTION_INVALID");
    }
    if (session.internalUserId === investigation.freezeActorInternalUserId) {
      throw new Error("AUTHORIZATION_DENIED");
    }
    if (
      command.outcome === "restore_access" &&
      investigation.blockers.some((blocker) => blocker.blocking)
    ) {
      this.access.recordTripCaseManagementEvent(actor, {
        eventType: "safety_restoration_blocked",
        action: command.type,
        resourceType: "safety_case",
        resourceId: investigation.safetyCaseId,
        reasonCode: "open_blockers",
      });
      throw new Error("ADMIN_SAFETY_RESTORATION_BLOCKED");
    }
    const next = Object.freeze({
      ...investigation,
      authoritativeState: command.outcome === "restore_access" ? "restored" as const : "upheld" as const,
      investigationState: "completed" as const,
      resourceVersion: investigation.resourceVersion + 1,
    });
    this.safetyInvestigations.set(investigation.safetyCaseId, next);
    this.access.recordTripCaseManagementEvent(actor, {
      eventType: "safety_restoration_reviewed",
      action: command.type,
      resourceType: "safety_case",
      resourceId: investigation.safetyCaseId,
      reasonCode: command.outcome,
    });
    return result(command.type, "safety_case", investigation.safetyCaseId, next.resourceVersion, next.authoritativeState);
  }

  private requestEvidenceAccess(
    actor: AdminAccessActor,
    command: Extract<AdminTripCaseManagementCommand, { type: "request_evidence_access" }>,
  ): AdminTripCaseManagementCommandResult {
    this.requireCaseEnabled();
    if (command.ttlMinutes < 1 || command.ttlMinutes > 30) {
      throw new Error("ADMIN_EVIDENCE_TTL_EXCEEDED");
    }
    const investigation = required(this.safetyInvestigations, command.safetyCaseId, "ADMIN_SAFETY_CASE_NOT_FOUND");
    const session = this.authorizeSafety(
      actor,
      investigation,
      "request_evidence_access",
      ["safety_officer", "safety_lead"],
      "evidence_access",
    );
    const grantId = `evidence-grant-${randomUUID()}`;
    const dualApprovalRequired = command.requestedFields.some(
      (field) => field === "raw_chat" || field === "full_location_trace",
    );
    const grant = Object.freeze<MutableEvidenceGrant>({
      grantId,
      safetyCaseId: command.safetyCaseId,
      ticketId: command.ticketId,
      purposeCode: command.purposeCode,
      requestedFields: Object.freeze([...command.requestedFields]),
      state: dualApprovalRequired ? "requested" : "approved",
      requestedByInternalUserId: session.internalUserId,
      expiresAt: new Date(this.now().getTime() + command.ttlMinutes * 60_000).toISOString(),
      resourceVersion: 1,
      dualApprovalSatisfied: !dualApprovalRequired,
      realEvidenceAllowed: false,
      synthetic: true,
    });
    this.evidenceGrants.set(grantId, grant);
    this.access.recordTripCaseManagementEvent(actor, {
      eventType: "evidence_access_requested",
      action: command.type,
      resourceType: "evidence_grant",
      resourceId: grantId,
    });
    return result(command.type, "evidence_grant", grantId, grant.resourceVersion, grant.state);
  }

  private approveEvidenceAccess(
    actor: AdminAccessActor,
    command: Extract<AdminTripCaseManagementCommand, { type: "approve_evidence_access" }>,
  ): AdminTripCaseManagementCommandResult {
    this.requireCaseEnabled();
    const grant = required(this.evidenceGrants, command.grantId, "ADMIN_EVIDENCE_GRANT_NOT_FOUND");
    const session = this.authorizeEvidence(actor, grant, "approve_evidence_access", ["safety_lead"]);
    assertVersion(grant.resourceVersion, command.resourceVersion);
    if (grant.state !== "requested") {
      throw new Error("ADMIN_CASE_ACTION_INVALID");
    }
    if (session.internalUserId === grant.requestedByInternalUserId) {
      throw new Error("AUTHORIZATION_DENIED");
    }
    const next = Object.freeze<MutableEvidenceGrant>({
      ...grant,
      state: "approved",
      approvedByInternalUserId: session.internalUserId,
      resourceVersion: grant.resourceVersion + 1,
      dualApprovalSatisfied: true,
    });
    this.evidenceGrants.set(grant.grantId, next);
    this.access.recordTripCaseManagementEvent(actor, {
      eventType: "evidence_access_approved",
      action: command.type,
      resourceType: "evidence_grant",
      resourceId: grant.grantId,
    });
    return result(command.type, "evidence_grant", grant.grantId, next.resourceVersion, next.state);
  }

  private revokeEvidenceAccess(
    actor: AdminAccessActor,
    command: Extract<AdminTripCaseManagementCommand, { type: "revoke_evidence_access" }>,
  ): AdminTripCaseManagementCommandResult {
    this.requireCaseEnabled();
    const grant = required(this.evidenceGrants, command.grantId, "ADMIN_EVIDENCE_GRANT_NOT_FOUND");
    this.authorizeEvidence(actor, grant, "revoke_evidence_access", ["safety_lead"]);
    assertVersion(grant.resourceVersion, command.resourceVersion);
    if (grant.state !== "approved" && grant.state !== "active") {
      throw new Error("ADMIN_CASE_ACTION_INVALID");
    }
    const next = Object.freeze<MutableEvidenceGrant>({
      ...grant,
      state: "revoked",
      resourceVersion: grant.resourceVersion + 1,
    });
    this.evidenceGrants.set(grant.grantId, next);
    this.access.recordTripCaseManagementEvent(actor, {
      eventType: "evidence_access_revoked",
      action: command.type,
      resourceType: "evidence_grant",
      resourceId: grant.grantId,
    });
    return result(command.type, "evidence_grant", grant.grantId, next.resourceVersion, next.state);
  }

  private queryCommandRecovery(
    actor: AdminAccessActor,
    command: Extract<AdminTripCaseManagementCommand, { type: "query_command_recovery" }>,
  ): AdminTripCaseManagementCommandResult {
    this.requireCaseEnabled();
    const task = required(this.recoveryTasks, command.recoveryTaskId, "ADMIN_RECOVERY_TASK_NOT_FOUND");
    this.access.authorizeTripCaseManagement(actor, {
      action: "query_command_recovery",
      module: "command_recovery",
      resourceType: "recovery_task",
      resourceId: task.recoveryTaskId,
      allowedRoles: ["technical_operations"],
      caseGateRequired: true,
    });
    if (task.state !== "open") {
      throw new Error("ADMIN_COMMAND_RECOVERY_IN_PROGRESS");
    }
    assertVersion(task.resourceVersion, command.resourceVersion);
    const next = Object.freeze<MutableRecoveryTask>({
      ...task,
      state: "reconciling_authoritative_state",
      resourceVersion: task.resourceVersion + 1,
    });
    this.recoveryTasks.set(task.recoveryTaskId, next);
    this.access.recordTripCaseManagementEvent(actor, {
      eventType: "command_recovery_queried",
      action: command.type,
      resourceType: "recovery_task",
      resourceId: task.recoveryTaskId,
    });
    return result(command.type, "recovery_task", task.recoveryTaskId, next.resourceVersion, next.state);
  }

  private authorizeTripTask(
    actor: AdminAccessActor,
    task: AdminTripOperationTask,
    action: string,
  ): void {
    this.access.authorizeTripCaseManagement(actor, {
      action,
      module: "trip_operations",
      resourceType: "trip_operation_task",
      resourceId: task.taskId,
      operatorId: task.operatorId,
      allowedRoles: ["platform_operations_lead", "operator_operations_lead"],
      tripGateRequired: true,
    });
  }

  private authorizeSupportCase(
    actor: AdminAccessActor,
    supportCase: MutableSupportCase,
    action: string,
  ): void {
    this.access.authorizeTripCaseManagement(actor, {
      action,
      module: "support_cases",
      resourceType: "support_case",
      resourceId: supportCase.supportCaseId,
      operatorId: supportCase.operatorId,
      allowedRoles: ["customer_support_agent", "platform_operations_lead"],
      caseGateRequired: true,
    });
  }

  private authorizeSafety(
    actor: AdminAccessActor,
    investigation: MutableSafetyInvestigation,
    action: string,
    allowedRoles: readonly AdminFunctionalRole[],
    module: "safety_cases" | "evidence_access" = "safety_cases",
  ) {
    const trip = required(this.tripSnapshots(), investigation.tripId, "ADMIN_TRIP_NOT_FOUND");
    return this.access.authorizeTripCaseManagement(actor, {
      action,
      module,
      resourceType: "safety_case",
      resourceId: investigation.safetyCaseId,
      operatorId: trip.operatorId,
      allowedRoles,
      caseGateRequired: true,
    });
  }

  private authorizeEvidence(
    actor: AdminAccessActor,
    grant: MutableEvidenceGrant,
    action: string,
    allowedRoles: readonly AdminFunctionalRole[] = ["safety_officer", "safety_lead"],
  ) {
    const investigation = required(this.safetyInvestigations, grant.safetyCaseId, "ADMIN_SAFETY_CASE_NOT_FOUND");
    return this.authorizeSafety(actor, investigation, action, allowedRoles, "evidence_access");
  }

  private tripSnapshots(): ReadonlyMap<string, SyntheticTripSnapshot> {
    return tripSnapshots;
  }

  private requireTripEnabled(): void {
    if (!this.tripOperationsEnabled) throw new Error("FEATURE_DISABLED");
  }

  private requireCaseEnabled(): void {
    if (!this.caseManagementEnabled) throw new Error("FEATURE_DISABLED");
  }
}

function required<T>(
  values: ReadonlyMap<string, T>,
  id: string,
  errorCode: string,
): T {
  const value = values.get(id);
  if (!value) throw new Error(errorCode);
  return value;
}

function assertVersion(actual: number, expected: number): void {
  if (actual !== expected) throw new Error("ADMIN_RESOURCE_VERSION_CONFLICT");
}

function result(
  commandType: AdminTripCaseManagementCommand["type"],
  resourceType: AdminTripCaseManagementCommandResult["resourceType"],
  resourceId: string,
  resourceVersion: number,
  state: string,
): AdminTripCaseManagementCommandResult {
  return Object.freeze({
    commandType,
    resourceType,
    resourceId,
    resourceVersion,
    state,
    synthetic: true,
  });
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function evidenceValue(field: AdminEvidenceFieldResult["field"]): string {
  switch (field) {
    case "chat_reference":
      return "合成通信引用 CHAT-SYNTHETIC-8421";
    case "raw_chat":
      return "合成证据原文：双方确认已在安全地点结束行程。";
    case "location_window":
      return "合成位置窗口：2026-07-14 15:42—15:47，上海市徐汇区";
    case "full_location_trace":
      return "合成完整位置轨迹：TRACE-SYNTHETIC-8421";
  }
}

const supportTransitions = {
  open: ["assigned", "investigating", "closed"],
  assigned: [
    "investigating",
    "awaiting_user",
    "awaiting_internal",
    "escalated",
    "resolved",
    "closed",
  ],
  investigating: [
    "awaiting_user",
    "awaiting_internal",
    "escalated",
    "resolved",
    "closed",
  ],
  awaiting_user: [
    "investigating",
    "escalated",
    "resolved",
    "closed",
  ],
  awaiting_internal: [
    "investigating",
    "escalated",
    "resolved",
    "closed",
  ],
  escalated: [
    "investigating",
    "awaiting_internal",
    "resolved",
    "closed",
  ],
  resolved: ["closed", "reopened"],
  closed: ["reopened"],
  reopened: [
    "investigating",
    "awaiting_user",
    "awaiting_internal",
    "escalated",
    "resolved",
    "closed",
  ],
} as const satisfies Readonly<
  Record<AdminSupportCase["state"], readonly AdminSupportCase["state"][]>
>;

function canTransitionSupportCase(
  current: AdminSupportCase["state"],
  target: AdminSupportCase["state"],
): boolean {
  return (
    supportTransitions[current] as readonly AdminSupportCase["state"][]
  ).includes(target);
}
