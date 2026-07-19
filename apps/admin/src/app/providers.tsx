import type { ReactNode } from "react";
import type { AdminReviewClient, AdminSafetyCaseClient } from "@pollycar/contracts";
import { ReviewTaskProvider } from "../application/review-task-context";
import { SafetyCaseProvider } from "../application/safety-case-context";
import { ThemeProvider } from "../theme/theme-provider";

export function Providers({
  children,
  client,
  safetyClient,
}: Readonly<{
  children: ReactNode;
  client?: AdminReviewClient | undefined;
  safetyClient?: AdminSafetyCaseClient | undefined;
}>) {
  return (
    <ThemeProvider>
      <ReviewTaskProvider client={client}>
        <SafetyCaseProvider client={safetyClient}>{children}</SafetyCaseProvider>
      </ReviewTaskProvider>
    </ThemeProvider>
  );
}
