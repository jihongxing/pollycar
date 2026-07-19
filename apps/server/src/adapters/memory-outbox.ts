import type { Outbox, OutboxEvent, PendingOutboxEvent } from "../ports/outbox.js";

type StoredEvent = Readonly<{
  event: OutboxEvent;
  attempts: number;
  availableAt: string;
  publishedAt?: string;
}>;

export class MemoryOutbox implements Outbox {
  private readonly events = new Map<string, StoredEvent>();

  public async append(event: OutboxEvent): Promise<void> {
    if (!event.synthetic) throw new Error("REAL_DATA_FORBIDDEN");
    if (!this.events.has(event.eventId)) {
      this.events.set(event.eventId, {
        event: Object.freeze({ ...event }),
        attempts: 0,
        availableAt: event.occurredAt,
      });
    }
  }

  public async claim(
    limit: number,
    eventTypes?: readonly string[],
  ): Promise<readonly PendingOutboxEvent[]> {
    const allowed = eventTypes ? new Set(eventTypes) : undefined;
    const now = Date.now();
    const claimed: PendingOutboxEvent[] = [];
    for (const [eventId, stored] of this.events) {
      if (claimed.length >= limit) break;
      if (stored.publishedAt || new Date(stored.availableAt).getTime() > now) continue;
      if (allowed && !allowed.has(stored.event.eventType)) continue;
      const attempts = stored.attempts + 1;
      this.events.set(eventId, { ...stored, attempts });
      claimed.push(Object.freeze({ ...stored.event, attempts }));
    }
    return claimed;
  }

  public async markPublished(eventId: string, publishedAt: string): Promise<void> {
    const stored = this.events.get(eventId);
    if (stored) this.events.set(eventId, { ...stored, publishedAt });
  }

  public async markFailed(eventId: string, availableAt: string): Promise<void> {
    const stored = this.events.get(eventId);
    if (stored) this.events.set(eventId, { ...stored, availableAt });
  }
}

