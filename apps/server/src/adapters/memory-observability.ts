import type { Metrics, StructuredLogger, TraceSpan, Tracer } from "../ports/observability.js";

export interface LogRecord {
  readonly level: "info" | "warn" | "error";
  readonly message: string;
  readonly fields: Readonly<Record<string, string | number | boolean>>;
}

const forbiddenFieldPattern = /(token|secret|password|identity_document|chat_content|precise_location)/i;

export class MemoryLogger implements StructuredLogger {
  public readonly records: LogRecord[] = [];

  public log(
    level: "info" | "warn" | "error",
    message: string,
    fields: Readonly<Record<string, string | number | boolean>>,
  ): void {
    for (const key of Object.keys(fields)) {
      if (forbiddenFieldPattern.test(key)) throw new Error("SENSITIVE_LOG_FIELD_FORBIDDEN");
    }
    this.records.push(Object.freeze({ level, message, fields: Object.freeze({ ...fields }) }));
  }
}

export class MemoryMetrics implements Metrics {
  private readonly values = new Map<string, number>();

  public increment(name: string, value = 1): void {
    this.values.set(name, (this.values.get(name) ?? 0) + value);
  }

  public observe(name: string, value: number): void {
    this.values.set(name, value);
  }

  public snapshot(): Readonly<Record<string, number>> {
    return Object.freeze(Object.fromEntries(this.values));
  }
}

export class MemoryTracer implements Tracer {
  public readonly completed: Array<{ readonly name: string; readonly outcome: "ok" | "error" }> = [];

  public startSpan(name: string): TraceSpan {
    return {
      end: (outcome) => {
        this.completed.push(Object.freeze({ name, outcome }));
      },
    };
  }
}
