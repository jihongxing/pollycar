import { expect, test, type Page } from "@playwright/test";

import { openAuthenticatedPage } from "./helpers/authenticated-app";

test("参与资格同页操作使用可持续读取的行内结果", async ({ page }) => {
  await mockFreeFlexTrial(page, "success");
  await openAuthenticatedPage(page, "/eligibility-settings");

  await page.getByRole("button", { name: "申请参与资格" }).click();
  await page.getByRole("button", { name: "确认申请" }).click();

  await expect(page.getByRole("status", { name: /资格申请已提交/ })).toBeVisible();
  await expect(page.getByRole("alert", { name: /资格申请已提交/ })).toHaveCount(0);
});

test("参与资格失败留在当前任务位置且不叠加全局提示", async ({ page }) => {
  await mockFreeFlexTrial(page, "failure");
  await openAuthenticatedPage(page, "/eligibility-settings");

  await page.getByRole("button", { name: "申请参与资格" }).click();
  await page.getByRole("button", { name: "确认申请" }).click();

  const alerts = page.getByRole("alert");
  await expect(alerts).toHaveCount(1);
  await expect(alerts).toHaveAccessibleName(/资格申请没有提交/);
});

test("银行卡阻断结果使用行内反馈并在继续编辑后消失", async ({ page }) => {
  await openAuthenticatedPage(page, "/driver-bank-card");

  await page.getByRole("textbox", { name: "持卡人" }).fill("示例用户");
  await page.getByRole("textbox", { name: "银行卡号" }).fill("6222020202020202");
  await page.getByRole("textbox", { name: "开户行" }).fill("示例银行");
  await page.getByRole("textbox", { name: "预留手机号" }).fill("18800000007");
  await page.getByRole("checkbox", { name: "同意银行卡服务协议与隐私说明" }).click();
  await page.getByRole("button", { name: "确认绑定" }).click();

  const feedback = page.getByRole("alert", { name: /暂时无法绑定/ });
  await expect(feedback).toBeVisible();
  await page.getByRole("textbox", { name: "开户行" }).fill("示例城市银行");
  await expect(feedback).toHaveCount(0);
});

async function mockFreeFlexTrial(
  page: Page,
  outcome: "success" | "failure",
) {
  await page.route("**/v1/internal-sandbox/app/free-flex-trial", async (route) => {
    if (route.request().method() === "POST") {
      if (outcome === "failure") {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "service unavailable",
              correlationId: "inline-feedback-failure",
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(freeFlexTrial("under_review", 1)),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(freeFlexTrial("invited", 0)),
    });
  });
}

function freeFlexTrial(
  state: "invited" | "under_review",
  version: number,
) {
  return {
    eligibilityId: "free-flex-synthetic-account-7",
    accountId: "synthetic-account-7",
    batchId: "batch_0",
    state,
    version,
    qualificationFeeMinor: 0,
    paidPathEnabled: false,
    realInvitation: false,
    activationDaysInLookback: 0,
    maximumActivationDays: 60,
    quota: { hours24: 4, days7: 12, days30: 18 },
    synthetic: true,
  };
}
