import type { AdminSafetyCaseDetail, AdminSafetyCaseSummary } from "@pollycar/contracts";

export function SafetyCasePage({
  cases,
  selected,
  loading,
  error,
  busy,
  onRefresh,
  onSelect,
  onBack,
  onResolve,
}: Readonly<{
  cases: readonly AdminSafetyCaseSummary[];
  selected?: AdminSafetyCaseDetail;
  loading: boolean;
  error?: string;
  busy: boolean;
  onRefresh(): void;
  onSelect(caseId: string): void;
  onBack(): void;
  onResolve(outcome: "restore_access" | "uphold_freeze"): void;
}>) {
  if (selected) {
    const resolvable = selected.state === "appealing";
    return (
      <main>
        <button className="back-link" onClick={onBack}>← 返回安全案件</button>
        <section className="summary-panel safety-detail">
          <div className="section-heading">
            <div>
              <span className="eyebrow">安全案件 · 最小披露</span>
              <h1>{selected.caseId}</h1>
            </div>
            <span className={`badge ${resolvable ? "amber" : "neutral"}`}>
              {stateLabels[selected.state]}
            </span>
          </div>
          <div className="field-grid">
            <div className="field"><span>关联行程</span><strong>{selected.tripId}</strong></div>
            <div className="field"><span>举报原因</span><strong>{reasonLabels[selected.reasonCode]}</strong></div>
            <div className="field"><span>举报方</span><strong>{selected.reporterAccountReference}</strong></div>
            <div className="field"><span>被举报方</span><strong>{selected.reportedAccountReference}</strong></div>
            <div className="field"><span>申诉原因</span><strong>{selected.appealReasonCode ? appealLabels[selected.appealReasonCode] : "尚未申诉"}</strong></div>
            <div className="field"><span>案件版本</span><strong>{selected.version}</strong></div>
          </div>
          <p className="restriction">聊天正文与原始证据不可用；该入口只允许基于结构化原因和申诉状态处理合成案件。</p>
          {resolvable ? (
            <div className="sticky-actions">
              <button className="secondary" disabled={busy} onClick={() => onResolve("restore_access")}>恢复访问</button>
              <button className="danger-button" disabled={busy} onClick={() => onResolve("uphold_freeze")}>维持冻结</button>
            </div>
          ) : (
            <p className="state-line">当前等待被举报方申诉，安全人员不能提前解除冻结。</p>
          )}
        </section>
      </main>
    );
  }
  return (
    <main>
      <div className="hero">
        <div>
          <span className="eyebrow">运营与安全 · 合成队列</span>
          <h1>安全案件</h1>
          <p>仅展示案件处理所需的结构化最小摘要，不展示聊天正文或证据原件。</p>
        </div>
        <button className="secondary" onClick={onRefresh}>刷新案件</button>
      </div>
      {loading ? <p className="state-line">正在加载合成安全案件…</p> :
        error ? <section className="state-panel"><h2>安全案件加载失败</h2><p>{error}</p><button className="secondary" onClick={onRefresh}>重试</button></section> :
        cases.length === 0 ? <section className="state-panel"><h2>当前没有开放案件</h2><p>无需进行安全处理。</p></section> :
        <section className="task-grid" aria-label="安全案件队列">
          {cases.map((item) => (
            <article className="task-card" key={item.caseId}>
              <div className="card-top">
                <span className={`badge ${item.hasAppeal ? "amber" : "neutral"}`}>{item.hasAppeal ? "待申诉处理" : "冻结中"}</span>
                <span className="task-id">{item.caseId}</span>
              </div>
              <h2>{reasonLabels[item.reasonCode]}</h2>
              <dl>
                <div><dt>关联行程</dt><dd>{item.tripId}</dd></div>
                <div><dt>创建时间</dt><dd>{new Date(item.createdAt).toLocaleString("zh-CN")}</dd></div>
              </dl>
              <button className="primary" onClick={() => onSelect(item.caseId)}>查看最小摘要</button>
            </article>
          ))}
        </section>}
    </main>
  );
}

const reasonLabels = {
  unsafe_behavior: "不安全行为",
  harassment: "骚扰",
  identity_concern: "身份疑虑",
} as const;

const appealLabels = {
  context_missing: "上下文缺失",
  misunderstanding: "存在误解",
  new_evidence: "有新增证据",
} as const;

const stateLabels = {
  open_frozen: "冻结中",
  appealing: "待处理申诉",
  restored: "已恢复",
  upheld: "维持冻结",
} as const;
