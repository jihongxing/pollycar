import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { AppIcon, type AppIconName } from "./app-icon";
import { AppText, PrimaryButton } from "./ui";
import { useAppTheme } from "../theme/theme-context";
import { resolveMotionProfile } from "../motion/motion";
import { useReducedMotion } from "../motion/use-reduced-motion";

type AppV2Tone = "neutral" | "passenger" | "driver" | "safety";

function toneColor(tone: AppV2Tone, colors: ReturnType<typeof useAppTheme>["theme"]["colors"]) {
  if (tone === "passenger") return colors.passenger;
  if (tone === "driver") return colors.owner;
  if (tone === "safety") return colors.danger;
  return colors.primary;
}

export function AppV2StageHeader({
  eyebrow,
  title,
  description,
  tone = "neutral",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  tone?: AppV2Tone;
}) {
  const { theme } = useAppTheme();
  const accent = toneColor(tone, theme.colors);
  return (
    <View style={styles.stageHeader}>
      {eyebrow ? (
        <View style={styles.eyebrowRow}>
          <View style={[styles.eyebrowMark, { backgroundColor: accent }]} />
          <AppText size="caption" tone="secondary" weight="bold">
            {eyebrow}
          </AppText>
        </View>
      ) : null}
      <View accessibilityRole="header">
        <AppText family="display" size="title1" weight="bold">{title}</AppText>
      </View>
      {description ? <AppText tone="secondary">{description}</AppText> : null}
    </View>
  );
}

