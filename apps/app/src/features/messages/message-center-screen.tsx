import type {
  MessageCenterItem,
  SyntheticTripView,
  TripChatView,
} from "@pollycar/contracts";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

import { useCommunication } from "../../application/communication-context";
import { useSyntheticTrip } from "../../application/synthetic-trip-context";
import { type AppIconName } from "../../components/app-icon";
import {
  AppV2ContactPolicy,
  AppV2EmptyState,
  AppV2MessageBubble,
  AppV2MessageRow,
  AppV2SectionHeader,
  AppV2StageHeader,
  AppV2StatusPanel,
  AppV2SummaryList,
  AppV2TripContext,
} from "../../components/app-v2-components";
import { AppText, PrimaryButton, SandboxIndicator } from "../../components/ui";
import { useIdentity } from "../../identity/identity-context";
import { useAppTheme } from "../../theme/theme-context";
import { TripContactComposer } from "../chat/trip-contact-components";
import {
  rememberMessageCenterDetail,
  rememberMessageCenterTrip,
} from "./message-center-navigation";
import {
  buildMessageCenterFeed,
  type TripConversationRecord,
} from "./message-center-model";

export function MessageCenterScreen({
  navigate,
}: {
  navigate: (route: string) => void;
}) {
  const {
    chat,
    center,
    loading,
    error,
    loadChat,
    loadCenter,
    sendMessage,
    markRead,
    markAllRead,
    resolveTarget,
    currentAccountId,
  } = useCommunication();
  const { dashboard, selectPassengerTripForDetail } = useSyntheticTrip();
  const { activeIdentity } = useIdentity();
  const { width } = useWindowDimensions();
  const { theme } = useAppTheme();
  const [text, setText] = useState("");
  const markedCurrentConversationRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (currentAccountId) void loadCenter();
  }, [currentAccountId, loadCenter]);

  const feed = useMemo(
    () => buildMessageCenterFeed(center?.items ?? []),
    [center?.items],
  );
  const currentTrip =
    activeIdentity === "owner"
      ? dashboard.activeDriverTrip
      : dashboard.passengerTrip;
  const currentConversation = currentTrip
    ? feed.conversations.find(
        (conversation) => conversation.tripId === currentTrip.tripId,
      )
    : undefined;
  const showCurrentConversation = currentTrip
    ? Boolean(currentConversation) || supportsTripContact(currentTrip)
    : false;
  const recentConversations = feed.conversations.filter(
    (conversation) => conversation.tripId !== currentTrip?.tripId,
  );
  const currentChat =
    chat?.tripId === currentTrip?.tripId ? chat : undefined;

  useEffect(() => {
    if (
      currentTrip?.tripId &&
      currentAccountId &&
      showCurrentConversation
    ) {
      void loadChat(currentTrip.tripId);
    }
  }, [
    currentAccountId,
    currentTrip?.tripId,
    loadChat,
    showCurrentConversation,
  ]);

  useEffect(() => {
    if (
      !currentConversation?.unreadCount ||
      !currentChat ||
      markedCurrentConversationRef.current === currentConversation.tripId
    ) {
      return;
    }
    markedCurrentConversationRef.current = currentConversation.tripId;
    void markItemsRead(currentConversation.items, markRead);
  }, [currentChat, currentConversation, markRead]);

  const openNotification = (item: MessageCenterItem) => {
    if (!item.readAt) void markRead(item.itemId);
    if (item.target.kind === "trip") {
      selectPassengerTripForDetail(item.target.tripId, "message");
    }
    const target = resolveTarget(item.target);
    if (target === "vehicle-settings" || target === "eligibility-settings") {
      rememberMessageCenterDetail(target);
    }
    navigate(target);
  };

  const openConversation = async (conversation: TripConversationRecord) => {
    await markItemsRead(conversation.items, markRead);
    rememberMessageCenterTrip(conversation.tripId);
    navigate("trip-chat");
  };

  const submitCurrentMessage = async (value = text) => {
    const body = value.trim();
    if (!currentTrip?.tripId || !body || currentChat?.state !== "open") {
      return;
    }
    await sendMessage(currentTrip.tripId, body);
    setText("");
  };

  const empty =
    !showCurrentConversation &&
    recentConversations.length === 0 &&
    feed.notifications.length === 0;

  return (
    <SafeAreaView
      style={{
        flex: 1,
        alignItems: "center",
        backgroundColor: theme.colors.background,
      }}
    >
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: width >= 768 ? 640 : undefined,
          borderRightWidth: width >= 768 ? StyleSheet.hairlineWidth : 0,
          borderLeftWidth: width >= 768 ? StyleSheet.hairlineWidth : 0,
          borderColor: theme.colors.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            minHeight: 116,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: theme.spacing.md,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.border,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            backgroundColor: theme.colors.surface,
          }}
        >
          <AppV2StageHeader
            eyebrow="消息"
            title="行程联系与服务更新"
            description={
              feed.unreadCount > 0
                ? `${feed.unreadCount} 条未读消息`
                : "行程记录和通知均已阅读"
            }
            tone={activeIdentity === "owner" ? "driver" : "passenger"}
          />
          <PrimaryButton
            label="全部已读"
            variant="text"
            disabled={!feed.unreadCount || loading}
            onPress={() => void markAllRead()}
          />
        </View>

        <ScrollView
          contentContainerStyle={{
            gap: theme.spacing.xl,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            paddingBottom: 120,
          }}
        >
          {loading && !center ? (
            <AppV2StatusPanel
              title="正在加载消息"
              description="请稍候，正在整理行程联系和服务更新。"
              tone={activeIdentity === "owner" ? "driver" : "passenger"}
            />
          ) : error && !center ? (
            <AppV2StatusPanel
              title="暂时无法加载消息"
              description="请检查网络后重试，已经阅读的消息不会恢复为未读。"
              action={{ label: "重新加载", onPress: () => void loadCenter() }}
              tone="safety"
            />
          ) : empty ? (
            <AppV2EmptyState
              icon="messages"
              title="还没有消息"
              description="行程联系和重要的服务更新会显示在这里。"
              tone={activeIdentity === "owner" ? "driver" : "passenger"}
            />
          ) : (
            <>
              {showCurrentConversation && currentTrip ? (
                <CurrentTripConversation
                  trip={currentTrip}
                  conversation={currentConversation}
                  chat={currentChat}
                  loading={loading}
                  error={error}
                  currentAccountId={currentAccountId}
                  activeIdentity={activeIdentity}
                  text={text}
                  onChangeText={setText}
                  onSubmit={(value) => void submitCurrentMessage(value)}
                  onReload={() => void loadChat(currentTrip.tripId)}
                />
              ) : null}

              {recentConversations.length > 0 ? (
                <View style={{ gap: theme.spacing.md }}>
                  <AppV2SectionHeader
                    title="最近行程记录"
                    detail={`${recentConversations.length} 次`}
                  />
                  <MessageList>
                    {recentConversations.map((conversation) => {
                      const trip = findTrip(
                        conversation.tripId,
                        dashboard.passengerTrips,
                      );
                      return (
                        <AppV2MessageRow
                          key={conversation.tripId}
                          icon="route"
                          title={
                            trip
                              ? `${trip.originLabel} → ${trip.destinationLabel}`
                              : "历史行程联系"
                          }
                          description="查看完整聊天记录和行程状态节点"
                          meta={formatOccurredAt(conversation.latestAt)}
                          unread={conversation.unreadCount > 0}
                          tone={
                            activeIdentity === "owner" ? "driver" : "passenger"
                          }
                          onPress={() => void openConversation(conversation)}
                        />
                      );
                    })}
                  </MessageList>
                </View>
              ) : null}

              {feed.notifications.length > 0 ? (
                <View style={{ gap: theme.spacing.md }}>
                  <AppV2SectionHeader
                    title="通知"
                    detail={`${feed.notifications.length} 条`}
                  />
                  <MessageList>
                    {feed.notifications.map((item) => (
                      <NotificationRow
                        key={item.itemId}
                        item={item}
                        onPress={() => openNotification(item)}
                      />
                    ))}
                  </MessageList>
                </View>
              ) : null}
            </>
          )}

          <View style={{ alignItems: "center" }}>
            <SandboxIndicator />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function CurrentTripConversation({
  trip,
  conversation,
  chat,
  loading,
  error,
  currentAccountId,
  activeIdentity,
  text,
  onChangeText,
  onSubmit,
  onReload,
}: {
  trip: SyntheticTripView;
  conversation?: TripConversationRecord;
  chat?: TripChatView;
  loading: boolean;
  error?: string;
  currentAccountId: string;
  activeIdentity: "passenger" | "owner";
  text: string;
  onChangeText: (value: string) => void;
  onSubmit: (value?: string) => void;
  onReload: () => void;
}) {
  const { theme } = useAppTheme();
  const tone = activeIdentity === "owner" ? "driver" : "passenger";
  const counterpartyName =
    activeIdentity === "owner"
      ? trip.passengerProfile?.displayName ?? "本次乘车人"
      : trip.driverProfile?.displayName ?? "本次车主";
  const timeline = buildConversationTimeline(chat, conversation);
  const ended = trip.state === "completed" || trip.state === "cancelled";
  const frozen = chat?.state === "frozen" || trip.state === "safety_frozen";
  const open = chat?.state === "open";

  return (
    <View style={{ gap: theme.spacing.md }}>
      <AppV2SectionHeader
        title="当前行程联系"
        detail={
          conversation?.unreadCount
            ? `${conversation.unreadCount} 条未读`
            : undefined
        }
      />
      <View
        style={{
          gap: theme.spacing.md,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.large,
          padding: theme.spacing.md,
          backgroundColor: theme.colors.surface,
        }}
      >
        <AppV2TripContext
          icon={activeIdentity === "owner" ? "people" : "car"}
          title={`${trip.originLabel} → ${trip.destinationLabel}`}
          description={`${tripStatusLabel(trip.state)} · ${counterpartyName}`}
        />
        <AppV2SummaryList
          items={[
            {
              label: "当前联系阶段",
              value: contactPhaseLabel(chat, trip),
              emphasized: open,
            },
            {
              label: "会话窗口",
              value: contactWindowLabel(chat),
            },
          ]}
        />

        {loading && !chat ? (
          <AppV2StatusPanel
            title="正在加载完整聊天记录"
            description="请稍候，历史消息和行程节点会按时间顺序显示。"
            tone={tone}
          />
        ) : error && !chat ? (
          <AppV2StatusPanel
            title="暂时无法读取完整聊天记录"
            description="请检查网络后重试，已有记录不会因此删除。"
            action={{ label: "重新加载", onPress: onReload }}
            tone="safety"
          />
        ) : timeline.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            {chat?.openedAt ? (
              <AppText
                size="caption"
                tone="secondary"
                style={{ textAlign: "center" }}
              >
                {formatChatDate(chat.openedAt)}
              </AppText>
            ) : null}
            {timeline.map((entry) =>
              entry.kind === "message" ? (
                <AppV2MessageBubble
                  key={`message-${entry.message.messageId}`}
                  body={entry.message.body}
                  self={entry.message.senderAccountId === currentAccountId}
                  failed={entry.message.deliveryState === "failed"}
                  meta={`${formatMessageTime(entry.message.sentAt)}${
                    entry.message.senderAccountId === currentAccountId
                      ? ` · ${deliveryLabel(entry.message.deliveryState)}`
                      : ""
                  }`}
                />
              ) : (
                <View
                  key={`event-${entry.item.itemId}`}
                  style={[
                    styles.tripEvent,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceMuted,
                    },
                  ]}
                >
                  <AppText size="caption" tone="secondary">
                    {formatMessageTime(entry.item.occurredAt)}
                  </AppText>
                  <View style={{ flex: 1 }}>
                    <AppText size="small" weight="bold">
                      {entry.item.title}
                    </AppText>
                    <AppText size="caption" tone="secondary">
                      {entry.item.body}
                    </AppText>
                  </View>
                </View>
              ),
            )}
          </View>
        ) : (
          <AppV2EmptyState
            icon="messages"
            title="还没有聊天记录"
            description={
              open
                ? "可以发送上车位置、到达情况或本次行程需要确认的信息。"
                : "联系开放后，双方的完整聊天记录会显示在这里。"
            }
            tone={tone}
          />
        )}

        <AppV2ContactPolicy showLostItemAdvice={ended} />

        {open ? (
          <TripContactComposer
            text={text}
            onChangeText={onChangeText}
            loading={loading}
            quickReplies={chat?.quickReplies ?? []}
            tone={tone}
            onSubmit={onSubmit}
          />
        ) : frozen ? (
          <AppV2StatusPanel
            title="行程联系已暂停"
            description="当前不能继续发送消息，已有聊天记录仍可查看。"
            tone="safety"
          />
        ) : (
          <AppV2StatusPanel
            title={
              ended
                ? "本次行程会话已关闭"
                : "当前尚未开放行程联系"
            }
            description={
              ended
                ? "72 小时会话窗口结束后停止发送，已有记录按保留规则继续可见。"
                : "车主接受行程后，会开放本次行程的临时联系。"
            }
          />
        )}
      </View>
    </View>
  );
}

