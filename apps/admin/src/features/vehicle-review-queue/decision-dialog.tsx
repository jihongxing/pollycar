import type { RejectVehicleReviewAdminCommand } from "@pollycar/contracts";
import { FocusTrapDialog } from "../../components/focus-trap-dialog";

const rejectionLabels: Record<RejectVehicleReviewAdminCommand["reasonCode"], string> = {
  vehicle_age_exceeded: "车辆年限超出准入范围",
  vehicle_mileage_exceeded: "车辆里程超出准入范围",
  insurance_requirement_not_met: "保险条件不符合要求",
  authorization_remaining_insufficient: "车辆授权剩余期限不足",
};

const decisionMessages = {
  approved_standard: {
    title: "车辆审核已通过",
    body: "您的合成车辆资料已通过内部沙箱审核。真实接单、邀请和生产能力仍保持关闭。",
  },
  vehicle_age_exceeded: {
    title: "车辆暂不符合准入标准",
    body: "当前车辆年限不符合内部沙箱准入规则，本次合成申请未通过。",
  },
  vehicle_mileage_exceeded: {
    title: "车辆暂不符合准入标准",
    body: "当前车辆里程不符合内部沙箱准入规则，本次合成申请未通过。",
  },
  insurance_requirement_not_met: {
    title: "保险条件暂不符合要求",
    body: "当前保险条件不符合内部沙箱准入规则，本次合成申请未通过。",
  },
  authorization_remaining_insufficient: {
    title: "车辆授权期限不足",
    body: "当前车辆授权剩余期限不符合内部沙箱准入规则，本次合成申请未通过。",
  },
} as const;

export function DecisionDialog({
  mode,
  reason,
  busy,
  onReason,
  onSubmit,
  onClose,
}: Readonly<{
  mode: "approve" | "reject";
  reason: RejectVehicleReviewAdminCommand["reasonCode"];
  busy: boolean;
  onReason(reason: RejectVehicleReviewAdminCommand["reasonCode"]): void;
  onSubmit(): void;
  onClose(): void;
}>) {
  const message =
    mode === "approve"
      ? decisionMessages.approved_standard
      : decisionMessages[reason];
  return (
    <FocusTrapDialog titleId="decision-title" busy={busy} onClose={onClose}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">审核结论</span>
            <h2 id="decision-title">{mode === "approve" ? "确认批准车辆" : "确认拒绝车辆"}</h2>
          </div>
          <button className="ghost" onClick={onClose}>关闭</button>
        </div>
        {mode === "reject" ? (
          <label>
            结构化拒绝原因
            <select
              value={reason}
              onChange={(event) =>
                onReason(event.target.value as RejectVehicleReviewAdminCommand["reasonCode"])
              }
            >
              {Object.entries(rejectionLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
        ) : null}
        <section className="preview" aria-label="审核结论用户文案预览">
          <span>用户可见文案预览</span>
          <h3>{message.title}</h3>
          <p>{message.body}</p>
        </section>
        <p className="hint">提交后任务将结束并释放当前租约；结果只作用于合成数据。</p>
        <div className="actions">
          <button className="ghost" onClick={onClose}>取消</button>
          <button
            className={mode === "approve" ? "primary" : "danger-button"}
            disabled={busy}
            onClick={onSubmit}
          >
            {busy ? "正在提交…" : mode === "approve" ? "确认批准" : "确认拒绝"}
          </button>
        </div>
    </FocusTrapDialog>
  );
}
