import type { AuditEntry, AuditLog } from "../ports/audit.js";
import type { Outbox } from "../ports/outbox.js";

export class OutboxAuditLog implements AuditLog {
  public constructor(
    private readonly audit: AuditLog,
    private readonly outbox: Outbox,
  ) {}

  public async append(entry: AuditEntry): Promise<void> {
    await this.audit.append(entry);
    await this.outbox.append({
      eventId: `outbox-${entry.id}`,
      aggregateType: entry.subjectType,
      aggregateId: entry.subjectId,
      eventType:
        entry.action === "zero_money_payment_completed"
          ? "trip_matchable"
          : entry.action === "synthetic_trip_accepted"
            ? "trip_assigned"
            : entry.action,
      payload: {
        actorId: entry.actorId,
        outcome: entry.outcome,
        reasonCode: entry.reasonCode,
        correlationId: entry.correlationId,
      },
      occurredAt: entry.occurredAt,
      synthetic: true,
    });
  }

  public query(subjectType?: string, subjectId?: string) {
    return this.audit.query(subjectType, subjectId);
  }
}
