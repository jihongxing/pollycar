import type { HealthComponent, HealthReport } from "../ports/health.js";

export class HealthService {
  public constructor(private readonly components: readonly HealthComponent[]) {}

  public liveness(): HealthReport {
    return { status: "up", components: {} };
  }

  public async readiness(): Promise<HealthReport> {
    const entries = await Promise.all(
      this.components.map(async (component) => [component.name, await component.check()] as const),
    );
    const components = Object.fromEntries(entries);
    return {
      status: entries.every(([, result]) => result.status === "up") ? "up" : "down",
      components,
    };
  }
}
