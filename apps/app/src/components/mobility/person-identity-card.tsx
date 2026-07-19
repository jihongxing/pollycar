import { Image, View } from "react-native";

import { AppText, SectionCard } from "../ui";
import { useAppTheme } from "../../theme/theme-context";

export type PublicGenderDisplay = "female" | "male" | "undisclosed";

export function PersonIdentityCard({
  name,
  gender = "undisclosed",
  ratingLabel,
  subtitle,
  avatarUrl,
}: {
  name: string;
  gender?: PublicGenderDisplay;
  ratingLabel?: string;
  subtitle?: string;
  avatarUrl?: string;
}) {
  const { theme } = useAppTheme();
  const genderLabel = gender === "female" ? "♀" : gender === "male" ? "♂" : "○";
  return (
    <SectionCard>
      <View style={{ flexDirection: "row", gap: theme.spacing.md, alignItems: "center" }}>
        <View
          accessibilityLabel={`${name}头像`}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.surfaceMuted,
          }}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              accessibilityLabel={`${name}头像`}
              style={{ width: 56, height: 56, borderRadius: 28 }}
            />
          ) : (
            <AppText size="title2" weight="bold">{name.slice(0, 1)}</AppText>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", gap: theme.spacing.xs, alignItems: "center" }}>
            <AppText size="title2" weight="bold">{name}</AppText>
            <AppText tone="secondary">{genderLabel}</AppText>
          </View>
          {subtitle ? <AppText size="small" tone="secondary">{subtitle}</AppText> : null}
          {ratingLabel ? <AppText size="small" weight="bold">★ {ratingLabel}</AppText> : null}
        </View>
      </View>
    </SectionCard>
  );
}
