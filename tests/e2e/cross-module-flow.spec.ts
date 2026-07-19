import { expect, test } from "@playwright/test";
import { openAuthenticatedPage } from "./helpers/authenticated-app";

test("车主审核、资格、行程与安全模块遵循正式认证门禁", async ({ page }) => {
  await openAuthenticatedPage(page, "/identity-settings");
  await expect(page.getByText("一个账户 · 两种身份")).toBeVisible();
  await expect(
    page.getByLabel("当前摘要").getByText("车主身份", { exact: true }),
  ).toBeVisible();

  await page.goto("/vehicle-settings");
  await expect(page.getByText(/车辆|审核/).first()).toBeVisible();

  await page.goto("/eligibility-settings");
  await expect(page.getByText(/资格|参与/).first()).toBeVisible();

  await page.goto("/driver-orders");
  await expect(page.getByText(/接单|行程/).first()).toBeVisible();

  await page.goto("/privacy-safety-settings");
  await expect(page.getByText(/安全|隐私|数据/).first()).toBeVisible();
});
