import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AdminProductSession,
  AdminProductizationClient,
  AdminVehicleDetail,
  AdminVehicleDirectoryPage,
  AdminVehicleDirectoryQuery,
  AdminVehicleReviewAction,
} from "@pollycar/contracts";
import { FocusTrapDialog } from "../../components/focus-trap-dialog";

const listStateStoragePrefix = "pollycar.admin.list-state";

type VehicleDialog =
  | { action: "approve" }
  | { action: "reject" }
  | { action: "request_material" };

export function VehicleReviewWorkspace({
  session,
  client,
  selectedVehicleId,
  onSelectVehicle,
  onOpenDriver,
}: Readonly<{
  session: AdminProductSession;
  client: AdminProductizationClient;
  selectedVehicleId?: string;
  onSelectVehicle(vehicleId?: string): void;
  onOpenDriver(driverAccountId: string): void;
}>) {
  const storageKey =
    `${listStateStoragePrefix}.${session.workIdentity.workIdentityId}.fleet.vehicles`;
  const restored = useMemo(
    () => readVehicleListState(storageKey),
    [storageKey],
  );
  const [query, setQuery] = useState<AdminVehicleDirectoryQuery>(
    restored?.query ?? { pageSize: 25, sort: "updated_at_desc" },
  );
  const [page, setPage] = useState<AdminVehicleDirectoryPage>();
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string>();
  const vehicleRowRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    let active = true;
    setListLoading(true);
    setListError(undefined);
    writeVehicleListState(storageKey, query);
    client.listVehicles(session.accessToken, query)
      .then((value) => {
        if (active) setPage(value);
      })
      .catch((reason) => {
        if (active) setListError(messageFor(reason));
      })
      .finally(() => {
        if (active) setListLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, query, session.accessToken, storageKey]);

  function updateQuery(next: AdminVehicleDirectoryQuery) {
    setQuery(next);
    writeVehicleListState(storageKey, next);
  }

  function clearSelection() {
    const vehicleId = selectedVehicleId;
    onSelectVehicle(undefined);
    requestAnimationFrame(() => {
      if (vehicleId) vehicleRowRefs.current.get(vehicleId)?.focus();
    });
  }

  return (
    <section className="vehicle-review-workspace" aria-label="车辆审核主从工作区">
      <section className="vehicle-review-master" aria-label="车辆审核列表">
        <header className="vehicle-review-master-heading">
          <div>
            <span className="eyebrow">车辆审核</span>
            <h2>车辆名录</h2>
          </div>
          <span>{page?.summary.openReviewTasks ?? 0} 项待审核</span>
        </header>
        <div className="vehicle-review-filters">
          <label>
            <span>搜索车辆</span>
            <input
              value={query.search ?? ""}
              placeholder="车牌或车辆"
              onChange={(event) => {
                const next = withoutVehicleCursor(query);
                updateQuery({
                  ...next,
                  ...(event.target.value ? { search: event.target.value } : {}),
                });
              }}
            />
          </label>
          <label>
            <span>审核状态</span>
            <select
              value={query.reviewState ?? ""}
              onChange={(event) => {
                const next = withoutVehicleCursor(query);
                const reviewState = event.target.value;
                updateQuery({
                  ...next,
                  ...(reviewState
                    ? {
                        reviewState:
                          reviewState as NonNullable<
                            AdminVehicleDirectoryQuery["reviewState"]
                          >,
                      }
                    : {}),
                });
              }}
            >
              <option value="">全部状态</option>
              <option value="under_review">审核中</option>
              <option value="changes_requested">待补充</option>
              <option value="approved">已通过</option>
              <option value="rejected">未通过</option>
            </select>
          </label>
        </div>
        <div className="vehicle-review-list">
          {listLoading ? (
            <p className="state-line">正在加载车辆名录…</p>
          ) : listError ? (
            <div className="vehicle-review-list-state" role="alert">
              <strong>车辆名录加载失败</strong>
              <span>{listError}</span>
              <button type="button" onClick={() => setQuery({ ...query })}>重试</button>
            </div>
          ) : page?.items.length ? (
            page.items.map((vehicle) => {
              const selected = vehicle.vehicleId === selectedVehicleId;
              return (
                <article
                  key={vehicle.vehicleId}
                  className={`vehicle-review-row${selected ? " selected" : ""}`}
                >
                  <span>
                    <strong>{vehicle.plateMasked}</strong>
                    <small>{vehicle.vehicleSummary}</small>
                  </span>
                  <span>
                    <strong>{vehicleReviewLabel(vehicle.reviewState)}</strong>
                    <small>{vehicle.operatorName}</small>
                  </span>
                  <button
                    ref={(element) => {
                      if (element) {
                        vehicleRowRefs.current.set(vehicle.vehicleId, element);
                      } else {
                        vehicleRowRefs.current.delete(vehicle.vehicleId);
                      }
                    }}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectVehicle(vehicle.vehicleId)}
                  >
                    查看详情
                  </button>
                </article>
              );
            })
          ) : (
            <div className="vehicle-review-list-state">
              <strong>没有符合条件的车辆</strong>
              <span>调整搜索或审核状态后再试。</span>
            </div>
          )}
        </div>
        {page ? (
          <div className="vehicle-review-pagination">
            <button
              type="button"
              disabled={!page.pageInfo.hasPreviousPage}
              onClick={() => {
                const next = withoutVehicleCursor(query);
                updateQuery({
                  ...next,
                  ...(page.pageInfo.startCursor
                    ? { before: page.pageInfo.startCursor }
                    : {}),
                });
              }}
            >
              上一页
            </button>
            <span>约 {page.pageInfo.approximateTotal} 辆</span>
            <button
              type="button"
              disabled={!page.pageInfo.hasNextPage}
              onClick={() => {
                const next = withoutVehicleCursor(query);
                updateQuery({
                  ...next,
                  ...(page.pageInfo.endCursor
                    ? { after: page.pageInfo.endCursor }
                    : {}),
                });
              }}
            >
              下一页
            </button>
          </div>
        ) : null}
      </section>
      <section className="vehicle-review-detail" aria-label="车辆审核详情">
        {selectedVehicleId ? (
          <VehicleReviewDetail
            session={session}
            client={client}
            vehicleId={selectedVehicleId}
            onBack={clearSelection}
            onOpenDriver={onOpenDriver}
          />
        ) : (
          <div className="vehicle-review-empty">
            <span aria-hidden="true">↗</span>
            <h2>选择一辆车开始检查</h2>
            <p>列表会保留当前位置，完成审核后可以继续处理下一辆车。</p>
          </div>
        )}
      </section>
    </section>
  );
}

