import { useEffect, useState } from "react";
import type {
  AdminAllocationSettlement,
  AdminBusinessDayClose,
  AdminDriverPayout,
  AdminFinanceOperationsCenter,
  AdminFinanceOperationsClient,
  AdminInternalSession,
  AdminLedgerTransaction,
  AdminReconciliationFundCases,
  AdminRefundReversal,
} from "@pollycar/contracts";
import "./stage-four-workspace.css";

export type StageFourPage =
  | "finance_operations"
  | "finance_allocation_settlement"
  | "finance_driver_payouts"
  | "finance_refund_reversals"
  | "finance_reconciliation_cases"
  | "finance_business_day_close"
  | "finance_ledger";

type FinanceView =
  | AdminFinanceOperationsCenter
  | AdminAllocationSettlement
  | AdminDriverPayout
  | AdminRefundReversal
  | AdminReconciliationFundCases
  | AdminBusinessDayClose
  | AdminLedgerTransaction;

export function StageFourWorkspace({
  page,
  client,
  session,
}: Readonly<{
  page: StageFourPage;
  client: AdminFinanceOperationsClient;
  session: AdminInternalSession;
}>) {
  const [data, setData] = useState<FinanceView>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setData(undefined);
    setError(undefined);
    const request =
      page === "finance_operations"
        ? client.getFinanceOperationsCenter()
        : page === "finance_allocation_settlement"
          ? client.getAllocationSettlement("settlement-synthetic-184")
          : page === "finance_driver_payouts"
            ? client.getDriverPayout("payout-synthetic-0714")
            : page === "finance_refund_reversals"
              ? client.getRefundReversal("finance-case-synthetic-071")
              : page === "finance_reconciliation_cases"
                ? client.getReconciliationFundCases("reconciliation-synthetic-0714")
                : page === "finance_business_day_close"
                  ? client.getBusinessDayClose("2026-07-13")
                  : client.getLedgerTransaction("ledger-transaction-synthetic-19341");
    request.then((value) => {
      if (active) setData(value);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "INTERNAL_UNEXPECTED_ERROR");
    });
    return () => {
      active = false;
    };
  }, [client, page, session.context.organizationId]);

  if (error) return <section className="finance-panel"><p role="alert">服务端拒绝：{error}</p></section>;
  if (!data) return <p className="finance-loading">正在加载阶段四合成资金数据…</p>;
  if ("tasks" in data) return <OperationsCenter data={data} />;
  if ("settlementBatchId" in data) return <SettlementView data={data} />;
  if ("payoutBatchId" in data) return <PayoutView data={data} />;
  if ("financeCaseId" in data) return <RefundView data={data} />;
  if ("reconciliationRunId" in data) return <ReconciliationView data={data} />;
  if ("timezone" in data) return <BusinessDayView data={data} />;
  return <LedgerView data={data} />;
}

