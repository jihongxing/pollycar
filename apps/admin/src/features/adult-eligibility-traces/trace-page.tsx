import type { AdultEligibilityProviderTrace } from "@pollycar/contracts";

export function AdultEligibilityTracePage({
  traces,
  loading,
  error,
  onRefresh,
}: Readonly<{
  traces: readonly AdultEligibilityProviderTrace[];
  loading: boolean;
  error?: string;
  onRefresh(): void;
}>) {
  return (
    <main>
      <div className="hero">
        <div>
          <span className="eyebrow">自动身份服务</span>
          <h1>成年资格验证记录</h1>
          <p>只读查看供应商调用、自动检查结果和申诉状态。此工作区不能批准、拒绝或修改验证结果。</p>
        </div>
        <button onClick={onRefresh}>刷新记录</button>
      </div>
      {loading ? <p className="state-line">正在读取验证记录…</p> : null}
      {error ? <p className="warning-text">读取失败：{error}</p> : null}
      {!loading && !traces.length ? <p className="empty">暂无验证记录。</p> : null}
      <section className="task-grid" aria-label="成年资格验证记录">
        {traces.map((trace) => (
          <article className="task-card" key={trace.accountId}>
            <div className="card-top">
              <span className={`badge ${trace.businessAccessAllowed ? "success" : "amber"}`}>
                {trace.businessAccessAllowed ? "自动通过" : statusLabel(trace.providerStatus)}
              </span>
              <code className="task-id">{trace.accountId}</code>
            </div>
            <h2>{trace.providerId ?? "尚未调用供应商"}</h2>
            <dl>
              <div><dt>供应商请求</dt><dd>{trace.providerRequestId ?? "未创建"}</dd></div>
              <div><dt>证件</dt><dd>{checkLabel(trace.checks.document.status)}</dd></div>
              <div><dt>成年条件</dt><dd>{checkLabel(trace.checks.age.status)}</dd></div>
              <div><dt>活体</dt><dd>{checkLabel(trace.checks.liveness.status)}</dd></div>
              <div><dt>人证一致</dt><dd>{checkLabel(trace.checks.faceMatch.status)}</dd></div>
              <div><dt>申诉</dt><dd>{trace.appealStatus ?? "无"}</dd></div>
            </dl>
            {trace.failureCode ? <p className="warning-text">自动结果：{trace.failureCode}</p> : null}
            <p className="restriction">仅保留最小结果摘要和时间线；原始证件与人脸材料不可在运营后台访问。</p>
          </article>
        ))}
      </section>
    </main>
  );
}

function statusLabel(status: string) {
  return ({ not_started: "未开始", pending: "自动处理中", completed: "自动完成", failed: "服务失败", unknown: "结果未知" } as Record<string, string>)[status] ?? status;
}

function checkLabel(status: string) {
  return ({ not_started: "未开始", pending: "处理中", passed: "通过", failed: "未通过", unknown: "未知" } as Record<string, string>)[status] ?? status;
}
