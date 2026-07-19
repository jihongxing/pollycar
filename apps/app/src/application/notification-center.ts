import type {
  FreeFlexTrialView,
  SafetyDashboard,
  SyntheticNotificationCenter,
  SyntheticNotificationItem,
  SyntheticTripDashboard,
  SyntheticTripView,
  VehicleReviewView,
} from "@pollycar/contracts";

export type NotificationCenterSource = Readonly<{
  review: VehicleReviewView;
  trial: FreeFlexTrialView;
  trips: SyntheticTripDashboard;
  safety?: SafetyDashboard;
}>;

export function buildSyntheticNotificationCenter(
  source: NotificationCenterSource,
): SyntheticNotificationCenter {
  const items = [
    reviewNotification(source.review),
    eligibilityNotification(source.trial),
    ...tripNotifications(source.trips),
    safetyNotification(source.safety),
  ].filter((item): item is SyntheticNotificationItem => Boolean(item));

  return {
    pendingTaskCount: items.filter((item) => item.requiresAction).length,
    items: [...items].sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority]),
    realPushEnabled: false,
    synthetic: true,
  };
}

function reviewNotification(review: VehicleReviewView): SyntheticNotificationItem {
  if (review.status === "draft") {
    return item(
      "review-draft",
      "review",
      "action",
      "准备车辆资料",
      "确认参与方式并完成车辆信息后，可以提交审核。",
      true,
      "vehicle-settings",
    );
  }
  if (review.status === "under_review") {
    return item("review-under-review", "review", "information", "车辆资料审核中", "当前无需重复提交，可查看审核时间线。", false, "review-pending");
  }
  if (review.status === "needs_material") {
    return item(
      "review-needs-material",
      "review",
      "urgent",
      "补充车辆资料",
      "当前还需补充页面提示的一项资料，完成后审核会继续。",
      true,
      "review-needs-material",
    );
  }
  if (review.status === "approved") {
    return item(
      "review-approved",
      "review",
      "information",
      "车辆审核已完成",
      "是否可以上线仍需确认参与资格、额度和安全状态。",
      false,
      "review-approved",
    );
  }
  if (review.status === "appealing") {
    return item(
      "review-appealing",
      "review",
      "information",
      "车辆申请复核中",
      "当前无需重复提交，结果更新后会显示下一步。",
      false,
      "vehicle-settings",
    );
  }
  if (review.status === "suspended") {
    return item(
      "review-suspended",
      "review",
      "urgent",
      "车辆状态需要处理",
      "车主身份当前暂不可用，请查看限制和恢复路径。",
      true,
      "vehicle-settings",
    );
  }
  return item(
    `review-${review.status}`,
    "review",
    "action",
    "重新确认车辆申请",
    "当前申请已无法继续使用，请查看原因和下一步。",
    true,
    "vehicle-settings",
  );
}

function eligibilityNotification(trial: FreeFlexTrialView): SyntheticNotificationItem {
  if (trial.state === "invited") {
    return item(
      "eligibility-invited",
      "eligibility",
      "action",
      "参与资格可以申请",
      "本次申请不收费，确认后会进入审核。",
      true,
      "eligibility-settings",
    );
  }
  if (trial.state === "under_review") {
    return item(
      "eligibility-under-review",
      "eligibility",
      "information",
      "参与资格审核中",
      "当前无需重复申请，可以随时查看最新状态。",
      false,
      "eligibility-settings",
    );
  }
  if (trial.state === "awaiting_confirmation") {
    return item(
      "eligibility-awaiting-confirmation",
      "eligibility",
      "action",
      "确认启用参与资格",
      "资格已通过，需要本人确认后启用 30 天周期。",
      true,
      "eligibility-settings",
    );
  }
  if (trial.state === "active") {
    return item(
      "eligibility-active",
      "eligibility",
      "information",
      "参与资格当前有效",
      `90 日内已启用 ${trial.activationDaysInLookback} 天。`,
      false,
      "eligibility-settings",
    );
  }
  return item(
    `eligibility-${trial.state}`,
    "eligibility",
    "information",
    trial.state === "expired" ? "参与资格已到期" : "参与资格未通过",
    "当前不能开始新的车主任务，请查看最新状态和下一步。",
    false,
    "eligibility-settings",
  );
}

