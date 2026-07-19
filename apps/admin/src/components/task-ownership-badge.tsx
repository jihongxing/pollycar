import type { AdminReviewLease } from "@pollycar/contracts";

export function TaskOwnershipBadge({ lease }: Readonly<{ lease?: AdminReviewLease | undefined }>) {
  if (!lease) return <span className="badge neutral">未认领</span>;
  return <span className="badge success">由你持有 · 至 {new Date(lease.expiresAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>;
}
