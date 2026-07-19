import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startInternalSandboxHttpServer } from "./internal-sandbox-server.js";

describe("运营后台产品化认证 HTTP API", () => {
  let running: Awaited<ReturnType<typeof startInternalSandboxHttpServer>> | undefined;
  const stateDirectories: string[] = [];

  afterEach(async () => {
    await running?.close();
    running = undefined;
    for (const directory of stateDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("门禁关闭时拒绝登录，依赖齐全时返回授权导航", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    const closed = await post(running.url, "/auth/login", {
      workEmail: "ops@rego.example",
      password: "Rego-Internal-2026!",
    });
    expect(closed.status).toBe(403);
    await running.close();

    running = await startInternalSandboxHttpServer({
      port: 0,
      featureGates: {
        syntheticAdminMultiOrganization: true,
        syntheticAdminAuthentication: true,
        syntheticAdminRoleAccessMatrix: true,
      },
    });
    const challenge = await json(
      await post(running.url, "/auth/login", {
        workEmail: "lin.yun@rego.example",
        password: "Rego-Internal-2026!",
      }),
    );
    const verification = await json(
      await post(running.url, "/auth/mfa/verify", {
        challengeId: challenge.challengeId,
        totpCode: "826419",
      }),
    );
    const sessionResponse = await post(running.url, "/auth/work-identities/select", {
      selectionToken: verification.selectionToken,
      workIdentityId: "synthetic-operator-ops-001",
    });
    expect(sessionResponse.status).toBe(200);
    const session = await json(sessionResponse);
    expect(session.navigation.organizationContext.organizationId).toBe("operator-huhang");
    const page = await fetch(
      `${running.url}/v1/internal-sandbox/admin/operations/tasks?page_size=25`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    );
    expect(page.status).toBe(200);
    expect((await page.json()).items.every((task: { operatorName: string }) => task.operatorName === "沪行出行服务")).toBe(true);
  });

  it("行程运营门禁开启后提供范围内列表和详情", async () => {
    running = await tripServer();
    const session = await login(
      running.url,
      "lin.yun@rego.example",
      "synthetic-operator-ops-001",
    );
    const navigationItem = session.navigation.items.find(
      (item: { id: string }) => item.id === "trip_operations",
    );
    expect(navigationItem.availability).toBe("available");

    const list = await fetch(
      `${running.url}/v1/internal-sandbox/admin/trips?authoritative_state=safety_frozen&sort=trip_id_asc`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    );
    expect(list.status).toBe(200);
    const page = await json(list);
    expect(page.summary.totalTrips).toBe(1);
    expect(page.items).toEqual([
      expect.objectContaining({
        tripId: "trip-synthetic-8421",
        operatorId: "operator-huhang",
        operationState: "coordinating",
      }),
    ]);

    const detail = await fetch(
      `${running.url}/v1/internal-sandbox/admin/trips/trip-synthetic-8421`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    );
    expect(detail.status).toBe(200);
    expect(await detail.json()).toEqual(
      expect.objectContaining({
        allowedActions: ["request_domain_action"],
        directTripMutationAllowed: false,
      }),
    );

    const forbidden = await fetch(
      `${running.url}/v1/internal-sandbox/admin/trips/trip-synthetic-8466`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    );
    expect(forbidden.status).toBe(403);
  });

  it("行程任务动作执行状态交集、幂等重放和追加式审计", async () => {
    running = await tripServer();
    const session = await login(
      running.url,
      "ops@rego.example",
      "synthetic-platform-ops-001",
    );
    const url =
      `${running.url}/v1/internal-sandbox/admin/trips/trip-synthetic-8466/actions/triage`;
    const request = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "trip-triage-http-001",
      },
      body: JSON.stringify({
        expectedTaskVersion: 2,
        expectedTripVersion: 11,
      }),
    };
    const first = await fetch(url, request);
    expect(first.status).toBe(200);
    const firstResult = await json(first);
    expect(firstResult.idempotentReplay).toBe(false);
    expect(firstResult.detail.operationTask.state).toBe("triaged");
    expect(firstResult.detail.allowedActions).toEqual([
      "request_domain_action",
    ]);

    const replay = await fetch(url, request);
    expect(replay.status).toBe(200);
    const replayResult = await json(replay);
    expect(replayResult.idempotentReplay).toBe(true);

    const invalidState = await fetch(url, {
      ...request,
      headers: {
        ...request.headers,
        "Idempotency-Key": "trip-triage-http-002",
      },
      body: JSON.stringify({
        expectedTaskVersion: 3,
        expectedTripVersion: 11,
      }),
    });
    expect(invalidState.status).toBe(409);
    expect((await json(invalidState)).error.code).toBe(
      "ADMIN_TRIP_OPERATION_ACTION_INVALID",
    );

    const detail = await json(await fetch(
      `${running.url}/v1/internal-sandbox/admin/trips/trip-synthetic-8466`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    ));
    expect(
      detail.auditTrail.filter(
        (event: { action: string }) =>
          event.action === "trip_operation_triaged",
      ),
    ).toHaveLength(1);
  });

  it("客服、安全和审计身份在行程域保持只读", async () => {
    running = await tripServer();
    for (const [email, identityId] of [
      ["support@rego.example", "synthetic-support-001"],
      ["safety@rego.example", "synthetic-safety-lead-001"],
      ["audit@rego.example", "synthetic-auditor-001"],
    ] as const) {
      const session = await login(running.url, email, identityId);
      const detail = await json(await fetch(
        `${running.url}/v1/internal-sandbox/admin/trips/trip-synthetic-8466`,
        { headers: { Authorization: `Bearer ${session.accessToken}` } },
      ));
      expect(detail.allowedActions).toEqual([]);
    }
  });

  it("客服与安全 HTTP API 提供角色列表、详情和案件操作", async () => {
    running = await caseServer();
    const support = await login(
      running.url,
      "support@rego.example",
      "synthetic-support-001",
    );
    expect(
      support.navigation.items.find(
        (item: { id: string }) => item.id === "support_safety",
      ).availability,
    ).toBe("available");

    const list = await json(await fetch(
      `${running.url}/v1/internal-sandbox/admin/cases?kind=support&support_state=investigating&sort=case_id_asc`,
      { headers: { Authorization: `Bearer ${support.accessToken}` } },
    ));
    expect(list.items).toEqual([
      expect.objectContaining({
        caseId: "support-synthetic-114",
        kind: "support",
      }),
    ]);

    const detail = await json(await fetch(
      `${running.url}/v1/internal-sandbox/admin/cases/support/support-synthetic-114`,
      { headers: { Authorization: `Bearer ${support.accessToken}` } },
    ));
    expect(detail.allowedActions).toContain("resolve");

    const actionUrl =
      `${running.url}/v1/internal-sandbox/admin/cases/support/support-synthetic-114/actions/resolve`;
    const actionRequest = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${support.accessToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "support-http-resolve-1",
      },
      body: JSON.stringify({
        expectedVersion: detail.case.resourceVersion,
        note: "已向乘客确认处理结果",
      }),
    };
    const resolved = await json(await fetch(actionUrl, actionRequest));
    expect(resolved.detail.profile.state).toBe("resolved");
    expect(resolved.detail.auditTrail.at(-1)).toMatchObject({
      action: "support_case_state_changed",
      nextState: "resolved",
    });
    expect((await json(await fetch(actionUrl, actionRequest))).idempotentReplay)
      .toBe(true);
  });

  it("财务与对账 HTTP API 提供范围列表、详情、角色操作和幂等结果", async () => {
    running = await financeServer();
    const officer = await login(
      running.url,
      "finance@rego.example",
      "synthetic-finance-officer-001",
    );
    expect(
      officer.navigation.items.find(
        (item: { id: string }) => item.id === "finance_operations",
      ),
    ).toMatchObject({ label: "财务与对账", availability: "available" });

    const list = await json(await fetch(
      `${running.url}/v1/internal-sandbox/admin/finance?kind=settlement&sort=resource_id_asc`,
      { headers: { Authorization: `Bearer ${officer.accessToken}` } },
    ));
    expect(list.items.map((item: { resourceId: string }) => item.resourceId))
      .toEqual([
        "settlement-synthetic-184",
        "settlement-synthetic-blocked",
      ]);

    const detailUrl =
      `${running.url}/v1/internal-sandbox/admin/finance/settlement/settlement-synthetic-184`;
    const detail = await json(await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${officer.accessToken}` },
    }));
    expect(detail.allowedActions).toEqual(["prepare_operator_settlement"]);
    const actionUrl = `${detailUrl}/actions/prepare_operator_settlement`;
    const actionRequest = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${officer.accessToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "finance-http-product-prepare-1",
      },
      body: JSON.stringify({
        expectedVersion: detail.item.resourceVersion,
        reasonCode: "daily_settlement",
      }),
    };
    const prepared = await json(await fetch(actionUrl, actionRequest));
    expect(prepared).toMatchObject({
      idempotentReplay: false,
      detail: { item: { state: "ready", resourceVersion: 2 } },
    });
    expect((await json(await fetch(actionUrl, actionRequest))).idempotentReplay)
      .toBe(true);

    const operatorOfficer = await login(
      running.url,
      "finance@rego.example",
      "synthetic-operator-finance-officer-001",
    );
    const operatorList = await json(await fetch(
      `${running.url}/v1/internal-sandbox/admin/finance?page_size=25`,
      { headers: { Authorization: `Bearer ${operatorOfficer.accessToken}` } },
    ));
    expect(operatorList.summary.totalResources).toBe(5);
    expect(operatorList.items.every(
      (item: { operatorId?: string }) =>
        !item.operatorId || item.operatorId === "operator-huhang",
    )).toBe(true);
    expect(operatorList.items.map(
      (item: { resourceId: string }) => item.resourceId,
    )).not.toContain("reconciliation-synthetic-0714-ready");
    const forbidden = await fetch(
      `${running.url}/v1/internal-sandbox/admin/finance/settlement/settlement-synthetic-blocked`,
      { headers: { Authorization: `Bearer ${operatorOfficer.accessToken}` } },
    );
    expect(forbidden.status).toBe(404);
  });

  it("高层驾驶舱 HTTP API 提供名录、详情、治理意见与组织范围隔离", async () => {
    const executiveStateDir = mkdtempSync(
      join(tmpdir(), "pollycar-product-executive-"),
    );
    stateDirectories.push(executiveStateDir);
    running = await executiveServer(executiveStateDir);
    const sponsor = await login(
      running.url,
      "executive@rego.example",
      "synthetic-executive-sponsor-001",
    );
    expect(
      sponsor.navigation.items.find(
        (item: { id: string }) => item.id === "executive_dashboard",
      ),
    ).toMatchObject({ label: "高层驾驶舱", availability: "available" });
    const list = await json(await fetch(
      `${running.url}/v1/internal-sandbox/admin/executive?kind=decision_item&sort=resource_id_asc`,
      { headers: { Authorization: `Bearer ${sponsor.accessToken}` } },
    ));
    expect(list.items).toHaveLength(3);
    const detailUrl =
      `${running.url}/v1/internal-sandbox/admin/executive/decision_item/decision-operator-haiwan`;
    const detail = await json(await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${sponsor.accessToken}` },
    }));
    expect(detail.allowedActions).toEqual(["record_decision_opinion"]);
    const result = await json(await fetch(
      `${detailUrl}/actions/record_decision_opinion`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sponsor.accessToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "executive-http-opinion-001",
        },
        body: JSON.stringify({
          expectedVersion: detail.item.resourceVersion,
          decisionCode: "continue_controlled_review",
          reasonCode: "finance_blocker_open",
          responsibleRole: "operations_lead",
          dueAt: "2026-07-23T10:00:00.000Z",
        }),
      },
    ));
    expect(result.detail.item.resourceVersion).toBe(2);
    expect(result.detail.auditTrail.at(-1).action)
      .toBe("executive_decision_opinion_recorded");

    const operatorExecutive = await login(
      running.url,
      "executive@rego.example",
      "synthetic-operator-executive-001",
    );
    const operatorList = await json(await fetch(
      `${running.url}/v1/internal-sandbox/admin/executive?page_size=100`,
      { headers: { Authorization: `Bearer ${operatorExecutive.accessToken}` } },
    ));
    expect(
      operatorList.items
        .filter((item: { kind: string }) => item.kind === "operator_health")
        .map((item: { operatorId: string }) => item.operatorId),
    ).toEqual(["operator-huhang"]);
    expect(
      operatorList.items
        .filter((item: { kind: string }) => item.kind === "decision_item")
        .map((item: { resourceId: string }) => item.resourceId),
    ).toEqual(["decision-safety-restoration"]);
  });

  it("审计与系统 HTTP API 提供事件详情和技术调查操作", async () => {
    const auditStateDir = mkdtempSync(
      join(tmpdir(), "pollycar-product-audit-"),
    );
    stateDirectories.push(auditStateDir);
    running = await auditServer(auditStateDir);
    const technical = await login(
      running.url,
      "technical@rego.example",
      "synthetic-technical-ops-001",
    );
    expect(
      technical.navigation.items.find(
        (item: { id: string }) => item.id === "audit_system",
      ),
    ).toMatchObject({ label: "审计与系统", availability: "available" });
    const list = await json(await fetch(
      `${running.url}/v1/internal-sandbox/admin/audit?kind=event&page_size=25`,
      { headers: { Authorization: `Bearer ${technical.accessToken}` } },
    ));
    expect(list.items.length).toBeGreaterThan(0);
    const source = list.items[0];
    const detailUrl =
      `${running.url}/v1/internal-sandbox/admin/audit/event/${source.resourceId}`;
    const detail = await json(await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${technical.accessToken}` },
    }));
    expect(detail.allowedActions).toEqual(["open_investigation"]);
    const opened = await json(await fetch(
      `${detailUrl}/actions/open_investigation`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${technical.accessToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "audit-http-open-investigation-001",
        },
        body: JSON.stringify({
          expectedVersion: detail.item.resourceVersion,
          reasonCode: "access_pattern_review",
        }),
      },
    ));
    expect(opened.detail).toMatchObject({
      kind: "investigation",
      item: { result: "open", resourceVersion: 1 },
    });

    const auditor = await login(
      running.url,
      "audit@rego.example",
      "synthetic-auditor-001",
    );
    const readOnly = await json(await fetch(
      `${running.url}/v1/internal-sandbox/admin/audit/investigation/${opened.detail.item.resourceId}`,
      { headers: { Authorization: `Bearer ${auditor.accessToken}` } },
    ));
    expect(readOnly.allowedActions).toEqual([]);
  });

  it("数据与报表 HTTP API 提供名录、详情、刷新确认和幂等重放", async () => {
    const executiveStateDir = mkdtempSync(
      join(tmpdir(), "pollycar-product-reports-"),
    );
    stateDirectories.push(executiveStateDir);
    running = await dataReportServer(executiveStateDir);
    const analyst = await login(
      running.url,
      "analytics@rego.example",
      "synthetic-data-analyst-001",
    );
    expect(
      analyst.navigation.items.find(
        (item: { id: string }) => item.id === "data_reports",
      ),
    ).toMatchObject({ label: "数据与报表", availability: "available" });

    const list = await json(await fetch(
      `${running.url}/v1/internal-sandbox/admin/reports?domain=operations&sort=report_id_asc`,
      { headers: { Authorization: `Bearer ${analyst.accessToken}` } },
    ));
    expect(list.items.map((item: { reportId: string }) => item.reportId))
      .toEqual(["operations-health"]);

    const detailUrl =
      `${running.url}/v1/internal-sandbox/admin/reports/operations-health`;
    const detail = await json(await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${analyst.accessToken}` },
    }));
    expect(detail).toMatchObject({
      item: { resourceVersion: 1 },
      allowedActions: ["refresh_report"],
      sourceBoundary: {
        aggregateOnly: true,
        personLevelDataAvailable: false,
        realDataAvailable: false,
        exportAvailable: false,
      },
    });

    const actionUrl = `${detailUrl}/actions/refresh_report`;
    const actionRequest = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${analyst.accessToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "data-report-http-refresh-001",
      },
      body: JSON.stringify({
        expectedVersion: 1,
        reasonCode: "scheduled_quality_review",
      }),
    };
    const refreshed = await json(await fetch(actionUrl, actionRequest));
    expect(refreshed).toMatchObject({
      resultState: "confirmed",
      idempotentReplay: false,
      detail: { item: { resourceVersion: 2 } },
    });
    expect(refreshed.detail.auditTrail.at(-1).action)
      .toBe("data_report_refreshed");
    expect(await json(await fetch(actionUrl, actionRequest))).toMatchObject({
      resultState: "confirmed",
      idempotentReplay: true,
    });
  });
});

