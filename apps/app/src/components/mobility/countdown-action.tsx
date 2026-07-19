import { AppText } from "../ui";

export function CountdownAction({
  remainingSeconds,
  activeLabel = "可取消",
  expiredLabel = "取消窗口已结束",
}: {
  remainingSeconds: number;
  activeLabel?: string;
  expiredLabel?: string;
}) {
  if (remainingSeconds <= 0) return <AppText size="small" tone="secondary">{expiredLabel}</AppText>;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = String(remainingSeconds % 60).padStart(2, "0");
  return <AppText size="small" weight="bold" tone="danger">{activeLabel} {minutes}:{seconds}</AppText>;
}