function VehicleReviewDetail({
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
  const [dialog, setDialog] = useState<VehicleDialog>();
  const [operationState, setOperationState] = useState<
    "idle" | "pending" | "confirmed" | "unknown" | "error"
  >("idle");
  const [operationMessage, setOperationMessage] = useState<string>();
  const [materialReason, setMaterialReason] =
    useState("insurance_expiry_incomplete");
  const [rejectionReason, setRejectionReason] =
    useState("vehicle_age_exceeded");
  const operationLockRef = useRef(false);

  async function refresh() {
    setError(undefined);
    try {
      setDetail(await client.getVehicle(session.accessToken, vehicleId));
    } catch (reason) {
      setError(messageFor(reason));
    }
  }

  useEffect(() => {
    setDetail(undefined);
    setDialog(undefined);
    setOperationState("idle");
    setOperationMessage(undefined);
    void refresh();
  }, [client, session.accessToken, vehicleId]);

  async function execute(action: AdminVehicleReviewAction) {
    if (!detail?.reviewTask || operationLockRef.current) return;
    operationLockRef.current = true;
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
          expectedVehicleReviewVersion: detail.reviewTask.vehicleReviewVersion,
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
      setDialog(undefined);
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
    } finally {
      operationLockRef.current = false;
    }
  }

  if (error) {
    return (
      <div className="vehicle-review-detail-state" role="alert">
        <h2>车辆详情加载失败</h2>
        <p>{error}</p>
        <div>
          <button type="button" onClick={onBack}>返回列表</button>
          <button className="primary-action" type="button" onClick={() => void refresh()}>
            重试
          </button>
        </div>
      </div>
    );
  }
  if (!detail) return <p className="state-line">正在加载车辆详情…</p>;

  return (
    <>
      <header className="vehicle-review-detail-heading">
        <button className="back-action" type="button" onClick={onBack}>
          ← 返回车辆列表
        </button>
        <div>
          <span className="eyebrow">车辆审核详情</span>
          <h2>{detail.vehicle.plateMasked}</h2>
          <p>{detail.vehicle.vehicleSummary}</p>
        </div>
        <span className={`status-pill ${vehicleStatusTone(detail.vehicle.reviewState)}`}>
          {vehicleReviewLabel(detail.vehicle.reviewState)}
        </span>
      </header>
      <div className="vehicle-review-detail-scroll">
        <article className="detail-card">
          <h3>车辆与归属</h3>
          <dl className="detail-list">
            <div>
              <dt>车主</dt>
              <dd>
                <button
                  className="text-action"
                  type="button"
                  onClick={() => onOpenDriver(detail.driver.driverAccountId)}
                >
                  {detail.driver.displayNameMasked}
                </button>
              </dd>
            </div>
            <div><dt>主运营公司</dt><dd>{detail.vehicle.operatorName}</dd></div>
            <div><dt>审核版本</dt><dd>v{detail.vehicle.resourceVersion}</dd></div>
            <div><dt>临期材料</dt><dd>{detail.profile.expiringDocumentCount} 项</dd></div>
          </dl>
        </article>
        <article className="detail-card">
          <h3>材料检查</h3>
          {detail.reviewTask ? (
            <dl className="detail-list">
              <div><dt>任务状态</dt><dd>{reviewTaskStatusLabel(detail.reviewTask.status)}</dd></div>
              <div><dt>保险有效期</dt><dd>{reviewFieldLabel(detail.reviewTask.insuranceExpiryStatus)}</dd></div>
              <div><dt>车辆授权材料</dt><dd>{reviewFieldLabel(detail.reviewTask.authorizationEvidenceStatus)}</dd></div>
              <div><dt>附件校验</dt><dd>{reviewFieldLabel(detail.reviewTask.attachmentValidationStatus)}</dd></div>
            </dl>
          ) : <p>该车辆当前没有开放审核任务。</p>}
        </article>
        <article className="detail-card detail-audit">
          <h3>审核记录</h3>
          {detail.auditTrail.length ? (
            <ol>
              {detail.auditTrail.map((event) => (
                <li key={event.id}>
                  <div><strong>{reviewAuditLabel(event.action)}</strong><small>{event.reasonCode}</small></div>
                  <span>{event.actorId} · {formatDate(event.occurredAt)}</span>
                </li>
              ))}
            </ol>
          ) : <p>尚无审核操作记录。</p>}
        </article>
      </div>
      <footer className="vehicle-review-sticky-actions">
        <div>
          {operationMessage ? (
            <div
              className={`operation-result operation-${operationState}`}
              role={operationState === "error" ? "alert" : "status"}
            >
              {operationMessage}
              {operationState === "unknown" ? (
                <button className="text-action" type="button" onClick={() => void refresh()}>
                  查询最新结果
                </button>
              ) : null}
            </div>
          ) : <span>请先核对材料，再提交审核结论。</span>}
        </div>
        <div>
          {detail.allowedActions.includes("claim") ? (
            <button
              className="primary-action"
              type="button"
              disabled={operationState === "pending"}
              onClick={() => void execute("claim")}
            >
              认领审核任务
            </button>
          ) : null}
          {detail.allowedActions.includes("request_material") ? (
            <button
              type="button"
              disabled={operationState === "pending"}
              onClick={() => setDialog({ action: "request_material" })}
            >
              要求补充材料
            </button>
          ) : null}
          {detail.allowedActions.includes("reject") ? (
            <button
              className="danger-action"
              type="button"
              disabled={operationState === "pending"}
              onClick={() => setDialog({ action: "reject" })}
            >
              拒绝申请
            </button>
          ) : null}
          {detail.allowedActions.includes("approve") ? (
            <button
              className="primary-action"
              type="button"
              disabled={operationState === "pending"}
              onClick={() => setDialog({ action: "approve" })}
            >
              通过车辆审核
            </button>
          ) : null}
        </div>
      </footer>
      {dialog ? (
        <VehicleDecisionDialog
          dialog={dialog}
          detail={detail}
          busy={operationState === "pending"}
          materialReason={materialReason}
          rejectionReason={rejectionReason}
          onMaterialReason={setMaterialReason}
          onRejectionReason={setRejectionReason}
          onClose={() => setDialog(undefined)}
          onConfirm={() => void execute(dialog.action)}
        />
      ) : null}
    </>
  );
}

