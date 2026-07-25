import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  AdminNavigationDomain,
  AdminProductSession,
  AdminWorkIdentitySummary,
} from "@pollycar/contracts";
import { Providers } from "../../app/providers";
import { ProductizedAdminLayout } from "./productized-admin-layout";

describe("Admin v2 正式产品壳", () => {
  it("完成工作身份菜单的键盘选择、范围确认、更新和焦点恢复", async () => {
    const user = userEvent.setup();
    const operatorIdentity = identity({
      workIdentityId: "operator-operations",
      type: "operator",
      organizationId: "operator-huhang",
      organizationName: "沪行出行服务",
      productRole: "operator_operations_lead",
      productRoleName: "运营公司运营负责人",
    });
    const platformIdentity = identity({
      workIdentityId: "platform-operations",
      type: "platform",
      organizationId: "platform-pollycar",
      organizationName: "PollyCar 平台",
      productRole: "operations_lead",
      productRoleName: "平台运营负责人",
    });
    const onSwitch = vi.fn(async (_workIdentityId: string) => undefined);

    function Harness() {
      const [session, setSession] = useState(() => sessionFor(operatorIdentity));
      return (
        <Providers>
          <ProductizedAdminLayout
            session={session}
            client={{ searchAcrossDomains: async () => ({ groups: [], totalResults: 0, asOf: "2026-07-19T08:00:00.000Z", synthetic: true }) }}
            page="workbench"
            workIdentities={[operatorIdentity, platformIdentity]}
            identitySwitchAvailable
            navigationIcon={() => "◫"}
            onNavigate={() => undefined}
            onNavigateRoute={() => undefined}
            onLogout={async () => undefined}
            onSwitchIdentity={async (workIdentityId) => {
              await onSwitch(workIdentityId);
              setSession(sessionFor(platformIdentity));
            }}
          >
            <button type="button">工作台操作</button>
          </ProductizedAdminLayout>
        </Providers>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", {
      name: "切换工作身份，当前运营公司运营负责人",
    });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: /运营公司运营负责人/ }))
      .toHaveFocus();

    await user.keyboard("{ArrowDown}");
    const platformOption = screen.getByRole("menuitem", {
      name: /平台运营负责人/,
    });
    expect(platformOption).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("heading", {
      name: "切换为平台运营负责人",
    })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回选择" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "确认切换" }));

    expect(onSwitch).toHaveBeenCalledWith("platform-operations");
    const updatedTrigger = await screen.findByRole("button", {
      name: "切换工作身份，当前平台运营负责人",
    });
    expect(updatedTrigger).toHaveAttribute("aria-expanded", "false");
    expect(updatedTrigger).toHaveFocus();
  });

  it("按 Escape 关闭身份菜单并恢复入口焦点", async () => {
    const user = userEvent.setup();
    const workIdentity = identity({
      workIdentityId: "operator-operations",
      type: "operator",
      organizationId: "operator-huhang",
      organizationName: "沪行出行服务",
      productRole: "operator_operations_lead",
      productRoleName: "运营公司运营负责人",
    });
    render(
      <Providers>
        <ProductizedAdminLayout
          session={sessionFor(workIdentity)}
          client={{ searchAcrossDomains: async () => ({ groups: [], totalResults: 0, asOf: "2026-07-19T08:00:00.000Z", synthetic: true }) }}
          page="workbench"
          workIdentities={[workIdentity]}
          identitySwitchAvailable
          navigationIcon={() => "◫"}
          onNavigate={() => undefined}
          onNavigateRoute={() => undefined}
          onLogout={async () => undefined}
          onSwitchIdentity={async () => undefined}
        >
          <button type="button">工作台操作</button>
        </ProductizedAdminLayout>
      </Providers>,
    );
    const trigger = screen.getByRole("button", {
      name: "切换工作身份，当前运营公司运营负责人",
    });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("身份安全验证过期时提供重新登录恢复路径", async () => {
    const user = userEvent.setup();
    const currentIdentity = identity({
      workIdentityId: "operator-operations",
      type: "operator",
      organizationId: "operator-huhang",
      organizationName: "沪行出行服务",
      productRole: "operator_operations_lead",
      productRoleName: "运营公司运营负责人",
    });
    const targetIdentity = identity({
      workIdentityId: "platform-operations",
      type: "platform",
      organizationId: "platform-pollycar",
      organizationName: "PollyCar 平台",
      productRole: "operations_lead",
      productRoleName: "平台运营负责人",
    });
    render(
      <Providers>
        <ProductizedAdminLayout
          session={sessionFor(currentIdentity)}
          client={{ searchAcrossDomains: async () => ({ groups: [], totalResults: 0, asOf: "2026-07-19T08:00:00.000Z", synthetic: true }) }}
          page="workbench"
          workIdentities={[currentIdentity, targetIdentity]}
          identitySwitchAvailable
          navigationIcon={() => "◫"}
          onNavigate={() => undefined}
          onNavigateRoute={() => undefined}
          onLogout={async () => undefined}
          onSwitchIdentity={async () => {
            throw new Error("ADMIN_AUTH_MFA_FRESHNESS_REQUIRED");
          }}
        >
          <button type="button">工作台操作</button>
        </ProductizedAdminLayout>
      </Providers>,
    );

    await user.click(screen.getByRole("button", {
      name: "切换工作身份，当前运营公司运营负责人",
    }));
    await user.click(screen.getByRole("menuitem", { name: /平台运营负责人/ }));
    await user.click(screen.getByRole("button", { name: "确认切换" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "本次身份验证已过期，请退出后重新登录。",
    );
  });
});

function identity(
  overrides: Pick<
    AdminWorkIdentitySummary,
    | "workIdentityId"
    | "type"
    | "organizationId"
    | "organizationName"
    | "productRole"
    | "productRoleName"
  >,
): AdminWorkIdentitySummary {
  return {
    ...overrides,
    legacyAccessToken: overrides.workIdentityId,
    cityScopes: ["上海"],
    maximumDataClassification: "sensitive",
    synthetic: true,
  };
}

function sessionFor(workIdentity: AdminWorkIdentitySummary): AdminProductSession {
  const item = {
    id: "workbench" as AdminNavigationDomain,
    label: "工作台",
    route: "/admin/workbench",
    availability: "available" as const,
    children: [],
  };
  return {
    accessToken: `access-${workIdentity.workIdentityId}`,
    refreshToken: `refresh-${workIdentity.workIdentityId}`,
    sessionFamilyId: "family",
    workIdentity,
    navigation: {
      navigationVersion: "1",
      workIdentityId: workIdentity.workIdentityId,
      organizationContext: {
        organizationType: workIdentity.type,
        organizationId: workIdentity.organizationId,
        organizationName: workIdentity.organizationName,
        cityScopes: workIdentity.cityScopes,
        operatorScopes: [],
        purpose: "platform_operations",
        fixed: false,
      },
      roleIds: [workIdentity.productRole],
      items: [item],
      routePermissions: ["workbench:read"],
      operationPermissions: ["read"],
      fieldProfiles: [],
      exportProfiles: [],
      scopeDigest: "scope",
      expiresAt: "2026-07-19T18:00:00.000Z",
      synthetic: true,
    },
    accessTokenExpiresAt: "2026-07-19T10:30:00.000Z",
    absoluteExpiresAt: "2026-07-19T18:00:00.000Z",
    idleExpiresAt: "2026-07-19T11:00:00.000Z",
    synthetic: true,
  };
}
