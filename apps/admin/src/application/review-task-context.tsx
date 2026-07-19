import type { AdminReviewClient } from "@pollycar/contracts";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { SyntheticAdminReviewClient } from "../infrastructure/synthetic-admin-review-client";
import { HttpAdminReviewClient } from "../infrastructure/http-admin-review-client";
import { resolveAdminApiBaseUrl } from "../infrastructure/api-base-url";

const ClientContext = createContext<AdminReviewClient | undefined>(undefined);

export function ReviewTaskProvider({ children, client }: Readonly<{ children: ReactNode; client?: AdminReviewClient | undefined }>) {
  const value = useMemo(
    () =>
      client ??
      (import.meta.env.MODE === "test"
        ? new SyntheticAdminReviewClient()
        : new HttpAdminReviewClient(resolveAdminApiBaseUrl())),
    [client],
  );
  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
}

export function useReviewTaskClient() {
  const client = useContext(ClientContext);
  if (!client) throw new Error("ReviewTaskProvider 缺失");
  return client;
}
