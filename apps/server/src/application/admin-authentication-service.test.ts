import { describe, expect, it } from "vitest";
import { AdminAccessService } from "./admin-access-service.js";
import { AdminAuthenticationService } from "./admin-authentication-service.js";
import {
  AdminOperatorManagementService,
  InMemorySyntheticPrimaryOperatorRelationshipGateway,
} from "./admin-operator-management-service.js";
import { AdminFinanceOperationsService } from "./admin-finance-operations-service.js";
import { AdminTripCaseManagementService } from "./admin-trip-case-management-service.js";
import { ExecutiveDashboardQueryService } from "./executive-dashboard-query-service.js";

describe("运营后台合成认证与授权导航", () => {
  it("成员管理员暂停成员后撤销现有会话并可恢复", () => {
    const now = () => new Date("2026-07-16T13:00:00.000Z");
    const access = new AdminAccessService(true, true, true, true, true, true, now);
    const service = new AdminAuthenticationService(
      true, true, now, false, false, false, false, false, false,
      undefined, true, false, true,
    );
    const administrator = login(
      service,
      "access.admin@rego.example",
      "synthetic-platform-access-admin-001",
    );
    const targetSession = login(
      service,
      "support@rego.example",
      "synthetic-support-001",
    );
    const target = service
      .listMemberships(administrator.accessToken, { search: "平台客服" })
      .items[0]!;
    const suspended = service.performMembershipAction(
      administrator.accessToken,
      target.membershipId,
      {
        action: "suspend_membership",
        idempotencyKey: "membership-suspend-001",
        expectedVersion: target.resourceVersion,
        reasonCode: "access_risk_control",
      },
      access,
      { correlationId: "correlation-membership-001", requestId: "request-membership-001" },
    );
    expect(suspended.detail.item).toMatchObject({
      state: "suspended",
      activeSessionCount: 0,
      resourceVersion: 2,
    });
    expect(() => service.getNavigation(targetSession.accessToken))
      .toThrowError("SESSION_EXPIRED");
    const restored = service.performMembershipAction(
      administrator.accessToken,
      target.membershipId,
      {
        action: "restore_membership",
        idempotencyKey: "membership-restore-001",
        expectedVersion: 2,
        reasonCode: "access_restored",
      },
      access,
      { correlationId: "correlation-membership-002", requestId: "request-membership-002" },
    );
    expect(restored.detail.item).toMatchObject({
      state: "active",
      activeSessionCount: 0,
      resourceVersion: 3,
    });
    expect(restored.detail.auditTrail.map((event) => event.action)).toEqual([
      "admin_membership_suspended",
      "admin_membership_restored",
    ]);
  });

  it("运营公司成员管理员仅能管理本组织且审计角色只读", () => {
    const now = () => new Date("2026-07-16T13:30:00.000Z");
    const access = new AdminAccessService(true, true, true, true, true, true, now);
    const service = new AdminAuthenticationService(
      true, true, now, false, false, false, false, false, false,
      undefined, true, false, true,
    );
    const operatorAdministrator = login(
      service,
      "operator.admin@rego.example",
      "synthetic-operator-account-admin-001",
    );
    const operatorRows = service.listMemberships(
      operatorAdministrator.accessToken,
      {},
    );
    expect(new Set(operatorRows.items.map((item) => item.organizationId))).toEqual(
      new Set(["operator-huhang"]),
    );
    const auditor = login(
      service,
      "audit@rego.example",
      "synthetic-auditor-001",
    );
    const visible = service.listMemberships(auditor.accessToken, {}).items[0]!;
    expect(service.getMembership(
      auditor.accessToken,
      visible.membershipId,
      access,
      { correlationId: "correlation-membership-audit", requestId: "request-membership-audit" },
    ).allowedActions).toEqual([]);
  });
  it("完成登录、多因素验证和多工作身份选择", () => {
    const service = new AdminAuthenticationService(true, true);
    const challenge = service.startLogin("lin.yun@rego.example", "Rego-Internal-2026!");
    const verification = service.verifyMfa(challenge.challengeId, "826419");
    expect(verification.workIdentities.map((identity) => identity.type)).toEqual([
      "platform",
      "operator",
    ]);
    const session = service.selectWorkIdentity(
      verification.selectionToken,
      "synthetic-operator-ops-001",
    );
    expect(session.navigation.items.find((item) =>
      item.id === "operator_management"
    )).toMatchObject({
      availability: "unavailable",
      unavailableReason: "not_implemented",
    });
    expect(session.navigation.organizationContext).toMatchObject({
      organizationType: "operator",
      organizationId: "operator-huhang",
      fixed: true,
    });
    expect(session.navigation.items.find((item) => item.id === "workbench"))
      .toMatchObject({ availability: "available" });
    expect(session.navigation.items.find((item) => item.id === "driver_vehicle"))
      .toMatchObject({
        availability: "unavailable",
        unavailableReason: "not_implemented",
      });
  });

  it("发布前验收补齐运营专员、主体管理、客服负责人和运营公司安全联络身份", () => {
    const service = new AdminAuthenticationService(true, true);
    const samples = [
      ["ops@rego.example", "synthetic-operations-officer-001", "operations_officer"],
      ["ops@rego.example", "synthetic-operator-management-officer-001", "operator_management_officer"],
      ["support@rego.example", "synthetic-support-lead-001", "support_lead"],
      ["safety@rego.example", "synthetic-operator-safety-liaison-001", "operator_safety_liaison"],
    ] as const;

    for (const [email, workIdentityId, productRole] of samples) {
      const session = login(service, email, workIdentityId);
      expect(session.workIdentity.productRole).toBe(productRole);
      expect(session.navigation.items.some(
        (navigationItem) => navigationItem.availability === "available",
      )).toBe(true);
    }
  });

  it("发布前验收角色导航与冻结权限矩阵保持一致", () => {
    const service = new AdminAuthenticationService(
      true, true, undefined, true, true, true, true, true, true,
      undefined, true, true, true,
    );
    const samples = [
      ["access.admin@rego.example", "synthetic-platform-access-admin-001", ["workbench", "organization_accounts", "audit_system"]],
      ["ops@rego.example", "synthetic-operations-officer-001", ["workbench", "operator_management", "driver_vehicle", "trip_operations", "data_reports"]],
      ["ops@rego.example", "synthetic-platform-ops-001", ["workbench", "operator_management", "driver_vehicle", "trip_operations", "data_reports", "executive_dashboard"]],
      ["ops@rego.example", "synthetic-operator-management-officer-001", ["workbench", "operator_management", "driver_vehicle"]],
      ["review@rego.example", "synthetic-reviewer-001", ["workbench", "driver_vehicle"]],
      ["review@rego.example", "synthetic-senior-reviewer-001", ["workbench", "operator_management", "driver_vehicle"]],
      ["support@rego.example", "synthetic-support-001", ["workbench", "trip_operations", "support_safety"]],
      ["support@rego.example", "synthetic-support-lead-001", ["workbench", "trip_operations", "support_safety", "data_reports"]],
      ["safety@rego.example", "synthetic-safety-officer-001", ["workbench", "driver_vehicle", "trip_operations", "support_safety"]],
      ["safety@rego.example", "synthetic-safety-lead-001", ["workbench", "support_safety", "data_reports", "executive_dashboard"]],
      ["finance@rego.example", "synthetic-finance-officer-001", ["workbench", "finance_operations"]],
      ["finance@rego.example", "synthetic-finance-lead-001", ["workbench", "finance_operations", "data_reports", "executive_dashboard"]],
      ["governance@rego.example", "synthetic-privacy-compliance-001", ["workbench", "support_safety", "finance_operations", "data_reports", "executive_dashboard", "audit_system"]],
      ["analytics@rego.example", "synthetic-data-analyst-001", ["workbench", "data_reports"]],
      ["audit@rego.example", "synthetic-auditor-001", ["workbench", "organization_accounts", "operator_management", "driver_vehicle", "trip_operations", "support_safety", "finance_operations", "data_reports", "audit_system"]],
      ["technical@rego.example", "synthetic-technical-ops-001", ["workbench", "audit_system"]],
      ["executive@rego.example", "synthetic-executive-sponsor-001", ["workbench", "data_reports", "executive_dashboard"]],
      ["operator.admin@rego.example", "synthetic-operator-account-admin-001", ["workbench", "organization_accounts", "audit_system"]],
      ["lin.yun@rego.example", "synthetic-operator-ops-001", ["workbench", "operator_management", "driver_vehicle", "trip_operations", "data_reports"]],
      ["fleet@rego.example", "synthetic-operator-fleet-001", ["workbench", "operator_management", "driver_vehicle"]],
      ["support@rego.example", "synthetic-operator-support-001", ["workbench", "trip_operations", "support_safety"]],
      ["safety@rego.example", "synthetic-operator-safety-liaison-001", ["workbench", "driver_vehicle", "trip_operations", "support_safety"]],
      ["finance@rego.example", "synthetic-operator-finance-officer-001", ["workbench", "finance_operations"]],
      ["finance@rego.example", "synthetic-operator-finance-lead-001", ["workbench", "finance_operations", "data_reports"]],
      ["audit@rego.example", "synthetic-operator-auditor-001", ["workbench", "operator_management", "driver_vehicle", "trip_operations", "support_safety", "finance_operations", "data_reports", "audit_system"]],
      ["executive@rego.example", "synthetic-operator-executive-001", ["workbench", "data_reports", "executive_dashboard"]],
    ] as const;

    for (const [email, workIdentityId, expectedDomains] of samples) {
      const session = login(service, email, workIdentityId);
      const actualDomains = session.navigation.items
        .filter((navigationItem) =>
          navigationItem.availability === "available" &&
          session.navigation.routePermissions.includes(
            `${navigationItem.id}:read`,
          ),
        )
        .map((navigationItem) => navigationItem.id);
      expect(actualDomains).toEqual(expectedDomains);
    }
  });

  it("切换工作身份时签发新会话并立即撤销旧访问令牌", () => {
    const service = new AdminAuthenticationService(true, true);
    const challenge = service.startLogin(
      "lin.yun@rego.example",
      "Rego-Internal-2026!",
    );
    const verification = service.verifyMfa(challenge.challengeId, "826419");
    const platformSession = service.selectWorkIdentity(
      verification.selectionToken,
      "synthetic-platform-ops-001",
    );

    const operatorSession = service.switchWorkIdentity(
      platformSession.accessToken,
      "synthetic-operator-ops-001",
    );

    expect(operatorSession.workIdentity).toMatchObject({
      type: "operator",
      organizationId: "operator-huhang",
    });
    expect(operatorSession.sessionFamilyId)
      .not.toBe(platformSession.sessionFamilyId);
    expect(() => service.getNavigation(platformSession.accessToken))
      .toThrow("SESSION_EXPIRED");
    expect(service.getNavigation(operatorSession.accessToken).organizationContext)
      .toMatchObject({
        organizationType: "operator",
        organizationId: "operator-huhang",
        fixed: true,
      });
  });

  it("拒绝篡改或跨组织复用游标", () => {
    const service = new AdminAuthenticationService(true, true);
    const platform = login(service, "ops@rego.example", "synthetic-platform-ops-001");
    const operator = login(service, "lin.yun@rego.example", "synthetic-operator-ops-001");
    const first = service.listOperationsTasks(platform.accessToken, { pageSize: 25 });
    expect(first.items).toHaveLength(25);
    expect(() =>
      service.listOperationsTasks(operator.accessToken, {
        pageSize: 25,
        after: first.pageInfo.endCursor!,
      }),
    ).toThrowError("ADMIN_CURSOR_SCOPE_MISMATCH");
    expect(() =>
      service.listOperationsTasks(platform.accessToken, {
        pageSize: 25,
        after: `${first.pageInfo.endCursor}x`,
      }),
    ).toThrowError("ADMIN_CURSOR_INVALID");
  });

  it("任务详情沿用 Bearer 会话、组织范围和状态化操作权限", () => {
    const service = new AdminAuthenticationService(true, true);
    const platform = login(service, "ops@rego.example", "synthetic-platform-ops-001");
    const operator = login(service, "lin.yun@rego.example", "synthetic-operator-ops-001");
    const visibleTask = service.listOperationsTasks(operator.accessToken, { pageSize: 25 }).items[0]!;

    expect(service.getOperationsTask(operator.accessToken, visibleTask.taskId)).toMatchObject({
      task: { taskId: visibleTask.taskId, operatorName: "沪行出行服务" },
      organizationScope: {
        organizationId: "operator-huhang",
        organizationName: "沪行出行服务",
      },
      allowedActions: ["assign"],
      synthetic: true,
    });

    const crossScopeTask = service
      .listOperationsTasks(platform.accessToken, {
        search: "申城伙伴运营",
        pageSize: 25,
      })
      .items[0]!;
    expect(() => service.getOperationsTask(operator.accessToken, crossScopeTask.taskId))
      .toThrowError("ADMIN_OPERATIONS_TASK_NOT_FOUND");
  });

  it("任务按照分派、处理、复核顺序闭环并追加审计", () => {
    const now = new Date("2026-07-15T09:00:00.000Z");
    const service = new AdminAuthenticationService(true, true, () => new Date(now));
    const lead = login(service, "lin.yun@rego.example", "synthetic-operator-ops-001");
    const officer = login(service, "support@rego.example", "synthetic-support-001");
    const task = service.listOperationsTasks(lead.accessToken, {
      pageSize: 25,
      status: "unassigned",
    }).items[0]!;

    const assigned = service.performOperationsTaskAction(lead.accessToken, task.taskId, {
      action: "assign",
      expectedVersion: task.version,
      idempotencyKey: "assign-ops-1",
      note: "由运营负责人分派",
    });
    expect(assigned).toMatchObject({
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        task: { status: "processing", version: task.version + 1 },
        allowedActions: [],
      },
    });

    const replay = service.performOperationsTaskAction(lead.accessToken, task.taskId, {
      action: "assign",
      expectedVersion: task.version,
      idempotencyKey: "assign-ops-1",
      note: "由运营负责人分派",
    });
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.operationId).toBe(assigned.operationId);

    const processed = service.performOperationsTaskAction(officer.accessToken, task.taskId, {
      action: "process",
      expectedVersion: task.version + 1,
      idempotencyKey: "process-ops-1",
      note: "资料核对完成",
    });
    expect(processed.detail.task.status).toBe("waiting_review");

    const reviewed = service.performOperationsTaskAction(lead.accessToken, task.taskId, {
      action: "review",
      expectedVersion: task.version + 2,
      idempotencyKey: "review-ops-1",
      note: "复核通过",
    });
    expect(reviewed.detail.task).toMatchObject({
      status: "completed",
      version: task.version + 3,
    });
    expect(reviewed.detail.allowedActions).toEqual([]);
    expect(reviewed.detail.auditTrail.map((event) => event.action)).toEqual([
      "task_created",
      "scope_checked",
      "task_assigned",
      "task_processed",
      "task_reviewed",
    ]);
  });

  it("拒绝越权动作、非法状态转换和过期资源版本", () => {
    const service = new AdminAuthenticationService(true, true);
    const lead = login(service, "lin.yun@rego.example", "synthetic-operator-ops-001");
    const officer = login(service, "support@rego.example", "synthetic-support-001");
    const task = service.listOperationsTasks(lead.accessToken, {
      pageSize: 25,
      status: "unassigned",
    }).items[0]!;

    expect(() => service.performOperationsTaskAction(officer.accessToken, task.taskId, {
      action: "assign",
      expectedVersion: task.version,
      idempotencyKey: "forbidden-assign",
    })).toThrowError("AUTHORIZATION_DENIED");

    expect(() => service.performOperationsTaskAction(lead.accessToken, task.taskId, {
      action: "review",
      expectedVersion: task.version,
      idempotencyKey: "invalid-review",
    })).toThrowError("ADMIN_OPERATIONS_TASK_ACTION_INVALID");

    service.performOperationsTaskAction(lead.accessToken, task.taskId, {
      action: "assign",
      expectedVersion: task.version,
      idempotencyKey: "valid-assign",
    });
    expect(() => service.performOperationsTaskAction(officer.accessToken, task.taskId, {
      action: "process",
      expectedVersion: task.version,
      idempotencyKey: "stale-process",
    })).toThrowError("ADMIN_RESOURCE_VERSION_CONFLICT");
  });

  it("运营主体名录沿用 Bearer 会话并按组织范围隔离", () => {
    const { authentication, operatorManagement } =
      createOperatorProductServices();
    const platform = login(
      authentication,
      "ops@rego.example",
      "synthetic-platform-ops-001",
    );
    const operator = login(
      authentication,
      "lin.yun@rego.example",
      "synthetic-operator-ops-001",
    );
    const platformPage = authentication.listOperators(
      platform.accessToken,
      { pageSize: 25, sort: "operator_name_asc" },
      operatorManagement,
      requestContext,
    );
    expect(platformPage.items.map((item) => item.operatorId)).toEqual([
      "operator-huhang",
      "operator-shencheng",
    ]);
    expect(platformPage.summary).toMatchObject({
      totalOperators: 2,
      activeOperators: 1,
      attentionOperators: 1,
    });

    const operatorPage = authentication.listOperators(
      operator.accessToken,
      { pageSize: 25 },
      operatorManagement,
      requestContext,
    );
    expect(operatorPage.items).toHaveLength(1);
    expect(operatorPage.items[0]?.operatorId).toBe("operator-huhang");
    expect(authentication.listOperators(
      platform.accessToken,
      {
        pageSize: 25,
        search: "申城",
        lifecycleState: "onboarding_review",
        sort: "updated_at_desc",
      },
      operatorManagement,
      requestContext,
    ).items.map((item) => item.operatorId)).toEqual(["operator-shencheng"]);
    expect(() =>
      authentication.listOperators(
        operator.accessToken,
        {
          pageSize: 25,
          after: platformPage.pageInfo.endCursor!,
        },
        operatorManagement,
        requestContext,
      )
    ).toThrowError("ADMIN_CURSOR_SCOPE_MISMATCH");
    expect(() =>
      authentication.getOperator(
        operator.accessToken,
        "operator-shencheng",
        operatorManagement,
        requestContext,
      )
    ).toThrowError("ADMIN_OPERATOR_SCOPE_FORBIDDEN");
  });

  it("平台负责人限制和恢复运营主体并追加审计", () => {
    const { authentication, operatorManagement } =
      createOperatorProductServices();
    const platform = login(
      authentication,
      "ops@rego.example",
      "synthetic-platform-ops-001",
    );
    const operator = login(
      authentication,
      "lin.yun@rego.example",
      "synthetic-operator-ops-001",
    );
    const auditor = login(
      authentication,
      "audit@rego.example",
      "synthetic-auditor-001",
    );
    const detail = authentication.getOperator(
      platform.accessToken,
      "operator-huhang",
      operatorManagement,
      requestContext,
    );
    expect(detail.allowedActions).toEqual(["restrict"]);
    expect(authentication.getOperator(
      platform.accessToken,
      "operator-huhang",
      operatorManagement,
      requestContext,
    ).auditTrail.filter((event) =>
      event.action === "operator_profile_viewed"
    )).toHaveLength(1);

    const restricted = authentication.performOperatorAction(
      platform.accessToken,
      "operator-huhang",
      {
        action: "restrict",
        expectedVersion: detail.operator.resourceVersion,
        idempotencyKey: "operator-restrict-0001",
        note: "安全联系人需要重新核验",
      },
      operatorManagement,
      requestContext,
    );
    expect(restricted).toMatchObject({
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        operator: { lifecycleState: "restricted", resourceVersion: 19 },
        allowedActions: ["reactivate"],
      },
    });
    expect(restricted.detail.auditTrail.at(-1)).toMatchObject({
      action: "operator_restricted",
      previousState: "active",
      nextState: "restricted",
      note: "安全联系人需要重新核验",
    });

    const replay = authentication.performOperatorAction(
      platform.accessToken,
      "operator-huhang",
      {
        action: "restrict",
        expectedVersion: detail.operator.resourceVersion,
        idempotencyKey: "operator-restrict-0001",
        note: "安全联系人需要重新核验",
      },
      operatorManagement,
      requestContext,
    );
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.operationId).toBe(restricted.operationId);

    expect(() =>
      authentication.performOperatorAction(
        operator.accessToken,
        "operator-huhang",
        {
          action: "reactivate",
          expectedVersion: 19,
          idempotencyKey: "operator-reactivate-forbidden",
          note: "运营公司不得自行恢复",
        },
        operatorManagement,
        requestContext,
      )
    ).toThrowError("ADMIN_OPERATOR_ACTION_INVALID");
    expect(authentication.getOperator(
      auditor.accessToken,
      "operator-huhang",
      operatorManagement,
      requestContext,
    ).allowedActions).toEqual([]);
    expect(() =>
      authentication.performOperatorAction(
        auditor.accessToken,
        "operator-huhang",
        {
          action: "reactivate",
          expectedVersion: 19,
          idempotencyKey: "operator-reactivate-auditor",
          note: "审计角色不得写入",
        },
        operatorManagement,
        requestContext,
      )
    ).toThrowError("ADMIN_OPERATOR_ACTION_INVALID");

    const reactivated = authentication.performOperatorAction(
      platform.accessToken,
      "operator-huhang",
      {
        action: "reactivate",
        expectedVersion: 19,
        idempotencyKey: "operator-reactivate-0001",
        note: "复核通过，恢复运营",
      },
      operatorManagement,
      requestContext,
    );
    expect(reactivated.detail.operator.lifecycleState).toBe("active");
    expect(reactivated.detail.auditTrail.filter((event) =>
      event.action !== "operator_profile_viewed"
    )).toHaveLength(2);
  });

  it("运营主体写操作拒绝过期版本和幂等键换载荷", () => {
    const { authentication, operatorManagement } =
      createOperatorProductServices();
    const platform = login(
      authentication,
      "ops@rego.example",
      "synthetic-platform-ops-001",
    );
    authentication.performOperatorAction(
      platform.accessToken,
      "operator-huhang",
      {
        action: "restrict",
        expectedVersion: 18,
        idempotencyKey: "operator-version-0001",
        note: "首次限制",
      },
      operatorManagement,
      requestContext,
    );
    expect(() =>
      authentication.performOperatorAction(
        platform.accessToken,
        "operator-huhang",
        {
          action: "reactivate",
          expectedVersion: 18,
          idempotencyKey: "operator-version-stale",
          note: "使用过期版本恢复",
        },
        operatorManagement,
        requestContext,
      )
    ).toThrowError("ADMIN_RESOURCE_VERSION_CONFLICT");
    expect(() =>
      authentication.performOperatorAction(
        platform.accessToken,
        "operator-huhang",
        {
          action: "restrict",
          expectedVersion: 18,
          idempotencyKey: "operator-version-0001",
          note: "更换请求载荷",
        },
        operatorManagement,
        requestContext,
      )
    ).toThrowError("CONFLICT_IDEMPOTENCY_KEY_REUSED");
  });

  it("客服与安全名录按角色和组织范围返回不同案件", () => {
    const { authentication, tripCaseManagement } =
      createCaseProductServices();
    const support = login(
      authentication,
      "support@rego.example",
      "synthetic-support-001",
    );
    const operatorSupport = login(
      authentication,
      "support@rego.example",
      "synthetic-operator-support-001",
    );
    const safety = login(
      authentication,
      "safety@rego.example",
      "synthetic-safety-officer-001",
    );
    const auditor = login(
      authentication,
      "audit@rego.example",
      "synthetic-auditor-001",
    );

    expect(support.navigation.items.find((item) => item.id === "support_safety"))
      .toMatchObject({ availability: "available" });
    expect(authentication.listCases(
      support.accessToken,
      { pageSize: 25 },
      tripCaseManagement,
      requestContext,
    ).items.map((item) => item.kind)).toEqual(["support", "support"]);
    expect(authentication.listCases(
      operatorSupport.accessToken,
      { pageSize: 25 },
      tripCaseManagement,
      requestContext,
    ).items.map((item) => item.caseId)).toEqual(["support-synthetic-8421"]);
    expect(authentication.listCases(
      safety.accessToken,
      { pageSize: 25 },
      tripCaseManagement,
      requestContext,
    ).items.map((item) => item.kind)).toEqual(["safety"]);
    expect(authentication.listCases(
      auditor.accessToken,
      { pageSize: 25, sort: "case_id_asc" },
      tripCaseManagement,
      requestContext,
    ).items.map((item) => item.caseId)).toEqual([
      "safety-synthetic-8421",
      "support-synthetic-114",
      "support-synthetic-8421",
    ]);
  });

  it("客服案件完成状态操作、幂等结果和追加式审计", () => {
    const { authentication, tripCaseManagement } =
      createCaseProductServices();
    const support = login(
      authentication,
      "support@rego.example",
      "synthetic-support-001",
    );
    const detail = authentication.getCase(
      support.accessToken,
      "support",
      "support-synthetic-114",
      tripCaseManagement,
      requestContext,
    );
    expect(detail).toMatchObject({
      kind: "support",
      allowedActions: expect.arrayContaining([
        "await_user",
        "resolve",
        "escalate_safety",
      ]),
    });
    expect(detail.allowedActions).not.toContain("continue_investigation");

    const resolved = authentication.performCaseAction(
      support.accessToken,
      "support",
      "support-synthetic-114",
      {
        action: "resolve",
        expectedVersion: detail.case.resourceVersion,
        idempotencyKey: "support-resolve-product-1",
        note: "已向乘客确认计划接驾安排",
      },
      tripCaseManagement,
      requestContext,
    );
    expect(resolved).toMatchObject({
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        kind: "support",
        profile: { state: "resolved", resourceVersion: 6 },
        allowedActions: ["close", "reopen"],
      },
    });
    expect(resolved.detail.auditTrail.at(-1)).toMatchObject({
      action: "support_case_state_changed",
      previousState: "investigating",
      nextState: "resolved",
      note: "已向乘客确认计划接驾安排",
    });

    const replay = authentication.performCaseAction(
      support.accessToken,
      "support",
      "support-synthetic-114",
      {
        action: "resolve",
        expectedVersion: detail.case.resourceVersion,
        idempotencyKey: "support-resolve-product-1",
        note: "已向乘客确认计划接驾安排",
      },
      tripCaseManagement,
      requestContext,
    );
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.operationId).toBe(resolved.operationId);
  });

  it("安全案件执行调查提交、独立复核和只读审计隔离", () => {
    const { authentication, tripCaseManagement } =
      createCaseProductServices();
    const officer = login(
      authentication,
      "safety@rego.example",
      "synthetic-safety-officer-001",
    );
    const lead = login(
      authentication,
      "safety@rego.example",
      "synthetic-safety-lead-001",
    );
    const auditor = login(
      authentication,
      "audit@rego.example",
      "synthetic-auditor-001",
    );
    const detail = authentication.getCase(
      officer.accessToken,
      "safety",
      "safety-synthetic-8421",
      tripCaseManagement,
      requestContext,
    );
    expect(detail.allowedActions).toContain("submit_investigation");

    const submitted = authentication.performCaseAction(
      officer.accessToken,
      "safety",
      "safety-synthetic-8421",
      {
        action: "submit_investigation",
        expectedVersion: detail.case.resourceVersion,
        idempotencyKey: "safety-submit-product-1",
      },
      tripCaseManagement,
      requestContext,
    );
    expect(submitted.detail).toMatchObject({
      kind: "safety",
      investigation: { investigationState: "awaiting_independent_review" },
      allowedActions: ["request_evidence"],
    });

    const leadDetail = authentication.getCase(
      lead.accessToken,
      "safety",
      "safety-synthetic-8421",
      tripCaseManagement,
      requestContext,
    );
    expect(leadDetail.allowedActions).not.toContain("restore_access");
    expect(leadDetail.allowedActions).toContain("uphold_freeze");
    const upheld = authentication.performCaseAction(
      lead.accessToken,
      "safety",
      "safety-synthetic-8421",
      {
        action: "uphold_freeze",
        expectedVersion: leadDetail.case.resourceVersion,
        idempotencyKey: "safety-uphold-product-1",
        note: "阻断项仍有效，维持冻结",
      },
      tripCaseManagement,
      requestContext,
    );
    expect(upheld.detail).toMatchObject({
      kind: "safety",
      investigation: {
        investigationState: "completed",
        authoritativeState: "upheld",
      },
    });

    const auditDetail = authentication.getCase(
      auditor.accessToken,
      "safety",
      "safety-synthetic-8421",
      tripCaseManagement,
      requestContext,
    );
    expect(auditDetail.allowedActions).toEqual([]);
    expect(() => authentication.performCaseAction(
      auditor.accessToken,
      "safety",
      "safety-synthetic-8421",
      {
        action: "restore_access",
        expectedVersion: auditDetail.case.resourceVersion,
        idempotencyKey: "safety-auditor-forbidden",
      },
      tripCaseManagement,
      requestContext,
    )).toThrowError("ADMIN_CASE_ACTION_INVALID");
  });

  it("财务名录按平台、运营公司和审计角色隔离范围与动作", () => {
    const { authentication, financeOperations } =
      createFinanceProductServices();
    const platformOfficer = login(
      authentication,
      "finance@rego.example",
      "synthetic-finance-officer-001",
    );
    const operatorOfficer = login(
      authentication,
      "finance@rego.example",
      "synthetic-operator-finance-officer-001",
    );
    const auditor = login(
      authentication,
      "audit@rego.example",
      "synthetic-auditor-001",
    );

    expect(platformOfficer.navigation.items.find(
      (item) => item.id === "finance_operations",
    )).toMatchObject({ label: "财务与对账", availability: "available" });
    const platformPage = authentication.listFinanceResources(
      platformOfficer.accessToken,
      { pageSize: 25 },
      financeOperations,
      requestContext,
    );
    expect(platformPage.summary).toMatchObject({
      totalResources: 10,
      blockingResources: 4,
      unknownResults: 1,
    });
    const operatorPage = authentication.listFinanceResources(
      operatorOfficer.accessToken,
      { pageSize: 25, sort: "resource_id_asc" },
      financeOperations,
      requestContext,
    );
    expect(operatorPage.summary.totalResources).toBe(5);
    expect(operatorPage.items.every(
      (item) => !item.operatorId || item.operatorId === "operator-huhang",
    )).toBe(true);
    expect(operatorPage.items.every(
      (item) => item.operatorName !== "平台范围",
    )).toBe(true);
    expect(operatorPage.items.map((item) => item.resourceId))
      .not.toContain("settlement-synthetic-blocked");

    const operatorPayout = authentication.getFinanceResource(
      operatorOfficer.accessToken,
      "payout",
      "payout-synthetic-0714",
      financeOperations,
      requestContext,
    );
    expect(operatorPayout.allowedActions).toEqual(["prepare_driver_payout"]);
    const auditSettlement = authentication.getFinanceResource(
      auditor.accessToken,
      "settlement",
      "settlement-synthetic-184",
      financeOperations,
      requestContext,
    );
    expect(auditSettlement.allowedActions).toEqual([]);
  });

  it("财务结算完成经办、独立复核、幂等结果和追加式审计", () => {
    const { authentication, financeOperations } =
      createFinanceProductServices();
    const officer = login(
      authentication,
      "finance@rego.example",
      "synthetic-finance-officer-001",
    );
    const lead = login(
      authentication,
      "finance@rego.example",
      "synthetic-finance-lead-001",
    );
    const detail = authentication.getFinanceResource(
      officer.accessToken,
      "settlement",
      "settlement-synthetic-184",
      financeOperations,
      requestContext,
    );
    expect(detail.allowedActions).toEqual(["prepare_operator_settlement"]);
    const prepared = authentication.performFinanceAction(
      officer.accessToken,
      "settlement",
      "settlement-synthetic-184",
      {
        action: "prepare_operator_settlement",
        expectedVersion: detail.item.resourceVersion,
        idempotencyKey: "finance-product-settlement-prepare-1",
        reasonCode: "daily_settlement",
      },
      financeOperations,
      requestContext,
    );
    expect(prepared).toMatchObject({
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        item: { state: "ready", resourceVersion: 2 },
        allowedActions: [],
      },
    });
    expect(prepared.detail.auditTrail.at(-1)).toMatchObject({
      action: "finance_operation_submitted",
      previousState: "eligible",
      nextState: "ready",
    });
    const replay = authentication.performFinanceAction(
      officer.accessToken,
      "settlement",
      "settlement-synthetic-184",
      {
        action: "prepare_operator_settlement",
        expectedVersion: detail.item.resourceVersion,
        idempotencyKey: "finance-product-settlement-prepare-1",
        reasonCode: "daily_settlement",
      },
      financeOperations,
      requestContext,
    );
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.operationId).toBe(prepared.operationId);

    const reviewDetail = authentication.getFinanceResource(
      lead.accessToken,
      "settlement",
      "settlement-synthetic-184",
      financeOperations,
      requestContext,
    );
    expect(reviewDetail.allowedActions).toEqual(["review_operator_settlement"]);
    const reviewed = authentication.performFinanceAction(
      lead.accessToken,
      "settlement",
      "settlement-synthetic-184",
      {
        action: "review_operator_settlement",
        expectedVersion: reviewDetail.item.resourceVersion,
        idempotencyKey: "finance-product-settlement-review-1",
        reasonCode: "independent_review",
      },
      financeOperations,
      requestContext,
    );
    expect(reviewed.detail).toMatchObject({
      item: { state: "succeeded", resourceVersion: 3 },
      allowedActions: [],
    });
    expect(reviewed.detail.auditTrail.at(-1)).toMatchObject({
      action: "finance_review_recorded",
      previousState: "ready",
      nextState: "succeeded",
    });
  });

  it("刷新令牌轮换后重放会撤销会话族", () => {
    const service = new AdminAuthenticationService(true, true);
    const session = login(service, "ops@rego.example", "synthetic-platform-ops-001");
    const refreshed = service.refreshSession(session.refreshToken);
    expect(() => service.refreshSession(session.refreshToken)).toThrowError(
      "REFRESH_TOKEN_REPLAYED",
    );
    expect(() => service.getNavigation(refreshed.accessToken)).toThrowError(
      "SESSION_EXPIRED",
    );
  });

  it("高层驾驶舱提供范围内名录、详情、治理意见与追加式审计", () => {
    const { authentication, executiveDashboard } =
      createExecutiveProductServices();
    const sponsor = login(
      authentication,
      "executive@rego.example",
      "synthetic-executive-sponsor-001",
    );
    expect(
      sponsor.navigation.items.find((item) => item.id === "executive_dashboard"),
    ).toMatchObject({ availability: "available" });
    const page = authentication.listExecutiveResources(
      sponsor.accessToken,
      { pageSize: 25, kind: "decision_item" },
      executiveDashboard,
      requestContext,
    );
    expect(page.summary.openDecisionItems).toBe(3);
    expect(page.items).toHaveLength(3);
    const detail = authentication.getExecutiveResource(
      sponsor.accessToken,
      "decision_item",
      "decision-operator-haiwan",
      executiveDashboard,
      requestContext,
    );
    expect(detail.allowedActions).toEqual(["record_decision_opinion"]);
    const result = authentication.performExecutiveAction(
      sponsor.accessToken,
      "decision_item",
      "decision-operator-haiwan",
      {
        action: "record_decision_opinion",
        idempotencyKey: "executive-product-opinion-001",
        expectedVersion: detail.item.resourceVersion,
        decisionCode: "continue_controlled_review",
        reasonCode: "finance_blocker_open",
        responsibleRole: "operations_lead",
        dueAt: "2026-07-23T10:00:00.000Z",
      },
      executiveDashboard,
      requestContext,
    );
    expect(result).toMatchObject({
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        item: { resourceVersion: 2 },
      },
    });
    expect(
      result.detail.kind === "decision_item"
        ? result.detail.record.opinions
        : [],
    ).toHaveLength(1);
    expect(result.detail.auditTrail.at(-1)).toMatchObject({
      action: "executive_decision_opinion_recorded",
      reasonCode: "finance_blocker_open",
    });
  });

  it("高层受控导出按隐私与职责域双人复核并支持申请人单次下载", () => {
    const { authentication, executiveDashboard } =
      createExecutiveProductServices();
    const sponsor = login(
      authentication,
      "executive@rego.example",
      "synthetic-executive-sponsor-001",
    );
    const privacy = login(
      authentication,
      "governance@rego.example",
      "synthetic-privacy-compliance-001",
    );
    const operationsLead = login(
      authentication,
      "ops@rego.example",
      "synthetic-platform-ops-001",
    );
    const created = authentication.performExecutiveAction(
      sponsor.accessToken,
      "export_request",
      "new",
      {
        action: "create_export_request",
        idempotencyKey: "executive-product-export-create-001",
        domain: "operations",
        purpose: "内部经营复盘",
        fieldSet: ["trip_completion_rate"],
        windowStart: "2026-07-09T10:00:00.000Z",
        windowEnd: "2026-07-16T10:00:00.000Z",
      },
      executiveDashboard,
      requestContext,
    );
    expect(created.detail.item.state).toBe("awaiting_privacy_review");
    const exportRequestId = created.detail.item.resourceId;
    const privacyDetail = authentication.getExecutiveResource(
      privacy.accessToken,
      "export_request",
      exportRequestId,
      executiveDashboard,
      requestContext,
    );
    expect(privacyDetail.allowedActions).toEqual([
      "privacy_approve_export",
      "privacy_reject_export",
    ]);
    const privacyApproved = authentication.performExecutiveAction(
      privacy.accessToken,
      "export_request",
      exportRequestId,
      {
        action: "privacy_approve_export",
        idempotencyKey: "executive-product-export-privacy-001",
        expectedVersion: privacyDetail.item.resourceVersion,
        reasonCode: "privacy_passed",
      },
      executiveDashboard,
      requestContext,
    );
    expect(privacyApproved.detail.item.state).toBe("awaiting_domain_review");
    const domainDetail = authentication.getExecutiveResource(
      operationsLead.accessToken,
      "export_request",
      exportRequestId,
      executiveDashboard,
      requestContext,
    );
    expect(domainDetail.allowedActions).toEqual([
      "domain_approve_export",
      "domain_reject_export",
    ]);
    const approved = authentication.performExecutiveAction(
      operationsLead.accessToken,
      "export_request",
      exportRequestId,
      {
        action: "domain_approve_export",
        idempotencyKey: "executive-product-export-domain-001",
        expectedVersion: domainDetail.item.resourceVersion,
        reasonCode: "operations_passed",
      },
      executiveDashboard,
      requestContext,
    );
    expect(approved.detail.item.state).toBe("approved");
    const requesterDetail = authentication.getExecutiveResource(
      sponsor.accessToken,
      "export_request",
      exportRequestId,
      executiveDashboard,
      requestContext,
    );
    expect(requesterDetail.allowedActions).toContain("download_export");
    const downloaded = authentication.performExecutiveAction(
      sponsor.accessToken,
      "export_request",
      exportRequestId,
      {
        action: "download_export",
        idempotencyKey: "executive-product-export-download-001",
        expectedVersion: requesterDetail.item.resourceVersion,
      },
      executiveDashboard,
      requestContext,
    );
    expect(downloaded.detail.item.state).toBe("downloaded");
    expect(downloaded.download?.deletedAfterDownload).toBe(true);
  });

  it("运营主体负责人只看到本主体健康度、待决事项和导出申请", () => {
    const { authentication, executiveDashboard } =
      createExecutiveProductServices();
    const operatorExecutive = login(
      authentication,
      "executive@rego.example",
      "synthetic-operator-executive-001",
    );
    const page = authentication.listExecutiveResources(
      operatorExecutive.accessToken,
      { pageSize: 100 },
      executiveDashboard,
      requestContext,
    );
    expect(
      page.items
        .filter((item) => item.kind === "operator_health")
        .map((item) => item.operatorId),
    ).toEqual(["operator-huhang"]);
    expect(
      page.items
        .filter((item) => item.kind === "decision_item")
        .map((item) => item.resourceId),
    ).toEqual(["decision-safety-restoration"]);
  });

  it("审计与系统提供事件名录、只读审计角色和技术调查闭环", () => {
    const { authentication, access } = createAuditProductServices();
    access.getPlatformWorkbench({
      token: "synthetic-platform-ops-001",
      correlationId: "audit-seed-platform",
      requestId: "audit-seed-platform",
    });
    access.getOperatorWorkbench({
      token: "synthetic-operator-auditor-001",
      correlationId: "audit-seed-operator",
      requestId: "audit-seed-operator",
    });
    const technical = login(
      authentication,
      "technical@rego.example",
      "synthetic-technical-ops-001",
    );
    expect(
      technical.navigation.items.find((item) => item.id === "audit_system"),
    ).toMatchObject({ availability: "available" });
    const page = authentication.listAuditResources(
      technical.accessToken,
      { pageSize: 25, kind: "event" },
      access,
      requestContext,
    );
    const source = page.items.find(
      (item) => item.organizationType === "platform",
    );
    expect(source).toBeDefined();
    const eventDetail = authentication.getAuditResource(
      technical.accessToken,
      "event",
      source!.resourceId,
      access,
      requestContext,
    );
    expect(eventDetail.allowedActions).toEqual(["open_investigation"]);
    const opened = authentication.performAuditAction(
      technical.accessToken,
      "event",
      source!.resourceId,
      {
        action: "open_investigation",
        expectedVersion: eventDetail.item.resourceVersion,
        idempotencyKey: "audit-product-open-investigation-001",
        reasonCode: "access_pattern_review",
      },
      access,
      requestContext,
    );
    expect(opened.detail).toMatchObject({
      kind: "investigation",
      item: { result: "open", resourceVersion: 1 },
      allowedActions: [
        "assign_investigation",
        "add_investigation_note",
        "resolve_investigation",
      ],
    });
    const assigned = authentication.performAuditAction(
      technical.accessToken,
      "investigation",
      opened.detail.item.resourceId,
      {
        action: "assign_investigation",
        expectedVersion: opened.detail.item.resourceVersion,
        idempotencyKey: "audit-product-assign-investigation-001",
        reasonCode: "technical_owner_assigned",
        assigneeWorkIdentityId: "synthetic-technical-ops-001",
      },
      access,
      requestContext,
    );
    expect(assigned.detail.item).toMatchObject({
      result: "in_review",
      resourceVersion: 2,
    });

    const auditor = login(
      authentication,
      "audit@rego.example",
      "synthetic-auditor-001",
    );
    const readOnly = authentication.getAuditResource(
      auditor.accessToken,
      "investigation",
      opened.detail.item.resourceId,
      access,
      requestContext,
    );
    expect(readOnly.allowedActions).toEqual([]);

    const operatorAuditor = login(
      authentication,
      "audit@rego.example",
      "synthetic-operator-auditor-001",
    );
    const operatorPage = authentication.listAuditResources(
      operatorAuditor.accessToken,
      { pageSize: 100 },
      access,
      requestContext,
    );
    expect(
      operatorPage.items.every(
        (item) => item.organizationId === "operator-huhang",
      ),
    ).toBe(true);
  });

  it("数据与报表提供去标识名录、刷新确认、幂等重放和追加式审计", () => {
    const { authentication, access } = createDataReportProductServices();
    const analyst = login(
      authentication,
      "analytics@rego.example",
      "synthetic-data-analyst-001",
    );
    expect(
      analyst.navigation.items.find((item) => item.id === "data_reports"),
    ).toMatchObject({ availability: "available" });

    const page = authentication.listDataReports(
      analyst.accessToken,
      { pageSize: 25, sort: "report_id_asc" },
      access,
      requestContext,
    );
    expect(page.summary).toMatchObject({
      totalReports: 4,
      readyReports: 4,
      totalMetrics: 12,
    });
    expect(page.items.map((item) => item.reportId)).toEqual([
      "audit-activity",
      "finance-control",
      "operations-health",
      "safety-compliance",
    ]);
    expect(authentication.listDataReports(
      analyst.accessToken,
      { search: "财务", domain: "finance", pageSize: 25 },
      access,
      requestContext,
    ).items.map((item) => item.reportId)).toEqual(["finance-control"]);

    const detail = authentication.getDataReport(
      analyst.accessToken,
      "operations-health",
      access,
      requestContext,
    );
    expect(detail.allowedActions).toEqual(["refresh_report"]);
    expect(detail.sourceBoundary).toEqual({
      aggregateOnly: true,
      personLevelDataAvailable: false,
      realDataAvailable: false,
      exportAvailable: false,
    });

    const command = {
      action: "refresh_report" as const,
      expectedVersion: detail.item.resourceVersion,
      idempotencyKey: "data-report-refresh-001",
      reasonCode: "scheduled_quality_review",
    };
    const refreshed = authentication.performDataReportAction(
      analyst.accessToken,
      "operations-health",
      command,
      access,
      requestContext,
    );
    expect(refreshed).toMatchObject({
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        item: { resourceVersion: 2 },
      },
    });
    expect(refreshed.detail.auditTrail.at(-1)).toMatchObject({
      action: "data_report_refreshed",
      previousVersion: 1,
      nextVersion: 2,
      reasonCode: "scheduled_quality_review",
    });
    expect(authentication.performDataReportAction(
      analyst.accessToken,
      "operations-health",
      command,
      access,
      requestContext,
    ).idempotentReplay).toBe(true);
    expect(
      access.listAuditEvents({
        token: "synthetic-data-analyst-001",
        correlationId: "data-report-audit-read",
        requestId: "data-report-audit-read",
      }).some((event) => event.eventType === "data_report_refreshed"),
    ).toBe(true);

    const auditor = login(
      authentication,
      "audit@rego.example",
      "synthetic-auditor-001",
    );
    expect(authentication.getDataReport(
      auditor.accessToken,
      "audit-activity",
      access,
      requestContext,
    ).allowedActions).toEqual([]);
  });

  it("运营公司数据报表只聚合本组织任务并限制跨域刷新", () => {
    const { authentication, access } = createDataReportProductServices();
    const operator = login(
      authentication,
      "lin.yun@rego.example",
      "synthetic-operator-ops-001",
    );
    const operations = authentication.getDataReport(
      operator.accessToken,
      "operations-health",
      access,
      requestContext,
    );
    expect(operations.allowedActions).toEqual(["refresh_report"]);
    expect(
      operations.metrics.find(
        (metric) => metric.metricId === "operations_total_tasks",
      )?.displayValue,
    ).toBe("24");
    expect(authentication.getDataReport(
      operator.accessToken,
      "finance-control",
      access,
      requestContext,
    ).allowedActions).toEqual([]);
  });
});

