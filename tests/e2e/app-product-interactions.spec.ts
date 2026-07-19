import { expect, test } from "@playwright/test";
import { openAuthenticatedPage } from "./helpers/authenticated-app";
import type { Page } from "@playwright/test";
import {
  mockMobilityDashboard,
  syntheticTrip,
} from "./helpers/mobility-fixtures";

test("我的页面默认乘客态只提供乘客服务和车主申请入口", async ({ page }) => {
  await mockAccountReview(page, accountReview("draft", 0));
  await openAuthenticatedPage(page, "/account");

  await expect(page.getByText("查看行程、账户资料和常用设置。")).toBeVisible();
  await expect(page.getByRole("button", { name: "我的行程，查看进行中、预约和历史行程" })).toBeVisible();
  await expect(page.getByRole("button", { name: "申请成为车主" })).toBeVisible();
  await expect(page.getByText("当前使用乘客身份")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /身份切换/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /我的车辆|我的订单|资金中心/ })).toHaveCount(0);
});

test("我的页面在车主申请已开始时提供继续申请入口", async ({ page }) => {
  await mockAccountReview(page, accountReview("draft", 1, {
    vehicleType: "中大型轿车 · 示例 A",
    insuranceExpiresOn: "2027-08-31",
    syntheticAttachmentId: "synthetic-insurance-a",
  }));
  await openAuthenticatedPage(page, "/account");

  await expect(page.getByRole("button", { name: /继续申请成为车主/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "申请成为车主", exact: true })).toHaveCount(0);
});

test("我的页面在车主审核中显示进度入口", async ({ page }) => {
  await mockAccountReview(page, accountReview("under_review", 2, {
    vehicleType: "中大型轿车 · 示例 A",
    insuranceExpiresOn: "2027-08-31",
    syntheticAttachmentId: "synthetic-insurance-a",
  }));
  await openAuthenticatedPage(page, "/account");

  const reviewProgress = page.getByRole("button", { name: /车主申请审核中/ });
  await expect(reviewProgress).toContainText("审核中");
  await reviewProgress.click();
  await expect(page).toHaveURL(/\/review-pending$/);
});

test("我的页面审核通过后才允许切换并展示车主服务", async ({ page }) => {
  await mockAccountReview(page, accountReview("approved", 3, {
    ownerIdentityAvailable: true,
    maxPassengerCount: 3,
    vehicleType: "中大型轿车 · 示例 A",
    insuranceExpiresOn: "2027-08-31",
    syntheticAttachmentId: "synthetic-insurance-a",
  }));
  await mockAccountIdentitySwitch(page);
  await openAuthenticatedPage(page, "/account");

  await expect(page.getByRole("button", { name: "车主身份已通过，切换为车主" })).toBeVisible();
  await page.getByRole("button", { name: "车主身份已通过，切换为车主" }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText("我的 · 车主身份")).toBeVisible();
  await expect(page.getByText("管理订单、车辆、参与资格和资金记录。")).toBeVisible();
  await expect(page.getByRole("button", { name: /我的订单/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /我的车辆/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /参与资格/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /参与额度/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /资金中心/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /我的行程/ })).toHaveCount(0);
});

test("车主身份必须切回乘客后才能查看我的行程", async ({ page }) => {
  await mockAccountReview(page, accountReview("approved", 3, {
    ownerIdentityAvailable: true,
    maxPassengerCount: 3,
    vehicleType: "中大型轿车 · 示例 A",
    insuranceExpiresOn: "2027-08-31",
    syntheticAttachmentId: "synthetic-insurance-a",
  }));
  await mockAccountIdentitySwitch(page);
  await openAuthenticatedPage(page, "/account");
  await page.getByRole("button", { name: "车主身份已通过，切换为车主" }).click();

  await expect(page.getByRole("button", { name: /我的行程/ })).toHaveCount(0);
  await page.getByRole("button", { name: "车主身份，切换为乘客" }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText("查看行程、账户资料和常用设置。")).toBeVisible();
  await expect(page.getByRole("button", { name: "我的行程，查看进行中、预约和历史行程" })).toBeVisible();
  await expect(page.getByRole("button", { name: "车主身份已通过，切换为车主" })).toBeVisible();
});

