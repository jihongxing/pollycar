import { describe, expect, it } from "vitest";

import { resolveScreenFromReview, routeForScreen } from "./routes";

describe("App 业务路由", () => {
  it("每个业务页面具有稳定 URL", () => {
    expect(routeForScreen("vehicle-form")).toBe("/vehicle-form");
    expect(routeForScreen("owner-workbench")).toBe("/owner-workbench");
    expect(routeForScreen("account")).toBe("/account");
    expect(routeForScreen("account-profile")).toBe("/account-profile");
    expect(routeForScreen("ride-history")).toBe("/ride-history");
    expect(routeForScreen("identity-settings")).toBe("/identity-settings");
    expect(routeForScreen("vehicle-settings")).toBe("/vehicle-settings");
    expect(routeForScreen("eligibility-settings")).toBe("/eligibility-settings");
    expect(routeForScreen("quota-settings")).toBe("/quota-settings");
    expect(routeForScreen("theme-settings")).toBe("/theme-settings");
    expect(routeForScreen("privacy-safety-settings")).toBe("/privacy-safety-settings");
    expect(routeForScreen("notifications")).toBe("/notifications");
    expect(routeForScreen("notification-settings")).toBe("/notification-settings");
    expect(routeForScreen("help-feedback")).toBe("/help-feedback");
    expect(routeForScreen("trip-create")).toBe("/trip-create");
    expect(routeForScreen("driver-trip")).toBe("/driver-trip");
    expect(routeForScreen("safety-chat")).toBe("/safety-chat");
    expect(routeForScreen("safety-result")).toBe("/safety-result");
  });

  it("审核状态变化时替换到正确路由", () => {
    expect(resolveScreenFromReview("review-pending", "approved")).toBe("review-approved");
    expect(resolveScreenFromReview("review-pending", "needs_material")).toBe("review-needs-material");
  });
});
