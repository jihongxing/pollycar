import type { DriverLivenessResultCategory } from "@pollycar/contracts";
import type { DriverLivenessProvider } from "../ports/driver-liveness-provider.js";

export class DisabledProductionDriverLivenessProvider implements DriverLivenessProvider {
  public readonly mode = "disabled-production" as const;

  public async evaluateSynthetic(
    _scenario: DriverLivenessResultCategory,
  ): Promise<DriverLivenessResultCategory> {
    throw new Error("FEATURE_DISABLED");
  }

  public async createRealSession(): Promise<never> {
    throw new Error("EXTERNAL_IDENTITY_PROVIDER_DISABLED");
  }
}
