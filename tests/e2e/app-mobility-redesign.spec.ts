import AxeBuilder from "@axe-core/playwright";
import { loginThroughPhoneVerification, openAuthenticatedPage } from "./helpers/authenticated-app";
import { expect, test } from "@playwright/test";

import { mockMobilityDashboard, syntheticTrip } from "./helpers/mobility-fixtures";

test("默认入口直接进入叫车首页且不暴露乘客身份", async ({ page }) => {
  await mockMobilityDashboard(page);
  await loginThroughPhoneVerification(page);

  await expect(page).toHaveURL(/\/ride-home$/);
  await expect(page.getByRole("button", { name: "你要去哪里？" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "首页" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "消息" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "我的" })).toBeVisible();
  await expect(page.getByText("乘客工作台")).toHaveCount(0);
  await expect(page.getByText("乘客身份")).toHaveCount(0);
});

test("叫车流程支持目的地搜索、默认一人和一至三人选择", async ({ page }) => {
  await mockMobilityDashboard(page);
  await openAuthenticatedPage(page, "/ride-home");

  await page.getByRole("button", { name: "你要去哪里？" }).click();
  await expect(page).toHaveURL(/\/ride-search$/);
  await page.getByRole("textbox", { name: "搜索目的地" }).fill("虹桥");
  await expect(page.getByRole("button", { name: "虹桥站 虹桥 · 合成终点", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "虹桥站 虹桥 · 合成终点", exact: true }).click();

  await expect(page).toHaveURL(/\/ride-confirmation$/);
  await expect(page.getByText("乘车人数", { exact: true })).toBeVisible();
  await expect(page.getByText("必选 · 最多 3 人", { exact: true })).toBeVisible();
  for (const count of [1, 2, 3]) {
    await expect(page.getByRole("radio", { name: `${count} 人` })).toBeVisible();
  }
  await expect(page.getByText("1 人乘车", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "3 人" }).click();
  await expect(page.getByText("3 人乘车", { exact: true })).toBeVisible();
  await expect(page.getByText("乘车场景", { exact: true })).toBeVisible();
  await expect(page.getByText("可选", { exact: true })).toBeVisible();
  await expect(page.getByText("本次费用 ¥0")).toBeVisible();
});

test("车主可识别乘车人且接单页明确逐单自主决定", async ({ page }) => {
  const accepted = syntheticTrip("accepted");
  await mockMobilityDashboard(page, {
    availableDriverTrips: [syntheticTrip("paid_pending_match")],
    activeDriverTrip: accepted,
  });
  await openAuthenticatedPage(page, "/driver-pickup");

  await expect(page.getByText("林女士")).toBeVisible();
  await expect(page.getByLabel(/林女士的(默认)?头像/)).toBeVisible();
  await expect(page.getByText("♀")).toBeVisible();
  await expect(page.getByText("2 人")).toBeVisible();

  await page.goto("/driver-orders");
  await expect(page.getByText("接单中", { exact: true })).toBeVisible();
  await expect(page.getByText("附近订单", { exact: true })).toBeVisible();
  await expect(page.getByText("逐单查看路线、人数和时间，再决定是否接受。")).toBeVisible();
});

test("车主订单历史可筛选并打开产品化详情，无订单直达使用专属空态", async ({ page }) => {
  const completed = syntheticTrip("completed", "synthetic-trip-history");
  const cancelled = {
    ...syntheticTrip("cancelled", "synthetic-trip-history-cancelled"),
    originLabel: "静安寺",
    destinationLabel: "浦东机场",
  };
  await mockMobilityDashboard(page, {
    reservedDriverTrips: [completed, cancelled],
  });
  await openAuthenticatedPage(page, "/driver-history");

  await expect(page.getByRole("button", { name: "查看订单，人民广场到上海虹桥站" })).toBeVisible();
  await page.getByRole("tab", { name: "已完成" }).click();
  await expect(page.getByText("已完成", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "查看订单，人民广场到上海虹桥站" }).click();

  await expect(page).toHaveURL(/\/driver-order-detail$/);
  await expect(page.getByText("人民广场 → 上海虹桥站", { exact: true })).toBeVisible();
  await expect(page.getByText("费用信息仅供核对")).toBeVisible();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await expect(page).toHaveURL(/\/driver-history$/);
  await expect(
    page.getByRole("button", { name: "查看订单，静安寺到浦东机场" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "查看订单，人民广场到上海虹桥站" })
    .click();

  await mockMobilityDashboard(page);
  await page.reload();
  await expect(page.getByText("暂时无法查看订单")).toBeVisible();
  await expect(page.getByText("冻结决定已维持")).toHaveCount(0);
});

test("乘客行程列表覆盖完整记录并从详情返回列表", async ({ page }) => {
  const current = syntheticTrip("accepted", "passenger-trip-current");
  const completed = syntheticTrip(
    "completed",
    "passenger-trip-completed",
    2,
    Date.now() - 24 * 60 * 60 * 1000,
  );
  const cancelled = syntheticTrip(
    "cancelled",
    "passenger-trip-cancelled",
    1,
    Date.now() - 48 * 60 * 60 * 1000,
  );
  await mockMobilityDashboard(page, {
    passengerTrip: current,
    passengerTrips: [current, completed, cancelled],
  });
  await openAuthenticatedPage(page, "/ride-history");

  await expect(
    page.getByRole("button", { name: /查看行程，人民广场到上海虹桥站，车主正在前往/ }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "已完成" }).click();
  await page.getByRole("button", { name: /查看行程，人民广场到上海虹桥站，行程已完成/ }).click();

  await expect(page).toHaveURL(/\/ride-detail$/);
  await expect(page.getByRole("button", { name: "再次叫车" })).toBeVisible();
  await page.getByRole("button", { name: "返回我的行程" }).click();
  await expect(page).toHaveURL(/\/ride-history$/);
  await expect(page.getByRole("heading", { name: "我的行程" }).last()).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /查看行程，人民广场到上海虹桥站，车主正在前往/,
    }),
  ).toHaveCount(0);
});