test("身份切换清理旅程上下文并阻止跨身份深链", async ({ page }) => {
  const completedTrip = syntheticTrip(
    "completed",
    "journey-continuity-passenger-trip",
  );
  await mockMobilityDashboard(page, {
    passengerTrips: [completedTrip],
    reservedDriverTrips: [completedTrip],
  });
  await mockAccountReview(page, accountReview("approved", 3));
  await mockAccountIdentitySwitch(page);
  await openAuthenticatedPage(page, "/ride-history");

  await page.getByRole("tab", { name: "已完成" }).click();
  await page
    .getByRole("button", {
      name: /查看行程，人民广场到上海虹桥站，行程已完成/,
    })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        sessionStorage.getItem("rego.journey.passenger-trip-id"),
      ),
    )
    .toBe(completedTrip.tripId);

  await page.goto("/account");
  await page
    .getByRole("button", { name: "车主身份已通过，切换为车主" })
    .click();
  await expect(page).toHaveURL(/\/account$/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        sessionStorage.getItem("rego.journey.passenger-trip-id"),
      ),
    )
    .toBeNull();

  await page.goto("/ride-history");
  await expect(page).toHaveURL(/\/driver-home$/);

  await page.goto("/account");
  await page
    .getByRole("button", { name: "车主身份，切换为乘客" })
    .click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto("/driver-history");
  await expect(page).toHaveURL(/\/ride-home$/);
});

test("车辆提交需要确认并防止重复提交", async ({ page }) => {
  let reviewVersion = 0;
  await page.route("**/v1/internal-sandbox/app/vehicle-reviews/vehicle-application-7**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "POST" && url.pathname.endsWith("/draft")) {
      reviewVersion = 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(review("draft", reviewVersion)) });
    }
    if (route.request().method() === "POST" && url.pathname.endsWith("/submit")) {
      reviewVersion = 2;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(review("under_review", reviewVersion)) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(review("draft", reviewVersion)) });
  });
  await openAuthenticatedPage(page, "/owner-apply-intro");
  await page.getByRole("button", { name: "开始准备" }).click();
  await page.getByRole("button", { name: "我已了解，继续添加车辆" }).click();
  await page.getByRole("textbox", { name: "保险有效期" }).fill("2027-08-31");
  await page.getByRole("textbox", { name: "保险有效期" }).blur();
  await page.goto("/submission-review");
  const submitTrigger = page.getByRole("button", { name: "提交车辆审核" });
  await submitTrigger.click();

  await expect(page.getByText("确认提交车辆审核？")).toBeVisible();
  const dialog = page.getByRole("dialog", { name: "确认提交车辆审核？" });
  const confirm = dialog.getByRole("button", { name: "确认提交" });
  const back = dialog.getByRole("button", { name: "返回", exact: true });
  await expect(back).toBeFocused();
  await expect(
    page
      .locator('[data-testid="app-shell-root"][inert]')
      .evaluateAll(
        (elements) =>
          elements.length > 0 && elements.every((element) => (element as HTMLElement).inert),
      ),
  ).resolves.toBe(true);
  await page.keyboard.press("Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByText("确认提交车辆审核？")).toHaveCount(0);
  await expect(submitTrigger).toBeFocused();
  await submitTrigger.click();
  const submitRequest = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith("/submit"),
  );
  await confirm.click();
  await submitRequest;
});

