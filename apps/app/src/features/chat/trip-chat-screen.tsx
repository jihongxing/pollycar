import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useCommunication } from "../../application/communication-context";
import { useSyntheticTrip } from "../../application/synthetic-trip-context";
import {
  AppV2ContactPolicy,
  AppV2EmptyState,
  AppV2MessageBubble,
  AppV2StatusPanel,
} from "../../components/app-v2-components";
import { MobilityPage } from "../../components/mobility";
import { AppText, PrimaryButton } from "../../components/ui";
import { useIdentity } from "../../identity/identity-context";
import { useAppTheme } from "../../theme/theme-context";
import { consumeMessageCenterTrip } from "../messages/message-center-navigation";
import {
  shouldShowTripEndedNotice,
  tripEndedNoticeWindowMs,
} from "./trip-chat-model";
import {
  TripContactComposer,
  TripContactHeader,
} from "./trip-contact-components";

export function TripChatScreen({ navigate }: { navigate: (route: string) => void }) {
  const { dashboard } = useSyntheticTrip();
  const [messageCenterTripId] = useState(consumeMessageCenterTrip);
  const {
    chat,
    loading,
    error,
    loadChat,
    sendMessage,
    requestChatDeletion,
    currentAccountId,
  } = useCommunication();
  const { activeIdentity } = useIdentity();
  const { theme } = useAppTheme();
  const trip =
    dashboard.passengerTrips?.find(
      (item) => item.tripId === messageCenterTripId,
    ) ??
    dashboard.passengerTrip ??
    dashboard.activeDriverTrip;
  const [text, setText] = useState("");
  const [noticeNowMs, setNoticeNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (trip?.tripId && currentAccountId) void loadChat(trip.tripId);
  }, [currentAccountId, loadChat, trip?.tripId]);

  useEffect(() => {
    const nowMs = Date.now();
    setNoticeNowMs(nowMs);
    if (!trip?.completedAt) return;
    const completedAtMs = new Date(trip.completedAt).getTime();
    if (!Number.isFinite(completedAtMs)) return;
    const remainingMs = completedAtMs + tripEndedNoticeWindowMs - nowMs;
    if (remainingMs <= 0) return;
    const timeoutId = setTimeout(() => setNoticeNowMs(Date.now()), remainingMs + 50);
    return () => clearTimeout(timeoutId);
  }, [trip?.completedAt]);

  const selfAccountId =
    activeIdentity === "owner" ? trip?.driverAccountId : trip?.passengerAccountId;
  const counterparty = useMemo(
    () => chat?.participants.find((participant) => participant.accountId !== selfAccountId),
    [chat?.participants, selfAccountId],
  );
  const counterpartyName =
    counterparty?.displayName ??
    (activeIdentity === "owner"
      ? trip?.passengerProfile?.displayName
      : trip?.driverProfile?.displayName) ??
    "行程联系人";
  const submit = async (value = text) => {
    if (!trip?.tripId || !value.trim() || chat?.state !== "open") return;
    await sendMessage(trip.tripId, value.trim());
    setText("");
  };

  if (!trip) {
    return (
      <MobilityPage
        accessibilityLabel="行程联系"
        title="行程联系"
        onBack={() => navigate("message-center")}
        tone="neutral"
      >
        <AppV2EmptyState
          icon="messages"
          title="当前没有可联系的行程"
          description={
            activeIdentity === "owner"
              ? "接单后，这里会开放本次行程的临时联系。"
              : "车主接单后，这里会开放本次行程的临时联系。"
          }
          action={{ label: "返回消息", onPress: () => navigate("message-center") }}
          tone={activeIdentity === "owner" ? "driver" : "passenger"}
        />
      </MobilityPage>
    );
  }

  const chatOpen = chat?.state === "open";
  const frozen = chat?.state === "frozen";
  const tripEnded = trip.state === "completed" || trip.state === "cancelled";
  const vehicleLabel = trip.vehicle
    ? `${trip.vehicle.color} ${trip.vehicle.make}${trip.vehicle.model} · ${trip.vehicle.licensePlate}`
    : "本次行程";
  const routeLabel =
    activeIdentity === "owner"
      ? `${trip.passengerCount} 位乘车人 · 前往 ${trip.destinationLabel}`
      : `${trip.originLabel} → ${trip.destinationLabel}`;
  const showTripEndedNotice = shouldShowTripEndedNotice({
    activeIdentity,
    tripState: trip.state,
    chatState: chat?.state,
    completedAt: trip.completedAt,
    nowMs: noticeNowMs,
  });

  return (
    <MobilityPage
      accessibilityLabel="行程联系"
      title="行程联系"
      onBack={() => navigate("message-center")}
      tone={activeIdentity === "owner" ? "driver" : "passenger"}
      hero={
        <TripContactHeader
          counterpartyName={counterpartyName}
          status={
            frozen
              ? "联系已暂停"
              : chatOpen
                ? "本次行程临时会话"
                : tripEnded
                  ? "会话已结束"
                  : "等待会话开放"
          }
          contextIcon={activeIdentity === "owner" ? "people" : "car"}
          contextTitle={activeIdentity === "owner" ? counterpartyName : vehicleLabel}
          contextDescription={routeLabel}
          policy={
            showTripEndedNotice
              ? undefined
              : "仅用于上车、到达和行程异常沟通 · 行程结束后开放 72 小时"
          }
          tone={activeIdentity === "owner" ? "driver" : "passenger"}
          onSafetyPress={() => navigate("safety-report")}
        />
      }
      actions={
        chatOpen ? (
          <TripContactComposer
            text={text}
            onChangeText={setText}
            loading={loading}
            quickReplies={chat?.quickReplies ?? []}
            tone={activeIdentity === "owner" ? "driver" : "passenger"}
            onSubmit={(value) => void submit(value)}
          />
        ) : undefined
      }
    >
      {loading && !chat ? (
        <AppV2StatusPanel
          title="正在加载行程消息"
          description="请稍候，当前输入和行程上下文会保持不变。"
          tone={activeIdentity === "owner" ? "driver" : "passenger"}
        />
      ) : error ? (
        <AppV2StatusPanel
          title="暂时无法打开行程联系"
          description="请检查网络后重试，已发送的消息不会自动重复提交。"
          action={{ label: "重新加载", onPress: () => void loadChat(trip.tripId) }}
          tone="safety"
        />
      ) : (
        <>
          <AppText size="caption" tone="secondary" style={{ textAlign: "center" }}>
            {chat?.openedAt ? formatChatDate(chat.openedAt) : "本次行程"}
          </AppText>
          <View style={{ gap: theme.spacing.sm }}>
            {(chat?.messages ?? []).map((message) => {
              const self =
                message.senderAccountId === selfAccountId ||
                message.senderAccountId === currentAccountId;
              return (
                <AppV2MessageBubble
                  key={message.messageId}
                  body={message.body}
                  self={self}
                  failed={message.deliveryState === "failed"}
                  meta={`${formatMessageTime(message.sentAt)}${self ? ` · ${deliveryLabel(message.deliveryState)}` : ""}`}
                />
              );
            })}
            {showTripEndedNotice ? (
              <AppV2ContactPolicy showLostItemAdvice />
            ) : null}
            {!chat?.messages.length && !showTripEndedNotice ? (
              <AppV2EmptyState
                icon="messages"
                title="还没有消息"
                description={
                  chatOpen
                    ? "可以发送上车位置或到达情况。"
                    : activeIdentity === "owner"
                      ? "接受行程后，可以在这里联系乘车人。"
                      : "车主接单后，可以在这里沟通上车位置和到达情况。"
                }
                tone={activeIdentity === "owner" ? "driver" : "passenger"}
              />
            ) : null}
          </View>
          {!chatOpen && !frozen ? (
            <AppV2StatusPanel
              title={tripEnded ? "本次行程联系已按 72 小时窗口关闭" : "当前尚未开放行程联系"}
              description={
                tripEnded
                  ? "行程记录仍可在“我的行程”中查看。"
                  : activeIdentity === "owner"
                    ? "接受行程后，会开放本次行程的临时联系。"
                    : "车主接单后，会开放本次行程的临时联系。"
              }
            />
          ) : null}
          {frozen ? (
            <AppV2StatusPanel
              tone="safety"
              title="行程联系已暂停"
              description="当前行程正在处理安全问题。如需帮助，请使用安全入口。"
            />
          ) : null}
          {chat?.retention.evidenceHold ? (
            <View style={{ gap: theme.spacing.xs }}>
              <AppText weight="bold">消息暂不能删除</AppText>
              <AppText size="small" tone="secondary">
                当前行程消息因安全证据保留暂不能删除。保留解除后仍按期限处理。
              </AppText>
              <PrimaryButton label="安全证据保留中" variant="secondary" disabled onPress={() => undefined} />
            </View>
          ) : chat?.retention.deletionState === "eligible" ? (
            <View style={{ gap: theme.spacing.xs }}>
              <AppText weight="bold">行程消息可以删除</AppText>
              <AppText size="small" tone="secondary">
                {chat.retention.contentDeleteAfter
                  ? `行程消息正文计划在 ${chat.retention.contentDeleteAfter.slice(0, 10)} 后删除，仅保留最小记录。`
                  : "本次行程已经结束，可以删除消息正文。"}
              </AppText>
              <PrimaryButton
                label="删除行程消息正文"
                variant="secondary"
                disabled={loading}
                onPress={() => void requestChatDeletion(chat.tripId)}
              />
            </View>
          ) : null}
        </>
      )}
    </MobilityPage>
  );
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

function deliveryLabel(state: "sent" | "failed" | "unknown"): string {
  return {
    sent: "已发送",
    failed: "发送失败",
    unknown: "确认中",
  }[state];
}
