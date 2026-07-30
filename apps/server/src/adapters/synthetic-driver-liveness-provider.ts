import type { DriverLivenessResultCategory } from "@pollycar/contracts";
import type { DriverLivenessProvider } from "../ports/driver-liveness-provider.js";

export class SyntheticDriverLivenessProvider implements DriverLivenessProvider {
  public readonly mode = "synthetic" as const;

  public async evaluateSynthetic(
    scenario: DriverLivenessResultCategory,
  ): Promise<DriverLivenessResultCategory> {
    return scenario;
  }

  public async createRealSession(): Promise<never> {
    throw new Error("REAL_BIOMETRIC_DATA_FORBIDDEN");
  }
}
