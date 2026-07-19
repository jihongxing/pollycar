import { useMemo } from "react";
import { View } from "react-native";

import { useFreeFlexTrial } from "../../application/free-flex-trial-context";
import { buildSyntheticNotificationCenter } from "../../application/notification-center";
import { useSafetyCase } from "../../application/safety-case-context";
import { useSyntheticTrip } from "../../application/synthetic-trip-context";
import { useVehicleReview } from "../../application/vehicle-review-context";
import {
  AppV2EmptyState,
  AppV2NavigationRow,
  AppV2SectionHeader,
  AppV2StageHeader,
  AppV2StatusPanel,
  AppV2SummaryList,
} from "../../components/app-v2-components";
import { MobilityPage } from "../../components/mobility";
import { useAppTheme } from "../../theme/theme-context";
import {
  readNotificationPreferences,
  shouldShowNotification,
} from "../account/notification-preferences";
import type { AppScreen } from "../vehicle-review/screens";

export function NotificationCenterScreen({
  navigate,
}: {
  navigate: (screen: AppScreen) => void;
}) {
  const { review } = useVehicleReview();
  const { trial } = useFreeFlexTrial();
  const { dashboard: trips } = useSyntheticTrip();
  const { dashboard: safety } = useSafetyCase();
  const { theme } = useAppTheme();
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
    <MobilityPage
      title="服务通知"
      accessibilityLabel="服务通知"
      onBack={() => navigate("message-center")}
    >
      <AppV2StageHeader
        eyebrow="消息 · 服务通知"
        title={tasks.length > 0 ? "有几项服务状态需要留意" : "服务状态已是最新"}
        description={
          tasks.length > 0
            ? "进入对应页面即可查看原因和下一步。"
            : "行程、车辆、身份和安全状态变化后会在这里通知你。"
        }
        tone={tasks.some((item) => item.domain === "safety") ? "safety" : "passenger"}
      />
      <AppV2SummaryList
        items={[
          {
            label: "需要留意",
            value: `${tasks.length} 项`,
            emphasized: tasks.length > 0,
          },
          { label: "其他通知", value: `${updates.length} 项` },
        ]}
      />
      <AppV2NavigationRow
        icon="theme"
        title="通知设置"
        description="选择显示哪些非紧急服务通知"
        onPress={() => navigate("notification-settings")}
      />
      <View style={{ gap: theme.spacing.md }}>
        <AppV2SectionHeader title="需要留意" detail={`${tasks.length} 项`} />
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <AppV2NavigationRow
              key={task.notificationId}
              icon={domainIcons[task.domain]}
              title={task.title}
              description={task.body}
              value={domainLabels[task.domain]}
              tone={domainTones[task.domain]}
              onPress={() => navigate(task.target)}
            />
          ))
        ) : (
          <AppV2EmptyState
            icon="orders"
            title="当前没有需要处理的服务状态"
            description="新的行程、车辆、身份或安全通知会显示在这里。"
            tone="passenger"
          />
        )}
      </View>
      {updates.length > 0 ? (
        <View style={{ gap: theme.spacing.md }}>
          <AppV2SectionHeader title="服务动态" detail={`${updates.length} 项`} />
          {updates.map((update) => (
            <AppV2NavigationRow
              key={update.notificationId}
              icon={domainIcons[update.domain]}
              title={update.title}
              description={update.body}
              value={domainLabels[update.domain]}
              tone={domainTones[update.domain]}
              onPress={() => navigate(update.target)}
            />
          ))}
        </View>
      ) : (
        <AppV2StatusPanel
          title="没有更多服务通知"
          description="你关闭的非紧急通知不会显示；安全提醒和需要处理的状态始终保留。"
        />
      )}
    </MobilityPage>
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

const domainTones = {
  review: "driver",
  trip: "passenger",
  safety: "safety",
  eligibility: "driver",
} as const;
