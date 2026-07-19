import type {
  FreeFlexTrialState,
  SafetyCaseState,
  VehicleReviewStatus,
} from "@pollycar/contracts";

export type OwnerAccessTarget =
  | "vehicle-settings"
  | "eligibility-settings"
  | "privacy-safety-settings"
  | "owner-workbench";

export type OwnerAccessPresentation = Readonly<{
  kind: "vehicle" | "eligibility" | "safety" | "ready";
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  target: OwnerAccessTarget;
}>;

export function ownerAccessPresentation(input: Readonly<{
  reviewStatus: VehicleReviewStatus;
  qualificationState: FreeFlexTrialState;
  safetyState?: SafetyCaseState;
  tripSafetyFrozen?: boolean;
}>): OwnerAccessPresentation {
  const vehicle = ownerVehicleAccessPresentation(input.reviewStatus);
  if (vehicle) return vehicle;

  const qualification = ownerQualificationAccessPresentation(input.qualificationState);
  if (qualification) return qualification;

  if (
    input.tripSafetyFrozen ||
    input.safetyState === "open_frozen" ||
    input.safetyState === "appealing" ||
    input.safetyState === "upheld"
  ) {
    return {
      kind: "safety",
      eyebrow: "车主准备 · 安全事项",
      title:
        input.safetyState === "appealing"
          ? "安全事项正在复核"
          : input.safetyState === "upheld"
            ? "当前安全限制仍然有效"
            : "先处理当前安全事项",
      description:
        input.safetyState === "appealing"
          ? "复核完成前暂不能开始新的车主任务，结果更新后会显示下一步。"
          : "当前不能开始新的车主任务，请先查看处理状态和可执行的恢复路径。",
      actionLabel: "查看安全状态",
      target: "privacy-safety-settings",
    };
  }

  return {
    kind: "ready",
    eyebrow: "车主准备 · 当前可用",
    title: "车主身份已经准备好",
    description: "可以进入车主首页查看当前任务；每次开始参与前仍会重新确认额度和安全状态。",
    actionLabel: "进入车主首页",
    target: "owner-workbench",
  };
}

export function ownerQualificationPresentation(
  state: FreeFlexTrialState,
): Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  action: "submit" | "confirm" | "refresh" | "quota";
  actionLabel: string;
}> {
  if (state === "invited") {
    return {
      eyebrow: "参与资格 · 待申请",
      title: "你的参与邀请已经准备好",
      description: "确认申请后会进入审核。申请不收费，也不会自动续期。",
      statusLabel: "待申请",
      action: "submit",
      actionLabel: "申请参与资格",
    };
  }
  if (state === "under_review") {
    return {
      eyebrow: "参与资格 · 审核中",
      title: "参与资格正在审核",
      description: "当前无需重复申请，可以离开页面并随时检查最新结果。",
      statusLabel: "审核中",
      action: "refresh",
      actionLabel: "检查最新状态",
    };
  }
  if (state === "awaiting_confirmation") {
    return {
      eyebrow: "参与资格 · 待确认",
      title: "资格已通过，等待你确认",
      description: "确认后启用 30 天参与周期，90 日内累计最多启用 60 天。",
      statusLabel: "待确认",
      action: "confirm",
      actionLabel: "确认启用 30 天资格",
    };
  }
  if (state === "active") {
    return {
      eyebrow: "参与资格 · 当前有效",
      title: "参与资格当前有效",
      description: "每次开始参与时，还会结合车辆、额度和安全状态重新确认。",
      statusLabel: "有效",
      action: "quota",
      actionLabel: "查看参与额度",
    };
  }
  if (state === "rejected") {
    return {
      eyebrow: "参与资格 · 未通过",
      title: "本次申请未通过",
      description: "当前不能启用车主参与资格。你可以检查最新状态，结果变化后会显示下一步。",
      statusLabel: "未通过",
      action: "refresh",
      actionLabel: "检查最新状态",
    };
  }
  return {
    eyebrow: "参与资格 · 已到期",
    title: "参与资格已经到期",
    description: "当前不能继续参与。请检查是否有新的邀请或更新后的处理结果。",
    statusLabel: "已到期",
    action: "refresh",
    actionLabel: "检查最新状态",
  };
}

