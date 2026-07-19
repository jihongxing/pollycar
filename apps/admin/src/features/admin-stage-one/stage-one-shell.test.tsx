import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type {
  AdminAccessClient,
  AdminAuditEvent,
  AdminInternalSession,
  AdminOperatorDirectoryEntry,
  AdminOperatorWorkbench,
  AdminPlatformWorkbench,
} from "@pollycar/contracts";
import { Providers } from "../../app/providers";
import { Shell } from "../../app/shell";

describe("运营控制台阶段一多组织 Shell", () => {
  it("平台用户切换观察范围但功能角色保持不变", async () => {
    const user = userEvent.setup();
    const client = new SyntheticAdminAccessClient("platform");
    render(
      <Providers>
        <Shell multiOrganizationEnabled accessClient={client} />
      </Providers>,
    );

    expect(
      await screen.findByRole("heading", { name: "平台运营工作台" }),
    ).toBeInTheDocument();
    expect(screen.getByText("平台运营负责人")).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText("运营主体观察范围"),
      "operator-huhang",
    );

    expect(
      await screen.findByText(
        "观察范围已切换为沪行出行服务；功能角色和数据等级未改变。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("平台运营负责人")).toBeInTheDocument();
    expect(client.switchedOrganizationIds).toEqual(["operator-huhang"]);
  });

  it("平台名录只显示脱敏摘要且没有生命周期操作", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <Shell
          multiOrganizationEnabled
          accessClient={new SyntheticAdminAccessClient("platform")}
        />
      </Providers>,
    );

    await screen.findByRole("heading", { name: "平台运营工作台" });
    await user.click(screen.getByRole("button", { name: "运营主体名录" }));
    expect(
      await screen.findByRole("heading", { name: "运营主体" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/联系人 赵\*\*/)).toBeInTheDocument();
    expect(screen.getByText("只读 · 敏感字段已遮蔽")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /创建|激活|编辑|迁移|退出/ }),
    ).not.toBeInTheDocument();
  });

  it("运营主体工作台固定主体并展示服务端拒绝", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <Shell
          multiOrganizationEnabled
          accessClient={new SyntheticAdminAccessClient("operator")}
        />
      </Providers>,
    );

    expect(
      await screen.findByRole("heading", { name: "运营主体工作台" }),
    ).toBeInTheDocument();
    expect(screen.getByText("主体上下文固定")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "运营主体名录" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "尝试切换主体" }));
    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("ADMIN_ORGANIZATION_CONTEXT_FIXED");
  });

  it("审计页面展示允许与拒绝事件且不显示敏感原文", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <Shell
          multiOrganizationEnabled
          accessClient={new SyntheticAdminAccessClient("platform")}
        />
      </Providers>,
    );
    await screen.findByRole("heading", { name: "平台运营工作台" });
    await user.click(screen.getByRole("button", { name: "审计记录" }));
    expect(
      await screen.findByRole("heading", { name: "访问与范围事件" }),
    ).toBeInTheDocument();
    expect(screen.getByText("访问已允许")).toBeInTheDocument();
    expect(screen.getByText("访问已拒绝")).toBeInTheDocument();
    expect(screen.queryByText("身份证原文")).not.toBeInTheDocument();
  });
});

class SyntheticAdminAccessClient implements AdminAccessClient {
  public readonly switchedOrganizationIds: string[] = [];
  private contextOrganizationId: string;

  public constructor(private readonly identity: "platform" | "operator") {
    this.contextOrganizationId =
      identity === "platform" ? "platform-pollycar" : "operator-huhang";
  }

  public async getSession(): Promise<AdminInternalSession> {
    return this.session();
  }

  public async switchContext(
    organizationId: string,
  ): Promise<AdminInternalSession> {
    if (this.identity === "operator") {
      throw new Error("ADMIN_ORGANIZATION_CONTEXT_FIXED");
    }
    this.switchedOrganizationIds.push(organizationId);
    this.contextOrganizationId = organizationId;
    return this.session();
  }

  public async getPlatformWorkbench(): Promise<AdminPlatformWorkbench> {
    return {
      context: this.session().context,
      metrics: {
        pendingTasks: 38,
        dueSoon: 7,
        blockingCases: 2,
        operatorsInScope:
          this.contextOrganizationId === "platform-pollycar" ? 6 : 1,
      },
      tasks: [
        {
          taskId: "task-platform",
          category: "operator",
          title: "复核运营主体入驻限制解除",
          description: "合成案件",
          dueLabel: "剩余 34 分钟",
          priority: "high",
          operatorId: "operator-huhang",
          synthetic: true,
        },
      ],
      operatorHealth: [
        {
          operatorId: "operator-huhang",
          operatorName: "沪行出行服务",
          status: "attention",
          summary: "1 项待复核",
        },
      ],
      realAccountsEnabled: false,
      financeOperationsEnabled: false,
      productionEnabled: false,
      synthetic: true,
    };
  }

