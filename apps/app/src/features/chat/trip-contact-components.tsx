import { Pressable, TextInput, View } from "react-native";

import { AppIcon, type AppIconName } from "../../components/app-icon";
import {
  AppV2QuickReply,
  AppV2TripContext,
} from "../../components/app-v2-components";
import { AppText } from "../../components/ui";
import { resolveMotionProfile } from "../../motion/motion";
import { useReducedMotion } from "../../motion/use-reduced-motion";
import { useAppTheme } from "../../theme/theme-context";

export function TripContactHeader({
  counterpartyName,
  status,
  contextIcon,
  contextTitle,
  contextDescription,
  policy,
  tone,
  onSafetyPress,
}: {
  counterpartyName: string;
  status: string;
  contextIcon: AppIconName;
  contextTitle: string;
  contextDescription: string;
  policy?: string;
  tone: "passenger" | "driver";
  onSafetyPress: () => void;
}) {
  const { theme } = useAppTheme();
  const accent = tone === "driver" ? theme.colors.owner : theme.colors.passenger;
  return (
    <View
      style={{
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        backgroundColor: theme.colors.surface,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
        <View
          style={{
            width: 42,
            height: 42,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: theme.radius.pill,
            backgroundColor: `${accent}20`,
          }}
        >
          <AppText tone={tone === "driver" ? "owner" : "passenger"} weight="bold">
            {counterpartyName.slice(0, 1)}
          </AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText weight="bold">{counterpartyName}</AppText>
          <AppText size="small" tone="secondary">{status}</AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="举报或安全帮助"
          onPress={onSafetyPress}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: theme.radius.pill,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <AppIcon name="safety" size={21} />
        </Pressable>
      </View>
      <AppV2TripContext
        icon={contextIcon}
        title={contextTitle}
        description={contextDescription}
      />
      {policy ? <AppText size="caption" tone="secondary">{policy}</AppText> : null}
    </View>
  );
}

export function TripContactComposer({
  text,
  onChangeText,
  loading,
  quickReplies,
  tone,
  onSubmit,
}: {
  text: string;
  onChangeText: (value: string) => void;
  loading: boolean;
  quickReplies: readonly string[];
  tone: "passenger" | "driver";
  onSubmit: (value?: string) => void;
}) {
  const { theme } = useAppTheme();
  const motion = resolveMotionProfile(useReducedMotion());
  const accent = tone === "driver" ? theme.colors.owner : theme.colors.passenger;
  const disabled = !text.trim() || loading;
  return (
    <View style={{ gap: theme.spacing.sm }}>
      {quickReplies.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
          {quickReplies.map((reply) => (
            <AppV2QuickReply
              key={reply}
              disabled={loading}
              label={reply}
              onPress={() => onSubmit(reply)}
            />
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.sm }}>
        <TextInput
          accessibilityLabel="输入行程消息"
          value={text}
          onChangeText={onChangeText}
          editable={!loading}
          multiline
          placeholder="输入消息"
          placeholderTextColor={theme.colors.textSecondary}
          style={{
            minHeight: 52,
            maxHeight: 112,
            flex: 1,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.medium,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            color: theme.colors.text,
            backgroundColor: theme.colors.surfaceMuted,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={loading ? "正在发送" : "发送"}
          accessibilityState={{ disabled, busy: loading }}
          disabled={disabled}
          onPress={() => onSubmit()}
          style={({ pressed }) => [
            {
              width: 48,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: theme.radius.pill,
              backgroundColor: disabled ? theme.colors.surfaceMuted : accent,
            },
            pressed && !disabled
              ? { opacity: 0.9, transform: [{ scale: motion.pressedScale }] }
              : undefined,
          ]}
        >
          <AppIcon
            name="send"
            size={21}
            color={disabled ? theme.colors.textSecondary : theme.colors.inverseText}
          />
        </Pressable>
      </View>
    </View>
  );
}
