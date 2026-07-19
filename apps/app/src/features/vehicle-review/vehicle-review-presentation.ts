import type { VehicleReviewView } from "@pollycar/contracts";

export type VehicleReviewTimelinePresentation = Readonly<{
  label: string;
  value: string;
  detail?: string;
  tone: "driver" | "neutral" | "safety";
}>;

const timelineLabels = {
  submitted: "资料已提交",
  review_started: "审核已开始",
  material_requested: "需要补充资料",
  material_resubmitted: "补充资料已提交",
  approved: "审核已完成",
} as const;

export function vehicleReviewTimeline(
  review: VehicleReviewView,
): readonly VehicleReviewTimelinePresentation[] {
  const items = review.timeline.map((item) => ({
    label: timelineLabels[item.code],
    value: formatVehicleReviewDate(item.occurredAt),
    detail:
      item.code === "material_requested"
        ? "请按页面提示补充当前缺少的信息"
        : item.state === "current"
          ? "当前正在处理"
          : undefined,
    tone: item.code === "material_requested" ? "safety" as const : "driver" as const,
  }));

  if (review.status === "under_review" && !items.some((item) => item.detail === "当前正在处理")) {
    return [
      ...items,
      {
        label: "等待审核结果",
        value: "当前无需操作",
        detail: "状态变化后可从账户与身份入口继续",
        tone: "driver",
      },
    ];
  }

  return items;
}

export function vehicleReviewEntryCopy(status: VehicleReviewView["status"]): Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
}> {
  if (status === "under_review") {
    return {
      eyebrow: "车主申请 · 审核中",
      title: "资料正在审核",
      description: "当前无需重复提交，可以随时回来查看最新结果。",
      actionLabel: "查看审核进度",
    };
  }
  if (status === "needs_material") {
    return {
      eyebrow: "车主申请 · 待补充",
      title: "还需要补充一项资料",
      description: "完成当前缺少的信息后，审核会继续进行。",
      actionLabel: "继续补充资料",
    };
  }
  if (status === "approved") {
    return {
      eyebrow: "车主申请 · 已完成",
      title: "车辆审核已完成",
      description: "可以进入车主身份，继续确认参与资格和当前可用状态。",
      actionLabel: "查看审核结果",
    };
  }
  if (status === "appealing") {
    return {
      eyebrow: "车主申请 · 复核中",
      title: "申请正在复核",
      description: "当前无需重复提交，结果更新后会显示下一步。",
      actionLabel: "查看当前状态",
    };
  }
  if (status === "suspended") {
    return {
      eyebrow: "车主申请 · 暂停",
      title: "车主身份暂不可用",
      description: "请先查看当前限制和可执行的恢复路径。",
      actionLabel: "查看当前状态",
    };
  }
  if (status === "revoked" || status === "expired") {
    return {
      eyebrow: "车主申请 · 需重新确认",
      title: "当前申请无法继续使用",
      description: "请查看原因和下一步，再决定是否重新准备申请。",
      actionLabel: "查看申请说明",
    };
  }
  return {
    eyebrow: "成为车主",
    title: "先确认参与方式，再准备车辆",
    description: "PollyCar 面向非职业、偶发参与的车主。申请前请了解责任、联系和车辆要求。",
    actionLabel: "开始准备",
  };
}

export function vehicleReviewStatusLabel(status: VehicleReviewView["status"]): string {
  if (status === "draft") return "准备中";
  if (status === "under_review") return "审核中";
  if (status === "needs_material") return "待补充";
  if (status === "approved") return "审核完成";
  if (status === "suspended") return "暂不可用";
  if (status === "appealing") return "复核中";
  if (status === "revoked") return "已停止";
  return "已到期";
}

export function vehicleReviewMaterialCopy(review: VehicleReviewView): Readonly<{
  title: string;
  description: string;
}> {
  const insuranceRequested =
    review.requestedMaterialCodes.length === 0 ||
    review.requestedMaterialCodes.some((code) => code.toLowerCase().includes("insurance"));
  return insuranceRequested
    ? {
        title: "更新保险有效期",
        description: "当前日期信息不完整。补充有效日期后，其他已确认内容会保持不变。",
      }
    : {
        title: "补充车辆资料",
        description: "请按当前提示补充缺少的信息，其他已确认内容会保持不变。",
      };
}

export function formatVehicleReviewDate(value: string | undefined): string {
  if (!value) return "等待处理";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "等待处理";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
