import {
  getProductionAuthenticationReadinessConfig,
  type ProductionAuthenticationReadinessConfig,
} from "@pollycar/configuration";

export type { ProductionAuthenticationReadinessConfig };

export function createProductionAuthenticationReadinessConfig(
  environment: Readonly<Record<string, string | undefined>> = {},
): ProductionAuthenticationReadinessConfig {
  return getProductionAuthenticationReadinessConfig(environment);
}
