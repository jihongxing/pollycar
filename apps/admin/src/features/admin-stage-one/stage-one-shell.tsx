import { useEffect, useMemo, useState } from "react";
import type {
  AdminAccessClient,
  AdminAuditEvent,
  AdminInternalSession,
  AdminOperatorManagementClient,
  AdminTripCaseManagementClient,
  AdminFinanceOperationsClient,
  AdminExecutiveDashboardClient,
  AdminOperatorDirectoryEntry,
  AdminOperatorWorkbench,
  AdminPlatformWorkbench,
} from "@pollycar/contracts";
import { resolveAdminApiBaseUrl } from "../../infrastructure/api-base-url";
import {
  HttpAdminAccessClient,
  type SyntheticAdminIdentity,
} from "../../infrastructure/http-admin-access-client";
import { useTheme } from "../../theme/theme-provider";
import {
  StageTwoWorkspace,
  type StageTwoPage,
} from "../admin-stage-two/stage-two-workspace";
import {
  StageThreeWorkspace,
  type StageThreePage,
} from "../admin-stage-three/stage-three-workspace";
import {
  StageFourWorkspace,
  type StageFourPage,
} from "../admin-stage-four/stage-four-workspace";
import {
  StageFiveWorkspace,
  type StageFivePage,
} from "../admin-stage-five/stage-five-workspace";
import "./stage-one-shell.css";

type StageOnePage =
  | "platform_workbench"
  | "operator_workbench"
  | "operator_directory"
  | "audit"
  | StageTwoPage
  | StageThreePage
  | StageFourPage
  | StageFivePage;

