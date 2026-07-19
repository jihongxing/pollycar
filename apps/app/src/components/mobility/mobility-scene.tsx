import type { ReactNode } from "react";
import {
  SafeAreaView,
  StyleSheet,
  View,
  useWindowDimensions,
  type DimensionValue,
} from "react-native";

import { useAppTheme } from "../../theme/theme-context";

export function MobilityScene({
  mode,
  map,
  sheet,
  topActions,
  bottomNavigation,
  bottomInset = 0,
  sheetHeight,
  accessibilityLabel,
}: {
  mode: "passenger" | "driver";
  map: ReactNode;
  sheet: ReactNode;
  topActions?: ReactNode;
  bottomNavigation?: ReactNode;
  bottomInset?: number;
  sheetHeight?: DimensionValue;
  accessibilityLabel: string;
}) {
  const { width } = useWindowDimensions();
  const { theme } = useAppTheme();
  const desktop = width >= 768;

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
                borderColor: theme.colors.border,
                borderRightWidth: StyleSheet.hairlineWidth,
                borderLeftWidth: StyleSheet.hairlineWidth,
              }
            : undefined,
        ]}
      >
        <View style={styles.map}>{map}</View>
        {topActions ? (
          <View
            pointerEvents="box-none"
            style={[styles.topActions, { paddingHorizontal: theme.spacing.md }]}
          >
            {topActions}
          </View>
        ) : null}
        <View
          pointerEvents="box-none"
          style={[
            styles.sheet,
            {
              bottom: bottomInset,
              height: sheetHeight,
            },
          ]}
        >
          {sheet}
          {bottomNavigation}
        </View>
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
    overflow: "hidden",
  },
  map: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  topActions: {
    position: "absolute",
    zIndex: 3,
    top: 16,
    right: 0,
    left: 0,
  },
  sheet: {
    position: "absolute",
    zIndex: 2,
    right: 0,
    left: 0,
  },
});
