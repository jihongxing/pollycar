import { expect, test } from "@playwright/test";
import { mockMobilityDashboard, syntheticTrip } from "./helpers/mobility-fixtures";
import { openAuthenticatedPage } from "./helpers/authenticated-app";

test("消息中心以行程为主体展示完整聊天并区分系统通知", async ({ page }) => {
  const trip = syntheticTrip("accepted", "message-center-current-trip");
  await mockMobilityDashboard(page, { passengerTrip: trip });
  const readItemIds = new Set<string>();
  let allRead = false;
  await page.route("**/v1/internal-sandbox/app/messages/read-all", async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Session synthetic-session-/);
    allRead = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(messageCenterView(readItemIds, allRead)),
    });
  });
  await page.route("**/v1/internal-sandbox/app/messages", async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Session synthetic-session-/);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(messageCenterView(readItemIds, allRead)),
    });
  });
  await page.route("**/v1/internal-sandbox/app/messages/*/read", async (route) => {
    const itemId = route.request().url().split("/").at(-2);
    if (itemId) readItemIds.add(itemId);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(messageCenterView(readItemIds, allRead)),
    });
  });
  await page.route(
    `**/v1/internal-sandbox/app/synthetic-trips/${trip.tripId}/chat`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(openMessageCenterChat(trip.tripId)),
      });
    },
  );

  await openAuthenticatedPage(page, "/message-center");

  await expect(page.getByRole("tab", { name: "联系人" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "通知" })).toHaveCount(0);
  await expect(page.getByText("联系人", { exact: true })).toHaveCount(0);
  await expect(page.getByText("需要处理", { exact: true })).toHaveCount(0);
  await expect(page.getByText("当前行程联系")).toBeVisible();
  await expect(page.getByText("车辆已到达人民广场东门")).toBeVisible();
  await expect(page.getByText("我穿蓝色外套，马上到")).toBeVisible();
  await expect(page.getByText("车主已接受行程")).toBeVisible();
  await expect(page.getByText("行程会话窗口")).toBeVisible();
  await expect(page.getByText(/联系窗口将在行程结束 72 小时后关闭/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "输入行程消息" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /车辆审核，你的车辆资料审核已通过/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "全部已读" }).click();
  await expect(page.getByRole("button", { name: "全部已读" })).toBeDisabled();
  await page
    .getByRole("button", { name: /车辆审核，你的车辆资料审核已通过/ })
    .click();
  await expect(page).toHaveURL(/\/vehicle-settings$/);
  await page.getByRole("button", { name: "返回" }).click();
  await expect(page).toHaveURL(/\/message-center$/);

  await page.reload();
  await expect(page.getByText("车辆审核")).toBeVisible();
  await expect(page.getByRole("tab", { name: "联系人" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "通知" })).toHaveCount(0);
});

test("历史行程从消息中心进入完整记录并返回", async ({ page }) => {
  const currentTrip = syntheticTrip("accepted", "message-center-active-trip");
  const historyTrip = syntheticTrip("completed", "message-center-history-trip");
  await mockMobilityDashboard(page, {
    passengerTrip: currentTrip,
    passengerTrips: [currentTrip, historyTrip],
  });
  await page.route("**/v1/internal-sandbox/app/messages", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(historyMessageCenterView(historyTrip.tripId)),
    });
  });
  await page.route("**/v1/internal-sandbox/app/messages/*/read", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(historyMessageCenterView(historyTrip.tripId, true)),
    });
  });
  await page.route(
    `**/v1/internal-sandbox/app/synthetic-trips/${currentTrip.tripId}/chat`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(openMessageCenterChat(currentTrip.tripId)),
      });
    },
  );
  await page.route(
    `**/v1/internal-sandbox/app/synthetic-trips/${historyTrip.tripId}/chat`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(closedMessageCenterChat(historyTrip.tripId)),
      });
    },
  );

  await openAuthenticatedPage(page, "/message-center");
  await page
    .getByRole("button", {
      name: /人民广场 → 上海虹桥站，查看完整聊天记录和行程状态节点/,
    })
    .click();

  await expect(page).toHaveURL(/\/trip-chat$/);
  await expect(page.getByText("历史记录：车辆停在 2 号口")).toBeVisible();
  await expect(page.getByText("历史记录：好的，我马上出来")).toBeVisible();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await expect(page).toHaveURL(/\/message-center$/);
});

