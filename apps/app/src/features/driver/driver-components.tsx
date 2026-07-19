import { useMemo, useState, type ReactNode } from "react";
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from "react-native";

import { AppText, PrimaryButton, SectionCard } from "../../components/ui";
import { useAppTheme } from "../../theme/theme-context";
import {
  formatSyntheticAmount,
  publicGenderLabel,
  sceneLabel,
  type DriverAvailability,
  type DriverTripCard,
  type RiderPublicProfile,
} from "./driver-model";

export function DriverModeHeader({
  availability,
  onToggleOnline,
  toggleDisabled = false,
}: {
  availability: DriverAvailability;
  onToggleOnline: () => void;
  toggleDisabled?: boolean;
}) {
  const label =
    availability === "online"
      ? "在线接单"
      : availability === "busy"
        ? "履约中"
        : availability === "blocked"
          ? "暂不可上线"
          : "当前离线";
  return (
    <SectionCard>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <AppText tone="owner" weight="bold">
            车主工作模式
          </AppText>
          <AppText size="title1" weight="bold">
            {label}
          </AppText>
        </View>
        <PrimaryButton
          label={availability === "online" ? "结束接单" : "开始接单"}
          variant="owner"
          disabled={toggleDisabled || availability === "busy"}
          onPress={onToggleOnline}
        />
      </View>
    </SectionCard>
  );
}

export function RiderIdentity({
  rider,
  compact = false,
}: {
  rider: RiderPublicProfile;
  compact?: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.identityRow}>
      {rider.avatarUri ? (
        <Image
          accessibilityLabel={`${rider.displayName}的头像`}
          source={{ uri: rider.avatarUri }}
          style={[styles.avatar, { borderColor: theme.colors.border }]}
        />
      ) : (
        <View
          accessibilityLabel={`${rider.displayName}的默认头像`}
          style={[
            styles.avatar,
            styles.avatarFallback,
            { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
          ]}
        >
          <AppText weight="bold">{rider.displayName.slice(0, 1)}</AppText>
        </View>
      )}
      <View style={styles.flex}>
        <View style={styles.inline}>
          <AppText weight="bold">{rider.displayName}</AppText>
          <AppText tone="secondary">{publicGenderLabel(rider.gender)}</AppText>
        </View>
        {!compact ? (
          <AppText tone="secondary" size="small">
            {rider.rating === undefined
              ? "暂无评分"
              : `${rider.rating.toFixed(1)} 分 · ${rider.ratingCount ?? 0} 次评价`}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

export function DriverTripCardView({
  trip,
  canAccept,
  onAccept,
  onSkip,
}: {
  trip: DriverTripCard;
  canAccept: boolean;
  onAccept: () => void;
  onSkip: () => void;
}) {
  const scene = sceneLabel(trip.scene);
  const scheduledLabel = trip.timing?.mode === "scheduled"
    ? formatScheduledDriverSlot(
        trip.timing.requestedPickupStartsAt!,
        trip.timing.requestedPickupEndsAt!,
      )
    : undefined;
  return (
    <SectionCard>
      {scheduledLabel ? (
        <View>
          <AppText size="title2" weight="bold">{scheduledLabel}</AppText>
          <AppText tone="secondary">预约行程 · 是否接受由你决定</AppText>
        </View>
      ) : null}
      <RiderIdentity rider={trip.rider} />
      <View style={styles.routeBlock}>
        <RouteLine marker="上" label={trip.pickupLabel} />
        <RouteLine marker="下" label={trip.destinationLabel} />
      </View>
      <View style={styles.metaWrap}>
        <MetaPill label={`${trip.passengerCount} 人`} />
        {trip.estimatedPickupDistanceKm !== undefined ? (
          <MetaPill label={`${trip.estimatedPickupDistanceKm.toFixed(1)} km 接驾`} />
        ) : null}
        {trip.estimatedDurationMinutes !== undefined ? (
          <MetaPill label={`约 ${trip.estimatedDurationMinutes} 分钟`} />
        ) : null}
        {scene ? <MetaPill label={scene} /> : null}
        <MetaPill label={formatSyntheticAmount(trip.syntheticAmountCents)} />
      </View>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <PrimaryButton label="暂不接单" variant="secondary" onPress={onSkip} />
        </View>
        <View style={styles.flex}>
          <PrimaryButton
            label="自主接单"
            variant="owner"
            disabled={!canAccept}
            onPress={onAccept}
          />
        </View>
      </View>
    </SectionCard>
  );
}

function formatScheduledDriverSlot(startsAt: string, endsAt: string): string {
  const date = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(startsAt));
  const formatTime = (value: string) =>
    new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(value));
  return `${date} ${formatTime(startsAt)}–${formatTime(endsAt)}`;
}

export function DriverNavigationPlaceholder({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      accessibilityLabel="合成导航预览，真实导航关闭"
      style={[styles.mapPlaceholder, { backgroundColor: theme.colors.deepSurface }]}
    >
      <AppText tone="inverse" size="title2" weight="bold">
        {title}
      </AppText>
      <AppText tone="inverse">{subtitle}</AppText>
      <AppText tone="inverse" size="small">
        合成路线预览 · 真实定位与导航未启用
      </AppText>
    </View>
  );
}

export function DriverActionLinks({
  onChat,
  onSafety,
}: {
  onChat: () => void;
  onSafety: () => void;
}) {
  return (
    <View style={styles.actions}>
      <View style={styles.flex}>
        <PrimaryButton label="联系乘车人" variant="secondary" onPress={onChat} />
      </View>
      <View style={styles.flex}>
        <PrimaryButton label="安全中心" variant="secondary" onPress={onSafety} />
      </View>
    </View>
  );
}

export function DriverOrderSummary({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <SectionCard>
      <AppText size="title2" weight="bold">{title}</AppText>
      <View style={styles.summaryStack}>{children}</View>
    </SectionCard>
  );
}

export function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rowBetween}>
      <AppText tone="secondary">{label}</AppText>
      <AppText weight="medium">{value}</AppText>
    </View>
  );
}

