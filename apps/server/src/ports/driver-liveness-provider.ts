import type { DriverLivenessResultCategory } from "@pollycar/contracts";

export interface DriverLivenessProvider {
  readonly mode: "synthetic" | "disabled-production";
  evaluateSynthetic(
    scenario: DriverLivenessResultCategory,
  ): Promise<DriverLivenessResultCategory>;
  createRealSession(): Promise<never>;
}
