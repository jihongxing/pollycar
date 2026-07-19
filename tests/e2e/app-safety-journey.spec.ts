import { expect, test, type Page } from "@playwright/test";

import { openAuthenticatedPage } from "./helpers/authenticated-app";

test("安全联系复用 S01 视觉语言并发送真实输入内容", async ({ page }) => {
  const fixture = createSafetyFixture();
  let sentBody = "";
  await mockSafetyJourney(page, fixture, {
    onMessage(body) {
      sentBody = body;
    },
  });

  await openAuthenticatedPage(page, "/safety-chat");

  await expect(page.getByText("本次行程临时会话")).toBeVisible();
  await expect(page.getByText(/行程结束后开放 72 小时/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "输入行程消息" })).toBeVisible();
  await expect(page.getByRole("button", { name: "举报或安全帮助" })).toBeVisible();
  await expect(page.getByText(/合成消息|机器码|案件编号/)).toHaveCount(0);

  await page.getByRole("textbox", { name: "输入行程消息" }).fill("我在上车点东侧");
  await page.getByRole("button", { name: "发送" }).click();
  await expect.poll(() => sentBody).toBe("我在上车点东侧");
  await expect(page.getByText("我在上车点东侧")).toBeVisible();
});

test("报告安全问题后立即暂停行程和联系", async ({ page }) => {
  const fixture = createSafetyFixture();
  await mockSafetyJourney(page, fixture);

  await openAuthenticatedPage(page, "/safety-report");

  await expect(page.getByText("先暂停，再由安全团队处理")).toBeVisible();
  await expect(page.getByText("暂停当前行程")).toBeVisible();
  await expect(page.getByText("停止行程联系")).toBeVisible();
  await expect(page.getByText(/机器码|unsafe_behavior/)).toHaveCount(0);

  await page.getByRole("button", { name: "确认报告并暂停行程" }).click();
  await expect(page.getByText("确认报告安全问题？")).toBeVisible();
  await page.getByRole("button", { name: "确认提交" }).click();

  await expect(page).toHaveURL(/\/safety-frozen$/);
  await expect(page.getByText("行程和联系已暂停", { exact: true })).toBeVisible();
  await expect(page.getByText("正在进行安全处理")).toBeVisible();
});

test("被报告方只能提交一次申诉且不会自动恢复", async ({ page }) => {
  const fixture = createSafetyFixture({
    safetyCase: safetyCase("open_frozen"),
    chatState: "frozen",
  });
  await mockSafetyJourney(page, fixture);

  await openAuthenticatedPage(page, "/safety-frozen");
  await page.getByRole("button", { name: "补充一次申诉说明" }).click();

  await expect(page).toHaveURL(/\/safety-appeal$/);
  await expect(page.getByText("补充可能缺失的行程背景", { exact: true })).toBeVisible();
  await expect(page.getByText(/机器码|context_missing/)).toHaveCount(0);
  await page.getByRole("button", { name: "提交申诉说明" }).click();
  await expect(page.getByText("确认提交申诉说明？")).toBeVisible();
  await page.getByRole("button", { name: "确认提交" }).click();

  await expect(page).toHaveURL(/\/safety-frozen$/);
  await expect(page.getByRole("heading", { name: "申诉正在处理中" })).toBeVisible();
  await expect(page.getByRole("button", { name: "补充一次申诉说明" })).toHaveCount(0);
  await expect(page.getByText(/不会因提交申诉自动解除/).last()).toBeVisible();
});

test("恢复结果提供身份对应的下一步且不泄漏内部结论", async ({ page }) => {
  const fixture = createSafetyFixture({
    safetyCase: safetyCase("restored"),
    chatState: "closed",
  });
  await mockSafetyJourney(page, fixture);

  await openAuthenticatedPage(page, "/safety-result");

  await expect(page.getByText("相关使用能力已恢复")).toBeVisible();
  await expect(page.getByRole("button", { name: "查看行程" })).toBeVisible();
  await expect(page.getByText(/restore_access|restored|案件编号/)).toHaveCount(0);
});

test("维持限制结果保留恢复出口且不允许继续被冻结行程", async ({ page }) => {
  const fixture = createSafetyFixture({
    safetyCase: safetyCase("upheld"),
    chatState: "frozen",
  });
  await mockSafetyJourney(page, fixture);

  await openAuthenticatedPage(page, "/safety-result");

  await expect(page.getByText("本次限制继续保持")).toBeVisible();
  await expect(page.getByText("行程仍不可继续")).toBeVisible();
  await expect(page.getByRole("button", { name: "返回我的" })).toBeVisible();
  await expect(page.getByText(/uphold_freeze|upheld|案件编号/)).toHaveCount(0);
});

test("安全进展加载失败时提供明确重试入口", async ({ page }) => {
  await page.route("**/v1/internal-sandbox/app/synthetic-trips/dashboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        passengerTrip: passengerTrip(),
        passengerTrips: [passengerTrip()],
        availableDriverTrips: [],
        productionEnabled: false,
        realPayment: false,
        shanghaiPilot: false,
      }),
    });
  });
  await page.route("**/v1/internal-sandbox/app/synthetic-trips/safety-trip-11/safety", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "暂时不可用",
          retryable: true,
        },
      }),
    });
  });

  await openAuthenticatedPage(page, "/safety-frozen");

  await expect(page.getByText("暂时无法读取处理进展")).toBeVisible();
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
});