test("取消行程可返回且确认后显示成功反馈", async ({ page }) => {
  let tripState: "pending_payment" | "cancelled" = "pending_payment";
  await page.route(/\/v1\/internal-sandbox\/app\/synthetic-trips\/dashboard$/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        passengerTrip: trip(tripState),
        availableDriverTrips: [],
        productionEnabled: false,
        realPayment: false,
        shanghaiPilot: false,
      }),
    });
  });
  await page.route("**/v1/internal-sandbox/app/synthetic-trips/*/cancel", async (route) => {
    expect(route.request().method()).toBe("POST");
    tripState = "cancelled";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(trip(tripState)),
    });
  });
  await openAuthenticatedPage(page, "/ride-cancellation");
  await expect(page.getByText("要取消这次行程吗？")).toBeVisible();
  await expect(page.getByText("三分钟内原因和补充说明均为选填。")).toBeVisible();
  await page.getByRole("button", { name: "继续等待响应" }).click();
  await expect(page).toHaveURL(/\/ride-matching$/);
  await page.goto("/ride-cancellation");
  const cancellationRequest = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith("/cancel"),
  );
  await page.getByRole("button", { name: "确认取消行程" }).click();
  await cancellationRequest;
  await page.goto("/ride-completion");
  await expect(page.getByText("行程已取消")).toBeVisible();
  await expect(page.getByText("本次不会产生扣款。")).toBeVisible();
});

test("超过三分钟取消必须选择原因并展示车主责任处置", async ({ page }) => {
  let tripState: "accepted" | "cancelled" = "accepted";
  await page.route(/\/v1\/internal-sandbox\/app\/synthetic-trips\/dashboard$/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        passengerTrip: acceptedTrip(tripState),
        availableDriverTrips: [],
        productionEnabled: false,
        realPayment: false,
        shanghaiPilot: false,
      }),
    });
  });
  await page.route("**/v1/internal-sandbox/app/synthetic-trips/*/cancellation-eligibility", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        eligible: true,
        policy: "accepted_cancellation_responsibility",
        mode: "responsibility_assessment",
        acceptedAt: "2026-07-11T00:00:00.000Z",
        deadlineAt: "2026-07-11T00:03:00.000Z",
        serverTime: "2026-07-11T00:03:01.000Z",
        reasonRequired: true,
        noteRequired: false,
        realFeeAmountMinor: 0,
        currency: "CNY",
        determinedByServer: true,
        goodwill: {
          actor: "passenger",
          eligible: true,
          reasonRequired: true,
          usage: { hours24: 0, days7: 0, days30: 1 },
          limits: { hours24: 1, days7: 1, days30: 2 },
          serverTime: "2026-07-11T00:03:01.000Z",
          determinedByServer: true,
          productionEnabled: false,
        },
      }),
    });
  });
  await page.route("**/v1/internal-sandbox/app/synthetic-trips/*/cancel", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      reason: "driver_or_vehicle_concern",
    });
    tripState = "cancelled";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(acceptedTrip(tripState)),
    });
  });

  await openAuthenticatedPage(page, "/ride-cancellation");
  await expect(
    page.getByText("已超过三分钟，请选择最符合当前情况的原因。"),
  ).toBeVisible();
  await expect(page.getByText("0/1").first()).toBeVisible();
  await expect(page.getByText("1/2")).toBeVisible();
  await expect(page.getByRole("button", { name: "确认取消行程" })).toBeDisabled();
  await page.getByRole("radio", { name: "车辆信息不符" }).click();
  await page.getByRole("button", { name: "确认取消行程" }).click();
  await expect(page).toHaveURL(/\/ride-completion$/);
  await expect(page.getByText("车主责任")).toBeVisible();
  await expect(page.getByText("优先重新匹配")).toBeVisible();
  await expect(page.getByText("¥0.00").first()).toBeVisible();
});

