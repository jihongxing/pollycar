import type { AdminReviewTaskDetail } from "@pollycar/contracts";
import { TaskOwnershipBadge } from "../../components/task-ownership-badge";

const statusLabel = { complete: "完整", incomplete: "需补充", valid: "有效", invalid: "无效" } as const;

export function TaskDetailPage({ task, onBack, onRequestMaterial, onApprove, onReject, onAudit }: Readonly<{
  task: AdminReviewTaskDetail;
  onBack(): void;
  onRequestMaterial(): void;
  onApprove(): void;
  onReject(): void;
  onAudit(): void;
}>) {
  const approvalBlocked =
    task.insuranceExpiryStatus === "incomplete" ||
    task.authorizationEvidenceStatus === "incomplete" ||
    task.attachmentValidationStatus === "invalid";
  return <main><button className="back-link" onClick={onBack}>← 返回审核队列</button><div className="detail-header"><div><span className="eyebrow">最小必要摘要</span><h1>{task.vehicleCategory}</h1><p>{task.accountReference} · {task.applicationId}</p></div><TaskOwnershipBadge lease={task.lease} /></div>
    <section className="summary-panel"><div className="section-heading"><div><span className="eyebrow">Review fields</span><h2>结构化审核字段</h2></div><button className="ghost" onClick={onAudit}>查看审计记录</button></div>
      <div className="field-grid"><Field label="保险有效期" value={statusLabel[task.insuranceExpiryStatus]} warning={task.insuranceExpiryStatus === "incomplete"} /><Field label="车辆授权材料" value={statusLabel[task.authorizationEvidenceStatus]} warning={task.authorizationEvidenceStatus === "incomplete"} /><Field label="附件格式校验" value={statusLabel[task.attachmentValidationStatus]} warning={task.attachmentValidationStatus === "invalid"} /><Field label="业务版本" value={`v${task.vehicleReviewVersion}`} /></div>
      <div className="restriction">严格受限原文与安全证据在本切片中不可访问。</div>
    </section>
    {task.status === "waiting_user" ? <section className="result-banner"><strong>已要求用户补充材料</strong><span>任务已释放，不再占用活跃认领名额。</span></section> : task.status === "completed" ? <section className="result-banner"><strong>审核结论已提交</strong><span>任务已完成并释放租约，可通过审计记录查看决定原因。</span></section> : <div className="sticky-actions"><button className="secondary" onClick={onRequestMaterial}>要求补充材料</button><button className="danger-button" onClick={onReject}>拒绝申请</button><button className="primary" disabled={approvalBlocked} onClick={onApprove}>{approvalBlocked ? "存在风险，不能批准" : "批准车辆"}</button></div>}
  </main>;
}

function Field({ label, value, warning = false }: Readonly<{ label: string; value: string; warning?: boolean }>) {
  return <div className="field"><span>{label}</span><strong className={warning ? "warning-text" : ""}>{value}</strong></div>;
}
