import { describe, expect, it } from "vitest";
import { PostgresOutbox } from "./postgres-outbox.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

describe("PostgreSQL outbox", () => {
  it("写入仅包含合成事件并可读取待发布事件", async () => {
    const queries: string[] = [];
    const transaction = {
      currentClient: () => ({
        query: async (text: string) => {
          queries.push(text);
          if (text.includes("RETURNING outbox.event_id")) {
            return {
              rows: [
                {
                  event_id: "event-1",
                  aggregate_type: "vehicle_review",
                  aggregate_id: "app-1",
                  event_type: "vehicle_review.submitted",
                  payload: { status: "under_review" },
                  occurred_at: "2026-07-11T00:00:00.000Z",
                  attempts: 1,
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 1 };
        },
      }),
    } as unknown as PostgresTransaction;
    const outbox = new PostgresOutbox(transaction);

    await outbox.append({
      eventId: "event-1",
      aggregateType: "vehicle_review",
      aggregateId: "app-1",
      eventType: "vehicle_review.submitted",
      payload: { status: "under_review" },
      occurredAt: "2026-07-11T00:00:00.000Z",
      synthetic: true,
    });
    const pending = await outbox.claim(10);

    expect(pending[0]).toMatchObject({ eventId: "event-1", attempts: 1, synthetic: true });
    expect(queries.some((query) => query.includes("FOR UPDATE SKIP LOCKED"))).toBe(true);
  });
});