test("接单后乘车人可识别车主车辆并在三分钟内无理由取消", async ({ page }) => {
  const accepted = syntheticTrip("accepted");
  await mockMobilityDashboard(page, { passengerTrip: accepted });
  await openAuthenticatedPage(page, "/ride-pickup");

  await expect(page.getByText("陈先生")).toBeVisible();
  await expect(page.getByLabel(/陈先生头像/).first()).toBeVisible();
  await expect(page.getByText("男", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("陈先生，深空灰比亚迪 汉 EV，车牌沪A·S1234，约 4 分钟"),
  ).toBeVisible();
  await expect(page.getByText("深空灰 · 比亚迪 汉 EV")).toBeVisible();
  await expect(page.getByText("沪A·S1234")).toBeVisible();
  await expect(page.getByText("请先核对车辆和车牌，再向车主确认。")).toBeVisible();
  for (const forbiddenCopy of [
    "强制公开性别",
    "性别来自身份证",
    "隐藏性别",
    "自愿公开",
    "未公开性别",
  ]) {
    await expect(page.getByText(forbiddenCopy, { exact: false })).toHaveCount(0);
  }
  await expect(page.getByText(/主动取消剩余/)).toBeVisible();
  await expect(page.getByRole("button", { name: "取消行程" })).toBeVisible();

  await page.getByRole("button", { name: "取消行程" }).click();
  await expect(page).toHaveURL(/\/ride-cancellation$/);
  await expect(page.getByText("三分钟内原因和补充说明均为选填。")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "取消补充说明" })).toHaveValue("");
  await expect(page.getByRole("button", { name: "确认取消行程" })).toBeEnabled();
  await expect(page.getByText("本次费用 ¥0", { exact: true })).toBeVisible();
  await expect(page.getByText("三分钟内可主动取消，确认后不会产生扣款。")).toBeVisible();
});

test("车主到达目的地必须使用滑动确认并提供无障碍替代操作", async ({ page }) => {
  const inProgress = syntheticTrip("in_progress");
  await mockMobilityDashboard(page, { activeDriverTrip: inProgress });
  await openAuthenticatedPage(page, "/driver-active");

  await expect(page.getByText("向右滑动确认到达")).toBeVisible();
  await expect(page.getByRole("button", { name: "确认已到达目的地" })).toBeVisible();
  await expect(page.getByRole("button", { name: "到达目的地", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "无法滑动，点按确认已到达" }).click();
  await expect(page.getByText("已确认到达")).toBeVisible();
});

test("消息是一级入口且资金、绑卡和提现保持真实能力关闭", async ({ page }) => {
  await mockMobilityDashboard(page);
  await openAuthenticatedPage(page, "/driver-wallet");
  await expect(page.getByText("资金服务暂不可用")).toBeVisible();
  await expect(page.getByText("当前不会产生真实收入，也无法结算、绑卡或提现。")).toBeVisible();
  await expect(page.getByRole("button", { name: "提现" })).toBeDisabled();

  await page.goto("/driver-bank-card");
  await expect(page.getByText("暂不支持绑定银行卡")).toBeVisible();
  await expect(page.getByText(/当前提交不会绑定银行卡/)).toBeVisible();
  await page.goto("/driver-withdraw");
  await expect(page.getByText("暂不支持提现")).toBeVisible();

  await page.goto("/message-center");
  await expect(page).toHaveURL(/\/message-center$/);
  await expect(page.getByText("消息", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "消息" })).toBeVisible();
});

test("大字体移动视口下核心首页无横向溢出且无严重可访问性问题", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("pollycar.qa.font-scale", "2"));
  await mockMobilityDashboard(page);
  await openAuthenticatedPage(page, "/ride-home");

  await expect(page.getByRole("button", { name: "你要去哪里？" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    ),
  ).toEqual([]);
});