  public async getOperatorWorkbench(): Promise<AdminOperatorWorkbench> {
    return {
      context: this.session().context,
      operatorId: "operator-huhang",
      operatorName: "沪行出行服务",
      metrics: {
        pendingTasks: 26,
        expiringDocuments: 4,
        scheduledTrips: 18,
        payoutAttention: 3,
      },
      tasks: [
        {
          taskId: "task-operator",
          category: "mobility",
          title: "补齐车辆证照",
          description: "仅本主体任务",
          dueLabel: "剩余 42 分钟",
          priority: "high",
          operatorId: "operator-huhang",
          synthetic: true,
        },
      ],
      financeReadOnly: true,
      crossOperatorAccessAllowed: false,
      realAccountsEnabled: false,
      productionEnabled: false,
      synthetic: true,
    };
  }

  public async listOperatorDirectory(): Promise<
    readonly AdminOperatorDirectoryEntry[]
  > {
    return [
      {
        operatorId: "operator-huhang",
        operatorName: "沪行出行服务",
        syntheticReference: "OP-SH-00018",
        contactMasked: "赵**",
        cities: ["上海"],
        capabilities: ["运力", "行程协作"],
        activeDrivers: 128,
        activeVehicles: 132,
        serviceStatus: "attention",
        financeGateSummary: "无差异；资金操作关闭",
        pendingTaskCount: 7,
        lifecycleActionsAllowed: false,
        sensitiveFieldsMasked: true,
        synthetic: true,
      },
    ];
  }

  public async listAuditEvents(): Promise<readonly AdminAuditEvent[]> {
    return [
      {
        eventId: "audit-allow",
        eventType: "access_allowed",
        occurredAt: "2026-07-14T08:00:00.000Z",
        actorInternalUserId: "internal-platform-ops-001",
        actorMembershipId: "membership-platform-ops-001",
        organizationType: "platform",
        organizationId: "platform-pollycar",
        requestId: "request-allow",
        correlationId: "correlation-allow",
        result: "allowed",
        action: "get_platform_workbench",
        accessDecisionId: "decision-allow",
        reasonCode: "authorized",
        synthetic: true,
      },
      {
        eventId: "audit-deny",
        eventType: "access_denied",
        occurredAt: "2026-07-14T08:01:00.000Z",
        actorInternalUserId: "internal-platform-ops-001",
        actorMembershipId: "membership-platform-ops-001",
        organizationType: "platform",
        organizationId: "platform-pollycar",
        requestId: "request-deny",
        correlationId: "correlation-deny",
        result: "denied",
        action: "read_restricted_field",
        accessDecisionId: "decision-deny",
        reasonCode: "ADMIN_TEMPORARY_GRANT_REQUIRED",
        synthetic: true,
      },
    ];
  }

  private session(): AdminInternalSession {
    const platform = this.identity === "platform";
    const organizationName =
      this.contextOrganizationId === "platform-pollycar"
        ? "PollyCar 平台"
        : "沪行出行服务";
    return {
      internalUserId: platform
        ? "internal-platform-ops-001"
        : "internal-operator-ops-001",
      displayName: platform ? "林岚" : "周宁",
      membershipId: platform
        ? "membership-platform-ops-001"
        : "membership-operator-huhang-001",
      functionalRoles: platform
        ? ["platform_operations_lead"]
        : ["operator_operations_lead"],
      maximumDataClassification: "sensitive",
      context: {
        organizationType: platform ? "platform" : "operator",
        organizationId: this.contextOrganizationId,
        organizationName,
        cityScopes: ["上海"],
        operatorScopes:
          this.contextOrganizationId === "platform-pollycar"
            ? ["operator-huhang"]
            : [this.contextOrganizationId],
        purpose: platform ? "platform_operations" : "operator_operations",
        fixed: !platform,
      },
      availableContexts: platform
        ? [
            {
              organizationType: "platform",
              organizationId: "platform-pollycar",
              organizationName: "PollyCar 平台",
              cityScopes: ["上海"],
              operatorScopes: ["operator-huhang"],
              purpose: "platform_operations",
              fixed: false,
            },
            {
              organizationType: "platform",
              organizationId: "operator-huhang",
              organizationName: "沪行出行服务",
              cityScopes: ["上海"],
              operatorScopes: ["operator-huhang"],
              purpose: "platform_operations",
              fixed: false,
            },
          ]
        : [],
      visibleModules: platform
        ? ["platform_workbench", "operator_directory", "audit"]
        : ["operator_workbench", "audit"],
      temporaryGrants: [],
      synthetic: true,
    };
  }
}
