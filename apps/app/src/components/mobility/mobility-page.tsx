import type { PropsWithChildren, ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";

import { AppText } from "../ui";
import { useAppTheme } from "../../theme/theme-context";
import { MobilityFloatingAction } from "./mobility-floating-action";

export function MobilityPage({
  title,
  onBack,
  trailing,
  hero,
  children,
  actions,
  tone = "passenger",
  accessibilityLabel,
}: PropsWithChildren<{
  title: string;
  onBack?: () => void;
  trailing?: ReactNode;
  hero?: ReactNode;
  actions?: ReactNode;
  tone?: "passenger" | "driver" | "neutral";
  accessibilityLabel: string;
}>) {
  const { width } = useWindowDimensions();
  const { theme } = useAppTheme();
  const desktop = width >= 768;
  const accent =
    tone === "driver"
      ? theme.colors.owner
      : tone === "passenger"
        ? theme.colors.passenger
        : theme.colors.primary;

  return (
    <SafeAreaView
      accessibilityLabel={accessibilityLabel}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View
        style={[
          styles.viewport,
          desktop
            ? {
                width: Math.min(560, width),
                borderRightWidth: StyleSheet.hairlineWidth,
                borderLeftWidth: StyleSheet.hairlineWidth,
                borderColor: theme.colors.border,
              }
            : undefined,
        ]}
      >
        <View
          style={[
            styles.topBar,
            {
              borderBottomColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <View style={styles.topBarSide}>
            {onBack ? (
              <MobilityFloatingAction label="返回" icon="back" onPress={onBack} />
            ) : null}
          </View>
          <AppText size="title2" weight="bold" style={{ textAlign: "center" }}>{title}</AppText>
          <View style={[styles.topBarSide, styles.trailing]}>{trailing}</View>
        </View>
        {hero ? <View style={{ borderBottomColor: accent }}>{hero}</View> : null}
        <ScrollView
          tabIndex={0}
          style={styles.content}
          contentContainerStyle={{
            gap: theme.spacing.lg,
            padding: theme.spacing.lg,
            paddingBottom: actions ? theme.spacing.lg : theme.spacing.xxxl,
          }}
          keyboardShouldPersistTaps="handled"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: "center",
  },
  viewport: {
    flex: 1,
    width: "100%",
    minHeight: 0,
  },
  topBar: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  topBarSide: {
    width: 56,
    minHeight: 48,
    justifyContent: "center",
  },
  trailing: {
    alignItems: "flex-end",
  },
  content: {
    flex: 1,
  },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
});
