export type LogLevel = "info" | "warn" | "error";

export interface StructuredLogger {
  log(
    level: LogLevel,
    message: string,
    fields: Readonly<Record<string, string | number | boolean>>,
  ): void;
}

export interface Metrics {
  increment(name: string, value?: number, attributes?: Readonly<Record<string, string>>): void;
  observe(name: string, value: number, attributes?: Readonly<Record<string, string>>): void;
  snapshot(): Readonly<Record<string, number>>;
}

export interface TraceSpan {
  end(outcome: "ok" | "error"): void;
}

export interface Tracer {
  startSpan(name: string, attributes?: Readonly<Record<string, string>>): TraceSpan;
}