test("会话关闭后保留历史并明确区分二十四小时建议与七十二小时窗口", async ({
  page,
}) => {
  const trip = syntheticTrip("completed", "message-center-closed-trip");
  await mockMobilityDashboard(page, { passengerTrip: trip });
  await page.route("**/v1/internal-sandbox/app/messages", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(closedMessageCenterView(trip.tripId)),
    });
  });
  await page.route("**/v1/internal-sandbox/app/messages/*/read", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(closedMessageCenterView(trip.tripId, true)),
    });
  });
  await page.route(
    `**/v1/internal-sandbox/app/synthetic-trips/${trip.tripId}/chat`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(closedMessageCenterChat(trip.tripId)),
      });
    },
  );

  await openAuthenticatedPage(page, "/message-center");
  await expect(page.getByText("历史记录：车辆停在 2 号口")).toBeVisible();
  await expect(page.getByText("历史记录：好的，我马上出来")).toBeVisible();
  await expect(page.getByText("遗失物品联系建议")).toBeVisible();
  await expect(page.getByText("24 小时", { exact: true })).toBeVisible();
  await expect(page.getByText("行程会话窗口")).toBeVisible();
  await expect(page.getByText("72 小时", { exact: true })).toBeVisible();
  await expect(page.getByText("本次行程会话已关闭")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "输入行程消息" })).toHaveCount(0);
});

function messageCenterView(readItemIds: ReadonlySet<string>, allRead: boolean) {
  const items = [
    {
      itemId: "message-current-chat",
      category: "trip_chat",
      title: "陈先生",
      body: "我穿蓝色外套，马上到",
      target: { kind: "trip_chat", tripId: "message-center-current-trip" },
      occurredAt: "2026-07-18T07:58:00.000Z",
      pinned: true,
      synthetic: true,
    },
    {
      itemId: "message-current-service",
      category: "trip_service",
      title: "车主已接受行程",
      body: "陈先生将前往人民广场接你",
      target: { kind: "trip", tripId: "message-center-current-trip" },
      occurredAt: "2026-07-18T07:56:00.000Z",
      pinned: false,
      synthetic: true,
    },
    {
      itemId: "message-vehicle",
      category: "vehicle_review",
      title: "车辆审核",
      body: "你的车辆资料审核已通过",
      target: { kind: "vehicle_review", reviewId: "vehicle-application-7" },
      occurredAt: "2026-07-18T07:54:00.000Z",
      pinned: false,
      synthetic: true,
    },
  ].map((item) => ({
    ...item,
    ...(allRead || readItemIds.has(item.itemId)
      ? { readAt: "2026-07-18T08:00:00.000Z" }
      : {}),
  }));
  return {
    accountId: "current-session-account",
    unreadCount: items.filter((item) => !("readAt" in item)).length,
    items,
    realPushEnabled: false,
    externalNotificationProviderEnabled: false,
    synthetic: true,
  };
}

function historyMessageCenterView(historyTripId: string, read = false) {
  return {
    accountId: "current-session-account",
    unreadCount: read ? 0 : 1,
    items: [
      {
        itemId: "message-history-chat",
        category: "trip_chat",
        title: "陈先生",
        body: "历史记录：好的，我马上出来",
        target: { kind: "trip_chat", tripId: historyTripId },
        occurredAt: "2026-07-17T08:00:00.000Z",
        ...(read ? { readAt: "2026-07-18T08:00:00.000Z" } : {}),
        pinned: false,
        synthetic: true,
      },
    ],
    realPushEnabled: false,
    externalNotificationProviderEnabled: false,
    synthetic: true,
  };
}

