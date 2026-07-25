import { useCallback, useRef, useState, type PropsWithChildren, type ReactNode } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { readBrowserStorage } from "../infrastructure/browser-storage";
import { useIdentity, type UserIdentity } from "../identity/identity-context";
import { useAppTheme } from "../theme/theme-context";
import { AppIcon, type AppIconName } from "./app-icon";
import {
  environmentIndicatorLabel,
  presentBrandCopy,
  resolveBrandDisplayEnvironment,
} from "../brand/display-environment";
import { resolveMotionProfile } from "../motion/motion";
import { useReducedMotion } from "../motion/use-reduced-motion";
import { useModalFocusManagement } from "../interaction/use-modal-focus-management";

export function AppText({
  children,
  tone = "primary",
  size = "body",
  weight = "regular",
  family = "sans",
  style,
}: PropsWithChildren<{
  tone?: "primary" | "secondary" | "inverse" | "passenger" | "owner" | "danger";
  size?: "caption" | "small" | "body" | "title2" | "title1" | "display";
  weight?: "regular" | "medium" | "bold";
  family?: "sans" | "display";
  style?: StyleProp<TextStyle>;
}>) {
  const { theme } = useAppTheme();
  const presentedChildren = typeof children === "string" ? presentBrandCopy(children) : children;
  if (presentedChildren === undefined || presentedChildren === "") return null;
  const fontScale = resolveQaFontScale();
  const colors = {
    primary: theme.colors.text,
    secondary: theme.colors.textSecondary,
    inverse: theme.colors.inverseText,
    passenger: theme.colors.passenger,
    owner: theme.colors.owner,
    danger: theme.colors.danger,
  };
  const sizes = {
    caption: theme.typography.caption,
    small: theme.typography.bodySmall,
    body: theme.typography.body,
    title2: theme.typography.title2,
    title1: theme.typography.title1,
    display: theme.typography.display,
  };

  return (
    <Text
      style={[
        {
          color: colors[tone],
          fontSize: sizes[size] * fontScale,
          lineHeight: sizes[size] * fontScale * 1.45,
          fontWeight: weight === "bold" ? "700" : weight === "medium" ? "600" : "400",
          fontFamily:
            family === "display"
              ? Platform.select({
                  ios: "Songti SC",
                  android: "serif",
                  web: "Noto Serif SC, Songti SC, serif",
                })
              : Platform.select({
                  ios: "System",
                  android: "sans-serif",
                  web: "Inter, Noto Sans SC, system-ui, sans-serif",
                }),
        },
        style,
      ]}
    >
      {presentedChildren}
    </Text>
  );
}

function resolveQaFontScale(): number {
  if (Platform.OS !== "web") return 1;
  const value = Number(readBrowserStorage("pollycar.qa.font-scale") ?? "1");
  return value === 1.3 || value === 2 ? value : 1;
}

export function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  loadingLabel = "正在处理",
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "text" | "owner" | "danger";
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}) {
  const { theme } = useAppTheme();
  const motion = resolveMotionProfile(useReducedMotion());
  const presentedLabel = presentBrandCopy(label);
  if (!presentedLabel) return null;
  const background =
    variant === "owner"
      ? theme.colors.owner
      : variant === "danger"
        ? theme.colors.danger
      : variant === "primary"
        ? theme.colors.primary
        : variant === "secondary"
          ? theme.colors.surface
          : "transparent";
  const color =
    variant === "owner"
      ? theme.colors.onOwnerAction
      : variant === "danger"
        ? theme.colors.onDangerAction
        : variant === "primary"
          ? theme.colors.onPrimaryAction
          : theme.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 56,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: theme.radius.medium,
          borderWidth: variant === "text" ? 0 : 1,
          borderColor: variant === "secondary" ? theme.colors.border : background,
          backgroundColor:
            disabled || loading
              ? theme.colors.surfaceMuted
              : pressed && variant === "primary"
                ? theme.colors.primaryPressed
                : pressed && variant !== "text"
                  ? theme.colors.surfaceMuted
                  : background,
          paddingHorizontal: theme.spacing.md,
        },
        pressed && !disabled && !loading
          ? { opacity: 0.92, transform: [{ scale: motion.pressedScale }] }
          : undefined,
      ]}
    >
      <AppText
        weight="bold"
        tone={disabled || loading ? "secondary" : "primary"}
        style={disabled || loading ? undefined : { color }}
      >
        {loading ? loadingLabel : presentedLabel}
      </AppText>
    </Pressable>
  );
}

