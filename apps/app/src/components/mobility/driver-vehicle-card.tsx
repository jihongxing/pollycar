import { View } from "react-native";

import { AppText, SectionCard } from "../ui";
import { useAppTheme } from "../../theme/theme-context";

export function DriverVehicleCard({
  color,
  model,
  plate,
  etaLabel,
  synthetic = true,
}: {
  color: string;
  model: string;
  plate: string;
  etaLabel?: string;
  synthetic?: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <SectionCard>
      <View style={{ gap: theme.spacing.xs }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.md }}>
          <AppText size="title2" weight="bold">{color} · {model}</AppText>
          {etaLabel ? <AppText weight="bold" tone="passenger">{etaLabel}</AppText> : null}
        </View>
        <AppText size="title1" weight="bold">{plate}</AppText>
        {synthetic ? <AppText size="caption" tone="secondary">车辆与位置均为合成数据</AppText> : null}
      </View>
    </SectionCard>
  );
}
