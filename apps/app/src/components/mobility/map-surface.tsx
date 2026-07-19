import type { PropsWithChildren } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { AppText } from "../ui";
import { useAppTheme } from "../../theme/theme-context";

export type MapSurfaceVariant = "card" | "stage";
export type MapScene = "home" | "route" | "pickup" | "active";

export function MapSurface({
  children,
  originLabel,
  destinationLabel,
  statusLabel,
  tone = "passenger",
  variant = "card",
  scene = "route",
  style,
}: PropsWithChildren<{
  originLabel?: string;
  destinationLabel?: string;
  statusLabel?: string;
  tone?: "passenger" | "driver" | "neutral";
  variant?: MapSurfaceVariant;
  scene?: MapScene;
  style?: StyleProp<ViewStyle>;
}>) {
  const { theme } = useAppTheme();
  const stage = variant === "stage";

  if (!stage) {
    return (
      <View
        accessibilityLabel="合成地图预览，未使用真实定位"
        style={[
          styles.surface,
          styles.card,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.large,
          },
          style,
        ]}
      >
        <View style={styles.legacyGrid}>
          {Array.from({ length: 6 }, (_, index) => (
            <View
              key={`road-${index}`}
              style={[
                styles.legacyRoad,
                {
                  backgroundColor: theme.colors.border,
                  left: `${8 + index * 17}%`,
                  transform: [{ rotate: index % 2 === 0 ? "18deg" : "-22deg" }],
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.legacyTopRow}>
          <View />
          {statusLabel ? (
            <View style={[styles.legacyStatus, { backgroundColor: theme.colors.surface }]}>
              <AppText size="caption" weight="bold">{statusLabel}</AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.legacyRoute}>
          <View style={[styles.marker, { backgroundColor: theme.colors.success }]} />
          <View style={[styles.routeLine, { backgroundColor: theme.colors.primary }]} />
          <View style={[styles.marker, { backgroundColor: theme.colors.danger }]} />
        </View>
        <View style={styles.legacyLabels}>
          {originLabel ? <AppText size="small" weight="bold">{originLabel}</AppText> : null}
          {destinationLabel ? <AppText size="small" weight="bold">{destinationLabel}</AppText> : null}
        </View>
        {children}
      </View>
    );
  }

  return (
    <View
      accessibilityLabel="城市地图场景"
      style={[
        styles.surface,
        stage ? styles.stage : styles.card,
        {
          backgroundColor: stage ? theme.colors.mapSurface : theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
          borderRadius: stage ? 0 : theme.radius.large,
        },
        style,
      ]}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.district, styles.districtNorth, { borderColor: theme.colors.mapRoadMuted }]} />
        <View style={[styles.district, styles.districtWest, { borderColor: theme.colors.mapRoadMuted }]} />
        <View style={[styles.district, styles.districtEast, { borderColor: theme.colors.mapRoadMuted }]} />
        <View style={[styles.park, { backgroundColor: `${theme.colors.success}18` }]} />
        <View
          style={[
            styles.water,
            {
              backgroundColor: theme.colors.mapWater,
              opacity: stage ? 0.72 : 0.38,
            },
          ]}
        />
        {([
          { left: "10%", width: 22, rotate: "8deg" },
          { left: "34%", width: 12, rotate: "-4deg" },
          { left: "58%", width: 20, rotate: "12deg" },
          { left: "82%", width: 12, rotate: "-7deg" },
        ] satisfies readonly Readonly<{ left: ViewStyle["left"]; width: number; rotate: string }>[]).map((road, index) => (
          <View
            key={`road-${index}`}
            style={[
              styles.road,
              {
                backgroundColor: index % 2 === 0 ? theme.colors.mapRoad : theme.colors.mapRoadMuted,
                left: road.left,
                width: road.width,
                transform: [{ rotate: road.rotate }],
              },
            ]}
          />
        ))}
        {stage
          ? ([
              { top: "18%", height: 14, rotate: "-3deg" },
              { top: "43%", height: 20, rotate: "2deg" },
              { top: "68%", height: 12, rotate: "-2deg" },
            ] satisfies readonly Readonly<{ top: ViewStyle["top"]; height: number; rotate: string }>[]).map((road, index) => (
              <View
                key={`cross-road-${index}`}
                style={[
                  styles.crossRoad,
                  {
                    height: road.height,
                    backgroundColor: index === 1 ? theme.colors.mapRoad : theme.colors.mapRoadMuted,
                    top: road.top,
                    transform: [{ rotate: road.rotate }],
                  },
                ]}
              />
            ))
          : null}
        {stage ? (
          <>
            <View style={[styles.mapLabel, styles.mapLabelPrimary, { backgroundColor: theme.colors.floatingSurface }]}>
              <AppText size="caption" weight="bold">人民广场</AppText>
            </View>
            <View style={styles.mapLabelSecondary}>
              <AppText size="caption" tone="secondary">西藏中路</AppText>
            </View>
          </>
        ) : null}
      </View>

      {statusLabel ? (
        <View
          style={[
            styles.status,
            {
              top: stage ? 18 : 16,
              right: stage ? undefined : 16,
              left: stage ? 78 : undefined,
              backgroundColor: stage ? theme.colors.floatingSurface : theme.colors.surface,
            },
          ]}
        >
          <AppText size="caption" weight="bold">{statusLabel}</AppText>
        </View>
      ) : null}

      {scene !== "home" || originLabel || destinationLabel ? (
        <View
          style={[
            styles.route,
            scene === "pickup" && styles.pickupRoute,
            scene === "active" && styles.activeRoute,
          ]}
        >
          <View style={[styles.marker, { backgroundColor: theme.colors.success }]} />
          <View style={[styles.routeLine, { backgroundColor: theme.colors.primary }]} />
          <View style={[styles.marker, { backgroundColor: theme.colors.danger }]} />
        </View>
      ) : (
        <View
          style={[
            styles.currentLocation,
            {
              borderColor: theme.colors.floatingSurface,
              backgroundColor:
                tone === "driver"
                  ? theme.colors.owner
                  : tone === "neutral"
                    ? theme.colors.primary
                    : theme.colors.passenger,
            },
          ]}
        />
      )}

      {originLabel || destinationLabel ? (
        <View
          style={[
            styles.labels,
            stage
              ? {
                  left: 18,
                  bottom: 18,
                  backgroundColor: theme.colors.floatingSurface,
                  borderRadius: theme.radius.medium,
                }
              : undefined,
          ]}
        >
          {originLabel ? <AppText size="small" weight="bold">{originLabel}</AppText> : null}
          {destinationLabel ? <AppText size="small" weight="bold">{destinationLabel}</AppText> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    overflow: "hidden",
    justifyContent: "space-between",
  },
  card: {
    minHeight: 280,
    borderWidth: 1,
    padding: 16,
  },
  stage: {
    flex: 1,
    minHeight: 420,
    borderWidth: 0,
  },
  legacyGrid: {
    position: "absolute",
    inset: 0,
    opacity: 0.55,
  },
  legacyRoad: {
    position: "absolute",
    width: 18,
    height: "150%",
    top: "-25%",
  },
  legacyTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  legacyStatus: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  legacyRoute: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    width: "72%",
  },
  legacyLabels: {
    gap: 4,
  },
  water: {
    position: "absolute",
    top: "-12%",
    right: "-18%",
    width: "42%",
    height: "128%",
    borderRadius: 999,
    transform: [{ rotate: "12deg" }],
  },
  district: {
    position: "absolute",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    opacity: 0.5,
  },
  districtNorth: { top: "5%", left: "8%", width: "34%", height: "24%", transform: [{ rotate: "-4deg" }] },
  districtWest: { top: "34%", left: "-6%", width: "42%", height: "28%", transform: [{ rotate: "7deg" }] },
  districtEast: { top: "26%", right: "8%", width: "36%", height: "30%", transform: [{ rotate: "-3deg" }] },
  park: {
    position: "absolute",
    top: "55%",
    right: "9%",
    width: "24%",
    height: "17%",
    borderRadius: 30,
    transform: [{ rotate: "-8deg" }],
  },
  road: {
    position: "absolute",
    height: "150%",
    top: "-25%",
    opacity: 0.82,
  },
  crossRoad: {
    position: "absolute",
    left: "-10%",
    width: "120%",
    opacity: 0.72,
  },
  mapLabel: {
    position: "absolute",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapLabelPrimary: { top: "29%", left: "47%" },
  mapLabelSecondary: { position: "absolute", top: "61%", left: "21%", transform: [{ rotate: "-5deg" }] },
  status: {
    position: "absolute",
    zIndex: 2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  route: {
    position: "absolute",
    top: "46%",
    left: "14%",
    right: "14%",
    flexDirection: "row",
    alignItems: "center",
    transform: [{ rotate: "-8deg" }],
  },
  pickupRoute: {
    top: "58%",
    left: "24%",
    right: "10%",
    transform: [{ rotate: "-24deg" }],
  },
  activeRoute: {
    top: "36%",
    left: "8%",
    right: "20%",
    transform: [{ rotate: "16deg" }],
  },
  marker: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  routeLine: {
    height: 5,
    flex: 1,
    borderRadius: 999,
  },
  currentLocation: {
    position: "absolute",
    top: "46%",
    left: "48%",
    width: 22,
    height: 22,
    borderWidth: 5,
    borderRadius: 999,
  },
  labels: {
    position: "absolute",
    right: 16,
    bottom: 16,
    left: 16,
    gap: 4,
    padding: 12,
  },
});