export function ownerQualificationStatusLabel(state: FreeFlexTrialState): string {
  return ownerQualificationPresentation(state).statusLabel;
}

export function ownerSafetyPresentation(input: Readonly<{
  safetyState?: SafetyCaseState;
  tripSafetyFrozen?: boolean;
}>): Readonly<{
  title: string;
  description: string;
  statusLabel: string;
  needsAction: boolean;
}> {
  if (input.safetyState === "appealing") {
    return {
      title: "安全事项正在复核",
      description: "复核期间暂不能开始新的车主任务，结果更新后会显示下一步。",
      statusLabel: "复核中",
      needsAction: true,
    };
  }
  if (input.safetyState === "upheld") {
    return {
      title: "当前安全限制仍然有效",
      description: "请查看处理结果和当前可以采取的下一步。",
      statusLabel: "限制中",
      needsAction: true,
    };
  }
  if (input.tripSafetyFrozen || input.safetyState === "open_frozen") {
    return {
      title: "当前有一项安全事项需要处理",
      description: "相关行程和新的车主任务暂时停止，请先查看处理状态。",
      statusLabel: "待处理",
      needsAction: true,
    };
  }
  return {
    title: "当前没有待处理的安全事项",
    description: "开始新的车主任务前，系统仍会重新确认账户和行程安全状态。",
    statusLabel: "正常",
    needsAction: false,
  };
}

function ownerVehicleAccessPresentation(
  status: VehicleReviewStatus,
): OwnerAccessPresentation | undefined {
  if (status === "approved") return undefined;
  if (status === "under_review") {
    return {
      kind: "vehicle",
      eyebrow: "车主准备 · 车辆审核",
      title: "车辆资料正在审核",
      description: "当前无需重复提交，审核结果更新后会显示下一步。",
      actionLabel: "查看审核进度",
      target: "vehicle-settings",
    };
  }
  if (status === "needs_material") {
    return {
      kind: "vehicle",
      eyebrow: "车主准备 · 补充资料",
      title: "补充车辆资料后继续",
      description: "当前只需处理页面提示的一项资料，其他已确认内容会保持不变。",
      actionLabel: "继续补充资料",
      target: "vehicle-settings",
    };
  }
  if (status === "appealing") {
    return {
      kind: "vehicle",
      eyebrow: "车主准备 · 车辆复核",
      title: "车辆申请正在复核",
      description: "复核完成前暂不能使用车主身份，结果更新后会显示下一步。",
      actionLabel: "查看车辆状态",
      target: "vehicle-settings",
    };
  }
  if (status === "suspended" || status === "revoked" || status === "expired") {
    return {
      kind: "vehicle",
      eyebrow: "车主准备 · 车辆状态",
      title: "当前车辆状态暂不支持参与",
      description: "请先查看原因和当前可执行的恢复路径，再决定是否重新准备车辆资料。",
      actionLabel: "查看车辆状态",
      target: "vehicle-settings",
    };
  }
  return {
    kind: "vehicle",
    eyebrow: "车主准备 · 添加车辆",
    title: "先准备一辆常用车辆",
    description: "确认参与方式并提交车辆资料后，才能完成车主身份准备。",
    actionLabel: "开始准备车辆",
    target: "vehicle-settings",
  };
}

function ownerQualificationAccessPresentation(
  state: FreeFlexTrialState,
): OwnerAccessPresentation | undefined {
  if (state === "active") return undefined;
  const presentation = ownerQualificationPresentation(state);
  return {
    kind: "eligibility",
    eyebrow: presentation.eyebrow,
    title: presentation.title,
    description: presentation.description,
    actionLabel: presentation.actionLabel,
    target: "eligibility-settings",
  };
}
