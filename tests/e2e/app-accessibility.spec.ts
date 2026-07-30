import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  completeOwnerParticipationConsent,
  loginThroughPhoneVerification,
  openAuthenticatedPage,
} from "./helpers/authenticated-app";

const criticalRules = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test("默认叫车首页无严重可访问性违规", async ({ page }) => {
  await loginThroughPhoneVerification(page);
  await expect(page).toHaveURL(/\/ride-home$/);
  await expect(page.getByRole("button", { name: "你要去哪里？" })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("身份切换面板支持键盘焦点和无障碍名称", async ({ page }) => {
  await loginThroughPhoneVerification(page);
  const identityButton = page.getByRole("button", {
    name: "打开账户与身份设置",
  });
  await identityButton.focus();
  await expect(identityButton).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByText("切换身份")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "身份切换面板" })).toBeVisible();
  const passengerIdentity = page.getByRole("button", { name: "乘客身份，当前使用" });
  const cancel = page.getByRole("button", { name: "取消" });
  await expect(passengerIdentity).toBeVisible();
  await expect(page.getByRole("button", { name: "车主身份，需要完成车辆审核" })).toBeVisible();
  await expect(passengerIdentity).toBeFocused();
  await expect(
    page
      .locator('[data-testid="app-shell-root"][inert]')
      .evaluateAll(
        (elements) =>
          elements.length > 0 && elements.every((element) => (element as HTMLElement).inert),
      ),
  ).resolves.toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(passengerIdentity).toBeFocused();
  await expectNoSeriousViolations(page, ["aria-allowed-attr"]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "身份切换面板" })).toHaveCount(0);
  await expect(identityButton).toBeFocused();
});

test("底部主导航和我的页面具有可访问名称", async ({ page }) => {
  await openAuthenticatedPage(page, "/account");
  await expect(page.getByRole("tablist", { name: "主导航" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "首页" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "我的" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: /申请成为车主|继续申请成为车主|车主申请审核中/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /我的实名，实名信息已确认/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /身份切换/ })).toHaveCount(0);
  await expectNoSeriousViolations(page);
});

