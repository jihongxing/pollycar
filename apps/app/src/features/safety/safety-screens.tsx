import type { SafetyCaseView } from "@pollycar/contracts";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { useSafetyCase } from "../../application/safety-case-context";
import { useSyntheticTrip } from "../../application/synthetic-trip-context";
import {
  AppV2ContactPolicy,
  AppV2EmptyState,
  AppV2MessageBubble,
  AppV2ReadinessList,
  AppV2StageHeader,
  AppV2SummaryList,
  AppV2TripContext,
} from "../../components/app-v2-components";
import {
  AuxiliaryInlineFeedback,
  AuxiliaryState,
} from "../../components/auxiliary-page";
import { MobilityPage } from "../../components/mobility";
import { AppText, PrimaryButton } from "../../components/ui";
import { useIdentity } from "../../identity/identity-context";
import { useInteraction } from "../../interaction/interaction-context";
import { useAppTheme } from "../../theme/theme-context";
import {
  TripContactComposer,
  TripContactHeader,
} from "../chat/trip-contact-components";
import type { AppScreen } from "../vehicle-review/screens";

type Navigate = (screen: AppScreen) => void;

export function SafetyChatScreen({ navigate }: { navigate: Navigate }) {
  const journey = useSafetyJourney();
  const { actions, runAction } = useInteraction();
  const { theme } = useAppTheme();
  const [text, setText] = useState("");
  const chat = journey.dashboard?.chat;

  useEffect(() => {
    if (chat?.state === "frozen") navigate("safety-frozen");
  }, [chat?.state, navigate]);

  if (!journey.trip || !journey.tripId) {
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
          description="行程开始后，这里会开放本次行程的临时联系。"
          action={{ label: "返回消息", onPress: () => navigate("message-center") }}
          tone={journey.tone}
        />
      </MobilityPage>
    );
  }

  const send = async (value = text) => {
    const body = value.trim();
    if (!body || chat?.state !== "open") return;
    if (await runAction(
      "safety.message",
      () => journey.sendMessage(journey.tripId!, body),
    )) setText("");
  };

  return (
    <MobilityPage
      accessibilityLabel="行程联系"
      title="行程联系"
      onBack={() => navigate(journey.activeIdentity === "owner" ? "driver-trip" : "trip-chat")}
      tone={journey.tone}
      hero={
        <TripContactHeader
          counterpartyName={journey.counterpartyName}
          status={
            chat?.state === "frozen"
              ? "联系已暂停"
              : chat?.state === "open"
                ? "本次行程临时会话"
                : "等待会话开放"
          }
          contextIcon={journey.activeIdentity === "owner" ? "people" : "car"}
          contextTitle={journey.contextTitle}
          contextDescription={journey.routeLabel}
          policy="仅用于上车、到达和行程异常沟通 · 行程结束后开放 72 小时"
          tone={journey.tone}
          onSafetyPress={() => navigate("safety-report")}
        />
      }
      actions={
        chat?.state === "open" ? (
          <TripContactComposer
            text={text}
            onChangeText={setText}
            loading={actions["safety.message"] === "running"}
            quickReplies={["我已到达", "请确认当前位置"]}
            tone={journey.tone}
            onSubmit={(value) => void send(value)}
          />
        ) : undefined
      }
    >
      {journey.loading && !chat ? (
        <AuxiliaryState
          icon="messages"
          title="正在加载行程消息"
          description="请稍候，当前行程上下文会保持不变。"
          tone={journey.tone === "driver" ? "driver" : "passenger"}
        />
      ) : journey.error && !chat ? (
        <AuxiliaryState
          icon="messages"
          title="暂时无法读取行程消息"
          description="请检查网络后重试，已经发送的消息不会重复提交。"
          action={{ label: "重新加载", onPress: () => void journey.reload() }}
          tone="danger"
        />
      ) : chat ? (
        <>
          <View style={{ gap: theme.spacing.sm }}>
            {chat.messages.length > 0 ? (
              chat.messages.map((message) => (
                <AppV2MessageBubble
                  key={message.messageId}
                  body={message.body}
                  meta={formatMessageTime(message.sentAt)}
                  self={message.senderAccountId === "synthetic-account-7"}
                />
              ))
            ) : (
              <AppV2EmptyState
                icon="messages"
                title="还没有行程消息"
                description="可以发送到达、位置或行程异常相关信息。"
                tone={journey.tone}
              />
            )}
          </View>
          <AppV2ContactPolicy showLostItemAdvice={false} />
        </>
      ) : null}
    </MobilityPage>
  );
}

