import { describe, expect, it, vi } from "vitest";
import type {
  AdminOperationsTaskActionResult,
  AdminOperatorActionResult,
} from "@pollycar/contracts";
import { HttpAdminProductizationClient } from "./http-admin-productization-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("HttpAdminProductizationClient", () => {
  it("使用 Bearer 会话调用受控跨域搜索", async () => {
    const result = {
      groups: [],
      totalResults: 0,
      asOf: "2026-07-19T08:00:00.000Z",
      synthetic: true,
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(result));
    const client = new HttpAdminProductizationClient(
      "http://127.0.0.1:4310",
      fetcher,
    );

    await expect(client.searchAcrossDomains("access-token", {
      query: "浦东 机场",
      limitPerDomain: 5,
    })).resolves.toEqual(result);

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/search?query=%E6%B5%A6%E4%B8%9C+%E6%9C%BA%E5%9C%BA&limit_per_domain=5",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("使用当前 Bearer 会话切换工作身份", async () => {
    const result = {
      accessToken: "access-platform",
      refreshToken: "refresh-platform",
      sessionFamilyId: "family-platform",
      workIdentity: {
        workIdentityId: "synthetic-platform-ops-001",
        legacyAccessToken: "synthetic-platform-ops-001",
        type: "platform",
        organizationId: "platform-pollycar",
        organizationName: "PollyCar 平台",
        productRole: "operations_lead",
        productRoleName: "平台运营负责人",
        cityScopes: ["上海"],
        maximumDataClassification: "sensitive",
        synthetic: true,
      },
      navigation: {},
      accessTokenExpiresAt: "2026-07-19T10:30:00.000Z",
      absoluteExpiresAt: "2026-07-19T18:00:00.000Z",
      idleExpiresAt: "2026-07-19T11:00:00.000Z",
      synthetic: true,
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(result));
    const client = new HttpAdminProductizationClient(
      "http://127.0.0.1:4310",
      fetcher,
    );

    await expect(client.switchWorkIdentity(
      "access-operator",
      "synthetic-platform-ops-001",
    )).resolves.toEqual(result);

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/auth/work-identities/switch",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer access-operator",
        }),
        body: JSON.stringify({
          workIdentityId: "synthetic-platform-ops-001",
        }),
      }),
    );
  });

  it("使用 Bearer 会话和幂等键提交运营任务操作", async () => {
    const result: AdminOperationsTaskActionResult = {
      operationId: "operation-001",
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        task: {
          taskId: "ops-task-001",
          title: "核对异常行程",
          operatorName: "沪行出行服务",
          domain: "trip",
          assigneeName: "林云",
          dueAt: "2026-07-15T12:00:00.000Z",
          status: "processing",
          priority: "high",
          version: 2,
          updatedAt: "2026-07-15T10:05:00.000Z",
          synthetic: true,
        },
        organizationScope: {
          organizationId: "synthetic-operator-ops-001",
          organizationName: "沪行出行服务",
          cityScopes: ["shanghai"],
        },
        allowedActions: [],
        auditTrail: [],
        synthetic: true,
      },
      synthetic: true,
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(result));
    const client = new HttpAdminProductizationClient("http://127.0.0.1:4310", fetcher);

    await expect(client.performOperationsTaskAction(
      "access-token-001",
      "ops-task-001",
      {
        action: "assign",
        expectedVersion: 1,
        idempotencyKey: "assign-ops-task-001-v1",
        note: "由当班负责人分派",
      },
    )).resolves.toEqual(result);

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/operations/tasks/ops-task-001/actions/assign",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token-001",
          "Idempotency-Key": "assign-ops-task-001-v1",
        }),
        body: JSON.stringify({
          expectedVersion: 1,
          note: "由当班负责人分派",
        }),
      }),
    );
  });

  it("省略空备注并映射服务端错误码", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ error: { code: "ADMIN_RESOURCE_VERSION_CONFLICT" } }, 409),
    );
    const client = new HttpAdminProductizationClient("http://127.0.0.1:4310", fetcher);

    await expect(client.performOperationsTaskAction(
      "access-token-001",
      "ops-task-001",
      {
        action: "review",
        expectedVersion: 3,
        idempotencyKey: "review-ops-task-001-v3",
      },
    )).rejects.toThrow("ADMIN_RESOURCE_VERSION_CONFLICT");

    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
      expectedVersion: 3,
    }));
  });

  it("提交运营主体操作时携带 Bearer、幂等键、版本和原因", async () => {
    const result: AdminOperatorActionResult = {
      operationId: "operator-operation-001",
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        operator: {
          operatorId: "operator-huhang",
          operatorName: "沪行出行服务",
          syntheticReference: "OP-SH-00018",
          lifecycleState: "restricted",
          cityNames: ["上海"],
          activeDrivers: 128,
          activeVehicles: 132,
          pendingTasks: 7,
          resourceVersion: 19,
          updatedAt: "2026-07-15T10:30:00.000Z",
          contactMasked: "赵** · 138****2041",
          capabilities: [],
          blockers: [],
          synthetic: true,
        },
        organizationScope: {
          organizationId: "platform-pollycar",
          organizationName: "PollyCar 平台",
          cityScopes: ["上海"],
        },
        allowedActions: ["reactivate"],
        auditTrail: [],
        synthetic: true,
      },
      synthetic: true,
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(result));
    const client = new HttpAdminProductizationClient(
      "http://127.0.0.1:4310",
      fetcher,
    );

    await expect(client.performOperatorAction(
      "access-token-operator",
      "operator-huhang",
      {
        action: "restrict",
        expectedVersion: 18,
        idempotencyKey: "operator-restrict-0001",
        note: "安全联系人需要重新核验",
      },
    )).resolves.toEqual(result);

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/operators/operator-huhang/actions/restrict",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token-operator",
          "Idempotency-Key": "operator-restrict-0001",
        }),
        body: JSON.stringify({
          expectedVersion: 18,
          note: "安全联系人需要重新核验",
        }),
      }),
    );
  });

  it("提交车辆审核操作时携带 Bearer、双版本、幂等键和原因", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        operationId: "vehicle-operation-001",
        resultState: "confirmed",
        idempotentReplay: false,
        detail: {},
        synthetic: true,
      }),
    );
    const client = new HttpAdminProductizationClient(
      "http://127.0.0.1:4310",
      fetcher,
    );

    await client.performVehicleReviewAction(
      "access-token-reviewer",
      "vehicle-synthetic-204",
      {
        action: "request_material",
        expectedTaskVersion: 2,
        expectedVehicleReviewVersion: 1,
        idempotencyKey: "fleet-request-material-0001",
        reasonCode: "insurance_expiry_incomplete",
      },
    );

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/fleet/vehicles/vehicle-synthetic-204/actions/request_material",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token-reviewer",
          "Idempotency-Key": "fleet-request-material-0001",
        }),
        body: JSON.stringify({
          expectedTaskVersion: 2,
          expectedVehicleReviewVersion: 1,
          reasonCode: "insurance_expiry_incomplete",
        }),
      }),
    );
  });

  it("查询行程列表并提交双版本行程运营操作", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ items: [], synthetic: true }))
      .mockResolvedValueOnce(jsonResponse({
        operationId: "trip-operation-001",
        resultState: "confirmed",
        idempotentReplay: false,
        detail: {},
        synthetic: true,
      }));
    const client = new HttpAdminProductizationClient(
      "http://127.0.0.1:4310",
      fetcher,
    );

    await client.listTrips("access-token-ops", {
      pageSize: 25,
      search: "浦东机场",
      authoritativeState: "scheduled",
      operationState: "detected",
      sort: "updated_at_desc",
    });
    await client.performTripOperationAction(
      "access-token-ops",
      "trip-synthetic-8466",
      {
        action: "request_domain_action",
        expectedTaskVersion: 3,
        expectedTripVersion: 11,
        idempotencyKey: "trip-domain-action-001",
        reasonCode: "schedule_coordination",
      },
    );

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/trips?page_size=25&search=%E6%B5%A6%E4%B8%9C%E6%9C%BA%E5%9C%BA&authoritative_state=scheduled&operation_state=detected&sort=updated_at_desc",
    );
    expect(fetcher).toHaveBeenLastCalledWith(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/trips/trip-synthetic-8466/actions/request_domain_action",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token-ops",
          "Idempotency-Key": "trip-domain-action-001",
        }),
        body: JSON.stringify({
          expectedTaskVersion: 3,
          expectedTripVersion: 11,
          reasonCode: "schedule_coordination",
        }),
      }),
    );
  });

  it("查询案件列表并提交客服案件操作", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ items: [], synthetic: true }))
      .mockResolvedValueOnce(jsonResponse({
        operationId: "case-operation-001",
        resultState: "confirmed",
        idempotentReplay: false,
        detail: {},
        synthetic: true,
      }));
    const client = new HttpAdminProductizationClient(
      "http://127.0.0.1:4310",
      fetcher,
    );

    await client.listCases("access-token-support", {
      pageSize: 25,
      search: "计划接驾",
      kind: "support",
      supportState: "investigating",
      sort: "updated_at_desc",
    });
    await client.performCaseAction(
      "access-token-support",
      "support",
      "support-synthetic-114",
      {
        action: "resolve",
        expectedVersion: 5,
        idempotencyKey: "support-resolve-client-1",
        note: "已确认处理结果",
      },
    );

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/cases?page_size=25&search=%E8%AE%A1%E5%88%92%E6%8E%A5%E9%A9%BE&kind=support&support_state=investigating&sort=updated_at_desc",
    );
    expect(fetcher).toHaveBeenLastCalledWith(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/cases/support/support-synthetic-114/actions/resolve",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token-support",
          "Idempotency-Key": "support-resolve-client-1",
        }),
        body: JSON.stringify({
          expectedVersion: 5,
          note: "已确认处理结果",
        }),
      }),
    );
  });

  it("查询驾驶舱名录并提交带版本和幂等键的治理意见", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ items: [], synthetic: true }))
      .mockResolvedValueOnce(jsonResponse({
        operationId: "executive-operation-001",
        resultState: "confirmed",
        idempotentReplay: false,
        detail: {},
        synthetic: true,
      }));
    const client = new HttpAdminProductizationClient(
      "http://127.0.0.1:4310",
      fetcher,
    );

    await client.listExecutiveResources("access-token-executive", {
      pageSize: 25,
      search: "海湾",
      kind: "decision_item",
      domain: "operations",
      blocking: false,
      sort: "updated_at_desc",
    });
    await client.performExecutiveAction(
      "access-token-executive",
      "decision_item",
      "decision-operator-haiwan",
      {
        action: "record_decision_opinion",
        idempotencyKey: "executive-opinion-client-001",
        expectedVersion: 1,
        decisionCode: "continue_controlled_review",
        reasonCode: "finance_blocker_open",
        responsibleRole: "operations_lead",
        dueAt: "2026-07-23T10:00:00.000Z",
      },
    );

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/executive?page_size=25&search=%E6%B5%B7%E6%B9%BE&kind=decision_item&domain=operations&blocking=false&sort=updated_at_desc",
    );
    expect(fetcher).toHaveBeenLastCalledWith(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/executive/decision_item/decision-operator-haiwan/actions/record_decision_opinion",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token-executive",
          "Idempotency-Key": "executive-opinion-client-001",
        }),
        body: JSON.stringify({
          expectedVersion: 1,
          reasonCode: "finance_blocker_open",
          decisionCode: "continue_controlled_review",
          responsibleRole: "operations_lead",
          dueAt: "2026-07-23T10:00:00.000Z",
        }),
      }),
    );
  });

  it("查询审计名录并提交受控调查操作", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ items: [], synthetic: true }))
      .mockResolvedValueOnce(jsonResponse({
        operationId: "audit-operation-001",
        resultState: "confirmed",
        idempotentReplay: false,
        detail: {},
        synthetic: true,
      }));
    const client = new HttpAdminProductizationClient(
      "http://127.0.0.1:4310",
      fetcher,
    );

    await client.listAuditResources("access-token-audit", {
      pageSize: 25,
      search: "访问",
      kind: "event",
      domain: "access",
      result: "denied",
      sort: "occurred_at_desc",
    });
    await client.performAuditAction(
      "access-token-audit",
      "event",
      "audit-event-001",
      {
        action: "open_investigation",
        idempotencyKey: "audit-open-client-001",
        expectedVersion: 1,
        reasonCode: "access_pattern_review",
      },
    );

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/audit?page_size=25&search=%E8%AE%BF%E9%97%AE&kind=event&domain=access&result=denied&sort=occurred_at_desc",
    );
    expect(fetcher).toHaveBeenLastCalledWith(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/audit/event/audit-event-001/actions/open_investigation",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token-audit",
          "Idempotency-Key": "audit-open-client-001",
        }),
        body: JSON.stringify({
          expectedVersion: 1,
          reasonCode: "access_pattern_review",
        }),
      }),
    );
  });

  it("查询数据报表详情并提交带版本和幂等键的刷新操作", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ items: [], synthetic: true }))
      .mockResolvedValueOnce(jsonResponse({ item: {}, synthetic: true }))
      .mockResolvedValueOnce(jsonResponse({
        operationId: "data-report-operation-001",
        resultState: "confirmed",
        idempotentReplay: false,
        detail: {},
        synthetic: true,
      }));
    const client = new HttpAdminProductizationClient(
      "http://127.0.0.1:4310",
      fetcher,
    );

    await client.listDataReports("access-token-data", {
      pageSize: 25,
      search: "任务",
      domain: "operations",
      state: "ready",
      sort: "refreshed_at_desc",
    });
    await client.getDataReport("access-token-data", "operations-health");
    await client.performDataReportAction(
      "access-token-data",
      "operations-health",
      {
        action: "refresh_report",
        idempotencyKey: "data-report-client-refresh-001",
        expectedVersion: 1,
        reasonCode: "scheduled_quality_review",
      },
    );

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/reports?page_size=25&search=%E4%BB%BB%E5%8A%A1&domain=operations&state=ready&sort=refreshed_at_desc",
    );
    expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual(expect.objectContaining({
      Authorization: "Bearer access-token-data",
    }));
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/reports/operations-health",
    );
    expect(fetcher).toHaveBeenLastCalledWith(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/reports/operations-health/actions/refresh_report",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token-data",
          "Idempotency-Key": "data-report-client-refresh-001",
        }),
        body: JSON.stringify({
          expectedVersion: 1,
          reasonCode: "scheduled_quality_review",
        }),
      }),
    );
  });
});
