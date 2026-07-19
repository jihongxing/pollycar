import type { ReviewTaskRecord, ReviewTaskRepository } from "../ports/review-tasks.js";

export class MemoryReviewTaskRepository implements ReviewTaskRepository {
  private readonly records = new Map<string, ReviewTaskRecord>();

  public constructor(seed: readonly ReviewTaskRecord[]) {
    for (const record of seed) {
      if (!record.synthetic) throw new Error("REAL_DATA_FORBIDDEN");
      this.records.set(record.taskId, Object.freeze({ ...record }));
    }
  }

  public async list(): Promise<readonly ReviewTaskRecord[]> {
    return [...this.records.values()];
  }

  public async get(taskId: string): Promise<ReviewTaskRecord | undefined> {
    return this.records.get(taskId);
  }

  public async create(record: ReviewTaskRecord): Promise<boolean> {
    if (this.records.has(record.taskId)) return false;
    if (!record.synthetic) throw new Error("REAL_DATA_FORBIDDEN");
    this.records.set(record.taskId, Object.freeze({ ...record }));
    return true;
  }

  public async compareAndSet(
    taskId: string,
    expectedVersion: number,
    next: ReviewTaskRecord,
  ): Promise<boolean> {
    const current = this.records.get(taskId);
    if (!current || current.taskVersion !== expectedVersion) return false;
    if (!next.synthetic) throw new Error("REAL_DATA_FORBIDDEN");
    this.records.set(taskId, Object.freeze({ ...next }));
    return true;
  }
}
