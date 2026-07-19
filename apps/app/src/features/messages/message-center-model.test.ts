import type { MessageCenterItem } from "@pollycar/contracts";
import { describe, expect, it } from "vitest";

import {
  buildMessageCenterFeed,
  messageTripId,
} from "./message-center-model";

describe("message-center-model", () => {
  it("按行程聚合联系与状态节点，并将系统通知保留在同一消息流", () => {
    const feed = buildMessageCenterFeed([
      item("trip-chat", "trip_chat", "2026-07-18T02:00:00.000Z"),
      item("trip-update", "trip_service", "2026-07-18T01:00:00.000Z"),
      item("vehicle", "vehicle_review", "2026-07-17T01:00:00.000Z"),
      item("safety", "safety", "2026-07-18T03:00:00.000Z", true),
    ]);

    expect(feed.conversations).toHaveLength(1);
    expect(feed.conversations[0]).toMatchObject({
      tripId: "trip-1",
      unreadCount: 2,
      latestAt: "2026-07-18T02:00:00.000Z",
    });
    expect(feed.conversations[0]?.items.map((message) => message.itemId)).toEqual([
      "trip-update",
      "trip-chat",
    ]);
    expect(feed.notifications.map((message) => message.itemId)).toEqual([
      "safety",
      "vehicle",
    ]);
    expect(feed.unreadCount).toBe(3);
  });

  it("所有双方联系都保持绑定具体行程", () => {
    const chat = item(
      "trip-chat",
      "trip_chat",
      "2026-07-18T02:00:00.000Z",
    );
    expect(messageTripId(chat)).toBe("trip-1");
  });
});

function item(
  itemId: string,
  category: MessageCenterItem["category"],
  occurredAt: string,
  read = false,
): MessageCenterItem {
  return {
    itemId,
    category,
    title: itemId,
    body: "消息正文",
    occurredAt,
    ...(read ? { readAt: "2026-07-18T04:00:00.000Z" } : {}),
    pinned: category === "trip_chat",
    target:
      category === "trip_chat"
        ? { kind: "trip_chat", tripId: "trip-1" }
        : category === "trip_service"
          ? { kind: "trip", tripId: "trip-1" }
          : category === "vehicle_review"
            ? { kind: "vehicle_review" }
            : category === "eligibility"
              ? { kind: "eligibility" }
              : { kind: "safety_case", caseId: "case-1" },
    synthetic: true,
  };
}