test("车主到达前可查看 1/2/3 善意取消额度并主动取消", async ({ page }) => {
  let tripState: "accepted" | "cancelled" = "accepted";
  await page.route(/\/v1\/internal-sandbox\/app\/synthetic-trips\/dashboard$/, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        activeDriverTrip: acceptedTrip(tripState),
        availableDriverTrips: [],
        productionEnabled: false,
        realPayment: false,
        shanghaiPilot: false,
      }),
    });
  });
  await page.route("**/v1/internal-sandbox/app/synthetic-trips/*/cancellation-eligibility", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        eligible: true,
        policy: "accepted_cancellation_responsibility",
        mode: "responsibility_assessment",
        acceptedAt: "2026-07-11T00:00:00.000Z",
        deadlineAt: "2026-07-11T00:03:00.000Z",
        serverTime: "2026-07-11T00:01:00.000Z",
        reasonRequired: true,
        noteRequired: false,
        realFeeAmountMinor: 0,
        currency: "CNY",
        determinedByServer: true,
        goodwill: {
          actor: "driver",
          eligible: true,
          reasonRequired: true,
          usage: { hours24: 0, days7: 1, days30: 2 },
          limits: { hours24: 1, days7: 2, days30: 3 },
          serverTime: "2026-07-11T00:01:00.000Z",
          determinedByServer: true,
          productionEnabled: false,
        },
      }),
    });
  });
  await page.route("**/v1/internal-sandbox/app/synthetic-trips/*/cancel", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ reason: "plans_changed" });
    tripState = "cancelled";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...acceptedTrip(tripState),
        closureReason: "driver_cancelled",
      }),
    });
  });

  await openAuthenticatedPage(page, "/driver-trip");
  await expect(page.getByText("善意取消额度")).toBeVisible();
  await expect(page.getByText("1/2")).toBeVisible();
  await expect(page.getByText("2/3")).toBeVisible();
  await page.getByRole("button", { name: "因临时情况取消" }).click();
  await expect(page.getByText("确认取消本次接驾？")).toBeVisible();
  await page.getByRole("button", { name: "确认取消" }).click();
  await expect(page).toHaveURL(/\/driver-home$/);
});

test("审核页面支持直接深链和刷新恢复", async ({ page }) => {
  await page.route("**/v1/internal-sandbox/app/vehicle-reviews/vehicle-application-7**", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(review("under_review", 2)),
    });
  });
  await openAuthenticatedPage(page, "/review-pending");
  await expect(page.getByText("资料正在审核")).toBeVisible();
  await expect(page.getByText("当前无需重复提交。你可以离开页面，状态变化后再继续处理。")).toBeVisible();
  await expect(page).toHaveURL(/\/review-pending$/);
  await page.reload();
  await expect(page.getByText("资料正在审核")).toBeVisible();
});

test("车辆草稿刷新后恢复且浏览器返回保留输入", async ({ page }) => {
  let persistedVehicleType = "中大型轿车 · 示例 A";
  let persistedInsuranceDate = "2027-08-31";
  let persistedVersion = 0;
  await page.addInitScript(() => {
    if (sessionStorage.getItem("vehicle-draft-test-initialized")) return;
    localStorage.removeItem("pollycar.vehicle-form.draft");
    sessionStorage.setItem("vehicle-draft-test-initialized", "true");
  });
  await page.route("**/v1/internal-sandbox/app/vehicle-reviews/vehicle-application-7**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "POST" && url.pathname.endsWith("/draft")) {
      const payload = route.request().postDataJSON() as {
        vehicleType: string;
        insuranceExpiresOn: string;
      };
      persistedVehicleType = payload.vehicleType;
      persistedInsuranceDate = payload.insuranceExpiresOn;
      persistedVersion += 1;
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...review("draft", persistedVersion),
        vehicleType: persistedVehicleType,
        insuranceExpiresOn: persistedInsuranceDate,
      }),
    });
  });
  await openAuthenticatedPage(page, "/vehicle-form");
  await page.getByRole("textbox", { name: "车辆类型" }).fill("示例 SUV");
  await page.getByRole("textbox", { name: "保险有效期" }).fill("2028-01-31");
  await expect(page.getByText(/已自动保存/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "车辆类型" })).toHaveValue("示例 SUV");
  await expect(page.getByRole("textbox", { name: "保险有效期" })).toHaveValue("2028-01-31");
  await page.reload();
  await expect(page).toHaveURL(/\/vehicle-form$/);
  await expect(page.getByRole("textbox", { name: "车辆类型" })).toHaveValue("示例 SUV");
});