export function SafetyReportScreen({ navigate }: { navigate: Navigate }) {
  const journey = useSafetyJourney();
  const { actions, runAction, confirm } = useInteraction();

  if (!journey.trip || !journey.tripId) {
    return (
      <MobilityPage
        accessibilityLabel="报告安全问题"
        title="报告安全问题"
        onBack={() => navigate("message-center")}
        tone="neutral"
      >
        <AppV2EmptyState
          icon="safety"
          title="当前没有可以报告的行程"
          description="请从对应行程或行程联系中重新进入。"
          action={{ label: "返回消息", onPress: () => navigate("message-center") }}
          tone="safety"
        />
      </MobilityPage>
    );
  }

  const submit = async () => {
    if (!await confirm({
      title: "确认报告安全问题？",
      message: "提交后，本次行程和联系会立即暂停，直到安全处理完成。",
      confirmLabel: "确认提交",
      destructive: true,
    })) return;
    if (await runAction(
      "safety.report",
      () => journey.report(journey.tripId!),
    )) navigate("safety-frozen");
  };

  return (
    <MobilityPage
      accessibilityLabel="报告安全问题"
      title="报告安全问题"
      onBack={() => navigate("trip-chat")}
      tone="neutral"
      actions={
        <>
          <PrimaryButton
            label="确认报告并暂停行程"
            variant="danger"
            loading={actions["safety.report"] === "running"}
            loadingLabel="正在提交报告"
            disabled={actions["safety.report"] === "running"}
            onPress={() => void submit()}
          />
          <PrimaryButton label="暂不提交" variant="text" onPress={() => navigate("trip-chat")} />
        </>
      }
    >
      <AppV2StageHeader
        eyebrow="行程安全"
        title="先暂停，再由安全团队处理"
        description="如果当前行程让你感到不安全，可以立即停止行程和联系。"
        tone="safety"
      />
      <AppV2TripContext
        icon="route"
        title={journey.contextTitle}
        description={journey.routeLabel}
      />
      <AppV2ReadinessList
        tone="safety"
        items={[
          {
            icon: "route",
            title: "暂停当前行程",
            description: "提交后双方都不能继续本次履约",
            status: "current",
          },
          {
            icon: "messages",
            title: "停止行程联系",
            description: "会话立即停止发送新消息",
            status: "current",
          },
          {
            icon: "safety",
            title: "等待安全处理",
            description: "处理完成后会显示恢复或继续限制的结果",
            status: "pending",
          },
        ]}
      />
      <AuxiliaryInlineFeedback
        icon="safety"
        title="提交后不会自动恢复"
        description="如果你是被报告的一方且符合条件，可以在暂停后提交一次申诉说明。"
        tone="neutral"
      />
    </MobilityPage>
  );
}

