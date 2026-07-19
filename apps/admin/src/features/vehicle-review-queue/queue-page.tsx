import type { AdminReviewTaskSummary } from "@pollycar/contracts";

export function QueuePage({ tasks, loading, error, onRefresh, onClaim }: Readonly<{
  tasks: readonly AdminReviewTaskSummary[];
  loading: boolean;
  error?: string | undefined;
  onRefresh(): void;
  onClaim(task: AdminReviewTaskSummary): void;
}>) {
  return <main><div className="hero"><div><span className="eyebrow">车辆准入 · 合成队列</span><h1>待审核任务</h1><p>只展示完成当前审核所需的最小摘要，不提供原始材料披露。</p></div><button className="secondary" onClick={onRefresh}>刷新队列</button></div>
    {loading ? <p className="state-line">正在加载合成任务…</p> : error ? <section className="state-panel"><h2>队列加载失败</h2><p>{error === "SERVICE_UNAVAILABLE" ? "内部沙箱 Server 暂不可用，请确认服务已启动后重试。" : error}</p><button className="secondary" onClick={onRefresh}>重试</button></section> : tasks.length === 0 ? <section className="state-panel"><h2>当前没有待审核任务</h2><p>无需进行任何操作。</p></section> :
      <section className="task-grid" aria-label="审核任务队列">{tasks.map((task) => <article className="task-card" key={task.taskId}><div className="card-top"><span className="badge amber">{task.queueLabel}</span><span className="task-id">{task.taskId}</span></div><h2>{task.vehicleCategory}</h2><dl><div><dt>提交时间</dt><dd>{new Date(task.submittedAt).toLocaleString("zh-CN")}</dd></div><div><dt>状态</dt><dd>{task.status === "available" ? "可认领" : task.status === "waiting_user" ? "等待用户补充" : task.status === "completed" ? "审核已完成" : "处理中"}</dd></div></dl><button className="primary" disabled={task.status !== "available"} onClick={() => onClaim(task)}>{task.status === "available" ? "认领并查看" : "暂不可认领"}</button></article>)}</section>}
  </main>;
}
