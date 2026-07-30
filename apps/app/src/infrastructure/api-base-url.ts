import { resolveAppPublicConfig } from "./public-config";

export function resolveApiBaseUrl(): string {
  return resolveAppPublicConfig().apiBaseUrl;
}
