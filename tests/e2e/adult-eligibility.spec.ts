import { expect, test } from "@playwright/test";
import { loginThroughPhoneVerification } from "./helpers/authenticated-app";

test("我的实名使用目的性文案并保留必要告知", async ({ page }) => {
  await loginThroughPhoneVerification(page, { completeAdultEligibility: false });
  await expect(page.getByText("先确认本人和成年条件")).toBeVisible();
  await expect(page.getByText("确认成年条件")).toBeVisible();
  await expect(page.getByText(/经批准的实名服务处理/)).toBeVisible();
  await page.getByRole("button", { name: "了解并继续" }).click();
  await expect(page.getByRole("button", { name: "开始实名确认" })).toBeVisible();
  await expect(page.getByText("确认会连续完成")).toBeVisible();
  await expect(page.getByText("强制实名")).toHaveCount(0);
  await expect(page.getByText("不实名不得使用")).toHaveCount(0);
  await expect(page.getByText(/合成结果|反欺诈算法/)).toHaveCount(0);
});

test("已验证合成账户仍可进入叫车首页", async ({ page }) => {
  await loginThroughPhoneVerification(page);
  await expect(page.getByText("你要去哪里？")).toBeVisible();
  await expect(page.getByText("先确认本人和成年条件")).toHaveCount(0);
});
