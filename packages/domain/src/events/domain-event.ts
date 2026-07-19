export interface DomainEvent<TPayload extends object = Record<string, never>> {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly payload: Readonly<TPayload>;
}

export interface EventMetadata {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly occurredAt: Date;
  readonly correlationId: string;
  readonly causationId: string;
}

export function buildDomainEvent<TPayload extends object>(
  eventType: string,
  payload: TPayload,
  metadata: EventMetadata,
): DomainEvent<TPayload> {
  return {
    eventId: metadata.eventId,
    eventType,
    aggregateId: metadata.aggregateId,
    aggregateVersion: metadata.aggregateVersion,
    occurredAt: metadata.occurredAt.toISOString(),
    correlationId: metadata.correlationId,
    causationId: metadata.causationId,
    payload: Object.freeze({ ...payload }),
  };
}