function VehicleDecisionDialog({
  dialog,
  detail,
  busy,
  materialReason,
  rejectionReason,
  onMaterialReason,
  onRejectionReason,
  onClose,
  onConfirm,
}: Readonly<{
  dialog: VehicleDialog;
  detail: AdminVehicleDetail;
  busy: boolean;
  materialReason: string;
  rejectionReason: string;
  onMaterialReason(reason: string): void;
  onRejectionReason(reason: string): void;
  onClose(): void;
  onConfirm(): void;
}>) {
  const title =
    dialog.action === "approve"
      ? "通过车辆审核"
      : dialog.action === "reject"
        ? "拒绝车辆申请"
        : "要求补充材料";
  return (
    <FocusTrapDialog titleId="vehicle-review-dialog-title" busy={busy} onClose={onClose}>
      <button
        className="dialog-safe-return"
        type="button"
        disabled={busy}
        onClick={onClose}
      >
        ← 返回检查
      </button>
      <div className="vehicle-review-dialog-heading">
        <span className="eyebrow">确认审核结论</span>
        <h2 id="vehicle-review-dialog-title">{title}</h2>
        <p>{detail.vehicle.plateMasked} · {detail.vehicle.vehicleSummary}</p>
      </div>
      <dl className="vehicle-review-dialog-summary">
        <div><dt>保险有效期</dt><dd>{reviewFieldLabel(detail.reviewTask?.insuranceExpiryStatus ?? "incomplete")}</dd></div>
        <div><dt>车辆授权材料</dt><dd>{reviewFieldLabel(detail.reviewTask?.authorizationEvidenceStatus ?? "incomplete")}</dd></div>
        <div><dt>附件校验</dt><dd>{reviewFieldLabel(detail.reviewTask?.attachmentValidationStatus ?? "invalid")}</dd></div>
      </dl>
      {dialog.action === "request_material" ? (
        <label className="vehicle-review-dialog-field">
          <span>需要补充</span>
          <select value={materialReason} onChange={(event) => onMaterialReason(event.target.value)}>
            <option value="insurance_expiry_incomplete">完整的保险有效期</option>
            <option value="authorization_evidence_incomplete">完整的车辆授权材料</option>
            <option value="synthetic_attachment_invalid">可正常查看的附件</option>
          </select>
        </label>
      ) : null}
      {dialog.action === "reject" ? (
        <label className="vehicle-review-dialog-field">
          <span>未通过原因</span>
          <select value={rejectionReason} onChange={(event) => onRejectionReason(event.target.value)}>
            <option value="vehicle_age_exceeded">车龄不符合参与条件</option>
            <option value="vehicle_mileage_exceeded">车辆里程不符合参与条件</option>
            <option value="insurance_requirement_not_met">保险条件不满足要求</option>
            <option value="authorization_remaining_insufficient">车辆授权有效期不足</option>
          </select>
        </label>
      ) : null}
      <p className="vehicle-review-dialog-note">
        {dialog.action === "approve"
          ? "确认后车辆将进入已通过状态，本次审核结论会保留在操作记录中。"
          : dialog.action === "reject"
            ? "确认后申请人可以查看未通过结果，并按产品流程重新准备材料。"
            : "确认后申请人会收到需要补充的内容，当前审核任务将等待材料更新。"}
      </p>
      <div className="actions">
        <button type="button" disabled={busy} onClick={onClose}>取消</button>
        <button
          className={dialog.action === "reject" ? "danger-action" : "primary-action"}
          type="button"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "正在确认" : title}
        </button>
      </div>
    </FocusTrapDialog>
  );
}

