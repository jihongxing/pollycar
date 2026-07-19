export interface AuditEntry {
  readonly id: string;
  readonly occurredAt: string;
  readonly actorId: string;
  readonly action: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly outcome: "allowed" | "denied" | "succeeded" | "failed";
  readonly reasonCode: string;
  readonly correlationId: string;
  readonly synthetic: true;
}

export interface AuditLog {
  append(entry: AuditEntry): Promise<void>;
  query(subjectType?: string, subjectId?: string): Promise<readonly AuditEntry[]>;
}