function closedMessageCenterView(tripId: string, read = false) {
  return {
    accountId: "current-session-account",
    unreadCount: read ? 0 : 1,
    items: [
      {
        itemId: "message-closed-chat",
        category: "trip_chat",
        title: "陈先生",
        body: "历史记录：好的，我马上出来",
        target: { kind: "trip_chat", tripId },
        occurredAt: "2026-07-17T08:00:00.000Z",
        ...(read ? { readAt: "2026-07-18T08:00:00.000Z" } : {}),
        pinned: false,
        synthetic: true,
      },
    ],
    realPushEnabled: false,
    externalNotificationProviderEnabled: false,
    synthetic: true,
  };
}

function openMessageCenterChat(tripId: string) {
  return {
    conversationId: `trip-chat-${tripId}`,
    tripId,
    state: "open",
    participants: [],
    messages: [
      {
        messageId: "message-history-1",
        senderAccountId: "synthetic-account-7",
        body: "车辆已到达人民广场东门",
        sentAt: "2026-07-18T07:55:00.000Z",
        deliveryState: "sent",
        synthetic: true,
      },
      {
        messageId: "message-history-2",
        senderAccountId: "current-session-account",
        body: "我穿蓝色外套，马上到",
        sentAt: "2026-07-18T07:58:00.000Z",
        deliveryState: "sent",
        synthetic: true,
      },
    ],
    quickReplies: ["我马上到"],
    openedAt: "2026-07-18T07:50:00.000Z",
    expiresAt: "2026-07-21T07:50:00.000Z",
    retention: {
      contentDeleteAfter: "2026-07-24T07:50:00.000Z",
      evidenceHold: false,
      deletionState: "blocked_by_window",
      summaryRetained: true,
    },
    realChatEnabled: false,
    externalChatProviderEnabled: false,
    synthetic: true,
  };
}

function closedMessageCenterChat(tripId: string) {
  return {
    conversationId: `trip-chat-${tripId}`,
    tripId,
    state: "closed",
    participants: [],
    messages: [
      {
        messageId: "message-closed-1",
        senderAccountId: "synthetic-account-7",
        body: "历史记录：车辆停在 2 号口",
        sentAt: "2026-07-17T07:55:00.000Z",
        deliveryState: "sent",
        synthetic: true,
      },
      {
        messageId: "message-closed-2",
        senderAccountId: "current-session-account",
        body: "历史记录：好的，我马上出来",
        sentAt: "2026-07-17T08:00:00.000Z",
        deliveryState: "sent",
        synthetic: true,
      },
    ],
    quickReplies: [],
    openedAt: "2026-07-17T07:50:00.000Z",
    expiresAt: "2026-07-18T07:50:00.000Z",
    closedAt: "2026-07-18T07:50:00.000Z",
    retention: {
      contentDeleteAfter: "2026-07-21T07:50:00.000Z",
      evidenceHold: false,
      deletionState: "eligible",
      summaryRetained: true,
    },
    realChatEnabled: false,
    externalChatProviderEnabled: false,
    synthetic: true,
  };
}