function NotificationRow({
  item,
  onPress,
}: {
  item: MessageCenterItem;
  onPress: () => void;
}) {
  return (
    <AppV2MessageRow
      icon={messageIcons[item.category]}
      title={item.title}
      description={item.body}
      meta={formatOccurredAt(item.occurredAt)}
      unread={!item.readAt}
      tone={item.category === "safety" ? "safety" : "neutral"}
      onPress={onPress}
    />
  );
}

function MessageList({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <View
      style={{
        overflow: "hidden",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.large,
        backgroundColor: theme.colors.surface,
      }}
    >
      {children}
    </View>
  );
}

type ConversationTimelineEntry =
  | Readonly<{
      kind: "message";
      occurredAt: string;
      message: TripChatView["messages"][number];
    }>
  | Readonly<{
      kind: "event";
      occurredAt: string;
      item: MessageCenterItem;
    }>;

function buildConversationTimeline(
  chat?: TripChatView,
  conversation?: TripConversationRecord,
): readonly ConversationTimelineEntry[] {
  return [
    ...(chat?.messages ?? []).map((message) => ({
      kind: "message" as const,
      occurredAt: message.sentAt,
      message,
    })),
    ...(conversation?.items ?? [])
      .filter((item) => item.category === "trip_service")
      .map((item) => ({
        kind: "event" as const,
        occurredAt: item.occurredAt,
        item,
      })),
  ].sort(
    (left, right) =>
      Date.parse(left.occurredAt) - Date.parse(right.occurredAt),
  );
}

