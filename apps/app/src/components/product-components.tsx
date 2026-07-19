import type { ReactNode } from "react";
import { Platform, TextInput, View } from "react-native";

import { useAppTheme } from "../theme/theme-context";
import { AppText, NavigationRow, PrimaryButton, StatusBanner } from "./ui";

export type ProductTone = "primary" | "passenger" | "owner";

export type ProductProgressItem = Readonly<{
  id: string;
  title: string;
  description: string;
  state: "complete" | "current" | "future";
}>;

export function ProductPageTitle({
  eyebrow,
  title,
  description,
  tone = "primary",
  centered = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  tone?: ProductTone;
  centered?: boolean;
}) {
  return (
    <View style={{ alignItems: centered ? "center" : "flex-start", gap: 8 }}>
      <AppText size="caption" tone={tone} weight="bold">{eyebrow}</AppText>
      <AppText size="title1" weight="bold">{title}</AppText>
      <AppText tone="secondary" style={centered ? { textAlign: "center" } : undefined}>
        {description}
      </AppText>
    </View>
  );
}

export function ProductFormField({
  label,
  value,
  readOnly = false,
  placeholder,
  error,
  helper,
  onBlur,
  onChangeText,
  webInputType,
}: {
  label: string;
  value: string;
  readOnly?: boolean;
  placeholder?: string;
  error?: string;
  helper?: string;
  onBlur?: () => void;
  onChangeText?: (value: string) => void;
  webInputType?: "date";
}) {
  const { theme } = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText weight="bold">{label}</AppText>
      {readOnly ? (
        <View
          accessibilityLabel={`${label}，${value}`}
          style={{
            minHeight: 48,
            justifyContent: "center",
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.small,
            paddingHorizontal: theme.spacing.md,
            backgroundColor: theme.colors.surface,
          }}
        >
          <AppText>{value}</AppText>
        </View>
      ) : (
        <TextInput
          accessibilityLabel={label}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          onBlur={onBlur}
          onChangeText={onChangeText}
          {...(Platform.OS === "web" && webInputType ? ({ type: webInputType } as object) : {})}
          style={{
            minHeight: 48,
            borderWidth: 1,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            borderRadius: theme.radius.small,
            paddingHorizontal: theme.spacing.md,
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
          }}
        />
      )}
      {error ? <AppText size="small" tone="danger">{error}</AppText> : null}
      {!error && helper ? <AppText size="small" tone="secondary">{helper}</AppText> : null}
    </View>
  );
}

export function ProductStatePanel({
  title,
  description,
  tone = "neutral",
}: {
  title: string;
  description: string;
  tone?: "neutral" | "warning" | "success";
}) {
  return <StatusBanner title={title} description={description} tone={tone} />;
}

export function ProductEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: Readonly<{ label: string; onPress: () => void }>;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      accessibilityLabel={`空状态，${title}`}
      style={{
        alignItems: "center",
        gap: theme.spacing.sm,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.medium,
        padding: theme.spacing.xl,
        backgroundColor: theme.colors.surface,
      }}
    >
      <AppText size="title2" weight="bold">{title}</AppText>
      <AppText tone="secondary" style={{ textAlign: "center" }}>{description}</AppText>
      {action ? <PrimaryButton label={action.label} variant="secondary" onPress={action.onPress} /> : null}
    </View>
  );
}

export function ProductListItem({
  title,
  description,
  tone = "primary",
  onPress,
}: {
  title: string;
  description: string;
  tone?: ProductTone;
  onPress: () => void;
}) {
  return <NavigationRow title={title} description={description} tone={tone} onPress={onPress} />;
}

export function ProductProgress({ items }: { items: readonly ProductProgressItem[] }) {
  const { theme } = useAppTheme();
  return (
    <View accessibilityLabel="流程进度" style={{ gap: theme.spacing.lg }}>
      {items.map((item) => (
        <View key={item.id} style={{ flexDirection: "row", gap: theme.spacing.sm }}>
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor:
                item.state === "complete"
                  ? theme.colors.success
                  : item.state === "current"
                    ? theme.colors.primary
                    : theme.colors.border,
            }}
          />
          <View style={{ flex: 1 }}>
            <AppText weight="bold">{item.title}</AppText>
            <AppText size="small" tone="secondary">{item.description}</AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

export function ProductActionBar({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <View
      accessibilityLabel="底部操作栏"
      style={{
        gap: theme.spacing.sm,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        paddingTop: theme.spacing.md,
      }}
    >
      {children}
    </View>
  );
}
