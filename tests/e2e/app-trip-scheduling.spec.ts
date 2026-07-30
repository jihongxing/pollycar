import { expect, test, type Page } from "@playwright/test";

import { openAuthenticatedPage } from "./helpers/authenticated-app";

test("乘车人可选择连续快捷时段并完整修改未接单预约", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-13T06:25:00.000Z"));
  const state = await mockSchedulingJourney(page);
  await openAuthenticatedPage(page, "/ride-confirmation");

  await expect(page.getByText("尽快出发 · 当前 14:25")).toBeVisible();
  await page.getByRole("button", { name: /希望上车时间/ }).click();
  for (const label of ["15:00–15:10", "15:10–15:20", "15:20–15:30", "15:30–15:40"]) {
    await expect(page.getByRole("radio", { name: label })).toBeVisible();
  }
  await page.getByRole("radio", { name: "15:00–15:10" }).click();
  await expect(page.getByRole("button", { name: "预约今天 15:00" })).toBeVisible();
  await page.getByRole("textbox", { name: "上车点" }).fill("人民广场预约点");
  await page.getByRole("textbox", { name: "目的地" }).fill("虹桥预约点");
  await page.getByRole("radio", { name: "3 人" }).click();
  await page.getByRole("radio", { name: "通勤" }).click();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "上车点" })).toHaveValue("人民广场预约点");
  await expect(page.getByRole("textbox", { name: "目的地" })).toHaveValue("虹桥预约点");
  await expect(page.getByText("3 人乘车", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "预约今天 15:00" })).toBeVisible();
  await page.getByRole("button", { name: "预约今天 15:00" }).click();

  await expect(page).toHaveURL(/\/ride-matching$/);
  await expect(page.getByText("正在等待车主接受预约")).toBeVisible();
  await expect(
    page.getByText("今天 15:00–15:10；平台不会强制车主接单。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "修改预约信息" }).click();

  await expect(page).toHaveURL(/\/ride-confirmation$/);
  await expect(page.getByText("修改未接单预约").last()).toBeVisible();
  await page.getByRole("textbox", { name: "上车点" }).last().fill("静安寺");
  await page.getByRole("textbox", { name: "目的地" }).last().fill("浦东机场");
  await page.getByRole("radio", { name: "2 人" }).last().click();
  await page.getByRole("radio", { name: "机场／车站" }).last().click();
  await page.getByRole("button", { name: "保存预约修改" }).last().click();

  await expect(page).toHaveURL(/\/ride-matching$/);
  expect(state.lastRevision).toMatchObject({
    originLabel: "静安寺",
    destinationLabel: "浦东机场",
    passengerCount: 2,
    scene: "airport",
    timing: {
      requestedPickupStartsAt: "2026-07-13T07:00:00.000Z",
      requestedPickupEndsAt: "2026-07-13T07:10:00.000Z",
    },
  });
});

test("车主订单页显示完整预约时间并保留自主接单决定", async ({ page }) => {
  const offerTrip = scheduledTrip("scheduled");
  await page.route("**/v1/internal-sandbox/app/driver/availability", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accountId: "synthetic-account-7",
        state: "online",
        returnOnlineAfterTrip: true,
        updatedAt: "2026-07-13T06:25:00.000Z",
        productionEnabled: false,
        synthetic: true,
      }),
    });
  });
  await page.route("**/v1/internal-sandbox/app/driver/offers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        offers: [
          {
            offerId: "dispatch-offer-scheduling-e2e",
            tripId: offerTrip.tripId,
            tripVersion: offerTrip.version,
            driverAccountId: "synthetic-account-7",
            state: "offered",
            dispatchRound: 1,
            distanceMeters: 1800,
            offeredAt: "2026-07-13T06:25:00.000Z",
            expiresAt: "2026-07-13T06:26:00.000Z",
            trip: offerTrip,
            synthetic: true,
          },
        ],
        serverTime: "2026-07-13T06:25:00.000Z",
        productionEnabled: false,
        realPushEnabled: false,
        synthetic: true,
      }),
    });
  });
  await page.route("**/v1/internal-sandbox/app/driver/orders", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
  await page.route("**/v1/internal-sandbox/app/driver/finance/overview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        withdrawableAmountMinor: 0,
        pendingSettlementAmountMinor: 0,
        totalIncomeAmountMinor: 0,
        currency: "CNY",
        bankCards: [],
        entries: [],
        withdrawals: [],
        realPaymentEnabled: false,
        realSettlementEnabled: false,
        realBankCardBindingEnabled: false,
        realWithdrawalEnabled: false,
        synthetic: true,
      }),
    });
  });
  await page.route("**/v1/internal-sandbox/app/synthetic-trips/dashboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        availableDriverTrips: [offerTrip],
        productionEnabled: false,
        realPayment: false,
        shanghaiPilot: false,
      }),
    });
  });
  await page.route("**/v1/internal-sandbox/app/vehicle-reviews/vehicle-application-7**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        applicationId: "vehicle-application-7",
        accountId: "synthetic-account-7",
        status: "approved",
        version: 2,
        ownerIdentityAvailable: true,
        vehicleType: "新能源轿车",
        maxPassengerCount: 3,
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
        sessionId: "session-scheduling-e2e",
        accountId: "synthetic-account-7",
        activeIdentity: "driver",
        availableIdentities: ["passenger", "driver"],
        adultEligibilityState: "verified",
        businessAccessAllowed: true,
        issuedAt: "2026-07-13T06:20:00.000Z",
        expiresAt: "2026-07-13T07:20:00.000Z",
        state: "active",
        productionEnabled: false,
        synthetic: true,
      }),
    });
  });
  await openAuthenticatedPage(page, "/identity-settings");
  await page.getByRole("button", { name: "切换为车主身份" }).click();
  await expect(page).toHaveURL(/\/owner-workbench$/);
  await page.getByRole("tab", { name: "首页" }).click();
  await expect(page).toHaveURL(/\/driver-home$/);
  await page.getByRole("button", { name: "查看附近订单" }).click();
  await expect(page).toHaveURL(/\/driver-orders$/);

  await expect(page.getByRole("heading", { name: "附近订单" })).toBeVisible();
  await expect(page.getByText("逐单查看路线、人数和时间，再决定是否接受。")).toBeVisible();
  await expect(page.getByText(/预约行程 · 是否接受由你决定/)).toBeVisible();
  await expect(page.getByText(/7\/13.*15:00–15:10/)).toBeVisible();
  await expect(page.getByText("林女士")).toBeVisible();
  await expect(page.getByText("♀")).toBeVisible();
});

