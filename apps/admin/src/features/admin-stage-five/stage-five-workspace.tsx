import { useEffect, useState } from "react";
import type {
  AdminExecutiveDashboardClient,
  AdminExecutiveDecisionsMetrics,
  AdminExecutiveFinanceSafety,
  AdminExecutiveOperationsHealth,
  AdminExecutiveOperatorHealth,
  AdminExecutiveOverview,
  AdminExecutiveSafetyCompliance,
  AdminInternalSession,
  ExecutiveDashboardBase,
  ExecutiveMetricValue,
} from "@pollycar/contracts";
import "./stage-five-workspace.css";

export type StageFivePage =
  | "executive_overview"
  | "executive_operations_health"
  | "executive_operator_health"
  | "executive_finance_safety"
  | "executive_safety_compliance"
  | "executive_decisions_metrics";

type StageFiveView =
  | AdminExecutiveOverview
  | AdminExecutiveOperationsHealth
  | AdminExecutiveOperatorHealth
  | AdminExecutiveFinanceSafety
  | AdminExecutiveSafetyCompliance
  | AdminExecutiveDecisionsMetrics;

export function StageFiveWorkspace({
  page,
  client,
  session,
}: Readonly<{
  page: StageFivePage;
  client: AdminExecutiveDashboardClient;
  session: AdminInternalSession;
}>) {
  const [data, setData] = useState<StageFiveView>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let active = true;
    setData(undefined);
    setError(undefined);
    setNotice(undefined);
    const request =
      page === "executive_overview"
        ? client.getExecutiveOverview()
        : page === "executive_operations_health"
          ? client.getExecutiveOperationsHealth()
          : page === "executive_operator_health"
            ? client.getExecutiveOperatorHealth()
            : page === "executive_finance_safety"
              ? client.getExecutiveFinanceSafety()
              : page === "executive_safety_compliance"
                ? client.getExecutiveSafetyCompliance()
                : client.getExecutiveDecisionItems();
    request.then((value) => {
      if (active) setData(value);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "INTERNAL_UNEXPECTED_ERROR");
    });
    return () => {
      active = false;
    };
  }, [client, page, session.context.organizationId]);

  if (error) return <section className="executive-panel"><p role="alert">服务端拒绝：{error}</p></section>;
  if (!data) return <p className="executive-loading">正在加载阶段五合成聚合数据…</p>;

  const common = (
    <>
      <StateBanner data={data} />
      {notice ? <div className="executive-notice" role="status">{notice}</div> : null}
    </>
  );

  if ("majorBlockers" in data) return <>{common}<Overview data={data} /></>;
  if ("cities" in data) return <>{common}<Operations data={data} /></>;
  if ("operators" in data) return <>{common}<Operators data={data} /></>;
  if ("disclosureLevel" in data) return <>{common}<Finance data={data} /></>;
  if ("majorCases" in data) return <>{common}<Safety data={data} /></>;
  return <>{common}<Decisions data={data} client={client} onNotice={setNotice} /></>;
}

