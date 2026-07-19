export type OutboxEvent = Readonly<{
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Readonly<Record<string, unknown>>;
  occurredAt: string;
  synthetic: true;
}>;

export type PendingOutboxEvent = OutboxEvent &
  Readonly<{
    attempts: number;
  }>;

export interface Outbox {
  append(event: OutboxEvent): Promise<void>;
  claim(limit: number, eventTypes?: readonly string[]): Promise<readonly PendingOutboxEvent[]>;
  markPublished(eventId: string, publishedAt: string): Promise<void>;
  markFailed(eventId: string, availableAt: string): Promise<void>;
}
