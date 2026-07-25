import { expect, test } from "@playwright/test";
import { loginThroughPhoneVerification, openAuthenticatedPage } from "./helpers/authenticated-app";

test("默认入口进入叫车首页并可选择三人行程", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await loginThroughPhoneVerification(page);
  await expect(page).toHaveURL(/\/ride-home$/);
  await page.getByRole("button", { name: "你要去哪里？" }).click();
  await page.getByRole("button", { name: "虹桥站 虹桥 · 合成终点", exact: true }).click();
  await expect(page.getByText("乘车人数", { exact: true })).toBeVisible();
  await expect(page.getByText("必选 · 最多 3 人", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "3 人" }).click();
  await expect(page.getByText("3 人乘车", { exact: true })).toBeVisible();
  await expect
    .poll(() => pageErrors, { message: "默认叫车流程不应产生页面运行时错误" })
    .toEqual([]);
});

test("车主首页突出自主接单、车辆容量和订单资金入口", async ({ page }) => {
  await page.route("**/v1/internal-sandbox/app/vehicle-reviews/vehicle-application-7**", async (route) => {
    return route.fulfill({
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
  await openAuthenticatedPage(page, "/owner-workbench");
  await expect(page).toHaveURL(/\/owner-workbench$/);
  await expect(page.getByText("车主工作模式")).toBeVisible();
  await expect(page.getByText("逐单自主选择")).toBeVisible();
  await expect(page.getByText("单次最多乘客")).toBeVisible();
  await expect(page.getByText("3 人")).toBeVisible();
  await expect(page.getByRole("button", { name: "开始接单" })).toBeVisible();
  await expect(page.getByRole("button", { name: "我的订单" })).toBeVisible();
  await expect(page.getByRole("button", { name: "资金中心" })).toBeVisible();
});

test("底部主导航连接身份首页和我的页面", async ({ page }) => {
  await loginThroughPhoneVerification(page);
  const mainNavigation = page.getByRole("tablist", { name: "主导航" });
  await expect(mainNavigation).toBeVisible();
  await expect(page.getByRole("tab", { name: "首页" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "我的" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "林屿" })).toBeVisible();
  await expect(page.getByText("查看行程、账户资料和常用设置。")).toBeVisible();
  await expect(page.getByText("当前使用乘客身份")).toHaveCount(0);
  await expect(page.getByLabel("当前为内部沙箱，仅使用合成数据").last()).toBeVisible();
  await page.getByRole("tab", { name: "首页" }).click();
  await expect(page).toHaveURL(/\/ride-home$/);
});

test("我的页面提供乘客任务、车主准备和跨身份通用设置入口", async ({ page }) => {
  await openAuthenticatedPage(page, "/account");

  const entries = [
    ["账户资料，管理头像和行程中的账户展示", /\/account-profile$/, "林屿"],
    ["我的行程，查看进行中、预约和历史行程", /\/ride-history$/, "我的行程"],
    ["我的实名，实名信息已确认", /\/adult-eligibility$/, "实名资料"],
    ["主题，选择明亮或暗色外观", /\/theme-settings$/, "显示方式"],
    ["通知设置，管理非紧急服务通知的显示偏好", /\/notification-settings$/, "服务通知"],
    ["隐私与安全，查看安全事项、位置使用和行程联系边界", /\/privacy-safety-settings$/, "当前没有需要处理的安全事项。"],
    ["帮助与反馈，获取行程、实名和安全帮助，或分享产品建议", /\/help-feedback$/, "常用帮助"],
    ["账户与登录，查看当前登录状态或退出账户", /\/account-login$/, "登录状态"],
  ] as const;

  for (const [accessibleName, url, heading] of entries) {
    await page.getByRole("button", { name: accessibleName }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByText(heading, { exact: true }).last()).toBeVisible();
    const returnToAccount = page.getByRole("button", { name: "返回我的账户" });
    if (await returnToAccount.count()) {
      await returnToAccount.click();
    } else {
      await page.getByRole("button", { name: "返回" }).click();
    }
    await expect(page).toHaveURL(/\/account$/);
  }

  await page.getByRole("button", { name: "主题，选择明亮或暗色外观" }).click();
  await page.getByRole("radio", { name: "暗色" }).click();
  await expect(page.getByRole("radio", { name: "暗色，当前" })).toBeVisible();
});

test("消息中心提供行程与车辆通知并保留沙箱边界", async ({ page }) => {
  let unread = true;
  const responseBody = () => ({
    accountId: "current-session-account",
    unreadCount: unread ? 2 : 0,
    items: [
      {
        itemId: "trip-message",
        category: "trip_service",
        title: "行程状态更新",
        body: "行程状态发生变化",
        target: { kind: "trip", tripId: "synthetic-notification-trip" },
        readAt: unread ? undefined : "2026-07-13T08:02:00.000Z",
        occurredAt: "2026-07-13T08:00:00.000Z",
        synthetic: true,
      },
      {
        itemId: "vehicle-message",
        category: "vehicle_review",
        title: "车辆资料",
        body: "查看车辆审核状态",
        target: { kind: "vehicle_review", applicationId: "vehicle-application-7" },
        readAt: unread ? undefined : "2026-07-13T08:02:00.000Z",
        occurredAt: "2026-07-13T08:01:00.000Z",
        synthetic: true,
      },
    ],
    realNotificationEnabled: false,
    synthetic: true,
  });
  await page.route("**/v1/internal-sandbox/app/messages/read-all", async (route) => {
    unread = false;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(responseBody()) });
  });
  await page.route("**/v1/internal-sandbox/app/messages", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(responseBody()),
    });
  });
  await page.route("**/v1/internal-sandbox/app/vehicle-reviews/vehicle-application-7**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        applicationId: "vehicle-application-7",
        accountId: "synthetic-account-7",
        status: "draft",
        version: 0,
        ownerIdentityAvailable: false,
        requestedMaterialCodes: [],
        timeline: [],
        synthetic: true,
      }),
    });
  });
  await page.route("**/v1/internal-sandbox/app/free-flex-trial", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        eligibilityId: "free-flex-synthetic-account-7",
        accountId: "synthetic-account-7",
        batchId: "batch_0",
        state: "invited",
        version: 0,
        qualificationFeeMinor: 0,
        paidPathEnabled: false,
        realInvitation: false,
        activationDaysInLookback: 0,
        maximumActivationDays: 60,
        quota: { hours24: 4, days7: 12, days30: 18 },
        synthetic: true,
      }),
    });
  });
  await page.route("**/v1/internal-sandbox/app/synthetic-trips/dashboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        passengerTrip: {
          tripId: "synthetic-notification-trip",
          passengerAccountId: "synthetic-account-7",
          state: "pending_payment",
          version: 1,
          originLabel: "人民广场 · 合成起点",
          destinationLabel: "虹桥 · 合成终点",
          passengerCount: 1,
          payment: { amountMinor: 0, currency: "CNY", realPayment: false, state: "pending_payment" },
          createdAt: "2026-07-12T00:00:00.000Z",
          recovery: { state: "none" },
          synthetic: true,
        },
        availableDriverTrips: [],
        productionEnabled: false,
        realPayment: false,
        shanghaiPilot: false,
      }),
    });
  });

  await page.route("**/v1/internal-sandbox/app/messages/*/read", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(responseBody()),
    });
  });
  await page.route(
    "**/v1/internal-sandbox/app/synthetic-trips/synthetic-notification-trip/chat",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          conversationId: "trip-chat-synthetic-notification-trip",
          tripId: "synthetic-notification-trip",
          state: "scheduled",
          participants: [],
          messages: [],
          quickReplies: [],
          retention: {
            evidenceHold: false,
            deletionState: "blocked_by_window",
            summaryRetained: true,
          },
          realChatEnabled: false,
          externalChatProviderEnabled: false,
          synthetic: true,
        }),
      });
    },
  );
  await openAuthenticatedPage(page, "/message-center");
  await expect(page).toHaveURL(/\/message-center$/);
  await expect(page.getByText("消息", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("行程状态更新")).toBeVisible();
  await expect(page.getByRole("button", { name: /车辆资料/ })).toBeVisible();
  await expect(page.getByText("通知", { exact: true })).toBeVisible();
  await expect(page.getByLabel("当前为内部沙箱，仅使用合成数据")).toBeVisible();
});

