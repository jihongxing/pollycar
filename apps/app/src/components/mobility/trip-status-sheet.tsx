import type { PropsWithChildren } from "react";
import { View } from "react-native";

import { AppText } from "../ui";
import { useAppTheme } from "../../theme/theme-context";

export function TripStatusSheet({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: string }>) {
  const { theme } = useAppTheme();
  return (
    <View
      style={{
        gap: theme.spacing.md,
        padding: theme.spacing.lg,
        borderRadius: theme.radius.large,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <AppText size="title1" weight="bold">{title}</AppText>
        {description ? <AppText tone="secondary">{description}</AppText> : null}
      </View>
      {children}
    </View>
  );
}
