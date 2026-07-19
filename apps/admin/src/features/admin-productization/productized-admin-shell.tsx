import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  AdminAuditAction,
  AdminAuditDetail,
  AdminAuditDirectoryPage,
  AdminAuditDirectoryQuery,
  AdminCaseAction,
  AdminCaseDetail,
  AdminCaseDirectoryPage,
  AdminCaseDirectoryQuery,
  AdminCursorPageInfo,
  AdminDataReportAction,
  AdminDataReportDetail,
  AdminDataReportDirectoryPage,
  AdminDataReportDirectoryQuery,
  AdminDriverDetail,
  AdminDriverDirectoryPage,
  AdminDriverDirectoryQuery,
  AdminExecutiveAction,
  AdminExecutiveDetail,
  AdminExecutiveDirectoryPage,
  AdminExecutiveDirectoryQuery,
  AdminFinanceAction,
  AdminFinanceDetail,
  AdminFinanceDirectoryPage,
  AdminFinanceDirectoryQuery,
  AdminInvitationSummary,
  AdminMembershipAction,
  AdminMembershipDetail,
  AdminMembershipDirectoryPage,
  AdminMembershipDirectoryQuery,
  AdminMfaVerification,
  AdminNavigationDomain,
  AdminNavigationManifest,
  AdminOperatorDetail,
  AdminOperatorDirectoryPage,
  AdminOperatorDirectoryQuery,
  AdminOperationsTaskDetail,
  AdminOperationsTaskPage,
  AdminOperationsTaskQuery,
  AdminProductizationClient,
  AdminProductSession,
  AdminTripDetail,
  AdminTripDirectoryPage,
  AdminTripDirectoryQuery,
  AdminTripOperationAction,
  AdminVehicleDetail,
  AdminVehicleDirectoryPage,
  AdminVehicleDirectoryQuery,
  AdminVehicleReviewAction,
} from "@pollycar/contracts";
import { resolveAdminApiBaseUrl } from "../../infrastructure/api-base-url";
import { HttpAdminProductizationClient } from "../../infrastructure/http-admin-productization-client";
import { useTheme } from "../../theme/theme-provider";
import { GlobalSearch } from "../../components/global-search";
import "./productized-admin-shell.css";

const refreshStorageKey = "pollycar.admin.refresh-token";
const listStateStoragePrefix = "pollycar.admin.list-state";
const refreshRequests = new Map<string, Promise<AdminProductSession>>();

export function ProductizedAdminShell({
  client: injectedClient,
}: Readonly<{ client?: AdminProductizationClient }>) {
  const client = useMemo(
    () => injectedClient ?? new HttpAdminProductizationClient(resolveAdminApiBaseUrl()),
    [injectedClient],
  );
  const [session, setSession] = useState<AdminProductSession>();
  const [verification, setVerification] = useState<AdminMfaVerification>();
  const [challengeId, setChallengeId] = useState<string>();
  const [page, setPage] = useState<AdminNavigationDomain>("workbench");
  const [taskId, setTaskId] = useState<string>();
  const [operatorId, setOperatorId] = useState<string>();
  const [tripId, setTripId] = useState<string>();
  const [caseRoute, setCaseRoute] = useState<AdminRoute["case"]>();
  const [financeRoute, setFinanceRoute] = useState<AdminRoute["finance"]>();
  const [executiveRoute, setExecutiveRoute] =
    useState<AdminRoute["executive"]>();
  const [auditRoute, setAuditRoute] = useState<AdminRoute["audit"]>();
  const [reportId, setReportId] = useState<string>();
  const [membershipId, setMembershipId] = useState<string>();
  const [fleetRoute, setFleetRoute] = useState<AdminRoute["fleet"]>();
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState<string>();
  const [invitationToken, setInvitationToken] = useState(
    () => new URLSearchParams(window.location.search).get("invite") ?? undefined,
  );
  const [invitation, setInvitation] = useState<AdminInvitationSummary>();
  const [recoveryCodes, setRecoveryCodes] = useState<readonly string[]>();

  useEffect(() => {
    if (!invitationToken) return;
    client
      .getInvitation(invitationToken)
      .then(setInvitation)
      .catch((reason) => setError(messageFor(reason)));
  }, [client, invitationToken]);

  useEffect(() => {
    const refreshToken = sessionStorage.getItem(refreshStorageKey);
    if (!refreshToken) {
      setRestoring(false);
      return;
    }
    restoreSession(client, refreshToken)
      .then((next) => {
        persistSession(next);
        setSession(next);
        applyInitialRoute(next);
      })
      .catch(() => sessionStorage.removeItem(refreshStorageKey))
      .finally(() => setRestoring(false));
  }, [client]);

  async function login(workEmail: string, password: string) {
    setError(undefined);
    try {
      const challenge = await client.startLogin(workEmail, password);
      setChallengeId(challenge.challengeId);
    } catch (reason) {
      setError(messageFor(reason));
    }
  }

  async function verify(totpCode: string) {
    if (!challengeId) return;
    setError(undefined);
    try {
      const next = await client.verifyMfa(challengeId, totpCode);
      setVerification(next);
    } catch (reason) {
      setError(messageFor(reason));
    }
  }

  async function selectIdentity(workIdentityId: string) {
    if (!verification) return;
    setError(undefined);
    try {
      const next = await client.selectWorkIdentity(
        verification.selectionToken,
        workIdentityId,
      );
      persistSession(next);
      setSession(next);
      applyInitialRoute(next);
    } catch (reason) {
      setError(messageFor(reason));
    }
  }

  async function logout() {
    if (session) await client.logout(session.accessToken).catch(() => undefined);
    sessionStorage.removeItem(refreshStorageKey);
    setSession(undefined);
    setVerification(undefined);
    setChallengeId(undefined);
    setTaskId(undefined);
    setOperatorId(undefined);
    setTripId(undefined);
    setCaseRoute(undefined);
    setFinanceRoute(undefined);
    setExecutiveRoute(undefined);
    setAuditRoute(undefined);
    setReportId(undefined);
    setMembershipId(undefined);
    setFleetRoute(undefined);
    window.history.replaceState({}, "", "/");
  }

  function applyInitialRoute(next: AdminProductSession) {
    const resolved = resolveRoute(window.location.pathname, next.navigation);
    const route = resolved ?? {
      domain: firstAvailableDomain(next.navigation),
    };
    setPage(route.domain);
    setTaskId(route.taskId);
    setOperatorId(route.operatorId);
    setTripId(route.tripId);
    setCaseRoute(route.case);
    setFinanceRoute(route.finance);
    setExecutiveRoute(route.executive);
    setAuditRoute(route.audit);
    setReportId(route.reportId);
    setMembershipId(route.membershipId);
    setFleetRoute(route.fleet);
    window.history.replaceState(
      {},
      "",
      pathForRoute(route, next.navigation),
    );
  }

  function navigate(
    domain: AdminNavigationDomain,
    resourceId?: string,
    fleet?: AdminRoute["fleet"],
    caseRoute?: AdminRoute["case"],
    financeRoute?: AdminRoute["finance"],
    executiveRoute?: AdminRoute["executive"],
    auditRoute?: AdminRoute["audit"],
  ) {
    if (!session) return;
    const navigationItem = session.navigation.items.find((item) => item.id === domain);
    if (
      !navigationItem ||
      navigationItem.availability !== "available" ||
      !session.navigation.routePermissions.includes(`${domain}:read`)
    ) {
      return;
    }
    setPage(domain);
    setTaskId(domain === "workbench" ? resourceId : undefined);
    setOperatorId(domain === "operator_management" ? resourceId : undefined);
    setTripId(domain === "trip_operations" ? resourceId : undefined);
    setCaseRoute(domain === "support_safety" ? caseRoute : undefined);
    setFinanceRoute(
      domain === "finance_operations" ? financeRoute : undefined,
    );
    setExecutiveRoute(
      domain === "executive_dashboard" ? executiveRoute : undefined,
    );
    setAuditRoute(domain === "audit_system" ? auditRoute : undefined);
    setReportId(domain === "data_reports" ? resourceId : undefined);
    setMembershipId(
      domain === "organization_accounts" ? resourceId : undefined,
    );
    setFleetRoute(
      domain === "driver_vehicle"
        ? fleet ?? { view: "drivers" }
        : undefined,
    );
    window.history.pushState(
      {},
      "",
      pathForRoute(
        {
          domain,
          ...(domain === "workbench" && resourceId
            ? { taskId: resourceId }
            : {}),
          ...(domain === "operator_management" && resourceId
            ? { operatorId: resourceId }
            : {}),
          ...(domain === "trip_operations" && resourceId
            ? { tripId: resourceId }
            : {}),
          ...(domain === "support_safety" && caseRoute
            ? { case: caseRoute }
            : {}),
          ...(domain === "finance_operations" && financeRoute
            ? { finance: financeRoute }
            : {}),
          ...(domain === "executive_dashboard" && executiveRoute
            ? { executive: executiveRoute }
            : {}),
          ...(domain === "audit_system" && auditRoute
            ? { audit: auditRoute }
            : {}),
          ...(domain === "data_reports" && resourceId
            ? { reportId: resourceId }
            : {}),
          ...(domain === "organization_accounts" && resourceId
            ? { membershipId: resourceId }
            : {}),
          ...(domain === "driver_vehicle"
            ? { fleet: fleet ?? { view: "drivers" as const } }
            : {}),
        },
        session.navigation,
      ),
    );
  }

  useEffect(() => {
    if (!session) return undefined;
    const handlePopState = () => {
      const route = resolveRoute(window.location.pathname, session.navigation);
      if (!route) {
        const domain = firstAvailableDomain(session.navigation);
        setPage(domain);
        setTaskId(undefined);
        setOperatorId(undefined);
        setTripId(undefined);
        setCaseRoute(undefined);
        setFinanceRoute(undefined);
        setExecutiveRoute(undefined);
        setAuditRoute(undefined);
        setReportId(undefined);
        setMembershipId(undefined);
        setFleetRoute(undefined);
        window.history.replaceState(
          {},
          "",
          pathForRoute({ domain }, session.navigation),
        );
        return;
      }
      setPage(route.domain);
      setTaskId(route.taskId);
      setOperatorId(route.operatorId);
      setTripId(route.tripId);
      setCaseRoute(route.case);
      setFinanceRoute(route.finance);
      setExecutiveRoute(route.executive);
      setAuditRoute(route.audit);
      setReportId(route.reportId);
      setMembershipId(route.membershipId);
      setFleetRoute(route.fleet);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [session]);

  async function activate(password: string, totpCode: string) {
    if (!invitationToken) return;
    setError(undefined);
    try {
      const result = await client.activateInvitation(
        invitationToken,
        password,
        totpCode,
      );
      setRecoveryCodes(result.recoveryCodes);
      setInvitation(undefined);
      setInvitationToken(undefined);
      window.history.replaceState({}, "", window.location.pathname);
    } catch (reason) {
      setError(messageFor(reason));
    }
  }

  if (restoring) return <EntryFrame><p className="entry-status">正在恢复登录状态…</p></EntryFrame>;
  if (!session) {
    if (recoveryCodes) {
      return (
        <RecoveryCodesEntry
          codes={recoveryCodes}
          onContinue={() => setRecoveryCodes(undefined)}
        />
      );
    }
    if (invitationToken) {
      return (
        <ActivationEntry
          {...(invitation ? { invitation } : {})}
          {...(error ? { error } : {})}
          onSubmit={activate}
        />
      );
    }
    if (verification) {
      return (
        <IdentityEntry
          verification={verification}
          {...(error ? { error } : {})}
          onSelect={selectIdentity}
          onBack={() => {
            setVerification(undefined);
            setChallengeId(undefined);
          }}
        />
      );
    }
    if (challengeId) {
      return (
        <MfaEntry
          {...(error ? { error } : {})}
          onSubmit={verify}
          onBack={() => setChallengeId(undefined)}
        />
      );
    }
    return <LoginEntry {...(error ? { error } : {})} onSubmit={login} />;
  }

  return (
    <AuthenticatedShell
      session={session}
      client={client}
      page={page}
      {...(taskId ? { taskId } : {})}
      {...(operatorId ? { operatorId } : {})}
      {...(tripId ? { tripId } : {})}
      {...(caseRoute ? { caseRoute } : {})}
      {...(financeRoute ? { financeRoute } : {})}
      {...(executiveRoute ? { executiveRoute } : {})}
      {...(auditRoute ? { auditRoute } : {})}
      {...(reportId ? { reportId } : {})}
      {...(membershipId ? { membershipId } : {})}
      {...(fleetRoute ? { fleetRoute } : {})}
      onNavigate={navigate}
      onLogout={logout}
    />
  );
}

function ActivationEntry({
  invitation,
  error,
  onSubmit,
}: Readonly<{
  invitation?: AdminInvitationSummary;
  error?: string;
  onSubmit(password: string, totpCode: string): Promise<void>;
}>) {
  const [password, setPassword] = useState("Rego-Internal-2026!");
  const [totpCode, setTotpCode] = useState("826419");
  return (
    <EntryFrame>
      <form className="entry-card" onSubmit={(event) => { event.preventDefault(); void onSubmit(password, totpCode); }}>
        <span className="eyebrow">账号激活</span>
        <h1>设置后台登录方式</h1>
        <p>{invitation ? `${invitation.organizationName} · ${invitation.productRoleName}` : "正在核对邀请…"}</p>
        <label>设置密码<input aria-label="设置密码" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label>动态验证码<input aria-label="激活动态验证码" inputMode="numeric" maxLength={6} value={totpCode} onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, ""))} /></label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="primary-action" disabled={!invitation}>完成激活</button>
      </form>
    </EntryFrame>
  );
}

function RecoveryCodesEntry({
  codes,
  onContinue,
}: Readonly<{ codes: readonly string[]; onContinue(): void }>) {
  return (
    <EntryFrame>
      <section className="entry-card">
        <span className="eyebrow">账号已激活</span>
        <h1>保存恢复码</h1>
        <p>每个恢复码只能使用一次，请保存在安全位置。</p>
        <div>{codes.map((code) => <code key={code}>{code}</code>)}</div>
        <button className="primary-action" onClick={onContinue}>前往登录</button>
      </section>
    </EntryFrame>
  );
}

function LoginEntry({
  error,
  onSubmit,
}: Readonly<{
  error?: string;
  onSubmit(email: string, password: string): Promise<void>;
}>) {
  const [email, setEmail] = useState("lin.yun@rego.example");
  const [password, setPassword] = useState("Rego-Internal-2026!");
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    await onSubmit(email, password);
    setSubmitting(false);
  }
  return (
    <EntryFrame>
      <form className="entry-card" onSubmit={submit}>
        <div className="brand-mark">P</div>
        <span className="eyebrow">运营管理后台</span>
        <h1>登录工作账号</h1>
        <p>使用受邀的工作邮箱进入。当前为内部演示环境。</p>
        <label>工作邮箱<input aria-label="工作邮箱" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" /></label>
        <label>密码<input aria-label="密码" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="primary-action" disabled={submitting}>{submitting ? "正在验证…" : "继续"}</button>
        <p className="entry-help">后台账号由组织管理员邀请开通，不提供公开注册。</p>
      </form>
    </EntryFrame>
  );
}

function MfaEntry({
  error,
  onSubmit,
  onBack,
}: Readonly<{
  error?: string;
  onSubmit(code: string): Promise<void>;
  onBack(): void;
}>) {
  const [code, setCode] = useState("826419");
  return (
    <EntryFrame>
      <form className="entry-card" onSubmit={(event) => { event.preventDefault(); void onSubmit(code); }}>
        <span className="eyebrow">第二步</span>
        <h1>输入动态验证码</h1>
        <p>请输入身份验证器中显示的 6 位验证码。</p>
        <label>动态验证码<input aria-label="动态验证码" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="primary-action">验证并继续</button>
        <button className="text-action" type="button" onClick={onBack}>返回登录</button>
      </form>
    </EntryFrame>
  );
}

function IdentityEntry({
  verification,
  error,
  onSelect,
  onBack,
}: Readonly<{
  verification: AdminMfaVerification;
  error?: string;
  onSelect(id: string): Promise<void>;
  onBack(): void;
}>) {
  return (
    <EntryFrame>
      <section className="entry-card identity-card">
        <span className="eyebrow">选择工作身份</span>
        <h1>本次要为哪个组织工作？</h1>
        <p>每次登录只使用一个组织身份，权限和数据范围不会合并。</p>
        <div className="identity-list">
          {verification.workIdentities.map((identity) => (
            <button key={identity.workIdentityId} className="identity-option" onClick={() => void onSelect(identity.workIdentityId)}>
              <strong>{identity.organizationName}</strong>
              <span>{identity.productRoleName}</span>
              <small>{identity.type === "platform" ? "平台工作身份" : "运营公司工作身份"}</small>
            </button>
          ))}
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="text-action" onClick={onBack}>返回登录</button>
      </section>
    </EntryFrame>
  );
}

function AuthenticatedShell({
  session,
  client,
  page,
  taskId,
  operatorId,
  tripId,
  caseRoute,
  financeRoute,
  executiveRoute,
  auditRoute,
  reportId,
  membershipId,
  fleetRoute,
  onNavigate,
  onLogout,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  page: AdminNavigationDomain;
  taskId?: string;
  operatorId?: string;
  tripId?: string;
  caseRoute?: AdminRoute["case"];
  financeRoute?: AdminRoute["finance"];
  executiveRoute?: AdminRoute["executive"];
  auditRoute?: AdminRoute["audit"];
  reportId?: string;
  membershipId?: string;
  fleetRoute?: AdminRoute["fleet"];
  onNavigate(
    page: AdminNavigationDomain,
    resourceId?: string,
    fleet?: AdminRoute["fleet"],
    caseRoute?: AdminRoute["case"],
    financeRoute?: AdminRoute["finance"],
    executiveRoute?: AdminRoute["executive"],
    auditRoute?: AdminRoute["audit"],
  ): void;
  onLogout(): Promise<void>;
}>) {
  const { theme, toggle } = useTheme();
  const item = session.navigation.items.find((candidate) => candidate.id === page);
  if (!item || !session.navigation.routePermissions.includes(`${page}:read`)) {
    return (
      <main className="unauthorized-page">
        <h1>当前账号无权访问此页面</h1>
        <button onClick={() => onNavigate(session.navigation.items[0]?.id ?? "workbench")}>返回工作台</button>
      </main>
    );
  }
  return (
    <div className="product-shell">
      <aside className="product-sidebar">
        <div className="sidebar-brand"><span>P</span><strong>PollyCar</strong></div>
        <div className="environment-chip">内部演示环境</div>
        <nav aria-label="主菜单">
          {session.navigation.items
            .filter((navigationItem) =>
              session.navigation.routePermissions.includes(`${navigationItem.id}:read`),
            )
            .map((navigationItem) => (
            <button
              key={navigationItem.id}
              className={page === navigationItem.id ? "active" : ""}
              disabled={navigationItem.availability !== "available"}
              aria-label={navigationItem.availability === "available"
                ? navigationItem.label
                : `${navigationItem.label}，功能暂未开放`}
              onClick={() => onNavigate(navigationItem.id)}
            >
              <span className="nav-icon">{iconFor(navigationItem.id)}</span>
              {navigationItem.label}
              {navigationItem.availability !== "available"
                ? <small>功能暂未开放</small>
                : null}
            </button>
            ))}
        </nav>
        <div className="sidebar-account">
          <strong>{session.workIdentity.organizationName}</strong>
          <span>{session.workIdentity.productRoleName}</span>
          <button onClick={() => void onLogout()}>退出登录</button>
        </div>
      </aside>
      <div className="product-main">
        <header className="product-topbar">
          <div>
            <span>{session.workIdentity.type === "platform" ? "平台工作身份" : "运营公司工作身份"}</span>
            <strong>{session.workIdentity.organizationName}</strong>
          </div>
          <div className="product-topbar-actions">
            <GlobalSearch
              items={session.navigation.items}
              onNavigate={(nextPage) => onNavigate(nextPage)}
            />
            <button onClick={toggle}>{theme === "light" ? "切换深色外观" : "切换浅色外观"}</button>
          </div>
        </header>
        <main className="product-content">
          {page === "workbench" && taskId ? (
            <OperationsTaskDetail
              session={session}
              client={client}
              taskId={taskId}
              onBack={() => onNavigate("workbench")}
            />
          ) : page === "workbench" ? (
            <Workbench
              session={session}
              client={client}
              onOpenTask={(nextTaskId) => onNavigate("workbench", nextTaskId)}
            />
          ) : page === "operator_management" && operatorId ? (
            <OperatorDetail
              session={session}
              client={client}
              operatorId={operatorId}
              onBack={() => onNavigate("operator_management")}
            />
          ) : page === "operator_management" ? (
            <OperatorDirectory
              session={session}
              client={client}
              onOpenOperator={(nextOperatorId) =>
                onNavigate("operator_management", nextOperatorId)}
            />
          ) : page === "driver_vehicle" ? (
            <FleetWorkspace
              session={session}
              client={client}
              route={fleetRoute ?? { view: "drivers" }}
              onNavigate={(fleet) =>
                onNavigate("driver_vehicle", fleet.resourceId, fleet)}
            />
          ) : page === "trip_operations" && tripId ? (
            <TripDetail
              session={session}
              client={client}
              tripId={tripId}
              onBack={() => onNavigate("trip_operations")}
            />
          ) : page === "trip_operations" ? (
            <TripDirectory
              session={session}
              client={client}
              onOpenTrip={(nextTripId) =>
                onNavigate("trip_operations", nextTripId)}
            />
          ) : page === "support_safety" && caseRoute ? (
            <CaseDetail
              session={session}
              client={client}
              caseRoute={caseRoute}
              onBack={() => onNavigate("support_safety")}
            />
          ) : page === "support_safety" ? (
            <CaseDirectory
              session={session}
              client={client}
              onOpenCase={(nextCase) =>
                onNavigate(
                  "support_safety",
                  nextCase.caseId,
                  undefined,
                  nextCase,
                )}
            />
          ) : page === "finance_operations" && financeRoute ? (
            <FinanceDetail
              session={session}
              client={client}
              financeRoute={financeRoute}
              onBack={() => onNavigate("finance_operations")}
            />
          ) : page === "finance_operations" ? (
            <FinanceDirectory
              session={session}
              client={client}
              onOpenFinance={(nextFinance) =>
                onNavigate(
                  "finance_operations",
                  nextFinance.resourceId,
                  undefined,
                  undefined,
                  nextFinance,
                )}
            />
          ) : page === "organization_accounts" && membershipId ? (
            <MembershipDetail
              session={session}
              client={client}
              membershipId={membershipId}
              onBack={() => onNavigate("organization_accounts")}
            />
          ) : page === "organization_accounts" ? (
            <MembershipDirectory
              session={session}
              client={client}
              onOpenMembership={(nextMembershipId) =>
                onNavigate("organization_accounts", nextMembershipId)}
            />
          ) : page === "data_reports" && reportId ? (
            <DataReportDetail
              session={session}
              client={client}
              reportId={reportId}
              onBack={() => onNavigate("data_reports")}
            />
          ) : page === "data_reports" ? (
            <DataReportDirectory
              session={session}
              client={client}
              onOpenReport={(nextReportId) =>
                onNavigate("data_reports", nextReportId)}
            />
          ) : page === "executive_dashboard" && executiveRoute ? (
            <ExecutiveDetail
              session={session}
              client={client}
              executiveRoute={executiveRoute}
              onBack={() => onNavigate("executive_dashboard")}
            />
          ) : page === "executive_dashboard" ? (
            <ExecutiveDirectory
              session={session}
              client={client}
              onOpenExecutive={(nextExecutive) =>
                onNavigate(
                  "executive_dashboard",
                  nextExecutive.resourceId,
                  undefined,
                  undefined,
                  undefined,
                  nextExecutive,
                )}
            />
          ) : page === "audit_system" && auditRoute ? (
            <AuditDetail
              session={session}
              client={client}
              auditRoute={auditRoute}
              onBack={() => onNavigate("audit_system")}
              onOpenInvestigation={(resourceId) =>
                onNavigate(
                  "audit_system",
                  resourceId,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  { kind: "investigation", resourceId },
                )}
            />
          ) : page === "audit_system" ? (
            <AuditDirectory
              session={session}
              client={client}
              onOpenAudit={(nextAudit) =>
                onNavigate(
                  "audit_system",
                  nextAudit.resourceId,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  nextAudit,
                )}
            />
          ) : (
            <FeatureUnavailablePage title={item.label} roleName={session.workIdentity.productRoleName} />
          )}
        </main>
      </div>
    </div>
  );
}

