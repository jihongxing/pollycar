import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { PostgresAuditLog } from "./postgres-audit-log.js";
import { PostgresStructuredRepository } from "./postgres-structured-repository.js";
import { PostgresTaskQueue } from "./postgres-task-queue.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

describe("运营记录 PostgreSQL 持久化", () => {
  it("迁移建立后台任务、位置、通信、身份审计和安全案件专用表", async () => {
    const migration = await readFile(
      new URL("../../migrations/0003_operational_records.sql", import.meta.url),
      "utf8",
    );
    for (const table of [
      "pollycar_background_tasks",
      "pollycar_trip_chats",
      "pollycar_message_centers",
      "pollycar_location_lifecycle",
      "pollycar_identity_verifications",
      "pollycar_audit_log",
      "pollycar_safety_cases",
      "pollycar_temporary_chats",
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(migration).toContain("pollycar_background_tasks_claim_idx");
    expect(migration).toContain("pollycar_identity_audit_idx");
  });

  it("结构化仓储只写允许的专用表并执行乐观版本", async () => {
    const queries: string[] = [];
    const transaction = createTransaction(async (text) => {
      queries.push(text);
      return {
        rows: [{ record_key: "trip-1", version: 1, payload: { tripId: "trip-1", synthetic: true } }],
        rowCount: 1,
      };
    });
    const repository = new PostgresStructuredRepository<{ tripId: string; synthetic: true }>(
      "pollycar_trip_chats",
      transaction,
    );

    const saved = await repository.put("trip-1", { tripId: "trip-1", synthetic: true }, 0);

    expect(saved.version).toBe(1);
    expect(queries[0]).toContain("INSERT INTO pollycar_trip_chats");
    expect(() => new PostgresStructuredRepository("pollycar_records", transaction)).toThrow(
      "POSTGRES_TABLE_NOT_ALLOWED",
    );
  });

  it("后台任务支持持久化幂等入队、并发认领和失败重试", async () => {
    const queries: string[] = [];
    const rows = [{
      task_id: "vehicle-review-app-1",
      task_type: "vehicle_review",
      idempotency_key: "vehicle-review:app-1",
      payload: { applicationId: "app-1" },
      attempts: 0,
      maximum_attempts: 3,
      task_status: "pending",
    }];
    const transaction = createTransaction(async (text) => {
      queries.push(text);
      const row = { ...rows[0]!, task_status: text.includes("task_status = 'running'") ? "running" : "pending" };
      return { rows: [row], rowCount: 1 };
    });
    const audit = new PostgresAuditLog(transaction);
    const queue = new PostgresTaskQueue(transaction, audit, () => new Date("2026-07-13T00:00:00.000Z"));

    const enqueued = await queue.enqueue({
      id: "vehicle-review-app-1",
      type: "vehicle_review",
      idempotencyKey: "vehicle-review:app-1",
      payload: { applicationId: "app-1" },
      maximumAttempts: 3,
    });
    const claimed = await queue.claim();
    const failed = await queue.fail(enqueued.id);

    expect(enqueued.type).toBe("vehicle_review");
    expect(claimed?.status).toBe("running");
    expect(failed.status).toBe("pending");
    expect(queries.some((query) => query.includes("ON CONFLICT (idempotency_key)"))).toBe(true);
    expect(queries.some((query) => query.includes("FOR UPDATE SKIP LOCKED"))).toBe(true);
    expect(queries.some((query) => query.includes("attempts + 1 >= maximum_attempts"))).toBe(true);
  });

  it("身份验证审计写入后由 PostgreSQL 查询而非进程内存返回", async () => {
    const queries: string[] = [];
    const transaction = createTransaction(async (text) => {
      queries.push(text);
      if (text.includes("SELECT audit_id")) {
        return {
          rows: [{
            audit_id: "audit-identity-1",
            occurred_at: "2026-07-13T00:00:00.000Z",
            actor_id: "account-1",
            action: "adult_eligibility_verified",
            subject_type: "adult_eligibility",
            subject_id: "account-1",
            outcome: "succeeded",
            reason_code: "all_checks_passed",
            correlation_id: "verification-1",
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });
    const audit = new PostgresAuditLog(transaction);

    await audit.append({
      id: "audit-identity-1",
      occurredAt: "2026-07-13T00:00:00.000Z",
      actorId: "account-1",
      action: "adult_eligibility_verified",
      subjectType: "adult_eligibility",
      subjectId: "account-1",
      outcome: "succeeded",
      reasonCode: "all_checks_passed",
      correlationId: "verification-1",
      synthetic: true,
    });
    const entries = await audit.query("adult_eligibility", "account-1");

    expect(entries).toHaveLength(1);
    expect(entries[0]?.synthetic).toBe(true);
    expect(queries.some((query) => query.includes("INSERT INTO pollycar_audit_log"))).toBe(true);
    expect(queries.some((query) => query.includes("FROM pollycar_audit_log"))).toBe(true);
  });
});

function createTransaction(
  query: (text: string, values?: readonly unknown[]) => Promise<{
    rows: readonly Record<string, unknown>[];
    rowCount: number;
  }>,
): PostgresTransaction {
  const transaction = {
    currentClient: () => ({ query }),
    run: async <T>(operation: () => Promise<T>) => operation(),
  };
  return transaction as PostgresTransaction;
}
