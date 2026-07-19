import type { Outbox, OutboxEvent, PendingOutboxEvent } from "../ports/outbox.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

type OutboxRow = Readonly<{
  event_id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: unknown;
  occurred_at: Date | string;
  attempts: number;
}>;

export class PostgresOutbox implements Outbox {
  public constructor(private readonly transaction: PostgresTransaction) {}

  public async append(event: OutboxEvent): Promise<void> {
    if (!event.synthetic) throw new Error("REAL_DATA_FORBIDDEN");
    await this.transaction.currentClient().query(
      `INSERT INTO pollycar_outbox
        (event_id, aggregate_type, aggregate_id, event_type, payload, occurred_at, synthetic)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, true)
       ON CONFLICT (event_id) DO NOTHING`,
      [
        event.eventId,
        event.aggregateType,
        event.aggregateId,
        event.eventType,
        JSON.stringify(event.payload),
        event.occurredAt,
      ],
    );
  }

  public async claim(
    limit: number,
    eventTypes?: readonly string[],
  ): Promise<readonly PendingOutboxEvent[]> {
    const result = await this.transaction.currentClient().query<OutboxRow>(
      `WITH pending AS (
         SELECT event_id
           FROM pollycar_outbox
          WHERE published_at IS NULL
            AND available_at <= now()
            AND ($2::text[] IS NULL OR event_type = ANY($2::text[]))
          ORDER BY occurred_at, event_id
          FOR UPDATE SKIP LOCKED
          LIMIT $1
       )
       UPDATE pollycar_outbox AS outbox
          SET attempts = outbox.attempts + 1
         FROM pending
        WHERE outbox.event_id = pending.event_id
       RETURNING outbox.event_id, outbox.aggregate_type, outbox.aggregate_id,
                 outbox.event_type, outbox.payload, outbox.occurred_at, outbox.attempts`,
      [limit, eventTypes?.length ? eventTypes : null],
    );
    return result.rows.map((row) =>
      Object.freeze({
        eventId: row.event_id,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        eventType: row.event_type,
        payload: row.payload as Readonly<Record<string, unknown>>,
        occurredAt:
          row.occurred_at instanceof Date ? row.occurred_at.toISOString() : row.occurred_at,
        attempts: row.attempts,
        synthetic: true,
      }),
    );
  }

  public async markPublished(eventId: string, publishedAt: string): Promise<void> {
    await this.transaction
      .currentClient()
      .query("UPDATE pollycar_outbox SET published_at = $2 WHERE event_id = $1", [
        eventId,
        publishedAt,
      ]);
  }

  public async markFailed(eventId: string, availableAt: string): Promise<void> {
    await this.transaction
      .currentClient()
      .query("UPDATE pollycar_outbox SET available_at = $2 WHERE event_id = $1", [
        eventId,
        availableAt,
      ]);
  }
}
