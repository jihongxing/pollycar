export function ConflictState({ code, onBack, onRecover }: Readonly<{ code: string; onBack(): void; onRecover?: (() => void | Promise<void>) | undefined }>) {
  const ownershipLost = code === "ADMIN_TASK_OWNERSHIP_LOST";
  const title = ownershipLost ? "任务所有权已失效" : code === "UNKNOWN_RESULT" ? "提交结果暂时未知" : "任务已被其他审核员认领";
  return <section className="state-panel" role="alert"><span className="state-icon">!</span><h2>{title}</h2><p>{ownershipLost ? "为避免重复决定，本页面已切换为只读。请返回队列刷新任务状态。" : code === "UNKNOWN_RESULT" ? "系统将按幂等键查找原命令结果，不会重复提交。" : "队列状态已变化，请返回并刷新后选择其他任务。"}</p><div className="actions">{onRecover ? <button className="primary" onClick={onRecover}>恢复原结果</button> : null}<button className="secondary" onClick={onBack}>返回队列</button></div></section>;
}