export function AppV2SectionHeader({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: Readonly<{ label: string; onPress: () => void }>;
}) {
  const { theme } = useAppTheme();
  const motion = resolveMotionProfile(useReducedMotion());
  return (
    <View style={styles.sectionHeader}>
      <AppText size="small" weight="bold">{title}</AppText>
      <View style={styles.sectionHeaderTrailing}>
        {detail ? <AppText size="caption" tone="secondary">{detail}</AppText> : null}
        {action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.sectionHeaderAction,
              {
                backgroundColor: pressed
                  ? theme.colors.surfaceMuted
                  : "transparent",
              },
              pressed ? { opacity: 0.84, transform: [{ scale: motion.pressedScale }] } : undefined,
            ]}
          >
            <AppText size="small" weight="bold" style={{ color: theme.colors.primary }}>
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function AppV2FieldFrame({
  icon,
  label,
  children,
  trailing,
  tone = "passenger",
}: {
  icon: AppIconName;
  label: string;
  children: ReactNode;
  trailing?: ReactNode;
  tone?: AppV2Tone;
}) {
  const { theme } = useAppTheme();
  const accent = toneColor(tone, theme.colors);
  return (
    <View
      style={[
        styles.fieldFrame,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <View style={[styles.fieldIcon, { backgroundColor: `${accent}12` }]}>
        <AppIcon name={icon} size={19} color={accent} />
      </View>
      <View style={styles.flex}>
        <AppText size="caption" tone="secondary">{label}</AppText>
        {children}
      </View>
      {trailing}
    </View>
  );
}

export function AppV2PlaceRow({
  icon,
  title,
  description,
  onPress,
  footer,
}: {
  icon: AppIconName;
  title: string;
  description: string;
  onPress: () => void;
  footer?: ReactNode;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.placeRow,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title} ${description}`}
        onPress={onPress}
        style={({ pressed }) => [styles.placeMain, pressed ? { backgroundColor: theme.colors.surfaceMuted } : undefined]}
      >
        <View style={[styles.placeIcon, { backgroundColor: `${theme.colors.passenger}12` }]}>
          <AppIcon name={icon} size={20} color={theme.colors.passenger} />
        </View>
        <View style={styles.flex}>
          <AppText weight="bold">{title}</AppText>
          <AppText size="small" tone="secondary">{description}</AppText>
        </View>
        <AppIcon name="chevron-right" size={18} color={theme.colors.textSecondary} />
      </Pressable>
      {footer ? (
        <View style={[styles.placeFooter, { borderTopColor: theme.colors.border }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function AppV2ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceChip,
        {
          borderColor: selected ? theme.colors.passenger : theme.colors.border,
          backgroundColor: selected
            ? `${theme.colors.passenger}14`
            : pressed
              ? theme.colors.surfaceMuted
              : theme.colors.surface,
        },
      ]}
    >
      <AppText
        tone="primary"
        weight={selected ? "bold" : "regular"}
        style={selected ? { color: theme.colors.text } : undefined}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function AppV2SegmentedTabs<TValue extends string>({
  items,
  selected,
  onSelect,
  tone = "neutral",
}: {
  items: readonly Readonly<{ value: TValue; label: string }>[];
  selected: TValue;
  onSelect: (value: TValue) => void;
  tone?: AppV2Tone;
}) {
  const { theme } = useAppTheme();
  const accent = toneColor(tone, theme.colors);
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.segmentedTabs,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceMuted,
        },
      ]}
    >
      {items.map((item) => {
        const active = item.value === selected;
        return (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(item.value)}
            style={[
              styles.segmentedTab,
              active ? { backgroundColor: theme.colors.surface } : undefined,
            ]}
          >
            <AppText
              size="small"
              weight={active ? "bold" : "regular"}
              style={active ? { color: accent } : undefined}
            >
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AppV2NavigationRow({
  icon,
  title,
  description,
  value,
  onPress,
  tone = "neutral",
}: {
  icon: AppIconName;
  title: string;
  description: string;
  value?: string;
  onPress: () => void;
  tone?: AppV2Tone;
}) {
  const { theme } = useAppTheme();
  const accent = toneColor(tone, theme.colors);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}，${value ?? description}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.navigationRow,
        {
          borderColor: theme.colors.border,
          backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
        },
      ]}
    >
      <View style={[styles.navigationIcon, { backgroundColor: `${accent}14` }]}>
        <AppIcon name={icon} size={20} color={accent} />
      </View>
      <View style={styles.flex}>
        <AppText weight="bold">{title}</AppText>
        <AppText size="small" tone="secondary">{description}</AppText>
      </View>
      {value ? <AppText size="small" weight="bold">{value}</AppText> : null}
      <AppIcon name="chevron-right" size={18} color={theme.colors.textSecondary} />
    </Pressable>
  );
}

export function AppV2PreferenceRow({
  icon,
  title,
  description,
  enabled,
  onChange,
  disabled = false,
  tone = "neutral",
}: {
  icon: AppIconName;
  title: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  tone?: AppV2Tone;
}) {
  const { theme } = useAppTheme();
  const accent = toneColor(tone, theme.colors);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ checked: enabled, disabled }}
      aria-checked={enabled}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => onChange(!enabled)}
      style={({ pressed }) => [
        styles.navigationRow,
        {
          borderColor: theme.colors.border,
          backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
          opacity: disabled ? 0.68 : 1,
        },
      ]}
    >
      <View style={[styles.navigationIcon, { backgroundColor: `${accent}14` }]}>
        <AppIcon name={icon} size={20} color={accent} />
      </View>
      <View style={styles.flex}>
        <AppText weight="bold">{title}</AppText>
        <AppText size="small" tone="secondary">{description}</AppText>
      </View>
      <View
        style={[
          styles.preferenceTrack,
          {
            backgroundColor: enabled ? accent : theme.colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.preferenceThumb,
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

export function AppV2ApplicationProgress({
  steps,
  currentStep,
  tone = "driver",
}: {
  steps: readonly string[];
  currentStep: number;
  tone?: AppV2Tone;
}) {
  const { theme } = useAppTheme();
  const accent = toneColor(tone, theme.colors);
  return (
    <View
      accessibilityLabel={`申请进度，第 ${Math.min(currentStep + 1, steps.length)} 步，共 ${steps.length} 步`}
      style={[
        styles.applicationProgress,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      {steps.map((step, index) => {
        const complete = index < currentStep;
        const current = index === currentStep;
        return (
          <View key={step} style={styles.applicationStep}>
            <View style={styles.applicationTrack}>
              <View
                style={[
                  styles.applicationDot,
                  {
                    borderColor: complete || current ? accent : theme.colors.border,
                    backgroundColor: complete || current ? accent : theme.colors.surface,
                  },
                ]}
              >
                <AppText size="caption" weight="bold" tone={complete || current ? "inverse" : "secondary"}>
                  {index + 1}
                </AppText>
              </View>
              {index < steps.length - 1 ? (
                <View
                  style={[
                    styles.applicationLine,
                    { backgroundColor: complete ? accent : theme.colors.border },
                  ]}
                />
              ) : null}
            </View>
            <AppText
              size="small"
              weight={current ? "bold" : "regular"}
              style={current ? { color: accent } : undefined}
            >
              {step}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

export function AppV2ReadinessList({
  items,
  tone = "driver",
}: {
  items: readonly Readonly<{
    icon: AppIconName;
    title: string;
    description: string;
    status?: "ready" | "current" | "pending";
  }>[];
  tone?: AppV2Tone;
}) {
  const { theme } = useAppTheme();
  const accent = toneColor(tone, theme.colors);
  return (
    <View
      style={[
        styles.readinessList,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      {items.map((item, index) => {
        const active = item.status === "ready" || item.status === "current";
        return (
          <View
            key={item.title}
            style={[
              styles.readinessRow,
              index > 0
                ? {
                    borderTopColor: theme.colors.border,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  }
                : undefined,
            ]}
          >
            <View
              style={[
                styles.readinessIcon,
                { backgroundColor: active ? `${accent}14` : theme.colors.surfaceMuted },
              ]}
            >
              <AppIcon
                name={item.icon}
                size={20}
                color={active ? accent : theme.colors.textSecondary}
              />
            </View>
            <View style={styles.flex}>
              <AppText weight="bold">{item.title}</AppText>
              <AppText size="small" tone="secondary">{item.description}</AppText>
            </View>
            <AppText
              size="caption"
              weight="bold"
              style={active ? { color: accent } : { color: theme.colors.textSecondary }}
            >
              {item.status === "ready" ? "已准备" : item.status === "current" ? "当前" : "随后"}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

export function AppV2BalanceHero({
  label,
  amount,
  description,
  action,
}: {
  label: string;
  amount: string;
  description: string;
  action?: Readonly<{ label: string; disabled?: boolean; onPress: () => void }>;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.balanceHero, { backgroundColor: theme.colors.deepSurface }]}>
      <View style={styles.flex}>
        <AppText size="caption" tone="inverse" weight="bold">{label}</AppText>
        <AppText size="display" weight="bold" tone="inverse">{amount}</AppText>
        <AppText size="small" tone="inverse">{description}</AppText>
      </View>
      {action ? (
        <PrimaryButton
          label={action.label}
          variant="secondary"
          disabled={action.disabled}
          onPress={action.onPress}
        />
      ) : null}
    </View>
  );
}

export function AppV2WaitingState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.waitingState}>
      <View style={styles.waitingMarks}>
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[
              styles.waitingMark,
              {
                backgroundColor: theme.colors.passenger,
                opacity: 1 - index * 0.24,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.flex}>
        <AppText family="display" size="title2" weight="bold">{title}</AppText>
        <AppText size="small" tone="secondary">{description}</AppText>
      </View>
    </View>
  );
}

export function AppV2DriverArrivalCard({
  name,
  avatarUrl,
  genderLabel,
  ratingLabel,
  vehicleColor,
  vehicleModel,
  plate,
  etaLabel,
}: {
  name: string;
  avatarUrl?: string;
  genderLabel: string;
  ratingLabel?: string;
  vehicleColor: string;
  vehicleModel: string;
  plate: string;
  etaLabel: string;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      accessibilityLabel={`${name}，${vehicleColor}${vehicleModel}，车牌${plate}，${etaLabel}`}
      style={[
        styles.driverArrival,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <View style={styles.driverIdentity}>
        <View
          style={[
            styles.driverAvatar,
            { backgroundColor: `${theme.colors.passenger}14` },
          ]}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              accessibilityLabel={`${name}头像`}
              style={styles.driverAvatarImage}
            />
          ) : (
            <AppText size="title2" weight="bold" tone="passenger">
              {name.slice(0, 1)}
            </AppText>
          )}
        </View>
        <View style={styles.flex}>
          <View style={styles.driverNameRow}>
            <AppText size="title2" weight="bold">{name}</AppText>
            <AppText size="caption" tone="secondary">{genderLabel}</AppText>
          </View>
          <AppText size="small" tone="secondary">
            {ratingLabel ? `车主评分 ${ratingLabel}` : "已确认接驾"}
          </AppText>
        </View>
        <View style={[styles.etaBadge, { backgroundColor: `${theme.colors.passenger}14` }]}>
          <AppText size="small" weight="bold" tone="passenger">{etaLabel}</AppText>
        </View>
      </View>
      <View style={[styles.vehicleLine, { borderTopColor: theme.colors.border }]}>
        <View style={[styles.vehicleIcon, { backgroundColor: theme.colors.surfaceMuted }]}>
          <AppIcon name="car" size={21} color={theme.colors.passenger} />
        </View>
        <View style={styles.flex}>
          <AppText size="small" tone="secondary">{vehicleColor} · {vehicleModel}</AppText>
          <AppText size="title2" weight="bold" style={styles.plateText}>{plate}</AppText>
        </View>
      </View>
    </View>
  );
}

export function AppV2PickupCode({
  code,
  description,
}: {
  code: string;
  description: string;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      accessibilityLabel={`上车确认码 ${code}。${description}`}
      style={[
        styles.pickupCode,
        {
          borderColor: `${theme.colors.passenger}44`,
          backgroundColor: `${theme.colors.passenger}0D`,
        },
      ]}
    >
      <View style={styles.pickupCodeHeading}>
        <View style={[styles.pickupCodeIcon, { backgroundColor: theme.colors.surface }]}>
          <AppIcon name="safety" size={19} color={theme.colors.passenger} />
        </View>
        <View style={styles.flex}>
          <AppText size="caption" tone="secondary" weight="bold">上车确认码</AppText>
          <AppText size="small" tone="secondary">{description}</AppText>
        </View>
      </View>
      <AppText
        size="display"
        weight="bold"
        style={[styles.pickupCodeValue, { color: theme.colors.text }]}
      >
        {code}
      </AppText>
    </View>
  );
}

export function AppV2MetricStrip({
  items,
  tone = "passenger",
}: {
  items: readonly Readonly<{ label: string; value: string; icon: AppIconName }>[];
  tone?: AppV2Tone;
}) {
  const { theme } = useAppTheme();
  const accent = toneColor(tone, theme.colors);
  return (
    <View
      style={[
        styles.metricStrip,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      {items.map((item, index) => (
        <View
          key={item.label}
          style={[
            styles.metricItem,
            index > 0
              ? {
                  borderLeftColor: theme.colors.border,
                  borderLeftWidth: StyleSheet.hairlineWidth,
                }
              : undefined,
          ]}
        >
          <AppIcon name={item.icon} size={18} color={accent} />
          <AppText size="caption" tone="secondary">{item.label}</AppText>
          <AppText weight="bold">{item.value}</AppText>
        </View>
      ))}
    </View>
  );
}

export function AppV2Timeline({
  items,
}: {
  items: readonly Readonly<{
    label: string;
    value: string;
    detail?: string;
    tone?: AppV2Tone;
  }>[];
}) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.timeline,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      {items.map((item, index) => {
        const accent = toneColor(item.tone ?? "passenger", theme.colors);
        return (
          <View key={`${item.label}-${item.value}`} style={styles.timelineRow}>
            <View style={styles.timelineTrack}>
              <View style={[styles.timelineDot, { borderColor: accent, backgroundColor: theme.colors.surface }]} />
              {index < items.length - 1 ? (
                <View style={[styles.timelineLine, { backgroundColor: theme.colors.border }]} />
              ) : null}
            </View>
            <View
              style={[
                styles.timelineContent,
                index > 0
                  ? {
                      borderTopColor: theme.colors.border,
                      borderTopWidth: StyleSheet.hairlineWidth,
                    }
                  : undefined,
              ]}
            >
              <AppText size="caption" tone="secondary">{item.label}</AppText>
              <AppText weight="bold">{item.value}</AppText>
              {item.detail ? <AppText size="small" tone="secondary">{item.detail}</AppText> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function AppV2MessageRow({
  icon,
  title,
  description,
  meta,
  unread,
  onPress,
  tone = "neutral",
}: {
  icon: AppIconName;
  title: string;
  description: string;
  meta: string;
  unread: boolean;
  onPress: () => void;
  tone?: AppV2Tone;
}) {
  const { theme } = useAppTheme();
  const accent = toneColor(tone, theme.colors);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}，${description}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.messageRow,
        {
          borderBottomColor: theme.colors.border,
          backgroundColor: pressed
            ? theme.colors.surfaceMuted
            : unread
              ? `${accent}0D`
              : theme.colors.surface,
        },
      ]}
    >
      <View style={[styles.messageIcon, { backgroundColor: `${accent}14` }]}>
        <AppIcon name={icon} size={21} color={accent} />
      </View>
      <View style={styles.messageContent}>
        <View style={styles.messageHeading}>
          <AppText weight={unread ? "bold" : "medium"} style={styles.flex}>{title}</AppText>
          <AppText size="caption" tone="secondary">{meta}</AppText>
        </View>
        <AppText size="small" tone="secondary">{description}</AppText>
      </View>
      {unread ? (
        <View
          accessibilityLabel="未读"
          style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]}
        />
      ) : (
        <AppIcon name="chevron-right" size={17} color={theme.colors.textSecondary} />
      )}
    </Pressable>
  );
}

export function AppV2MessageBubble({
  body,
  meta,
  self,
  failed = false,
}: {
  body: string;
  meta: string;
  self: boolean;
  failed?: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.messageBubble,
        self ? styles.messageBubbleSelf : styles.messageBubbleCounterparty,
        {
          borderColor: failed
            ? `${theme.colors.danger}66`
            : self
              ? `${theme.colors.primary}66`
              : theme.colors.border,
          backgroundColor: failed
            ? `${theme.colors.danger}10`
            : self
              ? `${theme.colors.primary}2E`
              : theme.colors.surface,
        },
      ]}
    >
      <AppText>{body}</AppText>
      <AppText size="caption" tone={failed ? "danger" : "secondary"}>{meta}</AppText>
    </View>
  );
}

export function AppV2QuickReply({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickReply,
        {
          borderColor: theme.colors.border,
          backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <AppText size="small">{label}</AppText>
    </Pressable>
  );
}

export function AppV2SummaryList({
  items,
}: {
  items: readonly Readonly<{ label: string; value: string; emphasized?: boolean }>[];
}) {
  const { theme } = useAppTheme();
  return (
    <View
      accessibilityLabel="当前摘要"
      style={[
        styles.summary,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceMuted,
        },
      ]}
    >
      {items.map((item, index) => (
        <View
          key={item.label}
          style={[
            styles.summaryRow,
            index > 0 ? { borderTopColor: theme.colors.border, borderTopWidth: StyleSheet.hairlineWidth } : undefined,
          ]}
        >
          <AppText size="small" tone="secondary">{item.label}</AppText>
          <AppText size={item.emphasized ? "title2" : "body"} weight="bold">{item.value}</AppText>
        </View>
      ))}
    </View>
  );
}

export function AppV2UtilityActions({
  actions,
  tone = "neutral",
}: {
  actions: readonly Readonly<{
    label: string;
    icon: AppIconName;
    onPress: () => void;
  }>[];
  tone?: AppV2Tone;
}) {
  const { theme } = useAppTheme();
  const accent = toneColor(tone, theme.colors);
  return (
    <View style={styles.utilityRow}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.utilityAction,
            {
              borderColor: theme.colors.border,
              backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
            },
          ]}
        >
          <AppIcon name={action.icon} size={20} color={accent} />
          <AppText size="small" weight="bold">{action.label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

export function AppV2StatusPanel({
  title,
  description,
  action,
  tone = "neutral",
}: {
  title: string;
  description: string;
  action?: Readonly<{ label: string; onPress: () => void }>;
  tone?: AppV2Tone;
}) {
  const { theme } = useAppTheme();
  const accent = toneColor(tone, theme.colors);
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.statusPanel,
        {
          borderColor: `${accent}55`,
          backgroundColor: tone === "safety" ? `${theme.colors.danger}12` : theme.colors.surfaceMuted,
        },
      ]}
    >
      <View style={[styles.statusMark, { backgroundColor: accent }]} />
      <View style={styles.flex}>
        <AppText weight="bold">{title}</AppText>
        <AppText size="small" tone="secondary">{description}</AppText>
      </View>
      {action ? <PrimaryButton label={action.label} variant="text" onPress={action.onPress} /> : null}
    </View>
  );
}

export function AppV2EmptyState({
  icon,
  title,
  description,
  action,
  tone = "neutral",
}: {
  icon: AppIconName;
  title: string;
  description: string;
  action?: Readonly<{ label: string; onPress: () => void }>;
  tone?: AppV2Tone;
}) {
  const { theme } = useAppTheme();
  const accent = toneColor(tone, theme.colors);
  return (
    <View accessibilityLabel={`空状态，${title}`} style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: `${accent}16` }]}>
        <AppIcon name={icon} size={28} color={accent} />
      </View>
      <AppText family="display" size="title2" weight="bold" style={styles.centerText}>{title}</AppText>
      <AppText tone="secondary" style={[styles.centerText, styles.emptyDescription]}>{description}</AppText>
      {action ? <PrimaryButton label={action.label} variant="secondary" onPress={action.onPress} /> : null}
    </View>
  );
}

export function AppV2TripContext({
  icon,
  title,
  description,
}: {
  icon: AppIconName;
  title: string;
  description: string;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.tripContext,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceMuted,
        },
      ]}
    >
      <View style={[styles.tripIcon, { backgroundColor: theme.colors.surface }]}>
        <AppIcon name={icon} size={21} />
      </View>
      <View style={styles.flex}>
        <AppText size="small" weight="bold">{title}</AppText>
        <AppText size="caption" tone="secondary">{description}</AppText>
      </View>
    </View>
  );
}

export function AppV2ContactPolicy({
  showLostItemAdvice,
}: {
  showLostItemAdvice: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      accessibilityLabel={
        showLostItemAdvice
          ? "遗失物品建议在行程结束二十四小时内联系。会话将在行程结束七十二小时后关闭。"
          : "会话将在行程结束七十二小时后关闭。"
      }
      style={[
        styles.policy,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      {showLostItemAdvice ? (
        <PolicyRow
          label="24 小时"
          title="遗失物品联系建议"
          description="如发现物品遗失，建议尽快发起联系。"
          color={theme.colors.danger}
        />
      ) : null}
      <PolicyRow
        label="72 小时"
        title="行程会话窗口"
        description="联系窗口将在行程结束 72 小时后关闭。"
        color={theme.colors.text}
      />
    </View>
  );
}

function PolicyRow({
  label,
  title,
  description,
  color,
}: {
  label: string;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <View style={styles.policyRow}>
      <AppText size="caption" weight="bold" style={{ color }}>{label}</AppText>
      <View style={styles.flex}>
        <AppText size="small" weight="bold">{title}</AppText>
        <AppText size="caption" tone="secondary">{description}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stageHeader: { gap: 6 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyebrowMark: { width: 18, height: 3, borderRadius: 999 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeaderTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionHeaderAction: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  fieldFrame: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  fieldIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  placeRow: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
  },
  placeMain: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  placeIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  placeFooter: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
  },
  choiceChip: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 16,
  },
  waitingState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  waitingMarks: {
    minWidth: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  waitingMark: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  driverArrival: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
  },
  driverIdentity: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  driverAvatar: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 999,
  },
  driverAvatarImage: { width: 52, height: 52 },
  driverNameRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  etaBadge: {
    minHeight: 34,
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  vehicleLine: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  vehicleIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  plateText: { letterSpacing: 1.5 },
  pickupCode: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
  },
  pickupCodeHeading: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pickupCodeIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  pickupCodeValue: { letterSpacing: 6, textAlign: "right" },
  metricStrip: {
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
  },
  metricItem: {
    minWidth: 0,
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 14,
  },
  timeline: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  segmentedTabs: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 4,
  },
  segmentedTab: {
    minHeight: 44,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingHorizontal: 6,
  },
  navigationRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
  },
  navigationIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  preferenceTrack: {
    width: 48,
    height: 28,
    justifyContent: "center",
    borderRadius: 999,
    padding: 3,
  },
  preferenceThumb: {
    width: 22,
    height: 22,
    borderRadius: 999,
  },
  applicationProgress: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  applicationStep: {
    minWidth: 0,
    flex: 1,
    gap: 8,
  },
  applicationTrack: {
    flexDirection: "row",
    alignItems: "center",
  },
  applicationDot: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 14,
  },
  applicationLine: {
    height: 1,
    flex: 1,
    marginHorizontal: 6,
  },
  readinessList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    overflow: "hidden",
  },
  readinessRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readinessIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  balanceHero: {
    minHeight: 176,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 24,
  },
  timelineRow: { minHeight: 70, flexDirection: "row", gap: 12 },
  timelineTrack: { width: 16, alignItems: "center" },
  timelineDot: {
    zIndex: 1,
    width: 10,
    height: 10,
    marginTop: 22,
    borderWidth: 2,
    borderRadius: 999,
  },
  timelineLine: {
    position: "absolute",
    top: 31,
    bottom: -22,
    width: StyleSheet.hairlineWidth,
  },
  timelineContent: { minWidth: 0, flex: 1, justifyContent: "center", gap: 3, paddingVertical: 12 },
  messageRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  messageContent: { minWidth: 0, flex: 1, gap: 4 },
  messageHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  unreadDot: { width: 9, height: 9, borderRadius: 999 },
  messageBubble: {
    maxWidth: "82%",
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageBubbleSelf: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  messageBubbleCounterparty: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  quickReply: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
  },
  summary: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingHorizontal: 16 },
  summaryRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  utilityRow: { flexDirection: "row", gap: 12 },
  utilityAction: {
    minHeight: 48,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  statusPanel: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
  },
  statusMark: { width: 4, alignSelf: "stretch", borderRadius: 999 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  centerText: { textAlign: "center" },
  emptyDescription: { maxWidth: 320 },
  tripContext: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
  },
  tripIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  policy: {
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
  },
  policyRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
});