function readVehicleListState(storageKey: string) {
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as { query: AdminVehicleDirectoryQuery };
  } catch {
    return undefined;
  }
}

function writeVehicleListState(
  storageKey: string,
  query: AdminVehicleDirectoryQuery,
) {
  sessionStorage.setItem(storageKey, JSON.stringify({ query }));
}

function withoutVehicleCursor(query: AdminVehicleDirectoryQuery) {
  const {
    after: _after,
    before: _before,
    search,
    reviewState,
    ...stable
  } = query;
  return {
    ...stable,
    ...(search ? { search } : {}),
    ...(reviewState ? { reviewState } : {}),
  } satisfies AdminVehicleDirectoryQuery;
}

function messageFor(reason: unknown) {
  if (!(reason instanceof Error)) return "暂时无法完成，请稍后重试。";
  if (reason.message === "SERVICE_UNAVAILABLE") {
    return "服务暂时不可用，请稍后重试。";
  }
  return reason.message;
}

function vehicleReviewLabel(state: string) {
  if (state === "approved") return "已通过";
  if (state === "under_review") return "审核中";
  if (state === "changes_requested") return "待补充";
  if (state === "rejected") return "未通过";
  return "待提交";
}

function vehicleStatusTone(state: string) {
  if (state === "approved") return "status-approved";
  if (state === "rejected") return "status-blocked";
  if (state === "changes_requested") return "status-waiting_review";
  return "status-processing";
}

function reviewTaskStatusLabel(state: string) {
  if (state === "available") return "待认领";
  if (state === "claimed") return "审核中";
  if (state === "waiting_user") return "等待补充";
  return "已完成";
}

function reviewFieldLabel(state: string) {
  if (state === "complete") return "完整";
  if (state === "valid") return "有效";
  if (state === "invalid") return "无法使用";
  return "需要补充";
}

function reviewAuditLabel(action: string) {
  if (action === "task_claimed") return "审核任务已认领";
  if (action === "material_requested") return "已要求补充材料";
  if (action === "vehicle_approved") return "车辆审核已通过";
  if (action === "vehicle_rejected") return "车辆申请未通过";
  return "查看车辆审核";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
