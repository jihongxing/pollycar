import { Fragment } from "react";
import { View } from "react-native";

import { AppText } from "./ui";
import { useAppTheme } from "../theme/theme-context";

type AuthStepRailTone = "passenger" | "driver";

export function AuthStepRail({
  steps,
  currentStep,
  tone,
}: {
  steps: readonly string[];
  currentStep: number;
  tone: AuthStepRailTone;
}) {
  const { theme } = useAppTheme();
  const accent = tone === "driver" ? theme.colors.owner : theme.colors.passenger;
  const currentLabel = steps[currentStep] ?? steps[0];

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`认证流程，第 ${currentStep + 1} 步，共 ${steps.length} 步：${currentLabel}`}
      accessibilityValue={{ min: 1, max: steps.length, now: currentStep + 1 }}
      style={{
        gap: theme.spacing.sm,
        borderRadius: theme.radius.large,
        borderWidth: 1,
        borderColor: `${accent}45`,
        backgroundColor: `${accent}0B`,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <AppText size="caption" weight="bold">
          认证流程
        </AppText>
        <AppText size="caption" tone="secondary">
          {currentStep + 1} / {steps.length} · {currentLabel}
        </AppText>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        {steps.map((step, index) => {
          const active = index === currentStep;
          const complete = index < currentStep;
          return (
            <Fragment key={step}>
              <View style={{ flex: 1, alignItems: "center", gap: theme.spacing.xs }}>
                <View
                  style={{
                    width: active ? 40 : 30,
                    height: active ? 40 : 30,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: theme.radius.pill,
                    borderWidth: active || complete ? 0 : 1,
                    borderColor: theme.colors.border,
                    backgroundColor: active || complete ? accent : theme.colors.surface,
                  }}
                >
                  <AppText
                    size={active ? "body" : "caption"}
                    weight="bold"
                    style={{
                      color: active || complete
                        ? theme.colors.onDeepSurface
                        : theme.colors.textSecondary,
                    }}
                  >
                    {index + 1}
                  </AppText>
                </View>
                <AppText
                  size="caption"
                  weight={active ? "bold" : "regular"}
                  style={{ textAlign: "center" }}
                >
                  {step}
                </AppText>
              </View>
              {index < steps.length - 1 ? (
                <View
                  style={{
                    flex: 0.7,
                    height: 3,
                    marginTop: active || index + 1 === currentStep ? 18 : 14,
                    borderRadius: theme.radius.pill,
                    backgroundColor: index < currentStep ? accent : theme.colors.border,
                  }}
                />
              ) : null}
            </Fragment>
          );
        })}
      </View>
    </View>
  );
}
