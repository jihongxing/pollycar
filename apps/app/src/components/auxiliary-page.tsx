import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useAppTheme } from "../theme/theme-context";
import { AppIcon, type AppIconName } from "./app-icon";
import { MobilityPage } from "./mobility";
import { AppText, PrimaryButton } from "./ui";

export function AuxiliaryPage({
  title,
  accessibilityLabel,
  onBack,
  actions,
  tone = "neutral",
  children,
}: PropsWithChildren<{
  title: string;
  accessibilityLabel: string;
  onBack?: () => void;
  actions?: ReactNode;
  tone?: "passenger" | "driver" | "neutral";
}>) {
  return (
    <MobilityPage
      title={title}
      accessibilityLabel={accessibilityLabel}
      onBack={onBack}
      actions={actions}
      tone={tone}
    >
      {children}
    </MobilityPage>
  );
}

export function AuxiliarySection({
  title,
  description,
  children,
}: PropsWithChildren<{
  title: string;
  description?: string;
}>) {
  const { theme } = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ gap: theme.spacing.xxs }}>
        <AppText size="small" weight="bold">{title}</AppText>
        {description ? <AppText size="caption" tone="secondary">{description}</AppText> : null}
      </View>
      {children}
    </View>
  );
}

export function AuxiliaryState({
  icon,
  title,
  description,
  action,
  tone = "neutral",
}: {
  icon: AppIconName;
  title: string;
  description: string;
  action?: Readonly<{
    label: string;
    loading?: boolean;
    onPress: () => void;
  }>;
  tone?: "neutral" | "passenger" | "driver" | "danger";
}) {
  const { theme } = useAppTheme();
  const accent =
    tone === "passenger"
      ? theme.colors.passenger
      : tone === "driver"
        ? theme.colors.owner
        : tone === "danger"
          ? theme.colors.danger
          : theme.colors.textSecondary;
  return (
    <View
      role={tone === "danger" ? "alert" : "status"}
      accessibilityLiveRegion={tone === "danger" ? "assertive" : "polite"}
      accessibilityLabel={`${title}。${description}`}
      style={styles.state}
    >
      <View style={[styles.stateIcon, { backgroundColor: `${accent}16` }]}>
        <AppIcon name={icon} size={28} color={accent} />
      </View>
      <View accessibilityRole="header">
        <AppText family="display" size="title2" weight="bold" style={styles.centerText}>
          {title}
        </AppText>
      </View>
      <AppText tone="secondary" style={styles.centerText}>
        {description}
      </AppText>
      {action ? (
        <PrimaryButton
          label={action.label}
          variant="secondary"
          loading={action.loading}
          onPress={action.onPress}
        />
      ) : null}
    </View>
  );
}

export function AuxiliaryInlineFeedback({
  title,
  description,
  icon,
  action,
  tone = "neutral",
}: {
  title: string;
  description?: string;
  icon?: AppIconName;
  action?: Readonly<{
    label: string;
    loading?: boolean;
    onPress: () => void;
  }>;
  tone?: "success" | "neutral" | "danger";
}) {
  const { theme } = useAppTheme();
  const accent =
    tone === "success"
      ? theme.colors.success
      : tone === "danger"
        ? theme.colors.danger
        : theme.colors.textSecondary;
  return (
    <View
      role={tone === "danger" ? "alert" : "status"}
      accessibilityLiveRegion={tone === "danger" ? "assertive" : "polite"}
      accessibilityLabel={description ? `${title}。${description}` : title}
      style={[
        styles.inlineFeedback,
        {
          borderColor: `${accent}52`,
          backgroundColor: `${accent}12`,
        },
      ]}
    >
      {icon ? (
        <View style={[styles.inlineFeedbackIcon, { backgroundColor: `${accent}18` }]}>
          <AppIcon name={icon} size={20} color={accent} />
        </View>
      ) : (
        <View style={[styles.inlineFeedbackMarker, { backgroundColor: accent }]} />
      )}
      <View style={styles.inlineFeedbackContent}>
        <AppText size="small" weight="bold">{title}</AppText>
        {description ? (
          <AppText size="small" tone="secondary">{description}</AppText>
        ) : null}
      </View>
      {action ? (
        <PrimaryButton
          label={action.label}
          variant="secondary"
          loading={action.loading}
          onPress={action.onPress}
        />
      ) : null}
    </View>
  );
}

export function AuxiliaryGroup({ children }: PropsWithChildren) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.group,
        {
          borderColor: theme.colors.border,
          borderRadius: theme.radius.medium,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      {children}
    </View>
  );
}

