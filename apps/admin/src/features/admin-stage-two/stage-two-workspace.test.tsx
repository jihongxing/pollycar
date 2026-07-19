import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type {
  AdminDriver360,
  AdminInternalSession,
  AdminOperator360,
  AdminOperatorManagementClient,
  AdminOperatorManagementCommand,
  AdminOperatorManagementCommandResult,
  AdminOperatorOnboardingCase,
  AdminPrimaryOperatorMigrationCase,
  AdminVehicle360,
} from "@pollycar/contracts";
import { StageTwoWorkspace } from "./stage-two-workspace";

describe("运营控制台阶段二工作区", () => {
  it("平台请求补充材料后刷新入驻案件状态", async () => {
    const user = userEvent.setup();
    const client = new SyntheticOperatorManagementClient();
    render(
      <StageTwoWorkspace
        page="operator_onboarding"
        client={client}
        session={session("platform")}
      />,
    );

    expect(await screen.findByText(/状态 under_review/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "请求补充材料" }));
    expect(await screen.findByText(/状态 changes_requested/)).toBeInTheDocument();
    expect(client.commands[0]?.type).toBe("request_onboarding_changes");
  });

  it("运营主体人员不显示平台入驻写入口", async () => {
    render(
      <StageTwoWorkspace
        page="operator_onboarding"
        client={new SyntheticOperatorManagementClient()}
        session={session("operator")}
      />,
    );

    expect(await screen.findByText(/仅可查看本主体资料/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "批准入驻" })).not.toBeInTheDocument();
  });

  it("迁移存在阻断项时双方确认保持禁用", async () => {
    render(
      <StageTwoWorkspace
        page="primary_operator_relationships"
        client={new SyntheticOperatorManagementClient()}
        session={session("platform")}
      />,
    );

    expect(await screen.findByText("存在进行中的合成行程")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送双方确认" })).toBeDisabled();
  });
});

class SyntheticOperatorManagementClient
  implements AdminOperatorManagementClient
{
  public readonly commands: AdminOperatorManagementCommand[] = [];
  private onboardingState: AdminOperatorOnboardingCase["state"] = "under_review";
  private onboardingVersion = 4;

  public async getOperator360(): Promise<AdminOperator360> {
    throw new Error("NOT_USED");
  }

  public async getOnboardingCase(): Promise<AdminOperatorOnboardingCase> {
    return {
      context: session("platform").context,
      onboardingCaseId: "onboarding-synthetic-021",
      operatorId: "operator-shencheng",
      operatorName: "申城合成运营",
      state: this.onboardingState,
      resourceVersion: this.onboardingVersion,
      handledByInternalUserId: "synthetic-platform-ops-001",
      checks: [
        {
          checkId: "check-city",
          label: "城市能力",
          state: "pending",
          summary: "等待合成城市能力说明",
        },
      ],
      realMaterialsAllowed: false,
      synthetic: true,
    };
  }

  public async getDriver360(): Promise<AdminDriver360> {
    throw new Error("NOT_USED");
  }

  public async getVehicle360(): Promise<AdminVehicle360> {
    throw new Error("NOT_USED");
  }

  public async getMigrationCase(): Promise<AdminPrimaryOperatorMigrationCase> {
    return {
      context: session("platform").context,
      migrationCaseId: "migration-synthetic-009",
      driverAccountId: "driver-synthetic-086",
      vehicleId: "vehicle-synthetic-132",
      cityCode: "CN-SH",
      sourceOperatorId: "operator-huhang",
      sourceOperatorName: "沪行出行服务",
      targetOperatorId: "operator-shencheng",
      targetOperatorName: "申城合成运营",
      state: "checks_pending",
      resourceVersion: 5,
      sourceAcknowledged: false,
      targetAcknowledged: false,
      independentlyReviewed: false,
      blockers: [
        {
          blockerType: "active_trip",
          summary: "存在进行中的合成行程",
          blocking: true,
        },
      ],
      rollbackAllowed: false,
      synthetic: true,
    };
  }

  public async executeOperatorManagementCommand(
    command: AdminOperatorManagementCommand,
  ): Promise<AdminOperatorManagementCommandResult> {
    this.commands.push(command);
    this.onboardingState = "changes_requested";
    this.onboardingVersion += 1;
    return {
      commandType: command.type,
      resourceType: "onboarding_case",
      resourceId: "onboarding-synthetic-021",
      resourceVersion: this.onboardingVersion,
      state: this.onboardingState,
      synthetic: true,
    };
  }
}

function session(identity: "platform" | "operator"): AdminInternalSession {
  const platform = identity === "platform";
  const context = {
    organizationType: platform ? "platform" as const : "operator" as const,
    organizationId: platform ? "platform-pollycar" : "operator-huhang",
    organizationName: platform ? "PollyCar 平台" : "沪行出行服务",
    cityScopes: ["CN-SH"],
    operatorScopes: platform ? ["operator-huhang", "operator-shencheng"] : ["operator-huhang"],
    purpose: platform ? "platform_operations" as const : "operator_operations" as const,
    fixed: !platform,
  };
  return {
    internalUserId: platform ? "synthetic-platform-ops-001" : "synthetic-operator-ops-001",
    displayName: platform ? "平台运营负责人" : "运营主体运营主管",
    membershipId: platform ? "membership-platform-001" : "membership-operator-001",
    functionalRoles: platform ? ["platform_operations_lead"] : ["operator_operations_lead"],
    maximumDataClassification: "sensitive",
    context,
    availableContexts: [context],
    visibleModules: [
      "operator_management",
      "operator_onboarding",
      "driver_directory",
      "vehicle_directory",
      "primary_operator_relationships",
    ],
    temporaryGrants: [],
    synthetic: true,
  };
}
