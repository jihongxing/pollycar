import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  AdminGlobalSearchResponse,
  AdminProductSession,
} from "@pollycar/contracts";
import { GlobalSearch } from "./global-search";

const session = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  sessionFamilyId: "session-family",
  workIdentity: {
    workIdentityId: "platform-operations",
    legacyAccessToken: "legacy",
    type: "platform",
    organizationId: "platform-pollycar",
    organizationName: "PollyCar 平台",
    productRole: "operations_lead",
    productRoleName: "平台运营负责人",
    cityScopes: ["上海"],
    maximumDataClassification: "restricted",
    recentUsedAt: "2026-07-19T08:00:00.000Z",
    synthetic: true,
  },
  navigation: {
    navigationVersion: "test",
    workIdentityId: "platform-operations",
    organizationContext: {
      organizationType: "platform",
      organizationId: "platform-pollycar",
      organizationName: "PollyCar 平台",
      operatorScopes: ["operator-huhang"],
      cityScopes: ["上海"],
      purpose: "platform_operations",
      fixed: true,
    },
    roleIds: ["operations_lead"],
    items: [],
    routePermissions: [],
    operationPermissions: [],
    fieldProfiles: [],
    exportProfiles: [],
    scopeDigest: "scope",
    expiresAt: "2026-07-19T10:00:00.000Z",
    synthetic: true,
  },
  accessTokenExpiresAt: "2026-07-19T09:00:00.000Z",
  absoluteExpiresAt: "2026-07-19T18:00:00.000Z",
  idleExpiresAt: "2026-07-19T09:30:00.000Z",
  synthetic: true,
} satisfies AdminProductSession;

const searchResult = {
  groups: [{
    domain: "driver_vehicle",
    label: "车主与车辆",
    hasMore: false,
    items: [{
      resultId: "vehicle-001",
      domain: "driver_vehicle",
      kind: "vehicle",
      title: "沪A·12**8",
      description: "林师傅 · 舒适型轿车",
      route: "/admin/fleet/vehicles/vehicle-001",
    }],
  }],
  totalResults: 1,
  asOf: "2026-07-19T08:00:00.000Z",
  synthetic: true,
} satisfies AdminGlobalSearchResponse;

describe("GlobalSearch", () => {
  it("支持斜杠打开、服务端分组搜索和 Escape 焦点恢复", async () => {
    const user = userEvent.setup();
    const searchAcrossDomains = vi.fn(async () => searchResult);
    const { container } = render(
      <GlobalSearch
        session={session}
        client={{ searchAcrossDomains }}
        onNavigate={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("button", { name: /全局搜索/ });

    await user.keyboard("/");
    const input = screen.getByRole("textbox", { name: "搜索后台记录" });
    expect(input).toHaveFocus();
    expect(screen.getByRole("dialog", { name: "全局搜索" }))
      .toHaveAttribute("aria-modal", "true");
    expect(container).toHaveAttribute("inert");
    await user.type(input, "车辆");

    expect(await screen.findByRole("heading", { name: "车主与车辆" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: /沪A·12\*\*8/ }))
      .toBeInTheDocument();
    expect(searchAcrossDomains).toHaveBeenCalledWith("access-token", {
      query: "车辆",
      limitPerDomain: 5,
    });

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "搜索后台记录" }))
      .not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(container).not.toHaveAttribute("inert");
  });

  it("限制键盘焦点留在搜索弹层内", async () => {
    const user = userEvent.setup();
    render(
      <GlobalSearch
        session={session}
        client={{ searchAcrossDomains: async () => searchResult }}
        onNavigate={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /全局搜索/ }));
    const input = screen.getByRole("textbox", { name: "搜索后台记录" });
    await user.type(input, "车辆");
    const result = await screen.findByRole("button", { name: /沪A·12\*\*8/ });

    result.focus();
    await user.tab();
    expect(input).toHaveFocus();
    await user.tab({ shift: true });
    expect(result).toHaveFocus();
  });

  it("输入不足两个字时不请求服务端", async () => {
    const user = userEvent.setup();
    const searchAcrossDomains = vi.fn(async () => searchResult);
    render(
      <GlobalSearch
        session={session}
        client={{ searchAcrossDomains }}
        onNavigate={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /全局搜索/ }));
    await user.type(screen.getByRole("textbox", { name: "搜索后台记录" }), "车");
    expect(screen.getByText("输入至少两个字开始搜索。")).toBeInTheDocument();
    await waitFor(() => expect(searchAcrossDomains).not.toHaveBeenCalled());
  });

  it("点击结果后使用服务端路由导航并恢复触发按钮焦点", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <GlobalSearch
        session={session}
        client={{ searchAcrossDomains: async () => searchResult }}
        onNavigate={onNavigate}
      />,
    );

    await user.click(screen.getByRole("button", { name: /全局搜索/ }));
    await user.type(
      screen.getByRole("textbox", { name: "搜索后台记录" }),
      "车辆",
    );
    await user.click(await screen.findByRole("button", { name: /沪A·12\*\*8/ }));

    expect(onNavigate).toHaveBeenCalledWith(
      "/admin/fleet/vehicles/vehicle-001",
    );
    expect(screen.getByRole("button", { name: /全局搜索/ })).toHaveFocus();
  });
});
