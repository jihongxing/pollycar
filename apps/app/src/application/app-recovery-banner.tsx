import { AppText, PrimaryButton } from "../components/ui";
import { MotionView } from "../motion/motion-view";
import { useAppTheme } from "../theme/theme-context";
import { useAccountSession } from "./account-session-context";
import { useAdultEligibility } from "./adult-eligibility-context";
import { useAppRecovery } from "./app-recovery-context";

export function AppRecoveryBanner() {
  const { theme } = useAppTheme();
  const { snapshot, synchronize } = useAppRecovery();
  const { sessionExpired } = useAccountSession();
  const { error: eligibilityError } = useAdultEligibility();
  const state =
    snapshot.state === "offline"
      ? "offline"
      : sessionExpired || eligibilityError === "AUTHENTICATION_REQUIRED"
      ? "session_expired"
      : snapshot.state;
  if (!["offline", "failed", "session_expired"].includes(state)) return null;
  if (state === "failed" && snapshot.trigger !== "manual") return null;
  const presentation = recoveryPresentations[state as keyof typeof recoveryPresentations];
  return (
    <MotionView
      accessibilityRole="alert"
      accessibilityLabel={`${presentation.title}。${presentation.message}`}
      style={{
        position: "absolute",
        zIndex: 15,
        right: theme.spacing.md,
        bottom: 88,
        left: theme.spacing.md,
        gap: theme.spacing.xs,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        borderRadius: theme.radius.medium,
        padding: theme.spacing.md,
        backgroundColor: theme.colors.surface,
      }}
    >
      <AppText weight="bold">{presentation.title}</AppText>
      <AppText size="small" tone="secondary">{presentation.message}</AppText>
      {state !== "offline" ? (
        <PrimaryButton
          label={state === "session_expired" ? "重新连接内部沙箱" : "重新同步"}
          variant="secondary"
          onPress={() => void synchronize("manual")}
        />
      ) : null}
    </MotionView>
  );
}

const recoveryPresentations = {
  offline: {
    title: "当前处于离线状态",
    message: "可继续查看已加载内容；恢复网络后会自动读取服务系统最新状态。",
  },
  failed: {
    title: "暂时无法更新",
    message: "当前内容仍可查看，请稍后重试。",
  },
  session_expired: {
    title: "内部会话已过期",
    message: "请重新连接内部沙箱；恢复后只读取最新状态，不自动重复提交。",
  },
} as const;
