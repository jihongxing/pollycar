import { describe, expect, it } from "vitest";
import type { SyntheticNotificationItem } from "@pollycar/contracts";

import {
  defaultNotificationPreferences,
  shouldShowNotification,
} from "./notification-preferences";

function item(
  domain: SyntheticNotificationItem["domain"],
  requiresAction = false,
): SyntheticNotificationItem {
  return {
    notificationId: `${domain}-${requiresAction}`,
    domain,
    priority: requiresAction ? "action" : "information",
    title: "提醒",
    body: "说明",
    requiresAction,
    target: "trip-result",
    synthetic: true,
  };
}

describe("提醒偏好", () => {
  it("默认显示行程和车主准备更新", () => {
    expect(defaultNotificationPreferences).toEqual({
      tripUpdates: true,
      ownerUpdates: true,
    });
  });

  it("始终保留待处理任务和安全提醒", () => {
    const disabled = { tripUpdates: false, ownerUpdates: false };
    expect(shouldShowNotification(item("trip", true), disabled)).toBe(true);
    expect(shouldShowNotification(item("safety"), disabled)).toBe(true);
  });

  it("只隐藏用户关闭的非紧急更新", () => {
    const preferences = { tripUpdates: false, ownerUpdates: true };
    expect(shouldShowNotification(item("trip"), preferences)).toBe(false);
    expect(shouldShowNotification(item("review"), preferences)).toBe(true);
    expect(shouldShowNotification(item("eligibility"), preferences)).toBe(true);
  });
});