export function SafetyFrozenScreen({ navigate }: { navigate: Navigate }) {
  const journey = useSafetyJourney();
  const { actions, runAction } = useInteraction();
  const safetyCase = journey.dashboard?.safetyCase;

  useEffect(() => {
    if (safetyCase?.state === "restored" || safetyCase?.state === "upheld") {
      navigate("safety-result");
    }
  }, [navigate, safetyCase?.state]);

  const canAppeal =
    safetyCase?.state === "open_frozen" &&
    safetyCase.reportedAccountId === "synthetic-account-7";

  return (
    <MobilityPage
      accessibilityLabel="安全处理进展"
      title="安全处理进展"
      onBack={() => navigate("message-center")}
      tone="neutral"
      actions={
        safetyCase ? (
          <>
            {canAppeal ? (
              <PrimaryButton
                label="补充一次申诉说明"
                onPress={() => navigate("safety-appeal")}
              />
            ) : null}
            <PrimaryButton
              label="查看最新进展"
              variant={canAppeal ? "secondary" : "primary"}
              loading={actions["safety.refresh"] === "running"}
              loadingLabel="正在更新"
              onPress={() => void runAction("safety.refresh", journey.reload)}
            />
            <PrimaryButton
              label="返回消息"
              variant="text"
              onPress={() => navigate("message-center")}
            />
          </>
        ) : undefined
      }
    >
      <AppV2StageHeader
        eyebrow="行程安全"
        title={safetyCase?.state === "appealing" ? "申诉正在处理中" : "行程和联系已暂停"}
        description={
          safetyCase?.state === "appealing"
            ? "暂停不会因提交申诉自动解除，结果更新后会显示下一步。"
            : "暂停期间不能继续本次行程或发送消息。"
        }
        tone="safety"
      />
      {journey.trip ? (
        <AppV2TripContext
          icon="route"
          title={journey.contextTitle}
          description={journey.routeLabel}
        />
      ) : null}
      {journey.loading && !safetyCase ? (
        <AuxiliaryState
          icon="clock"
          title="正在读取处理进展"
          description="请稍候，已经完成的操作不会重复提交。"
          tone="neutral"
        />
      ) : journey.error && !safetyCase ? (
        <AuxiliaryState
          icon="safety"
          title="暂时无法读取处理进展"
          description="请检查网络后重新加载。"
          action={{ label: "重新加载", onPress: () => void journey.reload() }}
          tone="danger"
        />
      ) : safetyCase ? (
        <>
          <SafetyCaseSummary safetyCase={safetyCase} />
          <AppV2ReadinessList
            tone="safety"
            items={[
              {
                icon: "safety",
                title: "行程与联系已暂停",
                description: "双方当前都不能继续本次履约",
                status: "ready",
              },
              {
                icon: "clock",
                title: safetyCase.state === "appealing" ? "正在处理申诉" : "正在进行安全处理",
                description: "结果更新前无需重复提交",
                status: "current",
              },
              {
                icon: "route",
                title: "等待处理结果",
                description: "完成后会显示可以恢复的能力和下一步",
                status: "pending",
              },
            ]}
          />
          <AuxiliaryInlineFeedback
            icon={canAppeal ? "account" : "clock"}
            title={canAppeal ? "可以补充一次申诉说明" : "当前无需重复操作"}
            description={
              canAppeal
                ? "申诉用于补充可能缺失的行程背景，但不会自动解除暂停。"
                : "请等待处理结果；状态变化后会在消息中心显示。"
            }
            tone="neutral"
          />
        </>
      ) : (
        <AppV2EmptyState
          icon="safety"
          title="当前没有待处理的安全事项"
          description="可以返回消息中心查看其他服务动态。"
          action={{ label: "返回消息", onPress: () => navigate("message-center") }}
          tone="neutral"
        />
      )}
    </MobilityPage>
  );
}