function RouteLine({ marker, label }: { marker: string; label: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.inline}>
      <View style={[styles.routeMarker, { backgroundColor: theme.colors.owner }]}>
        <AppText tone="inverse" size="caption" weight="bold">
          {marker}
        </AppText>
      </View>
      <AppText style={styles.flex}>{label}</AppText>
    </View>
  );
}

function MetaPill({ label }: { label: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.pill, { backgroundColor: theme.colors.surfaceMuted }]}>
      <AppText size="small">{label}</AppText>
    </View>
  );
}

export function SlideToConfirm({
  progress,
  disabled = false,
  onProgress,
  onConfirm,
}: {
  progress: number;
  disabled?: boolean;
  onProgress: (progress: number) => void;
  onConfirm: () => void;
}) {
  const { theme } = useAppTheme();
  const [trackWidth, setTrackWidth] = useState(1);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !disabled && Math.abs(gesture.dx) > 4,
        onPanResponderMove: (_, gesture) => {
          onProgress(Math.max(0, Math.min(1, gesture.dx / trackWidth)));
        },
        onPanResponderRelease: (_, gesture) => {
          const releasedProgress = Math.max(0, Math.min(1, gesture.dx / trackWidth));
          if (releasedProgress >= 0.92) {
            onProgress(1);
            onConfirm();
          } else {
            onProgress(0);
          }
        },
        onPanResponderTerminate: () => onProgress(0),
      }),
    [disabled, onConfirm, onProgress, trackWidth],
  );
  const measureTrack = (event: LayoutChangeEvent) => {
    setTrackWidth(Math.max(1, event.nativeEvent.layout.width));
  };
  const confirm = () => {
    if (disabled) return;
    onProgress(1);
    onConfirm();
  };
  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "activate") confirm();
  };
  return (
    <View>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel="确认已到达目的地"
        accessibilityHint="向右滑动到底，或使用辅助技术的激活操作完成确认"
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: "activate", label: "确认已到达目的地" }]}
        onAccessibilityAction={handleAccessibilityAction}
        onLayout={measureTrack}
        style={[styles.sliderTrack, { backgroundColor: theme.colors.surfaceMuted }]}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            styles.sliderFill,
            { backgroundColor: theme.colors.owner, width: `${progress * 100}%` },
          ]}
        />
        <AppText style={styles.sliderLabel} weight="bold">
          {progress >= 1 ? "已确认到达" : "向右滑动确认到达"}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="无法滑动，点按确认已到达"
        disabled={disabled}
        onPress={confirm}
        style={({ pressed }) => [
          styles.confirmFallback,
          {
            borderColor: theme.colors.border,
            backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <AppText size="small" weight="bold">无法滑动？点按确认</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  inline: { alignItems: "center", flexDirection: "row", gap: 8 },
  identityRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  avatar: { borderRadius: 28, borderWidth: 1, height: 56, width: 56 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  routeBlock: { gap: 10, marginTop: 18 },
  routeMarker: {
    alignItems: "center",
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  metaWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  actions: { flexDirection: "row", gap: 12, marginTop: 18 },
  mapPlaceholder: {
    borderRadius: 24,
    gap: 8,
    minHeight: 210,
    padding: 24,
    justifyContent: "flex-end",
  },
  summaryStack: { gap: 12 },
  sliderTrack: {
    borderRadius: 24,
    height: 56,
    justifyContent: "center",
    overflow: "hidden",
  },
  sliderFill: { bottom: 0, left: 0, position: "absolute", top: 0 },
  sliderLabel: { alignSelf: "center", zIndex: 1 },
  confirmFallback: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    marginTop: 10,
    paddingHorizontal: 16,
  },
});