function tripNotifications(dashboard: SyntheticTripDashboard): SyntheticNotificationItem[] {
  const items: SyntheticNotificationItem[] = [];
  if (dashboard.passengerTrip) items.push(passengerTripNotification(dashboard.passengerTrip));
  if (dashboard.activeDriverTrip) items.push(driverTripNotification(dashboard.activeDriverTrip));
  for (const reservedTrip of dashboard.reservedDriverTrips ?? []) {
    items.push(driverTripNotification(reservedTrip));
  }
  if (!dashboard.activeDriverTrip && dashboard.availableDriverTrips.length > 0) {
    items.push(item(
      "trip-driver-offers",
      "trip",
      "action",
      "有新的行程邀请",
      `当前共有 ${dashboard.availableDriverTrips.length} 个符合参与条件的行程可以查看。`,
      true,
      "driver-offers",
    ));
  }
  return items;
}

function passengerTripNotification(trip: SyntheticTripView): SyntheticNotificationItem {
  if (trip.state === "pending_payment") {
    return item("trip-passenger-payment", "trip", "action", "确认行程费用信息", "确认后会开始寻找合适的车主。", true, "trip-payment");
  }
  if (trip.state === "paid_pending_match") {
    return item("trip-passenger-matching", "trip", "information", "正在寻找车主", "有合适的车主接受后会及时更新。", false, "trip-matching");
  }
  if (trip.state === "scheduled") {
    const latestNotice = [...(trip.scheduleNotices ?? [])]
      .filter((notice) => notice.delivered)
      .sort((left, right) => Date.parse(right.dueAt) - Date.parse(left.dueAt))[0];
    return item(
      `trip-passenger-scheduled-${latestNotice?.kind ?? "created"}`,
      "trip",
      latestNotice?.kind === "unmatched" ? "action" : "information",
      latestNotice ? scheduleNoticeTitle(latestNotice.kind) : "预约已创建",
      `${formatScheduledPickup(trip)}；车主可自主决定是否接受。`,
      latestNotice?.kind === "unmatched",
      "trip-matching",
    );
  }
  if (trip.state === "reserved") {
    return item(
      "trip-passenger-reserved",
      "trip",
      "information",
      "车主已接受预约",
      `${formatScheduledPickup(trip)}；可查看车主和车辆信息。`,
      false,
      "trip-active",
    );
  }
  if (trip.state === "preparing") {
    return item(
      "trip-passenger-preparing",
      "trip",
      "action",
      "预约即将开始",
      `${formatScheduledPickup(trip)}；请准备前往上车点。`,
      true,
      "trip-active",
    );
  }
  if (trip.state === "accepted" || trip.state === "in_progress") {
    return item("trip-passenger-active", "trip", "action", "查看当前行程", "车主已接受行程，请查看最新进展。", true, "trip-active");
  }
  if (trip.state === "unfulfilled") {
    return item(
      "trip-passenger-unfulfilled",
      "trip",
      "action",
      "预约暂未找到车主",
      "你可以调整时间或取消预约，平台不会伪造车主状态。",
      true,
      "trip-result",
    );
  }
  if (trip.state === "safety_frozen") {
    return item("trip-passenger-frozen", "trip", "urgent", "行程已安全冻结", "当前行程不能继续履约，请查看安全状态。", true, "safety-frozen");
  }
  return item("trip-passenger-result", "trip", "information", "查看行程结果", "行程已经结束，可查看费用、评价和最终结果。", false, "trip-result");
}

