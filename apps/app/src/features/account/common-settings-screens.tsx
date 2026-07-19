import { useState } from "react";
import { Share, TextInput, View } from "react-native";

import { useAdultEligibility } from "../../application/adult-eligibility-context";
import {
  AppV2ChoiceChip,
  AppV2FieldFrame,
  AppV2NavigationRow,
  AppV2PreferenceRow,
  AppV2StageHeader,
  AppV2StatusPanel,
} from "../../components/app-v2-components";
import { MobilityPage } from "../../components/mobility";
import { AppText, PrimaryButton } from "../../components/ui";
import { useInteraction } from "../../interaction/interaction-context";
import { useAppTheme } from "../../theme/theme-context";
import { consumeMessageCenterDetailReturn } from "../messages/message-center-navigation";
import type { AppScreen } from "../vehicle-review/screens";
import {
  readNotificationPreferences,
  writeNotificationPreferences,
  type NotificationPreferences,
} from "./notification-preferences";

type Navigate = (screen: AppScreen) => void;

export function NotificationSettingsScreen({ navigate }: { navigate: Navigate }) {
  const [preferences, setPreferences] = useState(readNotificationPreferences);
  const [returnScreen] = useState<AppScreen>(
    () => consumeMessageCenterDetailReturn("notification-settings") ?? "account",
  );
  const returnLabel =
    returnScreen === "message-center" ? "返回消息" : "返回我的账户";
  const update = (patch: Partial<NotificationPreferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    writeNotificationPreferences(next);
  };

  return (
    <MobilityPage
      title="通知设置"
      accessibilityLabel="账户通知设置"
      onBack={() => navigate(returnScreen)}
      actions={
        <PrimaryButton
          label={returnLabel}
          variant="text"
          onPress={() => navigate(returnScreen)}
        />
      }
    >
      <AppV2StageHeader
        eyebrow="账户 · 通知"
        title="只保留对你有用的更新"
        description="选择消息中心显示哪些非紧急通知；安全提醒和需要处理的状态始终保留。"
      />
      <AppV2PreferenceRow
        icon="route"
        title="行程进展"
        description="显示匹配、预约和行程结果等非紧急更新"
        enabled={preferences.tripUpdates}
        onChange={(enabled) => update({ tripUpdates: enabled })}
        tone="passenger"
      />
      <AppV2PreferenceRow
        icon="car"
        title="车主准备进展"
        description="显示车辆审核和参与资格的非紧急更新"
        enabled={preferences.ownerUpdates}
        onChange={(enabled) => update({ ownerUpdates: enabled })}
        tone="driver"
      />
      <AppV2PreferenceRow
        icon="safety"
        title="安全与重要状态"
        description="涉及安全或需要你操作的事项不会被隐藏"
        enabled
        disabled
        onChange={() => undefined}
        tone="safety"
      />
      <AppV2StatusPanel
        title="偏好保存在当前设备"
        description="更换设备后可以重新选择，不会改变账户、身份或行程状态。"
      />
    </MobilityPage>
  );
}

type FeedbackCategory = "trip" | "account" | "product";

export function HelpFeedbackScreen({ navigate }: { navigate: Navigate }) {
  const { verification } = useAdultEligibility();
  const { actions, runAction } = useInteraction();
  const { theme } = useAppTheme();
  const [category, setCategory] = useState<FeedbackCategory>("trip");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<string>();

  const shareFeedback = async () => {
    await runAction("account.feedback", async () => {
      setMessage(undefined);
      try {
        await Share.share({
          title: "御驾出行反馈",
          message: `反馈类型：${feedbackLabels[category]}\n\n${details.trim()}`,
        });
        setMessage("已打开系统分享菜单，请选择你希望使用的联系渠道。");
      } catch {
        setMessage("当前设备暂时无法打开分享菜单，请稍后重试。");
      }
    });
  };

  return (
    <MobilityPage
      title="帮助与反馈"
      accessibilityLabel="帮助与反馈"
      onBack={() => navigate("account")}
      actions={
        <>
          <PrimaryButton
            label="分享反馈"
            loading={actions["account.feedback"] === "running"}
            loadingLabel="正在发送"
            disabled={details.trim().length < 4}
            onPress={() => void shareFeedback()}
          />
          <PrimaryButton
            label="返回我的账户"
            variant="text"
            onPress={() => navigate("account")}
          />
        </>
      }
    >
      <AppV2StageHeader
        eyebrow="账户 · 帮助"
        title="先找到正确的处理入口"
        description="行程、安全和实名问题分别进入对应流程；一般产品建议可以通过设备分享菜单发送。"
      />
      <AppV2NavigationRow
        icon="messages"
        title="行程与消息帮助"
        description="查看当前行程、服务通知和已有联系"
        onPress={() => navigate("message-center")}
        tone="passenger"
      />
      <AppV2NavigationRow
        icon="safety"
        title="安全问题"
        description="查看当前安全事项和可采取的下一步"
        onPress={() => navigate("privacy-safety-settings")}
        tone="safety"
      />
      <AppV2NavigationRow
        icon="account"
        title="实名帮助"
        description={
          verification?.businessAccessAllowed
            ? "实名信息已确认，可查看当前结果"
            : "继续验证、重试或提交复核说明"
        }
        value={verification?.businessAccessAllowed ? "已完成" : "查看"}
        onPress={() => navigate("adult-eligibility")}
      />
      <View style={{ gap: theme.spacing.md }}>
        <AppText size="small" weight="bold">产品反馈</AppText>
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}
        >
          {(Object.keys(feedbackLabels) as FeedbackCategory[]).map((value) => (
            <AppV2ChoiceChip
              key={value}
              label={feedbackLabels[value]}
              selected={category === value}
              onPress={() => setCategory(value)}
            />
          ))}
        </View>
        <AppV2FieldFrame icon="help" label="反馈说明">
          <TextInput
            accessibilityLabel="反馈说明"
            multiline
            value={details}
            onChangeText={(value) => {
              setDetails(value);
              setMessage(undefined);
            }}
            placeholder="请描述发生了什么，以及你希望如何改进"
            placeholderTextColor={theme.colors.textSecondary}
            style={{
              minHeight: 112,
              paddingTop: theme.spacing.sm,
              color: theme.colors.text,
              textAlignVertical: "top",
            }}
          />
        </AppV2FieldFrame>
        <AppText size="caption" tone="secondary">
          只有在你确认分享后，反馈内容才会交给所选应用。
        </AppText>
      </View>
      {message ? (
        <AppV2StatusPanel
          title={message.startsWith("已打开") ? "反馈已准备好" : "暂时无法分享"}
          description={message}
          tone={message.startsWith("已打开") ? "neutral" : "safety"}
        />
      ) : null}
    </MobilityPage>
  );
}

const feedbackLabels: Readonly<Record<FeedbackCategory, string>> = {
  trip: "行程体验",
  account: "账户与身份",
  product: "产品建议",
};