test("车主申请表单具有可识别标签", async ({ page }) => {
  await openAuthenticatedPage(page, "/owner-apply-intro");
  await page.getByRole("button", { name: "开始准备" }).click();
  await completeOwnerParticipationConsent(page);

  await expect(page.getByRole("textbox", { name: "车辆类型" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "保险有效期" })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("最大字体下核心页面不横向溢出且保持屏幕阅读器语义", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("pollycar.qa.font-scale", "2"));
  await openAuthenticatedPage(page, "/account");

  await expect(page.getByRole("heading", { name: "林屿" })).toBeVisible();
  await expect(page.getByRole("button", { name: /申请成为车主|继续申请成为车主|车主申请审核中/ })).toBeVisible();
  const description = page.getByText("查看行程、账户资料和常用设置。");
  await expect(description).toBeVisible();
  expect(
    await description.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(30);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await expectNoSeriousViolations(page);
});

test("服务通知、通知设置和帮助反馈具备完整无障碍语义", async ({ page }) => {
  await openAuthenticatedPage(page, "/notifications");
  await expect(page.getByText("服务通知", { exact: true }).first()).toBeVisible();
  const firstNotification = page.getByRole("button", {
    name: /准备车辆资料|补充车辆资料|参与资格可以申请|确认启用参与资格/,
  }).first();
  await expect(firstNotification).toBeVisible();
  await firstNotification.click();
  await expect(page).toHaveURL(/\/notification-detail$/);
  await expect(page.getByText("通知详情", { exact: true }).first()).toBeVisible();
  await expectNoSeriousViolations(page);
  await page.evaluate(() => sessionStorage.removeItem("rego.notification-center.detail"));
  await page.goto("/notification-detail");
  await expect(page.getByLabel(/这条通知已不在当前列表/)).toBeVisible();
  await expect(page.getByRole("button", { name: "返回服务通知" })).toBeVisible();
  await expectNoSeriousViolations(page);

  await page.goto("/notification-settings");
  await expect(page.getByRole("switch", { name: "行程进展" })).toBeVisible();
  await expect(page.getByText("安全与账户提醒")).toBeVisible();
  await expect(page.getByText("始终开启")).toBeVisible();
  await expectNoSeriousViolations(page);

  await page.goto("/help-feedback");
  await expect(page.getByRole("textbox", { name: "反馈说明" })).toBeVisible();
  await expect(page.getByRole("button", { name: "分享反馈" })).toBeDisabled();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => undefined,
    });
  });
  await page.getByRole("textbox", { name: "反馈说明" }).fill("希望改进行程通知的阅读体验");
  await page.getByRole("button", { name: "分享反馈" }).click();
  await expect(
    page.getByRole("status", {
      name: "已打开分享菜单。请选择你希望使用的联系渠道。",
    }),
  ).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("登录协议入口具有可访问行动", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("rego.authentication.refresh-token");
    localStorage.removeItem("rego.authentication.device-id");
  });
  await page.reload();
  const legalLink = page.getByRole("link", {
    name: "查看服务协议、隐私政策和手机号认证说明",
  });
  await expect(legalLink).toBeVisible();
  await legalLink.click();
  await expect(page).toHaveURL(/\/legal-information$/);
  await expect(page.getByRole("heading", { name: "使用服务前，请了解这些内容" })).toBeVisible();
  await expectNoSeriousViolations(page);

  await page.getByRole("button", { name: "账户使用，查看" }).click();
  await expect(page).toHaveURL(/\/service-agreement$/);
  await expect(page.getByText("适用于账户使用、乘客行程以及通过准入后的车主参与。")).toBeVisible();
  await expectNoSeriousViolations(page);
  await page.getByRole("button", { name: "返回" }).click();

  await page.getByRole("button", { name: "信息如何使用，查看" }).click();
  await expect(page).toHaveURL(/\/privacy-policy$/);
  await expect(page.getByText(/建议在 24 小时内发起，会话最多开放 72 小时/)).toBeVisible();
  await expectNoSeriousViolations(page);
  await page.getByRole("button", { name: "返回" }).click();

  await page.getByRole("button", { name: "登录与设备，查看" }).click();
  await expect(page).toHaveURL(/\/phone-auth-notice$/);
  await expect(page.getByText("验证码用于确认当前手机号可由本人使用，请勿转交他人。")).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("身份、车辆和实名复核辅助页具有可访问恢复路径", async ({ page }) => {
  await openAuthenticatedPage(page, "/identity-settings");
  await expect(page.getByText("当前使用", { exact: true })).toBeVisible();
  await expect(page.getByText("可用身份", { exact: true })).toBeVisible();
  await expectNoSeriousViolations(page);

  await page.goto("/vehicle-settings");
  await expect(page.getByText("车辆信息", { exact: true })).toBeVisible();
  await expect(page.getByText("审核状态", { exact: true })).toBeVisible();
  await expectNoSeriousViolations(page);

  await page.goto("/adult-eligibility-appeal");
  await expect(
    page.getByRole("textbox", { name: "复核说明" }).or(
      page.getByRole("button", { name: "返回我的实名" }),
    ),
  ).toBeVisible();
  await expectNoSeriousViolations(page);
});

async function expectNoSeriousViolations(page: Page, disabledRules: readonly string[] = []) {
  const builder = new AxeBuilder({ page }).withTags(criticalRules);
  if (disabledRules.length > 0) builder.disableRules([...disabledRules]);
  const results = await builder.analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(
    serious,
    serious
      .map(
        (violation) =>
          `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => node.target.join(" ")).join("\n")}`,
      )
      .join("\n\n"),
  ).toEqual([]);
}