function post(url: string, path: string, body: unknown) {
  return fetch(`${url}/v1/internal-sandbox/admin${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function json(response: Response): Promise<Record<string, any>> {
  return (await response.json()) as Record<string, any>;
}

function tripServer() {
  return startInternalSandboxHttpServer({
    port: 0,
    featureGates: {
      syntheticAdminMultiOrganization: true,
      syntheticAdminAuthentication: true,
      syntheticAdminRoleAccessMatrix: true,
      syntheticAdminTripOperations: true,
    },
  });
}

function caseServer() {
  return startInternalSandboxHttpServer({
    port: 0,
    featureGates: {
      syntheticAdminMultiOrganization: true,
      syntheticAdminAuthentication: true,
      syntheticAdminRoleAccessMatrix: true,
      syntheticAdminTripOperations: true,
      syntheticAdminCaseManagement: true,
    },
  });
}

function financeServer() {
  return startInternalSandboxHttpServer({
    port: 0,
    featureGates: {
      syntheticAdminMultiOrganization: true,
      syntheticAdminAuthentication: true,
      syntheticAdminRoleAccessMatrix: true,
      syntheticAdminFinanceOperations: true,
    },
  });
}

function executiveServer(executiveStateDir: string) {
  return startInternalSandboxHttpServer({
    port: 0,
    executiveStateDir,
    featureGates: {
      syntheticAdminMultiOrganization: true,
      syntheticAdminAuthentication: true,
      syntheticAdminRoleAccessMatrix: true,
      syntheticAdminOperatorManagement: true,
      syntheticAdminDriverVehicle: true,
      syntheticAdminTripOperations: true,
      syntheticAdminCaseManagement: true,
      syntheticAdminFinanceOperations: true,
      syntheticAdminExecutiveDashboard: true,
    },
  });
}

function auditServer(executiveStateDir: string) {
  return startInternalSandboxHttpServer({
    port: 0,
    executiveStateDir,
    featureGates: {
      syntheticAdminMultiOrganization: true,
      syntheticAdminAuthentication: true,
      syntheticAdminRoleAccessMatrix: true,
      syntheticAdminOperatorManagement: true,
      syntheticAdminDriverVehicle: true,
      syntheticAdminTripOperations: true,
      syntheticAdminCaseManagement: true,
      syntheticAdminFinanceOperations: true,
      syntheticAdminExecutiveDashboard: true,
      syntheticAdminAuditSystem: true,
    },
  });
}

function dataReportServer(executiveStateDir: string) {
  return startInternalSandboxHttpServer({
    port: 0,
    executiveStateDir,
    featureGates: {
      syntheticAdminMultiOrganization: true,
      syntheticAdminAuthentication: true,
      syntheticAdminRoleAccessMatrix: true,
      syntheticAdminOperatorManagement: true,
      syntheticAdminDriverVehicle: true,
      syntheticAdminTripOperations: true,
      syntheticAdminCaseManagement: true,
      syntheticAdminFinanceOperations: true,
      syntheticAdminExecutiveDashboard: true,
      syntheticAdminAuditSystem: true,
      syntheticAdminDataReports: true,
    },
  });
}

async function login(
  url: string,
  workEmail: string,
  workIdentityId: string,
): Promise<Record<string, any>> {
  const challenge = await json(await post(url, "/auth/login", {
    workEmail,
    password: "Rego-Internal-2026!",
  }));
  const verification = await json(await post(url, "/auth/mfa/verify", {
    challengeId: challenge.challengeId,
    totpCode: "826419",
  }));
  return json(await post(url, "/auth/work-identities/select", {
    selectionToken: verification.selectionToken,
    workIdentityId,
  }));
}
