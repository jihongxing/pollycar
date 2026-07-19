import { afterEach, describe, expect, it } from "vitest";
import { startInternalSandboxHttpServer } from "./internal-sandbox-server.js";

const platformHeaders = {
  Authorization: "Sandbox synthetic-platform-ops-001",
  "Content-Type": "application/json",
  "X-Correlation-Id": "http-platform-correlation",
  "X-Request-Id": "http-platform-request",
};

const operatorHeaders = {
  Authorization: "Sandbox synthetic-operator-ops-001",
  "Content-Type": "application/json",
  "X-Correlation-Id": "http-operator-correlation",
  "X-Request-Id": "http-operator-request",
};

describe("运营控制台阶段一多组织 HTTP API", () => {
  let running:
    | Awaited<ReturnType<typeof startInternalSandboxHttpServer>>
    | undefined;

  afterEach(async () => {
    await running?.close();
    running = undefined;
  });

  it("默认门禁关闭时拒绝阶段一 API", async () => {
    running = await startInternalSandboxHttpServer({ port: 0 });
    const response = await fetch(
      `${running.url}/v1/internal-sandbox/admin/access/session`,
      { headers: platformHeaders },
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FEATURE_DISABLED");
  });

  it("平台用户切换获批观察范围并读取只读名录", async () => {
    running = await startInternalSandboxHttpServer({
      port: 0,
      featureGates: { syntheticAdminMultiOrganization: true },
    });
    const session = await fetch(
      `${running.url}/v1/internal-sandbox/admin/access/session`,
      { headers: platformHeaders },
    );
    expect(await session.json()).toMatchObject({
      functionalRoles: ["platform_operations_lead"],
      context: { organizationId: "platform-pollycar", fixed: false },
    });

    const switched = await fetch(
      `${running.url}/v1/internal-sandbox/admin/access/context`,
      {
        method: "POST",
        headers: {
          ...platformHeaders,
          "Idempotency-Key": "context-switch-http-platform",
        },
        body: JSON.stringify({ organizationId: "operator-huhang" }),
      },
    );
    expect(await switched.json()).toMatchObject({
      functionalRoles: ["platform_operations_lead"],
      context: {
        organizationId: "operator-huhang",
        operatorScopes: ["operator-huhang"],
        fixed: false,
      },
    });

    const directory = await fetch(
      `${running.url}/v1/internal-sandbox/admin/access/operators`,
      { headers: platformHeaders },
    );
    const entries = (await directory.json()) as Array<{ operatorId: string }>;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.operatorId).toBe("operator-huhang");
  });

  it("运营主体用户不能切换主体或访问平台名录且拒绝结果可审计", async () => {
    running = await startInternalSandboxHttpServer({
      port: 0,
      featureGates: { syntheticAdminMultiOrganization: true },
    });
    const switchResponse = await fetch(
      `${running.url}/v1/internal-sandbox/admin/access/context`,
      {
        method: "POST",
        headers: {
          ...operatorHeaders,
          "Idempotency-Key": "context-switch-http-operator",
        },
        body: JSON.stringify({ organizationId: "operator-shencheng" }),
      },
    );
    expect(switchResponse.status).toBe(403);
    expect((await switchResponse.json()).error.code).toBe(
      "ADMIN_ORGANIZATION_CONTEXT_FIXED",
    );

    const directory = await fetch(
      `${running.url}/v1/internal-sandbox/admin/access/operators`,
      { headers: operatorHeaders },
    );
    expect(directory.status).toBe(403);
    expect((await directory.json()).error.code).toBe("AUTHORIZATION_DENIED");

    const workbench = await fetch(
      `${running.url}/v1/internal-sandbox/admin/access/operator-workbench`,
      { headers: operatorHeaders },
    );
    expect(await workbench.json()).toMatchObject({
      operatorId: "operator-huhang",
      crossOperatorAccessAllowed: false,
      financeReadOnly: true,
    });

    const audit = await fetch(
      `${running.url}/v1/internal-sandbox/admin/access/audit`,
      { headers: operatorHeaders },
    );
    expect(await audit.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "access_denied",
          reasonCode: "AUTHORIZATION_DENIED",
        }),
      ]),
    );
  });
});
