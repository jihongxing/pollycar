import type { AuditLog } from "../ports/audit.js";
import type { Task, TaskQueue, TaskStatus } from "../ports/tasks.js";
import type { PostgresTransaction } from "./postgres-transaction.js";

type TaskRow = Readonly<{
  task_id: string;
  task_type: string;
  idempotency_key: string;
  payload: object;
  attempts: number;
  maximum_attempts: number;
  task_status: TaskStatus;
}>;

export class PostgresTaskQueue implements TaskQueue {
  public constructor(
    private readonly transaction: PostgresTransaction,
    private readonly audit: AuditLog,
    private readonly now: () => Date,
  ) {}

  public async enqueue<TPayload extends object>(
    input: Omit<Task<TPayload>, "attempts" | "status">,
  ): Promise<Task<TPayload>> {
    const result = await this.transaction.currentClient().query<TaskRow>(
      `INSERT INTO pollycar_background_tasks
         (task_id, task_type, idempotency_key, payload, maximum_attempts, task_status, synthetic)
       VALUES ($1, $2, $3, $4::jsonb, $5, 'pending', true)
       ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
       RETURNING task_id, task_type, idempotency_key, payload, attempts, maximum_attempts, task_status`,
      [input.id, input.type, input.idempotencyKey, JSON.stringify(input.payload), input.maximumAttempts],
    );
    return mapTask(result.rows[0]!) as Task<TPayload>;
  }

  public async claim(): Promise<Task | undefined> {
    return this.transaction.run(async () => {
      const result = await this.transaction.currentClient().query<TaskRow>(
        `WITH candidate AS (
           SELECT task_id FROM pollycar_background_tasks
            WHERE task_status = 'pending'
            ORDER BY created_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1
         )
         UPDATE pollycar_background_tasks AS task
            SET task_status = 'running', updated_at = now()
           FROM candidate
          WHERE task.task_id = candidate.task_id
         RETURNING task.task_id, task.task_type, task.idempotency_key, task.payload,
                   task.attempts, task.maximum_attempts, task.task_status`,
      );
      return result.rows[0] ? mapTask(result.rows[0]) : undefined;
    });
  }

  public async complete(id: string): Promise<void> {
    await this.updateStatus(id, "completed");
  }

  public async fail(id: string): Promise<Task> {
    const result = await this.transaction.currentClient().query<TaskRow>(
      `UPDATE pollycar_background_tasks
          SET attempts = attempts + 1,
              task_status = CASE WHEN attempts + 1 >= maximum_attempts THEN 'dead' ELSE 'pending' END,
              updated_at = now()
        WHERE task_id = $1
      RETURNING task_id, task_type, idempotency_key, payload, attempts, maximum_attempts, task_status`,
      [id],
    );
    if (!result.rows[0]) throw new Error("TASK_NOT_FOUND");
    return mapTask(result.rows[0]);
  }

  public async replay(id: string, actorId: string): Promise<Task> {
    const result = await this.transaction.currentClient().query<TaskRow>(
      `UPDATE pollycar_background_tasks SET task_status = 'pending', updated_at = now()
        WHERE task_id = $1
      RETURNING task_id, task_type, idempotency_key, payload, attempts, maximum_attempts, task_status`,
      [id],
    );
    if (!result.rows[0]) throw new Error("TASK_NOT_FOUND");
    await this.audit.append({
      id: `audit-replay-${id}-${result.rows[0].attempts}`,
      occurredAt: this.now().toISOString(),
      actorId,
      action: "task_replayed",
      subjectType: "task",
      subjectId: id,
      outcome: "succeeded",
      reasonCode: "manual_replay",
      correlationId: id,
      synthetic: true,
    });
    return mapTask(result.rows[0]);
  }

  public async list(): Promise<readonly Task[]> {
    const result = await this.transaction.currentClient().query<TaskRow>(
      `SELECT task_id, task_type, idempotency_key, payload, attempts, maximum_attempts, task_status
         FROM pollycar_background_tasks ORDER BY created_at, task_id`,
    );
    return result.rows.map(mapTask);
  }

  private async updateStatus(id: string, status: TaskStatus): Promise<void> {
    const result = await this.transaction.currentClient().query(
      `UPDATE pollycar_background_tasks SET task_status = $2, updated_at = now() WHERE task_id = $1`,
      [id, status],
    );
    if (result.rowCount === 0) throw new Error("TASK_NOT_FOUND");
  }
}

function mapTask(row: TaskRow): Task {
  return Object.freeze({
    id: row.task_id,
    type: row.task_type,
    idempotencyKey: row.idempotency_key,
    payload: Object.freeze(row.payload),
    attempts: row.attempts,
    maximumAttempts: row.maximum_attempts,
    status: row.task_status,
  });
}