type SafetyCaseState = "open_frozen" | "appealing" | "restored" | "upheld";

type SafetyFixture = {
  trip: ReturnType<typeof passengerTrip>;
  chat: ReturnType<typeof chat>;
  safetyCase?: ReturnType<typeof safetyCase>;
};

function createSafetyFixture(
  options: Readonly<{
    safetyCase?: ReturnType<typeof safetyCase>;
    chatState?: "closed" | "open" | "frozen";
  }> = {},
): SafetyFixture {
  return {
    trip: passengerTrip(),
    chat: chat(options.chatState ?? "open"),
    ...(options.safetyCase ? { safetyCase: options.safetyCase } : {}),
  };
}

async function mockSafetyJourney(
  page: Page,
  fixture: SafetyFixture,
  options: Readonly<{ onMessage?: (body: string) => void }> = {},
) {
  await page.route("**/v1/internal-sandbox/app/synthetic-trips/dashboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        passengerTrip: fixture.trip,
        passengerTrips: [fixture.trip],
        availableDriverTrips: [],
        productionEnabled: false,
        realPayment: false,
        shanghaiPilot: false,
      }),
    });
  });
  await page.route(/\/v1\/internal-sandbox\/app\/synthetic-trips\/safety-trip-11\/safety(?:\/.*)?$/, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "POST" && path.endsWith("/messages")) {
      const body = (route.request().postDataJSON() as { body: string }).body;
      options.onMessage?.(body);
      fixture.chat = {
        ...fixture.chat,
        messages: [
          ...fixture.chat.messages,
          {
            messageId: `message-${fixture.chat.messages.length + 1}`,
            senderAccountId: "synthetic-account-7",
            body,
            sentAt: "2026-07-18T02:00:00.000Z",
            synthetic: true,
          },
        ],
      };
    } else if (route.request().method() === "POST" && path.endsWith("/reports")) {
      fixture.chat = { ...fixture.chat, state: "frozen" };
      fixture.safetyCase = safetyCase("open_frozen");
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        chat: fixture.chat,
        ...(fixture.safetyCase ? { safetyCase: fixture.safetyCase } : {}),
        realChatEnabled: false,
        realEvidenceEnabled: false,
      }),
    });
  });
  await page.route("**/v1/internal-sandbox/app/safety-cases/safety-case-11/appeal", async (route) => {
    fixture.safetyCase = safetyCase("appealing");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixture.safetyCase),
    });
  });
}

function passengerTrip() {
  return {
    tripId: "safety-trip-11",
    passengerAccountId: "synthetic-account-7",
    driverAccountId: "synthetic-driver-11",
    state: "accepted",
    version: 3,
    originLabel: "人民广场 · 上车点",
    destinationLabel: "虹桥站 · 到达点",
    passengerCount: 1,
    driverProfile: {
      accountId: "synthetic-driver-11",
      displayName: "林师傅",
      avatarUrl: "",
      genderLabel: "男",
      rating: 4.9,
    },
    vehicle: {
      vehicleId: "vehicle-safety-11",
      make: "示例",
      model: "轿车",
      color: "深蓝色",
      licensePlate: "沪A·00011",
      maxPassengerCount: 3,
      synthetic: true,
    },
    payment: {
      amountMinor: 0,
      currency: "CNY",
      realPayment: false,
      state: "paid_pending_match",
    },
    createdAt: "2026-07-18T01:00:00.000Z",
    acceptedAt: "2026-07-18T01:02:00.000Z",
    recovery: { state: "none" },
    synthetic: true,
  } as const;
}

function chat(state: "closed" | "open" | "frozen") {
  return {
    tripId: "safety-trip-11",
    state,
    messages: [
      {
        messageId: "message-1",
        senderAccountId: "synthetic-driver-11",
        body: "我已到达上车点。",
        sentAt: "2026-07-18T01:05:00.000Z",
        synthetic: true,
      },
    ],
    expiresAt: "2026-07-21T01:00:00.000Z",
    synthetic: true,
  } as const;
}

function safetyCase(state: SafetyCaseState) {
  return {
    caseId: "safety-case-11",
    tripId: "safety-trip-11",
    reporterAccountId: "synthetic-driver-11",
    reportedAccountId: "synthetic-account-7",
    reasonCode: "unsafe_behavior",
    state,
    version: state === "open_frozen" ? 1 : state === "appealing" ? 2 : 3,
    ...(state === "appealing" ? { appealReasonCode: "context_missing" } : {}),
    ...(state === "restored"
      ? {
          appealReasonCode: "context_missing",
          resolutionCode: "restore_access",
          resolvedAt: "2026-07-18T03:00:00.000Z",
        }
      : {}),
    ...(state === "upheld"
      ? {
          appealReasonCode: "context_missing",
          resolutionCode: "uphold_freeze",
          resolvedAt: "2026-07-18T03:00:00.000Z",
        }
      : {}),
    createdAt: "2026-07-18T01:10:00.000Z",
    synthetic: true,
  } as const;
}
