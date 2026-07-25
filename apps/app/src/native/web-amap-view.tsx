import type { GeoPoint } from "@pollycar/contracts";
import { useEffect, useRef } from "react";
import { Platform, View, type ViewProps } from "react-native";

import {
  ensureWebAmapContainerLayout,
  loadWebAmapSdk,
  resolveWebAmapConfiguration,
  type WebAmapMap,
} from "./web-amap-loader";
import type { AmapCameraEvent } from "./amap-native-view";

export function isWebAmapViewConfigured(): boolean {
  return Platform.OS === "web" && Boolean(resolveWebAmapConfiguration());
}

export function WebAmapView({
  center,
  zoom = 16,
  interactive = false,
  onCameraIdle,
  onMapPress,
  onReady,
  onError,
  ...viewProps
}: ViewProps &
  Readonly<{
    center: GeoPoint;
    zoom?: number;
    interactive?: boolean;
    onCameraIdle?: (camera: AmapCameraEvent) => void;
    onMapPress?: (camera: AmapCameraEvent) => void;
    onReady?: () => void;
    onError?: () => void;
  }>) {
  const containerRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<WebAmapMap | null>(null);
  const cameraIdleRef = useRef(onCameraIdle);
  const mapPressRef = useRef(onMapPress);
  const readyRef = useRef(onReady);
  const errorRef = useRef(onError);
  cameraIdleRef.current = onCameraIdle;
  mapPressRef.current = onMapPress;
  readyRef.current = onReady;
  errorRef.current = onError;

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const configuration = resolveWebAmapConfiguration();
    const container = containerRef.current;
    if (!configuration || !container) {
      errorRef.current?.();
      return;
    }

    let cancelled = false;
    let map: WebAmapMap | undefined;
    ensureWebAmapContainerLayout(container);
    const emitCamera = () => {
      if (!map) return;
      const current = map.getCenter();
      cameraIdleRef.current?.({
        latitude: current.getLat(),
        longitude: current.getLng(),
        zoom: map.getZoom(),
      });
    };
    const handleMapPress = (event?: unknown) => {
      const lnglat = (
        event as { lnglat?: { getLat(): number; getLng(): number } } | undefined
      )?.lnglat;
      if (!lnglat || !map) return;
      mapPressRef.current?.({
        latitude: lnglat.getLat(),
        longitude: lnglat.getLng(),
        zoom: map.getZoom(),
      });
    };

    void loadWebAmapSdk(configuration)
      .then((AMap) => {
        if (cancelled) return;
        map = new AMap.Map(container, {
          center: [center.longitude, center.latitude],
          dragEnable: interactive,
          jogEnable: interactive,
          pitchEnable: false,
          rotateEnable: false,
          viewMode: "2D",
          zoom,
          zoomEnable: interactive,
        });
        ensureWebAmapContainerLayout(container);
        mapRef.current = map;
        map.on("moveend", emitCamera);
        map.on("zoomend", emitCamera);
        map.on("click", handleMapPress);
        requestAnimationFrame(() => {
          if (cancelled) return;
          map?.resize();
          readyRef.current?.();
        });
      })
      .catch(() => {
        if (!cancelled) errorRef.current?.();
      });

    return () => {
      cancelled = true;
      if (map) {
        map.off("moveend", emitCamera);
        map.off("zoomend", emitCamera);
        map.off("click", handleMapPress);
        map.destroy();
      }
      mapRef.current = null;
    };
  }, [interactive, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = map.getCenter();
    if (
      Math.abs(current.getLat() - center.latitude) < 0.000001 &&
      Math.abs(current.getLng() - center.longitude) < 0.000001
    ) {
      return;
    }
    map.setCenter([center.longitude, center.latitude]);
  }, [center.latitude, center.longitude]);

  if (Platform.OS !== "web") return null;
  return (
    <View
      {...viewProps}
      ref={(instance) => {
        containerRef.current = instance as unknown as HTMLElement;
      }}
    />
  );
}
