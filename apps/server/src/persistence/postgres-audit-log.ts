import type { AuditEntry, AuditLog } from "../ports/audit.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

type AuditRow = Readonly<{
  audit_id: string;
  occurred_at: string | Date;
  actor_id: string;
  action: string;
  subject_type: string;
  subject_id: string;
  outcome: AuditEntry["outcome"];
  reason_code: string;
  correlation_id: string;
}>;

export class PostgresAuditLog implements AuditLog {
  public constructor(private readonly transaction: PostgresTransaction) {}

  public async append(entry: AuditEntry): Promise<void> {
    if (!entry.synthetic) throw new Error("AUDIT_REAL_DATA_FORBIDDEN");
    await this.transaction.currentClient().query(
      `INSERT INTO pollycar_audit_log
         (audit_id, occurred_at, actor_id, action, subject_type, subject_id, outcome,
          reason_code, correlation_id, synthetic)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       ON CONFLICT (audit_id) DO NOTHING`,
      [
        entry.id, entry.occurredAt, entry.actorId, entry.action, entry.subjectType,
        entry.subjectId, entry.outcome, entry.reasonCode, entry.correlationId,
      ],
    );
  }

  public async query(subjectType?: string, subjectId?: string): Promise<readonly AuditEntry[]> {
    const conditions: string[] = [];
    const values: string[] = [];
    if (subjectType !== undefined) {
      values.push(subjectType);
      conditions.push(`subject_type = $${values.length}`);
    }
    if (subjectId !== undefined) {
      values.push(subjectId);
      conditions.push(`subject_id = $${values.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await this.transaction.currentClient().query<AuditRow>(
      `SELECT audit_id, occurred_at, actor_id, action, subject_type, subject_id, outcome,
              reason_code, correlation_id
         FROM pollycar_audit_log ${where}
        ORDER BY occurred_at, audit_id`,
      values,
    );
    return result.rows.map((row) => Object.freeze({
      id: row.audit_id,
      occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : row.occurred_at,
      actorId: row.actor_id,
      action: row.action,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      outcome: row.outcome,
      reasonCode: row.reason_code,
      correlationId: row.correlation_id,
      synthetic: true,
    }));
  }
}