export function AuxiliaryDataRow({
  label,
  value,
  description,
  icon,
  onPress,
  last = false,
  valueTone = "primary",
}: {
  label: string;
  value?: string;
  description?: string;
  icon?: AppIconName;
  onPress?: () => void;
  last?: boolean;
  valueTone?: "primary" | "secondary" | "passenger" | "owner" | "danger";
}) {
  const { theme } = useAppTheme();
  const content = (
    <>
      {icon ? (
        <View style={[styles.icon, { backgroundColor: theme.colors.surfaceMuted }]}>
          <AppIcon name={icon} size={20} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <AppText weight="medium">{label}</AppText>
        {description ? <AppText size="caption" tone="secondary">{description}</AppText> : null}
      </View>
      {value ? <AppText size="small" tone={valueTone} weight="medium">{value}</AppText> : null}
      {onPress ? <AppIcon name="chevron-right" size={17} color={theme.colors.textSecondary} /> : null}
    </>
  );
  const style = [
    styles.row,
    {
      borderBottomColor: theme.colors.border,
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
    },
  ];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${value ? `，${value}` : ""}`}
      onPress={onPress}
      style={({ pressed }) => [
        style,
        pressed ? { backgroundColor: theme.colors.surfaceMuted } : undefined,
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View accessibilityLabel={`${label}${value ? `，${value}` : ""}`} style={style}>
      {content}
    </View>
  );
}

export function AuxiliarySwitchRow({
  label,
  description,
  icon,
  enabled,
  onChange,
  last = false,
}: {
  label: string;
  description: string;
  icon: AppIconName;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  last?: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: enabled }}
      aria-checked={enabled}
      onPress={() => onChange(!enabled)}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: theme.colors.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: theme.colors.surfaceMuted }]}>
        <AppIcon name={icon} size={20} />
      </View>
      <View style={styles.flex}>
        <AppText weight="medium">{label}</AppText>
        <AppText size="caption" tone="secondary">{description}</AppText>
      </View>
      <View
        style={[
          styles.switchTrack,
          {
            backgroundColor: enabled ? theme.colors.passenger : theme.colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.switchThumb,
            {
              alignSelf: enabled ? "flex-end" : "flex-start",
              backgroundColor: theme.colors.surface,
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

export function AuxiliaryChoiceRow({
  label,
  description,
  icon,
  selected,
  onPress,
  last = false,
}: {
  label: string;
  description: string;
  icon: AppIconName;
  selected: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${label}${selected ? "，当前" : ""}`}
      accessibilityHint={description}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: theme.colors.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: theme.colors.surfaceMuted }]}>
        <AppIcon name={icon} size={20} />
      </View>
      <View style={styles.flex}>
        <AppText weight="medium">{label}</AppText>
        <AppText size="caption" tone="secondary">{description}</AppText>
      </View>
      <View
        style={[
          styles.choiceMark,
          {
            borderColor: selected ? theme.colors.passenger : theme.colors.border,
            backgroundColor: selected ? theme.colors.passenger : "transparent",
          },
        ]}
      >
        {selected ? (
          <View
            style={[
              styles.choiceDot,
              { backgroundColor: theme.colors.onDeepSurface },
            ]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export function AuxiliaryAvatarChoice({
  label,
  color,
  selected,
  onPress,
}: {
  label: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}头像${selected ? "，当前选择" : ""}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.avatarChoice,
        {
          borderColor: selected ? theme.colors.passenger : theme.colors.border,
          backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
        },
      ]}
    >
      <View style={[styles.avatarSwatch, { backgroundColor: color }]}>
        <AppText size="title2" weight="bold" style={{ color: theme.colors.onDeepSurface }}>林</AppText>
      </View>
      <AppText size="small" weight={selected ? "bold" : "regular"}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  state: {
    width: "100%",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  stateIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
  },
  centerText: {
    textAlign: "center",
  },
  inlineFeedback: {
    width: "100%",
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inlineFeedbackIcon: {
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  inlineFeedbackMarker: {
    width: 4,
    alignSelf: "stretch",
    flexShrink: 0,
    borderRadius: 2,
  },
  inlineFeedbackContent: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  group: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  icon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  avatarChoice: {
    minWidth: 96,
    minHeight: 116,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  avatarSwatch: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29,
  },
  switchTrack: {
    width: 46,
    height: 28,
    justifyContent: "center",
    borderRadius: 14,
    padding: 3,
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  choiceMark: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 12,
  },
  choiceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
