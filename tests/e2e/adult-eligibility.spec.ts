import { expect, test } from "@playwright/test";
import { loginThroughPhoneVerification } from "./helpers/authenticated-app";

test("我的实名等待态使用页面级状态并避免重复说明", async ({ page }) => {
  await mockAdultEligibility(page, {
    state: "processing",
    recoveryAction: "wait_for_provider",
    providerStatus: "pending",
    allowedActions: ["refresh_provider_result"],
  });
  await loginThroughPhoneVerification(page, { completeAdultEligibility: false });

  await expect(
    page.getByRole("status", {
      name: "正在确认实名信息。结果更新后会显示下一步，可以稍后回来查看。",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "查看最新结果" })).toBeVisible();
  await expect(page.getByText("无需重复提交")).toHaveCount(0);
});

test("我的实名重试态只显示契约允许的恢复行动", async ({ page }) => {
  await mockAdultEligibility(page, {
    state: "needs_retry",
    failureCode: "document_expired",
    recoveryAction: "submit_appeal",
    providerStatus: "failed",
    allowedActions: ["submit_appeal"],
  });
  await loginThroughPhoneVerification(page, { completeAdultEligibility: false });

  await expect(
    page.getByRole("alert", {
      name: "实名信息需要继续处理。证件已过有效期，请更换有效证件。",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "提交复核说明" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重新完成实名确认" })).toHaveCount(0);
  await expect(page.getByText("document_expired")).toHaveCount(0);
  await expect(page.getByText("needs_retry")).toHaveCount(0);
});

test("我的实名使用目的性文案并保留必要告知", async ({ page }) => {
  await loginThroughPhoneVerification(page, { completeAdultEligibility: false });
  await expect(page.getByRole("heading", { name: "完成实名后使用行程" })).toBeVisible();
  await expect(page.getByText("用于确认账户本人和成年条件。")).toBeVisible();
  await expect(page.getByText(/身份信息和生物识别信息的处理说明/)).toBeVisible();
  await page.getByRole("button", { name: "了解并继续" }).click();
  await expect(page.getByRole("button", { name: "开始实名确认" })).toBeVisible();
  await expect(page.getByText("继续完成实名")).toBeVisible();
  await expect(page.getByLabel("申请进度，第 2 步，共 3 步")).toBeVisible();
  await expect(page.getByText("强制实名")).toHaveCount(0);
  await expect(page.getByText("不实名不得使用")).toHaveCount(0);
  await expect(page.getByText(/合成结果|反欺诈算法/)).toHaveCount(0);
});

test("已验证合成账户仍可进入叫车首页", async ({ page }) => {
  await loginThroughPhoneVerification(page);
  await expect(page.getByText("你要去哪里？")).toBeVisible();
  await expect(page.getByText("先确认本人和成年条件")).toHaveCount(0);
});

async function mockAdultEligibility(
  page: import("@playwright/test").Page,
  options: Readonly<{
    state: "processing" | "needs_retry";
    failureCode?: "document_expired";
    recoveryAction: "wait_for_provider" | "submit_appeal";
    providerStatus: "pending" | "failed";
    allowedActions: readonly ("refresh_provider_result" | "submit_appeal")[];
  }>,
) {
  await page.route("**/v1/internal-sandbox/app/adult-eligibility", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accountId: "synthetic-account-7",
        state: options.state,
        version: 3,
        requiredDocumentSides: ["front", "back"],
        uploadedDocuments: [],
        checks: {
          document: {
            status: options.state === "needs_retry" ? "failed" : "pending",
            ...(options.failureCode ? { failureCode: options.failureCode } : {}),
          },
          age: { status: "pending" },
          liveness: { status: "pending" },
          faceMatch: { status: "pending" },
        },
        ...(options.failureCode ? { failureCode: options.failureCode } : {}),
        recoveryAction: options.recoveryAction,
        captureStage:
          options.state === "needs_retry" ? "retry_required" : "automatic_processing",
        provider: {
          providerId: "synthetic-adult-eligibility",
          status: options.providerStatus,
          ...(options.failureCode ? { lastErrorCode: options.failureCode } : {}),
        },
        allowedActions: options.allowedActions,
        businessAccessAllowed: false,
        realIdentityDataEnabled: false,
        realBiometricDataEnabled: false,
        externalIdentityProviderEnabled: false,
        consent: {
          privacyNoticeVersion: "2026-07",
          identityProcessingAuthorized: true,
          biometricProcessingAuthorized: true,
          thirdPartyProcessingAuthorized: true,
        },
        synthetic: true,
      }),
    });
  });
}
