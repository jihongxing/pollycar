import { describe, expect, it, vi } from "vitest";
import { HttpAdminReviewClient } from "./http-admin-review-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("HttpAdminReviewClient", () => {
  it("通过公开沙箱接口查询和认领任务", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([{ taskId: "task-001", synthetic: true }]))
      .mockResolvedValueOnce(jsonResponse({ taskId: "task-001", status: "in_progress", synthetic: true }));
    const client = new HttpAdminReviewClient("http://127.0.0.1:4310", fetcher);
    expect(await client.listTasks()).toHaveLength(1);
    await client.claimTask({
      reviewerId: "ignored-client-value",
      taskId: "task-001",
      expectedTaskVersion: 1,
      idempotencyKey: "claim-task-001",
    });
    expect(fetcher).toHaveBeenLastCalledWith(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/review-tasks/task-001/claim",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Sandbox synthetic-reviewer-001",
          "Idempotency-Key": "claim-task-001",
        }),
      }),
    );
    expect(fetcher.mock.calls[1]?.[1]?.body).not.toContain("ignored-client-value");
  });

  it("映射机器错误码并将写入网络失败标记为未知结果", async () => {
    const conflict = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ error: { code: "ADMIN_TASK_ALREADY_CLAIMED" } }, 409),
    );
    await expect(
      new HttpAdminReviewClient("http://127.0.0.1:4310", conflict).claimTask({
        reviewerId: "reviewer",
        taskId: "task-001",
        expectedTaskVersion: 1,
        idempotencyKey: "claim-conflict",
      }),
    ).rejects.toThrow("ADMIN_TASK_ALREADY_CLAIMED");

    const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("network"));
    await expect(
      new HttpAdminReviewClient("http://127.0.0.1:4310", offline).claimTask({
        reviewerId: "reviewer",
        taskId: "task-001",
        expectedTaskVersion: 1,
        idempotencyKey: "claim-unknown",
      }),
    ).rejects.toThrow("UNKNOWN_RESULT");
  });

  it("查询不存在的幂等结果返回 undefined", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ error: { code: "IDEMPOTENT_RESULT_NOT_FOUND" } }, 404),
    );
    await expect(
      new HttpAdminReviewClient("http://127.0.0.1:4310", fetcher).recoverResult("unknown-key"),
    ).resolves.toBeUndefined();
  });

  it("浏览器不支持 randomUUID 时仍能发出请求", async () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {},
    });
    try {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([]));
      await new HttpAdminReviewClient("http://127.0.0.1:4310", fetcher).listTasks();
      expect(fetcher).toHaveBeenCalledOnce();
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  it("默认浏览器 fetch 保持正确调用上下文", async () => {
    const originalFetch = globalThis.fetch;
    const receiver = globalThis;
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: function (this: typeof globalThis) {
        if (this !== receiver) throw new TypeError("Illegal invocation");
        return Promise.resolve(jsonResponse([]));
      },
    });
    try {
      await expect(
        new HttpAdminReviewClient("http://127.0.0.1:4310").listTasks(),
      ).resolves.toEqual([]);
    } finally {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        value: originalFetch,
      });
    }
  });

  it("代理空 500 响应统一映射为服务不可用", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("", { status: 500 }),
    );
    await expect(
      new HttpAdminReviewClient("http://127.0.0.1:4310", fetcher).listTasks(),
    ).rejects.toThrow("SERVICE_UNAVAILABLE");
  });

  it("通过公开契约提交批准与结构化拒绝决定", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ taskId: "task-003", status: "completed", synthetic: true }))
      .mockResolvedValueOnce(jsonResponse({ taskId: "task-002", status: "completed", synthetic: true }));
    const client = new HttpAdminReviewClient("http://127.0.0.1:4310", fetcher);
    await client.approveVehicle({
      reviewerId: "ignored",
      taskId: "task-003",
      reasonCode: "approved_standard",
      previewConfirmed: true,
      expectedTaskVersion: 2,
      expectedVehicleReviewVersion: 1,
      idempotencyKey: "approve-task-003",
    });
    expect(fetcher).toHaveBeenLastCalledWith(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/review-tasks/task-003/approve",
      expect.objectContaining({
        body: JSON.stringify({
          reasonCode: "approved_standard",
          previewConfirmed: true,
          expectedTaskVersion: 2,
          expectedVehicleReviewVersion: 1,
        }),
      }),
    );
    await client.rejectVehicle({
      reviewerId: "ignored",
      taskId: "task-002",
      reasonCode: "authorization_remaining_insufficient",
      previewConfirmed: true,
      expectedTaskVersion: 2,
      expectedVehicleReviewVersion: 1,
      idempotencyKey: "reject-task-002",
    });
    expect(fetcher).toHaveBeenLastCalledWith(
      "http://127.0.0.1:4310/v1/internal-sandbox/admin/review-tasks/task-002/reject",
      expect.objectContaining({
        body: JSON.stringify({
          reasonCode: "authorization_remaining_insufficient",
          previewConfirmed: true,
          expectedTaskVersion: 2,
          expectedVehicleReviewVersion: 1,
        }),
      }),
    );
  });
});
