import type { MessageCenterItem } from "@pollycar/contracts";

export type TripConversationRecord = Readonly<{
  tripId: string;
  items: readonly MessageCenterItem[];
  unreadCount: number;
  latestAt: string;
}>;

export type MessageCenterFeed = Readonly<{
  conversations: readonly TripConversationRecord[];
  notifications: readonly MessageCenterItem[];
  unreadCount: number;
}>;

export function buildMessageCenterFeed(
  items: readonly MessageCenterItem[],
): MessageCenterFeed {
  const conversationItems = new Map<string, MessageCenterItem[]>();
  const notifications: MessageCenterItem[] = [];

  for (const item of items) {
    const tripId = messageTripId(item);
    if (!tripId) {
      notifications.push(item);
      continue;
    }
    const existing = conversationItems.get(tripId) ?? [];
    existing.push(item);
    conversationItems.set(tripId, existing);
  }

  const conversations = [...conversationItems.entries()]
    .map(([tripId, tripItems]) => {
      const sortedItems = [...tripItems].sort(
        (left, right) =>
          Date.parse(left.occurredAt) - Date.parse(right.occurredAt),
      );
      return {
        tripId,
        items: sortedItems,
        unreadCount: sortedItems.filter((item) => !item.readAt).length,
        latestAt: sortedItems.at(-1)?.occurredAt ?? "",
      };
    })
    .sort((left, right) => Date.parse(right.latestAt) - Date.parse(left.latestAt));

  const sortedNotifications = [...notifications].sort(
    (left, right) =>
      Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
  );

  return {
    conversations,
    notifications: sortedNotifications,
    unreadCount: items.filter((item) => !item.readAt).length,
  };
}

export function messageTripId(item: MessageCenterItem): string | undefined {
  if (item.target.kind === "trip_chat" || item.target.kind === "trip") {
    return item.target.tripId;
  }
  return undefined;
}
