import { useState } from "react";
import { Share, TextInput, View } from "react-native";

import { useAdultEligibility } from "../../application/adult-eligibility-context";
import {
  AppV2ChoiceChip,
  AppV2FieldFrame,
} from "../../components/app-v2-components";
import {
  AuxiliaryDataRow,
  AuxiliaryGroup,
  AuxiliaryInlineFeedback,
  AuxiliaryPage,
  AuxiliarySection,
  AuxiliarySwitchRow,
} from "../../components/auxiliary-page";
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
  const update = (patch: Partial<NotificationPreferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    writeNotificationPreferences(next);
  };

  return (
    <AuxiliaryPage
      title="通知设置"
      accessibilityLabel="账户通知设置"
      onBack={() => navigate(returnScreen)}
    >
      <AuxiliarySection
        title="服务通知"
        description="关闭后仍可在消息中查看相关记录。"
      >
        <AuxiliaryGroup>
          <AuxiliarySwitchRow
            icon="route"
            label="行程进展"
            description="匹配、预约和行程结果"
            enabled={preferences.tripUpdates}
            onChange={(enabled) => update({ tripUpdates: enabled })}
          />
          <AuxiliarySwitchRow
            icon="car"
            label="车主准备进展"
            description="车辆审核和参与资格更新"
            enabled={preferences.ownerUpdates}
            onChange={(enabled) => update({ ownerUpdates: enabled })}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>
      <AuxiliarySection title="重要提醒">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon="safety"
            label="安全与账户提醒"
            description="涉及安全、登录或需要确认的事项"
            value="始终开启"
            valueTone="primary"
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>
      <AppText size="small" tone="secondary">
        通知偏好保存在当前设备。
      </AppText>
    </AuxiliaryPage>
  );
}

type FeedbackCategory = "trip" | "account" | "product";

export function HelpFeedbackScreen({ navigate }: { navigate: Navigate }) {
  const { verification } = useAdultEligibility();
  const { actions, runAction } = useInteraction();
  const { theme } = useAppTheme();
  const [category, setCategory] = useState<FeedbackCategory>("trip");
  const [details, setDetails] = useState("");
  const [feedback, setFeedback] = useState<Readonly<{
    tone: "neutral" | "danger";
    title: string;
    description: string;
  }>>();

  const shareFeedback = async () => {
    await runAction("account.feedback", async () => {
      setFeedback(undefined);
      try {
        await Share.share({
          title: "御驾出行反馈",
          message: `反馈类型：${feedbackLabels[category]}\n\n${details.trim()}`,
        });
        setFeedback({
          tone: "neutral",
          title: "已打开分享菜单",
          description: "请选择你希望使用的联系渠道。",
        });
      } catch {
        setFeedback({
          tone: "danger",
          title: "暂时无法分享反馈",
          description: "请稍后重试。",
        });
      }
    });
  };

  return (
    <AuxiliaryPage
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
        </>
      }
    >
      <AuxiliarySection title="常用帮助">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon="messages"
            label="行程与消息"
            description="查看当前行程、通知和已有联系"
            onPress={() => navigate("message-center")}
          />
          <AuxiliaryDataRow
            icon="safety"
            label="安全问题"
            description="查看安全事项和处理进度"
            onPress={() => navigate("privacy-safety-settings")}
          />
          <AuxiliaryDataRow
            icon="account"
            label="我的实名"
            description={
              verification?.businessAccessAllowed
                ? "查看已确认的实名资料"
                : "继续确认、重试或提交复核说明"
            }
            value={verification?.businessAccessAllowed ? "已确认" : undefined}
            onPress={() => navigate("adult-eligibility")}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>
      <AuxiliarySection
        title="提交反馈"
        description="不会自动附带账户资料或行程内容。"
      >
        <View style={{ gap: theme.spacing.md }}>
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
              setFeedback(undefined);
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
      </AuxiliarySection>
      {feedback ? (
        <AuxiliaryInlineFeedback
          title={feedback.title}
          description={feedback.description}
          tone={feedback.tone}
        />
      ) : null}
    </AuxiliaryPage>
  );
}

const feedbackLabels: Readonly<Record<FeedbackCategory, string>> = {
  trip: "行程体验",
  account: "账户与身份",
  product: "产品建议",
};
