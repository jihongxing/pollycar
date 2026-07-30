import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type {
  AdminNavigationDomain,
  AdminProductizationClient,
  AdminProductSession,
  AdminWorkIdentitySummary,
} from "@pollycar/contracts";
import { GlobalSearch } from "../../components/global-search";
import { useTheme } from "../../theme/theme-provider";

export function ProductizedAdminLayout({
  session,
  client,
  page,
  workIdentities,
  identitySwitchAvailable,
  onNavigate,
  onNavigateRoute,
  onSwitchIdentity,
  onLogout,
  navigationIcon,
  children,
}: Readonly<{
  session: AdminProductSession;
  client: Pick<AdminProductizationClient, "searchAcrossDomains">;
  page: AdminNavigationDomain;
  workIdentities: readonly AdminWorkIdentitySummary[];
  identitySwitchAvailable: boolean;
  onNavigate(page: AdminNavigationDomain): void;
  onNavigateRoute(route: string): void;
  onSwitchIdentity(workIdentityId: string): Promise<void>;
  onLogout(): Promise<void>;
  navigationIcon(page: AdminNavigationDomain): string;
  children: ReactNode;
}>) {
  const { theme, toggle } = useTheme();

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
                <span className="nav-icon">{navigationIcon(navigationItem.id)}</span>
                {navigationItem.label}
                {navigationItem.availability !== "available"
                  ? <small>功能暂未开放</small>
                  : null}
              </button>
            ))}
        </nav>
        <div className="sidebar-account">
          <strong>{session.workIdentity.organizationName}</strong>
          <span>{session.workIdentity.positionName}</span>
          <button onClick={() => void onLogout()}>退出登录</button>
        </div>
      </aside>
      <div className="product-main">
        <header className="product-topbar">
          <WorkIdentityMenu
            currentIdentity={session.workIdentity}
            identities={workIdentities}
            switchAvailable={identitySwitchAvailable}
            onSwitch={onSwitchIdentity}
          />
          <div className="product-topbar-actions">
            <GlobalSearch
              session={session}
              client={client}
              onNavigate={onNavigateRoute}
            />
            <button onClick={toggle}>
              {theme === "light" ? "切换深色外观" : "切换浅色外观"}
            </button>
          </div>
        </header>
        <main className="product-content">{children}</main>
      </div>
    </div>
  );
}

function WorkIdentityMenu({
  currentIdentity,
  identities,
  switchAvailable,
  onSwitch,
}: Readonly<{
  currentIdentity: AdminWorkIdentitySummary;
  identities: readonly AdminWorkIdentitySummary[];
  switchAvailable: boolean;
  onSwitch(workIdentityId: string): Promise<void>;
}>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [selectedIdentity, setSelectedIdentity] =
    useState<AdminWorkIdentitySummary>();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string>();

  const availableIdentities = identities.length ? identities : [currentIdentity];

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || switching) return;
      event.preventDefault();
      closeMenu();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, switching]);

  useEffect(() => {
    if (!open) return;
    if (selectedIdentity) {
      cancelRef.current?.focus();
      return;
    }
    const currentIndex = availableIdentities.findIndex(
      (identity) => identity.workIdentityId === currentIdentity.workIdentityId,
    );
    optionRefs.current[Math.max(0, currentIndex)]?.focus();
  }, [availableIdentities, currentIdentity.workIdentityId, open, selectedIdentity]);

  function closeMenu() {
    setOpen(false);
    setSelectedIdentity(undefined);
    setError(undefined);
    queueMicrotask(() => triggerRef.current?.focus());
  }

  function openMenu() {
    setOpen(true);
    setSelectedIdentity(undefined);
    setError(undefined);
  }

  function handleOptionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const lastIndex = availableIdentities.length - 1;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowDown"
            ? (index + 1) % availableIdentities.length
            : (index - 1 + availableIdentities.length) % availableIdentities.length;
    optionRefs.current[nextIndex]?.focus();
  }

  async function confirmSwitch() {
    if (!selectedIdentity || switching) return;
    setSwitching(true);
    setError(undefined);
    try {
      await onSwitch(selectedIdentity.workIdentityId);
      setOpen(false);
      setSelectedIdentity(undefined);
      queueMicrotask(() => triggerRef.current?.focus());
    } catch (reason) {
      setError(identitySwitchMessage(reason));
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="work-identity-control">
      <button
        ref={triggerRef}
        className="work-identity-trigger"
        type="button"
        aria-label={`切换工作身份，当前${currentIdentity.positionName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => open ? closeMenu() : openMenu()}
      >
        <span className="work-identity-avatar">
          {currentIdentity.positionName.slice(0, 1)}
        </span>
        <span>
          <strong>{currentIdentity.positionName}</strong>
          <small>
            {currentIdentity.organizationName} · {currentIdentity.cityScopes.join("、")}
          </small>
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open ? (
        <section className="work-identity-menu" aria-label="工作身份菜单">
          {selectedIdentity ? (
            <div className="work-identity-confirmation">
              <span className="eyebrow">确认工作范围</span>
              <h2>切换为{selectedIdentity.positionName}</h2>
              <p>
                本次工作范围为{selectedIdentity.organizationName}
                · {selectedIdentity.cityScopes.join("、")}。权限和任务将随身份更新，不会合并其他组织范围。
              </p>
              {error ? <p className="form-error" role="alert">{error}</p> : null}
              <div className="work-identity-actions">
                <button
                  ref={cancelRef}
                  type="button"
                  disabled={switching}
                  onClick={() => setSelectedIdentity(undefined)}
                >
                  返回选择
                </button>
                <button
                  className="primary-action"
                  type="button"
                  disabled={switching}
                  onClick={() => void confirmSwitch()}
                >
                  {switching ? "正在切换…" : "确认切换"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="work-identity-menu-heading">
                <strong>选择工作身份</strong>
                <span>每次只使用一个组织身份</span>
              </div>
              <div role="menu">
                {availableIdentities.map((identity, index) => {
                  const current =
                    identity.workIdentityId === currentIdentity.workIdentityId;
                  return (
                    <button
                      key={identity.workIdentityId}
                      ref={(element) => {
                        optionRefs.current[index] = element;
                      }}
                      type="button"
                      role="menuitem"
                      className="work-identity-option"
                      aria-current={current ? "true" : undefined}
                      onKeyDown={(event) => handleOptionKeyDown(event, index)}
                      onClick={() => {
                        if (current) {
                          closeMenu();
                          return;
                        }
                        setSelectedIdentity(identity);
                      }}
                    >
                      <span>
                        <strong>{identity.positionName}</strong>
                        <small>{identity.organizationName}</small>
                      </span>
                      <span>{current ? "当前身份" : "选择"}</span>
                    </button>
                  );
                })}
              </div>
              {!switchAvailable ? (
                <p className="work-identity-unavailable">
                  如需使用其他工作身份，请退出后重新完成安全验证。
                </p>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function identitySwitchMessage(reason: unknown) {
  if (
    reason instanceof Error &&
    (
      reason.message === "SELECTION_EXPIRED" ||
      reason.message === "ADMIN_WORK_IDENTITY_SELECTION_EXPIRED" ||
      reason.message === "ADMIN_AUTH_MFA_FRESHNESS_REQUIRED"
    )
  ) {
    return "本次身份验证已过期，请退出后重新登录。";
  }
  if (
    reason instanceof Error &&
    reason.message === "ADMIN_WORK_IDENTITY_FORBIDDEN"
  ) {
    return "这个工作身份已不可用，请重新登录查看当前可用身份。";
  }
  return "暂时无法切换工作身份，请稍后重试。";
}