function OperationsCenter({ data }: Readonly<{ data: AdminFinanceOperationsCenter }>) {
  return (
    <>
      <Heading title="资金运营中心" detail="统一呈现资金任务；后台不复制余额事实，不允许编辑服务端金额。" />
      <section className="finance-metrics">
        <Metric label="非零差异阻断" value={data.metrics.nonzeroDifferenceBlockers} />
        <Metric label="待独立复核" value={data.metrics.awaitingIndependentReview} />
        <Metric label="未知结果" value={data.metrics.unknownResults} />
        <Metric label="资金案件" value={data.metrics.openFundCases} />
      </section>
      <section className="finance-panel">
        <header><h2>阻断优先队列</h2><p>所有任务已按服务端组织范围过滤。</p></header>
        <div className="finance-list">
          {data.tasks.map((task) => (
            <article key={task.taskId}>
              <span className={task.blocking ? "finance-mark blocked" : "finance-mark"}>{task.category.slice(0, 1)}</span>
              <div><b>{task.summary}</b><p>{task.operatorName} · {task.state}</p></div>
              <span className={task.blocking ? "finance-status blocked" : "finance-status"}>{task.blocking ? "阻断" : "可处理"}</span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function SettlementView({ data }: Readonly<{ data: AdminAllocationSettlement }>) {
  return (
    <>
      <Heading title="分配与运营主体清算" detail="固定 15% / 45% / 40% 分配只读，清算金额由服务端汇总。" />
      <section className="finance-formula">
        <Amount label="平台 15%" value={data.platformShareMinor} />
        <Amount label="运营主体 45%" value={data.operatorShareMinor} />
        <Amount label="车主 40%" value={data.driverShareMinor} />
      </section>
      <Facts title={data.settlementBatchId} values={[
        ["规则版本", data.allocationRuleVersion],
        ["应清算金额", money(data.grossSettlementMinor)],
        ["对账运行", data.reconciliationRunId],
        ["职责分离", "经办人与复核人必须不同"],
        ["金额编辑", data.amountEditable ? "允许" : "禁止"],
      ]} />
    </>
  );
}

function PayoutView({ data }: Readonly<{ data: AdminDriverPayout }>) {
  return (
    <>
      <Heading title="T+1 车主付款" detail="手续费由运营主体承担，不减少车主应付款；提前结算继续关闭。" />
      <Facts title={data.payoutBatchId} values={[
        ["车主", data.driverAccountMasked],
        ["收款账户", data.bankAccountMasked],
        ["车主应付款", money(data.grossPayableMinor)],
        ["运营主体手续费", money(data.payoutFeeMinor)],
        ["提前结算", data.earlySettlementEnabled ? "开启" : "关闭"],
        ["重复付款", data.duplicatePayoutAllowed ? "允许" : "禁止"],
      ]} />
    </>
  );
}

function RefundView({ data }: Readonly<{ data: AdminRefundReversal }>) {
  return (
    <>
      <Heading title="退款与完整冲正" detail="退款引用原支付，完整冲正引用原交易；支付机构结果为权威结果。" />
      <Facts title={data.financeCaseId} values={[
        ["原支付", data.originalPaymentId],
        ["原账本交易", data.originalLedgerTransactionId],
        ["金额", money(data.amountMinor)],
        ["支付机构结果", data.providerResult],
        ["原记录修改", data.originalRecordMutable ? "允许" : "禁止"],
        ["任意分录", data.arbitraryJournalEntryAllowed ? "允许" : "禁止"],
      ]} />
    </>
  );
}

function ReconciliationView({ data }: Readonly<{ data: AdminReconciliationFundCases }>) {
  return (
    <>
      <Heading title="对账差异与资金案件" detail="四方事实源逐笔与汇总核对，非零差异不得自动核销。" />
      <section className="finance-panel">
        <header><h2>{data.reconciliationRunId}</h2><p>{data.factSources.join(" · ")}</p></header>
        <div className="finance-list">
          {data.differences.map((item) => (
            <article key={item.reconciliationItemId}>
              <span className="finance-mark blocked">差</span>
              <div><b>{item.differenceType} · {money(item.differenceAmountMinor)}</b><p>{item.reconciliationItemId} · 证据引用 {item.evidenceReference ?? "待补充"}</p></div>
              <span className="finance-status blocked">{item.state}</span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function BusinessDayView({ data }: Readonly<{ data: AdminBusinessDayClose }>) {
  return (
    <>
      <Heading title="日终关账" detail="Asia/Shanghai 账务日仅在全部运行关闭、四方齐备且零差异时关账。" />
      <Facts title={data.businessDate} values={[
        ["全部对账运行关闭", yesNo(data.allRunsClosed)],
        ["四方事实源齐备", yesNo(data.fourSourcesPresent)],
        ["零差异", yesNo(data.zeroDifference)],
        ["阻断资金案件", String(data.blockingFundCases)],
        ["重开账务日", data.reopenAllowed ? "允许" : "禁止"],
      ]} />
    </>
  );
}

function LedgerView({ data }: Readonly<{ data: AdminLedgerTransaction }>) {
  return (
    <>
      <Heading title="账本查询" detail="按全局交易序列查询不可变交易、分录与只读余额投影。" />
      <Facts title={data.ledgerTransactionId} values={[
        ["全局交易序列", data.globalSequence],
        ["来源命名空间", data.sourceNamespace],
        ["借方合计", money(data.debitTotalMinor)],
        ["贷方合计", money(data.creditTotalMinor)],
        ["余额投影只读", yesNo(data.balanceProjectionReadOnly)],
        ["编辑分录", data.entryEditAllowed ? "允许" : "禁止"],
      ]} />
      <section className="finance-panel">
        <header><h2>复式分录</h2><p>借贷必须平衡。</p></header>
        <div className="finance-list">
          {data.entries.map((entry) => (
            <article key={entry.entryId}>
              <span className="finance-mark">{entry.side === "debit" ? "借" : "贷"}</span>
              <div><b>{entry.accountCode} · {money(entry.amountMinor)}</b><p>{entry.dimensionKey}</p></div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function Heading({ title, detail }: Readonly<{ title: string; detail: string }>) {
  return <div className="finance-heading"><div><span>阶段四 · 合成资金内核</span><h1>{title}</h1><p>{detail}</p></div><b>真实资金与生产启用关闭</b></div>;
}

function Metric({ label, value }: Readonly<{ label: string; value: number }>) {
  return <article><span>{label}</span><strong>{value}</strong><small>服务端权威摘要</small></article>;
}

function Amount({ label, value }: Readonly<{ label: string; value: string }>) {
  return <article><span>{label}</span><strong>{money(value)}</strong><small>金额不可编辑</small></article>;
}

function Facts({ title, values }: Readonly<{ title: string; values: readonly (readonly [string, string])[] }>) {
  return <section className="finance-panel"><header><h2>{title}</h2><p>服务端只读事实</p></header><div className="finance-facts">{values.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div></section>;
}

function money(value: string): string {
  return `¥${(Number(value) / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;
}

function yesNo(value: boolean): string {
  return value ? "是" : "否";
}
