import type { AuditLog } from "../ports/audit.js";
import type { Task, TaskQueue } from "../ports/tasks.js";

export class MemoryTaskQueue implements TaskQueue {
  private readonly tasks = new Map<string, Task<object>>();
  private readonly idempotency = new Map<string, string>();

  public constructor(
    private readonly audit: AuditLog,
    private readonly now: () => Date,
  ) {}

  public async enqueue<TPayload extends object>(
    input: Omit<Task<TPayload>, "attempts" | "status">,
  ): Promise<Task<TPayload>> {
    const existingId = this.idempotency.get(input.idempotencyKey);
    if (existingId) {
      return this.tasks.get(existingId) as Task<TPayload>;
    }
    const task: Task<TPayload> = Object.freeze({ ...input, attempts: 0, status: "pending" });
    this.tasks.set(task.id, task);
    this.idempotency.set(task.idempotencyKey, task.id);
    return task;
  }

  public async claim(): Promise<Task | undefined> {
    const pending = [...this.tasks.values()].find((task) => task.status === "pending");
    if (!pending) return undefined;
    const running = Object.freeze({ ...pending, status: "running" as const });
    this.tasks.set(running.id, running);
    return running;
  }

  public async complete(id: string): Promise<void> {
    const task = this.requireTask(id);
    this.tasks.set(id, Object.freeze({ ...task, status: "completed" }));
  }

  public async fail(id: string): Promise<Task> {
    const task = this.requireTask(id);
    const attempts = task.attempts + 1;
    const status = attempts >= task.maximumAttempts ? "dead" : "pending";
    const next = Object.freeze({ ...task, attempts, status }) satisfies Task;
    this.tasks.set(id, next);
    return next;
  }

  public async replay(id: string, actorId: string): Promise<Task> {
    const task = this.requireTask(id);
    const replayed = Object.freeze({ ...task, status: "pending" as const });
    this.tasks.set(id, replayed);
    await this.audit.append({
      id: `audit-replay-${id}-${task.attempts}`,
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
    return replayed;
  }

  public async list(): Promise<readonly Task[]> {
    return [...this.tasks.values()];
  }

  private requireTask(id: string): Task {
    const task = this.tasks.get(id);
    if (!task) throw new Error("TASK_NOT_FOUND");
    return task;
  }
}
