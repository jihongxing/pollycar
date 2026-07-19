import { useEffect, useState } from "react";
import type {
  AdminCommandRecoveryTask,
  AdminInternalSession,
  AdminSafetyInvestigation,
  AdminSupportCase,
  AdminTrip360,
  AdminTripCaseManagementClient,
  AdminTripOperationsCenter,
} from "@pollycar/contracts";
import "./stage-three-workspace.css";

export type StageThreePage =
  | "trip_operations"
  | "trip_directory"
  | "support_cases"
  | "safety_cases"
  | "evidence_access"
  | "command_recovery";

export function StageThreeWorkspace({
  page,
  client,
  session,
}: Readonly<{
  page: StageThreePage;
  client: AdminTripCaseManagementClient;
  session: AdminInternalSession;
}>) {
  const [data, setData] = useState<
    | AdminTripOperationsCenter
    | AdminTrip360
    | AdminSupportCase
    | AdminSafetyInvestigation
    | AdminCommandRecoveryTask
  >();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setData(undefined);
    setError(undefined);
    const request =
      page === "trip_operations"
        ? client.getTripOperationsCenter()
        : page === "trip_directory"
          ? client.getTrip360(
              session.context.organizationType === "operator"
                ? "trip-synthetic-8421"
                : "trip-synthetic-8466",
            )
          : page === "support_cases"
            ? client.getSupportCase("support-synthetic-114")
            : page === "safety_cases" || page === "evidence_access"
              ? client.getSafetyInvestigation("safety-synthetic-8421")
              : client.getCommandRecoveryTask("recovery-synthetic-017");
    request
      .then((value) => {
        if (active) setData(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "INTERNAL_UNEXPECTED_ERROR");
      });
    return () => {
      active = false;
    };
  }, [client, page, session.context.organizationType]);

  if (error) return <section className="stage-panel"><p role="alert">服务端拒绝：{error}</p></section>;
  if (!data) return <p className="stage-loading">正在加载阶段三合成数据…</p>;
  if ("tasks" in data) return <TripOperationsView data={data} />;
  if ("routeSummary" in data) return <TripView data={data} />;
  if ("supportCaseId" in data) return <SupportView data={data} />;
  if ("safetyCaseId" in data) {
    return page === "evidence_access"
      ? <EvidenceView data={data} />
      : <SafetyView data={data} />;
  }
  return <RecoveryView data={data} />;
}