function Workbench({
  session,
  client,
  onOpenTask,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  onOpenTask(taskId: string): void;
}>) {
  const storageKey = `${listStateStoragePrefix}.${session.workIdentity.workIdentityId}.workbench`;
  const restoredState = useMemo(() => readListState(storageKey), [storageKey]);
  const [query, setQuery] = useState<AdminOperationsTaskQuery>(
    restoredState?.query ?? { pageSize: 25, sort: "due_at_asc" },
  );
  const [taskPage, setTaskPage] = useState<AdminOperationsTaskPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    writeListState(storageKey, query, window.scrollY);
    client
      .listOperationsTasks(session.accessToken, query)
      .then((value) => {
        if (!active) return;
        setTaskPage(value);
        window.requestAnimationFrame(() => {
          const saved = readListState(storageKey);
          if (saved && saved.scrollY > 0) window.scrollTo(0, saved.scrollY);
        });
      })
      .catch((reason) => active && setError(messageFor(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [client, query, session.accessToken, storageKey]);

  function updateQuery(next: AdminOperationsTaskQuery) {
    const normalized = clearCursor(next);
    setQuery(normalized);
    writeListState(storageKey, normalized, 0);
  }

  function openTask(nextTaskId: string) {
    writeListState(storageKey, query, window.scrollY);
    onOpenTask(nextTaskId);
  }

  return (
    <>
      <section className="page-heading">
        <div><span className="eyebrow">今日工作</span><h1>{session.workIdentity.productRoleName}工作台</h1><p>仅展示当前工作身份获准查看的任务和数据。</p></div>
        <div className="summary-card"><strong>{taskPage?.pageInfo.approximateTotal ?? "—"}</strong><span>当前范围任务</span></div>
      </section>
      <section className="task-panel">
        <div className="list-toolbar">
          <label>搜索任务<input aria-label="搜索任务" placeholder="任务、运营公司或负责人" value={query.search ?? ""} onChange={(event) => updateQuery(queryWithSearch(query, event.target.value))} /></label>
          <label>状态<select aria-label="任务状态" value={query.status ?? ""} onChange={(event) => updateQuery(queryWithStatus(query, event.target.value))}><option value="">全部</option><option value="unassigned">待分派</option><option value="processing">处理中</option><option value="waiting_review">待复核</option><option value="blocked">受阻</option><option value="completed">已完成</option></select></label>
          <label>排序<select aria-label="任务排序" value={query.sort ?? "due_at_asc"} onChange={(event) => updateQuery({ ...query, sort: event.target.value as NonNullable<AdminOperationsTaskQuery["sort"]> })}><option value="due_at_asc">截止时间优先</option><option value="updated_at_desc">最近更新优先</option></select></label>
          <label>每页显示<select aria-label="每页显示" value={query.pageSize} onChange={(event) => updateQuery({ ...query, pageSize: Number(event.target.value) as 25 | 50 | 100 })}><option>25</option><option>50</option><option>100</option></select></label>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {loading ? <p className="list-state">正在加载任务…</p> : taskPage?.items.length === 0 ? (
          <div className="list-state"><strong>没有符合条件的任务</strong><p>请调整搜索或筛选条件后重试。</p></div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>任务</th><th>运营公司</th><th>负责人</th><th>截止时间</th><th>状态</th></tr></thead>
              <tbody>{taskPage?.items.map((task) => <tr key={task.taskId}><td><button className="task-link" onClick={() => openTask(task.taskId)}><strong>{task.title}</strong><small>{task.taskId}</small></button></td><td>{task.operatorName}</td><td>{task.assigneeName}</td><td>{formatDate(task.dueAt)}</td><td><span className={`status status-${task.status}`}>{statusLabel(task.status)}</span></td></tr>)}</tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <button disabled={!taskPage?.pageInfo.hasPreviousPage} onClick={() => setQuery(cursorQuery(query, "before", taskPage?.pageInfo.startCursor))}>上一页</button>
          <span>每页 {query.pageSize ?? 25} 条</span>
          <button disabled={!taskPage?.pageInfo.hasNextPage} onClick={() => setQuery(cursorQuery(query, "after", taskPage?.pageInfo.endCursor))}>下一页</button>
        </div>
      </section>
    </>
  );
}

function OperatorDirectory({
  session,
  client,
  onOpenOperator,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  onOpenOperator(operatorId: string): void;
}>) {
  const storageKey =
    `${listStateStoragePrefix}.${session.workIdentity.workIdentityId}.operators`;
  const restoredState = useMemo(
    () => readOperatorListState(storageKey),
    [storageKey],
  );
  const [query, setQuery] = useState<AdminOperatorDirectoryQuery>(
    restoredState?.query ?? { pageSize: 25, sort: "operator_name_asc" },
  );
  const [operatorPage, setOperatorPage] =
    useState<AdminOperatorDirectoryPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    writeOperatorListState(storageKey, query, window.scrollY);
    client
      .listOperators(session.accessToken, query)
      .then((value) => {
        if (!active) return;
        setOperatorPage(value);
        window.requestAnimationFrame(() => {
          const saved = readOperatorListState(storageKey);
          if (saved && saved.scrollY > 0) {
            window.scrollTo(0, saved.scrollY);
          }
        });
      })
      .catch((reason) => active && setError(messageFor(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [client, query, session.accessToken, storageKey]);

  function updateQuery(next: AdminOperatorDirectoryQuery) {
    const normalized = clearOperatorCursor(next);
    setQuery(normalized);
    writeOperatorListState(storageKey, normalized, 0);
  }

  function openOperator(operatorId: string) {
    writeOperatorListState(storageKey, query, window.scrollY);
    onOpenOperator(operatorId);
  }

  const summary = operatorPage?.summary;
  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">运营主体管理</span>
          <h1>运营公司名录</h1>
          <p>查看当前组织范围内的主体状态、运力规模和治理任务。</p>
        </div>
      </section>
      <section className="operator-summary-grid" aria-label="运营主体数据摘要">
        <SummaryMetric label="主体总数" value={summary?.totalOperators} />
        <SummaryMetric label="正常运营" value={summary?.activeOperators} />
        <SummaryMetric label="需要关注" value={summary?.attentionOperators} />
        <SummaryMetric label="活跃车主" value={summary?.activeDrivers} />
        <SummaryMetric label="活跃车辆" value={summary?.activeVehicles} />
      </section>
      <section className="task-panel">
        <div className="list-toolbar">
          <label>
            搜索运营公司
            <input
              aria-label="搜索运营公司"
              placeholder="公司名称或主体编号"
              value={query.search ?? ""}
              onChange={(event) =>
                updateQuery(operatorQueryWithSearch(query, event.target.value))}
            />
          </label>
          <label>
            主体状态
            <select
              aria-label="主体状态"
              value={query.lifecycleState ?? ""}
              onChange={(event) =>
                updateQuery(operatorQueryWithState(query, event.target.value))}
            >
              <option value="">全部</option>
              <option value="active">正常运营</option>
              <option value="onboarding_review">准入审核中</option>
              <option value="restricted">受限</option>
              <option value="suspended">已暂停</option>
              <option value="exit_pending">退出处理中</option>
              <option value="exited">已退出</option>
            </select>
          </label>
          <label>
            排序
            <select
              aria-label="主体排序"
              value={query.sort ?? "operator_name_asc"}
              onChange={(event) =>
                updateQuery({
                  ...query,
                  sort: event.target.value as NonNullable<
                    AdminOperatorDirectoryQuery["sort"]
                  >,
                })}
            >
              <option value="operator_name_asc">公司名称</option>
              <option value="updated_at_desc">最近更新</option>
            </select>
          </label>
          <label>
            每页显示
            <select
              aria-label="主体每页显示"
              value={query.pageSize}
              onChange={(event) =>
                updateQuery({
                  ...query,
                  pageSize: Number(event.target.value) as 25 | 50 | 100,
                })}
            >
              <option>25</option>
              <option>50</option>
              <option>100</option>
            </select>
          </label>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {loading ? (
          <p className="list-state">正在加载运营公司…</p>
        ) : operatorPage?.items.length === 0 ? (
          <div className="list-state">
            <strong>没有符合条件的运营公司</strong>
            <p>请调整搜索或筛选条件后重试。</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>运营公司</th>
                  <th>状态</th>
                  <th>城市</th>
                  <th>活跃车主</th>
                  <th>活跃车辆</th>
                  <th>待办</th>
                  <th>最近更新</th>
                </tr>
              </thead>
              <tbody>
                {operatorPage?.items.map((operator) => (
                  <tr key={operator.operatorId}>
                    <td>
                      <button
                        className="task-link"
                        onClick={() => openOperator(operator.operatorId)}
                      >
                        <strong>{operator.operatorName}</strong>
                        <small>{operator.syntheticReference}</small>
                      </button>
                    </td>
                    <td>
                      <span
                        className={`status status-${operator.lifecycleState}`}
                      >
                        {operatorLifecycleLabel(operator.lifecycleState)}
                      </span>
                    </td>
                    <td>{operator.cityNames.join("、") || "待配置"}</td>
                    <td>{operator.activeDrivers}</td>
                    <td>{operator.activeVehicles}</td>
                    <td>{operator.pendingTasks}</td>
                    <td>{formatDate(operator.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <button
            disabled={!operatorPage?.pageInfo.hasPreviousPage}
            onClick={() =>
              setQuery(operatorCursorQuery(
                query,
                "before",
                operatorPage?.pageInfo.startCursor,
              ))}
          >
            上一页
          </button>
          <span>每页 {query.pageSize ?? 25} 条</span>
          <button
            disabled={!operatorPage?.pageInfo.hasNextPage}
            onClick={() =>
              setQuery(operatorCursorQuery(
                query,
                "after",
                operatorPage?.pageInfo.endCursor,
              ))}
          >
            下一页
          </button>
        </div>
      </section>
    </>
  );
}

function SummaryMetric({
  label,
  value,
}: Readonly<{ label: string; value: number | string | undefined }>) {
  return (
    <article className="summary-card">
      <strong>{value ?? "—"}</strong>
      <span>{label}</span>
    </article>
  );
}

function OperatorDetail({
  session,
  client,
  operatorId,
  onBack,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  operatorId: string;
  onBack(): void;
}>) {
  const [detail, setDetail] = useState<AdminOperatorDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState("");
  const [operationState, setOperationState] = useState<
    "idle" | "confirming" | "confirmed" | "error"
  >("idle");
  const [operationMessage, setOperationMessage] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    client
      .getOperator(session.accessToken, operatorId)
      .then((value) => active && setDetail(value))
      .catch((reason) => active && setError(messageFor(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [client, operatorId, session.accessToken]);

  async function performAction(
    action: AdminOperatorDetail["allowedActions"][number],
  ) {
    if (!detail || operationState === "confirming" || !note.trim()) return;
    setOperationState("confirming");
    setOperationMessage("结果确认中，请勿重复提交。");
    try {
      const result = await client.performOperatorAction(
        session.accessToken,
        operatorId,
        {
          action,
          expectedVersion: detail.operator.resourceVersion,
          idempotencyKey: operationIdentifier(operatorId, action),
          note: note.trim(),
        },
      );
      setDetail(result.detail);
      setNote("");
      setOperationState("confirmed");
      setOperationMessage(
        `${operatorActionLabel(action)}已确认，操作编号 ${result.operationId}`,
      );
    } catch (reason) {
      setOperationState("error");
      setOperationMessage(messageFor(reason));
    }
  }

  if (loading) return <p className="list-state">正在加载运营公司详情…</p>;
  if (error || !detail) {
    return (
      <section className="detail-state">
        <h1>运营公司详情暂时不可用</h1>
        <p>{error ?? "请返回列表后重试。"}</p>
        <button onClick={onBack}>返回运营公司名录</button>
      </section>
    );
  }

  return (
    <>
      <section className="page-heading detail-heading">
        <div>
          <span className="eyebrow">
            运营公司 · {detail.operator.syntheticReference}
          </span>
          <h1>{detail.operator.operatorName}</h1>
          <p>仅展示当前 Bearer 会话与组织范围允许读取的信息。</p>
        </div>
        <button onClick={onBack}>返回运营公司名录</button>
      </section>
      <section className="detail-grid">
        <article className="detail-card">
          <h2>主体信息</h2>
          <dl>
            <div>
              <dt>状态</dt>
              <dd>{operatorLifecycleLabel(detail.operator.lifecycleState)}</dd>
            </div>
            <div><dt>联系人</dt><dd>{detail.operator.contactMasked}</dd></div>
            <div>
              <dt>城市</dt>
              <dd>{detail.operator.cityNames.join("、") || "待配置"}</dd>
            </div>
            <div><dt>版本</dt><dd>{detail.operator.resourceVersion}</dd></div>
            <div>
              <dt>最近更新</dt>
              <dd>{formatDate(detail.operator.updatedAt)}</dd>
            </div>
          </dl>
        </article>
        <article className="detail-card">
          <h2>运营摘要</h2>
          <dl>
            <div><dt>活跃车主</dt><dd>{detail.operator.activeDrivers}</dd></div>
            <div><dt>活跃车辆</dt><dd>{detail.operator.activeVehicles}</dd></div>
            <div><dt>待办任务</dt><dd>{detail.operator.pendingTasks}</dd></div>
            <div>
              <dt>能力数量</dt>
              <dd>{detail.operator.capabilities.length}</dd>
            </div>
          </dl>
        </article>
        <article className="detail-card">
          <h2>城市能力</h2>
          <div className="capability-list">
            {detail.operator.capabilities.length > 0
              ? detail.operator.capabilities.map((capability) => (
                  <span key={capability.capabilityId}>
                    {capability.cityName} · {operatorCapabilityLabel(
                      capability.capabilityType,
                    )}
                  </span>
                ))
              : <p>当前没有已生效的城市能力。</p>}
          </div>
        </article>
        <article className="detail-card">
          <h2>阻断与提醒</h2>
          {detail.operator.blockers.length > 0
            ? (
              <ul className="blocker-list">
                {detail.operator.blockers.map((blocker) => (
                  <li key={`${blocker.blockerType}-${blocker.summary}`}>
                    <strong>{blocker.blocking ? "阻断" : "提醒"}</strong>
                    <span>{blocker.summary}</span>
                  </li>
                ))}
              </ul>
            )
            : <p>当前没有阻断项。</p>}
        </article>
        <article className="detail-card task-actions">
          <h2>允许操作</h2>
          {detail.allowedActions.length > 0 ? (
            <>
              <label>
                操作原因
                <textarea
                  aria-label="主体操作原因"
                  maxLength={300}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="请填写本次操作原因"
                />
              </label>
              <div className="task-action-buttons">
                {detail.allowedActions.map((action) => (
                  <button
                    key={action}
                    disabled={operationState === "confirming" || !note.trim()}
                    onClick={() => void performAction(action)}
                  >
                    {operatorActionLabel(action)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>当前角色在此主体状态下仅可查看。</p>
          )}
          {operationMessage ? (
            <p
              className={`operation-result operation-${operationState}`}
              role="status"
            >
              {operationMessage}
            </p>
          ) : null}
        </article>
        <article className="detail-card">
          <h2>当前范围与权限</h2>
          <p>
            {detail.organizationScope.organizationName} ·{" "}
            {detail.organizationScope.cityScopes.join("、")}
          </p>
          <div className="permission-list">
            {detail.allowedActions.length > 0
              ? detail.allowedActions.map((action) => (
                  <span key={action}>{operatorActionLabel(action)}</span>
                ))
              : <span>仅查看</span>}
          </div>
        </article>
        <article className="detail-card detail-audit">
          <h2>审计记录</h2>
          <ol>
            {[...detail.auditTrail].reverse().map((event) => (
              <li key={event.eventId}>
                <div>
                  <strong>{operatorAuditActionLabel(event.action)}</strong>
                  {event.note ? <small>{event.note}</small> : null}
                </div>
                <span>
                  {event.actorLabel} · {event.actorRole} ·{" "}
                  {formatDate(event.occurredAt)}
                </span>
              </li>
            ))}
          </ol>
        </article>
      </section>
    </>
  );
}

function OperationsTaskDetail({
  session,
  client,
  taskId,
  onBack,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  taskId: string;
  onBack(): void;
}>) {
  const [detail, setDetail] = useState<AdminOperationsTaskDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState("");
  const [operationState, setOperationState] = useState<
    "idle" | "confirming" | "confirmed" | "error"
  >("idle");
  const [operationMessage, setOperationMessage] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    client
      .getOperationsTask(session.accessToken, taskId)
      .then((value) => active && setDetail(value))
      .catch((reason) => active && setError(messageFor(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [client, session.accessToken, taskId]);

  async function performAction(
    action: AdminOperationsTaskDetail["allowedActions"][number],
  ) {
    if (!detail || operationState === "confirming") return;
    setOperationState("confirming");
    setOperationMessage("结果确认中，请勿重复提交。");
    try {
      const result = await client.performOperationsTaskAction(
        session.accessToken,
        taskId,
        {
          action,
          expectedVersion: detail.task.version,
          idempotencyKey: operationIdentifier(taskId, action),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      );
      setDetail(result.detail);
      setNote("");
      setOperationState("confirmed");
      setOperationMessage(
        `${actionLabel(action)}已确认，操作编号 ${result.operationId}`,
      );
    } catch (reason) {
      setOperationState("error");
      setOperationMessage(messageFor(reason));
    }
  }

  if (loading) return <p className="list-state">正在加载任务详情…</p>;
  if (error || !detail) {
    return (
      <section className="detail-state">
        <h1>{error === "未找到该工作任务" ? "未找到该工作任务" : "任务详情暂时不可用"}</h1>
        <p>{error ?? "请返回列表后重试。"}</p>
        <button onClick={onBack}>返回任务列表</button>
      </section>
    );
  }
  return (
    <>
      <section className="page-heading detail-heading">
        <div>
          <span className="eyebrow">工作任务 · {detail.task.taskId}</span>
          <h1>{detail.task.title}</h1>
          <p>仅展示当前 Bearer 会话与组织范围允许读取的信息。</p>
        </div>
        <button onClick={onBack}>返回任务列表</button>
      </section>
      <section className="detail-grid">
        <article className="detail-card">
          <h2>任务信息</h2>
          <dl>
            <div><dt>运营公司</dt><dd>{detail.task.operatorName}</dd></div>
            <div><dt>负责人</dt><dd>{detail.task.assigneeName}</dd></div>
            <div><dt>截止时间</dt><dd>{formatDate(detail.task.dueAt)}</dd></div>
            <div><dt>状态</dt><dd>{statusLabel(detail.task.status)}</dd></div>
            <div><dt>版本</dt><dd>{detail.task.version}</dd></div>
            <div><dt>最近更新</dt><dd>{formatDate(detail.task.updatedAt)}</dd></div>
          </dl>
        </article>
        <article className="detail-card">
          <h2>当前范围与权限</h2>
          <p>{detail.organizationScope.organizationName} · {detail.organizationScope.cityScopes.join("、")}</p>
          <div className="permission-list">
            {detail.allowedActions.length > 0
              ? detail.allowedActions.map((action) => <span key={action}>{actionLabel(action)}</span>)
              : <span>仅查看</span>}
          </div>
        </article>
        <article className="detail-card task-actions">
          <h2>允许操作</h2>
          {detail.allowedActions.length > 0 ? (
            <>
              <label>
                操作备注
                <textarea
                  aria-label="操作备注"
                  maxLength={300}
                  placeholder="可填写处理依据或复核结论"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              <div className="task-action-buttons">
                {detail.allowedActions.map((action) => (
                  <button
                    key={action}
                    disabled={operationState === "confirming"}
                    onClick={() => void performAction(action)}
                  >
                    {actionLabel(action)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>{detail.task.status === "completed" ? "任务已经完成，仅可查看审计记录。" : "当前角色在此任务状态下仅可查看。"}</p>
          )}
          {operationMessage ? (
            <p
              className={`operation-result operation-${operationState}`}
              role={operationState === "error" ? "alert" : "status"}
            >
              {operationMessage}
            </p>
          ) : null}
        </article>
        <article className="detail-card detail-audit">
          <h2>审计记录</h2>
          <ol>{detail.auditTrail.map((event) => <li key={event.eventId}><div><strong>{auditActionLabel(event.action)}</strong>{event.note ? <small>{event.note}</small> : null}</div><span>{event.actorLabel}{event.actorRole ? ` · ${event.actorRole}` : ""} · {formatDate(event.occurredAt)}</span></li>)}</ol>
        </article>
      </section>
    </>
  );
}

function FleetWorkspace({
  session,
  client,
  route,
  onNavigate,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  route: NonNullable<AdminRoute["fleet"]>;
  onNavigate(route: NonNullable<AdminRoute["fleet"]>): void;
}>) {
  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">运力名录</span>
          <p>{session.workIdentity.organizationName}</p>
          <h1>车主与车辆</h1>
        </div>
        <div className="fleet-tabs" role="tablist" aria-label="运力名录类型">
          <button
            role="tab"
            aria-selected={route.view === "drivers"}
            className={route.view === "drivers" ? "active" : ""}
            onClick={() => onNavigate({ view: "drivers" })}
          >
            车主名录
          </button>
          <button
            role="tab"
            aria-selected={route.view === "vehicles"}
            className={route.view === "vehicles" ? "active" : ""}
            onClick={() => onNavigate({ view: "vehicles" })}
          >
            车辆名录
          </button>
        </div>
      </section>
      {route.view === "drivers" && route.resourceId ? (
        <DriverDetailView
          session={session}
          client={client}
          driverAccountId={route.resourceId}
          onBack={() => onNavigate({ view: "drivers" })}
          onOpenVehicle={(vehicleId) =>
            onNavigate({ view: "vehicles", resourceId: vehicleId })}
        />
      ) : route.view === "drivers" ? (
        <DriverDirectoryView
          session={session}
          client={client}
          onOpen={(driverAccountId) =>
            onNavigate({ view: "drivers", resourceId: driverAccountId })}
        />
      ) : route.resourceId ? (
        <VehicleDetailView
          session={session}
          client={client}
          vehicleId={route.resourceId}
          onBack={() => onNavigate({ view: "vehicles" })}
          onOpenDriver={(driverAccountId) =>
            onNavigate({ view: "drivers", resourceId: driverAccountId })}
        />
      ) : (
        <VehicleDirectoryView
          session={session}
          client={client}
          onOpen={(vehicleId) =>
            onNavigate({ view: "vehicles", resourceId: vehicleId })}
        />
      )}
    </>
  );
}

function DriverDirectoryView({
  session,
  client,
  onOpen,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  onOpen(driverAccountId: string): void;
}>) {
  const storageKey =
    `${listStateStoragePrefix}.${session.workIdentity.workIdentityId}.fleet.drivers`;
  const restored = useMemo(
    () => readFleetListState<AdminDriverDirectoryQuery>(storageKey),
    [storageKey],
  );
  const [query, setQuery] = useState<AdminDriverDirectoryQuery>(
    restored?.query ?? { pageSize: 25, sort: "driver_name_asc" },
  );
  const [page, setPage] = useState<AdminDriverDirectoryPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    writeFleetListState(storageKey, query, window.scrollY);
    client.listDrivers(session.accessToken, query)
      .then((value) => {
        if (active) setPage(value);
      })
      .catch((reason) => {
        if (active) setError(messageFor(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, query, session.accessToken, storageKey]);

  useEffect(() => {
    if (!loading && restored) {
      window.requestAnimationFrame(() =>
        window.scrollTo({ top: restored.scrollY }));
    }
  }, [loading, restored]);

  function update(next: AdminDriverDirectoryQuery) {
    setQuery(next);
    writeFleetListState(storageKey, next, window.scrollY);
  }

  return (
    <>
      {page ? (
        <section className="metric-grid">
          <article><span>车主总数</span><strong>{page.summary.totalDrivers}</strong></article>
          <article><span>可服务</span><strong>{page.summary.serviceableDrivers}</strong></article>
          <article><span>受限</span><strong>{page.summary.restrictedDrivers}</strong></article>
          <article><span>审核关注</span><strong>{page.summary.reviewAttentionDrivers}</strong></article>
        </section>
      ) : null}
      <section className="directory-panel">
        <div className="directory-toolbar">
          <label>
            搜索车主
            <input
              value={query.search ?? ""}
              placeholder="姓名、手机号、编号或运营公司"
              onChange={(event) =>
                update(fleetQueryWithSearch(query, event.target.value))}
            />
          </label>
          <label>
            资格状态
            <select
              value={query.eligibilityState ?? ""}
              onChange={(event) =>
                update(driverQueryWithState(query, event.target.value))}
            >
              <option value="">全部状态</option>
              <option value="serviceable">可服务</option>
              <option value="restricted">受限</option>
            </select>
          </label>
          <label>
            排序
            <select
              value={query.sort ?? "driver_name_asc"}
              onChange={(event) =>
                update({
                  ...clearFleetCursor(query),
                  sort:
                    event.target.value as NonNullable<
                      AdminDriverDirectoryQuery["sort"]
                    >,
                })}
            >
              <option value="driver_name_asc">姓名升序</option>
              <option value="updated_at_desc">最近更新</option>
            </select>
          </label>
        </div>
        {loading ? <p className="state-line">正在加载车主名录…</p> : null}
        {error ? <EmptyState title="车主名录加载失败" description={error} /> : null}
        {!loading && !error && page?.items.length === 0 ? (
          <EmptyState title="没有符合条件的车主" description="请调整搜索或筛选条件。" />
        ) : null}
        {!loading && !error && page?.items.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>车主</th><th>运营公司</th><th>资格</th><th>车辆</th><th>审核关注</th><th /></tr></thead>
              <tbody>{page.items.map((driver) => (
                <tr key={driver.driverAccountId}>
                  <td><strong>{driver.displayNameMasked}</strong><small>{driver.phoneMasked} · {driver.driverAccountId}</small></td>
                  <td>{driver.operatorName}</td>
                  <td><span className={`status-pill ${driver.eligibilityState === "serviceable" ? "completed" : "blocked"}`}>{driverEligibilityLabel(driver.eligibilityState)}</span></td>
                  <td>{driver.vehicleCount}</td>
                  <td>{driver.reviewAttentionCount}</td>
                  <td><button className="text-action" onClick={() => onOpen(driver.driverAccountId)}>查看详情</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
        {page ? (
          <PaginationControls
            pageInfo={page.pageInfo}
            onPrevious={() =>
              update(fleetCursorQuery(query, "before", page.pageInfo.startCursor))}
            onNext={() =>
              update(fleetCursorQuery(query, "after", page.pageInfo.endCursor))}
          />
        ) : null}
      </section>
    </>
  );
}

function VehicleDirectoryView({
  session,
  client,
  onOpen,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  onOpen(vehicleId: string): void;
}>) {
  const storageKey =
    `${listStateStoragePrefix}.${session.workIdentity.workIdentityId}.fleet.vehicles`;
  const restored = useMemo(
    () => readFleetListState<AdminVehicleDirectoryQuery>(storageKey),
    [storageKey],
  );
  const [query, setQuery] = useState<AdminVehicleDirectoryQuery>(
    restored?.query ?? { pageSize: 25, sort: "plate_asc" },
  );
  const [page, setPage] = useState<AdminVehicleDirectoryPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    writeFleetListState(storageKey, query, window.scrollY);
    client.listVehicles(session.accessToken, query)
      .then((value) => {
        if (active) setPage(value);
      })
      .catch((reason) => {
        if (active) setError(messageFor(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, query, session.accessToken, storageKey]);

  useEffect(() => {
    if (!loading && restored) {
      window.requestAnimationFrame(() =>
        window.scrollTo({ top: restored.scrollY }));
    }
  }, [loading, restored]);

  function update(next: AdminVehicleDirectoryQuery) {
    setQuery(next);
    writeFleetListState(storageKey, next, window.scrollY);
  }

  return (
    <>
      {page ? (
        <section className="metric-grid">
          <article><span>车辆总数</span><strong>{page.summary.totalVehicles}</strong></article>
          <article><span>已通过</span><strong>{page.summary.approvedVehicles}</strong></article>
          <article><span>审核中</span><strong>{page.summary.underReviewVehicles}</strong></article>
          <article><span>待补材料</span><strong>{page.summary.changesRequestedVehicles}</strong></article>
          <article><span>未通过</span><strong>{page.summary.rejectedVehicles}</strong></article>
          <article><span>开放审核任务</span><strong>{page.summary.openReviewTasks}</strong></article>
        </section>
      ) : null}
      <section className="directory-panel">
        <div className="directory-toolbar">
          <label>
            搜索车辆
            <input
              value={query.search ?? ""}
              placeholder="车牌、车型、车主或运营公司"
              onChange={(event) =>
                update(fleetQueryWithSearch(query, event.target.value))}
            />
          </label>
          <label>
            审核状态
            <select
              value={query.reviewState ?? ""}
              onChange={(event) =>
                update(vehicleQueryWithState(query, event.target.value))}
            >
              <option value="">全部状态</option>
              <option value="approved">已通过</option>
              <option value="under_review">审核中</option>
              <option value="changes_requested">待补材料</option>
              <option value="rejected">未通过</option>
            </select>
          </label>
          <label>
            排序
            <select
              value={query.sort ?? "plate_asc"}
              onChange={(event) =>
                update({
                  ...clearFleetCursor(query),
                  sort:
                    event.target.value as NonNullable<
                      AdminVehicleDirectoryQuery["sort"]
                    >,
                })}
            >
              <option value="plate_asc">车牌升序</option>
              <option value="updated_at_desc">最近更新</option>
            </select>
          </label>
        </div>
        {loading ? <p className="state-line">正在加载车辆名录…</p> : null}
        {error ? <EmptyState title="车辆名录加载失败" description={error} /> : null}
        {!loading && !error && page?.items.length === 0 ? (
          <EmptyState title="没有符合条件的车辆" description="请调整搜索或筛选条件。" />
        ) : null}
        {!loading && !error && page?.items.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>车辆</th><th>车主</th><th>运营公司</th><th>审核状态</th><th>任务状态</th><th /></tr></thead>
              <tbody>{page.items.map((vehicle) => (
                <tr key={vehicle.vehicleId}>
                  <td><strong>{vehicle.plateMasked}</strong><small>{vehicle.vehicleSummary} · {vehicle.vehicleId}</small></td>
                  <td>{vehicle.driverNameMasked}</td>
                  <td>{vehicle.operatorName}</td>
                  <td><span className={`status-pill ${vehicleStatusTone(vehicle.reviewState)}`}>{vehicleReviewLabel(vehicle.reviewState)}</span></td>
                  <td>{vehicle.reviewTaskStatus ? reviewTaskStatusLabel(vehicle.reviewTaskStatus) : "无开放任务"}</td>
                  <td><button className="text-action" onClick={() => onOpen(vehicle.vehicleId)}>查看详情</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
        {page ? (
          <PaginationControls
            pageInfo={page.pageInfo}
            onPrevious={() =>
              update(fleetCursorQuery(query, "before", page.pageInfo.startCursor))}
            onNext={() =>
              update(fleetCursorQuery(query, "after", page.pageInfo.endCursor))}
          />
        ) : null}
      </section>
    </>
  );
}

function DriverDetailView({
  session,
  client,
  driverAccountId,
  onBack,
  onOpenVehicle,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  driverAccountId: string;
  onBack(): void;
  onOpenVehicle(vehicleId: string): void;
}>) {
  const [detail, setDetail] = useState<AdminDriverDetail>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    client.getDriver(session.accessToken, driverAccountId)
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch((reason) => {
        if (active) setError(messageFor(reason));
      });
    return () => {
      active = false;
    };
  }, [client, driverAccountId, session.accessToken]);
  if (error) return <EmptyState title="车主详情加载失败" description={error} actionLabel="返回名录" onAction={onBack} />;
  if (!detail) return <p className="state-line">正在加载车主详情…</p>;
  return (
    <>
      <button className="back-action" onClick={onBack}>← 返回车主名录</button>
      <section className="detail-hero">
        <div><span className="eyebrow">车主 360°</span><h1>{detail.driver.displayNameMasked}</h1><p>{detail.driver.phoneMasked} · {detail.driver.driverAccountId}</p></div>
        <span className={`status-pill ${detail.driver.eligibilityState === "serviceable" ? "completed" : "blocked"}`}>{driverEligibilityLabel(detail.driver.eligibilityState)}</span>
      </section>
      <section className="detail-grid">
        <article className="detail-card">
          <h2>运营与资格摘要</h2>
          <dl className="detail-list">
            <div><dt>主运营公司</dt><dd>{detail.profile.primaryOperatorRelationship.operatorName}</dd></div>
            <div><dt>城市范围</dt><dd>{detail.organizationScope.cityScopes.join("、")}</dd></div>
            <div><dt>配额摘要</dt><dd>{detail.profile.quotaSummary}</dd></div>
            <div><dt>敏感字段</dt><dd>已脱敏</dd></div>
          </dl>
        </article>
        <article className="detail-card">
          <h2>关联车辆</h2>
          <div className="linked-records">{detail.linkedVehicles.map((vehicle) => (
            <button key={vehicle.vehicleId} onClick={() => onOpenVehicle(vehicle.vehicleId)}>
              <strong>{vehicle.plateMasked}</strong>
              <span>{vehicle.vehicleSummary} · {vehicleReviewLabel(vehicle.reviewState)}</span>
            </button>
          ))}</div>
        </article>
        <article className="detail-card detail-audit">
          <h2>访问审计</h2>
          <ol>{detail.auditTrail.map((event) => (
            <li key={event.eventId}><div><strong>查看车主 360°</strong></div><span>{event.actorLabel} · {event.actorRole} · {formatDate(event.occurredAt)}</span></li>
          ))}</ol>
        </article>
      </section>
    </>
  );
}

function VehicleDetailView({
  session,
  client,
  vehicleId,
  onBack,
  onOpenDriver,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  vehicleId: string;
  onBack(): void;
  onOpenDriver(driverAccountId: string): void;
}>) {
  const [detail, setDetail] = useState<AdminVehicleDetail>();
  const [error, setError] = useState<string>();
  const [operationState, setOperationState] = useState<
    "idle" | "pending" | "confirmed" | "unknown" | "error"
  >("idle");
  const [operationMessage, setOperationMessage] = useState<string>();
  const [materialReason, setMaterialReason] =
    useState("insurance_expiry_incomplete");
  const [rejectionReason, setRejectionReason] =
    useState("vehicle_age_exceeded");

  async function refresh() {
    setError(undefined);
    try {
      setDetail(await client.getVehicle(session.accessToken, vehicleId));
    } catch (reason) {
      setError(messageFor(reason));
    }
  }

  useEffect(() => {
    void refresh();
  }, [client, session.accessToken, vehicleId]);

  async function execute(action: AdminVehicleReviewAction) {
    if (!detail?.reviewTask) return;
    setOperationState("pending");
    setOperationMessage("操作已提交，正在确认结果…");
    const idempotencyKey =
      `fleet-${action}-${vehicleId}-${detail.reviewTask.taskVersion}-${Date.now()}`;
    try {
      const result = await client.performVehicleReviewAction(
        session.accessToken,
        vehicleId,
        {
          action,
          expectedTaskVersion: detail.reviewTask.taskVersion,
          expectedVehicleReviewVersion:
            detail.reviewTask.vehicleReviewVersion,
          idempotencyKey,
          ...(action === "request_material"
            ? { reasonCode: materialReason as "insurance_expiry_incomplete" }
            : {}),
          ...(action === "reject"
            ? { reasonCode: rejectionReason as "vehicle_age_exceeded" }
            : {}),
        },
      );
      setDetail(result.detail);
      setOperationState("confirmed");
      setOperationMessage(result.idempotentReplay
        ? "已返回原操作结果，未重复执行。"
        : "操作结果已确认并写入审计记录。");
    } catch (reason) {
      if (
        reason instanceof Error &&
        reason.message === "SERVICE_UNAVAILABLE"
      ) {
        setOperationState("unknown");
        setOperationMessage("结果确认中。请查询最新详情，不要重复提交。");
      } else {
        setOperationState("error");
        setOperationMessage(messageFor(reason));
      }
    }
  }

  if (error) return <EmptyState title="车辆详情加载失败" description={error} actionLabel="返回名录" onAction={onBack} />;
  if (!detail) return <p className="state-line">正在加载车辆详情…</p>;
  return (
    <>
      <button className="back-action" onClick={onBack}>← 返回车辆名录</button>
      <section className="detail-hero">
        <div><span className="eyebrow">车辆 360°</span><h1>{detail.vehicle.plateMasked}</h1><p>{detail.vehicle.vehicleSummary} · {detail.vehicle.vehicleId}</p></div>
        <span className={`status-pill ${vehicleStatusTone(detail.vehicle.reviewState)}`}>{vehicleReviewLabel(detail.vehicle.reviewState)}</span>
      </section>
      <section className="detail-grid">
        <article className="detail-card">
          <h2>车辆与归属</h2>
          <dl className="detail-list">
            <div><dt>车主</dt><dd><button className="text-action" onClick={() => onOpenDriver(detail.driver.driverAccountId)}>{detail.driver.displayNameMasked}</button></dd></div>
            <div><dt>主运营公司</dt><dd>{detail.vehicle.operatorName}</dd></div>
            <div><dt>审核版本</dt><dd>v{detail.vehicle.resourceVersion}</dd></div>
            <div><dt>临期材料</dt><dd>{detail.profile.expiringDocumentCount} 项</dd></div>
          </dl>
        </article>
        <article className="detail-card">
          <h2>审核任务</h2>
          {detail.reviewTask ? (
            <dl className="detail-list">
              <div><dt>任务编号</dt><dd>{detail.reviewTask.taskId}</dd></div>
              <div><dt>任务状态</dt><dd>{reviewTaskStatusLabel(detail.reviewTask.status)}</dd></div>
              <div><dt>保险有效期</dt><dd>{reviewFieldLabel(detail.reviewTask.insuranceExpiryStatus)}</dd></div>
              <div><dt>授权材料</dt><dd>{reviewFieldLabel(detail.reviewTask.authorizationEvidenceStatus)}</dd></div>
              <div><dt>附件校验</dt><dd>{reviewFieldLabel(detail.reviewTask.attachmentValidationStatus)}</dd></div>
            </dl>
          ) : <p>该车辆当前没有开放审核任务。</p>}
        </article>
        <article className="detail-card">
          <h2>允许操作</h2>
          {detail.allowedActions.length === 0 ? (
            <p>当前角色或任务状态仅允许查看。</p>
          ) : (
            <div className="fleet-actions">
              {detail.allowedActions.includes("claim") ? (
                <button className="primary-action" disabled={operationState === "pending"} onClick={() => void execute("claim")}>认领审核任务</button>
              ) : null}
              {detail.allowedActions.includes("request_material") ? (
                <label>补充材料原因<select value={materialReason} onChange={(event) => setMaterialReason(event.target.value)}>
                  <option value="insurance_expiry_incomplete">保险有效期不完整</option>
                  <option value="authorization_evidence_incomplete">授权材料不完整</option>
                  <option value="synthetic_attachment_invalid">合成附件无效</option>
                </select><button disabled={operationState === "pending"} onClick={() => void execute("request_material")}>要求补充材料</button></label>
              ) : null}
              {detail.allowedActions.includes("approve") ? (
                <button className="primary-action" disabled={operationState === "pending"} onClick={() => void execute("approve")}>批准车辆</button>
              ) : null}
              {detail.allowedActions.includes("reject") ? (
                <label>拒绝原因<select value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)}>
                  <option value="vehicle_age_exceeded">车龄超出标准</option>
                  <option value="vehicle_mileage_exceeded">里程超出标准</option>
                  <option value="insurance_requirement_not_met">保险条件不满足</option>
                  <option value="authorization_remaining_insufficient">授权期限不足</option>
                </select><button className="danger-action" disabled={operationState === "pending"} onClick={() => void execute("reject")}>拒绝申请</button></label>
              ) : null}
            </div>
          )}
          {operationMessage ? (
            <div className={`operation-result operation-${operationState}`} role={operationState === "error" ? "alert" : "status"}>
              {operationMessage}
              {operationState === "unknown" ? <button className="text-action" onClick={() => void refresh()}>查询最新结果</button> : null}
            </div>
          ) : null}
        </article>
        <article className="detail-card detail-audit">
          <h2>审核审计</h2>
          {detail.auditTrail.length ? (
            <ol>{detail.auditTrail.map((event) => (
              <li key={event.id}><div><strong>{reviewAuditLabel(event.action)}</strong><small>{event.reasonCode}</small></div><span>{event.actorId} · {formatDate(event.occurredAt)}</span></li>
            ))}</ol>
          ) : <p>尚无审核操作记录。</p>}
        </article>
      </section>
    </>
  );
}

function FinanceDirectory({
  session,
  client,
  onOpenFinance,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  onOpenFinance(finance: NonNullable<AdminRoute["finance"]>): void;
}>) {
  const storageKey =
    `${listStateStoragePrefix}.${session.workIdentity.workIdentityId}.finance`;
  const restoredState = useMemo(
    () => readFleetListState<AdminFinanceDirectoryQuery>(storageKey),
    [storageKey],
  );
  const [query, setQuery] = useState<AdminFinanceDirectoryQuery>(
    restoredState?.query ?? { pageSize: 25, sort: "updated_at_desc" },
  );
  const [page, setPage] = useState<AdminFinanceDirectoryPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    writeFleetListState(storageKey, query, window.scrollY);
    client
      .listFinanceResources(session.accessToken, query)
      .then((value) => {
        if (!active) return;
        setPage(value);
        window.requestAnimationFrame(() => {
          const saved =
            readFleetListState<AdminFinanceDirectoryQuery>(storageKey);
          if (saved && saved.scrollY > 0) window.scrollTo(0, saved.scrollY);
        });
      })
      .catch((reason) => active && setError(messageFor(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [client, query, session.accessToken, storageKey]);

  function update(next: AdminFinanceDirectoryQuery) {
    const normalized = clearFleetCursor(next);
    setQuery(normalized);
    writeFleetListState(storageKey, normalized, 0);
  }

  function openFinance(
    kind: NonNullable<AdminRoute["finance"]>["kind"],
    resourceId: string,
  ) {
    writeFleetListState(storageKey, query, window.scrollY);
    onOpenFinance({ kind, resourceId });
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">合成账务任务与职责分离</span>
          <h1>财务与对账</h1>
          <p>处理结算、车主付款、退款、对账和营业日关账；金额只读，真实资金操作保持关闭。</p>
        </div>
      </section>
      <section className="operator-summary-grid" aria-label="财务与对账数据摘要">
        <SummaryMetric label="范围内记录" value={page?.summary.totalResources} />
        <SummaryMetric label="硬门阻断" value={page?.summary.blockingResources} />
        <SummaryMetric label="等待独立复核" value={page?.summary.awaitingIndependentReview} />
        <SummaryMetric label="未知结果" value={page?.summary.unknownResults} />
        <SummaryMetric label="开放对账运行" value={page?.summary.openReconciliationRuns} />
        <SummaryMetric label="可准备关账" value={page?.summary.readyBusinessDays} />
      </section>
      <section className="task-panel">
        <div className="list-toolbar">
          <label>
            搜索财务记录
            <input
              aria-label="搜索财务记录"
              placeholder="批次、运营公司或营业日"
              value={query.search ?? ""}
              onChange={(event) =>
                update(fleetQueryWithSearch(query, event.target.value))}
            />
          </label>
          <label>
            记录类型
            <select
              aria-label="财务记录类型"
              value={query.kind ?? ""}
              onChange={(event) => {
                const { kind: _kind, ...rest } = query;
                update(event.target.value
                  ? {
                      ...rest,
                      kind: event.target.value as NonNullable<
                        AdminFinanceDirectoryQuery["kind"]
                      >,
                    }
                  : rest);
              }}
            >
              <option value="">全部</option>
              <option value="settlement">分配结算</option>
              <option value="payout">车主付款</option>
              <option value="refund_reversal">退款与冲正</option>
              <option value="reconciliation">对账运行</option>
              <option value="business_day">营业日关账</option>
              <option value="ledger">账本交易</option>
            </select>
          </label>
          <label>
            处理状态
            <select
              aria-label="财务记录状态"
              value={query.state ?? ""}
              onChange={(event) => {
                const { state: _state, ...rest } = query;
                update(event.target.value
                  ? {
                      ...rest,
                      state: event.target.value as NonNullable<
                        AdminFinanceDirectoryQuery["state"]
                      >,
                    }
                  : rest);
              }}
            >
              <option value="">全部</option>
              <option value="eligible">可准备</option>
              <option value="ready">待复核</option>
              <option value="awaiting_review">等待独立复核</option>
              <option value="approved">已批准</option>
              <option value="processing">处理中</option>
              <option value="blocked">已阻断</option>
              <option value="unknown">结果未知</option>
              <option value="differences_found">发现差异</option>
              <option value="open">营业日开放</option>
              <option value="closed">已关闭</option>
              <option value="posted">已记账</option>
            </select>
          </label>
          <label>
            阻断状态
            <select
              aria-label="财务阻断状态"
              value={query.blocking === undefined ? "" : String(query.blocking)}
              onChange={(event) => {
                const { blocking: _blocking, ...rest } = query;
                update(event.target.value
                  ? { ...rest, blocking: event.target.value === "true" }
                  : rest);
              }}
            >
              <option value="">全部</option>
              <option value="true">仅阻断项</option>
              <option value="false">仅非阻断项</option>
            </select>
          </label>
          <label>
            排序
            <select
              aria-label="财务记录排序"
              value={query.sort ?? "updated_at_desc"}
              onChange={(event) =>
                update({
                  ...query,
                  sort: event.target.value as NonNullable<
                    AdminFinanceDirectoryQuery["sort"]
                  >,
                })}
            >
              <option value="updated_at_desc">最近更新</option>
              <option value="resource_id_asc">记录编号</option>
            </select>
          </label>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {loading ? (
          <p className="list-state">正在加载财务记录…</p>
        ) : page?.items.length === 0 ? (
          <div className="list-state">
            <strong>没有符合条件的财务记录</strong>
            <p>请调整搜索或筛选条件后重试。</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>记录</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>运营公司</th>
                  <th>营业日</th>
                  <th>控制状态</th>
                  <th>最近更新</th>
                </tr>
              </thead>
              <tbody>
                {page?.items.map((item) => (
                  <tr key={`${item.kind}-${item.resourceId}`}>
                    <td>
                      <button
                        className="task-link"
                        onClick={() => openFinance(item.kind, item.resourceId)}
                      >
                        <strong>{item.summary}</strong>
                        <small>{item.resourceId}</small>
                      </button>
                    </td>
                    <td>{financeKindLabel(item.kind)}</td>
                    <td><span className={`status-pill ${financeStatusTone(item.state)}`}>{financeStateLabel(item.state)}</span></td>
                    <td>{item.operatorName ?? "平台范围"}</td>
                    <td>{item.businessDate ?? "—"}</td>
                    <td>{item.blocking ? "存在阻断" : "无阻断"}</td>
                    <td>{formatDate(item.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {page ? (
          <PaginationControls
            pageInfo={page.pageInfo}
            onPrevious={() =>
              setQuery(fleetCursorQuery(
                query,
                "before",
                page.pageInfo.startCursor,
              ))}
            onNext={() =>
              setQuery(fleetCursorQuery(
                query,
                "after",
                page.pageInfo.endCursor,
              ))}
          />
        ) : null}
      </section>
    </>
  );
}

function FinanceDetail({
  session,
  client,
  financeRoute,
  onBack,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  financeRoute: NonNullable<AdminRoute["finance"]>;
  onBack(): void;
}>) {
  const [detail, setDetail] = useState<AdminFinanceDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reasonCode, setReasonCode] = useState("sandbox_finance_operation");
  const [evidenceReference, setEvidenceReference] = useState(
    "EVIDENCE-SYNTHETIC-2026-0716",
  );
  const [operationState, setOperationState] = useState<
    "idle" | "confirming" | "confirmed" | "error"
  >("idle");
  const [operationMessage, setOperationMessage] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    client
      .getFinanceResource(
        session.accessToken,
        financeRoute.kind,
        financeRoute.resourceId,
      )
      .then((value) => active && setDetail(value))
      .catch((reason) => active && setError(messageFor(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [
    client,
    financeRoute.kind,
    financeRoute.resourceId,
    session.accessToken,
  ]);

  async function execute(action: AdminFinanceAction) {
    if (!detail || operationState === "confirming") return;
    if (!reasonCode.trim()) {
      setOperationState("error");
      setOperationMessage("请填写操作原因编码。");
      return;
    }
    if (
      action === "submit_reconciliation_resolution" &&
      !evidenceReference.trim()
    ) {
      setOperationState("error");
      setOperationMessage("提交对账差异解决前必须填写证据引用。");
      return;
    }
    setOperationState("confirming");
    setOperationMessage("结果确认中，请勿重复提交。");
    try {
      const result = await client.performFinanceAction(
        session.accessToken,
        financeRoute.kind,
        financeRoute.resourceId,
        {
          action,
          expectedVersion: detail.item.resourceVersion,
          idempotencyKey: operationIdentifier(
            financeRoute.resourceId,
            action,
          ),
          reasonCode: reasonCode.trim(),
          ...(action === "submit_reconciliation_resolution"
            ? { evidenceReference: evidenceReference.trim() }
            : {}),
        },
      );
      setDetail(result.detail);
      setOperationState("confirmed");
      setOperationMessage(
        `${financeActionLabel(action)}已确认，操作编号 ${result.operationId}`,
      );
    } catch (reason) {
      setOperationState("error");
      setOperationMessage(messageFor(reason));
    }
  }

  if (loading) return <p className="list-state">正在加载财务记录详情…</p>;
  if (error || !detail) {
    return (
      <section className="list-state">
        <strong>无法加载财务记录详情</strong>
        <p role="alert">{error ?? "记录不存在或当前账号无权查看。"}</p>
        <button onClick={onBack}>返回财务列表</button>
      </section>
    );
  }

  return (
    <>
      <section className="page-heading detail-heading">
        <div>
          <button className="text-action" onClick={onBack}>← 返回财务列表</button>
          <span className="eyebrow">{financeKindLabel(detail.kind)}</span>
          <h1>{detail.item.summary}</h1>
          <p>{detail.item.resourceId} · {detail.item.operatorName ?? "平台范围"}</p>
        </div>
        <span className={`status-pill ${financeStatusTone(detail.item.state)}`}>
          {financeStateLabel(detail.item.state)}
        </span>
      </section>
      <section className="detail-grid">
        <article className="detail-card">
          <h2>财务事实</h2>
          <FinanceRecordFacts detail={detail} />
        </article>
        <article className="detail-card">
          <h2>控制边界</h2>
          <dl className="detail-list">
            <div><dt>组织范围</dt><dd>{detail.organizationScope.organizationName}</dd></div>
            <div><dt>金额编辑</dt><dd>禁止</dd></div>
            <div><dt>直接修改余额</dt><dd>{detail.directBalanceMutationAllowed ? "允许" : "禁止"}</dd></div>
            <div><dt>真实资金移动</dt><dd>{detail.realMoneyMovementAllowed ? "允许" : "关闭"}</dd></div>
            <div><dt>资源版本</dt><dd>{detail.item.resourceVersion}</dd></div>
          </dl>
        </article>
        <article className="detail-card detail-actions">
          <h2>当前角色允许操作</h2>
          {detail.allowedActions.length ? (
            <>
              <label>
                操作原因编码
                <input
                  aria-label="财务操作原因编码"
                  value={reasonCode}
                  onChange={(event) => setReasonCode(event.target.value)}
                />
              </label>
              {detail.allowedActions.includes(
                "submit_reconciliation_resolution",
              ) ? (
                <label>
                  证据引用
                  <input
                    aria-label="对账证据引用"
                    value={evidenceReference}
                    onChange={(event) =>
                      setEvidenceReference(event.target.value)}
                  />
                </label>
              ) : null}
              <div className="action-row">
                {detail.allowedActions.map((action) => (
                  <button
                    key={action}
                    disabled={operationState === "confirming"}
                    onClick={() => void execute(action)}
                  >
                    {financeActionLabel(action)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>当前角色仅可查看此记录，或记录尚未到达可操作状态。</p>
          )}
          {operationMessage ? (
            <p
              className={
                operationState === "error"
                  ? "form-error"
                  : "operation-result"
              }
              role={operationState === "error" ? "alert" : "status"}
            >
              {operationMessage}
            </p>
          ) : null}
        </article>
        <article className="detail-card detail-audit">
          <h2>追加式审计</h2>
          {detail.auditTrail.length ? (
            <ol>
              {detail.auditTrail.map((event) => (
                <li key={event.eventId}>
                  <div>
                    <strong>{financeAuditLabel(event.action)}</strong>
                    <small>{event.reasonCode ?? "范围内访问"}</small>
                  </div>
                  <span>{event.actorRole} · {formatDate(event.occurredAt)}</span>
                </li>
              ))}
            </ol>
          ) : <p>尚无财务访问或操作记录。</p>}
        </article>
      </section>
    </>
  );
}

function FinanceRecordFacts({
  detail,
}: Readonly<{ detail: AdminFinanceDetail }>) {
  if (detail.kind === "settlement") {
    return (
      <dl className="detail-list">
        <div><dt>营业日</dt><dd>{detail.record.businessDate}</dd></div>
        <div><dt>分配笔数</dt><dd>{detail.record.allocationCount}</dd></div>
        <div><dt>结算总额</dt><dd>{formatMinorCurrency(detail.record.grossSettlementMinor)}</dd></div>
        <div><dt>平台份额</dt><dd>{formatMinorCurrency(detail.record.platformShareMinor)}</dd></div>
        <div><dt>运营公司份额</dt><dd>{formatMinorCurrency(detail.record.operatorShareMinor)}</dd></div>
        <div><dt>车主份额</dt><dd>{formatMinorCurrency(detail.record.driverShareMinor)}</dd></div>
        <div><dt>阻断项</dt><dd>{detail.record.blockers.join("、") || "无"}</dd></div>
      </dl>
    );
  }
  if (detail.kind === "payout") {
    return (
      <dl className="detail-list">
        <div><dt>营业日</dt><dd>{detail.record.businessDate}</dd></div>
        <div><dt>车主账户</dt><dd>{detail.record.driverAccountMasked}</dd></div>
        <div><dt>收款账户</dt><dd>{detail.record.bankAccountMasked}</dd></div>
        <div><dt>应付总额</dt><dd>{formatMinorCurrency(detail.record.grossPayableMinor)}</dd></div>
        <div><dt>付款手续费</dt><dd>{formatMinorCurrency(detail.record.payoutFeeMinor)}</dd></div>
        <div><dt>阻断项</dt><dd>{detail.record.blockers.join("、") || "无"}</dd></div>
      </dl>
    );
  }
  if (detail.kind === "refund_reversal") {
    return (
      <dl className="detail-list">
        <div><dt>原支付</dt><dd>{detail.record.originalPaymentId}</dd></div>
        <div><dt>原账本交易</dt><dd>{detail.record.originalLedgerTransactionId}</dd></div>
        <div><dt>责任金额</dt><dd>{formatMinorCurrency(detail.record.amountMinor)}</dd></div>
        <div><dt>支付机构结果</dt><dd>{financeStateLabel(detail.record.providerResult)}</dd></div>
        <div><dt>原记录可修改</dt><dd>{detail.record.originalRecordMutable ? "是" : "否"}</dd></div>
        <div><dt>任意分录</dt><dd>{detail.record.arbitraryJournalEntryAllowed ? "允许" : "禁止"}</dd></div>
      </dl>
    );
  }
  if (detail.kind === "reconciliation") {
    return (
      <>
        <dl className="detail-list">
          <div><dt>营业日</dt><dd>{detail.record.businessDate}</dd></div>
          <div><dt>事实来源</dt><dd>{detail.record.factSources.join("、")}</dd></div>
          <div><dt>差异数量</dt><dd>{detail.record.differences.length}</dd></div>
          <div><dt>资金案件</dt><dd>{detail.record.fundCases.length}</dd></div>
        </dl>
        <div className="table-scroll">
          <table>
            <thead><tr><th>差异</th><th>类型</th><th>金额</th><th>状态</th><th>证据</th></tr></thead>
            <tbody>
              {detail.record.differences.map((difference) => (
                <tr key={difference.reconciliationItemId}>
                  <td>{difference.reconciliationItemId}</td>
                  <td>{difference.differenceType}</td>
                  <td>{formatMinorCurrency(difference.differenceAmountMinor)}</td>
                  <td>{financeStateLabel(difference.state)}</td>
                  <td>{difference.evidenceReference ?? "待补充"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }
  if (detail.kind === "business_day") {
    return (
      <dl className="detail-list">
        <div><dt>营业日</dt><dd>{detail.record.businessDate}</dd></div>
        <div><dt>时区</dt><dd>{detail.record.timezone}</dd></div>
        <div><dt>全部运行关闭</dt><dd>{detail.record.allRunsClosed ? "是" : "否"}</dd></div>
        <div><dt>四方事实齐备</dt><dd>{detail.record.fourSourcesPresent ? "是" : "否"}</dd></div>
        <div><dt>零差异</dt><dd>{detail.record.zeroDifference ? "是" : "否"}</dd></div>
        <div><dt>阻断资金案件</dt><dd>{detail.record.blockingFundCases}</dd></div>
      </dl>
    );
  }
  return (
    <>
      <dl className="detail-list">
        <div><dt>全局序列</dt><dd>{detail.record.globalSequence}</dd></div>
        <div><dt>来源</dt><dd>{detail.record.sourceNamespace}</dd></div>
        <div><dt>来源事件</dt><dd>{detail.record.sourceEventId}</dd></div>
        <div><dt>借方合计</dt><dd>{formatMinorCurrency(detail.record.debitTotalMinor)}</dd></div>
        <div><dt>贷方合计</dt><dd>{formatMinorCurrency(detail.record.creditTotalMinor)}</dd></div>
      </dl>
      <div className="table-scroll">
        <table>
          <thead><tr><th>分录</th><th>方向</th><th>科目</th><th>维度</th><th>金额</th></tr></thead>
          <tbody>
            {detail.record.entries.map((entry) => (
              <tr key={entry.entryId}>
                <td>{entry.entryId}</td>
                <td>{entry.side === "debit" ? "借" : "贷"}</td>
                <td>{entry.accountCode}</td>
                <td>{entry.dimensionKey}</td>
                <td>{formatMinorCurrency(entry.amountMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AuditDirectory({
  session,
  client,
  onOpenAudit,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  onOpenAudit(
    route: Readonly<{ kind: "event" | "investigation"; resourceId: string }>,
  ): void;
}>) {
  const storageKey =
    `${listStateStoragePrefix}.${session.workIdentity.workIdentityId}.audit`;
  const restored = useMemo(
    () => readFleetListState<AdminAuditDirectoryQuery>(storageKey),
    [storageKey],
  );
  const [query, setQuery] = useState<AdminAuditDirectoryQuery>(
    restored?.query ?? { pageSize: 25, sort: "occurred_at_desc" },
  );
  const [page, setPage] = useState<AdminAuditDirectoryPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    writeFleetListState(storageKey, query, window.scrollY);
    client
      .listAuditResources(session.accessToken, query)
      .then((value) => {
        if (!active) return;
        setPage(value);
        window.requestAnimationFrame(() => {
          const saved =
            readFleetListState<AdminAuditDirectoryQuery>(storageKey);
          if (saved && saved.scrollY > 0) window.scrollTo(0, saved.scrollY);
        });
      })
      .catch((reason) => active && setError(messageFor(reason)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [client, query, session.accessToken, storageKey]);

  function update(next: AdminAuditDirectoryQuery) {
    const normalized = clearFleetCursor(next);
    setQuery(normalized);
    writeFleetListState(storageKey, normalized, 0);
  }

  function open(item: AdminAuditDirectoryPage["items"][number]) {
    writeFleetListState(storageKey, query, window.scrollY);
    onOpenAudit({ kind: item.kind, resourceId: item.resourceId });
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">跨域治理与技术调查</span>
          <h1>审计与系统</h1>
          <p>统一查看访问决策和业务状态变化；原始事件不可修改，调查操作不会改变领域业务状态。</p>
        </div>
      </section>
      <section className="operator-summary-grid" aria-label="审计与系统数据摘要">
        <article><strong>{page?.summary.totalResources ?? "—"}</strong><span>范围内资源</span></article>
        <article><strong>{page?.summary.deniedEvents ?? "—"}</strong><span>拒绝事件</span></article>
        <article><strong>{page?.summary.highRiskEvents ?? "—"}</strong><span>高风险事件</span></article>
        <article><strong>{page?.summary.openInvestigations ?? "—"}</strong><span>开放调查</span></article>
        <article><strong>{page?.summary.integrityWarnings ?? "—"}</strong><span>完整性告警</span></article>
      </section>
      <section className="task-panel">
        <div className="list-toolbar">
          <label>搜索审计资源<input aria-label="搜索审计资源" value={query.search ?? ""} placeholder="事件、资源、组织或关联编号" onChange={(event) => update(auditQueryWithSearch(query, event.target.value))} /></label>
          <label>资源类型<select aria-label="审计资源类型" value={query.kind ?? ""} onChange={(event) => update(auditQueryWithKind(query, event.target.value))}><option value="">全部</option><option value="event">原始事件</option><option value="investigation">调查案件</option></select></label>
          <label>业务域<select aria-label="审计业务域" value={query.domain ?? ""} onChange={(event) => update(auditQueryWithDomain(query, event.target.value))}><option value="">全部</option><option value="authentication">认证会话</option><option value="access">访问决策</option><option value="operator">运营主体</option><option value="driver_vehicle">车主与车辆</option><option value="trip">行程运营</option><option value="support_safety">客服与安全</option><option value="finance">财务与对账</option><option value="executive">高层驾驶舱</option><option value="audit_system">审计与系统</option></select></label>
          <label>结果／状态<select aria-label="审计结果状态" value={query.result ?? ""} onChange={(event) => update(auditQueryWithResult(query, event.target.value))}><option value="">全部</option><option value="succeeded">成功</option><option value="allowed">允许</option><option value="denied">拒绝</option><option value="open">开放</option><option value="in_review">调查中</option><option value="resolved">已解决</option></select></label>
          <label>排序<select aria-label="审计资源排序" value={query.sort ?? "occurred_at_desc"} onChange={(event) => update({ ...query, sort: event.target.value as NonNullable<AdminAuditDirectoryQuery["sort"]> })}><option value="occurred_at_desc">最近发生</option><option value="resource_id_asc">资源编号</option></select></label>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {loading ? <p className="list-state">正在加载审计资源…</p> : page?.items.length === 0 ? (
          <div className="list-state"><strong>没有符合条件的审计资源</strong><p>请调整搜索或筛选条件。</p></div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>资源</th><th>类型</th><th>业务域</th><th>组织</th><th>结果</th><th>发生时间</th></tr></thead>
              <tbody>
                {page?.items.map((item) => (
                  <tr key={`${item.kind}:${item.resourceId}`}>
                    <td><button className="table-link" onClick={() => open(item)}><strong>{item.title}</strong><span>{item.summary}</span></button></td>
                    <td>{item.kind === "event" ? "原始事件" : "调查案件"}</td>
                    <td>{auditDomainLabel(item.domain)}</td>
                    <td>{item.organizationName}</td>
                    <td><span className={`status-badge ${auditStatusTone(item.result)}`}>{auditStateLabel(item.result)}</span></td>
                    <td>{formatDate(item.occurredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination-bar">
          <span>共 {page?.pageInfo.approximateTotal ?? "—"} 条</span>
          <button disabled={!page?.pageInfo.hasPreviousPage} onClick={() => setQuery(auditCursorQuery(query, "before", page?.pageInfo.startCursor))}>上一页</button>
          <button disabled={!page?.pageInfo.hasNextPage} onClick={() => setQuery(auditCursorQuery(query, "after", page?.pageInfo.endCursor))}>下一页</button>
        </div>
      </section>
    </>
  );
}

function DataReportDirectory({
  session,
  client,
  onOpenReport,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  onOpenReport(reportId: string): void;
}>) {
  const storageKey =
    `${listStateStoragePrefix}.${session.workIdentity.workIdentityId}.reports`;
  const restoredState = useMemo(
    () => readFleetListState<AdminDataReportDirectoryQuery>(storageKey),
    [storageKey],
  );
  const [query, setQuery] = useState<AdminDataReportDirectoryQuery>(
    restoredState?.query ?? { pageSize: 25, sort: "refreshed_at_desc" },
  );
  const [page, setPage] = useState<AdminDataReportDirectoryPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    writeFleetListState(storageKey, query, window.scrollY);
    client.listDataReports(session.accessToken, query)
      .then((value) => {
        if (!active) return;
        setPage(value);
        window.requestAnimationFrame(() => {
          const saved =
            readFleetListState<AdminDataReportDirectoryQuery>(storageKey);
          if (saved && saved.scrollY > 0) window.scrollTo(0, saved.scrollY);
        });
      })
      .catch((reason) => active && setError(messageFor(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [client, query, session.accessToken, storageKey]);
  function update(next: AdminDataReportDirectoryQuery) {
    const { after: _after, before: _before, ...base } = next;
    setQuery(base);
    writeFleetListState(storageKey, base, 0);
  }
  function open(reportId: string) {
    writeFleetListState(storageKey, query, window.scrollY);
    onOpenReport(reportId);
  }
  return (
    <>
      <section className="page-heading">
        <div><span className="eyebrow">去标识聚合与统一口径</span><h1>数据与报表</h1><p>读取统一任务和审计事实源；不提供人员级明细、真实数据或直接导出。</p></div>
      </section>
      <section className="operator-summary-grid" aria-label="数据报表摘要">
        <SummaryMetric label="报表总数" value={page?.summary.totalReports} />
        <SummaryMetric label="就绪" value={page?.summary.readyReports} />
        <SummaryMetric label="部分可用" value={page?.summary.partialReports} />
        <SummaryMetric label="陈旧" value={page?.summary.staleReports} />
        <SummaryMetric label="指标数" value={page?.summary.totalMetrics} />
      </section>
      <section className="task-panel">
        <div className="task-toolbar">
          <label>搜索<input aria-label="搜索数据报表" value={query.search ?? ""} onChange={(event) => update(withDataReportSearch(query, event.target.value))} /></label>
          <label>业务域<select aria-label="报表业务域" value={query.domain ?? ""} onChange={(event) => update(withDataReportDomain(query, event.target.value))}><option value="">全部</option><option value="operations">运营</option><option value="finance">财务</option><option value="safety_compliance">安全合规</option><option value="audit">审计</option></select></label>
          <label>状态<select aria-label="报表状态" value={query.state ?? ""} onChange={(event) => update(withDataReportState(query, event.target.value))}><option value="">全部</option><option value="ready">就绪</option><option value="partial">部分可用</option><option value="stale">陈旧</option></select></label>
          <label>排序<select aria-label="报表排序" value={query.sort ?? "refreshed_at_desc"} onChange={(event) => update({ ...query, sort: event.target.value as NonNullable<AdminDataReportDirectoryQuery["sort"]> })}><option value="refreshed_at_desc">最近刷新</option><option value="report_id_asc">报表编号</option></select></label>
        </div>
        {loading ? <p role="status">正在加载数据报表…</p> : error ? <p role="alert" className="form-error">{error}</p> : page?.items.length ? (
          <div className="task-table-wrap"><table className="task-table"><thead><tr><th>报表</th><th>业务域</th><th>状态</th><th>指标</th><th>刷新时间</th></tr></thead><tbody>{page.items.map((item) => <tr key={item.reportId} onClick={() => open(item.reportId)}><td><button className="table-link" onClick={(event) => { event.stopPropagation(); open(item.reportId); }}>{item.title}<small>{item.summary}</small></button></td><td>{dataReportDomainLabel(item.domain)}</td><td><span className={`status-badge ${item.state === "ready" ? "success" : "warning"}`}>{item.state === "ready" ? "就绪" : item.state === "partial" ? "部分可用" : "陈旧"}</span></td><td>{item.metricCount}</td><td>{formatDate(item.refreshedAt)}</td></tr>)}</tbody></table></div>
        ) : <EmptyState title="没有符合条件的数据报表" description="调整搜索或筛选条件后重试。" />}
        {page ? <PaginationControls pageInfo={page.pageInfo} onPrevious={() => setQuery(dataReportCursor(query, "before", page.pageInfo.startCursor))} onNext={() => setQuery(dataReportCursor(query, "after", page.pageInfo.endCursor))} /> : null}
      </section>
    </>
  );
}

function MembershipDirectory({
  session,
  client,
  onOpenMembership,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  onOpenMembership(membershipId: string): void;
}>) {
  const storageKey =
    `${listStateStoragePrefix}.${session.workIdentity.workIdentityId}.memberships`;
  const restoredState = useMemo(
    () => readFleetListState<AdminMembershipDirectoryQuery>(storageKey),
    [storageKey],
  );
  const [query, setQuery] = useState<AdminMembershipDirectoryQuery>(
    restoredState?.query ?? { pageSize: 25, sort: "updated_at_desc" },
  );
  const [page, setPage] = useState<AdminMembershipDirectoryPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    writeFleetListState(storageKey, query, window.scrollY);
    client
      .listMemberships(session.accessToken, query)
      .then((value) => {
        if (!active) return;
        setPage(value);
        window.requestAnimationFrame(() => {
          const saved =
            readFleetListState<AdminMembershipDirectoryQuery>(storageKey);
          if (saved && saved.scrollY > 0) window.scrollTo(0, saved.scrollY);
        });
      })
      .catch((reason) => active && setError(messageFor(reason)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [client, query, session.accessToken, storageKey]);
  return (
    <>
      <header className="page-heading">
        <span className="eyebrow">成员治理</span>
        <h1>成员与权限</h1>
        <p>查看组织成员、工作角色和当前登录状态，并处理需要立即失效的成员访问。</p>
      </header>
      {page ? (
        <section className="summary-grid" aria-label="成员摘要">
          <article><span>成员</span><strong>{page.summary.totalMemberships}</strong></article>
          <article><span>正常</span><strong>{page.summary.activeMemberships}</strong></article>
          <article><span>已暂停</span><strong>{page.summary.suspendedMemberships}</strong></article>
          <article><span>活跃登录</span><strong>{page.summary.activeSessions}</strong></article>
        </section>
      ) : null}
      <section className="panel">
        <div className="filter-grid">
          <input
            aria-label="搜索成员"
            placeholder="搜索姓名、邮箱、组织或角色"
            value={query.search ?? ""}
            onChange={(event) =>
              setQuery(withMembershipSearch(query, event.target.value))}
          />
          <select
            aria-label="组织类型"
            value={query.organizationType ?? ""}
            onChange={(event) =>
              setQuery({
                ...withoutMembershipCursors(query),
                organizationType:
                  (event.target.value as "platform" | "operator") || undefined,
              })}
          >
            <option value="">全部组织</option>
            <option value="platform">平台</option>
            <option value="operator">运营公司</option>
          </select>
          <select
            aria-label="成员状态"
            value={query.state ?? ""}
            onChange={(event) =>
              setQuery({
                ...withoutMembershipCursors(query),
                state:
                  (event.target.value as "active" | "suspended") || undefined,
              })}
          >
            <option value="">全部状态</option>
            <option value="active">正常</option>
            <option value="suspended">已暂停</option>
          </select>
          <select
            aria-label="排序"
            value={query.sort ?? "updated_at_desc"}
            onChange={(event) =>
              setQuery({
                ...withoutMembershipCursors(query),
                sort: event.target.value as
                  | "updated_at_desc"
                  | "display_name_asc",
              })}
          >
            <option value="updated_at_desc">最近更新</option>
            <option value="display_name_asc">姓名排序</option>
          </select>
        </div>
        {loading ? <div className="empty-state"><h2>正在加载成员</h2></div> : null}
        {error ? <div className="empty-state"><h2>成员加载失败</h2><p>{error}</p></div> : null}
        {!loading && !error && page?.items.length === 0 ? (
          <div className="empty-state"><h2>没有符合条件的成员</h2></div>
        ) : null}
        {page?.items.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>成员</th><th>组织</th><th>角色</th><th>状态</th><th>活跃登录</th><th></th></tr></thead>
              <tbody>
                {page.items.map((item) => (
                  <tr key={item.membershipId}>
                    <td><strong>{item.displayName}</strong><small>{item.workEmailMasked}</small></td>
                    <td>{item.organizationName}</td>
                    <td>{item.productRoleName}</td>
                    <td>{membershipStateLabel(item.state)}</td>
                    <td>{item.activeSessionCount}</td>
                    <td><button onClick={() => {
                      writeFleetListState(storageKey, query, window.scrollY);
                      onOpenMembership(item.membershipId);
                    }}>查看详情</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="pagination">
          <button disabled={!page?.pageInfo.hasPreviousPage} onClick={() => setQuery(membershipCursor(query, "before", page?.pageInfo.startCursor))}>上一页</button>
          <button disabled={!page?.pageInfo.hasNextPage} onClick={() => setQuery(membershipCursor(query, "after", page?.pageInfo.endCursor))}>下一页</button>
        </div>
      </section>
    </>
  );
}

function MembershipDetail({
  session,
  client,
  membershipId,
  onBack,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  membershipId: string;
  onBack(): void;
}>) {
  const [detail, setDetail] = useState<AdminMembershipDetail>();
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    setDetail(undefined);
    setError(undefined);
    client
      .getMembership(session.accessToken, membershipId)
      .then(setDetail)
      .catch((reason) => setError(messageFor(reason)));
  }, [client, membershipId, session.accessToken]);
  async function perform(action: AdminMembershipAction) {
    if (!detail) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const next = await client.performMembershipAction(
        session.accessToken,
        membershipId,
        {
          action,
          expectedVersion: detail.item.resourceVersion,
          idempotencyKey: crypto.randomUUID(),
          reasonCode: action === "suspend_membership"
            ? "access_risk_control"
            : "access_restored",
        },
      );
      setDetail(next.detail);
      setResult(
        action === "suspend_membership"
          ? "成员已暂停，现有登录状态已失效。"
          : "成员已恢复，可重新登录。",
      );
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setSubmitting(false);
    }
  }
  if (error && !detail) return <div className="empty-state"><h2>成员详情加载失败</h2><p>{error}</p></div>;
  if (!detail) return <div className="empty-state"><h2>正在加载成员详情</h2></div>;
  return (
    <>
      <button className="back-link" onClick={onBack}>返回成员列表</button>
      <header className="page-heading"><span className="eyebrow">成员详情</span><h1>{detail.item.displayName}</h1><p>{detail.item.organizationName} · {detail.item.productRoleName}</p></header>
      {result ? <div className="result-banner">{result}</div> : null}
      {error ? <div className="form-error"><strong>操作未完成</strong><p>{error}</p></div> : null}
      <section className="detail-grid">
        <article className="panel">
          <h2>成员身份</h2>
          <dl className="detail-list">
            <div><dt>工作邮箱</dt><dd>{detail.item.workEmailMasked}</dd></div>
            <div><dt>当前状态</dt><dd>{membershipStateLabel(detail.item.state)}</dd></div>
            <div><dt>所属组织</dt><dd>{detail.item.organizationName}</dd></div>
            <div><dt>城市范围</dt><dd>{detail.scopeBindings.cityScopes.join("、")}</dd></div>
            <div><dt>活跃登录</dt><dd>{detail.item.activeSessionCount}</dd></div>
          </dl>
        </article>
        <article className="panel">
          <h2>角色与操作</h2>
          <p>{detail.roleBinding.roleName}</p>
          {detail.allowedActions.includes("suspend_membership") ? (
            <button disabled={submitting} onClick={() => perform("suspend_membership")}>暂停成员</button>
          ) : null}
          {detail.allowedActions.includes("restore_membership") ? (
            <button disabled={submitting} onClick={() => perform("restore_membership")}>恢复成员</button>
          ) : null}
          {detail.allowedActions.length === 0 ? <p>当前角色仅可查看。</p> : null}
          {detail.allowedActions.includes("suspend_membership") ? (
            <p>暂停后，该成员现有登录状态会立即失效；恢复后需要重新登录。</p>
          ) : null}
        </article>
      </section>
      <section className="panel">
        <h2>操作记录</h2>
        {detail.auditTrail.length === 0 ? <p>暂无操作记录。</p> : (
          <ol className="timeline">
            {detail.auditTrail.map((event) => (
              <li key={event.eventId}>
                <strong>{membershipAuditLabel(event.action)}</strong>
                <span>{event.actorLabel} · {formatDate(event.occurredAt)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function DataReportDetail({
  session,
  client,
  reportId,
  onBack,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  reportId: string;
  onBack(): void;
}>) {
  const [detail, setDetail] = useState<AdminDataReportDetail>();
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string>();
  const [reasonCode, setReasonCode] = useState("scheduled_aggregate_refresh");
  useEffect(() => {
    let active = true;
    client.getDataReport(session.accessToken, reportId)
      .then((value) => active && setDetail(value))
      .catch((reason) => active && setError(messageFor(reason)));
    return () => { active = false; };
  }, [client, reportId, session.accessToken]);
  async function perform(action: AdminDataReportAction) {
    if (!detail) return;
    setConfirming(true);
    setError(undefined);
    setResult("正在确认报表刷新结果…");
    try {
      const next = await client.performDataReportAction(
        session.accessToken,
        reportId,
        {
          action,
          idempotencyKey: operationIdentifier("data-report", reportId),
          expectedVersion: detail.item.resourceVersion,
          reasonCode,
        },
      );
      setDetail(next.detail);
      setResult(`报表刷新已确认：${next.operationId}`);
    } catch (reason) {
      setError(messageFor(reason));
      setResult(undefined);
    } finally {
      setConfirming(false);
    }
  }
  if (!detail && !error) return <p role="status">正在加载报表详情…</p>;
  if (!detail) return <EmptyState title="无法加载报表详情" description={error ?? "未知错误"} actionLabel="返回报表列表" onAction={onBack} />;
  return (
    <>
      <button className="back-link" onClick={onBack}>← 返回报表列表</button>
      <section className="page-heading"><div><span className="eyebrow">{dataReportDomainLabel(detail.item.domain)}</span><h1>{detail.item.title}</h1><p>{detail.item.summary}</p></div><span className={`status-badge ${detail.item.state === "ready" ? "success" : "warning"}`}>{detail.item.state === "ready" ? "就绪" : detail.item.state === "partial" ? "部分可用" : "陈旧"}</span></section>
      <section className="operator-summary-grid" aria-label="报表指标">{detail.metrics.map((metric) => <SummaryMetric key={metric.metricId} label={metric.label} value={metric.displayValue} />)}</section>
      <section className="detail-card"><h2>数据边界</h2><p>仅去标识聚合；不提供人员级数据、真实数据或导出能力。</p></section>
      <section className="detail-card"><h2>当前角色允许操作</h2>{detail.allowedActions.length === 0 ? <p>当前角色仅可查看。</p> : <div className="action-form"><label>刷新原因<input aria-label="报表刷新原因" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} /></label><div className="action-row">{detail.allowedActions.map((action) => <button key={action} className="primary-action" disabled={confirming} onClick={() => void perform(action)}>刷新报表快照</button>)}</div></div>}{result ? <p role="status" className="success-message">{result}</p> : null}{error ? <p role="alert" className="form-error">{error}</p> : null}</section>
      <section className="detail-card"><h2>追加式审计</h2><ol className="audit-list">{detail.auditTrail.map((event) => <li key={event.eventId}><strong>{event.action === "data_report_refreshed" ? "报表已刷新" : "报表已查看"}</strong><span>{event.actorLabel} · {event.actorRole} · {formatDate(event.occurredAt)}</span>{event.reasonCode ? <p>{event.reasonCode}</p> : null}</li>)}</ol></section>
    </>
  );
}

function AuditDetail({
  session,
  client,
  auditRoute,
  onBack,
  onOpenInvestigation,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  auditRoute: NonNullable<AdminRoute["audit"]>;
  onBack(): void;
  onOpenInvestigation(resourceId: string): void;
}>) {
  const [detail, setDetail] = useState<AdminAuditDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [reasonCode, setReasonCode] = useState("controlled_audit_review");
  const [note, setNote] = useState("已核对合成审计证据和关联编号");
  const [assignee, setAssignee] = useState("synthetic-technical-ops-001");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    client
      .getAuditResource(
        session.accessToken,
        auditRoute.kind,
        auditRoute.resourceId,
      )
      .then((value) => active && setDetail(value))
      .catch((reason) => active && setError(messageFor(reason)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [auditRoute.kind, auditRoute.resourceId, client, session.accessToken]);

  async function perform(action: AdminAuditAction) {
    if (!detail || confirming) return;
    setConfirming(true);
    setError(undefined);
    setResult("结果确认中");
    try {
      const next = await client.performAuditAction(
        session.accessToken,
        detail.kind,
        detail.item.resourceId,
        {
          action,
          expectedVersion: detail.item.resourceVersion,
          idempotencyKey: crypto.randomUUID(),
          reasonCode,
          ...(action === "add_investigation_note" ? { note } : {}),
          ...(action === "assign_investigation"
            ? { assigneeWorkIdentityId: assignee }
            : {}),
        },
      );
      setDetail(next.detail);
      setResult(`操作已确认：${auditSystemActionLabel(action)}`);
      if (action === "open_investigation") {
        onOpenInvestigation(next.detail.item.resourceId);
      }
    } catch (reason) {
      setError(messageFor(reason));
      setResult(undefined);
    } finally {
      setConfirming(false);
    }
  }

  if (loading) return <p className="list-state">正在加载审计详情…</p>;
  if (error && !detail) return <div className="list-state"><strong>无法加载审计详情</strong><p>{error}</p><button onClick={onBack}>返回审计名录</button></div>;
  if (!detail) return null;
  return (
    <>
      <button className="back-action" onClick={onBack}>← 返回审计名录</button>
      <section className="page-heading">
        <div><span className="eyebrow">{detail.kind === "event" ? "不可修改的原始事件" : "受控技术调查"}</span><h1>{detail.item.title}</h1><p>{detail.item.summary}</p></div>
        <span className={`status-badge ${auditStatusTone(detail.item.result)}`}>{auditStateLabel(detail.item.result)}</span>
      </section>
      <p className="boundary-notice">只显示脱敏审计元数据；原始事件不可覆盖、不可删除，调查操作不能改变领域业务状态。</p>
      <section className="detail-grid">
        <article className="detail-card">
          <h2>资源详情</h2>
          {detail.kind === "event" ? (
            <dl className="detail-list">
              <div><dt>事件类型</dt><dd>{detail.record.event.eventType}</dd></div>
              <div><dt>结果</dt><dd>{auditStateLabel(detail.record.event.result)}</dd></div>
              <div><dt>组织</dt><dd>{detail.item.organizationName}</dd></div>
              <div><dt>操作者</dt><dd>{detail.record.event.actorInternalUserId}</dd></div>
              <div><dt>资源</dt><dd>{detail.record.event.resourceType ?? "—"} / {detail.record.event.resourceId ?? "—"}</dd></div>
              <div><dt>请求关联编号</dt><dd>{detail.record.event.correlationId}</dd></div>
              <div><dt>访问决策编号</dt><dd>{detail.record.event.accessDecisionId ?? "—"}</dd></div>
              <div><dt>关联调查</dt><dd>{detail.record.linkedInvestigationId ?? "未创建"}</dd></div>
            </dl>
          ) : (
            <dl className="detail-list">
              <div><dt>来源事件</dt><dd>{detail.record.sourceEventId}</dd></div>
              <div><dt>调查状态</dt><dd>{auditStateLabel(detail.record.state)}</dd></div>
              <div><dt>原因代码</dt><dd>{detail.record.reasonCode}</dd></div>
              <div><dt>负责人</dt><dd>{detail.record.assigneeWorkIdentityId ?? "待分派"}</dd></div>
              <div><dt>资源版本</dt><dd>{detail.record.resourceVersion}</dd></div>
              <div><dt>调查记录</dt><dd>{detail.record.notes.length} 条</dd></div>
            </dl>
          )}
        </article>
        <article className="detail-card">
          <h2>完整性证明</h2>
          <dl className="detail-list">
            <div><dt>规范载荷摘要</dt><dd><code>{detail.integrity.canonicalPayloadDigest}</code></dd></div>
            <div><dt>前序事件摘要</dt><dd><code>{detail.integrity.previousEventDigest ?? "首条或不适用"}</code></dd></div>
            <div><dt>追加式存储</dt><dd>是</dd></div>
            <div><dt>原始敏感载荷</dt><dd>不可用</dd></div>
          </dl>
        </article>
      </section>
      <section className="detail-card">
        <h2>当前角色允许操作</h2>
        {detail.allowedActions.length === 0 ? <p>当前角色在此状态下仅可查看。</p> : (
          <div className="action-form">
            <label>操作原因<input aria-label="审计操作原因" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} /></label>
            {detail.allowedActions.includes("assign_investigation") ? <label>技术负责人<input aria-label="审计调查负责人" value={assignee} onChange={(event) => setAssignee(event.target.value)} /></label> : null}
            {detail.allowedActions.includes("add_investigation_note") ? <label>调查记录<textarea aria-label="审计调查记录" value={note} onChange={(event) => setNote(event.target.value)} /></label> : null}
            <div className="action-row">{detail.allowedActions.map((action) => <button key={action} className="primary-action" disabled={confirming} onClick={() => void perform(action)}>{auditSystemActionLabel(action)}</button>)}</div>
          </div>
        )}
        {result ? <p role="status" className="success-message">{result}</p> : null}
        {error ? <p role="alert" className="form-error">{error}</p> : null}
      </section>
      {detail.kind === "investigation" && detail.record.notes.length > 0 ? (
        <section className="detail-card"><h2>调查记录</h2><ol className="audit-list">{detail.record.notes.map((entry) => <li key={entry.noteId}><strong>{entry.authorWorkIdentityId}</strong><span>{formatDate(entry.occurredAt)}</span><p>{entry.content}</p></li>)}</ol></section>
      ) : null}
      <section className="detail-card">
        <h2>追加式审计</h2>
        <ol className="audit-list">{detail.auditTrail.map((event) => <li key={event.eventId}><strong>{auditTrailActionLabel(event.action)}</strong><span>{event.actorLabel} · {event.actorRole} · {formatDate(event.occurredAt)}</span>{event.note ? <p>{event.note}</p> : null}</li>)}</ol>
      </section>
    </>
  );
}

function ExecutiveDirectory({
  session,
  client,
  onOpenExecutive,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  onOpenExecutive(executive: NonNullable<AdminRoute["executive"]>): void;
}>) {
  const storageKey =
    `${listStateStoragePrefix}.${session.workIdentity.workIdentityId}.executive`;
  const restoredState = useMemo(
    () => readFleetListState<AdminExecutiveDirectoryQuery>(storageKey),
    [storageKey],
  );
  const [query, setQuery] = useState<AdminExecutiveDirectoryQuery>(
    restoredState?.query ?? { pageSize: 25, sort: "updated_at_desc" },
  );
  const [page, setPage] = useState<AdminExecutiveDirectoryPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [showExportForm, setShowExportForm] = useState(false);
  const [exportPurpose, setExportPurpose] = useState("内部经营复盘");
  const [exportDomain, setExportDomain] =
    useState<"operations" | "finance" | "safety_compliance">("operations");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    writeFleetListState(storageKey, query, window.scrollY);
    client
      .listExecutiveResources(session.accessToken, query)
      .then((value) => {
        if (!active) return;
        setPage(value);
        window.requestAnimationFrame(() => {
          const saved =
            readFleetListState<AdminExecutiveDirectoryQuery>(storageKey);
          if (saved && saved.scrollY > 0) window.scrollTo(0, saved.scrollY);
        });
      })
      .catch((reason) => active && setError(messageFor(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [client, query, session.accessToken, storageKey]);

  function update(next: AdminExecutiveDirectoryQuery) {
    const normalized = clearFleetCursor(next);
    setQuery(normalized);
    writeFleetListState(storageKey, normalized, 0);
  }

  function openExecutive(
    kind: NonNullable<AdminRoute["executive"]>["kind"],
    resourceId: string,
  ) {
    writeFleetListState(storageKey, query, window.scrollY);
    onOpenExecutive({ kind, resourceId });
  }

  async function createExport() {
    setCreating(true);
    setError(undefined);
    setNotice("正在确认导出申请结果…");
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60_000);
      const result = await client.performExecutiveAction(
        session.accessToken,
        "export_request",
        "new",
        {
          action: "create_export_request",
          idempotencyKey: operationIdentifier("executive-export", exportDomain),
          domain: exportDomain,
          purpose: exportPurpose,
          fieldSet: executiveExportFields(exportDomain),
          windowStart: start.toISOString(),
          windowEnd: end.toISOString(),
        },
      );
      setNotice(`导出申请已确认：${result.detail.item.resourceId}`);
      setShowExportForm(false);
      openExecutive("export_request", result.detail.item.resourceId);
    } catch (reason) {
      setError(messageFor(reason));
      setNotice(undefined);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">合成经营聚合与治理协作</span>
          <h1>高层驾驶舱</h1>
          <p>查看经营健康、指标口径和待决事项；仅记录治理意见与受控导出，不直接批准领域业务。</p>
        </div>
        <button
          className="primary-action"
          onClick={() => setShowExportForm((value) => !value)}
        >
          申请受控导出
        </button>
      </section>
      <section className="operator-summary-grid" aria-label="高层驾驶舱数据摘要">
        <SummaryMetric label="范围内资源" value={page?.summary.totalResources} />
        <SummaryMetric label="开放待决事项" value={page?.summary.openDecisionItems} />
        <SummaryMetric label="阻断运营主体" value={page?.summary.blockingOperators} />
        <SummaryMetric label="等待导出复核" value={page?.summary.exportsAwaitingReview} />
        <SummaryMetric label="不可用指标" value={page?.summary.unavailableMetrics} />
        <SummaryMetric label="页面状态" value={page ? executiveStateLabel(page.summary.pageState) : undefined} />
      </section>
      {page?.headlineMetrics.length ? (
        <section className="operator-summary-grid" aria-label="经营核心指标">
          {page.headlineMetrics.map((metric) => (
            <SummaryMetric
              key={metric.metricId}
              label={metric.label}
              value={metric.displayValue}
            />
          ))}
        </section>
      ) : null}
      {page?.notices.map((item) => (
        <p className="detail-warning" key={item}>{item}</p>
      ))}
      {showExportForm ? (
        <section className="task-panel">
          <h2>新建受控导出申请</h2>
          <div className="list-toolbar">
            <label>
              职责域
              <select
                aria-label="导出职责域"
                value={exportDomain}
                onChange={(event) =>
                  setExportDomain(event.target.value as typeof exportDomain)}
              >
                <option value="operations">运营</option>
                <option value="finance">财务</option>
                <option value="safety_compliance">安全合规</option>
              </select>
            </label>
            <label>
              导出目的
              <input
                aria-label="导出目的"
                value={exportPurpose}
                onChange={(event) => setExportPurpose(event.target.value)}
              />
            </label>
          </div>
          <button
            className="primary-action"
            disabled={creating || !exportPurpose.trim()}
            onClick={() => void createExport()}
          >
            {creating ? "结果确认中…" : "提交导出申请"}
          </button>
        </section>
      ) : null}
      {notice ? <p className="success-banner" role="status">{notice}</p> : null}
      <section className="task-panel">
        <div className="list-toolbar">
          <label>
            搜索驾驶舱资源
            <input
              aria-label="搜索驾驶舱资源"
              placeholder="事项、运营公司、指标或导出用途"
              value={query.search ?? ""}
              onChange={(event) =>
                update(fleetQueryWithSearch(query, event.target.value))}
            />
          </label>
          <label>
            资源类型
            <select
              aria-label="驾驶舱资源类型"
              value={query.kind ?? ""}
              onChange={(event) => {
                const { kind: _kind, ...rest } = query;
                update(event.target.value
                  ? {
                      ...rest,
                      kind: event.target.value as NonNullable<
                        AdminExecutiveDirectoryQuery["kind"]
                      >,
                    }
                  : rest);
              }}
            >
              <option value="">全部</option>
              <option value="decision_item">待决事项</option>
              <option value="export_request">受控导出</option>
              <option value="operator_health">运营主体健康</option>
              <option value="metric">指标口径</option>
            </select>
          </label>
          <label>
            职责域
            <select
              aria-label="驾驶舱职责域"
              value={query.domain ?? ""}
              onChange={(event) => {
                const { domain: _domain, ...rest } = query;
                update(event.target.value
                  ? {
                      ...rest,
                      domain: event.target.value as NonNullable<
                        AdminExecutiveDirectoryQuery["domain"]
                      >,
                    }
                  : rest);
              }}
            >
              <option value="">全部</option>
              <option value="operations">运营</option>
              <option value="finance">财务</option>
              <option value="safety_compliance">安全合规</option>
            </select>
          </label>
          <label>
            控制状态
            <select
              aria-label="驾驶舱阻断状态"
              value={query.blocking === undefined ? "" : String(query.blocking)}
              onChange={(event) => {
                const { blocking: _blocking, ...rest } = query;
                update(event.target.value
                  ? { ...rest, blocking: event.target.value === "true" }
                  : rest);
              }}
            >
              <option value="">全部</option>
              <option value="true">仅阻断项</option>
              <option value="false">仅非阻断项</option>
            </select>
          </label>
          <label>
            排序
            <select
              aria-label="驾驶舱资源排序"
              value={query.sort ?? "updated_at_desc"}
              onChange={(event) =>
                update({
                  ...query,
                  sort: event.target.value as NonNullable<
                    AdminExecutiveDirectoryQuery["sort"]
                  >,
                })}
            >
              <option value="updated_at_desc">最近更新</option>
              <option value="resource_id_asc">资源编号</option>
            </select>
          </label>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {loading ? (
          <p className="list-state">正在加载驾驶舱资源…</p>
        ) : page?.items.length === 0 ? (
          <div className="list-state">
            <strong>没有符合条件的驾驶舱资源</strong>
            <p>请调整搜索或筛选条件后重试。</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>资源</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>职责域</th>
                  <th>控制状态</th>
                  <th>最近更新</th>
                </tr>
              </thead>
              <tbody>
                {page?.items.map((item) => (
                  <tr key={`${item.kind}-${item.resourceId}`}>
                    <td>
                      <button
                        className="task-link"
                        onClick={() =>
                          openExecutive(item.kind, item.resourceId)}
                      >
                        <strong>{item.title}</strong>
                        <small>{item.summary}</small>
                      </button>
                    </td>
                    <td>{executiveKindLabel(item.kind)}</td>
                    <td><span className={`status-pill ${executiveStatusTone(item.state)}`}>{executiveStateLabel(item.state)}</span></td>
                    <td>{item.domain ? executiveDomainName(item.domain) : "跨域"}</td>
                    <td>{item.blocking ? "存在阻断" : "无阻断"}</td>
                    <td>{formatDate(item.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {page ? (
          <PaginationControls
            pageInfo={page.pageInfo}
            onPrevious={() =>
              setQuery(fleetCursorQuery(
                query,
                "before",
                page.pageInfo.startCursor,
              ))}
            onNext={() =>
              setQuery(fleetCursorQuery(
                query,
                "after",
                page.pageInfo.endCursor,
              ))}
          />
        ) : null}
      </section>
    </>
  );
}

function ExecutiveDetail({
  session,
  client,
  executiveRoute,
  onBack,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  executiveRoute: NonNullable<AdminRoute["executive"]>;
  onBack(): void;
}>) {
  const [detail, setDetail] = useState<AdminExecutiveDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busyAction, setBusyAction] = useState<AdminExecutiveAction>();
  const [reasonCode, setReasonCode] = useState("executive_governance_review");
  const [decisionCode, setDecisionCode] =
    useState("continue_controlled_review");
  const [responsibleRole, setResponsibleRole] = useState("operations_lead");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    client
      .getExecutiveResource(
        session.accessToken,
        executiveRoute.kind,
        executiveRoute.resourceId,
      )
      .then((value) => active && setDetail(value))
      .catch((reason) => active && setError(messageFor(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [
    client,
    executiveRoute.kind,
    executiveRoute.resourceId,
    session.accessToken,
  ]);

  async function perform(action: AdminExecutiveAction) {
    if (!detail) return;
    setBusyAction(action);
    setError(undefined);
    setNotice("正在确认操作结果…");
    try {
      const result = await client.performExecutiveAction(
        session.accessToken,
        detail.kind,
        detail.item.resourceId,
        {
          action,
          idempotencyKey: operationIdentifier(detail.item.resourceId, action),
          expectedVersion: detail.item.resourceVersion,
          reasonCode,
          ...(action === "record_decision_opinion"
            ? {
                decisionCode,
                responsibleRole,
                dueAt: new Date(
                  Date.now() + 7 * 24 * 60 * 60_000,
                ).toISOString(),
              }
            : {}),
        },
      );
      setDetail(result.detail);
      setNotice(`操作已确认：${executiveActionLabel(action)}`);
      if (result.download) downloadExecutiveFile(result.download);
    } catch (reason) {
      setError(messageFor(reason));
      setNotice(undefined);
    } finally {
      setBusyAction(undefined);
    }
  }

  if (loading) return <p className="list-state">正在加载驾驶舱详情…</p>;
  if (error && !detail) {
    return (
      <section className="list-state">
        <strong>驾驶舱详情加载失败</strong>
        <p role="alert">{error}</p>
        <button onClick={onBack}>返回驾驶舱名录</button>
      </section>
    );
  }
  if (!detail) return <p className="list-state">未找到驾驶舱资源。</p>;

  return (
    <>
      <button className="back-link" onClick={onBack}>← 返回驾驶舱名录</button>
      <section className="page-heading">
        <div>
          <span className="eyebrow">{executiveKindLabel(detail.kind)}</span>
          <h1>{detail.item.title}</h1>
          <p>{detail.item.summary}</p>
        </div>
        <span className={`status-pill ${executiveStatusTone(detail.item.state)}`}>
          {executiveStateLabel(detail.item.state)}
        </span>
      </section>
      <p className="detail-warning">
        当前页面仅使用合成聚合数据；禁止人员级钻取，也不能直接改变领域业务状态。
      </p>
      <section className="detail-grid">
        <article className="detail-card">
          <h2>资源详情</h2>
          <ExecutiveRecord detail={detail} />
        </article>
        <article className="detail-card">
          <h2>当前角色允许操作</h2>
          {detail.allowedActions.length === 0 ? (
            <p>当前角色在此状态下仅可查看。</p>
          ) : (
            <>
              {detail.allowedActions.includes("record_decision_opinion") ? (
                <div className="list-toolbar">
                  <label>
                    判断代码
                    <input
                      aria-label="高层判断代码"
                      value={decisionCode}
                      onChange={(event) => setDecisionCode(event.target.value)}
                    />
                  </label>
                  <label>
                    后续责任角色
                    <input
                      aria-label="高层意见责任角色"
                      value={responsibleRole}
                      onChange={(event) =>
                        setResponsibleRole(event.target.value)}
                    />
                  </label>
                </div>
              ) : null}
              <label>
                操作原因
                <input
                  aria-label="驾驶舱操作原因"
                  value={reasonCode}
                  onChange={(event) => setReasonCode(event.target.value)}
                />
              </label>
              <div className="detail-actions">
                {detail.allowedActions.map((action) => (
                  <button
                    key={action}
                    disabled={Boolean(busyAction)}
                    onClick={() => void perform(action)}
                  >
                    {busyAction === action
                      ? "结果确认中…"
                      : executiveActionLabel(action)}
                  </button>
                ))}
              </div>
            </>
          )}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {notice ? <p className="success-banner" role="status">{notice}</p> : null}
        </article>
        <article className="detail-card">
          <h2>追加式审计</h2>
          {detail.auditTrail.length ? (
            <ol className="audit-list">
              {detail.auditTrail.map((event) => (
                <li key={event.eventId}>
                  <strong>{executiveAuditLabel(event.action)}</strong>
                  <span>{event.actorLabel} · {event.actorRole}</span>
                  <small>{formatDate(event.occurredAt)}{event.reasonCode ? ` · ${event.reasonCode}` : ""}</small>
                </li>
              ))}
            </ol>
          ) : <p>尚无驾驶舱审计记录。</p>}
        </article>
      </section>
    </>
  );
}

function ExecutiveRecord({
  detail,
}: Readonly<{ detail: AdminExecutiveDetail }>) {
  if (detail.kind === "decision_item") {
    return (
      <>
        <dl className="detail-list">
          <div><dt>职责域</dt><dd>{executiveDomainName(detail.record.domain)}</dd></div>
          <div><dt>责任角色</dt><dd>{detail.record.responsibleRole}</dd></div>
          <div><dt>要求完成时间</dt><dd>{formatDate(detail.record.dueAt)}</dd></div>
          <div><dt>来源工作台</dt><dd>{detail.record.sourceWorkspace}</dd></div>
          <div><dt>直接批准</dt><dd>{detail.record.directApprovalAllowed ? "允许" : "禁止"}</dd></div>
        </dl>
        <h3>已记录意见</h3>
        {detail.record.opinions.length ? (
          <ol className="audit-list">
            {detail.record.opinions.map((opinion) => (
              <li key={opinion.opinionId}>
                <strong>{opinion.decisionCode}</strong>
                <span>{opinion.reasonCode} · {opinion.responsibleRole}</span>
                <small>{formatDate(opinion.recordedAt)}</small>
              </li>
            ))}
          </ol>
        ) : <p>尚未记录高层治理意见。</p>}
      </>
    );
  }
  if (detail.kind === "export_request") {
    return (
      <dl className="detail-list">
        <div><dt>职责域</dt><dd>{executiveDomainName(detail.record.domain)}</dd></div>
        <div><dt>申请组织</dt><dd>{detail.record.organizationName}</dd></div>
        <div><dt>用途</dt><dd>{detail.record.purpose}</dd></div>
        <div><dt>字段集合</dt><dd>{detail.record.fieldSet.join("、")}</dd></div>
        <div><dt>时间窗口</dt><dd>{formatDate(detail.record.windowStart)} — {formatDate(detail.record.windowEnd)}</dd></div>
        <div><dt>加密存储</dt><dd>{detail.record.encryptedAtRest ? "是" : "否"}</dd></div>
        <div><dt>单次下载</dt><dd>{detail.record.singleUse ? "是" : "否"}</dd></div>
        <div><dt>有效期</dt><dd>{detail.record.expiresAt ? formatDate(detail.record.expiresAt) : "待批准"}</dd></div>
      </dl>
    );
  }
  if (detail.kind === "operator_health") {
    return (
      <dl className="detail-list">
        <div><dt>运营主体</dt><dd>{detail.record.operatorName}</dd></div>
        <div><dt>综合健康度</dt><dd>{executiveStateLabel(detail.record.health)}</dd></div>
        <div><dt>服务</dt><dd>{executiveStateLabel(detail.record.dimensions.service)}</dd></div>
        <div><dt>财务</dt><dd>{executiveStateLabel(detail.record.dimensions.finance)}</dd></div>
        <div><dt>安全</dt><dd>{executiveStateLabel(detail.record.dimensions.safety)}</dd></div>
        <div><dt>合规</dt><dd>{executiveStateLabel(detail.record.dimensions.compliance)}</dd></div>
        <div><dt>触发原因</dt><dd>{detail.record.triggerReasons.join("、") || "无"}</dd></div>
      </dl>
    );
  }
  return (
    <dl className="detail-list">
      <div><dt>指标版本</dt><dd>{detail.record.definition.metricVersion}</dd></div>
      <div><dt>定义</dt><dd>{detail.record.definition.definition}</dd></div>
      <div><dt>权威来源</dt><dd>{detail.record.definition.source}</dd></div>
      <div><dt>新鲜度目标</dt><dd>{detail.record.definition.freshnessTarget}</dd></div>
      <div><dt>要求关账</dt><dd>{detail.record.definition.closeRequired ? "是" : "否"}</dd></div>
      <div><dt>允许维度</dt><dd>{detail.record.definition.allowedDimensions.join("、")}</dd></div>
      <div><dt>当前快照</dt><dd>{detail.record.snapshot?.displayValue ?? "当前角色仅可查看指标口径"}</dd></div>
    </dl>
  );
}

function CaseDirectory({
  session,
  client,
  onOpenCase,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  onOpenCase(caseRoute: NonNullable<AdminRoute["case"]>): void;
}>) {
  const storageKey =
    `${listStateStoragePrefix}.${session.workIdentity.workIdentityId}.cases`;
  const restoredState = useMemo(
    () => readFleetListState<AdminCaseDirectoryQuery>(storageKey),
    [storageKey],
  );
  const [query, setQuery] = useState<AdminCaseDirectoryQuery>(
    restoredState?.query ?? { pageSize: 25, sort: "updated_at_desc" },
  );
  const [page, setPage] = useState<AdminCaseDirectoryPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    writeFleetListState(storageKey, query, window.scrollY);
    client
      .listCases(session.accessToken, query)
      .then((value) => {
        if (!active) return;
        setPage(value);
        window.requestAnimationFrame(() => {
          const saved =
            readFleetListState<AdminCaseDirectoryQuery>(storageKey);
          if (saved && saved.scrollY > 0) window.scrollTo(0, saved.scrollY);
        });
      })
      .catch((reason) => active && setError(messageFor(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [client, query, session.accessToken, storageKey]);

  function update(next: AdminCaseDirectoryQuery) {
    const normalized = clearFleetCursor(next);
    setQuery(normalized);
    writeFleetListState(storageKey, normalized, 0);
  }

  function openCase(kind: "support" | "safety", caseId: string) {
    writeFleetListState(storageKey, query, window.scrollY);
    onOpenCase({ kind, caseId });
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">客户协助与风险处置</span>
          <h1>客服与安全案件</h1>
          <p>按当前职责处理客户问题和安全调查，敏感证据仅在授权后开放。</p>
        </div>
      </section>
      <section className="operator-summary-grid" aria-label="客服与安全数据摘要">
        <SummaryMetric label="范围内案件" value={page?.summary.totalCases} />
        <SummaryMetric label="客服案件" value={page?.summary.supportCases} />
        <SummaryMetric label="安全案件" value={page?.summary.safetyCases} />
        <SummaryMetric label="处理中" value={page?.summary.activeCases} />
        <SummaryMetric
          label="等待独立复核"
          value={page?.summary.awaitingIndependentReviewCases}
        />
      </section>
      <section className="task-panel">
        <div className="list-toolbar">
          <label>
            搜索案件
            <input
              aria-label="搜索案件"
              placeholder="案件编号、行程或摘要"
              value={query.search ?? ""}
              onChange={(event) =>
                update(fleetQueryWithSearch(query, event.target.value))}
            />
          </label>
          <label>
            案件类型
            <select
              aria-label="案件类型"
              value={query.kind ?? ""}
              onChange={(event) => {
                const { kind: _kind, supportState: _support, safetyState: _safety, ...rest } = query;
                update(event.target.value
                  ? {
                      ...rest,
                      kind: event.target.value as "support" | "safety",
                    }
                  : rest);
              }}
            >
              <option value="">全部</option>
              <option value="support">客服案件</option>
              <option value="safety">安全案件</option>
            </select>
          </label>
          <label>
            客服状态
            <select
              aria-label="客服案件状态"
              value={query.supportState ?? ""}
              onChange={(event) => {
                const { supportState: _state, ...rest } = query;
                update(event.target.value
                  ? {
                      ...rest,
                      supportState: event.target.value as NonNullable<
                        AdminCaseDirectoryQuery["supportState"]
                      >,
                    }
                  : rest);
              }}
            >
              <option value="">全部</option>
              <option value="open">待处理</option>
              <option value="investigating">调查中</option>
              <option value="awaiting_user">等待客户</option>
              <option value="awaiting_internal">等待内部协作</option>
              <option value="escalated">已升级</option>
              <option value="resolved">已解决</option>
              <option value="closed">已关闭</option>
            </select>
          </label>
          <label>
            安全调查状态
            <select
              aria-label="安全调查状态"
              value={query.safetyState ?? ""}
              onChange={(event) => {
                const { safetyState: _state, ...rest } = query;
                update(event.target.value
                  ? {
                      ...rest,
                      safetyState: event.target.value as NonNullable<
                        AdminCaseDirectoryQuery["safetyState"]
                      >,
                    }
                  : rest);
              }}
            >
              <option value="">全部</option>
              <option value="investigating">调查中</option>
              <option value="awaiting_independent_review">等待独立复核</option>
              <option value="completed">已完成</option>
            </select>
          </label>
          <label>
            排序
            <select
              aria-label="案件排序"
              value={query.sort ?? "updated_at_desc"}
              onChange={(event) =>
                update({
                  ...query,
                  sort: event.target.value as NonNullable<
                    AdminCaseDirectoryQuery["sort"]
                  >,
                })}
            >
              <option value="updated_at_desc">最近更新</option>
              <option value="case_id_asc">案件编号</option>
            </select>
          </label>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {loading ? (
          <p className="list-state">正在加载案件…</p>
        ) : page?.items.length === 0 ? (
          <div className="list-state">
            <strong>没有符合条件的案件</strong>
            <p>请调整搜索或筛选条件后重试。</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>案件</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>关联行程</th>
                  <th>运营公司</th>
                  <th>最近更新</th>
                </tr>
              </thead>
              <tbody>
                {page?.items.map((item) => (
                  <tr key={`${item.kind}-${item.caseId}`}>
                    <td>
                      <button
                        className="task-link"
                        onClick={() => openCase(item.kind, item.caseId)}
                      >
                        <strong>{item.summary}</strong>
                        <small>{item.caseId}</small>
                      </button>
                    </td>
                    <td>{item.kind === "support" ? "客服案件" : "安全案件"}</td>
                    <td>{caseStateLabel(item.state)}</td>
                    <td>{item.tripId}</td>
                    <td>{item.operatorName}</td>
                    <td>{formatDate(item.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {page ? (
          <PaginationControls
            pageInfo={page.pageInfo}
            onPrevious={() =>
              setQuery(fleetCursorQuery(
                query,
                "before",
                page.pageInfo.startCursor,
              ))}
            onNext={() =>
              setQuery(fleetCursorQuery(
                query,
                "after",
                page.pageInfo.endCursor,
              ))}
          />
        ) : null}
      </section>
    </>
  );
}

function CaseDetail({
  session,
  client,
  caseRoute,
  onBack,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  caseRoute: NonNullable<AdminRoute["case"]>;
  onBack(): void;
}>) {
  const [detail, setDetail] = useState<AdminCaseDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState("");
  const [ticketId, setTicketId] = useState("SEC-2026-CASE");
  const [operationState, setOperationState] = useState<
    "idle" | "confirming" | "confirmed" | "error"
  >("idle");
  const [operationMessage, setOperationMessage] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    client
      .getCase(session.accessToken, caseRoute.kind, caseRoute.caseId)
      .then((value) => active && setDetail(value))
      .catch((reason) => active && setError(messageFor(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [caseRoute.caseId, caseRoute.kind, client, session.accessToken]);

  async function execute(
    action: AdminCaseAction,
    evidenceGrant?: { grantId: string; resourceVersion: number },
  ) {
    if (!detail || operationState === "confirming") return;
    const expectedVersion = evidenceGrant?.resourceVersion ??
      detail.case.resourceVersion;
    setOperationState("confirming");
    setOperationMessage("结果确认中，请勿重复提交。");
    try {
      const result = await client.performCaseAction(
        session.accessToken,
        caseRoute.kind,
        caseRoute.caseId,
        {
          action,
          expectedVersion,
          idempotencyKey: operationIdentifier(caseRoute.caseId, action),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(evidenceGrant
            ? { evidenceGrantId: evidenceGrant.grantId }
            : {}),
          ...(action === "request_evidence"
            ? {
                ticketId: ticketId.trim(),
                purposeCode: "safety_investigation" as const,
                requestedFields: ["chat_reference"] as const,
                ttlMinutes: 15,
              }
            : {}),
        },
      );
      setDetail(result.detail);
      setOperationState("confirmed");
      setOperationMessage(
        `${caseActionLabel(action)}已确认，操作编号 ${result.operationId}`,
      );
    } catch (reason) {
      setOperationState("error");
      setOperationMessage(messageFor(reason));
    }
  }

  if (loading) return <p className="list-state">正在加载案件详情…</p>;
  if (error || !detail) {
    return (
      <section className="list-state">
        <strong>无法加载案件详情</strong>
        <p role="alert">{error ?? "案件不存在或当前账号无权查看。"}</p>
        <button onClick={onBack}>返回案件列表</button>
      </section>
    );
  }
  const allowedActions =
    detail.allowedActions as readonly AdminCaseAction[];

  return (
    <>
      <section className="page-heading detail-heading">
        <div>
          <button className="text-action" onClick={onBack}>← 返回案件列表</button>
          <span className="eyebrow">
            {detail.kind === "support" ? "客服案件" : "安全调查"}
          </span>
          <h1>{caseDisplayText(detail.case.summary)}</h1>
          <p>{detail.case.caseId} · {detail.case.operatorName}</p>
        </div>
      </section>
      <section className="detail-grid">
        <article className="detail-card">
          <h2>案件信息</h2>
          {detail.kind === "support" ? (
            <dl className="detail-list">
              <div><dt>状态</dt><dd>{caseStateLabel(detail.profile.state)}</dd></div>
              <div><dt>问题类型</dt><dd>{supportCategoryLabel(detail.profile.category)}</dd></div>
              <div><dt>客户摘要</dt><dd>{caseDisplayText(detail.profile.userSummary)}</dd></div>
              <div><dt>调查进展</dt><dd>{caseDisplayText(detail.profile.investigationSummary)}</dd></div>
              <div><dt>负责人</dt><dd>{detail.profile.ownerInternalUserId ? "已分派至客服队列" : "待分派"}</dd></div>
            </dl>
          ) : (
            <dl className="detail-list">
              <div><dt>调查状态</dt><dd>{caseStateLabel(detail.investigation.investigationState)}</dd></div>
              <div><dt>安全状态</dt><dd>{caseStateLabel(detail.investigation.authoritativeState)}</dd></div>
              <div><dt>严重程度</dt><dd>{detail.investigation.severity.toUpperCase()}</dd></div>
              <div><dt>独立复核</dt><dd>{detail.investigation.independentReviewRequired ? "需要" : "不需要"}</dd></div>
            </dl>
          )}
        </article>
        <article className="detail-card">
          <h2>关联行程</h2>
          <dl className="detail-list">
            <div><dt>路线</dt><dd>{caseDisplayText(detail.trip.routeSummary)}</dd></div>
            <div><dt>行程状态</dt><dd>{tripStateLabel(detail.trip.authoritativeState)}</dd></div>
            <div><dt>乘客</dt><dd>{detail.trip.passengerMasked}</dd></div>
            <div><dt>车主与车辆</dt><dd>{detail.trip.driverMasked} · {detail.trip.vehicleMasked}</dd></div>
          </dl>
        </article>
        {detail.kind === "safety" ? (
          <>
            <article className="detail-card">
              <h2>当前阻断</h2>
              {detail.investigation.blockers.length ? (
                <ul className="plain-list">
                  {detail.investigation.blockers.map((blocker) => (
                    <li key={blocker.blockerType}>
                      <strong>{caseDisplayText(blocker.summary)}</strong>
                      <span>{blocker.blocking ? "阻止恢复访问" : "仅供关注"}</span>
                    </li>
                  ))}
                </ul>
              ) : <p>当前没有阻断项。</p>}
            </article>
            <article className="detail-card">
              <h2>证据授权</h2>
              {detail.evidenceGrants.length ? (
                <ul className="plain-list">
                  {detail.evidenceGrants.map((grant) => (
                    <li key={grant.grantId}>
                      <strong>{grant.ticketId}</strong>
                      <span>{caseStateLabel(grant.state)} · 有效至 {formatDate(grant.expiresAt)}</span>
                      {allowedActions.includes("approve_evidence") &&
                      grant.state === "requested" ? (
                        <button onClick={() => void execute("approve_evidence", grant)}>
                          批准证据访问
                        </button>
                      ) : null}
                      {allowedActions.includes("revoke_evidence") &&
                      (grant.state === "approved" || grant.state === "active") ? (
                        <button onClick={() => void execute("revoke_evidence", grant)}>
                          撤销证据访问
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : <p>尚无证据授权申请。</p>}
            </article>
          </>
        ) : null}
        <article className="detail-card task-actions">
          <h2>允许操作</h2>
          {allowedActions.length === 0 ? (
            <p>当前角色或案件状态仅允许查看。</p>
          ) : (
            <>
              <label>
                处理说明
                <textarea
                  aria-label="案件处理说明"
                  maxLength={500}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              {allowedActions.includes("request_evidence") ? (
                <label>
                  调查工单
                  <input
                    aria-label="调查工单"
                    value={ticketId}
                    onChange={(event) => setTicketId(event.target.value)}
                  />
                </label>
              ) : null}
              <div className="task-action-buttons">
                {allowedActions
                  .filter((action) =>
                    action !== "approve_evidence" &&
                    action !== "revoke_evidence")
                  .map((action) => (
                    <button
                      key={action}
                      className={
                        action === "restore_access" ||
                        action === "close"
                          ? "danger-action"
                          : "primary-action"
                      }
                      disabled={operationState === "confirming"}
                      onClick={() => void execute(action)}
                    >
                      {caseActionLabel(action)}
                    </button>
                  ))}
              </div>
            </>
          )}
          {operationMessage ? (
            <div
              className={`operation-result operation-${operationState}`}
              role={operationState === "error" ? "alert" : "status"}
            >
              {operationMessage}
            </div>
          ) : null}
        </article>
        <article className="detail-card detail-audit">
          <h2>案件记录</h2>
          {detail.auditTrail.length ? (
            <ol>
              {detail.auditTrail.map((event) => (
                <li key={event.eventId}>
                  <div>
                    <strong>{caseAuditActionLabel(event.action)}</strong>
                    {event.note ? <small>{event.note}</small> : null}
                  </div>
                  <span>{event.actorLabel} · {formatDate(event.occurredAt)}</span>
                </li>
              ))}
            </ol>
          ) : <p>尚无案件操作记录。</p>}
        </article>
      </section>
    </>
  );
}

function TripDirectory({
  session,
  client,
  onOpenTrip,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  onOpenTrip(tripId: string): void;
}>) {
  const storageKey =
    `${listStateStoragePrefix}.${session.workIdentity.workIdentityId}.trips`;
  const restoredState = useMemo(
    () => readFleetListState<AdminTripDirectoryQuery>(storageKey),
    [storageKey],
  );
  const [query, setQuery] = useState<AdminTripDirectoryQuery>(
    restoredState?.query ?? { pageSize: 25, sort: "updated_at_desc" },
  );
  const [page, setPage] = useState<AdminTripDirectoryPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    writeFleetListState(storageKey, query, window.scrollY);
    client
      .listTrips(session.accessToken, query)
      .then((value) => {
        if (!active) return;
        setPage(value);
        window.requestAnimationFrame(() => {
          const saved =
            readFleetListState<AdminTripDirectoryQuery>(storageKey);
          if (saved && saved.scrollY > 0) window.scrollTo(0, saved.scrollY);
        });
      })
      .catch((reason) => active && setError(messageFor(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [client, query, session.accessToken, storageKey]);

  function update(next: AdminTripDirectoryQuery) {
    const normalized = clearTripCursor(next);
    setQuery(normalized);
    writeFleetListState(storageKey, normalized, 0);
  }

  function openTrip(tripId: string) {
    writeFleetListState(storageKey, query, window.scrollY);
    onOpenTrip(tripId);
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">行程履约运营</span>
          <h1>行程运营名录</h1>
          <p>统一查看权威行程状态与运营任务，后台不直接改写行程状态。</p>
        </div>
      </section>
      <section className="operator-summary-grid" aria-label="行程运营数据摘要">
        <SummaryMetric label="范围内行程" value={page?.summary.totalTrips} />
        <SummaryMetric label="履约中" value={page?.summary.activeTrips} />
        <SummaryMetric label="需要关注" value={page?.summary.attentionTrips} />
        <SummaryMetric label="安全冻结" value={page?.summary.safetyFrozenTrips} />
        <SummaryMetric
          label="等待权威结果"
          value={page?.summary.awaitingAuthoritativeResultTrips}
        />
      </section>
      <section className="task-panel">
        <div className="list-toolbar">
          <label>
            搜索行程
            <input
              aria-label="搜索行程"
              placeholder="行程编号、路线或参与方"
              value={query.search ?? ""}
              onChange={(event) => {
                const { search: _search, ...rest } = query;
                update(event.target.value
                  ? { ...rest, search: event.target.value }
                  : rest);
              }}
            />
          </label>
          <label>
            行程状态
            <select
              aria-label="行程状态"
              value={query.authoritativeState ?? ""}
              onChange={(event) => {
                const { authoritativeState: _state, ...rest } = query;
                update(event.target.value
                  ? {
                      ...rest,
                      authoritativeState:
                        event.target.value as NonNullable<
                          AdminTripDirectoryQuery["authoritativeState"]
                        >,
                    }
                  : rest);
              }}
            >
              <option value="">全部</option>
              <option value="scheduled">已计划</option>
              <option value="accepted">已接单</option>
              <option value="driver_en_route">接驾中</option>
              <option value="driver_arrived">等待上车</option>
              <option value="in_progress">行程中</option>
              <option value="safety_frozen">安全冻结</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </label>
          <label>
            运营任务状态
            <select
              aria-label="运营任务状态"
              value={query.operationState ?? ""}
              onChange={(event) => {
                const { operationState: _state, ...rest } = query;
                update(event.target.value
                  ? {
                      ...rest,
                      operationState:
                        event.target.value as NonNullable<
                          AdminTripDirectoryQuery["operationState"]
                        >,
                    }
                  : rest);
              }}
            >
              <option value="">全部</option>
              <option value="detected">待分诊</option>
              <option value="triaged">已分诊</option>
              <option value="coordinating">协作中</option>
              <option value="awaiting_authoritative_result">等待权威结果</option>
              <option value="resolved">已解决</option>
              <option value="closed">已关闭</option>
            </select>
          </label>
          <label>
            排序
            <select
              aria-label="行程排序"
              value={query.sort ?? "updated_at_desc"}
              onChange={(event) =>
                update({
                  ...query,
                  sort: event.target.value as NonNullable<
                    AdminTripDirectoryQuery["sort"]
                  >,
                })}
            >
              <option value="updated_at_desc">最近更新</option>
              <option value="trip_id_asc">行程编号</option>
            </select>
          </label>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {loading ? (
          <p className="list-state">正在加载行程运营数据…</p>
        ) : page?.items.length === 0 ? (
          <div className="list-state">
            <strong>没有符合条件的行程</strong>
            <p>请调整搜索或筛选条件后重试。</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>行程</th>
                  <th>权威状态</th>
                  <th>运营任务</th>
                  <th>优先级</th>
                  <th>运营公司</th>
                  <th>最近更新</th>
                </tr>
              </thead>
              <tbody>
                {page?.items.map((trip) => (
                  <tr key={trip.tripId}>
                    <td>
                      <button
                        className="task-link"
                        onClick={() => openTrip(trip.tripId)}
                      >
                        <strong>{trip.routeSummary}</strong>
                        <small>{trip.tripId}</small>
                      </button>
                    </td>
                    <td>{tripStateLabel(trip.authoritativeState)}</td>
                    <td>
                      {trip.operationState
                        ? tripOperationStateLabel(trip.operationState)
                        : "无开放任务"}
                    </td>
                    <td>{tripPriorityLabel(trip.priority)}</td>
                    <td>{trip.operatorName}</td>
                    <td>{formatDate(trip.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {page ? (
          <PaginationControls
            pageInfo={page.pageInfo}
            onPrevious={() =>
              setQuery(tripCursorQuery(
                query,
                "before",
                page.pageInfo.startCursor,
              ))}
            onNext={() =>
              setQuery(tripCursorQuery(
                query,
                "after",
                page.pageInfo.endCursor,
              ))}
          />
        ) : null}
      </section>
    </>
  );
}

function TripDetail({
  session,
  client,
  tripId,
  onBack,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  tripId: string;
  onBack(): void;
}>) {
  const [detail, setDetail] = useState<AdminTripDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reasonCode, setReasonCode] = useState("schedule_coordination");
  const [operationState, setOperationState] = useState<
    "idle" | "confirming" | "confirmed" | "error"
  >("idle");
  const [operationMessage, setOperationMessage] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    client
      .getTrip(session.accessToken, tripId)
      .then((value) => active && setDetail(value))
      .catch((reason) => active && setError(messageFor(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [client, session.accessToken, tripId]);

  async function execute(action: AdminTripOperationAction) {
    if (!detail?.operationTask || operationState === "confirming") return;
    setOperationState("confirming");
    setOperationMessage("结果确认中，请勿重复提交。");
    try {
      const result = await client.performTripOperationAction(
        session.accessToken,
        tripId,
        {
          action,
          expectedTaskVersion: detail.operationTask.resourceVersion,
          expectedTripVersion: detail.profile.authoritativeVersion,
          idempotencyKey: operationIdentifier(tripId, action),
          ...(action === "request_domain_action"
            ? { reasonCode: reasonCode.trim() }
            : {}),
        },
      );
      setDetail(result.detail);
      setOperationState("confirmed");
      setOperationMessage(
        `${tripActionLabel(action)}已确认，操作编号 ${result.operationId}`,
      );
    } catch (reason) {
      setOperationState("error");
      setOperationMessage(messageFor(reason));
    }
  }

  if (loading) return <p className="list-state">正在加载行程详情…</p>;
  if (error || !detail) {
    return (
      <section className="list-state">
        <strong>无法加载行程详情</strong>
        <p role="alert">{error ?? "行程不存在或当前账号无权查看。"}</p>
        <button onClick={onBack}>返回行程列表</button>
      </section>
    );
  }

  return (
    <>
      <section className="page-heading detail-heading">
        <div>
          <button className="text-action" onClick={onBack}>← 返回行程列表</button>
          <span className="eyebrow">行程 360°</span>
          <h1>{detail.trip.routeSummary}</h1>
          <p>{detail.trip.tripId} · {detail.trip.operatorName}</p>
        </div>
      </section>
      <section className="detail-grid">
        <article className="detail-card">
          <h2>权威行程事实</h2>
          <dl className="detail-list">
            <div><dt>行程状态</dt><dd>{tripStateLabel(detail.profile.authoritativeState)}</dd></div>
            <div><dt>权威版本</dt><dd>v{detail.profile.authoritativeVersion}</dd></div>
            <div><dt>乘客</dt><dd>{detail.profile.passengerMasked}</dd></div>
            <div><dt>车主</dt><dd>{detail.profile.driverMasked}</dd></div>
            <div><dt>车辆</dt><dd>{detail.profile.vehicleMasked}</dd></div>
          </dl>
        </article>
        <article className="detail-card">
          <h2>运营任务</h2>
          {detail.operationTask ? (
            <dl className="detail-list">
              <div><dt>任务编号</dt><dd>{detail.operationTask.taskId}</dd></div>
              <div><dt>任务类型</dt><dd>{tripCategoryLabel(detail.operationTask.category)}</dd></div>
              <div><dt>任务状态</dt><dd>{tripOperationStateLabel(detail.operationTask.state)}</dd></div>
              <div><dt>优先级</dt><dd>{tripPriorityLabel(detail.operationTask.priority)}</dd></div>
              <div><dt>任务摘要</dt><dd>{detail.operationTask.summary}</dd></div>
            </dl>
          ) : <p>当前行程没有开放运营任务。</p>}
        </article>
        <article className="detail-card">
          <h2>关联协作</h2>
          <dl className="detail-list">
            <div><dt>客服案件</dt><dd>{detail.relatedCases.supportCaseId ?? "无"}</dd></div>
            <div><dt>安全案件</dt><dd>{detail.relatedCases.safetyCaseId ?? "无"}</dd></div>
            <div><dt>资金能力</dt><dd>只读</dd></div>
            <div><dt>主体快照</dt><dd>不可改写</dd></div>
          </dl>
        </article>
        <article className="detail-card task-actions">
          <h2>允许操作</h2>
          {detail.allowedActions.length === 0 ? (
            <p>当前角色或任务状态仅允许查看。</p>
          ) : (
            <>
              {detail.allowedActions.includes("request_domain_action") ? (
                <label>
                  原因代码
                  <input
                    aria-label="行程操作原因代码"
                    maxLength={100}
                    value={reasonCode}
                    onChange={(event) => setReasonCode(event.target.value)}
                  />
                </label>
              ) : null}
              <div className="task-action-buttons">
                {detail.allowedActions.map((action) => (
                  <button
                    key={action}
                    disabled={
                      operationState === "confirming" ||
                      (action === "request_domain_action" && !reasonCode.trim())
                    }
                    onClick={() => void execute(action)}
                  >
                    {tripActionLabel(action)}
                  </button>
                ))}
              </div>
            </>
          )}
          {operationMessage ? (
            <p
              className={`operation-result operation-${operationState}`}
              role={operationState === "error" ? "alert" : "status"}
            >
              {operationMessage}
            </p>
          ) : null}
        </article>
        <article className="detail-card">
          <h2>当前范围与权限</h2>
          <p>
            {detail.organizationScope.organizationName} ·{" "}
            {detail.organizationScope.cityScopes.join("、")}
          </p>
          <div className="permission-list">
            {detail.allowedActions.length
              ? detail.allowedActions.map((action) => (
                  <span key={action}>{tripActionLabel(action)}</span>
                ))
              : <span>仅查看</span>}
          </div>
        </article>
        <article className="detail-card detail-audit">
          <h2>追加式审计</h2>
          {detail.auditTrail.length ? (
            <ol>
              {[...detail.auditTrail].reverse().map((event) => (
                <li key={event.eventId}>
                  <div>
                    <strong>{tripAuditActionLabel(event.action)}</strong>
                    {event.reasonCode ? <small>{event.reasonCode}</small> : null}
                  </div>
                  <span>
                    {event.actorLabel} · {event.actorRole} ·{" "}
                    {formatDate(event.occurredAt)}
                  </span>
                </li>
              ))}
            </ol>
          ) : <p>尚无操作记录。</p>}
        </article>
      </section>
    </>
  );
}

function FeatureUnavailablePage({
  title,
  roleName,
}: Readonly<{ title: string; roleName: string }>) {
  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">{roleName}</span>
          <p>{title}</p>
          <h1>功能暂未开放</h1>
        </div>
      </section>
      <section className="feature-unavailable" aria-labelledby="feature-unavailable-title">
        <span aria-hidden="true">—</span>
        <div>
          <h2 id="feature-unavailable-title">该业务域尚未达到任务闭环标准</h2>
          <p>详细列表、单条详情、角色操作、结果确认与审计能力完成并接入服务端数据后，此入口才会开放。</p>
        </div>
      </section>
    </>
  );
}

function PaginationControls({
  pageInfo,
  onPrevious,
  onNext,
}: Readonly<{
  pageInfo: AdminCursorPageInfo;
  onPrevious(): void;
  onNext(): void;
}>) {
  return (
    <div className="pagination-bar">
      <span>
        {pageInfo.approximateTotal === null
          ? "总数受限"
          : `共 ${pageInfo.approximateTotal} 条`}
      </span>
      <div>
        <button disabled={!pageInfo.hasPreviousPage} onClick={onPrevious}>上一页</button>
        <button disabled={!pageInfo.hasNextPage} onClick={onNext}>下一页</button>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: Readonly<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?(): void;
}>) {
  return (
    <section className="state-panel">
      <h2>{title}</h2>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <button className="text-action" onClick={onAction}>{actionLabel}</button>
      ) : null}
    </section>
  );
}

function EntryFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <main className="entry-screen"><div className="entry-background" />{children}</main>;
}

function persistSession(session: AdminProductSession) {
  sessionStorage.setItem(refreshStorageKey, session.refreshToken);
}

function restoreSession(
  client: AdminProductizationClient,
  refreshToken: string,
): Promise<AdminProductSession> {
  const existing = refreshRequests.get(refreshToken);
  if (existing) return existing;
  const request = client.refreshSession(refreshToken);
  refreshRequests.set(refreshToken, request);
  void request.finally(() => {
    window.setTimeout(() => refreshRequests.delete(refreshToken), 1_000);
  });
  return request;
}

function messageFor(reason: unknown): string {
  const code = reason instanceof Error ? reason.message : "INTERNAL_UNEXPECTED_ERROR";
  return ({
    ADMIN_CREDENTIAL_INVALID: "工作邮箱或密码不正确",
    ADMIN_ACCOUNT_LOCKED: "登录失败次数过多，请稍后重试",
    ADMIN_MFA_INVALID: "动态验证码不正确",
    ADMIN_OPERATIONS_TASK_NOT_FOUND: "未找到该工作任务",
    AUTHORIZATION_DENIED: "当前账号无权执行此操作",
    ADMIN_OPERATIONS_TASK_ACTION_INVALID: "当前任务状态不允许执行该操作",
    ADMIN_OPERATOR_RESOURCE_NOT_FOUND: "未找到该运营公司",
    ADMIN_OPERATOR_ACTION_INVALID: "当前主体状态或角色不允许执行该操作",
    ADMIN_CASE_ACTION_INVALID: "当前案件状态或角色不允许执行该操作",
    ADMIN_SAFETY_RESTORATION_BLOCKED: "请先关闭当前阻断项，再恢复访问",
    ADMIN_FINANCE_RESOURCE_NOT_FOUND: "未找到该财务记录或当前组织无权查看",
    ADMIN_FINANCE_ACTION_INVALID: "当前财务记录状态或角色不允许执行该操作",
    ADMIN_FINANCE_REVIEWER_CONFLICT: "经办人与独立复核人必须不同",
    ADMIN_FINANCE_SETTLEMENT_BLOCKED: "当前结算仍存在阻断项",
    ADMIN_FINANCE_PAYOUT_BLOCKED: "当前车主付款仍存在阻断项",
    ADMIN_FINANCE_REFUND_INELIGIBLE: "当前退款案件尚不满足请求条件",
    ADMIN_FINANCE_REVERSAL_INVALID: "当前记录不满足完整冲正条件",
    ADMIN_FINANCE_RECONCILIATION_BLOCKED: "当前对账差异尚不允许处理",
    ADMIN_FINANCE_RESOLUTION_EVIDENCE_REQUIRED: "对账差异解决必须引用证据",
    ADMIN_FINANCE_DAY_CLOSE_BLOCKED: "营业日仍存在未关闭运行或资金差异",
    ADMIN_FINANCE_UNKNOWN_RESULT_IN_PROGRESS: "原资金请求结果仍在恢复中",
    ADMIN_EXECUTIVE_RESOURCE_NOT_FOUND: "未找到该驾驶舱记录或当前组织无权查看",
    ADMIN_EXECUTIVE_OPERATION_FORBIDDEN: "当前角色或资源状态不允许执行该治理操作",
    ADMIN_EXECUTIVE_EXPORT_PURPOSE_REQUIRED: "导出申请必须说明用途",
    ADMIN_EXECUTIVE_EXPORT_REVIEWER_CONFLICT: "导出申请人不能审批自己的申请",
    ADMIN_EXECUTIVE_EXPORT_FORBIDDEN: "当前身份或导出状态不允许此操作",
    ADMIN_EXECUTIVE_EXPORT_EXPIRED: "导出下载授权已过期",
    ADMIN_EXECUTIVE_UNCLOSED_DATA_RESTRICTED: "未关账财务数据不能导出",
    ADMIN_FLEET_RESOURCE_NOT_FOUND: "未找到该车主或车辆",
    ADMIN_REVIEW_TASK_NOT_FOUND: "该车辆没有可操作的审核任务",
    ADMIN_TASK_ALREADY_CLAIMED: "审核任务已被其他人员认领",
    ADMIN_TASK_OWNERSHIP_LOST: "审核任务认领已失效，请刷新后重试",
    VERSION_CONFLICT: "审核数据已更新，请刷新后重试",
    ADMIN_RESOURCE_VERSION_CONFLICT: "数据已被其他人员更新，请刷新后重试",
    CONFLICT_IDEMPOTENCY_KEY_REUSED: "该请求标识已用于其他操作",
    SESSION_EXPIRED: "登录已过期，请重新登录",
    SERVICE_UNAVAILABLE: "服务暂不可用，请稍后重试",
  } as Record<string, string>)[code] ?? "操作未完成，请重试";
}

function statusLabel(status: string): string {
  return ({ unassigned: "待分派", processing: "处理中", waiting_review: "待复核", blocked: "受阻", completed: "已完成" } as Record<string, string>)[status] ?? status;
}

function financeKindLabel(kind: string): string {
  return ({
    settlement: "分配结算",
    payout: "车主付款",
    refund_reversal: "退款与冲正",
    reconciliation: "对账运行",
    business_day: "营业日关账",
    ledger: "账本交易",
  } as Record<string, string>)[kind] ?? kind;
}

function auditDomainLabel(domain: string): string {
  return ({
    authentication: "认证会话",
    access: "访问决策",
    operator: "运营主体",
    driver_vehicle: "车主与车辆",
    trip: "行程运营",
    support_safety: "客服与安全",
    finance: "财务与对账",
    executive: "高层驾驶舱",
    audit_system: "审计与系统",
  } as Record<string, string>)[domain] ?? domain;
}

function auditStateLabel(state: string): string {
  return ({
    succeeded: "成功",
    allowed: "允许",
    denied: "拒绝",
    open: "开放",
    in_review: "调查中",
    resolved: "已解决",
  } as Record<string, string>)[state] ?? state;
}

function auditStatusTone(state: string): string {
  if (state === "denied" || state === "open") return "danger";
  if (state === "in_review") return "attention";
  return "success";
}

function auditSystemActionLabel(action: AdminAuditAction): string {
  return ({
    open_investigation: "创建技术调查",
    assign_investigation: "分派调查",
    add_investigation_note: "追加调查记录",
    resolve_investigation: "解决调查",
    reopen_investigation: "重新打开调查",
  } as Record<AdminAuditAction, string>)[action];
}

function auditQueryWithSearch(
  query: AdminAuditDirectoryQuery,
  search: string,
): AdminAuditDirectoryQuery {
  const { search: _search, after: _after, before: _before, ...rest } = query;
  return search ? { ...rest, search } : rest;
}

function auditQueryWithKind(
  query: AdminAuditDirectoryQuery,
  kind: string,
): AdminAuditDirectoryQuery {
  const { kind: _kind, after: _after, before: _before, ...rest } = query;
  return kind
    ? { ...rest, kind: kind as NonNullable<AdminAuditDirectoryQuery["kind"]> }
    : rest;
}

function auditQueryWithDomain(
  query: AdminAuditDirectoryQuery,
  domain: string,
): AdminAuditDirectoryQuery {
  const { domain: _domain, after: _after, before: _before, ...rest } = query;
  return domain
    ? {
        ...rest,
        domain: domain as NonNullable<AdminAuditDirectoryQuery["domain"]>,
      }
    : rest;
}

function auditQueryWithResult(
  query: AdminAuditDirectoryQuery,
  result: string,
): AdminAuditDirectoryQuery {
  const { result: _result, after: _after, before: _before, ...rest } = query;
  return result
    ? {
        ...rest,
        result: result as NonNullable<AdminAuditDirectoryQuery["result"]>,
      }
    : rest;
}

function auditCursorQuery(
  query: AdminAuditDirectoryQuery,
  direction: "after" | "before",
  cursor: string | null | undefined,
): AdminAuditDirectoryQuery {
  const { after: _after, before: _before, ...rest } = query;
  return cursor ? { ...rest, [direction]: cursor } : rest;
}

function auditTrailActionLabel(
  action: AdminAuditDetail["auditTrail"][number]["action"],
): string {
  return ({
    audit_resource_viewed: "查看审计资源",
    audit_investigation_opened: "创建技术调查",
    audit_investigation_assigned: "分派调查",
    audit_investigation_note_added: "追加调查记录",
    audit_investigation_resolved: "解决调查",
    audit_investigation_reopened: "重新打开调查",
  } as Record<AdminAuditDetail["auditTrail"][number]["action"], string>)[action];
}

function executiveKindLabel(kind: string): string {
  return ({
    decision_item: "待决事项",
    export_request: "受控导出",
    operator_health: "运营主体健康",
    metric: "指标口径",
  } as Record<string, string>)[kind] ?? kind;
}

function executiveDomainName(domain: string): string {
  return ({
    operations: "运营",
    finance: "财务",
    safety_compliance: "安全合规",
  } as Record<string, string>)[domain] ?? domain;
}

function executiveStateLabel(state: string): string {
  return ({
    open: "开放",
    awaiting_privacy_review: "等待隐私复核",
    awaiting_domain_review: "等待职责域复核",
    approved: "已批准",
    downloaded: "已下载",
    rejected: "已拒绝",
    revoked: "已撤销",
    expired: "已过期",
    healthy: "健康",
    attention: "需关注",
    blocked: "已阻断",
    unavailable: "不可用",
    ready: "就绪",
    partial: "部分可用",
    stale: "数据过期",
    unclosed: "包含未关账数据",
    suppressed: "小样本抑制",
    scope_denied: "范围受限",
    feature_disabled: "功能关闭",
  } as Record<string, string>)[state] ?? state;
}

function executiveStatusTone(state: string): string {
  if (
    state === "blocked" ||
    state === "unavailable" ||
    state === "rejected" ||
    state === "revoked" ||
    state === "expired"
  ) {
    return "blocked";
  }
  if (
    state === "healthy" ||
    state === "approved" ||
    state === "downloaded" ||
    state === "ready"
  ) {
    return "completed";
  }
  return "processing";
}

function executiveActionLabel(action: AdminExecutiveAction): string {
  return ({
    record_decision_opinion: "记录治理意见",
    create_export_request: "提交导出申请",
    privacy_approve_export: "隐私复核通过",
    privacy_reject_export: "隐私复核拒绝",
    domain_approve_export: "职责域复核通过",
    domain_reject_export: "职责域复核拒绝",
    revoke_export: "撤销导出授权",
    download_export: "单次下载并删除",
  } as const)[action];
}

function executiveAuditLabel(
  action: AdminExecutiveDetail["auditTrail"][number]["action"],
): string {
  return ({
    executive_resource_viewed: "查看驾驶舱资源",
    executive_decision_opinion_recorded: "记录治理意见",
    executive_export_requested: "提交导出申请",
    executive_export_privacy_reviewed: "完成隐私复核",
    executive_export_domain_reviewed: "完成职责域复核",
    executive_export_revoked: "撤销导出授权",
    executive_export_downloaded: "完成单次下载",
  } as const)[action];
}

function executiveExportFields(
  domain: "operations" | "finance" | "safety_compliance",
): readonly string[] {
  if (domain === "operations") {
    return ["trip_completion_rate", "dispatch_acceptance_rate"];
  }
  if (domain === "finance") {
    return ["payout_timeliness_rate", "business_day_close_rate"];
  }
  return ["safety_incident_rate", "open_major_safety_case_count"];
}

function downloadExecutiveFile(
  download: import("@pollycar/contracts").ExecutiveExportDownload,
): void {
  const bytes = Uint8Array.from(atob(download.contentBase64), (character) =>
    character.charCodeAt(0));
  const url = URL.createObjectURL(
    new Blob([bytes], { type: download.mediaType }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = download.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function financeStateLabel(state: string): string {
  return ({
    eligible: "可准备",
    ready: "待独立复核",
    awaiting_review: "等待独立复核",
    approved: "已批准",
    processing: "处理中",
    succeeded: "已成功",
    blocked: "已阻断",
    unknown: "结果未知",
    liability_formed: "责任已形成",
    refund_requested: "退款已请求",
    refund_succeeded: "退款成功",
    reversal_requested: "冲正已请求",
    reversal_succeeded: "冲正成功",
    differences_found: "发现差异",
    open: "开放",
    resolved: "已解决",
    closed: "已关闭",
    posted: "已记账",
    pending: "等待机构结果",
    success: "成功",
    failed: "失败",
  } as Record<string, string>)[state] ?? state;
}

function financeStatusTone(state: string): string {
  if (
    state === "blocked" ||
    state === "unknown" ||
    state === "differences_found" ||
    state === "failed"
  ) {
    return "blocked";
  }
  if (
    state === "succeeded" ||
    state === "closed" ||
    state === "posted" ||
    state === "refund_succeeded" ||
    state === "reversal_succeeded"
  ) {
    return "completed";
  }
  return "processing";
}

function financeActionLabel(action: AdminFinanceAction): string {
  return ({
    prepare_operator_settlement: "准备运营公司结算",
    review_operator_settlement: "独立复核结算",
    prepare_driver_payout: "准备车主付款",
    review_driver_payout: "独立复核车主付款",
    request_driver_payout: "请求执行车主付款",
    request_refund: "请求退款",
    request_full_reversal: "请求完整冲正",
    submit_reconciliation_resolution: "提交差异解决",
    review_reconciliation_resolution: "独立复核差异解决",
    prepare_business_day_close: "准备营业日关账",
    review_business_day_close: "独立复核关账",
    query_finance_command_recovery: "查询原请求结果",
  } as Record<AdminFinanceAction, string>)[action];
}

function financeAuditLabel(action: string): string {
  return ({
    finance_profile_viewed: "查看财务记录",
    finance_operation_submitted: "提交财务操作",
    finance_review_recorded: "记录独立复核",
  } as Record<string, string>)[action] ?? action;
}

function formatMinorCurrency(value: string): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
  }).format(Number(value) / 100);
}

function driverEligibilityLabel(state: string): string {
  return state === "serviceable" ? "可服务" : "受限";
}

function vehicleReviewLabel(state: string): string {
  return ({
    approved: "已通过",
    under_review: "审核中",
    changes_requested: "待补材料",
    rejected: "未通过",
  } as Record<string, string>)[state] ?? state;
}

function vehicleStatusTone(state: string): string {
  return ({
    approved: "completed",
    under_review: "processing",
    changes_requested: "blocked",
    rejected: "blocked",
  } as Record<string, string>)[state] ?? "processing";
}

function reviewTaskStatusLabel(state: string): string {
  return ({
    available: "待认领",
    claimed: "已认领",
    in_progress: "审核中",
    waiting_user: "等待补充",
    released: "已释放",
    expired: "认领已过期",
    completed: "已完成",
  } as Record<string, string>)[state] ?? state;
}

function reviewFieldLabel(state: string): string {
  return ({
    complete: "完整",
    incomplete: "需补充",
    valid: "有效",
    invalid: "无效",
  } as Record<string, string>)[state] ?? state;
}

function reviewAuditLabel(action: string): string {
  return ({
    task_claimed: "审核任务已认领",
    task_viewed: "查看车辆审核详情",
    lease_renewed: "审核租约已续期",
    task_released: "审核任务已释放",
    material_previewed: "补充材料通知已预览",
    material_requested: "已要求补充材料",
    vehicle_approved: "车辆已批准",
    vehicle_rejected: "车辆已拒绝",
  } as Record<string, string>)[action] ?? action;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function dataReportDomainLabel(domain: string): string {
  return ({
    operations: "运营",
    finance: "财务与对账",
    safety_compliance: "安全合规",
    audit: "审计",
  } as Record<string, string>)[domain] ?? domain;
}

function dataReportCursor(
  query: AdminDataReportDirectoryQuery,
  direction: "after" | "before",
  cursor: string | null | undefined,
): AdminDataReportDirectoryQuery {
  const { after: _after, before: _before, ...base } = query;
  return cursor ? { ...base, [direction]: cursor } : base;
}

function membershipCursor(
  query: AdminMembershipDirectoryQuery,
  direction: "after" | "before",
  cursor: string | null | undefined,
): AdminMembershipDirectoryQuery {
  const base = withoutMembershipCursors(query);
  return cursor ? { ...base, [direction]: cursor } : base;
}

function withoutMembershipCursors(
  query: AdminMembershipDirectoryQuery,
): AdminMembershipDirectoryQuery {
  const { after: _after, before: _before, ...base } = query;
  return base;
}

function withMembershipSearch(
  query: AdminMembershipDirectoryQuery,
  search: string,
): AdminMembershipDirectoryQuery {
  const { search: _search, ...base } = withoutMembershipCursors(query);
  return search ? { ...base, search } : base;
}

function membershipStateLabel(state: "active" | "suspended"): string {
  return state === "active" ? "正常" : "已暂停";
}

function membershipAuditLabel(
  action:
    | "admin_membership_viewed"
    | "admin_membership_suspended"
    | "admin_membership_restored",
): string {
  if (action === "admin_membership_suspended") return "暂停成员";
  if (action === "admin_membership_restored") return "恢复成员";
  return "查看成员";
}

function withDataReportSearch(
  query: AdminDataReportDirectoryQuery,
  search: string,
): AdminDataReportDirectoryQuery {
  const { search: _search, ...base } = query;
  return search ? { ...base, search } : base;
}

function withDataReportDomain(
  query: AdminDataReportDirectoryQuery,
  domain: string,
): AdminDataReportDirectoryQuery {
  const { domain: _domain, ...base } = query;
  return domain
    ? { ...base, domain: domain as NonNullable<AdminDataReportDirectoryQuery["domain"]> }
    : base;
}

function withDataReportState(
  query: AdminDataReportDirectoryQuery,
  state: string,
): AdminDataReportDirectoryQuery {
  const { state: _state, ...base } = query;
  return state
    ? { ...base, state: state as NonNullable<AdminDataReportDirectoryQuery["state"]> }
    : base;
}

function iconFor(domain: AdminNavigationDomain): string {
  return ({ workbench: "◫", organization_accounts: "◎", operator_management: "◇", driver_vehicle: "◉", trip_operations: "↗", support_safety: "♡", finance_operations: "¥", data_reports: "▥", executive_dashboard: "△", audit_system: "⌁" })[domain];
}

function cursorQuery(
  query: AdminOperationsTaskQuery,
  direction: "after" | "before",
  cursor: string | null | undefined,
): AdminOperationsTaskQuery {
  const { after: _after, before: _before, ...base } = query;
  return cursor ? { ...base, [direction]: cursor } : base;
}

type AdminRoute = Readonly<{
  domain: AdminNavigationDomain;
  membershipId?: string;
  reportId?: string;
  taskId?: string;
  operatorId?: string;
  tripId?: string;
  case?: Readonly<{
    kind: "support" | "safety";
    caseId: string;
  }>;
  finance?: Readonly<{
    kind:
      | "settlement"
      | "payout"
      | "refund_reversal"
      | "reconciliation"
      | "business_day"
      | "ledger";
    resourceId: string;
  }>;
  executive?: Readonly<{
    kind: "decision_item" | "export_request" | "operator_health" | "metric";
    resourceId: string;
  }>;
  audit?: Readonly<{
    kind: "event" | "investigation";
    resourceId: string;
  }>;
  fleet?: Readonly<{
    view: "drivers" | "vehicles";
    resourceId?: string;
  }>;
}>;

type SavedListState = Readonly<{
  query: AdminOperationsTaskQuery;
  scrollY: number;
}>;

type SavedOperatorListState = Readonly<{
  query: AdminOperatorDirectoryQuery;
  scrollY: number;
}>;

type SavedFleetListState<TQuery> = Readonly<{
  query: TQuery;
  scrollY: number;
}>;

function firstAvailableDomain(
  navigation: AdminNavigationManifest,
): AdminNavigationDomain {
  return navigation.items.find((item) =>
    item.availability === "available" &&
    navigation.routePermissions.includes(`${item.id}:read`),
  )?.id
    ?? "workbench";
}

function resolveRoute(
  pathname: string,
  navigation: AdminNavigationManifest,
): AdminRoute | undefined {
  const taskMatch = pathname.match(/^\/admin\/workbench\/tasks\/([^/]+)$/);
  const operatorMatch = pathname.match(/^\/admin\/operators\/([^/]+)$/);
  const tripMatch = pathname.match(/^\/admin\/trips\/([^/]+)$/);
  const caseMatch = pathname.match(
    /^\/admin\/cases\/(support|safety)\/([^/]+)$/,
  );
  const financeMatch = pathname.match(
    /^\/admin\/finance\/(settlement|payout|refund_reversal|reconciliation|business_day|ledger)\/([^/]+)$/,
  );
  const executiveMatch = pathname.match(
    /^\/admin\/executive\/(decision_item|export_request|operator_health|metric)\/([^/]+)$/,
  );
  const auditMatch = pathname.match(
    /^\/admin\/governance\/(event|investigation)\/([^/]+)$/,
  );
  const reportMatch = pathname.match(/^\/admin\/reports\/([^/]+)$/);
  const membershipMatch = pathname.match(
    /^\/admin\/organization-accounts\/([^/]+)$/,
  );
  const driverMatch = pathname.match(/^\/admin\/fleet\/drivers(?:\/([^/]+))?$/);
  const vehicleMatch = pathname.match(/^\/admin\/fleet\/vehicles(?:\/([^/]+))?$/);
  const domain = taskMatch
    ? "workbench"
    : operatorMatch
      ? "operator_management"
    : tripMatch
      ? "trip_operations"
    : caseMatch
      ? "support_safety"
    : financeMatch
      ? "finance_operations"
    : executiveMatch
      ? "executive_dashboard"
    : auditMatch
      ? "audit_system"
    : membershipMatch
      ? "organization_accounts"
    : reportMatch
      ? "data_reports"
    : driverMatch || vehicleMatch
      ? "driver_vehicle"
    : navigation.items.find((item) =>
      pathname === item.route || pathname.startsWith(`${item.route}/`),
    )?.id;
  if (!domain) return undefined;
  const item = navigation.items.find((candidate) => candidate.id === domain);
  if (
    !item ||
    item.availability !== "available" ||
    !navigation.routePermissions.includes(`${domain}:read`)
  ) {
    return undefined;
  }
  return {
    domain,
    ...(taskMatch?.[1]
      ? { taskId: decodeURIComponent(taskMatch[1]) }
      : {}),
    ...(operatorMatch?.[1]
      ? { operatorId: decodeURIComponent(operatorMatch[1]) }
      : {}),
    ...(tripMatch?.[1]
      ? { tripId: decodeURIComponent(tripMatch[1]) }
      : {}),
    ...(caseMatch?.[1] && caseMatch[2]
      ? {
          case: {
            kind: caseMatch[1] as "support" | "safety",
            caseId: decodeURIComponent(caseMatch[2]),
          },
        }
      : {}),
    ...(financeMatch?.[1] && financeMatch[2]
      ? {
          finance: {
            kind: financeMatch[1] as NonNullable<
              AdminRoute["finance"]
            >["kind"],
            resourceId: decodeURIComponent(financeMatch[2]),
          },
        }
      : {}),
    ...(executiveMatch?.[1] && executiveMatch[2]
      ? {
          executive: {
            kind: executiveMatch[1] as NonNullable<
              AdminRoute["executive"]
            >["kind"],
            resourceId: decodeURIComponent(executiveMatch[2]),
          },
        }
      : {}),
    ...(auditMatch?.[1] && auditMatch[2]
      ? {
          audit: {
            kind: auditMatch[1] as NonNullable<AdminRoute["audit"]>["kind"],
            resourceId: decodeURIComponent(auditMatch[2]),
          },
        }
      : {}),
    ...(reportMatch?.[1]
      ? { reportId: decodeURIComponent(reportMatch[1]) }
      : {}),
    ...(membershipMatch?.[1]
      ? { membershipId: decodeURIComponent(membershipMatch[1]) }
      : {}),
    ...(driverMatch
      ? {
          fleet: {
            view: "drivers" as const,
            ...(driverMatch[1]
              ? { resourceId: decodeURIComponent(driverMatch[1]) }
              : {}),
          },
        }
      : {}),
    ...(vehicleMatch
      ? {
          fleet: {
            view: "vehicles" as const,
            ...(vehicleMatch[1]
              ? { resourceId: decodeURIComponent(vehicleMatch[1]) }
              : {}),
          },
        }
      : {}),
  };
}

function pathForRoute(
  route: AdminRoute,
  navigation?: AdminNavigationManifest,
): string {
  if (route.domain === "workbench" && route.taskId) {
    return `/admin/workbench/tasks/${encodeURIComponent(route.taskId)}`;
  }
  if (route.domain === "operator_management" && route.operatorId) {
    return `/admin/operators/${encodeURIComponent(route.operatorId)}`;
  }
  if (route.domain === "trip_operations" && route.tripId) {
    return `/admin/trips/${encodeURIComponent(route.tripId)}`;
  }
  if (route.domain === "support_safety" && route.case) {
    return `/admin/cases/${route.case.kind}/${encodeURIComponent(route.case.caseId)}`;
  }
  if (route.domain === "finance_operations" && route.finance) {
    return `/admin/finance/${route.finance.kind}/${encodeURIComponent(route.finance.resourceId)}`;
  }
  if (route.domain === "executive_dashboard" && route.executive) {
    return `/admin/executive/${route.executive.kind}/${encodeURIComponent(route.executive.resourceId)}`;
  }
  if (route.domain === "audit_system" && route.audit) {
    return `/admin/governance/${route.audit.kind}/${encodeURIComponent(route.audit.resourceId)}`;
  }
  if (route.domain === "data_reports" && route.reportId) {
    return `/admin/reports/${encodeURIComponent(route.reportId)}`;
  }
  if (route.domain === "organization_accounts" && route.membershipId) {
    return `/admin/organization-accounts/${encodeURIComponent(route.membershipId)}`;
  }
  if (route.domain === "driver_vehicle" && route.fleet) {
    const base = `/admin/fleet/${route.fleet.view}`;
    return route.fleet.resourceId
      ? `${base}/${encodeURIComponent(route.fleet.resourceId)}`
      : base;
  }
  return navigation?.items.find((item) => item.id === route.domain)?.route
    ?? "/admin/workbench";
}

function readListState(storageKey: string): SavedListState | undefined {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<SavedListState>;
    if (!parsed.query || typeof parsed.scrollY !== "number") return undefined;
    return { query: parsed.query, scrollY: parsed.scrollY };
  } catch {
    return undefined;
  }
}

function writeListState(
  storageKey: string,
  query: AdminOperationsTaskQuery,
  scrollY: number,
) {
  sessionStorage.setItem(storageKey, JSON.stringify({ query, scrollY }));
}

function readOperatorListState(
  storageKey: string,
): SavedOperatorListState | undefined {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<SavedOperatorListState>;
    if (!parsed.query || typeof parsed.scrollY !== "number") return undefined;
    return { query: parsed.query, scrollY: parsed.scrollY };
  } catch {
    return undefined;
  }
}

function writeOperatorListState(
  storageKey: string,
  query: AdminOperatorDirectoryQuery,
  scrollY: number,
) {
  sessionStorage.setItem(storageKey, JSON.stringify({ query, scrollY }));
}

function readFleetListState<TQuery>(
  storageKey: string,
): SavedFleetListState<TQuery> | undefined {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<SavedFleetListState<TQuery>>;
    if (!parsed.query || typeof parsed.scrollY !== "number") return undefined;
    return { query: parsed.query, scrollY: parsed.scrollY };
  } catch {
    return undefined;
  }
}

function writeFleetListState<TQuery>(
  storageKey: string,
  query: TQuery,
  scrollY: number,
) {
  sessionStorage.setItem(storageKey, JSON.stringify({ query, scrollY }));
}

function clearFleetCursor<
  TQuery extends Readonly<{ after?: string; before?: string }>,
>(query: TQuery): Omit<TQuery, "after" | "before"> {
  const { after: _after, before: _before, ...rest } = query;
  return rest;
}

function fleetQueryWithSearch<
  TQuery extends Readonly<{
    after?: string;
    before?: string;
    search?: string;
  }>,
>(query: TQuery, search: string): TQuery {
  const { search: _search, ...rest } = clearFleetCursor(query);
  return (search ? { ...rest, search } : rest) as TQuery;
}

function driverQueryWithState(
  query: AdminDriverDirectoryQuery,
  eligibilityState: string,
): AdminDriverDirectoryQuery {
  const {
    eligibilityState: _eligibilityState,
    ...rest
  } = clearFleetCursor(query);
  return eligibilityState
    ? {
        ...rest,
        eligibilityState:
          eligibilityState as NonNullable<
            AdminDriverDirectoryQuery["eligibilityState"]
          >,
      }
    : rest;
}

function vehicleQueryWithState(
  query: AdminVehicleDirectoryQuery,
  reviewState: string,
): AdminVehicleDirectoryQuery {
  const { reviewState: _reviewState, ...rest } = clearFleetCursor(query);
  return reviewState
    ? {
        ...rest,
        reviewState:
          reviewState as NonNullable<
            AdminVehicleDirectoryQuery["reviewState"]
          >,
      }
    : rest;
}

function fleetCursorQuery<
  TQuery extends Readonly<{ after?: string; before?: string }>,
>(
  query: TQuery,
  direction: "after" | "before",
  cursor: string | null | undefined,
): TQuery {
  const base = clearFleetCursor(query);
  return (cursor ? { ...base, [direction]: cursor } : base) as TQuery;
}

function clearTripCursor(
  query: AdminTripDirectoryQuery,
): AdminTripDirectoryQuery {
  const { after: _after, before: _before, ...rest } = query;
  return rest;
}

function tripCursorQuery(
  query: AdminTripDirectoryQuery,
  direction: "after" | "before",
  cursor: string | null | undefined,
): AdminTripDirectoryQuery {
  const base = clearTripCursor(query);
  return cursor ? { ...base, [direction]: cursor } : base;
}

function clearCursor(
  query: AdminOperationsTaskQuery,
): AdminOperationsTaskQuery {
  const { after: _after, before: _before, ...rest } = query;
  return rest;
}

function queryWithSearch(
  query: AdminOperationsTaskQuery,
  search: string,
): AdminOperationsTaskQuery {
  const { search: _search, ...rest } = clearCursor(query);
  return search ? { ...rest, search } : rest;
}

function queryWithStatus(
  query: AdminOperationsTaskQuery,
  status: string,
): AdminOperationsTaskQuery {
  const { status: _status, ...rest } = clearCursor(query);
  return status
    ? {
        ...rest,
        status: status as NonNullable<AdminOperationsTaskQuery["status"]>,
      }
    : rest;
}

function clearOperatorCursor(
  query: AdminOperatorDirectoryQuery,
): AdminOperatorDirectoryQuery {
  const { after: _after, before: _before, ...rest } = query;
  return rest;
}

function operatorQueryWithSearch(
  query: AdminOperatorDirectoryQuery,
  search: string,
): AdminOperatorDirectoryQuery {
  const { search: _search, ...rest } = clearOperatorCursor(query);
  return search ? { ...rest, search } : rest;
}

function operatorQueryWithState(
  query: AdminOperatorDirectoryQuery,
  lifecycleState: string,
): AdminOperatorDirectoryQuery {
  const {
    lifecycleState: _lifecycleState,
    ...rest
  } = clearOperatorCursor(query);
  return lifecycleState
    ? {
        ...rest,
        lifecycleState:
          lifecycleState as NonNullable<
            AdminOperatorDirectoryQuery["lifecycleState"]
          >,
      }
    : rest;
}

function operatorCursorQuery(
  query: AdminOperatorDirectoryQuery,
  direction: "after" | "before",
  cursor: string | null | undefined,
): AdminOperatorDirectoryQuery {
  const { after: _after, before: _before, ...base } = query;
  return cursor ? { ...base, [direction]: cursor } : base;
}

function actionLabel(action: AdminOperationsTaskDetail["allowedActions"][number]): string {
  return ({
    assign: "分派任务",
    process: "处理任务",
    review: "复核任务",
  } as const)[action];
}

function auditActionLabel(
  action: AdminOperationsTaskDetail["auditTrail"][number]["action"],
): string {
  return ({
    task_created: "任务已创建",
    scope_checked: "组织范围已校验",
    task_assigned: "任务已分派",
    task_processed: "任务已处理",
    task_reviewed: "任务已复核",
  } as const)[action];
}

function operatorLifecycleLabel(
  state: AdminOperatorDirectoryQuery["lifecycleState"] | string,
): string {
  return ({
    candidate: "候选",
    onboarding_review: "准入审核中",
    pending_activation: "待激活",
    active: "正常运营",
    restricted: "受限",
    suspended: "已暂停",
    exit_pending: "退出处理中",
    exited: "已退出",
  } as Record<string, string>)[state ?? ""] ?? String(state);
}

function operatorCapabilityLabel(
  capability: AdminOperatorDetail["operator"]["capabilities"][number]["capabilityType"],
): string {
  return ({
    driver_operations: "车主运营",
    vehicle_operations: "车辆运营",
    trip_coordination: "行程协作",
    support_coordination: "客服协作",
    safety_collaboration: "安全协作",
  } as const)[capability];
}

function operatorActionLabel(
  action: AdminOperatorDetail["allowedActions"][number],
): string {
  return action === "restrict" ? "限制运营" : "恢复运营";
}

function operatorAuditActionLabel(
  action: AdminOperatorDetail["auditTrail"][number]["action"],
): string {
  return ({
    operator_profile_viewed: "查看主体详情",
    operator_restricted: "主体已限制",
    operator_reactivated: "主体已恢复",
  } as const)[action];
}

function tripStateLabel(
  state: AdminTripDirectoryQuery["authoritativeState"] | string,
): string {
  return ({
    pending_payment: "等待支付",
    paid_pending_match: "等待匹配",
    scheduled: "已计划",
    reserved: "已预约",
    preparing: "准备中",
    accepted: "已接单",
    driver_en_route: "接驾中",
    driver_arrived: "等待上车",
    in_progress: "行程中",
    safety_frozen: "安全冻结",
    completed: "已完成",
    unfulfilled: "未履约",
    cancelled: "已取消",
  } as Record<string, string>)[state ?? ""] ?? String(state);
}

function caseStateLabel(state: string): string {
  return ({
    open: "待处理",
    assigned: "已分派",
    investigating: "调查中",
    awaiting_user: "等待客户",
    awaiting_internal: "等待内部协作",
    escalated: "已升级",
    resolved: "已解决",
    closed: "已关闭",
    reopened: "已重新打开",
    unassigned: "待分派",
    awaiting_independent_review: "等待独立复核",
    completed: "已完成",
    open_frozen: "访问已冻结",
    restored: "已恢复访问",
    upheld: "维持冻结",
    requested: "等待批准",
    approved: "已批准",
    active: "使用中",
    expired: "已到期",
    revoked: "已撤销",
    denied: "未批准",
  } as Record<string, string>)[state] ?? state;
}

function caseDisplayText(value: string): string {
  return value
    .replaceAll("（合成摘要）", "")
    .replaceAll("（合成路线）", "")
    .replace(/^合成/, "");
}

function supportCategoryLabel(category: string): string {
  return ({
    trip_service: "行程服务",
    schedule: "计划行程",
    cancellation: "取消处理",
    communication: "沟通协助",
    operator_coordination: "运营公司协作",
    eligibility: "资格问题",
    safety_referral: "安全协作",
    finance_referral: "财务协作",
  } as Record<string, string>)[category] ?? category;
}

function caseActionLabel(action: AdminCaseAction): string {
  return ({
    continue_investigation: "继续调查",
    await_user: "等待客户补充",
    await_internal: "等待内部协作",
    resolve: "解决案件",
    close: "关闭案件",
    reopen: "重新打开",
    escalate_operations: "升级至运营",
    escalate_safety: "升级至安全",
    escalate_finance: "升级至财务",
    submit_investigation: "提交独立复核",
    restore_access: "恢复访问",
    uphold_freeze: "维持冻结",
    request_evidence: "申请证据访问",
    approve_evidence: "批准证据访问",
    revoke_evidence: "撤销证据访问",
  } as Record<AdminCaseAction, string>)[action];
}

function caseAuditActionLabel(
  action: AdminCaseDetail["auditTrail"][number]["action"],
): string {
  return ({
    case_profile_viewed: "查看案件详情",
    support_case_state_changed: "更新客服案件状态",
    support_case_escalated: "升级客服案件",
    safety_investigation_submitted: "提交安全调查",
    safety_restoration_reviewed: "完成安全复核",
    evidence_access_requested: "申请证据访问",
    evidence_access_approved: "批准证据访问",
    evidence_access_revoked: "撤销证据访问",
  } as const)[action];
}

function tripOperationStateLabel(state: string): string {
  return ({
    detected: "待分诊",
    triaged: "已分诊",
    coordinating: "协作中",
    awaiting_authoritative_result: "等待权威结果",
    resolved: "已解决",
    closed: "已关闭",
  } as Record<string, string>)[state] ?? state;
}

function tripPriorityLabel(priority?: string): string {
  return ({
    normal: "普通",
    high: "高",
    urgent: "紧急",
  } as Record<string, string>)[priority ?? ""] ?? "无";
}

function tripCategoryLabel(category: string): string {
  return ({
    schedule: "计划行程",
    matching: "匹配协作",
    pickup: "接驾协作",
    location: "位置异常",
    cross_operator: "跨主体协作",
    unknown_result: "未知结果恢复",
  } as Record<string, string>)[category] ?? category;
}

function tripActionLabel(action: AdminTripOperationAction): string {
  return action === "triage" ? "分诊运营任务" : "请求权威领域处理";
}

function tripAuditActionLabel(
  action: AdminTripDetail["auditTrail"][number]["action"],
): string {
  return ({
    trip_profile_viewed: "查看行程详情",
    trip_operation_triaged: "运营任务已分诊",
    trip_domain_action_requested: "已请求权威领域处理",
  } as const)[action];
}

function operationIdentifier(
  resourceId: string,
  action: string,
): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? `admin-operation-${resourceId}-${action}-${crypto.randomUUID()}`
    : `admin-operation-${resourceId}-${action}-${Date.now()}`;
}
