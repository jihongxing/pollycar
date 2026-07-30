import {
  parseAppPublicConfig,
  type AppPublicConfig,
} from "@pollycar/configuration/public";

export function resolveAppPublicConfig(
  serialized = process.env.EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG,
): AppPublicConfig {
  return parseAppPublicConfig(serialized);
}
