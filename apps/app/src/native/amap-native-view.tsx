import type { GeoPoint } from "@pollycar/contracts";
import { requireNativeViewManager } from "expo-modules-core";
import type { ComponentType } from "react";
import { Platform, type ViewProps } from "react-native";

export type AmapCameraEvent = Readonly<{
  latitude: number;
  longitude: number;
  zoom: number;
}>;

export type AmapMarker = Readonly<{
  id: string;
  location: GeoPoint;
  kind: "origin" | "destination" | "vehicle" | "selected";
}>;

type NativeAmapViewProps = ViewProps &
  Readonly<{
    centerLatitude: number;
    centerLongitude: number;
    zoom: number;
    markersJson: string;
    interactive: boolean;
    showsUserLocation: boolean;
    onCameraIdle?: (event: { nativeEvent: AmapCameraEvent }) => void;
    onMapPress?: (event: { nativeEvent: AmapCameraEvent }) => void;
  }>;

let NativeAmapView: ComponentType<NativeAmapViewProps> | undefined;

if (Platform.OS !== "web") {
  try {
    NativeAmapView = requireNativeViewManager<NativeAmapViewProps>("PollyCarMap");
  } catch {
    NativeAmapView = undefined;
  }
}

export function isNativeAmapViewAvailable(): boolean {
  return Boolean(NativeAmapView);
}

export function AmapNativeView({
  center,
  zoom = 16,
  markers = [],
  interactive = false,
  showsUserLocation = false,
  onCameraIdle,
  onMapPress,
  ...viewProps
}: ViewProps &
  Readonly<{
    center: GeoPoint;
    zoom?: number;
    markers?: readonly AmapMarker[];
    interactive?: boolean;
    showsUserLocation?: boolean;
    onCameraIdle?: (camera: AmapCameraEvent) => void;
    onMapPress?: (camera: AmapCameraEvent) => void;
  }>) {
  if (!NativeAmapView) return null;
  return (
    <NativeAmapView
      {...viewProps}
      centerLatitude={center.latitude}
      centerLongitude={center.longitude}
      zoom={zoom}
      markersJson={JSON.stringify(markers)}
      interactive={interactive}
      showsUserLocation={showsUserLocation}
      onCameraIdle={onCameraIdle ? (event) => onCameraIdle(event.nativeEvent) : undefined}
      onMapPress={onMapPress ? (event) => onMapPress(event.nativeEvent) : undefined}
    />
  );
}
