import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";

import { useAppTheme } from "../theme/theme-context";

export type AppIconName =
  | "home"
  | "messages"
  | "account"
  | "back"
  | "location"
  | "search"
  | "car"
  | "route"
  | "pickup"
  | "destination"
  | "phone"
  | "safety"
  | "close"
  | "chevron-right"
  | "clock"
  | "people"
  | "wallet"
  | "bank-card"
  | "orders"
  | "send"
  | "theme"
  | "privacy"
  | "help";

export function AppIcon({
  name,
  selected = false,
  size = 22,
  color: colorOverride,
}: {
  name: AppIconName;
  selected?: boolean;
  size?: number;
  color?: string;
}) {
  const { theme } = useAppTheme();
  const color =
    colorOverride ?? (selected ? theme.colors.passenger : theme.colors.textSecondary);
  const strokeWidth = Math.max(1.5, size / 12);
  const line = (style: ViewStyle) => (
    <View style={[{ position: "absolute", backgroundColor: color }, style]} />
  );
  const outline = (style: ViewStyle) => (
    <View
      style={[
        {
          position: "absolute",
          borderWidth: strokeWidth,
          borderColor: color,
        },
        style,
      ]}
    />
  );
  const dot = (style: ViewStyle) => (
    <View style={[{ position: "absolute", borderRadius: size, backgroundColor: color }, style]} />
  );

  let graphic: ReactNode;

  if (name === "home") {
    graphic = (
      <>
        {outline({
          top: size * 0.12,
          left: size * 0.2,
          width: size * 0.6,
          height: size * 0.6,
          borderRightWidth: 0,
          borderBottomWidth: 0,
          transform: [{ rotate: "45deg" }],
        })}
        {outline({
          right: size * 0.22,
          bottom: size * 0.08,
          left: size * 0.22,
          height: size * 0.52,
          borderTopWidth: 0,
          borderBottomLeftRadius: size * 0.08,
          borderBottomRightRadius: size * 0.08,
        })}
      </>
    );
  } else if (name === "messages") {
    graphic = (
      <>
        {outline({
          top: size * 0.15,
          right: size * 0.08,
          bottom: size * 0.22,
          left: size * 0.08,
          borderRadius: size * 0.28,
        })}
        {outline({
          bottom: size * 0.05,
          left: size * 0.28,
          width: size * 0.28,
          height: size * 0.28,
          borderTopWidth: 0,
          borderRightWidth: 0,
          transform: [{ skewY: "-28deg" }],
        })}
      </>
    );
  } else if (name === "account" || name === "people") {
    if (name === "account") {
      graphic = (
        <>
          {outline({
            top: size * 0.08,
            left: size * 0.32,
            width: size * 0.36,
            height: size * 0.36,
            borderRadius: size,
          })}
          {outline({
            right: size * 0.12,
            bottom: size * 0.04,
            left: size * 0.12,
            height: size * 0.44,
            borderTopLeftRadius: size,
            borderTopRightRadius: size,
            borderBottomWidth: 0,
          })}
        </>
      );
    } else {
    graphic = (
      <>
        {outline({
          top: size * 0.07,
          left: size * 0.22,
          width: size * 0.36,
          height: size * 0.36,
          borderRadius: size,
        })}
        {outline({
          top: size * 0.14,
          right: size * 0.13,
          width: size * 0.28,
          height: size * 0.28,
          borderRadius: size,
        })}
        {outline({
          right: size * 0.1,
          bottom: size * 0.04,
          left: size * 0.1,
          height: size * 0.43,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
          borderBottomWidth: 0,
        })}
      </>
    );
    }
  } else if (name === "back" || name === "chevron-right") {
    const direction = name === "back" ? "-45deg" : "135deg";
    graphic = outline({
      top: size * 0.27,
      left: name === "back" ? size * 0.34 : size * 0.22,
      width: size * 0.46,
      height: size * 0.46,
      borderRightWidth: 0,
      borderBottomWidth: 0,
      transform: [{ rotate: direction }],
    });
  } else if (name === "close") {
    graphic = (
      <>
        {line({
          top: size * 0.46,
          left: size * 0.16,
          width: size * 0.68,
          height: strokeWidth,
          borderRadius: strokeWidth,
          transform: [{ rotate: "45deg" }],
        })}
        {line({
          top: size * 0.46,
          left: size * 0.16,
          width: size * 0.68,
          height: strokeWidth,
          borderRadius: strokeWidth,
          transform: [{ rotate: "-45deg" }],
        })}
      </>
    );
  } else if (name === "location" || name === "pickup" || name === "destination") {
    const markerColor =
      name === "pickup"
        ? theme.colors.success
        : name === "destination"
          ? theme.colors.danger
          : color;
    graphic = (
      <>
        <View
          style={{
            position: "absolute",
            top: size * 0.06,
            left: size * 0.21,
            width: size * 0.58,
            height: size * 0.58,
            borderWidth: strokeWidth,
            borderColor: markerColor,
            borderRadius: size,
          }}
        />
        <View
          style={{
            position: "absolute",
            top: size * 0.19,
            left: size * 0.42,
            width: size * 0.16,
            height: size * 0.16,
            borderRadius: size,
            backgroundColor: markerColor,
          }}
        />
        <View
          style={{
            position: "absolute",
            top: size * 0.49,
            left: size * 0.38,
            width: size * 0.24,
            height: size * 0.24,
            borderRightWidth: strokeWidth,
            borderBottomWidth: strokeWidth,
            borderColor: markerColor,
            transform: [{ rotate: "45deg" }],
          }}
        />
      </>
    );
  } else if (name === "search") {
    graphic = (
      <>
        {outline({
          top: size * 0.08,
          left: size * 0.08,
          width: size * 0.56,
          height: size * 0.56,
          borderRadius: size,
        })}
        {line({
          right: size * 0.06,
          bottom: size * 0.16,
          width: size * 0.42,
          height: strokeWidth,
          borderRadius: strokeWidth,
          transform: [{ rotate: "45deg" }],
        })}
      </>
    );
  } else if (name === "car") {
    graphic = (
      <>
        {outline({
          top: size * 0.3,
          right: size * 0.07,
          bottom: size * 0.22,
          left: size * 0.07,
          borderRadius: size * 0.14,
        })}
        {outline({
          top: size * 0.12,
          left: size * 0.2,
          width: size * 0.6,
          height: size * 0.38,
          borderRadius: size * 0.12,
        })}
        {dot({ left: size * 0.17, bottom: size * 0.08, width: size * 0.18, height: size * 0.18 })}
        {dot({ right: size * 0.17, bottom: size * 0.08, width: size * 0.18, height: size * 0.18 })}
      </>
    );
  } else if (name === "route") {
    graphic = (
      <>
        {dot({ top: size * 0.08, left: size * 0.08, width: size * 0.2, height: size * 0.2 })}
        {dot({ right: size * 0.08, bottom: size * 0.08, width: size * 0.2, height: size * 0.2 })}
        {outline({
          top: size * 0.18,
          left: size * 0.18,
          width: size * 0.64,
          height: size * 0.64,
          borderTopWidth: 0,
          borderLeftWidth: 0,
          borderRadius: size * 0.26,
          transform: [{ rotate: "-18deg" }],
        })}
      </>
    );
  } else if (name === "send") {
    graphic = (
      <>
        {line({
          top: size * 0.46,
          left: size * 0.12,
          width: size * 0.7,
          height: strokeWidth,
          borderRadius: strokeWidth,
          transform: [{ rotate: "-24deg" }],
        })}
        {line({
          top: size * 0.24,
          right: size * 0.12,
          width: size * 0.38,
          height: strokeWidth,
          borderRadius: strokeWidth,
          transform: [{ rotate: "44deg" }],
        })}
        {line({
          right: size * 0.14,
          bottom: size * 0.2,
          width: size * 0.38,
          height: strokeWidth,
          borderRadius: strokeWidth,
          transform: [{ rotate: "-62deg" }],
        })}
      </>
    );
  } else if (name === "phone") {
    graphic = outline({
      top: size * 0.1,
      left: size * 0.27,
      width: size * 0.46,
      height: size * 0.8,
      borderRadius: size * 0.2,
    });
  } else if (name === "safety" || name === "privacy") {
    graphic = (
      <>
        {outline({
          top: size * 0.05,
          left: size * 0.16,
          width: size * 0.68,
          height: size * 0.82,
          borderTopLeftRadius: size * 0.36,
          borderTopRightRadius: size * 0.36,
          borderBottomLeftRadius: size * 0.3,
          borderBottomRightRadius: size * 0.3,
        })}
        {name === "privacy"
          ? outline({
              top: size * 0.34,
              left: size * 0.36,
              width: size * 0.28,
              height: size * 0.26,
              borderRadius: size * 0.08,
            })
          : line({
              top: size * 0.46,
              left: size * 0.34,
              width: size * 0.32,
              height: strokeWidth,
              transform: [{ rotate: "-45deg" }],
            })}
      </>
    );
  } else if (name === "clock") {
    graphic = (
      <>
        {outline({ inset: size * 0.08, borderRadius: size })}
        {line({ top: size * 0.22, left: size * 0.47, width: strokeWidth, height: size * 0.3 })}
        {line({
          top: size * 0.5,
          left: size * 0.48,
          width: size * 0.24,
          height: strokeWidth,
          transform: [{ rotate: "28deg" }],
          transformOrigin: "left",
        })}
      </>
    );
  } else if (name === "wallet") {
    graphic = (
      <>
        {outline({ top: size * 0.17, right: size * 0.05, bottom: size * 0.12, left: size * 0.05, borderRadius: size * 0.12 })}
        {outline({ top: size * 0.38, right: size * 0.03, width: size * 0.42, height: size * 0.28, borderRadius: size * 0.08 })}
        {dot({ top: size * 0.49, right: size * 0.29, width: strokeWidth * 1.5, height: strokeWidth * 1.5 })}
      </>
    );
  } else if (name === "bank-card") {
    graphic = (
      <>
        {outline({ top: size * 0.15, right: size * 0.04, bottom: size * 0.15, left: size * 0.04, borderRadius: size * 0.12 })}
        {line({ top: size * 0.34, left: size * 0.05, right: size * 0.05, height: strokeWidth * 1.5 })}
        {line({ left: size * 0.16, bottom: size * 0.28, width: size * 0.28, height: strokeWidth })}
      </>
    );
  } else if (name === "orders") {
    graphic = (
      <>
        {outline({ top: size * 0.08, right: size * 0.12, bottom: size * 0.08, left: size * 0.12, borderRadius: size * 0.08 })}
        {line({ top: size * 0.3, left: size * 0.26, width: size * 0.48, height: strokeWidth })}
        {line({ top: size * 0.5, left: size * 0.26, width: size * 0.48, height: strokeWidth })}
        {line({ top: size * 0.7, left: size * 0.26, width: size * 0.34, height: strokeWidth })}
      </>
    );
  } else if (name === "theme") {
    graphic = (
      <>
        {outline({ inset: size * 0.09, borderRadius: size })}
        <View
          style={{
            position: "absolute",
            top: size * 0.04,
            right: size * 0.04,
            width: size * 0.55,
            height: size * 0.55,
            borderRadius: size,
            backgroundColor: theme.colors.floatingSurface,
          }}
        />
      </>
    );
  } else {
    graphic = (
      <>
        {outline({ inset: size * 0.08, borderRadius: size })}
        {outline({
          top: size * 0.22,
          left: size * 0.37,
          width: size * 0.28,
          height: size * 0.28,
          borderLeftWidth: 0,
          borderBottomWidth: 0,
          borderRadius: size,
          transform: [{ rotate: "-22deg" }],
        })}
        {dot({ left: size * 0.45, bottom: size * 0.2, width: size * 0.1, height: size * 0.1 })}
      </>
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      {graphic}
    </View>
  );
}
