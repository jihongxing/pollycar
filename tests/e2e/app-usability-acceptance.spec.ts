import { expect, test, type Locator, type Page } from "@playwright/test";
import { loginThroughPhoneVerification, openAuthenticatedPage } from "./helpers/authenticated-app";

test("首次用户可直接叫车并找到消息与账户入口", async ({ page }) => {
  await mockEmptyTripDashboard(page);
  const actions = actionCounter(page);

  await loginThroughPhoneVerification(page);
  await expect(page).toHaveURL(/\/ride-home$/);
  await expect(page.getByRole("button", { name: "你要去哪里？" })).toBeVisible();
  await expect(page.getByText("地图、位置与时间保持在同一场景中。")).toBeVisible();
  await expect(page.getByText("乘客工作台")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "消息" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "我的" })).toBeVisible();
  await actions.click(page.getByRole("tab", { name: "我的" }));

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "林屿" })).toBeVisible();
  await expect(page.getByRole("button", { name: /申请成为车主|继续申请成为车主|车主申请审核中/ })).toBeVisible();
  expect(actions.count()).toBeLessThanOrEqual(1);
});

test("乘客可完成叫车、零金额前置、匹配并确认取消", async ({ page }) => {
  await mockPassengerTripJourney(page);
  const actions = actionCounter(page);

  await openAuthenticatedPage(page, "/passenger-workbench");
  await actions.click(page.getByRole("button", { name: "你要去哪里？" }));
  await actions.click(page.getByRole("button", { name: "虹桥站 虹桥 · 合成终点", exact: true }));
  await expect(page.getByText("乘车人数（必选）")).toBeVisible();
  await expect(page.getByText("本次费用 ¥0")).toBeVisible();
  await expect(page.getByText(/真实支付保持关闭/)).toBeVisible();

  await actions.click(page.getByRole("button", { name: "确认呼叫" }));
  await expect(page).toHaveURL(/\/ride-matching$/);
  await expect(page.getByText("正在等待附近车主")).toBeVisible();
  await expect(page.getByText(/车主自主决定是否接单/)).toBeVisible();

  await actions.click(page.getByRole("button", { name: "取消本次呼叫" }));
  await expect(page).toHaveURL(/\/ride-cancellation$/);
  await expect(page.getByText("三分钟内原因和补充说明均为选填。")).toBeVisible();
  await actions.click(page.getByRole("button", { name: "确认取消行程" }));
  await page.goto("/ride-completion");
  await expect(page.getByText("行程已取消")).toBeVisible();
  expect(actions.count()).toBeLessThanOrEqual(5);
});

test("车主可切换身份并理解审核资格配额与接单边界", async ({ page }) => {
  await mockApprovedVehicle(page);
  const actions = actionCounter(page);

  await openAuthenticatedPage(page, "/identity-settings");
  await expect(page.getByText("一个账户 · 两种身份")).toBeVisible();
  await actions.click(page.getByRole("button", { name: "切换为车主身份" }));
  await expect(page).toHaveURL(/\/identity-settings$/);
  const identitySummary = page.getByLabel("当前摘要");
  await expect(identitySummary.getByText("车主身份", { exact: true })).toBeVisible();
  await expect(identitySummary.getByText("可切换", { exact: true })).toBeVisible();

  await actions.click(page.getByRole("button", { name: "返回我的账户" }));
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("button", { name: /车辆/ })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "参与资格，当前待申请，查看申请、确认和恢复路径",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "参与额度，查看滚动窗口上限和当前限制",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "申请参与资格" })).toBeVisible();
  expect(actions.count()).toBeLessThanOrEqual(4);
});