function Overview({ data }: Readonly<{ data: AdminExecutiveOverview }>) {
  return (
    <>
      <Heading eyebrow="阶段五 · 高层聚合" title="高层总览" detail="只读聚合跨领域状态；任何业务动作仍回到原职责工作台执行。" />
      <MetricGrid metrics={data.metrics} />
      <section className="executive-panel">
        <header><h2>重大阻断</h2><p>{data.decisionItemCount} 项待高层判断</p></header>
        <div className="executive-list">
          {data.majorBlockers.map((blocker) => (
            <article key={blocker.blockerId}>
              <span className={`executive-dot ${blocker.severity}`} />
              <div><b>{domainLabel(blocker.domain)}</b><p>{blocker.summary}</p></div>
              <small>转到 {blocker.sourceWorkspace}</small>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function Operations({ data }: Readonly<{ data: AdminExecutiveOperationsHealth }>) {
  return (
    <>
      <Heading eyebrow="经营趋势" title="经营趋势与城市健康" detail="Server 返回万分比和整数秒；页面只格式化，不重新计算。" />
      <MetricGrid metrics={data.metrics} />
      <section className="executive-panel">
        <header><h2>城市健康</h2><p>小样本切片固定抑制</p></header>
        <div className="executive-table-wrap">
          <table><thead><tr><th>城市</th><th>完成率</th><th>接单率</th><th>取消率</th><th>匹配 P50</th><th>状态</th></tr></thead>
            <tbody>{data.cities.map((city) => (
              <tr key={city.cityCode}>
                <td>{city.cityName}<small>{city.cityCode}</small></td>
                {city.state === "suppressed" ? <td colSpan={4}>样本量不足，已抑制</td> : <>
                  <td>{basisPoints(city.completionRateBasisPoints)}</td>
                  <td>{basisPoints(city.acceptanceRateBasisPoints)}</td>
                  <td>{basisPoints(city.cancellationRateBasisPoints)}</td>
                  <td>{duration(city.matchingDurationP50Seconds)}</td>
                </>}
                <td><Tag value={city.state} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Operators({ data }: Readonly<{ data: AdminExecutiveOperatorHealth }>) {
  return (
    <>
      <Heading eyebrow={data.ruleVersion} title="运营主体健康" detail="固定采用最严重维度优先，禁止加权平均掩盖硬阻断。" />
      <section className="executive-operator-grid">
        {data.operators.map((operator) => (
          <article key={operator.operatorId}>
            <header><div><b>{operator.operatorName}</b><small>{operator.operatorId}</small></div><Tag value={operator.health} /></header>
            <dl>
              {Object.entries(operator.dimensions).map(([key, value]) => <div key={key}><dt>{dimensionLabel(key)}</dt><dd><Tag value={value} /></dd></div>)}
            </dl>
            <p>{operator.triggerReasons.length ? operator.triggerReasons.join("、") : "无触发原因"}</p>
          </article>
        ))}
      </section>
    </>
  );
}

function Finance({ data }: Readonly<{ data: AdminExecutiveFinanceSafety }>) {
  return (
    <>
      <Heading eyebrow={`资金披露 ${data.disclosureLevel}`} title="资金安全" detail={data.exactAmountAccessAllowed ? "财务负责人具备独立 L3 精确聚合授权。" : "当前身份只显示 L2 状态、区间和趋势。"} />
      <MetricGrid metrics={data.metrics} />
      <section className="executive-split">
        <article><span>清算状态</span><strong>{statusLabel(data.settlementStatus)}</strong><p>非零差异继续阻止清算与付款。</p></article>
        <article><span>付款状态</span><strong>{statusLabel(data.payoutStatus)}</strong><p>未知结果只能查询原请求，禁止重复付款。</p></article>
      </section>
    </>
  );
}

function Safety({ data }: Readonly<{ data: AdminExecutiveSafetyCompliance }>) {
  return (
    <>
      <Heading eyebrow="安全与合规" title="安全与合规" detail="仅呈现去标识摘要；证据原文、精确位置和聊天正文不可从驾驶舱读取。" />
      <MetricGrid metrics={data.metrics} />
      <section className="executive-panel">
        <header><h2>重大案件摘要</h2><p>原始证据不可用</p></header>
        <div className="executive-list">
          {data.majorCases.map((caseItem) => <article key={caseItem.caseId}><span className="executive-dot attention" /><div><b>{caseItem.caseId}</b><p>{caseItem.summary}</p></div><small>{caseItem.state}</small></article>)}
        </div>
      </section>
    </>
  );
}

function Decisions({
  data,
  client,
  onNotice,
}: Readonly<{
  data: AdminExecutiveDecisionsMetrics;
  client: AdminExecutiveDashboardClient;
  onNotice(value: string): void;
}>) {
  const [busy, setBusy] = useState(false);

  async function recordOpinion(decisionItemId: string) {
    setBusy(true);
    try {
      const result = await client.recordExecutiveDecisionOpinion({
        decisionItemId,
        decisionCode: "continue_controlled_review",
        reasonCode: "executive_governance_input",
        responsibleRole: "operations_lead",
        dueAt: "2026-07-20T10:00:00.000Z",
        resourceVersion: 1,
      });
      onNotice(`已追加高层意见 ${result.opinionId}；原业务状态未改变。`);
    } catch (reason) {
      onNotice(`记录失败：${reason instanceof Error ? reason.message : "INTERNAL_UNEXPECTED_ERROR"}`);
    } finally {
      setBusy(false);
    }
  }

  async function requestExport() {
    setBusy(true);
    try {
      const result = await client.createExecutiveExportRequest({
        domain: "operations",
        purpose: "高层周度治理复盘",
        fieldSet: ["trip_completion_rate", "dispatch_acceptance_rate"],
        windowStart: data.dataWindow.start,
        windowEnd: data.dataWindow.end,
      });
      onNotice(`导出申请 ${result.exportRequestId} 已进入隐私合规复核；尚未生成文件。`);
    } catch (reason) {
      onNotice(`导出申请失败：${reason instanceof Error ? reason.message : "INTERNAL_UNEXPECTED_ERROR"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Heading eyebrow="治理输入" title="待决事项与指标口径" detail="高层意见采用追加式记录，不执行批准、拒绝、付款、恢复或生产启用命令。" />
      <div className="executive-actions"><button type="button" disabled={busy} onClick={requestExport}>申请受控导出</button><span>隐私合规 + 对应职责域负责人双人批准</span></div>
      <section className="executive-panel">
        <header><h2>待决事项</h2><p>{data.decisionItems.length} 项开放</p></header>
        <div className="executive-decision-list">
          {data.decisionItems.map((item) => (
            <article key={item.decisionItemId}>
              <div><span>{domainLabel(item.domain)}</span><h3>{item.title}</h3><p>{item.summary}</p><small>责任角色 {item.responsibleRole} · 截止 {new Date(item.dueAt).toLocaleString("zh-CN")}</small></div>
              <button type="button" disabled={busy} onClick={() => recordOpinion(item.decisionItemId)}>记录高层决策意见</button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function StateBanner({ data }: Readonly<{ data: ExecutiveDashboardBase }>) {
  return (
    <div className={`executive-state ${data.pageState}`}>
      <div><b>{pageStateLabel(data.pageState)}</b><span>截至 {new Date(data.asOf).toLocaleString("zh-CN")} · {data.dataWindow.timezone}</span></div>
      <span>组织范围：{data.context.organizationName}</span>
      {data.notices.map((notice) => <p key={notice}>{notice}</p>)}
    </div>
  );
}

function Heading({ eyebrow, title, detail }: Readonly<{ eyebrow: string; title: string; detail: string }>) {
  return <div className="executive-heading"><span>{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div>;
}

function MetricGrid({ metrics }: Readonly<{ metrics: readonly ExecutiveMetricValue[] }>) {
  return (
    <section className="executive-metrics" aria-label="高层指标">
      {metrics.map((metricItem) => (
        <article key={metricItem.metricId}>
          <span>{metricItem.label}</span><strong>{metricItem.displayValue}</strong>
          <small>{metricItem.metricVersion} · {metricItem.closeStatus === "unclosed" ? "未关账" : "来源可用"}</small>
        </article>
      ))}
    </section>
  );
}

function Tag({ value }: Readonly<{ value: string }>) {
  return <span className={`executive-tag ${value}`}>{statusLabel(value)}</span>;
}

function basisPoints(value: number) {
  return `${(value / 100).toFixed(1)}%`;
}

function duration(value: number) {
  return `${Math.floor(value / 60)} 分 ${value % 60} 秒`;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    healthy: "健康", attention: "需关注", blocked: "已阻断", unavailable: "不可用",
    suppressed: "已抑制", normal: "正常", investigating: "调查中",
  };
  return labels[value] ?? value;
}

function pageStateLabel(value: ExecutiveDashboardBase["pageState"]) {
  const labels: Record<ExecutiveDashboardBase["pageState"], string> = {
    ready: "数据可用", partial: "局部降级", stale: "数据陈旧", unclosed: "包含未关账数据",
    suppressed: "小样本已抑制", unavailable: "关键来源不可用", scope_denied: "组织范围被拒绝", feature_disabled: "功能门禁关闭",
  };
  return labels[value];
}

function domainLabel(value: string) {
  return value === "finance" ? "资金" : value === "safety_compliance" ? "安全合规" : "经营";
}

function dimensionLabel(value: string) {
  return value === "service" ? "服务" : value === "finance" ? "资金" : value === "safety" ? "安全" : "合规";
}
