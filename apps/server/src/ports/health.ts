export type HealthStatus = "up" | "down";

export interface HealthComponent {
  readonly name: string;
  check(): Promise<{ readonly status: HealthStatus; readonly detail?: string }>;
}

export interface HealthReport {
  readonly status: HealthStatus;
  readonly components: Readonly<Record<string, { readonly status: HealthStatus; readonly detail?: string }>>;
}
