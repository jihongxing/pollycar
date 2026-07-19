import { useEffect, useState } from "react";
import type { AdultEligibilityProviderTrace, AdminReviewAuditEntry, AdminReviewMaterialPreview, AdminReviewMaterialReason, AdminReviewTaskDetail, AdminReviewTaskSummary, AdminSafetyCaseDetail, AdminSafetyCaseSummary, RejectVehicleReviewAdminCommand } from "@pollycar/contracts";
import { EnvironmentIndicator } from "../components/environment-indicator";
import { useReviewTaskClient } from "../application/review-task-context";
import { useAdminSafetyClient } from "../application/safety-case-context";
import { SafetyCasePage } from "../features/safety-cases/safety-case-page";
import { AuditDrawer } from "../features/vehicle-review-queue/audit-drawer";
import { ConflictState } from "../features/vehicle-review-queue/conflict-state";
import { DecisionDialog } from "../features/vehicle-review-queue/decision-dialog";
import { QueuePage } from "../features/vehicle-review-queue/queue-page";
import { RequestMaterialDialog } from "../features/vehicle-review-queue/request-material-dialog";
import { TaskDetailPage } from "../features/vehicle-review-queue/task-detail-page";
import { useTheme } from "../theme/theme-provider";
import { AdultEligibilityTracePage } from "../features/adult-eligibility-traces/trace-page";
import { HttpAdminAdultEligibilityClient } from "../infrastructure/http-admin-adult-eligibility-client";
import { resolveAdminApiBaseUrl } from "../infrastructure/api-base-url";
import "./styles.css";

const reviewerId = "synthetic-reviewer-001";