test("异常情况下保持可读并提供安全恢复路径", async ({ page, context }) => {
  await page.route("**/v1/internal-sandbox/app/synthetic-trips/dashboard", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        availableDriverTrips: [],
        productionEnabled: false,
        realPayment: false,
        shanghaiPilot: false,
      }),
    });
  });

  await openAuthenticatedPage(page, "/ride-home");
  await expect(page.getByRole("button", { name: "你要去哪里？" })).toBeVisible();
  await expect(page.getByText(/内部合成数据/)).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByRole("alert", { name: /当前处于离线状态/ })).toContainText(
    "恢复网络后会自动读取服务系统最新状态",
  );
  await context.setOffline(false);
  await expect(page.getByRole("alert", { name: /当前处于离线状态/ })).not.toBeVisible();

  await page.unroute("**/v1/internal-sandbox/app/synthetic-trips/dashboard");
  await page.route("**/v1/internal-sandbox/app/**", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "需要内部沙箱身份",
          retryable: false,
        },
      }),
    });
  });
  await page.goto("/account");
  await expect(page.getByRole("alert", { name: /内部会话已过期/ })).toContainText(
    "恢复后只读取最新状态，不自动重复提交",
  );
  await expect(page.getByRole("button", { name: "重新连接内部沙箱" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重新连接内部沙箱" })).toBeVisible();
});

function actionCounter(page: Page) {
  let primaryActions = 0;
  return {
    click: async (locator: Locator) => {
      primaryActions += 1;
      await locator.click();
    },
    count: () => primaryActions,
  };
}

async function mockApprovedVehicle(page: Page) {
  await page.route("**/v1/internal-sandbox/app/vehicle-reviews/vehicle-application-7**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        applicationId: "vehicle-application-7",
        accountId: "synthetic-account-7",
        status: "approved",
        version: 3,
        ownerIdentityAvailable: true,
        maxPassengerCount: 3,
        vehicleType: "中大型轿车 · 示例 A",
        insuranceExpiresOn: "2027-08-31",
        syntheticAttachmentId: "synthetic-insurance-a",
        requestedMaterialCodes: [],
        timeline: [],
        synthetic: true,
      }),
    });
  });
}

async function mockEmptyTripDashboard(page: Page) {
  await page.route("**/v1/internal-sandbox/app/synthetic-trips/dashboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyDashboard()),
    });
  });
}

async function mockPassengerTripJourney(page: Page) {
  let trip: ReturnType<typeof usabilityTrip> | undefined;
  await page.route(/\/v1\/internal-sandbox\/app\/synthetic-trips(?:\/.*)?(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (route.request().method() === "GET" && path.endsWith("/dashboard")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...emptyDashboard(), ...(trip ? { passengerTrip: trip } : {}) }),
      });
      return;
    }
    if (route.request().method() === "POST" && path.endsWith("/synthetic-trips")) {
      trip = usabilityTrip("pending_payment");
    } else if (route.request().method() === "POST" && path.endsWith("/payment")) {
      trip = usabilityTrip("paid_pending_match");
    } else if (
      route.request().method() === "POST" &&
      (path.endsWith("/cancel") || path.endsWith("/cancel-accepted"))
    ) {
      trip = usabilityTrip("cancelled");
    } else {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(trip),
    });
  });
}

function emptyDashboard() {
  return {
    availableDriverTrips: [],
    productionEnabled: false,
    realPayment: false,
    shanghaiPilot: false,
  } as const;
}

function usabilityTrip(state: "pending_payment" | "paid_pending_match" | "cancelled") {
  const version = state === "pending_payment" ? 1 : state === "paid_pending_match" ? 2 : 3;
  return {
    tripId: "synthetic-trip-usability",
    passengerAccountId: "synthetic-account-7",
    state,
    version,
    originLabel: "人民广场 · 合成起点",
    destinationLabel: "虹桥 · 合成终点",
    passengerCount: 1,
    payment: {
      amountMinor: 0,
      currency: "CNY",
      realPayment: false,
      state: state === "pending_payment" ? "pending_payment" : state === "paid_pending_match" ? "paid_pending_match" : "closed",
    },
    createdAt: "2026-07-12T00:00:00.000Z",
    ...(state === "cancelled"
      ? {
          cancelledAt: "2026-07-12T00:02:00.000Z",
          closureReason: "passenger_cancelled",
        }
      : {}),
    recovery: { state: "none" },
    synthetic: true,
  } as const;
}
