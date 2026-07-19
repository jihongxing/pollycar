import { afterEach, describe, expect, it } from "vitest";
import { startInternalSandboxHttpServer } from "./internal-sandbox-server.js";

const platformHeaders = {
  Authorization: "Sandbox synthetic-platform-ops-001",
  "Content-Type": "application/json",
  "X-Correlation-Id": "stage-three-http-correlation",
  "X-Request-Id": "stage-three-http-request",
};

describe("运营控制台阶段三行程客服安全 HTTP API", () => {
  let running:
    | Awaited<ReturnType<typeof startInternalSandboxHttpServer>>
    | undefined;

  afterEach(async () => {
    await running?.close();
    running = undefined;
  });

  it("阶段一与对应阶段三门禁必须同时开启", async () => {
    running = await startInternalSandboxHttpServer({
      port: 0,
      featureGates: { syntheticAdminTripOperations: true },
    });
    const closed = await fetch(
      `${running.url}/v1/internal-sandbox/admin/trip-case-management/trip-operations`,
      { headers: platformHeaders },
    );
    expect(closed.status).toBe(403);
    expect((await closed.json()).error.code).toBe("FEATURE_DISABLED");
    await running.close();

    running = await startInternalSandboxHttpServer({
      port: 0,
      featureGates: {
        syntheticAdminMultiOrganization: true,
        syntheticAdminTripOperations: true,
      },
    });
    const opened = await fetch(
      `${running.url}/v1/internal-sandbox/admin/trip-case-management/trip-operations`,
      { headers: platformHeaders },
    );
    expect(opened.status).toBe(200);
  });

  it("运营主体跨主体查询被服务端拒绝", async () => {
    running = await stageThreeServer();
    const response = await fetch(
      `${running.url}/v1/internal-sandbox/admin/trip-case-management/trips/trip-synthetic-8466`,
      {
        headers: {
          ...platformHeaders,
          Authorization: "Sandbox synthetic-operator-ops-001",
        },
      },
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("ADMIN_TRIP_SCOPE_FORBIDDEN");
  });

  it("唯一命令入口强制幂等键并返回原结果", async () => {
    running = await stageThreeServer();
    const url = `${running.url}/v1/internal-sandbox/admin/trip-case-management/commands`;
    const body = JSON.stringify({
      type: "query_command_recovery",
      recoveryTaskId: "recovery-synthetic-017",
      resourceVersion: 3,
    });
    const missing = await fetch(url, {
      method: "POST",
      headers: {
        ...platformHeaders,
        Authorization: "Sandbox synthetic-technical-ops-001",
      },
      body,
    });
    expect(missing.status).toBe(400);

    const request = {
      method: "POST",
      headers: {
        ...platformHeaders,
        Authorization: "Sandbox synthetic-technical-ops-001",
        "Idempotency-Key": "stage-three-recovery-0001",
      },
      body,
    };
    const first = await fetch(url, request);
    const second = await fetch(url, request);
    expect(first.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
  });

  it("客服不能读取安全案件且证据字段要求有效授权", async () => {
    running = await stageThreeServer();
    const safety = await fetch(
      `${running.url}/v1/internal-sandbox/admin/trip-case-management/safety-cases/safety-synthetic-8421`,
      {
        headers: {
          ...platformHeaders,
          Authorization: "Sandbox synthetic-support-001",
        },
      },
    );
    expect(safety.status).toBe(403);

    const evidence = await fetch(
      `${running.url}/v1/internal-sandbox/admin/trip-case-management/evidence-grants/unknown/fields/raw_chat`,
      {
        headers: {
          ...platformHeaders,
          Authorization: "Sandbox synthetic-safety-officer-001",
        },
      },
    );
    expect(evidence.status).not.toBe(200);
  });
});

function stageThreeServer() {
  return startInternalSandboxHttpServer({
    port: 0,
    featureGates: {
      syntheticAdminMultiOrganization: true,
      syntheticAdminTripOperations: true,
      syntheticAdminCaseManagement: true,
    },
  });
}