function driverTripNotification(trip: SyntheticTripView): SyntheticNotificationItem {
  if (trip.state === "reserved") {
    return item(
      `trip-driver-reserved-${trip.tripId}`,
      "trip",
      "information",
      "已接受未来预约",
      `${formatScheduledPickup(trip)}；暂不占用当前履约状态。`,
      false,
      "driver-trip",
    );
  }
  if (trip.state === "preparing") {
    return item(
      `trip-driver-preparing-${trip.tripId}`,
      "trip",
      "action",
      "预约进入接驾准备",
      `${formatScheduledPickup(trip)}；请准备前往上车点。`,
      true,
      "driver-trip",
    );
  }
  if (trip.state === "accepted") {
    return item("trip-driver-start", "trip", "action", "准备开始已接受的行程", "请按预约时间前往上车点，并留意最新行程状态。", true, "driver-trip");
  }
  if (trip.state === "in_progress") {
    return item("trip-driver-progress", "trip", "action", "继续当前行程", "行程正在进行，可查看路线、联系和安全状态。", true, "driver-trip");
  }
  if (trip.state === "safety_frozen") {
    return item("trip-driver-frozen", "trip", "urgent", "车主履约已安全冻结", "冻结期间不能继续履约或发送临时消息。", true, "safety-frozen");
  }
  return item("trip-driver-result", "trip", "information", "车主行程已更新", "查看最新进展和下一步。", false, "driver-trip");
}

function formatScheduledPickup(trip: SyntheticTripView): string {
  const startsAt = trip.timing?.requestedPickupStartsAt;
  const endsAt = trip.timing?.requestedPickupEndsAt;
  if (!startsAt || !endsAt) return "预约时间待确认";
  const date = new Intl.DateTimeFormat("zh-CN", {
    timeZone: trip.timing?.timezone ?? "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(startsAt));
  const formatTime = (value: string) =>
    new Intl.DateTimeFormat("zh-CN", {
      timeZone: trip.timing?.timezone ?? "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(value));
  return `${date} ${formatTime(startsAt)}–${formatTime(endsAt)}`;
}

function scheduleNoticeTitle(
  kind: NonNullable<SyntheticTripView["scheduleNotices"]>[number]["kind"],
): string {
  return {
    created: "预约已创建",
    accepted: "车主已接受预约",
    day_before: "预约将在明天开始",
    two_hours: "预约将在两小时后开始",
    thirty_minutes: "预约即将开始",
    unmatched: "预约暂未找到车主",
  }[kind];
}

function safetyNotification(safety: SafetyDashboard | undefined): SyntheticNotificationItem | undefined {
  const safetyCase = safety?.safetyCase;
  if (!safetyCase) return undefined;
  if (safetyCase.state === "open_frozen") {
    return item("safety-open-frozen", "safety", "urgent", "安全案件等待申诉或处理", "账户与行程保持冻结，可提交一次结构化申诉。", true, "safety-frozen");
  }
  if (safetyCase.state === "appealing") {
    return item("safety-appealing", "safety", "information", "安全申诉处理中", "冻结不会因申诉自动解除，请等待独立安全人员处理。", false, "safety-frozen");
  }
  return item(
    `safety-${safetyCase.state}`,
    "safety",
    "action",
    safetyCase.state === "restored" ? "安全案件已恢复访问" : "安全案件维持冻结",
    "独立安全人员已给出结构化处理结果。",
    true,
    "safety-result",
  );
}

function item(
  notificationId: string,
  domain: SyntheticNotificationItem["domain"],
  priority: SyntheticNotificationItem["priority"],
  title: string,
  body: string,
  requiresAction: boolean,
  target: SyntheticNotificationItem["target"],
): SyntheticNotificationItem {
  return { notificationId, domain, priority, title, body, requiresAction, target, synthetic: true };
}

const priorityOrder = {
  urgent: 0,
  action: 1,
  information: 2,
} as const;
