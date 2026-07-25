import { useState } from "react";
import { Pressable, View } from "react-native";

import { AppIcon, type AppIconName } from "./app-icon";
import { AppText } from "./ui";
import { useAppTheme } from "../theme/theme-context";

export type AuthAgreement = Readonly<{
  id: string;
  icon: AppIconName;
  title: string;
  summary: string;
  detail: string;
}>;

export function AuthAgreementGate({
  agreements,
  consentLabel,
  consentAccepted,
  onConsentChange,
  tone,
}: {
  agreements: readonly AuthAgreement[];
  consentLabel: string;
  consentAccepted: boolean;
  onConsentChange: (accepted: boolean) => void;
  tone: "passenger" | "driver";
}) {
  const { theme } = useAppTheme();
  const accent = tone === "driver" ? theme.colors.owner : theme.colors.passenger;
  const [expandedAgreement, setExpandedAgreement] = useState<string>();
  const [readAgreements, setReadAgreements] = useState<ReadonlySet<string>>(new Set());
  const allRead = readAgreements.size === agreements.length;

  const toggleAgreement = (id: string) => {
    setExpandedAgreement((current) => (current === id ? undefined : id));
    setReadAgreements((current) => new Set(current).add(id));
  };

  return (
    <>
      <View
        accessibilityRole="list"
        style={{
          overflow: "hidden",
          borderRadius: theme.radius.medium,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}
      >
        {agreements.map((agreement, index) => {
          const expanded = expandedAgreement === agreement.id;
          const read = readAgreements.has(agreement.id);
          return (
            <View
              key={agreement.id}
              style={index > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border } : undefined}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${agreement.title}，${read ? "已阅读" : "未阅读"}`}
                accessibilityState={{ expanded }}
                onPress={() => toggleAgreement(agreement.id)}
                style={({ pressed }) => ({
                  minHeight: 68,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
                })}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: theme.radius.pill,
                    backgroundColor: read ? `${accent}18` : theme.colors.surfaceMuted,
                  }}
                >
                  <AppIcon
                    name={read ? "privacy" : agreement.icon}
                    size={18}
                    color={read ? accent : theme.colors.textSecondary}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText weight="bold">{agreement.title}</AppText>
                  <AppText size="small" tone="secondary">{agreement.summary}</AppText>
                </View>
                <AppText size="caption" weight="bold" style={{ color: read ? accent : theme.colors.textSecondary }}>
                  {read ? "已读" : "阅读"}
                </AppText>
              </Pressable>
              {expanded ? (
                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: theme.colors.border,
                    backgroundColor: theme.colors.surfaceMuted,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                  }}
                >
                  <AppText size="small" tone="secondary">{agreement.detail}</AppText>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={consentLabel}
        accessibilityState={{ checked: consentAccepted, disabled: !allRead }}
        disabled={!allRead}
        onPress={() => onConsentChange(!consentAccepted)}
        style={{
          minHeight: 52,
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.sm,
          opacity: allRead ? 1 : 0.55,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 7,
            borderWidth: 1,
            borderColor: consentAccepted ? accent : theme.colors.border,
            backgroundColor: consentAccepted ? accent : theme.colors.surface,
          }}
        >
          {consentAccepted ? <AppText style={{ color: theme.colors.onDeepSurface }}>✓</AppText> : null}
        </View>
        <AppText size="small" style={{ flex: 1 }}>
          {consentLabel}
        </AppText>
      </Pressable>
      {!allRead ? (
        <AppText size="caption" tone="secondary">
          请先阅读 {agreements.length} 项内容
        </AppText>
      ) : null}
    </>
  );
}