async function mockSchedulingJourney(page: Page) {
  let trip: ReturnType<typeof scheduledTrip> | undefined;
  const state: { lastRevision?: Record<string, unknown> } = {};
  await page.route(/\/v1\/internal-sandbox\/app\/synthetic-trips(?:\/.*)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET" && path.endsWith("/booking-availability")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(bookingAvailability()),
      });
      return;
    }
    if (request.method() === "GET" && path.endsWith("/dashboard")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          availableDriverTrips: [],
          productionEnabled: false,
          realPayment: false,
          shanghaiPilot: false,
          ...(trip ? { passengerTrip: trip } : {}),
        }),
      });
      return;
    }
    if (request.method() === "POST" && path.endsWith("/synthetic-trips")) {
      const body = request.postDataJSON();
      trip = {
        ...scheduledTrip("pending_payment"),
        originLabel: body.originLabel,
        destinationLabel: body.destinationLabel,
        passengerCount: body.passengerCount,
        scene: body.scene,
        timing: body.timing,
      };
    } else if (request.method() === "POST" && path.endsWith("/payment")) {
      trip = { ...trip!, state: "scheduled", version: 2 };
    } else if (request.method() === "POST" && path.endsWith("/reschedule")) {
      const body = request.postDataJSON();
      state.lastRevision = body;
      trip = {
        ...trip!,
        ...body,
        state: "scheduled",
        version: 3,
      };
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
  return state;
}

function bookingAvailability() {
  const slots = [
    ["2026-07-13T07:00:00.000Z", "2026-07-13T07:10:00.000Z"],
    ["2026-07-13T07:10:00.000Z", "2026-07-13T07:20:00.000Z"],
    ["2026-07-13T07:20:00.000Z", "2026-07-13T07:30:00.000Z"],
    ["2026-07-13T07:30:00.000Z", "2026-07-13T07:40:00.000Z"],
    ["2026-07-14T08:00:00.000Z", "2026-07-14T08:10:00.000Z"],
  ].map(([startsAt, endsAt]) => ({ startsAt, endsAt, available: true }));
  return {
    serverNow: "2026-07-13T06:25:00.000Z",
    timezone: "Asia/Shanghai",
    immediateAvailable: true,
    minimumLeadMinutes: 30,
    slotDurationMinutes: 10,
    latestScheduledAt: "2026-07-16T06:25:00.000Z",
    quickSlots: slots.slice(0, 4),
    availableSlots: slots,
    serviceWindows: [{ weekday: 1, startsAtMinute: 0, endsAtMinute: 1440 }],
  };
}

function scheduledTrip(state: "pending_payment" | "scheduled") {
  return {
    tripId: "synthetic-trip-scheduling-e2e",
    passengerAccountId: "synthetic-passenger-8",
    state,
    version: 1,
    originLabel: "人民广场",
    destinationLabel: "虹桥",
    passengerCount: 1,
    scene: "commute",
    timing: {
      mode: "scheduled",
      timezone: "Asia/Shanghai",
      selectionSource: "quick_slot",
      requestedPickupStartsAt: "2026-07-13T07:00:00.000Z",
      requestedPickupEndsAt: "2026-07-13T07:10:00.000Z",
    },
    passengerProfile: {
      accountId: "synthetic-passenger-8",
      displayName: "林女士",
      gender: "female",
      genderSource: "verified_identity_document",
      genderDisclosure: "eligible_driver_pre_acceptance",
      synthetic: true,
    },
    payment: {
      amountMinor: 0,
      currency: "CNY",
      realPayment: false,
      state: state === "pending_payment" ? "pending_payment" : "paid_pending_match",
    },
    scheduleNotices: [
      {
        kind: "created",
        dueAt: "2026-07-13T06:25:00.000Z",
        delivered: true,
      },
    ],
    createdAt: "2026-07-13T06:25:00.000Z",
    recovery: { state: "none" },
    synthetic: true,
  };
}
