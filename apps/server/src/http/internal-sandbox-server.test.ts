import { afterEach, describe, expect, it } from "vitest";
import type { InternalSandboxHttpServer } from "./internal-sandbox-server.js";
import { startInternalSandboxHttpServer } from "./internal-sandbox-server.js";

let running: InternalSandboxHttpServer | undefined;
afterEach(async () => {
  await running?.close();
  running = undefined;
});

const headers = {
  Authorization: "Sandbox synthetic-reviewer-001",
  Origin: "http://127.0.0.1:4173",
  "Content-Type": "application/json",
};
const appHeaders = {
  Authorization: "Sandbox synthetic-account-7",
  Origin: "http://127.0.0.1:8081",
  "Content-Type": "application/json",
};

describe("运营后台内部沙箱 HTTP API", () => {
  it("创建权威账户会话并按身份限制业务操作", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    const createdResponse = await fetch(`${running.url}/v1/internal-sandbox/app/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: "synthetic-account-7" }),
    });
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json() as {
      token: string;
      session: { activeIdentity: string; adultEligibilityState: string };
    };
    expect(created.session).toMatchObject({
      activeIdentity: "passenger",
      adultEligibilityState: "verified",
    });
    const sessionHeaders = {
      Authorization: `Session ${created.token}`,
      "Content-Type": "application/json",
    };
    const driverDenied = await fetch(
      `${running.url}/v1/internal-sandbox/app/driver/available-trips`,
      { headers: sessionHeaders },
    );
    expect(await driverDenied.json()).toMatchObject({
      error: { code: "SESSION_IDENTITY_MISMATCH" },
    });

    const switched = await fetch(
      `${running.url}/v1/internal-sandbox/app/sessions/current/identity`,
      {
        method: "POST",
        headers: { ...sessionHeaders, "Idempotency-Key": "switch-driver-http" },
        body: JSON.stringify({ activeIdentity: "driver" }),
      },
    );
    expect(await switched.json()).toMatchObject({ activeIdentity: "driver" });
    expect(
      (
        await fetch(`${running.url}/v1/internal-sandbox/app/driver/available-trips`, {
          headers: sessionHeaders,
        })
      ).status,
    ).toBe(200);
  });

  it("撤销后的会话不能继续访问业务能力", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    const created = await (
      await fetch(`${running.url}/v1/internal-sandbox/app/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: "synthetic-account-7" }),
      })
    ).json() as { token: string };
    const sessionHeaders = {
      Authorization: `Session ${created.token}`,
      "Content-Type": "application/json",
    };
    await fetch(`${running.url}/v1/internal-sandbox/app/sessions/current/revoke`, {
      method: "POST",
      headers: { ...sessionHeaders, "Idempotency-Key": "revoke-session-http" },
    });
    const denied = await fetch(
      `${running.url}/v1/internal-sandbox/app/synthetic-trips/dashboard`,
      { headers: sessionHeaders },
    );
    expect(await denied.json()).toMatchObject({ error: { code: "SESSION_REVOKED" } });
  });

  it("浏览器预检不被业务认证门禁拦截", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    const response = await fetch(
      `${running.url}/v1/internal-sandbox/app/synthetic-trips/dashboard`,
      {
        method: "OPTIONS",
        headers: {
          Origin: "http://127.0.0.1:8181",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "authorization,content-type,x-correlation-id",
        },
      },
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:8181");
    expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
  });

  it("Admin 任务详情使用 Bearer 会话并保持组织范围", async () => {
    running = await startInternalSandboxHttpServer({
      port: 0,
      featureGates: {
        syntheticAdminMultiOrganization: true,
        syntheticAdminAuthentication: true,
        syntheticAdminRoleAccessMatrix: true,
      },
    });
    const session = await createAdminSession(
      running.url,
      "lin.yun@rego.example",
      "synthetic-operator-ops-001",
    );
    const pageResponse = await fetch(
      `${running.url}/v1/internal-sandbox/admin/operations/tasks?page_size=25`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    );
    const page = await pageResponse.json() as {
      items: Array<{ taskId: string; version: number }>;
    };
    const detailResponse = await fetch(
      `${running.url}/v1/internal-sandbox/admin/operations/tasks/${page.items[0]!.taskId}`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    );

    expect(detailResponse.status).toBe(200);
    expect(await detailResponse.json()).toMatchObject({
      task: { taskId: page.items[0]!.taskId, operatorName: "沪行出行服务" },
      organizationScope: { organizationId: "operator-huhang" },
      synthetic: true,
    });

    const actionUrl =
      `${running.url}/v1/internal-sandbox/admin/operations/tasks/${page.items[0]!.taskId}/actions/assign`;
    const actionResponse = await fetch(actionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "http-assign-ops-1",
      },
      body: JSON.stringify({
        expectedVersion: page.items[0]!.version,
        note: "HTTP 闭环验证",
      }),
    });
    expect(actionResponse.status).toBe(200);
    expect(await actionResponse.json()).toMatchObject({
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        task: { status: "processing", version: page.items[0]!.version + 1 },
        auditTrail: [
          {},
          {},
          {
            action: "task_assigned",
            note: "HTTP 闭环验证",
            previousStatus: "unassigned",
            nextStatus: "processing",
          },
        ],
      },
    });

    const replayResponse = await fetch(actionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "http-assign-ops-1",
      },
      body: JSON.stringify({
        expectedVersion: page.items[0]!.version,
        note: "HTTP 闭环验证",
      }),
    });
    expect(replayResponse.status).toBe(200);
    expect(await replayResponse.json()).toMatchObject({
      resultState: "confirmed",
      idempotentReplay: true,
    });
  });

  it("Admin 运营主体使用 Bearer 列表、详情、操作和幂等审计闭环", async () => {
    running = await startInternalSandboxHttpServer({
      port: 0,
      featureGates: {
        syntheticAdminMultiOrganization: true,
        syntheticAdminAuthentication: true,
        syntheticAdminRoleAccessMatrix: true,
        syntheticAdminOperatorManagement: true,
      },
    });
    const session = await createAdminSession(
      running.url,
      "ops@rego.example",
      "synthetic-platform-ops-001",
    );
    const pageResponse = await fetch(
      `${running.url}/v1/internal-sandbox/admin/operators?page_size=25&sort=operator_name_asc`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    );
    expect(pageResponse.status).toBe(200);
    const page = await pageResponse.json() as {
      items: Array<{ operatorId: string; resourceVersion: number }>;
      summary: { totalOperators: number };
    };
    expect(page.summary.totalOperators).toBe(2);
    const operator = page.items.find((item) =>
      item.operatorId === "operator-huhang"
    )!;

    const detailResponse = await fetch(
      `${running.url}/v1/internal-sandbox/admin/operators/${operator.operatorId}`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    );
    expect(detailResponse.status).toBe(200);
    expect(await detailResponse.json()).toMatchObject({
      operator: {
        operatorId: "operator-huhang",
        lifecycleState: "active",
        resourceVersion: operator.resourceVersion,
      },
      allowedActions: ["restrict"],
    });

    const actionUrl =
      `${running.url}/v1/internal-sandbox/admin/operators/${operator.operatorId}/actions/restrict`;
    const actionRequest = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "http-operator-restrict-0001",
      },
      body: JSON.stringify({
        expectedVersion: operator.resourceVersion,
        note: "HTTP 验证限制运营",
      }),
    };
    const actionResponse = await fetch(actionUrl, actionRequest);
    expect(actionResponse.status).toBe(200);
    expect(await actionResponse.json()).toMatchObject({
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        operator: {
          lifecycleState: "restricted",
          resourceVersion: operator.resourceVersion + 1,
        },
        allowedActions: ["reactivate"],
        auditTrail: [
          {},
          {
            action: "operator_restricted",
            previousState: "active",
            nextState: "restricted",
            note: "HTTP 验证限制运营",
          },
        ],
      },
    });

    const replayResponse = await fetch(actionUrl, actionRequest);
    expect(replayResponse.status).toBe(200);
    expect(await replayResponse.json()).toMatchObject({
      resultState: "confirmed",
      idempotentReplay: true,
    });
  });

  it("Admin 车主车辆使用 Bearer 名录、范围、审核动作和追加审计闭环", async () => {
    running = await startInternalSandboxHttpServer({
      port: 0,
      featureGates: {
        syntheticAdminMultiOrganization: true,
        syntheticAdminAuthentication: true,
        syntheticAdminRoleAccessMatrix: true,
        syntheticAdminOperatorManagement: true,
        syntheticAdminDriverVehicle: true,
      },
    });
    const reviewer = await createAdminSession(
      running.url,
      "review@rego.example",
      "synthetic-reviewer-001",
    );
    const pageResponse = await fetch(
      `${running.url}/v1/internal-sandbox/admin/fleet/vehicles?page_size=25&sort=plate_asc`,
      { headers: { Authorization: `Bearer ${reviewer.accessToken}` } },
    );
    expect(pageResponse.status).toBe(200);
    const page = await pageResponse.json() as {
      summary: { totalVehicles: number; openReviewTasks: number };
      items: Array<{
        vehicleId: string;
        reviewTaskId?: string;
        resourceVersion: number;
      }>;
    };
    expect(page.summary).toMatchObject({
      totalVehicles: 4,
      openReviewTasks: 3,
    });
    const vehicle = page.items.find((item) =>
      item.vehicleId === "vehicle-synthetic-226"
    )!;
    const detailUrl =
      `${running.url}/v1/internal-sandbox/admin/fleet/vehicles/${vehicle.vehicleId}`;
    const detailResponse = await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${reviewer.accessToken}` },
    });
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json() as {
      reviewTask: { taskVersion: number; vehicleReviewVersion: number };
      allowedActions: string[];
      auditTrail: Array<{ action: string }>;
    };
    expect(detail.allowedActions).toEqual(["claim"]);
    expect(detail.auditTrail.at(-1)?.action).toBe("task_viewed");

    const claimUrl = `${detailUrl}/actions/claim`;
    const claimResponse = await fetch(claimUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${reviewer.accessToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "fleet-claim-task-003-http",
      },
      body: JSON.stringify({
        expectedTaskVersion: detail.reviewTask.taskVersion,
        expectedVehicleReviewVersion:
          detail.reviewTask.vehicleReviewVersion,
      }),
    });
    expect(claimResponse.status).toBe(200);
    const claimed = await claimResponse.json() as {
      detail: {
        reviewTask: { taskVersion: number; vehicleReviewVersion: number };
        allowedActions: string[];
      };
    };
    expect(claimed.detail.allowedActions).toEqual([
      "request_material",
      "reject",
      "approve",
    ]);

    const approveUrl = `${detailUrl}/actions/approve`;
    const approveRequest = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${reviewer.accessToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "fleet-approve-task-003-http",
      },
      body: JSON.stringify({
        expectedTaskVersion: claimed.detail.reviewTask.taskVersion,
        expectedVehicleReviewVersion:
          claimed.detail.reviewTask.vehicleReviewVersion,
      }),
    };
    const approveResponse = await fetch(approveUrl, approveRequest);
    expect(approveResponse.status).toBe(200);
    expect(await approveResponse.json()).toMatchObject({
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        vehicle: { reviewState: "approved" },
        reviewTask: { status: "completed" },
        allowedActions: [],
        auditTrail: [
          {},
          { action: "task_claimed" },
          { action: "vehicle_approved" },
        ],
      },
    });
    const replayResponse = await fetch(approveUrl, approveRequest);
    expect(replayResponse.status).toBe(200);
    expect(await replayResponse.json()).toMatchObject({
      resultState: "confirmed",
      idempotentReplay: true,
    });

    const fleetOfficer = await createAdminSession(
      running.url,
      "fleet@rego.example",
      "synthetic-operator-fleet-001",
    );
    const scopedResponse = await fetch(
      `${running.url}/v1/internal-sandbox/admin/fleet/drivers?page_size=25`,
      { headers: { Authorization: `Bearer ${fleetOfficer.accessToken}` } },
    );
    const scoped = await scopedResponse.json() as {
      summary: { totalDrivers: number };
      items: Array<{ operatorId: string }>;
    };
    expect(scoped.summary.totalDrivers).toBe(2);
    expect(scoped.items.every((item) =>
      item.operatorId === "operator-huhang"
    )).toBe(true);
    const crossScope = await fetch(
      `${running.url}/v1/internal-sandbox/admin/fleet/vehicles/vehicle-synthetic-218`,
      { headers: { Authorization: `Bearer ${fleetOfficer.accessToken}` } },
    );
    expect(crossScope.status).toBe(404);

    const auditor = await createAdminSession(
      running.url,
      "audit@rego.example",
      "synthetic-auditor-001",
    );
    const auditDetailUrl =
      `${running.url}/v1/internal-sandbox/admin/fleet/vehicles/vehicle-synthetic-218`;
    const auditDetail = await fetch(auditDetailUrl, {
      headers: { Authorization: `Bearer ${auditor.accessToken}` },
    });
    expect(await auditDetail.json()).toMatchObject({ allowedActions: [] });
    const deniedClaim = await fetch(`${auditDetailUrl}/actions/claim`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auditor.accessToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "auditor-fleet-claim-denied",
      },
      body: JSON.stringify({
        expectedTaskVersion: 1,
        expectedVehicleReviewVersion: 1,
      }),
    });
    expect(deniedClaim.status).toBe(403);
  });

  it("允许来源的未认证业务响应仍返回 CORS 头", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    const response = await fetch(
      `${running.url}/v1/internal-sandbox/app/synthetic-trips/booking-availability`,
      { headers: { Origin: "http://127.0.0.1:8181" } },
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:8181");
    expect(response.headers.get("vary")).toContain("Origin");
  });

  it("未允许来源的认证失败响应不回显 CORS 头", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    const response = await fetch(
      `${running.url}/v1/internal-sandbox/app/synthetic-trips/booking-availability`,
      { headers: { Origin: "http://malicious.example" } },
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("手机号登录会话可以读取本人未完成的成年资格状态", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    const codeResponse = await fetch(`${running.url}/v1/auth/phone/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumber: "18800000007",
        consentAccepted: true,
        deviceId: "browser-device-adult-eligibility",
        idempotencyKey: "adult-phone-code",
      }),
    });
    const challenge = await codeResponse.json() as { challengeId: string };
    const authenticationResponse = await fetch(`${running.url}/v1/auth/phone/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeId: challenge.challengeId,
        code: "246810",
        deviceId: "browser-device-adult-eligibility",
        idempotencyKey: "adult-phone-verify",
      }),
    });
    const authentication = await authenticationResponse.json() as { accessToken: string };
    const eligibilityResponse = await fetch(
      `${running.url}/v1/internal-sandbox/app/adult-eligibility`,
      { headers: { Authorization: `Session ${authentication.accessToken}` } },
    );
    expect(eligibilityResponse.status).toBe(200);
    expect(await eligibilityResponse.json()).toMatchObject({
      state: "not_started",
      businessAccessAllowed: false,
    });
  });

  it("只监听回环地址并返回最小队列字段", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    expect((await fetch(`${running.url}/v1/internal-sandbox/health`)).status).toBe(401);
    expect((await fetch(`${running.url}/v1/internal-sandbox/health`, { headers })).status).toBe(200);
    const response = await fetch(`${running.url}/v1/internal-sandbox/admin/review-tasks`, { headers });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toBeTruthy();
    const tasks = (await response.json()) as Array<Record<string, unknown>>;
    expect(tasks[0]).toMatchObject({ taskId: "task-001", synthetic: true });
    expect(tasks[0]).not.toHaveProperty("accountReference");
    expect(running.server.address()).toMatchObject({ address: "127.0.0.1" });
  });

  it("两个 HTTP 会话并发认领只有一个成功", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    const claim = (key: string) =>
      fetch(`${running!.url}/v1/internal-sandbox/admin/review-tasks/task-001/claim`, {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": key },
        body: JSON.stringify({ expectedTaskVersion: 1 }),
      });
    const responses = await Promise.all([claim("claim-session-a"), claim("claim-session-b")]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const conflict = responses.find((response) => response.status === 409)!;
    expect(await conflict.json()).toMatchObject({ error: { code: "ADMIN_TASK_ALREADY_CLAIMED" } });
  });

  it("完成文案预览、补充材料、审计和幂等恢复", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    const claimResponse = await fetch(`${running.url}/v1/internal-sandbox/admin/review-tasks/task-001/claim`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "claim-material-http" },
      body: JSON.stringify({ expectedTaskVersion: 1 }),
    });
    const claimed = await claimResponse.json() as { taskVersion: number; vehicleReviewVersion: number };
    const previewResponse = await fetch(`${running.url}/v1/internal-sandbox/admin/review-tasks/task-001/material-request-preview`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "preview-material-http" },
      body: JSON.stringify({ reason: "insurance_expiry_incomplete" }),
    });
    expect(await previewResponse.json()).toMatchObject({ templateVersion: "2026-07-11.1" });
    const duplicatePreview = await fetch(`${running.url}/v1/internal-sandbox/admin/review-tasks/task-001/material-request-preview`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "preview-material-http" },
      body: JSON.stringify({ reason: "insurance_expiry_incomplete" }),
    });
    expect(duplicatePreview.status).toBe(200);
    const materialKey = "material-request-http";
    const materialResponse = await fetch(`${running.url}/v1/internal-sandbox/admin/review-tasks/task-001/material-request`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": materialKey },
      body: JSON.stringify({
        reason: "insurance_expiry_incomplete",
        previewConfirmed: true,
        expectedTaskVersion: claimed.taskVersion,
        expectedVehicleReviewVersion: claimed.vehicleReviewVersion,
      }),
    });
    expect(await materialResponse.json()).toMatchObject({ status: "waiting_user", vehicleReviewVersion: 2 });
    const recovered = await fetch(`${running.url}/v1/internal-sandbox/admin/idempotency-results/${materialKey}`, { headers });
    expect(await recovered.json()).toMatchObject({ status: "waiting_user" });
    const audit = await fetch(`${running.url}/v1/internal-sandbox/admin/review-tasks/task-001/audit`, { headers });
    expect((await audit.json()) as unknown[]).toHaveLength(4);
  });

  it("拒绝伪造身份、错误来源和禁止路由", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    expect((await fetch(`${running.url}/v1/internal-sandbox/admin/review-tasks`)).status).toBe(401);
    expect((await fetch(`${running.url}/v1/internal-sandbox/admin/review-tasks`, {
      headers: { ...headers, Origin: "https://example.com" },
    })).status).toBe(403);
    expect((await fetch(`${running.url}/v1/internal-sandbox/admin/review-tasks/task-001/unknown-action`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "forbidden-approve" },
      body: "{}",
    })).status).toBe(404);
  });

  it("完成合成批准与拒绝决定并保留审计", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    const claim = async (taskId: string, key: string) => {
      const response = await fetch(`${running!.url}/v1/internal-sandbox/admin/review-tasks/${taskId}/claim`, {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": key },
        body: JSON.stringify({ expectedTaskVersion: 1 }),
      });
      return response.json() as Promise<{ taskVersion: number; vehicleReviewVersion: number }>;
    };
    const clean = await claim("task-003", "claim-approve-http");
    const approved = await fetch(`${running.url}/v1/internal-sandbox/admin/review-tasks/task-003/approve`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "approve-vehicle-http" },
      body: JSON.stringify({
        reasonCode: "approved_standard",
        previewConfirmed: true,
        expectedTaskVersion: clean.taskVersion,
        expectedVehicleReviewVersion: clean.vehicleReviewVersion,
      }),
    });
    expect(await approved.json()).toMatchObject({ status: "completed", vehicleReviewVersion: 2 });

    const risky = await claim("task-002", "claim-reject-http");
    const rejected = await fetch(`${running.url}/v1/internal-sandbox/admin/review-tasks/task-002/reject`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "reject-vehicle-http" },
      body: JSON.stringify({
        reasonCode: "authorization_remaining_insufficient",
        previewConfirmed: true,
        expectedTaskVersion: risky.taskVersion,
        expectedVehicleReviewVersion: risky.vehicleReviewVersion,
      }),
    });
    expect(await rejected.json()).toMatchObject({ status: "completed", vehicleReviewVersion: 2 });
    const audit = await fetch(`${running.url}/v1/internal-sandbox/admin/review-tasks/task-002/audit`, { headers });
    expect((await audit.json()) as Array<{ action: string }>).toEqual(
      expect.arrayContaining([expect.objectContaining({ action: "vehicle_rejected" })]),
    );
  });

  it("贯通用户提交、后台批准与用户结果查询", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    const applicationPath =
      `${running.url}/v1/internal-sandbox/app/vehicle-reviews/vehicle-application-7`;
    const initial = await fetch(applicationPath, { headers: appHeaders });
    expect(await initial.json()).toMatchObject({ status: "draft", version: 0 });
    const draft = await fetch(`${applicationPath}/draft`, {
      method: "POST",
      headers: { ...appHeaders, "Idempotency-Key": "app-draft-http" },
      body: JSON.stringify({
        vehicleType: "中大型轿车 · 示例 A",
        maxPassengerCount: 1,
        insuranceExpiresOn: "2027-08-31",
        syntheticAttachmentId: "synthetic-insurance-a",
        expectedVersion: 0,
      }),
    });
    expect(await draft.json()).toMatchObject({ status: "draft", version: 1 });
    const submitted = await fetch(`${applicationPath}/submit`, {
      method: "POST",
      headers: { ...appHeaders, "Idempotency-Key": "app-submit-http" },
      body: JSON.stringify({ expectedVersion: 1 }),
    });
    expect(await submitted.json()).toMatchObject({ status: "under_review", version: 2 });

    const queue = await fetch(`${running.url}/v1/internal-sandbox/admin/review-tasks`, { headers });
    expect(await queue.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: "task-vehicle-application-7",
          applicationId: "vehicle-application-7",
        }),
      ]),
    );
    const claim = await fetch(
      `${running.url}/v1/internal-sandbox/admin/review-tasks/task-vehicle-application-7/claim`,
      {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": "app-review-claim" },
        body: JSON.stringify({ expectedTaskVersion: 1 }),
      },
    );
    const claimed = await claim.json() as { taskVersion: number; vehicleReviewVersion: number };
    const approve = await fetch(
      `${running.url}/v1/internal-sandbox/admin/review-tasks/task-vehicle-application-7/approve`,
      {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": "app-review-approve" },
        body: JSON.stringify({
          reasonCode: "approved_standard",
          previewConfirmed: true,
          expectedTaskVersion: claimed.taskVersion,
          expectedVehicleReviewVersion: claimed.vehicleReviewVersion,
        }),
      },
    );
    expect(await approve.json()).toMatchObject({ status: "completed" });
    const result = await fetch(applicationPath, { headers: appHeaders });
    expect(await result.json()).toMatchObject({
      status: "approved",
      ownerIdentityAvailable: true,
      version: 3,
    });
  });

  it("贯通免费弹性资格合成邀请、申请、批准、确认和启用", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    const path = `${running.url}/v1/internal-sandbox/app/free-flex-trial`;
    const invited = await fetch(path, { headers: appHeaders });
    expect(await invited.json()).toMatchObject({
      state: "invited",
      version: 0,
      qualificationFeeMinor: 0,
      paidPathEnabled: false,
      realInvitation: false,
    });

    const submitted = await fetch(path, {
      method: "POST",
      headers: { ...appHeaders, "Idempotency-Key": "free-submit-http" },
      body: JSON.stringify({ expectedVersion: 0 }),
    });
    expect(await submitted.json()).toMatchObject({ state: "under_review", version: 1 });

    const approved = await fetch(
      `${running.url}/v1/internal-sandbox/admin/free-flex-trial/approval`,
      {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": "free-approve-http" },
        body: JSON.stringify({ accountId: "synthetic-account-7", expectedVersion: 1 }),
      },
    );
    expect(await approved.json()).toMatchObject({
      state: "awaiting_confirmation",
      version: 2,
    });

    const active = await fetch(`${path}/confirmation`, {
      method: "POST",
      headers: { ...appHeaders, "Idempotency-Key": "free-confirm-http" },
      body: JSON.stringify({ expectedVersion: 2 }),
    });
    expect(await active.json()).toMatchObject({
      state: "active",
      version: 4,
      maximumActivationDays: 60,
      quota: { hours24: 4, days7: 12, days30: 18 },
    });
  });

  it("贯通零金额支付前置、接单和履约闭环", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    const applicationPath =
      `${running.url}/v1/internal-sandbox/app/vehicle-reviews/vehicle-application-7`;
    await fetch(`${applicationPath}/draft`, {
      method: "POST",
      headers: { ...appHeaders, "Idempotency-Key": "trip-driver-draft" },
      body: JSON.stringify({
        vehicleType: "合成履约车辆",
        maxPassengerCount: 3,
        insuranceExpiresOn: "2027-08-31",
        syntheticAttachmentId: "synthetic-trip-driver-document",
        expectedVersion: 0,
      }),
    });
    await fetch(`${applicationPath}/submit`, {
      method: "POST",
      headers: { ...appHeaders, "Idempotency-Key": "trip-driver-submit" },
      body: JSON.stringify({ expectedVersion: 1 }),
    });
    const claim = await fetch(
      `${running.url}/v1/internal-sandbox/admin/review-tasks/task-vehicle-application-7/claim`,
      {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": "trip-driver-claim" },
        body: JSON.stringify({ expectedTaskVersion: 1 }),
      },
    );
    const claimed = await claim.json() as { taskVersion: number; vehicleReviewVersion: number };
    await fetch(
      `${running.url}/v1/internal-sandbox/admin/review-tasks/task-vehicle-application-7/approve`,
      {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": "trip-driver-approve" },
        body: JSON.stringify({
          reasonCode: "approved_standard",
          previewConfirmed: true,
          expectedTaskVersion: claimed.taskVersion,
          expectedVehicleReviewVersion: claimed.vehicleReviewVersion,
        }),
      },
    );

    const dashboard = await fetch(
      `${running.url}/v1/internal-sandbox/app/synthetic-trips/dashboard`,
      { headers: appHeaders },
    );
    const available = (await dashboard.json()) as {
      availableDriverTrips: Array<{ tripId: string; version: number; payment: { amountMinor: number } }>;
    };
    expect(available.availableDriverTrips[0]).toMatchObject({
      tripId: "synthetic-trip-seed-1",
      payment: { amountMinor: 0 },
    });

    const accepted = await fetch(
      `${running.url}/v1/internal-sandbox/app/synthetic-trips/synthetic-trip-seed-1/accept`,
      {
        method: "POST",
        headers: { ...appHeaders, "Idempotency-Key": "trip-http-accept" },
        body: JSON.stringify({ expectedVersion: available.availableDriverTrips[0]!.version }),
      },
    );
    const acceptedBody = await accepted.json() as { version: number };
    expect(accepted.status).toBe(200);
    const started = await fetch(
      `${running.url}/v1/internal-sandbox/app/synthetic-trips/synthetic-trip-seed-1/start`,
      {
        method: "POST",
        headers: { ...appHeaders, "Idempotency-Key": "trip-http-start" },
        body: JSON.stringify({ expectedVersion: acceptedBody.version }),
      },
    );
    const startedBody = await started.json() as { version: number };
    const completed = await fetch(
      `${running.url}/v1/internal-sandbox/app/synthetic-trips/synthetic-trip-seed-1/complete`,
      {
        method: "POST",
        headers: { ...appHeaders, "Idempotency-Key": "trip-http-complete" },
        body: JSON.stringify({ expectedVersion: startedBody.version }),
      },
    );
    expect(await completed.json()).toMatchObject({
      state: "completed",
      quotaPolicy: "base",
      payment: { amountMinor: 0, realPayment: false, state: "closed" },
    });
  });

  it("通过位置心跳查询附近邀请并从邀请端点接单", async () => {
    const clock = new Date("2026-07-13T12:00:00.000Z");
    running = await startInternalSandboxHttpServer({ port: 0, now: () => clock });
    await running.sandbox.vehicleReviewRepository.put(
      "vehicle-application-7",
      {
        applicationId: "vehicle-application-7",
        accountId: "synthetic-account-7",
        status: "approved",
        ownerIdentityAvailable: true,
        vehicleType: "合成派单车辆",
        maxPassengerCount: 3,
        insuranceExpiresOn: "2027-08-31",
        syntheticAttachmentId: "synthetic-dispatch-document",
        requestedMaterialCodes: [],
        events: [{ code: "approved", occurredAt: clock.toISOString() }],
        processedKeys: [],
        synthetic: true,
      },
      0,
    );
    const presence = await fetch(
      `${running.url}/v1/internal-sandbox/app/driver/dispatch-presence`,
      {
        method: "POST",
        headers: { ...appHeaders, "Idempotency-Key": "dispatch-presence-http" },
        body: JSON.stringify({
          state: "online",
          location: {
            latitude: 31.2304,
            longitude: 121.4737,
            coordinateSystem: "gcj02",
            accuracyMeters: 20,
            capturedAt: clock.toISOString(),
            synthetic: true,
          },
        }),
      },
    );
    expect(presence.status).toBe(200);
    await running.sandbox.outbox.append({
      eventId: "http-trip-matchable",
      aggregateType: "synthetic_trip",
      aggregateId: "synthetic-trip-seed-1",
      eventType: "trip_matchable",
      payload: {},
      occurredAt: clock.toISOString(),
      synthetic: true,
    });

    const offersResponse = await fetch(
      `${running.url}/v1/internal-sandbox/app/driver/offers`,
      { headers: appHeaders },
    );
    const offers = await offersResponse.json() as {
      offers: Array<{ offerId: string; tripVersion: number; distanceMeters: number }>;
    };
    expect(offersResponse.status).toBe(200);
    expect(offers.offers[0]?.distanceMeters).toBeLessThanOrEqual(10_000);

    const accepted = await fetch(
      `${running.url}/v1/internal-sandbox/app/driver/offers/${offers.offers[0]!.offerId}/accept`,
      {
        method: "POST",
        headers: { ...appHeaders, "Idempotency-Key": "dispatch-accept-http" },
        body: JSON.stringify({ expectedTripVersion: offers.offers[0]!.tripVersion }),
      },
    );
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({
      state: "accepted",
      driverAccountId: "synthetic-account-7",
    });
  });

  it("贯通临时对话、举报冻结、申诉和独立安全恢复", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    await running.sandbox.vehicleReviewRepository.put(
      "vehicle-application-7",
      {
        applicationId: "vehicle-application-7",
        accountId: "synthetic-account-7",
        status: "approved",
        ownerIdentityAvailable: true,
        vehicleType: "合成安全车辆",
        maxPassengerCount: 3,
        insuranceExpiresOn: "2027-08-31",
        syntheticAttachmentId: "synthetic-safety-document",
        requestedMaterialCodes: [],
        events: [{ code: "approved", occurredAt: "2026-07-11T11:00:00.000Z" }],
        processedKeys: [],
        synthetic: true,
      },
      0,
    );
    const dashboard = await fetch(
      `${running.url}/v1/internal-sandbox/app/synthetic-trips/dashboard`,
      { headers: appHeaders },
    );
    const available = (await dashboard.json()) as {
      availableDriverTrips: Array<{ tripId: string; version: number }>;
    };
    const accepted = await fetch(
      `${running.url}/v1/internal-sandbox/app/synthetic-trips/synthetic-trip-seed-1/accept`,
      {
        method: "POST",
        headers: { ...appHeaders, "Idempotency-Key": "safety-trip-accept" },
        body: JSON.stringify({ expectedVersion: available.availableDriverTrips[0]!.version }),
      },
    );
    const acceptedBody = await accepted.json() as { version: number };
    const started = await fetch(
      `${running.url}/v1/internal-sandbox/app/synthetic-trips/synthetic-trip-seed-1/start`,
      {
        method: "POST",
        headers: { ...appHeaders, "Idempotency-Key": "safety-trip-start" },
        body: JSON.stringify({ expectedVersion: acceptedBody.version }),
      },
    );
    expect(started.status).toBe(200);

    const message = await fetch(
      `${running.url}/v1/internal-sandbox/app/synthetic-trips/synthetic-trip-seed-1/safety/messages`,
      {
        method: "POST",
        headers: { ...appHeaders, "Idempotency-Key": "safety-chat-message" },
        body: JSON.stringify({ body: "合成消息：请确认当前状态。" }),
      },
    );
    expect(await message.json()).toMatchObject({
      chat: { state: "open", messages: [{ synthetic: true }] },
      realChatEnabled: false,
    });

    const passengerHeaders = {
      Authorization: "Sandbox synthetic-passenger-8",
      "Content-Type": "application/json",
    };
    const reported = await fetch(
      `${running.url}/v1/internal-sandbox/app/synthetic-trips/synthetic-trip-seed-1/safety/reports`,
      {
        method: "POST",
        headers: { ...passengerHeaders, "Idempotency-Key": "safety-report-http" },
        body: JSON.stringify({ reasonCode: "unsafe_behavior" }),
      },
    );
    expect(await reported.json()).toMatchObject({
      chat: { state: "frozen" },
      safetyCase: { state: "open_frozen", version: 1 },
    });

    const appealed = await fetch(
      `${running.url}/v1/internal-sandbox/app/safety-cases/safety-synthetic-trip-seed-1/appeal`,
      {
        method: "POST",
        headers: { ...appHeaders, "Idempotency-Key": "safety-appeal-http" },
        body: JSON.stringify({ expectedVersion: 1 }),
      },
    );
    expect(await appealed.json()).toMatchObject({ state: "appealing", version: 2 });
    const stillFrozen = await fetch(
      `${running.url}/v1/internal-sandbox/app/synthetic-trips/synthetic-trip-seed-1/safety`,
      { headers: appHeaders },
    );
    expect(await stillFrozen.json()).toMatchObject({ chat: { state: "frozen" } });

    const resolved = await fetch(
      `${running.url}/v1/internal-sandbox/safety/cases/safety-synthetic-trip-seed-1/resolution`,
      {
        method: "POST",
        headers: {
          Authorization: "Sandbox synthetic-safety-001",
          "Content-Type": "application/json",
          "Idempotency-Key": "safety-resolve-http",
        },
        body: JSON.stringify({ expectedVersion: 2, outcome: "restore_access" }),
      },
    );
    expect(await resolved.json()).toMatchObject({
      state: "restored",
      resolutionCode: "restore_access",
    });
  });
});

async function createAdminSession(
  baseUrl: string,
  workEmail: string,
  workIdentityId: string,
): Promise<{ accessToken: string }> {
  const challenge = await (
    await fetch(`${baseUrl}/v1/internal-sandbox/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workEmail,
        password: "Rego-Internal-2026!",
      }),
    })
  ).json() as { challengeId: string };
  const verification = await (
    await fetch(`${baseUrl}/v1/internal-sandbox/admin/auth/mfa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeId: challenge.challengeId,
        totpCode: "826419",
      }),
    })
  ).json() as { selectionToken: string };
  return (
    await fetch(`${baseUrl}/v1/internal-sandbox/admin/auth/work-identities/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectionToken: verification.selectionToken,
        workIdentityId,
      }),
    })
  ).json() as Promise<{ accessToken: string }>;
}
