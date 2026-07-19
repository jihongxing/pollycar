export function resolveApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_POLLYCAR_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_POLLYCAR_API_BASE_URL;
  }
  if (typeof window !== "undefined" && window.location.port === "8181") {
    return "http://127.0.0.1:4321";
  }
  return "http://127.0.0.1:4311";
}
