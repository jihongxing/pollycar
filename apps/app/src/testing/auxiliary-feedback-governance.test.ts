import { readFile } from "node:fs/promises";
import { fileURLToPath, URL as NodeUrl } from "node:url";
import { describe, expect, it } from "vitest";

const edgeFeatureFiles = [
  "../features/account/account-screens.tsx",
  "../features/account/common-settings-screens.tsx",
  "../features/account/legal-information-screen.tsx",
  "../features/adult-eligibility/adult-eligibility-screens.tsx",
  "../features/notifications/notification-center-screen.tsx",
  "../features/safety/safety-screens.tsx",
  "../features/vehicle-review/screens.tsx",
  "../features/wallet/wallet-screens.tsx",
] as const;

const legacyStatusComponents = [
  "AppV2StatusPanel",
  "StatusBanner",
  "StatusSummary",
] as const;

describe("辅助页面反馈治理", () => {
  it("非核心边缘页面不再使用旧式状态面板", async () => {
    for (const relativePath of edgeFeatureFiles) {
      const source = await readFile(
        fileURLToPath(new NodeUrl(relativePath, import.meta.url)),
        "utf8",
      );
      for (const component of legacyStatusComponents) {
        expect(source, `${relativePath} 不应使用 ${component}`).not.toContain(
          component,
        );
      }
    }
  });
});
