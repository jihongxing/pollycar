export type TaskStatus = "pending" | "running" | "completed" | "failed" | "dead";

export interface Task<TPayload extends object = object> {
  readonly id: string;
  readonly type: string;
  readonly idempotencyKey: string;
  readonly payload: Readonly<TPayload>;
  readonly attempts: number;
  readonly maximumAttempts: number;
  readonly status: TaskStatus;
}

export interface TaskQueue {
  enqueue<TPayload extends object>(task: Omit<Task<TPayload>, "attempts" | "status">): Promise<Task<TPayload>>;
  claim(): Promise<Task | undefined>;
  complete(id: string): Promise<void>;
  fail(id: string): Promise<Task>;
  replay(id: string, actorId: string): Promise<Task>;
  list(): Promise<readonly Task[]>;
}
