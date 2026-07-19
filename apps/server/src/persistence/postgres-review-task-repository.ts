import type { ReviewTaskRecord, ReviewTaskRepository } from "../ports/review-tasks.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

type ReviewTaskRow = Readonly<{
  payload: unknown;
}>;

export class PostgresReviewTaskRepository implements ReviewTaskRepository {
  public constructor(private readonly transaction: PostgresTransaction) {}

  public async list(): Promise<readonly ReviewTaskRecord[]> {
    const result = await this.transaction.currentClient().query<ReviewTaskRow>(
      `SELECT payload
         FROM pollycar_review_tasks
        ORDER BY payload->>'submittedAt', task_id`,
    );
    return result.rows.map((row) => Object.freeze(row.payload as ReviewTaskRecord));
  }

  public async get(taskId: string): Promise<ReviewTaskRecord | undefined> {
    const result = await this.transaction.currentClient().query<ReviewTaskRow>(
      "SELECT payload FROM pollycar_review_tasks WHERE task_id = $1",
      [taskId],
    );
    return result.rows[0]
      ? Object.freeze(result.rows[0].payload as ReviewTaskRecord)
      : undefined;
  }

  public async create(record: ReviewTaskRecord): Promise<boolean> {
    assertSynthetic(record);
    const result = await this.transaction.currentClient().query(
      `INSERT INTO pollycar_review_tasks (task_id, task_version, payload, synthetic)
       VALUES ($1, $2, $3::jsonb, true)
       ON CONFLICT DO NOTHING`,
      [record.taskId, record.taskVersion, JSON.stringify(record)],
    );
    return result.rowCount === 1;
  }

  public async compareAndSet(
    taskId: string,
    expectedVersion: number,
    next: ReviewTaskRecord,
  ): Promise<boolean> {
    assertSynthetic(next);
    const result = await this.transaction.currentClient().query(
      `UPDATE pollycar_review_tasks
          SET task_version = $3, payload = $4::jsonb, updated_at = now()
        WHERE task_id = $1 AND task_version = $2`,
      [taskId, expectedVersion, next.taskVersion, JSON.stringify(next)],
    );
    return result.rowCount === 1;
  }
}

function assertSynthetic(record: ReviewTaskRecord): void {
  if (!record.synthetic) throw new Error("REAL_DATA_FORBIDDEN");
}
