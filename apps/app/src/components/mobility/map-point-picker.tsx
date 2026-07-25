import type { GeoPoint, MapPlace } from "@pollycar/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, View } from "react-native";

import { AppIcon } from "../app-icon";
import { AppText, PrimaryButton } from "../ui";
import { AmapNativeView, isNativeAmapViewAvailable } from "../../native/amap-native-view";
import { nativeMapModule } from "../../native/map-native-module";
import {
  isWebAmapViewConfigured,
  WebAmapView,
} from "../../native/web-amap-view";
import { useAppTheme } from "../../theme/theme-context";
import { MapSurface } from "./map-surface";

const fallbackCenter: GeoPoint = {
  latitude: 31.2304,
  longitude: 121.4737,
  coordinateSystem: "gcj02",
};

export function MapPointPicker({
  title,
  initialPoint,
  onCancel,
  onConfirm,
  onLocate,
  reverseGeocode,
}: Readonly<{
  title: string;
  initialPoint?: GeoPoint;
  onCancel: () => void;
  onConfirm: (place: MapPlace) => void;
  onLocate: () => Promise<GeoPoint | undefined>;
  reverseGeocode: (point: GeoPoint) => Promise<MapPlace>;
}>) {
  const { theme } = useAppTheme();
  const [center, setCenter] = useState(initialPoint ?? fallbackCenter);
  const [place, setPlace] = useState<MapPlace>();
  const [resolving, setResolving] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string>();
  const [mapError, setMapError] = useState<string>();
  const amapRequested = useMemo(
    () =>
      (nativeMapModule.provider === "amap" && isNativeAmapViewAvailable()) ||
      isWebAmapViewConfigured(),
    [],
  );
  const [privacyReady, setPrivacyReady] = useState(() => !amapRequested);
  const [privacyInitializing, setPrivacyInitializing] = useState(false);
  const [webMapFailed, setWebMapFailed] = useState(false);
  const [webMapReady, setWebMapReady] = useState(false);
  const dragStart = useRef(center);
  const nativeAvailable = useMemo(
    () => privacyReady && nativeMapModule.provider === "amap" && isNativeAmapViewAvailable(),
    [privacyReady],
  );
  const webAvailable = privacyReady && isWebAmapViewConfigured() && !webMapFailed;
  const realMapAvailable = nativeAvailable || webAvailable;

  useEffect(() => {
    const timer = setTimeout(() => {
      setResolving(true);
      setError(undefined);
      void reverseGeocode(center)
        .then(setPlace)
        .catch(() => {
          setPlace({
            placeId: `manual-pin-${center.latitude.toFixed(6)}-${center.longitude.toFixed(6)}`,
            name: "地图选定位置",
            formattedAddress: "已在地图上选定的位置",
            location: center,
            kind: "manual_pin",
            source: "manual",
            provider: "synthetic",
          });
          setError("暂时无法识别详细地址，你仍可使用这个位置。");
        })
        .finally(() => setResolving(false));
    }, 450);
    return () => clearTimeout(timer);
  }, [center, reverseGeocode]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !realMapAvailable,
        onMoveShouldSetPanResponder: (_, gesture) =>
          !realMapAvailable && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => {
          dragStart.current = center;
        },
        onPanResponderMove: (_, gesture) => {
          const latitude = dragStart.current.latitude + gesture.dy * 0.000025;
          const longitude = dragStart.current.longitude - gesture.dx * 0.000025;
          setCenter({
            latitude: Number(latitude.toFixed(6)),
            longitude: Number(longitude.toFixed(6)),
            coordinateSystem: "gcj02",
          });
        },
      }),
    [center, realMapAvailable],
  );

  const locate = async () => {
    setLocating(true);
    setError(undefined);
    try {
      const point = await onLocate();
      if (point) {
        setCenter(point);
      } else {
        setError("暂时无法获取当前位置，请拖动地图选择位置。");
      }
    } catch {
      setError("暂时无法获取当前位置，请拖动地图选择位置。");
    } finally {
      setLocating(false);
    }
  };
  const enableAmap = async () => {
    setPrivacyInitializing(true);
    try {
      if (nativeMapModule.provider === "amap") {
        await nativeMapModule.initializePrivacy({
          noticeContainsAmapPolicy: true,
          noticeShown: true,
          consentGranted: true,
        });
      }
      setMapError(undefined);
      setWebMapFailed(false);
      setPrivacyReady(true);
    } catch {
      setError("暂时无法打开地图，请稍后重试或使用手动输入。");
    } finally {
      setPrivacyInitializing(false);
    }
  };

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回地点选择"
          onPress={onCancel}
          style={[styles.iconButton, { backgroundColor: theme.colors.surface }]}
        >
          <AppIcon name="back" size={20} />
        </Pressable>
        <View style={styles.headerText}>
          <AppText size="title2" weight="bold">{title}</AppText>
          <AppText size="small" tone="secondary">移动地图，让准星对准准确位置</AppText>
        </View>
      </View>

      <View
        {...(!realMapAvailable ? panResponder.panHandlers : {})}
        style={[styles.map, { borderColor: theme.colors.border }]}
      >
        {nativeAvailable ? (
          <AmapNativeView
            style={StyleSheet.absoluteFill}
            center={center}
            interactive
            showsUserLocation={nativeMapModule.gates.realDeviceLocationEnabled}
            onCameraIdle={(camera) =>
              setCenter({
                latitude: Number(camera.latitude.toFixed(6)),
                longitude: Number(camera.longitude.toFixed(6)),
                coordinateSystem: "gcj02",
              })
            }
            onMapPress={(camera) =>
              setCenter({
                latitude: Number(camera.latitude.toFixed(6)),
                longitude: Number(camera.longitude.toFixed(6)),
                coordinateSystem: "gcj02",
              })
            }
          />
        ) : webAvailable ? (
          <WebAmapView
            style={StyleSheet.absoluteFill}
            center={center}
            interactive
            onReady={() => setWebMapReady(true)}
            onError={() => {
              setWebMapFailed(true);
              setWebMapReady(false);
              setMapError("地图暂时没有加载成功，已切换到可拖动的地图背景。");
            }}
            onCameraIdle={(camera) =>
              setCenter({
                latitude: Number(camera.latitude.toFixed(6)),
                longitude: Number(camera.longitude.toFixed(6)),
                coordinateSystem: "gcj02",
              })
            }
            onMapPress={(camera) =>
              setCenter({
                latitude: Number(camera.latitude.toFixed(6)),
                longitude: Number(camera.longitude.toFixed(6)),
                coordinateSystem: "gcj02",
              })
            }
          />
        ) : (
          <MapSurface variant="stage" scene="home" tone="passenger" style={StyleSheet.absoluteFill} />
        )}
        {webAvailable && !webMapReady ? (
          <View pointerEvents="none" style={[styles.mapStatus, { backgroundColor: theme.colors.surface }]}>
            <AppText size="small" weight="bold">正在加载地图</AppText>
          </View>
        ) : null}
        <View pointerEvents="none" style={styles.crosshair}>
          <View style={[styles.pin, { backgroundColor: theme.colors.primary }]}>
            <AppIcon name="location" size={20} color={theme.colors.onPrimaryAction} />
          </View>
          <View style={[styles.pinTip, { borderTopColor: theme.colors.primary }]} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="定位到当前位置"
          disabled={locating}
          onPress={() => void locate()}
          style={[styles.locateButton, { backgroundColor: theme.colors.surface }]}
        >
          <AppIcon name="location" size={20} />
          <AppText size="small" weight="bold">{locating ? "定位中" : "我的位置"}</AppText>
        </Pressable>
      </View>

      <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
        <AppText size="caption" tone="secondary">{resolving ? "正在确认位置" : "已选择"}</AppText>
        <AppText size="title2" weight="bold">{place?.name ?? "地图选定位置"}</AppText>
        <AppText tone="secondary">
          {place?.formattedAddress ?? "拖动地图，选择准确位置"}
        </AppText>
        {mapError ? <AppText size="small" tone="secondary">{mapError}</AppText> : null}
        {error ? <AppText size="small" tone="secondary">{error}</AppText> : null}
        {amapRequested && !privacyReady ? (
          <>
            <AppText size="small" tone="secondary">
              地图服务由高德地图提供。继续使用前，请确认已阅读位置服务说明与高德隐私政策。
            </AppText>
            <PrimaryButton
              label="同意并使用地图"
              loading={privacyInitializing}
              loadingLabel="正在打开地图"
              onPress={() => void enableAmap()}
            />
          </>
        ) : (
          <PrimaryButton
            label="确认这个位置"
            disabled={!place || resolving}
            loading={resolving}
            loadingLabel="正在确认位置"
            onPress={() => place && onConfirm(place)}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 640,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  map: {
    flex: 1,
    minHeight: 390,
    marginHorizontal: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 24,
  },
  crosshair: {
    position: "absolute",
    top: "50%",
    left: "50%",
    alignItems: "center",
    transform: [{ translateX: -22 }, { translateY: -44 }],
  },
  pin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pinTip: {
    width: 0,
    height: 0,
    borderRightWidth: 7,
    borderLeftWidth: 7,
    borderTopWidth: 12,
    borderRightColor: "transparent",
    borderLeftColor: "transparent",
  },
  locateButton: {
    position: "absolute",
    right: 16,
    bottom: 16,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
  mapStatus: {
    position: "absolute",
    top: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  sheet: {
    gap: 8,
    margin: 12,
    padding: 16,
    borderRadius: 24,
  },
});
