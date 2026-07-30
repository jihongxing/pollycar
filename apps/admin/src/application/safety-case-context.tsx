import type { AdminSafetyCaseClient } from "@pollycar/contracts";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { HttpAdminSafetyClient } from "../infrastructure/http-admin-safety-client";
import { SyntheticAdminSafetyClient } from "../infrastructure/synthetic-admin-safety-client";
import { resolveAdminApiBaseUrl } from "../infrastructure/api-base-url";
import { resolveAdminPublicConfig } from "../infrastructure/public-config";

const SafetyClientContext = createContext<AdminSafetyCaseClient | undefined>(undefined);

export function SafetyCaseProvider({
  children,
  client,
}: Readonly<{ children: ReactNode; client?: AdminSafetyCaseClient | undefined }>) {
  const value = useMemo(
    () =>
      client ??
      (resolveAdminPublicConfig().profile === "test"
        ? new SyntheticAdminSafetyClient()
        : new HttpAdminSafetyClient(resolveAdminApiBaseUrl())),
    [client],
  );
  return <SafetyClientContext.Provider value={value}>{children}</SafetyClientContext.Provider>;
}

export function useAdminSafetyClient() {
  const client = useContext(SafetyClientContext);
  if (!client) throw new Error("SafetyCaseProvider 缺失");
  return client;
}