async function markItemsRead(
  items: readonly MessageCenterItem[],
  markRead: (itemId: string) => Promise<void>,
): Promise<void> {
  for (const item of items) {
    if (!item.readAt) await markRead(item.itemId);
  }
}

function supportsTripContact(trip: SyntheticTripView): boolean {
  return [
    "accepted",
    "driver_en_route",
    "driver_arrived",
    "in_progress",
    "safety_frozen",
    "completed",
    "unfulfilled",
    "cancelled",
  ].includes(trip.state);
}

function findTrip(
  tripId: string,
  trips?: readonly SyntheticTripView[],
): SyntheticTripView | undefined {
  return trips?.find((trip) => trip.tripId === tripId);
}

function tripStatusLabel(state: SyntheticTripView["state"]): string {
  return {
    pending_payment: "等待确认",
    paid_pending_match: "等待车主",
    scheduled: "已预约",
    reserved: "已保留",
    preparing: "准备中",
    accepted: "车主已接受",
    driver_en_route: "车主前往中",
    driver_arrived: "车主已到达",
    in_progress: "行程进行中",
    safety_frozen: "安全暂停",
    completed: "行程已结束",
    unfulfilled: "行程未完成",
    cancelled: "行程已取消",
  }[state];
}

function contactPhaseLabel(
  chat: TripChatView | undefined,
  trip: SyntheticTripView,
): string {
  if (chat?.state === "frozen" || trip.state === "safety_frozen") {
    return "联系已暂停";
  }
  if (chat?.state === "open") return "可以继续联系";
  if (chat?.state === "scheduled") return "等待联系开放";
  return "只读历史记录";
}

function contactWindowLabel(chat?: TripChatView): string {
  if (!chat) return "行程结束后开放 72 小时";
  if (chat.state === "closed" || chat.state === "expired") return "已关闭";
  if (!chat.expiresAt) return "行程结束后开放 72 小时";
  const remainingMs = new Date(chat.expiresAt).getTime() - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return "即将关闭";
  const remainingHours = Math.ceil(remainingMs / 3_600_000);
  return remainingHours > 24
    ? `剩余 ${Math.ceil(remainingHours / 24)} 天`
    : `剩余 ${remainingHours} 小时`;
}

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function formatChatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function formatOccurredAt(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function deliveryLabel(
  state: TripChatView["messages"][number]["deliveryState"],
): string {
  return {
    sent: "已发送",
    failed: "发送失败",
    unknown: "确认中",
  }[state];
}

const messageIcons: Record<MessageCenterItem["category"], AppIconName> = {
  trip_chat: "messages",
  trip_service: "route",
  vehicle_review: "car",
  eligibility: "account",
  safety: "safety",
};

const styles = StyleSheet.create({
  tripEvent: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
  },
});
