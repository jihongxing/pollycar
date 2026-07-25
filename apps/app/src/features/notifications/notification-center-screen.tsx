import type { SyntheticNotificationItem } from "@pollycar/contracts";
import { useMemo } from "react";

import { useFreeFlexTrial } from "../../application/free-flex-trial-context";
import { buildSyntheticNotificationCenter } from "../../application/notification-center";
import { useSafetyCase } from "../../application/safety-case-context";
import { useSyntheticTrip } from "../../application/synthetic-trip-context";
import { useVehicleReview } from "../../application/vehicle-review-context";
import {
  AuxiliaryDataRow,
  AuxiliaryGroup,
  AuxiliaryPage,
  AuxiliarySection,
  AuxiliaryState,
} from "../../components/auxiliary-page";
import { AppText, PrimaryButton } from "../../components/ui";
import {
  readNotificationPreferences,
  shouldShowNotification,
} from "../account/notification-preferences";
import type { AppScreen } from "../vehicle-review/screens";
import {
  readNotificationDetail,
  rememberNotificationDetail,
} from "./notification-navigation";

export function NotificationCenterScreen({
  navigate,
}: {
  navigate: (screen: AppScreen) => void;
}) {
  const { review } = useVehicleReview();
  const { trial } = useFreeFlexTrial();
  const { dashboard: trips } = useSyntheticTrip();
  const { dashboard: safety } = useSafetyCase();
  const preferences = readNotificationPreferences();
  const center = useMemo(
    () => buildSyntheticNotificationCenter({ review, trial, trips, ...(safety ? { safety } : {}) }),
    [review, safety, trial, trips],
  );
  const tasks = center.items.filter((item) => item.requiresAction);
  const updates = center.items.filter(
    (item) => !item.requiresAction && shouldShowNotification(item, preferences),
  );

  return (
    <AuxiliaryPage
      title="服务通知"
      accessibilityLabel="服务通知"
      onBack={() => navigate("message-center")}
    >
      {tasks.length === 0 && updates.length === 0 ? (
        <AuxiliaryState
          icon="messages"
          title="暂时没有服务通知"
          description="行程、车辆、资格或安全状态变化后会显示在这里。"
          tone="passenger"
        />
      ) : null}
      {tasks.length > 0 ? (
        <NotificationGroup
          title="需要留意"
          description="这些变化可能影响下一步使用。"
          items={tasks}
          navigate={navigate}
        />
      ) : null}
      {updates.length > 0 ? (
        <NotificationGroup
          title="其他更新"
          items={updates}
          navigate={navigate}
        />
      ) : null}
      <AuxiliarySection title="通知管理">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon="theme"
            label="通知设置"
            description="选择显示哪些非紧急服务通知"
            onPress={() => navigate("notification-settings")}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>
      <AppText size="small" tone="secondary">
        安全与账户提醒始终保留，其他通知可在通知设置中调整。
      </AppText>
    </AuxiliaryPage>
  );
}

export function NotificationDetailScreen({
  navigate,
}: {
  navigate: (screen: AppScreen) => void;
}) {
  const { review } = useVehicleReview();
  const { trial } = useFreeFlexTrial();
  const { dashboard: trips } = useSyntheticTrip();
  const { dashboard: safety } = useSafetyCase();
  const center = useMemo(
    () => buildSyntheticNotificationCenter({ review, trial, trips, ...(safety ? { safety } : {}) }),
    [review, safety, trial, trips],
  );
  const notificationId = readNotificationDetail();
  const notification = center.items.find((item) => item.notificationId === notificationId);

  if (!notification) {
    return (
      <AuxiliaryPage
        title="通知详情"
        accessibilityLabel="通知详情不可用"
        onBack={() => navigate("notifications")}
      >
        <AuxiliaryState
          icon="messages"
          title="这条通知已不在当前列表"
          description="服务状态更新后，旧通知可能不再显示。"
          action={{ label: "返回服务通知", onPress: () => navigate("notifications") }}
        />
      </AuxiliaryPage>
    );
  }

  return (
    <AuxiliaryPage
      title="通知详情"
      accessibilityLabel={`${domainLabels[notification.domain]}通知详情`}
      onBack={() => navigate("notifications")}
      tone={notification.domain === "review" || notification.domain === "eligibility" ? "driver" : "neutral"}
      actions={
        <PrimaryButton
          label={targetLabels[notification.domain]}
          variant={notification.domain === "review" || notification.domain === "eligibility" ? "owner" : "primary"}
          onPress={() => navigate(notification.target)}
        />
      }
    >
      <AuxiliarySection title={domainLabels[notification.domain]}>
        <AuxiliaryGroup>
          <AuxiliaryDataRow label="通知内容" value={notification.title} />
          <AuxiliaryDataRow
            label="当前结果"
            value={notification.requiresAction ? "需要查看" : "已更新"}
            valueTone="primary"
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>
      <AuxiliarySection title="说明">
        <AuxiliaryGroup>
          <AuxiliaryDataRow label={notification.body} last />
        </AuxiliaryGroup>
      </AuxiliarySection>
    </AuxiliaryPage>
  );
}

function NotificationGroup({
  title,
  description,
  items,
  navigate,
}: {
  title: string;
  description?: string;
  items: readonly SyntheticNotificationItem[];
  navigate: (screen: AppScreen) => void;
}) {
  return (
    <AuxiliarySection title={title} description={description}>
      <AuxiliaryGroup>
        {items.map((item, index) => (
          <AuxiliaryDataRow
            key={item.notificationId}
            icon={domainIcons[item.domain]}
            label={item.title}
            description={item.body}
            value={domainLabels[item.domain]}
            valueTone={item.domain === "review" || item.domain === "eligibility" ? "owner" : "primary"}
            onPress={() => {
              rememberNotificationDetail(item.notificationId);
              navigate("notification-detail");
            }}
            last={index === items.length - 1}
          />
        ))}
      </AuxiliaryGroup>
    </AuxiliarySection>
  );
}

const domainLabels = {
  review: "车辆",
  trip: "行程",
  safety: "安全",
  eligibility: "资格",
} as const;

const domainIcons = {
  review: "car",
  trip: "route",
  safety: "safety",
  eligibility: "account",
} as const;

const targetLabels = {
  review: "查看车辆状态",
  trip: "查看行程",
  safety: "查看安全事项",
  eligibility: "查看参与资格",
} as const;
