export type DriverLivenessActionProgress = Readonly<{
  nextIndex: number;
  completed: boolean;
}>;

export function advanceDriverLivenessAction(
  currentIndex: number,
  totalActions: number,
): DriverLivenessActionProgress {
  if (
    !Number.isInteger(currentIndex) ||
    !Number.isInteger(totalActions) ||
    currentIndex < 0 ||
    totalActions < 1 ||
    currentIndex >= totalActions
  ) {
    throw new Error("DRIVER_LIVENESS_PROGRESS_INVALID");
  }
  const completed = currentIndex === totalActions - 1;
  return {
    nextIndex: completed ? currentIndex : currentIndex + 1,
    completed,
  };
}

export function driverLivenessActionTimeoutMs(timeoutSeconds: number): number {
  if (
    !Number.isInteger(timeoutSeconds) ||
    timeoutSeconds < 1 ||
    timeoutSeconds > 120
  ) {
    throw new Error("DRIVER_LIVENESS_ACTION_TIMEOUT_INVALID");
  }
  return timeoutSeconds * 1_000;
}

export function driverLivenessErrorPresentation(
  code: string | undefined,
): Readonly<{ title: string; description: string }> {
  if (code === "CAMERA_PERMISSION_DENIED") {
    return {
      title: "需要相机权限",
      description:
        "请在系统设置中允许御驾出行使用相机，然后重新检测。",
    };
  }
  if (code === "DRIVER_LIVENESS_RESULT_UNKNOWN") {
    return {
      title: "结果仍在确认",
      description:
        "你仍处于离线状态。请稍后重新检测，不要重复点击上线。",
    };
  }
  if (
    code === "DRIVER_LIVENESS_PROVIDER_TIMEOUT" ||
    code === "DRIVER_LIVENESS_PROVIDER_UNAVAILABLE" ||
    code === "SERVICE_UNAVAILABLE" ||
    code === "UNKNOWN_RESULT"
  ) {
    return {
      title: "暂时无法完成检测",
      description: "你仍处于离线状态，请检查网络后重试。",
    };
  }
  if (code === "DRIVER_LIVENESS_CHALLENGE_EXPIRED") {
    return {
      title: "本次检测已过期",
      description: "请重新开始，系统会生成一组新的随机动作。",
    };
  }
  if (code === "DRIVER_LIVENESS_ACTION_TIMEOUT") {
    return {
      title: "动作已超时",
      description: "你仍处于离线状态。请准备好后重新检测。",
    };
  }
  return {
    title: "本次检测未完成",
    description: "你仍处于离线状态，请调整光线和面部位置后重试。",
  };
}
