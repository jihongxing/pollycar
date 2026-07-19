import { Pressable, View } from "react-native";

import { AppText } from "../ui";
import { useAppTheme } from "../../theme/theme-context";

export function RatingControl({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: theme.spacing.sm }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === star, disabled }}
          accessibilityLabel={`${star} 星`}
          disabled={disabled}
          onPress={() => onChange(star)}
        >
          <AppText size="title1" tone={star <= value ? "passenger" : "secondary"}>★</AppText>
        </Pressable>
      ))}
    </View>
  );
}
