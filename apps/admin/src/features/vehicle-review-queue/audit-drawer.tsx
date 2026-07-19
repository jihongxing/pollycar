import type { AdminReviewAuditEntry } from "@pollycar/contracts";

const actionLabels: Record<AdminReviewAuditEntry["action"], string> = {
  task_claimed: "任务已认领",
  task_viewed: "查看最小摘要",
  lease_renewed: "租约已续期",
  task_released: "任务已释放",
  material_previewed: "已预览补充文案",
  material_requested: "已要求补充材料",
  vehicle_approved: "车辆审核已批准",
  vehicle_rejected: "车辆审核已拒绝",
};

export function AuditDrawer({ entries, onClose }: Readonly<{ entries: readonly AdminReviewAuditEntry[]; onClose(): void }>) {
  return <aside className="drawer" aria-label="追加式审计记录"><div className="section-heading"><div><span className="eyebrow">不可修改</span><h2>追加式审计记录</h2></div><button className="ghost" onClick={onClose}>关闭</button></div>
    {entries.length === 0 ? <p className="empty">暂无审计记录。</p> : <ol className="audit-list">{entries.map((entry) => <li key={entry.id}><strong>{actionLabels[entry.action]}</strong><span>{new Date(entry.occurredAt).toLocaleString("zh-CN")}</span><code>{entry.reasonCode}</code></li>)}</ol>}
  </aside>;
}
