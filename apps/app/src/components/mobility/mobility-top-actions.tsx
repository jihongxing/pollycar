import type { ReactNode } from "react";
import { View } from "react-native";

import { useAppTheme } from "../../theme/theme-context";

export function MobilityTopActions({
  leading,
  trailing,
}: {
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      pointerEvents="box-none"
      style={{
        width: "100%",
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: theme.spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>{leading}</View>
      <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>{trailing}</View>
    </View>
  );
}