export function SafetyAppealScreen({ navigate }: { navigate: Navigate }) {
  const journey = useSafetyJourney();
  const { actions, runAction, confirm } = useInteraction();
  const safetyCase = journey.dashboard?.safetyCase;
  const canAppeal =
    safetyCase?.state === "open_frozen" &&
    safetyCase.reportedAccountId === "synthetic-account-7";

  const submit = async () => {
    if (!await confirm({
      title: "确认提交申诉说明？",
      message: "每个安全事项只能提交一次申诉。提交后仍会保持暂停，直到处理完成。",
      confirmLabel: "确认提交",
    })) return;
    if (await runAction(
      "safety.appeal",
      journey.appeal,
    )) navigate("safety-frozen");
  };

  return (
    <MobilityPage
      accessibilityLabel="安全申诉说明"
      title="安全申诉说明"
      onBack={() => navigate("safety-frozen")}
      tone="neutral"
      actions={
        canAppeal ? (
          <>
            <PrimaryButton
              label="提交申诉说明"
              loading={actions["safety.appeal"] === "running"}
              loadingLabel="正在提交"
              disabled={actions["safety.appeal"] === "running"}
              onPress={() => void submit()}
            />
            <PrimaryButton
              label="返回处理进展"
              variant="text"
              onPress={() => navigate("safety-frozen")}
            />
          </>
        ) : undefined
      }
    >
      <AppV2StageHeader
        eyebrow="行程安全"
        title={canAppeal ? "补充可能缺失的行程背景" : "当前不能再次提交申诉"}
        description={
          canAppeal
            ? "申诉会交由安全团队结合当前记录处理，不会自动恢复行程。"
            : "申诉可能已经提交，或当前安全事项不需要由你补充说明。"
        }
        tone="safety"
      />
      {journey.trip ? (
        <AppV2TripContext
          icon="route"
          title={journey.contextTitle}
          description={journey.routeLabel}
        />
      ) : null}
      {safetyCase ? <SafetyCaseSummary safetyCase={safetyCase} /> : null}
      {canAppeal ? (
        <>
          <AppV2SummaryList
            items={[
              { label: "申诉用途", value: "补充行程背景", emphasized: true },
              { label: "提交次数", value: "仅一次" },
              { label: "提交后", value: "继续保持暂停" },
            ]}
          />
          <AuxiliaryInlineFeedback
            icon="privacy"
            title="当前不会上传图片或聊天记录"
            description="本次只提交固定的背景补充说明，不会采集新的真实材料。"
            tone="neutral"
          />
        </>
      ) : (
        <AuxiliaryState
          icon="safety"
          title="请返回查看处理进展"
          description="结果更新后会显示可以恢复的能力和下一步。"
          action={{ label: "返回进展", onPress: () => navigate("safety-frozen") }}
          tone="neutral"
        />
      )}
    </MobilityPage>
  );
}

export function SafetyResultScreen({ navigate }: { navigate: Navigate }) {
  const journey = useSafetyJourney();
  const safetyCase = journey.dashboard?.safetyCase;
  const finalState =
    safetyCase?.state === "restored" || safetyCase?.state === "upheld";
  const restored = safetyCase?.state === "restored";

  return (
    <MobilityPage
      accessibilityLabel="安全处理结果"
      title="安全处理结果"
      onBack={() => navigate("message-center")}
      tone="neutral"
      actions={
        finalState ? (
          <>
            <PrimaryButton
              label={
                restored
                  ? journey.activeIdentity === "owner"
                    ? "返回车主首页"
                    : "查看行程"
                  : "返回我的"
              }
              onPress={() =>
                navigate(
                  restored
                    ? journey.activeIdentity === "owner"
                      ? "owner-workbench"
                      : "ride-detail"
                    : "account",
                )
              }
            />
            <PrimaryButton
              label="返回消息"
              variant="text"
              onPress={() => navigate("message-center")}
            />
          </>
        ) : undefined
      }
    >
      <AppV2StageHeader
        eyebrow="行程安全"
        title={
          finalState
            ? restored
              ? "相关使用能力已恢复"
              : "本次限制继续保持"
            : "正在读取处理结果"
        }
        description={
          finalState
            ? restored
              ? "可以返回对应身份继续查看当前行程与账户状态。"
              : "当前仍不能继续被冻结的行程或发送相关消息。"
            : "请稍候，完成后会显示下一步。"
        }
        tone={restored ? "passenger" : "safety"}
      />
      {journey.trip ? (
        <AppV2TripContext
          icon="route"
          title={journey.contextTitle}
          description={journey.routeLabel}
        />
      ) : null}
      {journey.error && !safetyCase ? (
        <AuxiliaryState
          icon="safety"
          title="暂时无法读取处理结果"
          description="请检查网络后重试。"
          action={{ label: "重新加载", onPress: () => void journey.reload() }}
          tone="danger"
        />
      ) : finalState && safetyCase ? (
        <>
          <SafetyCaseSummary safetyCase={safetyCase} />
          <AppV2ReadinessList
            tone={restored ? "passenger" : "safety"}
            items={
              restored
                ? [
                    {
                      icon: "account",
                      title: "账户访问已恢复",
                      description: "可以继续查看对应身份下的产品功能",
                      status: "ready",
                    },
                    {
                      icon: "messages",
                      title: "联系状态已更新",
                      description: "是否仍可发送消息以当前行程页面为准",
                      status: "ready",
                    },
                    {
                      icon: "route",
                      title: "返回查看行程",
                      description: "继续前会重新确认当前行程状态",
                      status: "current",
                    },
                  ]
                : [
                    {
                      icon: "safety",
                      title: "安全处理已完成",
                      description: "本次暂停决定继续保持",
                      status: "ready",
                    },
                    {
                      icon: "route",
                      title: "行程仍不可继续",
                      description: "不能恢复被冻结的履约操作",
                      status: "current",
                    },
                    {
                      icon: "messages",
                      title: "相关联系仍不可用",
                      description: "可以返回消息中心查看其他服务动态",
                      status: "current",
                    },
                  ]
            }
          />
          <AuxiliaryInlineFeedback
            icon={restored ? "account" : "safety"}
            title={restored ? "继续前会重新确认当前状态" : "其他账户功能不受此页面直接改变"}
            description={
              restored
                ? "恢复结果不会绕过行程、资格或安全检查。"
                : "如有新的服务动态，会在消息中心显示。"
            }
            tone="neutral"
          />
        </>
      ) : (
        <AuxiliaryState
          icon="clock"
          title="处理结果尚未完成"
          description="可以返回处理进展页查看当前状态。"
          action={{ label: "查看处理进展", onPress: () => navigate("safety-frozen") }}
          tone="neutral"
        />
      )}
    </MobilityPage>
  );
}

