import type { AuditEntry, AuditLog } from "../ports/audit.js";

export class MemoryAuditLog implements AuditLog {
  private readonly entries: AuditEntry[] = [];

  public async append(entry: AuditEntry): Promise<void> {
    if (!entry.synthetic) {
      throw new Error("AUDIT_REAL_DATA_FORBIDDEN");
    }
    this.entries.push(Object.freeze({ ...entry }));
  }

  public async query(subjectType?: string, subjectId?: string): Promise<readonly AuditEntry[]> {
    return this.entries.filter(
      (entry) =>
        (subjectType === undefined || entry.subjectType === subjectType) &&
        (subjectId === undefined || entry.subjectId === subjectId),
    );
  }
}
