export type TripChatState = "open" | "frozen" | "expired" | "closed";
export type TripChatDeliveryState = "sending" | "sent" | "failed" | "unknown";

export type TripChatMessage = Readonly<{
  id: string;
  sender: "self" | "counterparty";
  text: string;
  sentAt: string;
  deliveryState: TripChatDeliveryState;
  synthetic: true;
}>;

export type TripChatModel = Readonly<{
  tripId: string;
  counterpartyName: string;
  state: TripChatState;
  closesAt?: string;
  messages: readonly TripChatMessage[];
  synthetic: true;
}>;

export const quickReplies = ["我已到上车点", "请稍等一下", "我正在确认车辆", "收到，谢谢"] as const;

export const tripEndedNoticeWindowMs = 24 * 60 * 60_000;

export function shouldShowTripEndedNotice(input: Readonly<{
  activeIdentity: "passenger" | "owner";
  tripState: string;
  chatState?: string;
  completedAt?: string;
  nowMs: number;
}>): boolean {
  if (
    input.activeIdentity !== "passenger" ||
    input.tripState !== "completed" ||
    input.chatState !== "open" ||
    !input.completedAt
  ) {
    return false;
  }
  const completedAtMs = new Date(input.completedAt).getTime();
  if (!Number.isFinite(completedAtMs)) return false;
  const elapsedMs = input.nowMs - completedAtMs;
  return elapsedMs >= 0 && elapsedMs < tripEndedNoticeWindowMs;
}

export function createSyntheticTripChat(tripId: string, counterpartyName = "林师傅"): TripChatModel {
  return {
    tripId,
    counterpartyName,
    state: "open",
    closesAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    messages: [
      {
        id: "welcome",
        sender: "counterparty",
        text: "您好，我正在前往上车点。",
        sentAt: new Date().toISOString(),
        deliveryState: "sent",
        synthetic: true,
      },
    ],
    synthetic: true,
  };
}

export function appendSyntheticMessage(chat: TripChatModel, text: string): TripChatModel {
  if (chat.state !== "open" || !text.trim()) return chat;
  return {
    ...chat,
    messages: [
      ...chat.messages,
      {
        id: `local-${chat.messages.length + 1}`,
        sender: "self",
        text: text.trim(),
        sentAt: new Date().toISOString(),
        deliveryState: "sent",
        synthetic: true,
      },
    ],
  };
}
