import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

type AdminStateTone =
  | "loading"
  | "empty"
  | "error"
  | "restricted"
  | "unavailable";

type AdminStateAction = Readonly<{
  label: string;
  onAction(): void;
  tone?: "primary" | "secondary";
}>;

export function AdminEntryShell({
  label,
  children,
}: Readonly<{
  label: string;
  children: ReactNode;
}>) {
  return (
    <main className="entry-screen admin-entry-shell" aria-label={label}>
      <div className="entry-background" aria-hidden="true" />
      {children}
    </main>
  );
}

export function AdminEntryHeader({
  eyebrow,
  title,
  description,
  showBrandMark = false,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  showBrandMark?: boolean;
}>) {
  return (
    <header className="admin-entry-header">
      {showBrandMark ? <div className="brand-mark" aria-hidden="true">P</div> : null}
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

export function AdminPageState({
  tone,
  title,
  description,
  primaryAction,
  secondaryAction,
  compact = false,
  focusOnMount = false,
}: Readonly<{
  tone: AdminStateTone;
  title: string;
  description: string;
  primaryAction?: AdminStateAction;
  secondaryAction?: AdminStateAction;
  compact?: boolean;
  focusOnMount?: boolean;
}>) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusOnMount) titleRef.current?.focus();
  }, [focusOnMount]);

  return (
    <section
      className={`admin-page-state ${compact ? "compact" : ""} ${tone}`}
      aria-labelledby={titleId}
      aria-live={
        tone === "error" || tone === "restricted" ? "assertive" : "polite"
      }
      aria-busy={tone === "loading"}
      role={tone === "error" || tone === "restricted" ? "alert" : "status"}
    >
      <span className="admin-page-state-icon" aria-hidden="true">
        {stateIcon(tone)}
      </span>
      <div className="admin-page-state-copy">
        <h2
          id={titleId}
          ref={titleRef}
          tabIndex={focusOnMount ? -1 : undefined}
        >
          {title}
        </h2>
        <p>{description}</p>
      </div>
      {primaryAction || secondaryAction ? (
        <div className="admin-page-state-actions">
          {secondaryAction ? (
            <button
              type="button"
              className={secondaryAction.tone === "primary" ? "primary-action" : "secondary-action"}
              onClick={secondaryAction.onAction}
            >
              {secondaryAction.label}
            </button>
          ) : null}
          {primaryAction ? (
            <button
              type="button"
              className={primaryAction.tone === "secondary" ? "secondary-action" : "primary-action"}
              onClick={primaryAction.onAction}
            >
              {primaryAction.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function stateIcon(tone: AdminStateTone): string {
  return ({
    loading: "…",
    empty: "○",
    error: "!",
    restricted: "↶",
    unavailable: "—",
  } as Record<AdminStateTone, string>)[tone];
}