test("车辆表单实时校验、格式化并保护未同步修改", async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("pollycar.vehicle-form.draft"));
  await openAuthenticatedPage(page, "/owner-profile");
  await page.getByRole("button", { name: "我已了解，继续添加车辆" }).click();
  const vehicleType = page.getByRole("textbox", { name: "车辆类型" });
  const insuranceDate = page.getByRole("textbox", { name: "保险有效期" });

  await vehicleType.fill("A");
  await expect(page.getByText("车辆类型至少需要 2 个字符。")).toBeVisible();
  await expect(page.getByRole("button", { name: "保存并继续" })).toBeDisabled();

  await vehicleType.fill("  示例   SUV  ");
  await insuranceDate.fill("2035-01-01");
  await expect(page.getByText("保险有效期不能超过未来 5 年。")).toBeVisible();
  await insuranceDate.fill("2028-01-31");
  await vehicleType.blur();
  await expect(vehicleType).toHaveValue("示例 SUV");
  await expect(page.getByRole("button", { name: "保存并继续" })).toBeEnabled();

  await page.goBack();
  await expect(page.getByText("离开车辆资料编辑？")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "返回" }).click();
  await expect(page).toHaveURL(/\/vehicle-form$/);
  await page.goBack();
  await page.getByRole("button", { name: "确认离开" }).click();
  await expect(page).toHaveURL(/\/owner-profile$/);
});

test("车辆草稿同步失败后保留输入和本地恢复能力", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("vehicle-recovery-test-initialized")) return;
    localStorage.clear();
    sessionStorage.setItem("vehicle-recovery-test-initialized", "true");
  });
  await page.route("**/v1/internal-sandbox/app/vehicle-reviews/vehicle-application-7/draft", async (route) => {
    return route.fulfill({ status: 503, contentType: "application/json", body: "" });
  });
  await openAuthenticatedPage(page, "/vehicle-form");
  await page.getByRole("textbox", { name: "车辆类型" }).fill("示例恢复车辆");
  await page.getByRole("tab", { name: "3 人" }).click();
  await page.getByRole("textbox", { name: "保险有效期" }).fill("2028-01-31");
  await page.getByRole("button", { name: "保存并继续" }).click();
  await expect(page.getByText("服务暂不可用")).toBeVisible();
  await expect(page).toHaveURL(/\/vehicle-form$/);
  await expect(page.getByRole("textbox", { name: "车辆类型" })).toHaveValue("示例恢复车辆");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "车辆类型" })).toHaveValue("示例恢复车辆");
});

test("App 重启后恢复身份和主题偏好", async ({ page }) => {
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
  await page.route("**/v1/internal-sandbox/app/sessions/current/identity", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: "session-preference-e2e",
        accountId: "synthetic-account-7",
        activeIdentity: "driver",
        availableIdentities: ["passenger", "driver"],
        adultEligibilityState: "verified",
        businessAccessAllowed: true,
        issuedAt: "2026-07-17T01:00:00.000Z",
        expiresAt: "2026-07-17T02:00:00.000Z",
        state: "active",
        productionEnabled: false,
        synthetic: true,
      }),
    });
  });

  await openAuthenticatedPage(page, "/identity-settings");
  await page.getByRole("button", { name: "切换为车主身份" }).click();
  await expect(page).toHaveURL(/\/owner-workbench$/);
  await page.goto("/theme-settings");
  await page.getByRole("button", { name: "暗色外观，切换" }).click();

  await expect.poll(() => page.evaluate(() => localStorage.getItem("pollycar.preference.identity"))).toBe("owner");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pollycar.preference.theme"))).toBe("dark");
  await page.addInitScript(() => {
    Object.assign(window, {
      __pollycarRestoredPreferences: {
        identity: localStorage.getItem("pollycar.preference.identity"),
        theme: localStorage.getItem("pollycar.preference.theme"),
      },
    });
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & {
      __pollycarRestoredPreferences?: { identity: string | null; theme: string | null };
    }
  ).__pollycarRestoredPreferences)).toEqual({ identity: "owner", theme: "dark" });
});

