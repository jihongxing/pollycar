import { describe, expect, it } from "vitest";
import { AdminAccessService, type AdminAccessActor } from "./admin-access-service.js";
import {
  AdminOperatorManagementService,
  InMemorySyntheticPrimaryOperatorRelationshipGateway,
} from "./admin-operator-management-service.js";

const platformActor: AdminAccessActor = {
  token: "synthetic-platform-ops-001",
  correlationId: "operator-management-platform-correlation",
  requestId: "operator-management-platform-request",
};

const operatorActor: AdminAccessActor = {
  token: "synthetic-operator-ops-001",
  correlationId: "operator-management-operator-correlation",
  requestId: "operator-management-operator-request",
};

describe("运营控制台阶段二组织与运力合成内核", () => {
  it("默认关闭阶段二门禁", () => {
    const service = createService(false);
    expect(() =>
      service.getOperator360(platformActor, "operator-huhang"),
    ).toThrow("FEATURE_DISABLED");
  });

  it("运营主体只能查看本主体及其关联车主车辆", () => {
    const service = createService();
    expect(
      service.getOperator360(operatorActor, "operator-huhang"),
    ).toMatchObject({
      operatorId: "operator-huhang",
      lifecycleState: "active",
      financeReadOnly: true,
    });
    expect(() =>
      service.getOperator360(operatorActor, "operator-shencheng"),
    ).toThrow("ADMIN_OPERATOR_SCOPE_FORBIDDEN");
    expect(service.getDriver360(operatorActor, "driver-synthetic-086")).toMatchObject({
      primaryOperatorRelationship: {
        operatorId: "operator-huhang",
        authoritativeSource: "pollycar_finance.driver_operator_memberships",
      },
    });
    expect(service.getVehicle360(operatorActor, "vehicle-synthetic-132")).toMatchObject({
      review: {
        authoritativeSource: "spec/domain/vehicle-review.yaml",
      },
    });
  });

  it("生命周期不能跳跃且城市能力激活使用资源版本", () => {
    const service = createService();
    expect(() =>
      service.executeCommand(platformActor, "lifecycle-invalid-0001", {
        type: "change_operator_lifecycle",
        operatorId: "operator-shencheng",
        targetState: "active",
        reason: "跳过待激活",
        resourceVersion: 3,
      }),
    ).toThrow("ADMIN_OPERATOR_INVALID_TRANSITION");

    const result = service.executeCommand(platformActor, "capability-grant-0001", {
      type: "grant_city_capability",
      operatorId: "operator-shencheng",
      cityCode: "CN-SH",
      capabilityType: "driver_operations",
      resourceVersion: 3,
    });
    expect(result).toMatchObject({
      commandType: "grant_city_capability",
      resourceVersion: 4,
    });
  });

  it("迁移被进行中行程阻断且重复幂等键返回原结果", () => {
    const service = createService();
    expect(() =>
      service.executeCommand(platformActor, "migration-schedule-blocked-0001", {
        type: "schedule_primary_operator_migration",
        migrationCaseId: "migration-synthetic-009",
        effectiveAt: "2026-07-15T00:00:00.000Z",
        resourceVersion: 5,
      }),
    ).toThrow("ADMIN_OPERATOR_MIGRATION_BLOCKED");

    const first = service.executeCommand(platformActor, "onboarding-change-0001", {
      type: "request_onboarding_changes",
      onboardingCaseId: "onboarding-synthetic-021",
      reason: "补充夜间安全协作联系人",
      resourceVersion: 4,
    });
    const second = service.executeCommand(platformActor, "onboarding-change-0001", {
      type: "request_onboarding_changes",
      onboardingCaseId: "onboarding-synthetic-021",
      reason: "补充夜间安全协作联系人",
      resourceVersion: 4,
    });
    expect(second).toEqual(first);
    expect(
      service
        .listAuditEvents(platformActor)
        .filter((event) => event.eventType === "onboarding_decision_recorded"),
    ).toHaveLength(1);
  });
});

function createService(enabled = true): AdminOperatorManagementService {
  const access = new AdminAccessService(true, enabled, () => new Date("2026-07-14T12:00:00.000Z"));
  return new AdminOperatorManagementService(
    enabled,
    access,
    new InMemorySyntheticPrimaryOperatorRelationshipGateway(),
    () => new Date("2026-07-14T12:00:00.000Z"),
  );
}
