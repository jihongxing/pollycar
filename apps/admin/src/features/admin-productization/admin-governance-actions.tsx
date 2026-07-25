import {
  useRef,
  type ReactNode,
} from "react";
import { FocusTrapDialog } from "../../components/focus-trap-dialog";

export function AdminWorkScopeCard({
  organizationName,
  cityScopes,
  roleName,
  actions,
}: Readonly<{
  organizationName: string;
  cityScopes: readonly string[];
  roleName?: string;
  actions: readonly string[];
}>) {
  return (
    <article className="detail-card admin-work-scope">
      <h2>你的工作范围</h2>
      <dl className="detail-list">
        <div>
          <dt>负责范围</dt>
          <dd>
            {organizationName}
            {cityScopes.length ? ` · ${cityScopes.join("、")}` : ""}
          </dd>
        </div>
        {roleName ? (
          <div>
            <dt>当前职责</dt>
            <dd>{roleName}</dd>
          </div>
        ) : null}
      </dl>
      <div className="admin-work-scope-actions" aria-label="本次可处理事项">
        <strong>本次可处理事项</strong>
        {actions.length ? (
          <div className="permission-list">
            {actions.map((action) => <span key={action}>{action}</span>)}
          </div>
        ) : (
          <p>当前可以查看信息，暂无需要执行的操作。</p>
        )}
      </div>
    </article>
  );
}

export function AdminRiskConfirmationDialog({
  titleId,
  title,
  objectLabel,
  scope,
  reversible,
  consequence,
  confirmLabel,
  tone = "danger",
  busy,
  fields,
  onCancel,
  onConfirm,
}: Readonly<{
  titleId: string;
  title: string;
  objectLabel: string;
  scope: string;
  reversible: string;
  consequence: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  busy: boolean;
  fields?: ReactNode;
  onCancel(): void;
  onConfirm(): void;
}>) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <FocusTrapDialog
      titleId={titleId}
      busy={busy}
      initialFocusRef={cancelButtonRef}
      onClose={onCancel}
    >
      <div className="admin-risk-dialog-heading">
        <span className="eyebrow">请再次确认</span>
        <h2 id={titleId}>{title}</h2>
        <p>{objectLabel}</p>
      </div>
      <dl className="admin-risk-dialog-summary">
        <div><dt>影响范围</dt><dd>{scope}</dd></div>
        <div><dt>是否可恢复</dt><dd>{reversible}</dd></div>
        <div><dt>完成后</dt><dd>{consequence}</dd></div>
      </dl>
      {fields ? <div className="admin-risk-dialog-fields">{fields}</div> : null}
      <div className="admin-risk-dialog-actions">
        <button
          ref={cancelButtonRef}
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          返回检查
        </button>
        <button
          type="button"
          className={`${tone}-action`}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "正在确认…" : confirmLabel}
        </button>
      </div>
    </FocusTrapDialog>
  );
}
