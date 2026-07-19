export function resolveAdminApiBaseUrl(): string {
  if (import.meta.env.VITE_ADMIN_API_BASE_URL) return import.meta.env.VITE_ADMIN_API_BASE_URL;
  if (typeof window !== "undefined" && window.location.port === "4174") {
    return "http://127.0.0.1:4321";
  }
  return "";
}