const requestContext = {
  correlationId: "operator-product-correlation",
  requestId: "operator-product-request",
};

function createOperatorProductServices() {
  const now = () => new Date("2026-07-15T10:00:00.000Z");
  const access = new AdminAccessService(true, true, now);
  return {
    authentication: new AdminAuthenticationService(true, true, now, true),
    operatorManagement: new AdminOperatorManagementService(
      true,
      access,
      new InMemorySyntheticPrimaryOperatorRelationshipGateway(),
      now,
    ),
  };
}

function createCaseProductServices() {
  const now = () => new Date("2026-07-16T08:00:00.000Z");
  const access = new AdminAccessService(true, true, true, true, now);
  return {
    authentication: new AdminAuthenticationService(
      true,
      true,
      now,
      true,
      true,
      true,
      true,
    ),
    tripCaseManagement: new AdminTripCaseManagementService(
      true,
      true,
      access,
      now,
    ),
  };
}

function createFinanceProductServices() {
  const now = () => new Date("2026-07-16T09:00:00.000Z");
  const access = new AdminAccessService(
    true,
    false,
    false,
    false,
    true,
    now,
  );
  return {
    authentication: new AdminAuthenticationService(
      true,
      true,
      now,
      false,
      false,
      false,
      false,
      true,
    ),
    financeOperations: new AdminFinanceOperationsService(true, access),
  };
}

