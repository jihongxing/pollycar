import { render, screen } from "@testing-library/react";
import type {
  AdminInternalSession,
  AdminTripCaseManagementClient,
} from "@pollycar/contracts";
import { describe, expect, it } from "vitest";
import { StageThreeWorkspace } from "./stage-three-workspace";

describe("运营控制台阶段三工作区", () => {
  it("运营主体行程中心只展示本主体任务", async () => {
    render(
      <StageThreeWorkspace
        page="trip_operations"
        client={client()}
        session={session("operator_operations_lead")}
      />,
    );
    expect(await screen.findByText("沪行安全冻结协作")).toBeInTheDocument();
    expect(screen.queryByText("申城计划接驾")).not.toBeInTheDocument();
  });

  it("客服案件不显示安全证据入口", async () => {
    render(
      <StageThreeWorkspace
        page="support_cases"
        client={client()}
        session={session("customer_support_agent")}
      />,
    );
    expect(await screen.findByText("客服案件 support-synthetic-114")).toBeInTheDocument();
    expect(screen.queryByText("读取原始聊天")).not.toBeInTheDocument();
  });

  it("安全恢复存在阻断项时按钮禁用", async () => {
    render(
      <StageThreeWorkspace
        page="safety_cases"
        client={client()}
        session={session("safety_lead")}
      />,
    );
    expect(await screen.findByText("合成应急协作尚未关闭")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "恢复访问" })).toBeDisabled();
  });

  it("未知结果页不提供重复提交按钮", async () => {
    render(
      <StageThreeWorkspace
        page="command_recovery"
        client={client()}
        session={session("technical_operations")}
      />,
    );
    expect(await screen.findByText("禁止重复业务命令")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /重新提交/ })).not.toBeInTheDocument();
  });
});

function client(): AdminTripCaseManagementClient {
  return {
    async getTripOperationsCenter() {
      return {
        context: session("operator_operations_lead").context,
        tasks: [
          {
            taskId: "task-1",
            tripId: "trip-synthetic-8421",
            operatorId: "operator-huhang",
            operatorName: "沪行出行服务",
            category: "cross_operator",
            state: "coordinating",
            priority: "urgent",
            summary: "沪行安全冻结协作",
            resourceVersion: 4,
            synthetic: true,
          },
        ],
        metrics: {
          detected: 0,
          awaitingAuthoritativeResult: 0,
          crossOperator: 1,
          safetyFrozen: 1,
        },
        directTripMutationAllowed: false,
        synthetic: true,
      };
    },
    async getTrip360() {
      throw new Error("NOT_USED");
    },
    async getSupportCase() {
      return {
        context: session("customer_support_agent").context,
        supportCaseId: "support-synthetic-114",
        tripId: "trip-synthetic-8466",
        operatorId: "operator-shencheng",
        category: "schedule",
        state: "investigating",
        resourceVersion: 5,
        ownerInternalUserId: "internal-support-001",
        userSummary: "合成用户摘要",
        investigationSummary: "等待权威结果",
        safetyEvidenceAvailable: false,
        financeMutationAllowed: false,
        synthetic: true,
      };
    },
    async getSafetyInvestigation() {
      return {
        context: session("safety_lead").context,
        safetyCaseId: "safety-synthetic-8421",
        tripId: "trip-synthetic-8421",
        authoritativeState: "open_frozen",
        investigationState: "awaiting_independent_review",
        severity: "sev2",
        resourceVersion: 7,
        freezeActorInternalUserId: "internal-safety-officer-001",
        investigationOwnerInternalUserId: "internal-safety-officer-001",
        blockers: [
          {
            blockerType: "emergency_response",
            summary: "合成应急协作尚未关闭",
            blocking: true,
          },
        ],
        independentReviewRequired: true,
        synthetic: true,
      };
    },
    async getEvidenceGrant() {
      throw new Error("NOT_USED");
    },
    async readEvidenceField() {
      throw new Error("NOT_USED");
    },
    async getCommandRecoveryTask() {
      return {
        context: session("technical_operations").context,
        recoveryTaskId: "recovery-synthetic-017",
        originalCommandType: "request_trip_domain_action",
        targetResourceId: "task-1",
        idempotencyKeyDigest: "digest",
        state: "open",
        resourceVersion: 3,
        duplicateCommandAllowed: false,
        businessDecisionAllowedForTechnicalOperations: false,
        synthetic: true,
      };
    },
    async executeTripCaseManagementCommand() {
      throw new Error("NOT_USED");
    },
  };
}

function session(
  role: AdminInternalSession["functionalRoles"][number],
): AdminInternalSession {
  const operator = role === "operator_operations_lead";
  const context = {
    organizationType: operator ? "operator" as const : "platform" as const,
    organizationId: operator ? "operator-huhang" : "platform-pollycar",
    organizationName: operator ? "沪行出行服务" : "PollyCar 平台",
    cityScopes: ["上海"],
    operatorScopes: operator
      ? ["operator-huhang"]
      : ["operator-huhang", "operator-shencheng"],
    purpose: operator ? "operator_operations" as const : "platform_operations" as const,
    fixed: operator,
  };
  return {
    internalUserId: `internal-${role}`,
    displayName: role,
    membershipId: `membership-${role}`,
    functionalRoles: [role],
    maximumDataClassification: role.startsWith("safety") ? "restricted" : "sensitive",
    context,
    availableContexts: [context],
    visibleModules: [],
    temporaryGrants: [],
    synthetic: true,
  };
}
