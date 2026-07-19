import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { loginThroughPhoneVerification, openAuthenticatedPage } from "./helpers/authenticated-app";

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
  await page.getByRole("button", { name: "我已了解，继续添加车辆" }).click();

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
  await expect(page.getByRole("heading", { name: /需要留意|服务状态已是最新/ })).toBeVisible();
  await expectNoSeriousViolations(page);

  await page.goto("/notification-settings");
  await expect(page.getByRole("switch", { name: "行程进展" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "安全与重要状态" })).toBeDisabled();
  await expectNoSeriousViolations(page);

  await page.goto("/help-feedback");
  await expect(page.getByRole("textbox", { name: "反馈说明" })).toBeVisible();
  await expect(page.getByRole("button", { name: "分享反馈" })).toBeDisabled();
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