export function StageOneShell({
  client: injectedClient,
  operatorManagementClient: injectedOperatorManagementClient,
  tripCaseManagementClient: injectedTripCaseManagementClient,
  financeOperationsClient: injectedFinanceOperationsClient,
  executiveDashboardClient: injectedExecutiveDashboardClient,
  operatorManagementEnabled = false,
  tripOperationsEnabled = false,
  caseManagementEnabled = false,
  financeOperationsEnabled = false,
  executiveDashboardEnabled = false,
}: Readonly<{
  client?: AdminAccessClient;
  operatorManagementClient?: AdminOperatorManagementClient;
  tripCaseManagementClient?: AdminTripCaseManagementClient;
  financeOperationsClient?: AdminFinanceOperationsClient;
  executiveDashboardClient?: AdminExecutiveDashboardClient;
  operatorManagementEnabled?: boolean;
  tripOperationsEnabled?: boolean;
  caseManagementEnabled?: boolean;
  financeOperationsEnabled?: boolean;
  executiveDashboardEnabled?: boolean;
}>) {
  const { theme, toggle } = useTheme();
  const [identity, setIdentity] =
    useState<SyntheticAdminIdentity>("synthetic-platform-ops-001");
  const client = useMemo(
    () =>
      injectedClient ??
      new HttpAdminAccessClient(resolveAdminApiBaseUrl(), identity),
    [identity, injectedClient],
  );
  const operatorManagementClient = useMemo(
    () =>
      injectedOperatorManagementClient ??
      (client as AdminAccessClient & AdminOperatorManagementClient),
    [client, injectedOperatorManagementClient],
  );
  const tripCaseManagementClient = useMemo(
    () =>
      injectedTripCaseManagementClient ??
      (client as AdminAccessClient & AdminTripCaseManagementClient),
    [client, injectedTripCaseManagementClient],
  );
  const financeOperationsClient = useMemo(
    () =>
      injectedFinanceOperationsClient ??
      (client as AdminAccessClient & AdminFinanceOperationsClient),
    [client, injectedFinanceOperationsClient],
  );
  const executiveDashboardClient = useMemo(
    () =>
      injectedExecutiveDashboardClient ??
      (client as AdminAccessClient & AdminExecutiveDashboardClient),
    [client, injectedExecutiveDashboardClient],
  );
  const [session, setSession] = useState<AdminInternalSession>();
  const [page, setPage] = useState<StageOnePage>("platform_workbench");
  const [platform, setPlatform] = useState<AdminPlatformWorkbench>();
  const [operator, setOperator] = useState<AdminOperatorWorkbench>();
  const [directory, setDirectory] =
    useState<readonly AdminOperatorDirectoryEntry[]>();
  const [audit, setAudit] = useState<readonly AdminAuditEvent[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    setNotice(undefined);
    setSession(undefined);
    setPlatform(undefined);
    setOperator(undefined);
    setDirectory(undefined);
    setAudit(undefined);
    client
      .getSession()
      .then((nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setPage(defaultPage(nextSession));
      })
      .catch((reason: unknown) => {
        if (active) setError(errorCode(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client]);

  useEffect(() => {
    if (!session) return;
    if (isStageTwoPage(page) || isStageThreePage(page) || isStageFourPage(page) || isStageFivePage(page)) {
      setLoading(false);
      setError(undefined);
      return;
    }
    let active = true;
    setLoading(true);
    setError(undefined);
    const request =
      page === "platform_workbench"
        ? client.getPlatformWorkbench().then((value) => {
            if (active) setPlatform(value);
          })
        : page === "operator_workbench"
          ? client.getOperatorWorkbench().then((value) => {
              if (active) setOperator(value);
            })
          : page === "operator_directory"
            ? client.listOperatorDirectory().then((value) => {
                if (active) setDirectory(value);
              })
            : client.listAuditEvents().then((value) => {
                if (active) setAudit(value);
              });
    request
      .catch((reason: unknown) => {
        if (active) setError(errorCode(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, page, session]);

  async function switchContext(organizationId: string) {
    setLoading(true);
    setError(undefined);
    try {
      const nextSession = await client.switchContext(organizationId);
      setSession(nextSession);
      setNotice(
        `观察范围已切换为${nextSession.context.organizationName}；功能角色和数据等级未改变。`,
      );
      if (page === "operator_directory") {
        setDirectory(await client.listOperatorDirectory());
      } else {
        setPlatform(await client.getPlatformWorkbench());
      }
    } catch (reason) {
      setError(errorCode(reason));
    } finally {
      setLoading(false);
    }
  }

  if (loading && !session) {
    return <StageState title="正在建立受控会话" detail="从 Server 读取组织成员关系和功能角色。" />;
  }
  if (error && !session) {
    return (
      <StageState
        title={error === "FEATURE_DISABLED" ? "多组织后台门禁关闭" : "无法进入运营控制台"}
        detail={
          error === "FEATURE_DISABLED"
            ? "请同时显式开启前端和 Server 的 synthetic_admin_multi_organization 门禁。"
            : `服务端拒绝代码：${error}`
        }
      />
    );
  }
  if (!session) return null;

  const isPlatform = session.functionalRoles.includes(
    "platform_operations_lead",
  );

  return (
    <div className="stage-shell">
      <div className="stage-environment">
        <strong>内部合成环境 · 多组织后台底座</strong>
        <span>真实账号、真实组织、真实数据与生产启用均未开放</span>
      </div>
      <header className="stage-topbar">
        <div className="stage-brand">
          <span>PC</span>
          <div><b>PollyCar</b><small>运营控制台</small></div>
        </div>
        <div className="stage-context" aria-label="当前组织上下文">
          <span>{session.context.organizationName}</span>
          <span>城市：{session.context.cityScopes.join("、")}</span>
          <span>{roleLabel(session.functionalRoles[0])}</span>
          {session.context.fixed ? <span>主体上下文固定</span> : null}
        </div>
        <div className="stage-top-actions">
          {!injectedClient ? (
            <select
              aria-label="切换合成内部身份"
              value={identity}
              onChange={(event) => {
                setSession(undefined);
                setNotice(undefined);
                setError(undefined);
                setIdentity(event.target.value as SyntheticAdminIdentity);
              }}
            >
              <option value="synthetic-platform-ops-001">平台运营负责人</option>
              <option value="synthetic-operator-ops-001">运营主体运营主管</option>
              <option value="synthetic-support-001">客服人员</option>
              <option value="synthetic-safety-officer-001">安全人员</option>
              <option value="synthetic-safety-lead-001">安全负责人</option>
              <option value="synthetic-technical-ops-001">技术运维</option>
              <option value="synthetic-finance-officer-001">平台财务经办</option>
              <option value="synthetic-finance-lead-001">平台财务负责人</option>
              <option value="synthetic-operator-finance-officer-001">运营主体财务经办</option>
              <option value="synthetic-operator-finance-lead-001">运营主体财务负责人</option>
              <option value="synthetic-auditor-001">审计员</option>
              <option value="synthetic-executive-sponsor-001">项目决策人</option>
              <option value="synthetic-operations-lead-001">平台运营负责人（高层）</option>
              <option value="synthetic-privacy-compliance-001">隐私合规负责人</option>
              <option value="synthetic-operator-executive-001">运营主体负责人</option>
            </select>
          ) : null}
          <button type="button" onClick={toggle} aria-label={`切换为${theme === "light" ? "深色" : "浅色"}主题`}>
            {theme === "light" ? "深色" : "浅色"}
          </button>
          <span className="stage-avatar">{session.displayName.slice(0, 1)}</span>
        </div>
      </header>
      <aside className="stage-sidebar">
        <nav aria-label="运营控制台导航">
          {session.visibleModules.includes("platform_workbench") ? (
            <NavButton active={page === "platform_workbench"} onClick={() => setPage("platform_workbench")}>
              平台工作台
            </NavButton>
          ) : null}
          {session.visibleModules.includes("operator_workbench") ? (
            <NavButton active={page === "operator_workbench"} onClick={() => setPage("operator_workbench")}>
              运营主体工作台
            </NavButton>
          ) : null}
          {session.visibleModules.includes("operator_directory") ? (
            <NavButton active={page === "operator_directory"} onClick={() => setPage("operator_directory")}>
              运营主体名录
            </NavButton>
          ) : null}
          {operatorManagementEnabled && session.visibleModules.includes("operator_management") ? (
            <NavButton active={page === "operator_management"} onClick={() => setPage("operator_management")}>
              运营主体 360°
            </NavButton>
          ) : null}
          {operatorManagementEnabled && session.visibleModules.includes("operator_onboarding") ? (
            <NavButton active={page === "operator_onboarding"} onClick={() => setPage("operator_onboarding")}>
              入驻案件
            </NavButton>
          ) : null}
          {operatorManagementEnabled && session.visibleModules.includes("driver_directory") ? (
            <NavButton active={page === "driver_directory"} onClick={() => setPage("driver_directory")}>
              车主 360°
            </NavButton>
          ) : null}
          {operatorManagementEnabled && session.visibleModules.includes("vehicle_directory") ? (
            <NavButton active={page === "vehicle_directory"} onClick={() => setPage("vehicle_directory")}>
              车辆 360°
            </NavButton>
          ) : null}
          {operatorManagementEnabled && session.visibleModules.includes("primary_operator_relationships") ? (
            <NavButton active={page === "primary_operator_relationships"} onClick={() => setPage("primary_operator_relationships")}>
              主运营关系迁移
            </NavButton>
          ) : null}
          {tripOperationsEnabled && session.visibleModules.includes("trip_operations") ? (
            <NavButton active={page === "trip_operations"} onClick={() => setPage("trip_operations")}>
              行程运营中心
            </NavButton>
          ) : null}
          {tripOperationsEnabled && session.visibleModules.includes("trip_directory") ? (
            <NavButton active={page === "trip_directory"} onClick={() => setPage("trip_directory")}>
              行程 360°
            </NavButton>
          ) : null}
          {caseManagementEnabled && session.visibleModules.includes("support_cases") ? (
            <NavButton active={page === "support_cases"} onClick={() => setPage("support_cases")}>
              客服案件
            </NavButton>
          ) : null}
          {caseManagementEnabled && session.visibleModules.includes("safety_cases") ? (
            <NavButton active={page === "safety_cases"} onClick={() => setPage("safety_cases")}>
              安全案件
            </NavButton>
          ) : null}
          {caseManagementEnabled && session.visibleModules.includes("evidence_access") ? (
            <NavButton active={page === "evidence_access"} onClick={() => setPage("evidence_access")}>
              证据访问
            </NavButton>
          ) : null}
          {caseManagementEnabled && session.visibleModules.includes("command_recovery") ? (
            <NavButton active={page === "command_recovery"} onClick={() => setPage("command_recovery")}>
              未知结果恢复
            </NavButton>
          ) : null}
          {financeOperationsEnabled && session.visibleModules.includes("finance_operations") ? (
            <NavButton active={page === "finance_operations"} onClick={() => setPage("finance_operations")}>
              资金运营中心
            </NavButton>
          ) : null}
          {financeOperationsEnabled && session.visibleModules.includes("finance_allocation_settlement") ? (
            <NavButton active={page === "finance_allocation_settlement"} onClick={() => setPage("finance_allocation_settlement")}>
              分配与清算
            </NavButton>
          ) : null}
          {financeOperationsEnabled && session.visibleModules.includes("finance_driver_payouts") ? (
            <NavButton active={page === "finance_driver_payouts"} onClick={() => setPage("finance_driver_payouts")}>
              T+1 车主付款
            </NavButton>
          ) : null}
          {financeOperationsEnabled && session.visibleModules.includes("finance_refund_reversals") ? (
            <NavButton active={page === "finance_refund_reversals"} onClick={() => setPage("finance_refund_reversals")}>
              退款与完整冲正
            </NavButton>
          ) : null}
          {financeOperationsEnabled && session.visibleModules.includes("finance_reconciliation_cases") ? (
            <NavButton active={page === "finance_reconciliation_cases"} onClick={() => setPage("finance_reconciliation_cases")}>
              对账与资金案件
            </NavButton>
          ) : null}
          {financeOperationsEnabled && session.visibleModules.includes("finance_business_day_close") ? (
            <NavButton active={page === "finance_business_day_close"} onClick={() => setPage("finance_business_day_close")}>
              日终关账
            </NavButton>
          ) : null}
          {financeOperationsEnabled && session.visibleModules.includes("finance_ledger") ? (
            <NavButton active={page === "finance_ledger"} onClick={() => setPage("finance_ledger")}>
              账本查询
            </NavButton>
          ) : null}
          {executiveDashboardEnabled && session.visibleModules.includes("executive_overview") ? (
            <NavButton active={page === "executive_overview"} onClick={() => setPage("executive_overview")}>高层总览</NavButton>
          ) : null}
          {executiveDashboardEnabled && session.visibleModules.includes("executive_operations_health") ? (
            <NavButton active={page === "executive_operations_health"} onClick={() => setPage("executive_operations_health")}>经营趋势</NavButton>
          ) : null}
          {executiveDashboardEnabled && session.visibleModules.includes("executive_operator_health") ? (
            <NavButton active={page === "executive_operator_health"} onClick={() => setPage("executive_operator_health")}>主体健康</NavButton>
          ) : null}
          {executiveDashboardEnabled && session.visibleModules.includes("executive_finance_safety") ? (
            <NavButton active={page === "executive_finance_safety"} onClick={() => setPage("executive_finance_safety")}>资金安全</NavButton>
          ) : null}
          {executiveDashboardEnabled && session.visibleModules.includes("executive_safety_compliance") ? (
            <NavButton active={page === "executive_safety_compliance"} onClick={() => setPage("executive_safety_compliance")}>安全与合规</NavButton>
          ) : null}
          {executiveDashboardEnabled && session.visibleModules.includes("executive_decisions_metrics") ? (
            <NavButton active={page === "executive_decisions_metrics"} onClick={() => setPage("executive_decisions_metrics")}>待决与口径</NavButton>
          ) : null}
          {session.visibleModules.includes("audit") ? (
            <NavButton active={page === "audit"} onClick={() => setPage("audit")}>
              审计记录
            </NavButton>
          ) : null}
        </nav>
        <div className="stage-scope-card">
          <b>服务端授权范围</b>
          <span>主体：{session.context.operatorScopes.length || 1} 个</span>
          <span>最高数据等级：{classificationLabel(session.maximumDataClassification)}</span>
          <span>临时授权：{session.temporaryGrants.length} 项</span>
        </div>
      </aside>
      <main className="stage-main">
        {notice ? <div className="stage-notice" role="status">{notice}</div> : null}
        {error ? <div className="stage-error" role="alert">服务端拒绝：{error}</div> : null}
        {loading ? <p className="stage-loading">正在刷新受控数据…</p> : null}
        {page === "platform_workbench" && platform ? (
          <PlatformWorkbench
            data={platform}
            session={session}
            onSwitchContext={switchContext}
          />
        ) : null}
        {page === "operator_workbench" && operator ? (
          <OperatorWorkbench data={operator} onForbiddenSwitch={() => switchContext("operator-shencheng")} />
        ) : null}
        {page === "operator_directory" && directory ? (
          <OperatorDirectory entries={directory} />
        ) : null}
        {page === "audit" && audit ? <AuditPage events={audit} /> : null}
        {operatorManagementEnabled && isStageTwoPage(page) ? (
          <StageTwoWorkspace
            page={page}
            client={operatorManagementClient}
            session={session}
          />
        ) : null}
        {(tripOperationsEnabled || caseManagementEnabled) && isStageThreePage(page) ? (
          <StageThreeWorkspace
            page={page}
            client={tripCaseManagementClient}
            session={session}
          />
        ) : null}
        {financeOperationsEnabled && isStageFourPage(page) ? (
          <StageFourWorkspace
            page={page}
            client={financeOperationsClient}
            session={session}
          />
        ) : null}
        {executiveDashboardEnabled && isStageFivePage(page) ? (
          <StageFiveWorkspace
            page={page}
            client={executiveDashboardClient}
            session={session}
          />
        ) : null}
        {!isPlatform && page === "operator_directory" ? (
          <div className="stage-error" role="alert">运营主体人员无权访问平台运营主体名录。</div>
        ) : null}
      </main>
    </div>
  );
}

function PlatformWorkbench({
  data,
  session,
  onSwitchContext,
}: Readonly<{
  data: AdminPlatformWorkbench;
  session: AdminInternalSession;
  onSwitchContext(organizationId: string): void;
}>) {
  return (
    <>
      <PageHeading
        eyebrow="平台组织 · 合成运营"
        title="平台运营工作台"
        detail="优先处理跨主体阻断、即将超时任务和需要独立复核的事项。组织观察范围变化不会改变真实功能角色。"
      >
        <label className="stage-context-select">
          观察范围
          <select
            aria-label="运营主体观察范围"
            value={session.context.organizationId}
            onChange={(event) => onSwitchContext(event.target.value)}
          >
            {session.availableContexts.map((context) => (
              <option key={context.organizationId} value={context.organizationId}>
                {context.organizationName}
              </option>
            ))}
          </select>
        </label>
      </PageHeading>
      <GateBanner />
      <MetricGrid
        values={[
          ["待处理工作任务", data.metrics.pendingTasks],
          ["两小时内超时", data.metrics.dueSoon],
          ["阻断清算或关账", data.metrics.blockingCases],
          ["范围内运营主体", data.metrics.operatorsInScope],
        ]}
      />
      <div className="stage-grid">
        <TaskPanel title="优先工作任务" tasks={data.tasks} />
        <section className="stage-panel">
          <header><h2>运营主体健康</h2><p>仅显示当前观察范围内的聚合事实</p></header>
          <div className="stage-list">
            {data.operatorHealth.map((item) => (
              <article key={item.operatorId}>
                <div><b>{item.operatorName}</b><p>{item.summary}</p></div>
                <Status value={item.status} />
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function OperatorWorkbench({
  data,
  onForbiddenSwitch,
}: Readonly<{
  data: AdminOperatorWorkbench;
  onForbiddenSwitch(): void;
}>) {
  return (
    <>
      <PageHeading
        eyebrow={`${data.operatorName} · 上海`}
        title="运营主体工作台"
        detail="集中处理本主体运力、行程协作和服务任务。所有查询均由 Server 固定附加本主体范围。"
      >
        <button type="button" className="stage-secondary" onClick={onForbiddenSwitch}>
          尝试切换主体
        </button>
      </PageHeading>
      <div className="stage-scope-banner">
        <b>当前会话只能访问{data.operatorName}</b>
        <span>深链接和 API 会重新授权；不能访问其他运营主体。</span>
      </div>
      <MetricGrid
        values={[
          ["待处理主体任务", data.metrics.pendingTasks],
          ["证照即将到期", data.metrics.expiringDocuments],
          ["今日预约协作", data.metrics.scheduledTrips],
          ["付款状态关注", data.metrics.payoutAttention],
        ]}
      />
      <div className="stage-grid">
        <TaskPanel title="本主体优先任务" tasks={data.tasks} />
        <section className="stage-panel">
          <header><h2>资金关闭态</h2><p>金额来自账本，阶段一不提供操作</p></header>
          <div className="stage-closed-state">
            <Status value="attention" />
            <b>只读状态</b>
            <p>`T+1` 付款与对账信息不可编辑，非零差异将阻止付款。</p>
            <button type="button" disabled>资金操作门禁关闭</button>
          </div>
        </section>
      </div>
    </>
  );
}

function OperatorDirectory({
  entries,
}: Readonly<{ entries: readonly AdminOperatorDirectoryEntry[] }>) {
  const [query, setQuery] = useState("");
  const filtered = entries.filter((entry) =>
    `${entry.operatorName}${entry.syntheticReference}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="组织与运力 · 只读名录"
        title="运营主体"
        detail="只展示当前平台范围内的脱敏运营摘要；阶段一不提供创建、激活、编辑、迁移或退出入口。"
      />
      <div className="stage-directory-toolbar">
        <input
          aria-label="搜索运营主体"
          placeholder="搜索主体名称或合成编号"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span>只读 · 敏感字段已遮蔽</span>
      </div>
      <div className="stage-table-wrap">
        <table>
          <thead><tr><th>运营主体</th><th>城市与能力</th><th>运力</th><th>服务状态</th><th>资金门禁</th><th>待办</th></tr></thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.operatorId}>
                <td><b>{entry.operatorName}</b><small>{entry.syntheticReference} · 联系人 {entry.contactMasked}</small></td>
                <td>{entry.cities.join("、")}<small>{entry.capabilities.join("、")}</small></td>
                <td>{entry.activeDrivers} 名车主<small>{entry.activeVehicles} 辆车</small></td>
                <td><Status value={entry.serviceStatus} /></td>
                <td>{entry.financeGateSummary}</td>
                <td>{entry.pendingTaskCount} 项</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AuditPage({ events }: Readonly<{ events: readonly AdminAuditEvent[] }>) {
  return (
    <>
      <PageHeading
        eyebrow="追加式审计"
        title="访问与范围事件"
        detail="记录认证、范围切换、允许与拒绝判定；不保存严格敏感原文。"
      />
      <section className="stage-panel">
        <div className="stage-audit-list">
          {[...events].reverse().map((event) => (
            <article key={event.eventId}>
              <div><b>{eventLabel(event.eventType)}</b><p>{event.action ?? "会话事件"} · {event.reasonCode ?? event.result}</p></div>
              <time>{new Date(event.occurredAt).toLocaleString("zh-CN")}</time>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function PageHeading({
  eyebrow,
  title,
  detail,
  children,
}: Readonly<{
  eyebrow: string;
  title: string;
  detail: string;
  children?: React.ReactNode;
}>) {
  return (
    <div className="stage-heading">
      <div><span>{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div>
      {children ? <div>{children}</div> : null}
    </div>
  );
}

function MetricGrid({ values }: Readonly<{ values: readonly (readonly [string, number])[] }>) {
  return (
    <section className="stage-metrics" aria-label="工作台摘要">
      {values.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>合成运营摘要</small></article>)}
    </section>
  );
}

function TaskPanel({
  title,
  tasks,
}: Readonly<{ title: string; tasks: AdminPlatformWorkbench["tasks"] }>) {
  return (
    <section className="stage-panel">
      <header><h2>{title}</h2><p>按风险、截止时间和职责分离排序</p></header>
      <div className="stage-list">
        {tasks.map((task) => (
          <article key={task.taskId}>
            <span className={`stage-task-kind ${task.priority}`}>{task.category.slice(0, 1).toUpperCase()}</span>
            <div><b>{task.title}</b><p>{task.description}</p></div>
            <small>{task.dueLabel}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function GateBanner() {
  return <div className="stage-gate"><b>阶段一合成门禁已开启</b><span>真实账号、资金操作和生产环境继续关闭。</span></div>;
}

function NavButton({
  active,
  onClick,
  children,
}: Readonly<{ active: boolean; onClick(): void; children: React.ReactNode }>) {
  return <button type="button" className={active ? "active" : ""} onClick={onClick}>{children}</button>;
}

function Status({ value }: Readonly<{ value: "normal" | "attention" | "blocked" }>) {
  return <span className={`stage-status ${value}`}>{value === "normal" ? "正常" : value === "attention" ? "需关注" : "已阻断"}</span>;
}

function StageState({ title, detail }: Readonly<{ title: string; detail: string }>) {
  return <main className="stage-state"><div><span>PC</span><h1>{title}</h1><p>{detail}</p></div></main>;
}

function defaultPage(session: AdminInternalSession): StageOnePage {
  const preferred: readonly StageOnePage[] = [
    "platform_workbench",
    "operator_workbench",
    "trip_operations",
    "support_cases",
    "safety_cases",
    "command_recovery",
    "trip_directory",
    "evidence_access",
    "finance_operations",
    "finance_allocation_settlement",
    "finance_driver_payouts",
    "finance_refund_reversals",
    "finance_reconciliation_cases",
    "finance_business_day_close",
    "finance_ledger",
    "executive_overview",
    "executive_operations_health",
    "executive_operator_health",
    "executive_finance_safety",
    "executive_safety_compliance",
    "executive_decisions_metrics",
    "audit",
  ];
  return preferred.find((page) => session.visibleModules.includes(page)) ?? "audit";
}

function roleLabel(role: AdminInternalSession["functionalRoles"][number] | undefined): string {
  if (role === "platform_operations_lead") return "平台运营负责人";
  if (role === "operator_operations_lead") return "运营主管";
  if (role === "operator_administrator") return "运营主体管理员";
  if (role === "customer_support_agent") return "客服人员";
  if (role === "safety_officer") return "安全人员";
  if (role === "safety_lead") return "安全负责人";
  if (role === "technical_operations") return "技术运维";
  if (role === "finance_officer") return "平台财务经办";
  if (role === "finance_lead") return "平台财务负责人";
  if (role === "operator_finance_officer") return "运营主体财务经办";
  if (role === "operator_finance_lead") return "运营主体财务负责人";
  if (role === "auditor") return "审计员";
  if (role === "executive_sponsor") return "项目决策人";
  if (role === "operations_lead") return "平台运营负责人";
  if (role === "privacy_compliance") return "隐私合规负责人";
  if (role === "operator_executive") return "运营主体负责人";
  return "治理观察角色";
}

function classificationLabel(value: AdminInternalSession["maximumDataClassification"]): string {
  return value === "restricted" ? "严格敏感" : value === "sensitive" ? "敏感" : "内部";
}

function eventLabel(event: AdminAuditEvent["eventType"]): string {
  if (event === "access_allowed") return "访问已允许";
  if (event === "access_denied") return "访问已拒绝";
  if (event === "organization_context_changed") return "组织范围已切换";
  return "内部身份认证成功";
}

function errorCode(reason: unknown): string {
  return reason instanceof Error ? reason.message : "INTERNAL_UNEXPECTED_ERROR";
}

function isStageTwoPage(page: StageOnePage): page is StageTwoPage {
  return [
    "operator_management",
    "operator_onboarding",
    "driver_directory",
    "vehicle_directory",
    "primary_operator_relationships",
  ].includes(page);
}

function isStageThreePage(page: StageOnePage): page is StageThreePage {
  return [
    "trip_operations",
    "trip_directory",
    "support_cases",
    "safety_cases",
    "evidence_access",
    "command_recovery",
  ].includes(page);
}

function isStageFourPage(page: StageOnePage): page is StageFourPage {
  return [
    "finance_operations",
    "finance_allocation_settlement",
    "finance_driver_payouts",
    "finance_refund_reversals",
    "finance_reconciliation_cases",
    "finance_business_day_close",
    "finance_ledger",
  ].includes(page);
}

function isStageFivePage(page: StageOnePage): page is StageFivePage {
  return [
    "executive_overview",
    "executive_operations_health",
    "executive_operator_health",
    "executive_finance_safety",
    "executive_safety_compliance",
    "executive_decisions_metrics",
  ].includes(page);
}