function TripOperationsView({ data }: Readonly<{ data: AdminTripOperationsCenter }>) {
  return (
    <>
      <Heading title="行程运营中心" detail="只创建运营任务，不复制或直接修改权威行程状态。" />
      <section className="stage3-metrics">
        <article><span>待分诊</span><strong>{data.metrics.detected}</strong></article>
        <article><span>等待权威结果</span><strong>{data.metrics.awaitingAuthoritativeResult}</strong></article>
        <article><span>跨主体隔离协作</span><strong>{data.metrics.crossOperator}</strong></article>
        <article><span>安全冻结</span><strong>{data.metrics.safetyFrozen}</strong></article>
      </section>
      <section className="stage-panel">
        <header><h2>当前任务</h2><p>服务端按组织范围过滤。</p></header>
        <div className="stage-list">
          {data.tasks.map((task) => (
            <article key={task.taskId}>
              <span className={`stage-task-kind ${task.priority}`}>行</span>
              <div><b>{task.summary}</b><p>{task.tripId} · {task.operatorName}</p></div>
              <span className="stage-status attention">{task.state}</span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function TripView({ data }: Readonly<{ data: AdminTrip360 }>) {
  return (
    <>
      <Heading title={`行程 360° · ${data.tripId}`} detail="权威状态只读，运营主体快照不可改写。" />
      <div className="stage-grid">
        <section className="stage-panel"><header><h2>行程事实</h2></header><div className="stage3-facts"><b>{data.authoritativeState}</b><span>{data.routeSummary}</span><span>权威版本 {data.authoritativeVersion}</span></div></section>
        <section className="stage-panel"><header><h2>脱敏参与方</h2></header><div className="stage3-facts"><span>{data.passengerMasked}</span><span>{data.driverMasked}</span><span>{data.vehicleMasked}</span></div></section>
      </div>
    </>
  );
}

function SupportView({ data }: Readonly<{ data: AdminSupportCase }>) {
  return (
    <>
      <Heading title={`客服案件 ${data.supportCaseId}`} detail="客服只能查看业务摘要并发起隔离升级。" />
      <section className="stage-panel">
        <header><h2>{data.category} · {data.state}</h2><p>版本 {data.resourceVersion}</p></header>
        <div className="stage3-facts"><b>{data.userSummary}</b><span>{data.investigationSummary}</span><span>安全证据不可见：是</span><span>资金修改允许：否</span></div>
      </section>
    </>
  );
}

function SafetyView({ data }: Readonly<{ data: AdminSafetyInvestigation }>) {
  const blocked = data.blockers.some((blocker) => blocker.blocking);
  return (
    <>
      <Heading title={`安全调查 ${data.safetyCaseId}`} detail="提交调查与恢复复核职责分离。" />
      <div className="stage-grid">
        <section className="stage-panel">
          <header><h2>{data.severity} · {data.investigationState}</h2><p>安全权威状态 {data.authoritativeState}</p></header>
          <div className="stage-list">{data.blockers.map((blocker) => (
            <article key={blocker.blockerType}><span className="stage-task-kind urgent">安</span><div><b>{blocker.summary}</b><p>{blocker.blockerType}</p></div><span className="stage-status blocked">阻断</span></article>
          ))}</div>
        </section>
        <section className="stage-panel">
          <header><h2>独立恢复复核</h2><p>冻结经办人不得复核自己的决定。</p></header>
          <div className="stage-command-row"><button type="button" className="stage-secondary" disabled={blocked}>恢复访问</button><button type="button" className="stage-secondary">维持冻结</button></div>
        </section>
      </div>
    </>
  );
}

function EvidenceView({ data }: Readonly<{ data: AdminSafetyInvestigation }>) {
  return (
    <>
      <Heading title="字段级证据访问" detail="授权按案件、工单、目的、字段与最长三十分钟有效期收敛。" />
      <section className="stage-panel">
        <header><h2>{data.safetyCaseId}</h2><p>真实证据始终关闭。</p></header>
        <div className="stage3-evidence">
          <article><b>通信引用</b><span>可申请单字段访问</span></article>
          <article><b>原始聊天</b><span>未满足双人批准，保持遮蔽</span><button type="button" disabled>读取原始聊天</button></article>
          <article><b>位置窗口</b><span>仅返回最小必要时间窗</span></article>
        </div>
      </section>
    </>
  );
}

function RecoveryView({ data }: Readonly<{ data: AdminCommandRecoveryTask }>) {
  return (
    <>
      <Heading title={`未知结果恢复 ${data.recoveryTaskId}`} detail="技术运维只查询幂等结果、权威状态和 Outbox，不替代业务决定。" />
      <section className="stage-panel">
        <header><h2>{data.state}</h2><p>原命令 {data.originalCommandType}</p></header>
        <div className="stage3-facts"><b>禁止重复业务命令</b><span>目标：{data.targetResourceId}</span><span>幂等摘要：{data.idempotencyKeyDigest.slice(0, 16)}…</span><span>技术运维业务决定权限：无</span></div>
      </section>
    </>
  );
}

function Heading({ title, detail }: Readonly<{ title: string; detail: string }>) {
  return <div className="stage-heading"><div><span>阶段三 · 合成内核</span><h1>{title}</h1><p>{detail}</p></div><div className="stage3-gate">真实数据与生产启用关闭</div></div>;
}