test("申请和审核流程不显示底部主导航", async ({ page }) => {
  await openAuthenticatedPage(page, "/owner-apply-intro");
  await expect(page.getByRole("tablist", { name: "主导航" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "开始准备" })).toBeVisible();
});

test("身份切换面板保持单 App 双身份语义", async ({ page }) => {
  await loginThroughPhoneVerification(page);

  await page.getByRole("button", { name: "打开账户与身份设置" }).click();

  await expect(page.getByText("切换身份")).toBeVisible();
  await expect(page.getByRole("button", { name: "乘客身份，当前使用" })).toBeVisible();
  await expect(page.getByRole("button", { name: "车主身份，需要完成车辆审核" })).toBeVisible();
  await expect(page.getByText(/账户 ·/)).toBeVisible();
});

test("车主申请流程使用真实 URL 和浏览器返回", async ({ page }) => {
  await openAuthenticatedPage(page, "/owner-apply-intro");
  await expect(page).toHaveURL(/\/owner-apply-intro$/);
  await page.getByRole("button", { name: "开始准备" }).click();
  await expect(page).toHaveURL(/\/owner-profile$/);
  await page.getByRole("button", { name: "我已了解，继续添加车辆" }).click();
  await expect(page).toHaveURL(/\/vehicle-form$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/owner-profile$/);
});
