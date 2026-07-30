import { resolveAdminPublicConfig } from "./public-config";

export function resolveAdminApiBaseUrl(): string {
  return resolveAdminPublicConfig().apiBaseUrl;
}
