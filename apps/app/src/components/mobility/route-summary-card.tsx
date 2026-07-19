import { StyleSheet, View } from "react-native";

import { AppText } from "../ui";
import { useAppTheme } from "../../theme/theme-context";

export function RouteSummaryCard({
  originLabel,
  destinationLabel,
  passengerCount,
  durationLabel,
  distanceLabel,
}: {
  originLabel: string;
  destinationLabel: string;
  passengerCount: number;
  durationLabel?: string;
  distanceLabel?: string;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceMuted,
        },
      ]}
    >
      <View style={styles.route}>
        <View style={styles.routeRail}>
          <View style={[styles.routeDot, { backgroundColor: theme.colors.passenger }]} />
          <View style={[styles.routeLine, { backgroundColor: theme.colors.border }]} />
          <View style={[styles.routeDot, { borderColor: theme.colors.danger }]} />
        </View>
        <View style={styles.routeContent}>
          <RouteLine label="上车点" value={originLabel} />
          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
          <RouteLine label="目的地" value={destinationLabel} />
        </View>
      </View>
      <View style={[styles.meta, { borderTopColor: theme.colors.border }]}>
          <AppText size="small" tone="secondary">{passengerCount} 人乘车</AppText>
          {durationLabel ? <AppText size="small" tone="secondary">{durationLabel}</AppText> : null}
          {distanceLabel ? <AppText size="small" tone="secondary">{distanceLabel}</AppText> : null}
      </View>
    </View>
  );
}

function RouteLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.routeRow}>
      <AppText size="caption" tone="secondary">{label}</AppText>
      <AppText weight="bold">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  route: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 14,
  },
  routeRail: {
    width: 12,
    alignItems: "center",
    paddingVertical: 5,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderWidth: 2,
    borderRadius: 999,
  },
  routeLine: {
    width: 1,
    flex: 1,
    minHeight: 28,
  },
  routeContent: {
    flex: 1,
    gap: 10,
  },
  routeRow: {
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  meta: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
