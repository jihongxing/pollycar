import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  AdminGlobalSearchResponse,
  AdminProductizationClient,
  AdminProductSession,
} from "@pollycar/contracts";

export function GlobalSearch({
  session,
  client,
  onNavigate,
}: Readonly<{
  session: AdminProductSession;
  client: Pick<AdminProductizationClient, "searchAcrossDomains">;
  onNavigate(route: string): void;
}>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AdminGlobalSearchResponse>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const restoreOnCloseRef = useRef(false);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        restoreFocusRef.current = focusOrigin(triggerRef.current);
        setOpen(true);
      }
      if (event.key === "Escape" && open) closeSearch();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      return;
    }
    if (!restoreOnCloseRef.current) return;
    restoreOnCloseRef.current = false;
    const restoreTarget = restoreFocusRef.current;
    if (restoreTarget?.isConnected) {
      restoreTarget.focus();
      return;
    }
    triggerRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;
    const backdrop = panel.closest(".global-search-backdrop");
    const siblings = Array.from(document.body.children).filter(
      (element) => element !== backdrop,
    );
    const addedInert = siblings.filter(
      (element) => !element.hasAttribute("inert"),
    );
    addedInert.forEach((element) => element.setAttribute("inert", ""));
    const focusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      addedInert.forEach((element) => element.removeAttribute("inert"));
    };
  }, [open]);

  useEffect(() => {
    const normalized = query.trim();
    const sequence = ++requestSequenceRef.current;
    setError(undefined);
    if (normalized.length < 2) {
      setLoading(false);
      setResult(undefined);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      client
        .searchAcrossDomains(session.accessToken, {
          query: normalized,
          limitPerDomain: 5,
        })
        .then((next) => {
          if (requestSequenceRef.current === sequence) setResult(next);
        })
        .catch(() => {
          if (requestSequenceRef.current === sequence) {
            setResult(undefined);
            setError("暂时无法搜索，请稍后重试。");
          }
        })
        .finally(() => {
          if (requestSequenceRef.current === sequence) setLoading(false);
        });
    }, 240);
    return () => window.clearTimeout(timer);
  }, [client, query, session.accessToken]);

  function openSearch() {
    restoreFocusRef.current = focusOrigin(triggerRef.current);
    setOpen(true);
  }

  function closeSearch() {
    requestSequenceRef.current += 1;
    restoreOnCloseRef.current = true;
    setQuery("");
    setResult(undefined);
    setError(undefined);
    setLoading(false);
    setOpen(false);
  }

  return (
    <div className="global-search">
      <button
        ref={triggerRef}
        type="button"
        className="global-search-trigger"
        aria-expanded={open}
        aria-controls="global-search-panel"
        onClick={openSearch}
      >
        全局搜索 <kbd>/</kbd>
      </button>
      {open ? createPortal(
        <div className="global-search-backdrop" role="presentation">
          <div
            ref={panelRef}
            id="global-search-panel"
            className="global-search-panel"
            role="dialog"
            aria-modal="true"
            aria-label="全局搜索"
            tabIndex={-1}
          >
            <input
              ref={inputRef}
              aria-label="搜索后台记录"
              placeholder="搜索任务、行程、案件或成员"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div
              className="global-search-results"
              aria-live="polite"
              aria-busy={loading}
            >
              {loading ? <p>正在搜索当前工作范围…</p> : null}
              {!loading && error ? <p role="alert">{error}</p> : null}
              {!loading && !error && query.trim().length < 2 ? (
                <p>输入至少两个字开始搜索。</p>
              ) : null}
              {!loading && !error && result?.totalResults === 0 ? (
                <p>当前工作范围内没有匹配结果。</p>
              ) : null}
              {!loading && !error ? result?.groups.map((group) => (
                <section key={group.domain} className="global-search-group">
                  <header>
                    <h2>{group.label}</h2>
                    <span>{group.hasMore ? "显示前 5 项" : `${group.items.length} 项`}</span>
                  </header>
                  {group.items.map((item) => (
                    <button
                      key={`${item.kind}:${item.resultId}`}
                      type="button"
                      onClick={() => {
                        onNavigate(item.route);
                        closeSearch();
                      }}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </button>
                  ))}
                </section>
              )) : null}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function focusOrigin(fallback: HTMLElement | null): HTMLElement | null {
  return document.activeElement instanceof HTMLElement &&
    document.activeElement !== document.body
    ? document.activeElement
    : fallback;
}
