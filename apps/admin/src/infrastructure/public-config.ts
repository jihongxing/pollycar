import {
  parseAdminPublicConfig,
  type AdminPublicConfig,
} from "@pollycar/configuration/public";

export function resolveAdminPublicConfig(
  serialized = import.meta.env.VITE_POLLYCAR_PUBLIC_CONFIG,
): AdminPublicConfig {
  return parseAdminPublicConfig(serialized);
}