export function LegacyShell() {
  const client = useReviewTaskClient();
  const safetyClient = useAdminSafetyClient();
  const { theme, toggle } = useTheme();
  const [entered, setEntered] = useState(false);
  const [tasks, setTasks] = useState<readonly AdminReviewTaskSummary[]>([]);
  const [selected, setSelected] = useState<AdminReviewTaskDetail>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [dialog, setDialog] = useState(false);
  const [audit, setAudit] = useState<readonly AdminReviewAuditEntry[]>();
  const [reason, setReason] = useState<AdminReviewMaterialReason>("insurance_expiry_incomplete");
  const [preview, setPreview] = useState<AdminReviewMaterialPreview>();
  const [busy, setBusy] = useState(false);
  const [unknownKey, setUnknownKey] = useState<string>();
  const [decisionMode, setDecisionMode] = useState<"approve" | "reject">();
  const [rejectionReason, setRejectionReason] = useState<RejectVehicleReviewAdminCommand["reasonCode"]>("vehicle_age_exceeded");
  const [workspace, setWorkspace] = useState<"vehicle" | "safety" | "identity">("vehicle");
  const [safetyCases, setSafetyCases] = useState<readonly AdminSafetyCaseSummary[]>([]);
  const [selectedSafetyCase, setSelectedSafetyCase] = useState<AdminSafetyCaseDetail>();
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyError, setSafetyError] = useState<string>();
  const [identityClient] = useState(() => new HttpAdminAdultEligibilityClient(resolveAdminApiBaseUrl()));
  const [identityTraces, setIdentityTraces] = useState<readonly AdultEligibilityProviderTrace[]>([]);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState<string>();

  async function load() {
    setLoading(true); setError(undefined);
    try { setTasks(await client.listTasks()); } catch (caught) { setError(caught instanceof Error ? caught.message : "UNKNOWN_ERROR"); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (entered) void load(); }, [entered]);

  async function loadSafetyCases() {
    setSafetyLoading(true); setSafetyError(undefined);
    try { setSafetyCases(await safetyClient.listCases()); }
    catch (caught) { setSafetyError(caught instanceof Error ? caught.message : "UNKNOWN_ERROR"); }
    finally { setSafetyLoading(false); }
  }

  async function loadIdentityTraces() {
    setIdentityLoading(true); setIdentityError(undefined);
    try { setIdentityTraces(await identityClient.list()); }
    catch (caught) { setIdentityError(caught instanceof Error ? caught.message : "UNKNOWN_ERROR"); }
    finally { setIdentityLoading(false); }
  }

  async function openSafetyCase(caseId: string) {
    try { setSelectedSafetyCase(await safetyClient.getCase(caseId)); }
    catch (caught) { setSafetyError(caught instanceof Error ? caught.message : "UNKNOWN_ERROR"); }
  }

  async function resolveSafetyCase(outcome: "restore_access" | "uphold_freeze") {
    if (!selectedSafetyCase) return;
    setBusy(true);
    try {
      setSelectedSafetyCase(await safetyClient.resolveCase(selectedSafetyCase.caseId, selectedSafetyCase.version, outcome));
      await loadSafetyCases();
    } catch (caught) {
      setSafetyError(caught instanceof Error ? caught.message : "UNKNOWN_RESULT");
    } finally { setBusy(false); }
  }

  async function claim(task: AdminReviewTaskSummary) {
    const idempotencyKey = createCommandKey(`claim-${task.taskId}`);
    try {
      const claimed = await client.claimTask({ reviewerId, taskId: task.taskId, expectedTaskVersion: task.taskVersion, idempotencyKey });
      setSelected(await client.getTask(claimed.taskId));
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "UNKNOWN_ERROR";
      setError(code);
      if (code === "UNKNOWN_RESULT") setUnknownKey(idempotencyKey);
    }
  }

  async function submitMaterial() {
    if (!selected || !preview) return;
    const idempotencyKey = createCommandKey(`material-${selected.taskId}`);
    setBusy(true);
    try {
      const result = await client.requestMaterial({ reviewerId, taskId: selected.taskId, reason, previewConfirmed: true, expectedTaskVersion: selected.taskVersion, expectedVehicleReviewVersion: selected.vehicleReviewVersion, idempotencyKey });
      setSelected(result); setDialog(false); setPreview(undefined); await load();
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "UNKNOWN_RESULT";
      setError(code);
      if (code === "UNKNOWN_RESULT") setUnknownKey(idempotencyKey);
    } finally { setBusy(false); }
  }

  async function submitDecision() {
    if (!selected || !decisionMode) return;
    const idempotencyKey = createCommandKey(`${decisionMode}-${selected.taskId}`);
    setBusy(true);
    try {
      const common = { reviewerId, taskId: selected.taskId, expectedTaskVersion: selected.taskVersion, expectedVehicleReviewVersion: selected.vehicleReviewVersion, idempotencyKey };
      const result = decisionMode === "approve"
        ? await client.approveVehicle({ ...common, reasonCode: "approved_standard", previewConfirmed: true })
        : await client.rejectVehicle({ ...common, reasonCode: rejectionReason, previewConfirmed: true });
      setSelected(result); setDecisionMode(undefined); await load();
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "UNKNOWN_RESULT";
      setError(code);
      if (code === "UNKNOWN_RESULT") setUnknownKey(idempotencyKey);
    } finally { setBusy(false); }
  }

  if (!entered) return <div className="entry"><EnvironmentIndicator /><div className="entry-card"><span className="mark">REGO</span><span className="eyebrow">REGO Operations</span><h1>内部审核工作台</h1><p>此入口仅供内部沙箱验证。所有任务、账户和车辆材料均为合成数据，不能用于真实运营决定。</p><ul><li>真实身份与 SSO 未接入</li><li>批准与拒绝只改变合成记录</li><li>生产数据库和真实材料保持关闭</li></ul><button className="primary wide" onClick={() => setEntered(true)}>进入合成审核队列</button></div></div>;

  if (error?.startsWith("ADMIN_") || error === "UNKNOWN_RESULT") return <div className="app-frame"><Header theme={theme} toggle={toggle} /><ConflictState code={error} onBack={() => { setError(undefined); setSelected(undefined); void load(); }} onRecover={unknownKey ? async () => { const recovered = await client.recoverResult(unknownKey); if (recovered) { setSelected(recovered); setError(undefined); setUnknownKey(undefined); } } : undefined} /></div>;

  return <div className="app-frame"><Header theme={theme} toggle={toggle} />
    <nav className="workspace-tabs" aria-label="运营工作区">
      <button className={workspace === "vehicle" ? "active" : ""} onClick={() => setWorkspace("vehicle")}>车辆审核</button>
      <button className={workspace === "safety" ? "active" : ""} onClick={() => { setWorkspace("safety"); setSelectedSafetyCase(undefined); void loadSafetyCases(); }}>安全案件</button>
      <button className={workspace === "identity" ? "active" : ""} onClick={() => { setWorkspace("identity"); void loadIdentityTraces(); }}>身份验证记录</button>
    </nav>
    {workspace === "identity" ? (
      <AdultEligibilityTracePage traces={identityTraces} loading={identityLoading} {...(identityError ? { error: identityError } : {})} onRefresh={() => void loadIdentityTraces()} />
    ) : workspace === "safety" ? (
      <SafetyCasePage
        cases={safetyCases}
        loading={safetyLoading}
        busy={busy}
        {...(selectedSafetyCase ? { selected: selectedSafetyCase } : {})}
        {...(safetyError ? { error: safetyError } : {})}
        onRefresh={() => void loadSafetyCases()}
        onSelect={(caseId) => void openSafetyCase(caseId)}
        onBack={() => { setSelectedSafetyCase(undefined); void loadSafetyCases(); }}
        onResolve={(outcome) => void resolveSafetyCase(outcome)}
      />
    ) : selected ? <TaskDetailPage task={selected} onBack={() => { setSelected(undefined); void load(); }} onRequestMaterial={() => setDialog(true)} onApprove={() => setDecisionMode("approve")} onReject={() => setDecisionMode("reject")} onAudit={async () => setAudit(await client.listAudit(selected.taskId))} /> : <QueuePage tasks={tasks} loading={loading} error={error} onRefresh={() => void load()} onClaim={(task) => void claim(task)} />}
    {dialog && selected ? <RequestMaterialDialog reason={reason} preview={preview} busy={busy} onReason={(next) => { setReason(next); setPreview(undefined); }} onPreview={async () => {
      try {
        setPreview(await client.previewMaterial(selected.taskId, reason));
      } catch (caught) {
        setDialog(false);
        setError(caught instanceof Error ? caught.message : "SERVICE_UNAVAILABLE");
      }
    }} onSubmit={() => void submitMaterial()} onClose={() => { setDialog(false); setPreview(undefined); }} /> : null}
    {decisionMode && selected ? <DecisionDialog mode={decisionMode} reason={rejectionReason} busy={busy} onReason={setRejectionReason} onSubmit={() => void submitDecision()} onClose={() => setDecisionMode(undefined)} /> : null}
    {audit ? <AuditDrawer entries={audit} onClose={() => setAudit(undefined)} /> : null}
  </div>;
}

function Header({ theme, toggle }: Readonly<{ theme: "light" | "dark"; toggle(): void }>) {
  return <><EnvironmentIndicator /><header className="topbar"><div><strong>REGO</strong><span>御驾出行审核工作台</span></div><nav aria-label="工作台操作"><span className="reviewer">合成审核员 001</span><button className="theme-button" onClick={toggle} aria-label={`切换为${theme === "light" ? "深色" : "浅色"}主题`}>{theme === "light" ? "☾" : "☀"}</button></nav></header></>;
}

function createCommandKey(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}
