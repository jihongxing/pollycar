import { Pressable, StyleSheet } from "react-native";

import { AppIcon, type AppIconName } from "../app-icon";
import { useAppTheme } from "../../theme/theme-context";
import { resolveMotionProfile } from "../../motion/motion";
import { useReducedMotion } from "../../motion/use-reduced-motion";

export function MobilityFloatingAction({
  label,
  icon,
  onPress,
  tone = "neutral",
  disabled = false,
}: {
  label: string;
  icon: AppIconName;
  onPress: () => void;
  tone?: "neutral" | "passenger" | "driver" | "danger";
  disabled?: boolean;
}) {
  const { theme } = useAppTheme();
  const motion = resolveMotionProfile(useReducedMotion());
  const iconColor =
    tone === "passenger"
      ? theme.colors.passenger
      : tone === "driver"
        ? theme.colors.owner
        : tone === "danger"
          ? theme.colors.danger
          : theme.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 48,
          height: 48,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.pill,
          backgroundColor:
            disabled || pressed ? theme.colors.surfaceMuted : theme.colors.floatingSurface,
          opacity: disabled ? 0.62 : pressed ? 0.9 : 1,
          shadowColor: theme.colors.deepSurface,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 16,
          elevation: 6,
        },
        pressed && !disabled ? { transform: [{ scale: motion.pressedScale }] } : undefined,
      ]}
    >
      <AppIcon name={icon} size={22} color={disabled ? theme.colors.textSecondary : iconColor} />
    </Pressable>
  );
}
