import type { AdminReviewMaterialPreview, AdminReviewMaterialReason } from "@pollycar/contracts";
import { FocusTrapDialog } from "../../components/focus-trap-dialog";

const labels: Record<AdminReviewMaterialReason, string> = {
  insurance_expiry_incomplete: "保险有效期信息不完整",
  authorization_evidence_incomplete: "车辆授权材料不完整",
  synthetic_attachment_invalid: "合成附件格式无效",
};

export function RequestMaterialDialog({ reason, preview, busy, onReason, onPreview, onSubmit, onClose }: Readonly<{
  reason: AdminReviewMaterialReason;
  preview?: AdminReviewMaterialPreview | undefined;
  busy: boolean;
  onReason(reason: AdminReviewMaterialReason): void;
  onPreview(): void;
  onSubmit(): void;
  onClose(): void;
}>) {
  return <FocusTrapDialog titleId="request-title" busy={busy} onClose={onClose}>
    <div className="section-heading"><div><span className="eyebrow">要求补充材料</span><h2 id="request-title">确认结构化原因与用户文案</h2></div><button className="ghost" onClick={onClose}>关闭</button></div>
    <label>补充原因<select value={reason} onChange={(event) => onReason(event.target.value as AdminReviewMaterialReason)}>
      {Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
    </select></label>
    <button className="secondary" onClick={onPreview}>生成文案预览</button>
    {preview ? <section className="preview" aria-label="用户可见文案预览"><span>用户可见文案预览</span><h3>{preview.title}</h3><p>{preview.body}</p></section> : <p className="hint">提交前必须先查看用户可见文案。</p>}
    <div className="actions"><button className="ghost" onClick={onClose}>取消</button><button className="primary" disabled={!preview || busy} onClick={onSubmit}>{busy ? "正在提交…" : "确认要求补充"}</button></div>
  </FocusTrapDialog>;
}