export function SandboxIndicator() {
  const { theme } = useAppTheme();
  const motion = resolveMotionProfile(useReducedMotion());
  const environment = resolveBrandDisplayEnvironment();
  const label = environmentIndicatorLabel(environment);
  if (!label) return null;
  return (
    <View
      accessibilityLabel={environment === "sandbox" ? "当前为内部沙箱，仅使用合成数据" : "当前为演示环境"}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.xxs,
        borderRadius: theme.radius.pill,
        paddingHorizontal: environment === "demo" ? theme.spacing.xs : theme.spacing.sm,
        paddingVertical: environment === "demo" ? theme.spacing.xxs : theme.spacing.xs,
        backgroundColor: environment === "demo" ? "transparent" : theme.colors.surfaceMuted,
        borderWidth: environment === "demo" ? StyleSheet.hairlineWidth : 0,
        borderColor: theme.colors.border,
      }}
    >
      <AppIcon name="safety" size={14} />
      <AppText size="caption" weight={environment === "demo" ? "medium" : "bold"}>{label}</AppText>
    </View>
  );
}

export function ThemeToggle() {
  const { mode, toggleMode, theme } = useAppTheme();
  const next = mode === "light" ? "暗色" : "明亮";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`切换为${next}主题`}
      onPress={toggleMode}
      style={{
        minWidth: 44,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <AppText>{mode === "light" ? "◐" : "☀"}</AppText>
    </Pressable>
  );
}

export function IdentityBadge({
  identity,
  onPress,
}: {
  identity: UserIdentity;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  const motion = resolveMotionProfile(useReducedMotion());
  const isPassenger = identity === "passenger";
  const color = isPassenger ? theme.colors.passenger : theme.colors.owner;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isPassenger ? "打开账户与身份设置" : "当前身份车主，打开身份切换"}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minWidth: 44,
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.xs,
        },
        pressed ? { opacity: 0.84, transform: [{ scale: motion.pressedScale }] } : undefined,
      ]}
    >
      <View
        style={{
          width: 34,
          height: 34,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: theme.radius.pill,
          backgroundColor: `${color}22`,
        }}
      >
        <AppText tone={isPassenger ? "passenger" : "owner"} weight="bold">
          {isPassenger ? "我" : "车"}
        </AppText>
      </View>
      {isPassenger ? null : (
        <View>
          <AppText size="caption" tone="secondary">工作模式</AppText>
          <AppText weight="bold">车主⌄</AppText>
        </View>
      )}
    </Pressable>
  );
}