test("通知设置保存在当前设备且安全提醒不可关闭", async ({ page }) => {
  await openAuthenticatedPage(page, "/notification-settings");

  const tripUpdates = page.getByRole("switch", { name: "行程进展" });
  const ownerUpdates = page.getByRole("switch", { name: "车主准备进展" });
  const safetyUpdates = page.getByRole("switch", { name: "安全与重要状态" });

  await expect(tripUpdates).toHaveAttribute("aria-checked", "true");
  await expect(ownerUpdates).toHaveAttribute("aria-checked", "true");
  await expect(safetyUpdates).toHaveAttribute("aria-checked", "true");
  await expect(safetyUpdates).toBeDisabled();

  await tripUpdates.click();
  await expect(tripUpdates).toHaveAttribute("aria-checked", "false");
  await page.reload();
  await expect(page.getByRole("switch", { name: "行程进展" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
});

test("离线提示在网络恢复后自动消失并同步", async ({ page, context }) => {
  await openAuthenticatedPage(page, "/account");
  await context.setOffline(true);
  await expect(page.getByRole("alert", { name: /当前处于离线状态/ })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByRole("alert", { name: /当前处于离线状态/ })).not.toBeVisible();
  await expect(page.getByRole("tab", { name: "我的" })).toHaveAttribute("aria-selected", "true");
});

test("内部会话过期时提供只读重连入口", async ({ page, context }) => {
  await openAuthenticatedPage(page, "/account");
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
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByRole("alert", { name: /当前处于离线状态/ })).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("alert", { name: /内部会话已过期/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "重新连接内部沙箱" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重新连接内部沙箱" })).toBeVisible();
});

test("慢网下保持页面可读并最终同步最新状态", async ({ page }) => {
  await page.route("**/v1/internal-sandbox/app/synthetic-trips/dashboard", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
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

  await openAuthenticatedPage(page, "/passenger-workbench");
  await expect(page.getByRole("button", { name: "你要去哪里？" })).toBeVisible();
  await expect(page.getByText("快捷地点")).toBeVisible();
  await expect(page.getByText("地图、位置与时间保持在同一场景中。")).toBeVisible();
  await expect(page.getByRole("tab", { name: "消息" })).toBeVisible({ timeout: 5_000 });
});

type AccountReviewStatus =
  | "draft"
  | "under_review"
  | "needs_material"
  | "approved"
  | "suspended"
  | "appealing"
  | "revoked"
  | "expired";

type AccountReviewFixture = ReturnType<typeof accountReview>;

function accountReview(
  status: AccountReviewStatus,
  version: number,
  overrides: Partial<{
    ownerIdentityAvailable: boolean;
    maxPassengerCount: 1 | 2 | 3;
    vehicleType: string;
    insuranceExpiresOn: string;
    syntheticAttachmentId: string;
  }> = {},
) {
  return {
    applicationId: "vehicle-application-7",
    accountId: "synthetic-account-7",
    status,
    version,
    ownerIdentityAvailable: status === "approved",
    maxPassengerCount: 1 as const,
    requestedMaterialCodes: [],
    timeline: [],
    synthetic: true as const,
    ...overrides,
  };
}

async function mockAccountReview(page: Page, fixture: AccountReviewFixture) {
  await page.route("**/v1/internal-sandbox/app/vehicle-reviews/vehicle-application-7", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixture),
    });
  });
}

async function mockAccountIdentitySwitch(page: Page) {
  let activeIdentity: "passenger" | "driver" = "passenger";
  await page.route("**/v1/internal-sandbox/app/sessions/current/identity", async (route) => {
    const body = route.request().postDataJSON() as { activeIdentity: "passenger" | "driver" };
    activeIdentity = body.activeIdentity;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: "session-account-identity-e2e",
        accountId: "synthetic-account-7",
        activeIdentity: body.activeIdentity,
        availableIdentities: ["passenger", "driver"],
        adultEligibilityState: "verified",
        businessAccessAllowed: true,
        issuedAt: "2026-07-18T01:00:00.000Z",
        expiresAt: "2026-07-18T02:00:00.000Z",
        state: "active",
        productionEnabled: false,
        synthetic: true,
      }),
    });
  });
  await page.route("**/v1/auth/session/refresh", async (route) => {
    const response = await route.fetch();
    const payload = (await response.json()) as {
      session: {
        activeIdentity: "passenger" | "driver";
        availableIdentities: readonly ("passenger" | "driver")[];
      };
    };
    await route.fulfill({
      response,
      json: {
        ...payload,
        session: {
          ...payload.session,
          activeIdentity,
          availableIdentities: ["passenger", "driver"],
        },
      },
    });
  });
}