function createExecutiveProductServices() {
  const now = () => new Date("2026-07-16T10:00:00.000Z");
  const access = new AdminAccessService(
    true,
    true,
    true,
    true,
    true,
    true,
    now,
  );
  return {
    authentication: new AdminAuthenticationService(
      true,
      true,
      now,
      false,
      false,
      false,
      false,
      false,
      true,
    ),
    executiveDashboard: new ExecutiveDashboardQueryService(
      true,
      access,
      undefined,
      now,
    ),
  };
}

function createAuditProductServices() {
  const now = () => new Date("2026-07-16T11:00:00.000Z");
  const access = new AdminAccessService(
    true,
    true,
    true,
    true,
    true,
    true,
    now,
  );
  return {
    access,
    authentication: new AdminAuthenticationService(
      true,
      true,
      now,
      false,
      false,
      false,
      false,
      false,
      false,
      undefined,
      true,
    ),
  };
}

function createDataReportProductServices() {
  const now = () => new Date("2026-07-16T12:00:00.000Z");
  const access = new AdminAccessService(
    true,
    true,
    true,
    true,
    true,
    true,
    now,
  );
  return {
    access,
    authentication: new AdminAuthenticationService(
      true,
      true,
      now,
      false,
      false,
      false,
      false,
      false,
      false,
      undefined,
      true,
      true,
    ),
  };
}

function login(
  service: AdminAuthenticationService,
  email: string,
  workIdentityId: string,
) {
  const challenge = service.startLogin(email, "Rego-Internal-2026!");
  const verification = service.verifyMfa(challenge.challengeId, "826419");
  return service.selectWorkIdentity(verification.selectionToken, workIdentityId);
}