function SafetyCaseSummary({ safetyCase }: { safetyCase: SafetyCaseView }) {
  return (
    <AppV2SummaryList
      items={[
        {
          label: "当前进展",
          value: caseStateLabels[safetyCase.state],
          emphasized: true,
        },
        { label: "报告时间", value: formatSafetyDate(safetyCase.createdAt) },
        ...(safetyCase.resolvedAt
          ? [{ label: "结果更新时间", value: formatSafetyDate(safetyCase.resolvedAt) }]
          : []),
      ]}
    />
  );
}

function useSafetyJourney() {
  const { dashboard: tripDashboard } = useSyntheticTrip();
  const {
    dashboard,
    activeTripId,
    loading,
    error,
    load,
    sendMessage,
    report,
    appeal,
  } = useSafetyCase();
  const { activeIdentity } = useIdentity();
  const trip = tripDashboard.activeDriverTrip ?? tripDashboard.passengerTrip;
  const tripId = activeTripId ?? trip?.tripId;
  const loadedTripId = dashboard?.safetyCase?.tripId ?? dashboard?.chat?.tripId;

  useEffect(() => {
    if (tripId && loadedTripId !== tripId) {
      void load(tripId).catch(() => undefined);
    }
  }, [load, loadedTripId, tripId]);

  const counterpartyName =
    activeIdentity === "owner"
      ? trip?.passengerProfile?.displayName ?? "乘车人"
      : trip?.driverProfile?.displayName ?? "车主";
  const contextTitle =
    activeIdentity === "owner"
      ? `${trip?.passengerCount ?? 1} 位乘车人`
      : trip?.vehicle
        ? `${trip.vehicle.color} ${trip.vehicle.make}${trip.vehicle.model}`
        : "本次行程";
  const routeLabel = trip
    ? `${trip.originLabel} → ${trip.destinationLabel}`
    : "当前行程";

  return {
    dashboard,
    trip,
    tripId,
    loading,
    error,
    activeIdentity,
    counterpartyName,
    contextTitle,
    routeLabel,
    tone: activeIdentity === "owner" ? "driver" as const : "passenger" as const,
    reload: async () => {
      if (tripId) await load(tripId);
    },
    sendMessage,
    report,
    appeal,
  };
}

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function formatSafetyDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

const caseStateLabels: Record<SafetyCaseView["state"], string> = {
  open_frozen: "等待安全处理",
  appealing: "申诉处理中",
  restored: "相关能力已恢复",
  upheld: "继续保持限制",
};