function review(status: "draft" | "under_review", version: number) {
  return {
    applicationId: "vehicle-application-7",
    accountId: "synthetic-account-7",
    status,
    version,
    ownerIdentityAvailable: false,
    maxPassengerCount: 1,
    vehicleType: "中大型轿车 · 示例 A",
    insuranceExpiresOn: "2027-08-31",
    syntheticAttachmentId: "synthetic-insurance-a",
    requestedMaterialCodes: [],
    timeline: [],
    synthetic: true,
  };
}

function trip(state: "pending_payment" | "cancelled") {
  return {
    tripId: "synthetic-trip-product-test",
    passengerAccountId: "synthetic-account-7",
    state,
    version: state === "pending_payment" ? 1 : 2,
    originLabel: "合成起点",
    destinationLabel: "合成终点",
    passengerCount: 1,
    payment: {
      amountMinor: 0,
      currency: "CNY",
      realPayment: false,
      state: state === "cancelled" ? "closed" : "pending_payment",
    },
    createdAt: "2026-07-11T00:00:00.000Z",
    ...(state === "cancelled"
      ? { cancelledAt: "2026-07-11T00:01:00.000Z", closureReason: "passenger_cancelled" }
      : {}),
    recovery: { state: "none" },
    synthetic: true,
  };
}

function acceptedTrip(state: "accepted" | "cancelled") {
  return {
    tripId: "synthetic-trip-late-cancellation",
    passengerAccountId: "synthetic-passenger-8",
    driverAccountId: "synthetic-account-7",
    state,
    version: state === "accepted" ? 3 : 4,
    originLabel: "合成起点",
    destinationLabel: "合成终点",
    passengerCount: 1,
    payment: {
      amountMinor: 0,
      currency: "CNY",
      realPayment: false,
      state: state === "cancelled" ? "closed" : "paid_pending_match",
    },
    createdAt: "2026-07-10T23:55:00.000Z",
    acceptedAt: "2026-07-11T00:00:00.000Z",
    ...(state === "cancelled"
      ? {
          cancelledAt: "2026-07-11T00:03:01.000Z",
          closureReason: "passenger_cancelled",
          cancellation: {
            reason: "driver_or_vehicle_concern",
            cancelledAt: "2026-07-11T00:03:01.000Z",
            cancelledBy: "passenger",
            realFeeAmountMinor: 0,
            currency: "CNY",
            withinFreeWindow: false,
            responsibility: "driver",
            nonFinancialRemedy: "priority_rematch",
            automaticallyDetermined: true,
          },
          recovery: {
            state: "cancellation_confirmed",
            recoveredAt: "2026-07-11T00:03:01.000Z",
            source: "state_reconciliation",
          },
        }
      : { recovery: { state: "none" } }),
    synthetic: true,
  };
}