test("行程消息通过 Server 保存并在刷新后恢复", async ({ page }) => {
  const trip = { ...syntheticTrip("accepted"), tripId: "synthetic-trip-chat-1" };
  await mockMobilityDashboard(page, { passengerTrip: trip });
  const messages = [{
    messageId: "message-seed",
    senderAccountId: "other-account",
    body: "车辆已到达附近",
    sentAt: "2026-07-13T08:00:00.000Z",
    deliveryState: "sent",
    synthetic: true,
  }];
  await page.route(`**/v1/internal-sandbox/app/synthetic-trips/${trip.tripId}/chat`, async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Session synthetic-session-/);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(chatViewWithMessages(trip.tripId, messages)),
    });
  });
  await page.route(`**/v1/internal-sandbox/app/synthetic-trips/${trip.tripId}/chat/messages`, async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Session synthetic-session-/);
    const payload = route.request().postDataJSON() as { body: string };
    messages.push({
      messageId: "message-e2e",
      senderAccountId: "current-session-account",
      body: payload.body,
      sentAt: "2026-07-13T08:01:00.000Z",
      deliveryState: "sent",
      synthetic: true,
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(chatViewWithMessages(trip.tripId, messages)),
    });
  });
  await openAuthenticatedPage(page, "/trip-chat");
  await page.getByRole("textbox", { name: "输入行程消息" }).fill("我在东门等候");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("我在东门等候")).toBeVisible();
  await page.reload();
  await expect(page.getByText("我在东门等候")).toBeVisible();
  await expect(page.getByText("本次行程临时会话")).toBeVisible();
});

function chatViewWithMessages(tripId: string, messages: readonly object[]) {
  return {
    ...chatView(tripId, "eligible", false, false),
    state: "open",
    messages,
    quickReplies: ["我已到达"],
  };
}

test("聊天正文到期后可删除并保留最小摘要", async ({ page }) => {
  const trip = { ...syntheticTrip("completed"), tripId: "synthetic-trip-chat-delete" };
  await mockMobilityDashboard(page, { passengerTrip: trip });
  let deleted = false;
  await page.route(`**/v1/internal-sandbox/app/synthetic-trips/${trip.tripId}/chat`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(chatView(trip.tripId, deleted ? "deleted" : "eligible", false, deleted)),
    });
  });
  await page.route(`**/v1/internal-sandbox/app/synthetic-trips/${trip.tripId}/chat/content-deletion`, async (route) => {
    deleted = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(chatView(trip.tripId, "deleted", false, true)),
    });
  });
  await openAuthenticatedPage(page, "/trip-chat");
  await expect(page.getByText(/行程消息正文计划在 2026-07-15 后删除/)).toBeVisible();
  await page.getByRole("button", { name: "删除行程消息正文" }).click();
  await expect(page.getByText("还没有消息")).toBeVisible();
});

test("安全证据保留期间明确阻止聊天正文删除", async ({ page }) => {
  const trip = { ...syntheticTrip("cancelled"), tripId: "synthetic-trip-chat-hold" };
  await mockMobilityDashboard(page, { passengerTrip: trip });
  await page.route(`**/v1/internal-sandbox/app/synthetic-trips/${trip.tripId}/chat`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(chatView(trip.tripId, "blocked_by_hold", true, false)),
    });
  });
  await openAuthenticatedPage(page, "/trip-chat");
  await expect(page.getByText(/因安全证据保留暂不能删除/)).toBeVisible();
  await expect(page.getByRole("button", { name: "安全证据保留中" })).toBeDisabled();
});

function chatView(
  tripId: string,
  deletionState: "eligible" | "blocked_by_hold" | "deleted",
  evidenceHold: boolean,
  deleted: boolean,
) {
  return {
    conversationId: `trip-chat-${tripId}`,
    tripId,
    state: "closed",
    participants: [],
    messages: deleted ? [] : [{
      messageId: "message-retention",
      senderAccountId: "synthetic-passenger-8",
      body: "待清理的合成正文",
      sentAt: "2026-07-12T08:00:00.000Z",
      deliveryState: "sent",
      synthetic: true,
    }],
    quickReplies: [],
    openedAt: "2026-07-12T08:00:00.000Z",
    closedAt: "2026-07-12T08:00:00.000Z",
    retention: {
      contentDeleteAfter: "2026-07-15T08:00:00.000Z",
      evidenceHold,
      deletionState,
      summaryRetained: true,
    },
    realChatEnabled: false,
    externalChatProviderEnabled: false,
    synthetic: true,
  };
}
