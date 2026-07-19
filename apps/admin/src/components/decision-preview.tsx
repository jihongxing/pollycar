import type { AdminReviewMaterialPreview } from "@pollycar/contracts";

export function DecisionPreview({ preview }: Readonly<{ preview: AdminReviewMaterialPreview }>) {
  return <section className="preview" aria-label="用户可见文案预览"><span>用户可见文案预览</span><h3>{preview.title}</h3><p>{preview.body}</p></section>;
}