export function AppShell({
  children,
  onOpenIdentity,
  bottomNavigation,
  immersive = false,
}: PropsWithChildren<{
  onOpenIdentity?: () => void;
  bottomNavigation?: ReactNode;
  immersive?: boolean;
}>) {
  const { theme } = useAppTheme();
  const { activeIdentity } = useIdentity();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {immersive ? null : (
        <View
          style={{
            minHeight: 66,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: theme.spacing.sm,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.border,
            paddingHorizontal: theme.spacing.lg,
            backgroundColor: theme.colors.background,
          }}
        >
          {onOpenIdentity ? (
            <IdentityBadge identity={activeIdentity} onPress={onOpenIdentity} />
          ) : (
            <View style={{ width: 42, height: 42 }} />
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
            <ThemeToggle />
            <SandboxIndicator />
          </View>
        </View>
      )}
      {children}
      {bottomNavigation}
    </View>
  );
}

export function ScreenScroll({ children }: PropsWithChildren) {
  const { theme } = useAppTheme();
  return (
    <ScrollView
      contentContainerStyle={{
        gap: theme.spacing.xl,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.xl,
        paddingBottom: 120,
      }}
    >
      {children}
    </ScrollView>
  );
}

export function StatusBanner({
  title,
  description,
  tone = "neutral",
}: {
  title: string;
  description: string;
  tone?: "neutral" | "warning" | "success";
}) {
  const { theme } = useAppTheme();
  const presentedTitle = presentBrandCopy(title);
  const presentedDescription = presentBrandCopy(description);
  if (!presentedTitle && !presentedDescription) return null;
  const accent =
    tone === "success"
      ? theme.colors.success
      : tone === "warning"
        ? theme.colors.primary
        : theme.colors.textSecondary;
  return (
    <View
      style={{
        flexDirection: "row",
        gap: theme.spacing.sm,
        borderRadius: theme.radius.medium,
        padding: theme.spacing.md,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      <AppText style={{ color: accent }} weight="bold">◇</AppText>
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        {presentedTitle ? <AppText weight="bold">{presentedTitle}</AppText> : null}
        {presentedDescription ? <AppText size="small" tone="secondary">{presentedDescription}</AppText> : null}
      </View>
    </View>
  );
}

export function SectionCard({
  children,
  accent,
}: PropsWithChildren<{ accent?: "passenger" | "owner" }>) {
  const { theme } = useAppTheme();
  const background =
    accent === "owner"
      ? theme.colors.deepSurface
      : accent === "passenger"
        ? theme.colors.deepSurface
        : theme.colors.surface;
  return (
    <View
      style={{
        gap: theme.spacing.md,
        borderRadius: accent ? theme.radius.large : theme.radius.medium,
        borderWidth: accent ? 0 : 1,
        borderColor: theme.colors.border,
        padding: theme.spacing.lg,
        backgroundColor: background,
      }}
    >
      {children}
    </View>
  );
}

export function WorkbenchHeader({
  eyebrow,
  title,
  description,
  tone = "passenger",
}: {
  eyebrow: string;
  title: string;
  description: string;
  tone?: "passenger" | "owner";
}) {
  const { theme } = useAppTheme();
  return (
    <View accessibilityRole="header" style={{ gap: theme.spacing.xs }}>
      <AppText size="caption" tone={tone} weight="bold">{eyebrow}</AppText>
      <AppText size="display" weight="bold">{title}</AppText>
      <AppText tone="secondary">{description}</AppText>
    </View>
  );
}

export function StatusSummary({
  title = "状态摘要",
  items,
}: {
  title?: string;
  items: ReadonlyArray<Readonly<{ label: string; value: string; tone?: "primary" | "passenger" | "owner" | "danger" }>>;
}) {
  const { theme } = useAppTheme();
  return (
    <View accessibilityLabel={title} style={{ gap: theme.spacing.sm }}>
      <AppText size="title2" weight="bold">{title}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        {items.map((item) => (
          <View
            key={item.label}
            style={{
              minWidth: 136,
              flexGrow: 1,
              gap: theme.spacing.xxs,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.medium,
              padding: theme.spacing.md,
              backgroundColor: theme.colors.surface,
            }}
          >
            <AppText size="caption" tone="secondary">{item.label}</AppText>
            <AppText tone={item.tone ?? "primary"} weight="bold">{item.value}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

export function NavigationRow({
  title,
  description,
  onPress,
  tone = "primary",
}: {
  title: string;
  description: string;
  onPress: () => void;
  tone?: "primary" | "passenger" | "owner";
}) {
  const { theme } = useAppTheme();
  const motion = resolveMotionProfile(useReducedMotion());
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}，${description}`}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 72,
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.medium,
          padding: theme.spacing.md,
          backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
        },
        pressed ? { opacity: 0.92, transform: [{ scale: motion.pressedScale }] } : undefined,
      ]}
    >
      <View style={{ flex: 1 }}>
        <AppText tone={tone} weight="bold">{title}</AppText>
        <AppText size="small" tone="secondary">{description}</AppText>
      </View>
      <AppText tone={tone} weight="bold">›</AppText>
    </Pressable>
  );
}

export function BottomNavigation({
  active,
  onNavigate,
}: {
  active: "home" | "messages" | "account";
  onNavigate: (destination: "home" | "messages" | "account") => void;
}) {
  const { theme } = useAppTheme();
  const motion = resolveMotionProfile(useReducedMotion());
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="主导航"
      style={{
        position: "absolute",
        right: 0,
        bottom: 0,
        left: 0,
        minHeight: 70,
        flexDirection: "row",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.xs,
        paddingBottom: theme.spacing.sm,
        backgroundColor: theme.colors.background,
      }}
    >
        {([
          ["home", "首页", "home"],
          ["messages", "消息", "messages"],
          ["account", "我的", "account"],
      ] satisfies readonly [
        "home" | "messages" | "account",
        string,
        AppIconName,
      ][]).map(([destination, label, icon]) => {
        const selected = active === destination;
        return (
          <Pressable
            key={destination}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            {...(Platform.OS === "web" ? ({ "aria-selected": selected } as object) : {})}
            onPress={() => onNavigate(destination)}
            style={({ pressed }) => [
              {
                flex: 1,
                minHeight: 52,
                alignItems: "center",
                justifyContent: "center",
                gap: theme.spacing.xxs,
              },
              pressed ? { opacity: 0.72, transform: [{ scale: motion.pressedScale }] } : undefined,
            ]}
          >
            <AppIcon name={icon} selected={selected} />
            <AppText
              size="caption"
              tone="secondary"
              weight={selected ? "bold" : "regular"}
              style={selected ? { color: theme.colors.text } : undefined}
            >
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function IdentitySwitchSheet({
  visible,
  onClose,
  onApplyOwner,
  onIdentitySelected,
}: {
  visible: boolean;
  onClose: () => void;
  onApplyOwner: () => void;
  onIdentitySelected: (identity: UserIdentity) => void;
}) {
  const { theme } = useAppTheme();
  const { activeIdentity, setActiveIdentity, ownerApproved } = useIdentity();
  const reduceMotion = useReducedMotion();
  const motion = resolveMotionProfile(reduceMotion);
  const sheetRef = useRef<View>(null);
  const [switchingIdentity, setSwitchingIdentity] = useState<UserIdentity>();
  const closeSheet = useCallback(() => {
    if (!switchingIdentity) onClose();
  }, [onClose, switchingIdentity]);
  useModalFocusManagement({
    visible,
    containerRef: sheetRef,
    onEscape: closeSheet,
  });
  const choose = async (identity: UserIdentity) => {
    if (switchingIdentity) return;
    if (identity === "owner" && !ownerApproved) {
      onApplyOwner();
      return;
    }
    setSwitchingIdentity(identity);
    try {
      await setActiveIdentity(identity);
      onIdentitySelected(identity);
      onClose();
    } finally {
      setSwitchingIdentity(undefined);
    }
  };

  return (
    <Modal
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      visible={visible}
      onRequestClose={closeSheet}
      accessibilityViewIsModal={true}
    >
      <Pressable
        accessible={false}
        style={{ flex: 1, backgroundColor: theme.colors.overlay }}
        onPress={closeSheet}
      />
      <View
        ref={sheetRef}
        {...(Platform.OS === "web"
          ? ({
              role: "dialog",
              "aria-modal": true,
              "aria-label": "身份切换面板",
              tabIndex: -1,
            } as object)
          : { accessibilityLabel: "身份切换面板" })}
        style={{
          gap: theme.spacing.md,
          borderTopLeftRadius: theme.radius.large,
          borderTopRightRadius: theme.radius.large,
          padding: theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
          backgroundColor: theme.colors.background,
        }}
      >
        <AppText size="caption" tone="secondary">合成账户 · RG-0007</AppText>
        <AppText size="title1" weight="bold">切换身份</AppText>
        <AppText tone="secondary">切换主题和身份彼此独立，不改变审核、资格或安全限制。</AppText>
        {(["passenger", "owner"] as const).map((identity) => {
          const current = activeIdentity === identity;
          const ownerUnavailable = identity === "owner" && !ownerApproved;
          return (
            <Pressable
              key={identity}
              accessibilityRole="button"
              accessibilityState={{
                disabled: Boolean(switchingIdentity),
                busy: switchingIdentity === identity,
              }}
              accessibilityLabel={`${identity === "passenger" ? "乘客身份" : "车主身份"}，${
                current ? "当前使用" : ownerUnavailable ? "需要完成车辆审核" : "状态正常"
              }`}
              disabled={Boolean(switchingIdentity)}
              onPress={() => void choose(identity)}
              style={({ pressed }) => [
                {
                  minHeight: 72,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: theme.spacing.sm,
                  borderWidth: 1,
                  borderColor: current ? theme.colors.primary : theme.colors.border,
                  borderRadius: theme.radius.medium,
                  padding: theme.spacing.md,
                  backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
                },
                pressed
                  ? { opacity: 0.92, transform: [{ scale: motion.pressedScale }] }
                  : undefined,
              ]}
            >
              <View style={{ flex: 1 }}>
                <AppText weight="bold">{identity === "passenger" ? "乘客" : "车主"}</AppText>
                <AppText size="small" tone="secondary">
                  {current ? "当前使用" : ownerUnavailable ? "需要完成车辆审核" : "状态正常"}
                </AppText>
              </View>
              <AppText
                tone={
                  current ? "primary" : identity === "passenger" ? "passenger" : "owner"
                }
                weight="bold"
              >
                {switchingIdentity === identity
                  ? "正在切换"
                  : current
                    ? "当前"
                    : ownerUnavailable
                      ? "申请 ›"
                      : "切换 ›"}
              </AppText>
            </Pressable>
          );
        })}
        <PrimaryButton
          label="取消"
          variant="text"
          disabled={Boolean(switchingIdentity)}
          onPress={closeSheet}
        />
      </View>
    </Modal>
  );
}
