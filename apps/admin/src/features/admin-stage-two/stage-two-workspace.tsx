import { useEffect, useState } from "react";
import type {
  AdminDriver360,
  AdminInternalSession,
  AdminOperator360,
  AdminOperatorManagementClient,
  AdminOperatorManagementCommand,
  AdminOperatorOnboardingCase,
  AdminPrimaryOperatorMigrationCase,
  AdminVehicle360,
} from "@pollycar/contracts";
import "./stage-two-workspace.css";

export type StageTwoPage =
  | "operator_management"
  | "operator_onboarding"
  | "driver_directory"
  | "vehicle_directory"
  | "primary_operator_relationships";

type StageTwoResource =
  | AdminOperator360
  | AdminOperatorOnboardingCase
  | AdminDriver360
  | AdminVehicle360
  | AdminPrimaryOperatorMigrationCase;

export function StageTwoWorkspace({
  page,
  client,
  session,
}: Readonly<{
  page: StageTwoPage;
  client: AdminOperatorManagementClient;
  session: AdminInternalSession;
}>) {
  const [resource, setResource] = useState<StageTwoResource>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  async function refresh() {
    setLoading(true);
    setError(undefined);
    try {
      setResource(await loadPage(client, page, session));
    } catch (reason) {
      setError(errorCode(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [client, page, session.context.organizationId]);

  async function execute(command: AdminOperatorManagementCommand) {
    setLoading(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await client.executeOperatorManagementCommand(command);
      setNotice(`命令 ${result.commandType} 已受理，资源版本更新为 ${result.resourceVersion}。`);
      setResource(await loadPage(client, page, session));
    } catch (reason) {
      setError(errorCode(reason));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="stage-heading">
        <div>
          <span>阶段二 · 组织与运力合成内核</span>
          <h1>{pageTitle(page)}</h1>
          <p>所有资料均为合成数据；权限、组织范围和业务审计由 Server 统一判定。</p>
        </div>
        <span className="stage-status attention">生产启用关闭</span>
      </header>
      {notice ? <div className="stage-notice" role="status">{notice}</div> : null}
      {error ? <div className="stage-error" role="alert">服务端拒绝：{error}</div> : null}
      {loading ? <p className="stage-loading">正在刷新受控数据…</p> : null}
      {resource && page === "operator_management" && "capabilities" in resource ? (
        <OperatorView data={resource} onExecute={execute} />
      ) : null}
      {resource && page === "operator_onboarding" && "checks" in resource ? (
        <OnboardingView
          data={resource}
          platformAllowed={session.functionalRoles.includes("platform_operations_lead")}
          onExecute={execute}
        />
      ) : null}
      {resource && page === "driver_directory" && "vehicles" in resource ? (
        <DriverView data={resource} />
      ) : null}
      {resource && page === "vehicle_directory" && "review" in resource ? (
        <VehicleView data={resource} />
      ) : null}
      {resource && page === "primary_operator_relationships" && "sourceOperatorId" in resource ? (
        <MigrationView data={resource} onExecute={execute} />
      ) : null}
    </>
  );
}

function OperatorView({
  data,
  onExecute,
}: Readonly<{
  data: AdminOperator360;
  onExecute(command: AdminOperatorManagementCommand): void;
}>) {
  return (
    <>
      <section className="stage-metrics">
        <article><span>生命周期</span><strong>{data.lifecycleState}</strong><small>资源版本 {data.resourceVersion}</small></article>
        <article><span>有效车主</span><strong>{data.metrics.activeDrivers}</strong><small>敏感字段已脱敏</small></article>
        <article><span>有效车辆</span><strong>{data.metrics.activeVehicles}</strong><small>审核源保持只读</small></article>
        <article><span>待办任务</span><strong>{data.metrics.pendingTasks}</strong><small>资金数据只读</small></article>
      </section>
      <div className="stage-grid">
        <section className="stage-panel">
          <header><h2>{data.operatorName}</h2><p>{data.syntheticReference} · {data.contactMasked}</p></header>
          <div className="stage-list">
            {data.capabilities.map((capability) => (
              <article key={capability.capabilityId}>
                <span className="stage-task-kind">城</span>
                <div><b>{capability.cityName} · {capability.capabilityType}</b><p>{capability.ruleVersion} · {capability.approvalCaseId}</p></div>
                <span className={`stage-status ${capability.state === "active" ? "normal" : "attention"}`}>{capability.state}</span>
              </article>
            ))}
          </div>
        </section>
        <section className="stage-panel">
          <header><h2>受控操作</h2><p>命令均携带资源版本并写入追加式审计。</p></header>
          <div className="stage-closed-state">
            <button type="button" className="stage-secondary" onClick={() => onExecute({
              type: "grant_city_capability",
              operatorId: data.operatorId,
              cityCode: "CN-SH",
              capabilityType: "support_coordination",
              resourceVersion: data.resourceVersion,
            })}>授予客服协同能力</button>
            <button type="button" className="stage-secondary" onClick={() => onExecute({
              type: "change_operator_lifecycle",
              operatorId: data.operatorId,
              targetState: data.lifecycleState === "active" ? "restricted" : "active",
              reason: "合成运营演练",
              resourceVersion: data.resourceVersion,
            })}>切换受控生命周期</button>
            <p>真实账户、真实材料和生产启用始终关闭。</p>
          </div>
        </section>
      </div>
    </>
  );
}

function OnboardingView({
  data,
  platformAllowed,
  onExecute,
}: Readonly<{
  data: AdminOperatorOnboardingCase;
  platformAllowed: boolean;
  onExecute(command: AdminOperatorManagementCommand): void;
}>) {
  return (
    <section className="stage-panel">
      <header><h2>{data.operatorName} · 入驻案件</h2><p>{data.onboardingCaseId} · 状态 {data.state} · 版本 {data.resourceVersion}</p></header>
      <div className="stage-list">
        {data.checks.map((check) => (
          <article key={check.checkId}>
            <span className="stage-task-kind">审</span>
            <div><b>{check.label}</b><p>{check.summary}</p></div>
            <span className={`stage-status ${check.state === "passed" ? "normal" : check.state === "failed" ? "blocked" : "attention"}`}>{check.state}</span>
          </article>
        ))}
      </div>
      {platformAllowed ? (
        <div className="stage-command-row">
          <button type="button" className="stage-secondary" onClick={() => onExecute({
            type: "request_onboarding_changes",
            onboardingCaseId: data.onboardingCaseId,
            reason: "请补充合成城市能力说明",
            resourceVersion: data.resourceVersion,
          })}>请求补充材料</button>
          <button type="button" className="stage-secondary" onClick={() => onExecute({
            type: "approve_onboarding",
            onboardingCaseId: data.onboardingCaseId,
            resourceVersion: data.resourceVersion,
          })}>批准入驻</button>
        </div>
      ) : <div className="stage-closed-state"><p>运营主体人员仅可查看本主体资料，不显示平台入驻写入口。</p></div>}
    </section>
  );
}

function DriverView({ data }: Readonly<{ data: AdminDriver360 }>) {
  return (
    <div className="stage-grid">
      <section className="stage-panel">
        <header><h2>{data.displayNameMasked} · 车主 360°</h2><p>{data.driverAccountId} · {data.phoneMasked}</p></header>
        <div className="stage-closed-state">
          <b>资格：{data.eligibilityState}</b>
          <span>配额：{data.quotaSummary}</span>
          <span>主运营主体：{data.primaryOperatorRelationship.operatorName}</span>
          <span>权威源：{data.primaryOperatorRelationship.authoritativeSource}</span>
        </div>
      </section>
      <section className="stage-panel">
        <header><h2>关联车辆</h2><p>只读聚合，不在此处修改审核结论。</p></header>
        <div className="stage-list">{data.vehicles.map((vehicle) => (
          <article key={vehicle.vehicleId}><span className="stage-task-kind">车</span><div><b>{vehicle.plateMasked}</b><p>{vehicle.vehicleId}</p></div><span className="stage-status normal">{vehicle.reviewState}</span></article>
        ))}</div>
      </section>
    </div>
  );
}

function VehicleView({ data }: Readonly<{ data: AdminVehicle360 }>) {
  return (
    <div className="stage-grid">
      <section className="stage-panel">
        <header><h2>{data.plateMasked} · 车辆 360°</h2><p>{data.vehicleSummary} · {data.vehicleId}</p></header>
        <div className="stage-closed-state">
          <b>审核状态：{data.review.state}</b>
          <span>审核版本：{data.review.resourceVersion}</span>
          <span>审核权威源：{data.review.authoritativeSource}</span>
          <span>即将到期材料：{data.expiringDocumentCount} 项</span>
        </div>
      </section>
      <section className="stage-panel">
        <header><h2>归属关系</h2><p>主运营关系只从资金编排权威源读取。</p></header>
        <div className="stage-closed-state">
          <span>车主：{data.driverNameMasked}</span>
          <span>运营主体：{data.primaryOperatorRelationship.operatorName}</span>
          <span>{data.primaryOperatorRelationship.authoritativeSource}</span>
          <p>直接修改车辆审核：禁止</p>
        </div>
      </section>
    </div>
  );
}

function MigrationView({
  data,
  onExecute,
}: Readonly<{
  data: AdminPrimaryOperatorMigrationCase;
  onExecute(command: AdminOperatorManagementCommand): void;
}>) {
  const blocked = data.blockers.some((blocker) => blocker.blocking);
  return (
    <div className="stage-grid">
      <section className="stage-panel">
        <header><h2>{data.sourceOperatorName} → {data.targetOperatorName}</h2><p>{data.migrationCaseId} · 状态 {data.state} · 版本 {data.resourceVersion}</p></header>
        <div className="stage-list">{data.blockers.map((blocker) => (
          <article key={blocker.blockerType}><span className={`stage-task-kind ${blocker.blocking ? "high" : ""}`}>阻</span><div><b>{blocker.blockerType}</b><p>{blocker.summary}</p></div><span className={`stage-status ${blocker.blocking ? "blocked" : "normal"}`}>{blocker.blocking ? "阻断" : "通过"}</span></article>
        ))}</div>
      </section>
      <section className="stage-panel">
        <header><h2>受控迁移</h2><p>不可回滚；生效时由权威 Gateway 原子结束旧关系并建立新关系。</p></header>
        <div className="stage-closed-state">
          <span>来源确认：{data.sourceAcknowledged ? "已确认" : "待确认"}</span>
          <span>目标确认：{data.targetAcknowledged ? "已确认" : "待确认"}</span>
          <span>独立复核：{data.independentlyReviewed ? "已完成" : "待完成"}</span>
          <button type="button" className="stage-secondary" disabled={blocked} onClick={() => onExecute({
            type: "acknowledge_primary_operator_migration",
            migrationCaseId: data.migrationCaseId,
            side: "source",
            resourceVersion: data.resourceVersion,
          })}>发送双方确认</button>
          {blocked ? <p>存在非零阻断项，确认、排期和生效均保持关闭。</p> : null}
        </div>
      </section>
    </div>
  );
}

function loadPage(
  client: AdminOperatorManagementClient,
  page: StageTwoPage,
  session: AdminInternalSession,
): Promise<StageTwoResource> {
  const operatorId = session.context.organizationType === "operator"
    ? session.context.organizationId
    : "operator-huhang";
  if (page === "operator_management") return client.getOperator360(operatorId);
  if (page === "operator_onboarding") return client.getOnboardingCase("onboarding-synthetic-021");
  if (page === "driver_directory") return client.getDriver360("driver-synthetic-086");
  if (page === "vehicle_directory") return client.getVehicle360("vehicle-synthetic-132");
  return client.getMigrationCase("migration-synthetic-009");
}

function pageTitle(page: StageTwoPage): string {
  if (page === "operator_management") return "运营主体 360°";
  if (page === "operator_onboarding") return "运营主体入驻案件";
  if (page === "driver_directory") return "车主 360°";
  if (page === "vehicle_directory") return "车辆 360°";
  return "主运营关系迁移";
}

function errorCode(reason: unknown): string {
  return reason instanceof Error ? reason.message : "INTERNAL_UNEXPECTED_ERROR";
}
