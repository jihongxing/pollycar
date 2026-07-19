import type { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { AppText } from "../ui";
import { useAppTheme } from "../../theme/theme-context";

export function MobilityBottomSheet({
  title,
  description,
  children,
  actions,
  tone = "neutral",
  size = "standard",
  showHandle = false,
}: PropsWithChildren<{
  title?: string;
  description?: string;
  actions?: ReactNode;
  tone?: "passenger" | "driver" | "neutral";
  size?: "compact" | "standard" | "expanded";
  showHandle?: boolean;
}>) {
  const { theme } = useAppTheme();
  const accent =
    tone === "passenger"
      ? theme.colors.passenger
      : tone === "driver"
        ? theme.colors.owner
        : theme.colors.primary;
  const maxHeight = size === "expanded" ? "100%" : size === "compact" ? "46%" : "58%";
  const height = size === "expanded" ? "100%" : undefined;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={title ? `行程面板，${title}` : "行程面板"}
      style={[
        styles.sheet,
        {
          height,
          maxHeight,
          borderTopColor: theme.colors.border,
          borderTopLeftRadius: theme.radius.large,
          borderTopRightRadius: theme.radius.large,
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.deepSurface,
        },
      ]}
    >
      {showHandle ? (
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
        </View>
      ) : null}
      {title || description ? (
        <View style={[styles.heading, { borderLeftColor: accent }]}>
          {title ? <AppText size="title1" weight="bold">{title}</AppText> : null}
          {description ? <AppText tone="secondary">{description}</AppText> : null}
        </View>
      ) : null}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {actions ? (
        <View
          style={[
            styles.actions,
            {
              gap: theme.spacing.sm,
              borderTopColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          {actions}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: "100%",
    minHeight: 176,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingBottom: 16,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 14,
  },
  handleRow: {
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
  },
  heading: {
    gap: 4,
    paddingTop: 4,
    paddingBottom: 12,
  },
  content: {
    flexShrink: 1,
  },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
});
