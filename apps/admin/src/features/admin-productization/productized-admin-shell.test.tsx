import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  AdminAuditDetail,
  AdminDataReportDetail,
  AdminDriverDetail,
  AdminExecutiveDetail,
  AdminFinanceDetail,
  AdminMembershipDetail,
  AdminOperatorDetail,
  AdminOperationsTaskDetail,
  AdminProductizationClient,
  AdminProductSession,
} from "@pollycar/contracts";
import { Providers } from "../../app/providers";
import { ProductizedAdminShell } from "./productized-admin-shell";

describe("产品化运营后台", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("登录后选择运营公司身份并只显示获准菜单", async () => {
    const user = userEvent.setup();
    const client = fixtureClient();
    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await user.click(await screen.findByRole("button", { name: "继续" }));
    await user.click(await screen.findByRole("button", { name: "验证并继续" }));
    await user.click(await screen.findByRole("button", { name: /沪行出行服务/ }));
    expect(await screen.findByRole("heading", { name: "运营公司运营负责人工作台" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /车主与车辆/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /组织与账号/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/门禁|合成身份|Server|L3/)).not.toBeInTheDocument();
  });

  it("未完成业务域只显示统一未开放状态且不展示假数据和无效操作", async () => {
    const user = userEvent.setup();
    const client = fixtureClient();
    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await user.click(await screen.findByRole("button", { name: "继续" }));
    await user.click(await screen.findByRole("button", { name: "验证并继续" }));
    await user.click(await screen.findByRole("button", { name: /沪行出行服务/ }));
    const unavailable = await screen.findByRole("button", {
      name: /车主与车辆.*功能暂未开放/,
    });
    expect(unavailable).toBeDisabled();
    expect(screen.queryByText("12")).not.toBeInTheDocument();
    expect(screen.queryByText("8")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看详情" })).not.toBeInTheDocument();
  });

  it("任务列表进入详情并返回时恢复搜索条件", async () => {
    const user = userEvent.setup();
    const client = fixtureClient();
    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await login(user);
    const search = await screen.findByRole("textbox", { name: "搜索任务" });
    await user.type(search, "车辆");
    const taskButton = await screen.findByRole("button", {
      name: /车辆资格跟进 1/,
    });
    await user.click(taskButton);
    expect(await screen.findByRole("heading", { name: "车辆资格跟进 1" })).toBeInTheDocument();
    expect(search).toBeInTheDocument();
    expect(taskButton).toHaveAttribute("aria-pressed", "true");
    expect(window.location.pathname).toBe("/admin/workbench/tasks/OPS-0001");
    await user.click(screen.getByRole("button", { name: "返回任务列表" }));
    expect(await screen.findByRole("textbox", { name: "搜索任务" })).toHaveValue("车辆");
    await waitFor(() => expect(taskButton).toHaveFocus());
    expect(window.location.pathname).toBe("/admin/workbench");
  });

  it("任务操作展示结果确认中、确认结果和追加审计", async () => {
    const user = userEvent.setup();
    const client = fixtureClient();
    const performAction = client.performOperationsTaskAction.bind(client);
    let confirmOperation!: () => void;
    client.performOperationsTaskAction = async (...arguments_) => {
      await new Promise<void>((resolve) => {
        confirmOperation = resolve;
      });
      return performAction(...arguments_);
    };
    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await login(user);
    await user.click(await screen.findByRole("button", { name: /车辆资格跟进 1/ }));
    await user.type(await screen.findByRole("textbox", { name: "操作备注" }), "分派给当班负责人");
    await user.click(screen.getByRole("button", { name: "分派任务" }));

    expect(await screen.findByRole("status")).toHaveTextContent("结果确认中，请勿重复提交");
    expect(screen.getByRole("button", { name: "分派任务" })).toBeDisabled();
    confirmOperation();
    expect(await screen.findByRole("status")).toHaveTextContent("分派任务已确认");
    const taskDetail = screen.getByRole("region", {
      name: "角色任务工作区详情",
    });
    expect(within(taskDetail).getByText("任务已分派")).toBeInTheDocument();
    expect(within(taskDetail).getByText("分派给当班负责人")).toBeInTheDocument();
    expect(within(taskDetail).getByText("处理中")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "分派任务" })).not.toBeInTheDocument();
  });

  it("运营公司名录进入详情并恢复搜索条件", async () => {
    const user = userEvent.setup();
    const client = fixtureClient();
    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await login(user);
    await user.click(screen.getByRole("button", { name: "运营公司" }));
    const search = await screen.findByRole("textbox", { name: "搜索运营公司" });
    await user.type(search, "沪行");
    const operatorButton = await screen.findByRole("button", {
      name: /沪行出行服务/,
    });
    await user.click(operatorButton);
    expect(await screen.findByRole("heading", { name: "沪行出行服务" })).toBeInTheDocument();
    expect(search).toBeInTheDocument();
    expect(operatorButton).toHaveAttribute("aria-pressed", "true");
    expect(window.location.pathname).toBe("/admin/operators/operator-huhang");
    expect(screen.getByText("当前角色在此主体状态下仅可查看。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "返回运营公司名录" }));
    expect(await screen.findByRole("textbox", { name: "搜索运营公司" })).toHaveValue("沪行");
    await waitFor(() => expect(operatorButton).toHaveFocus());
  });

  it("平台负责人限制运营主体时展示确认中、结果和追加审计", async () => {
    const user = userEvent.setup();
    const session = fixturePlatformSession();
    const client = fixtureClient(session);
    const performAction = client.performOperatorAction.bind(client);
    let confirmOperation!: () => void;
    client.performOperatorAction = async (...arguments_) => {
      await new Promise<void>((resolve) => {
        confirmOperation = resolve;
      });
      return performAction(...arguments_);
    };
    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await user.click(await screen.findByRole("button", { name: "继续" }));
    await user.click(await screen.findByRole("button", { name: "验证并继续" }));
    await user.click(await screen.findByRole("button", { name: /PollyCar 平台/ }));
    await user.click(await screen.findByRole("button", { name: "运营公司" }));
    await user.click(await screen.findByRole("button", { name: /沪行出行服务/ }));
    await user.type(
      await screen.findByRole("textbox", { name: "主体操作原因" }),
      "安全联系人需要重新核验",
    );
    await user.click(screen.getByRole("button", { name: "限制运营" }));

    expect(await screen.findByRole("status")).toHaveTextContent("结果确认中");
    expect(screen.getByRole("button", { name: "限制运营" })).toBeDisabled();
    confirmOperation();
    expect(await screen.findByRole("status")).toHaveTextContent("限制运营已确认");
    const operatorDetail = screen.getByRole("region", {
      name: "运营公司工作区详情",
    });
    expect(within(operatorDetail).getByText("主体已限制")).toBeInTheDocument();
    expect(within(operatorDetail).getByText("安全联系人需要重新核验"))
      .toBeInTheDocument();
    expect(within(operatorDetail).getByText("受限")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "恢复运营" })).toBeInTheDocument();
  });

  it("车辆名录进入详情后按服务端允许动作认领并展示审计结果", async () => {
    const user = userEvent.setup();
    const session = fixtureFleetSession();
    const client = fixtureClient(session);
    client.listDrivers = async () => ({
      summary: {
        totalDrivers: 0,
        serviceableDrivers: 0,
        restrictedDrivers: 0,
        reviewAttentionDrivers: 0,
      },
      items: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
        approximateTotal: 0,
      },
      queryDigest: "drivers",
      scopeDigest: "fleet",
      asOf: "2026-07-15T10:00:00.000Z",
      synthetic: true,
    });
    client.listVehicles = async () => ({
      summary: {
        totalVehicles: 1,
        approvedVehicles: 0,
        underReviewVehicles: 1,
        changesRequestedVehicles: 0,
        rejectedVehicles: 0,
        openReviewTasks: 1,
      },
      items: [fixtureVehicleDetail(session).vehicle],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: "vehicle-start",
        endCursor: "vehicle-end",
        approximateTotal: 1,
      },
      queryDigest: "vehicles",
      scopeDigest: "fleet",
      asOf: "2026-07-15T10:00:00.000Z",
      synthetic: true,
    });
    client.getVehicle = async () => fixtureVehicleDetail(session);
    client.performVehicleReviewAction = async () => ({
      operationId: "vehicle-operation-1",
      resultState: "confirmed",
      idempotentReplay: false,
      detail: fixtureVehicleDetail(session, true),
      synthetic: true,
    });
    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await login(user, /PollyCar 平台/);
    await user.click(screen.getByRole("button", { name: "车主与车辆" }));
    await user.click(screen.getByRole("tab", { name: "车辆名录" }));
    await user.click(await screen.findByRole("button", { name: "查看详情" }));
    expect(await screen.findByRole("button", { name: "认领审核任务" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "认领审核任务" }));
    expect(await screen.findByRole("status")).toHaveTextContent("操作结果已确认");
    expect(screen.getByText("审核任务已认领")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "通过车辆审核" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "← 返回车辆列表" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "查看详情" })).toHaveFocus();
    });
  });

  it("车主名录在同一工作区查看详情并恢复列表焦点", async () => {
    const user = userEvent.setup();
    const session = fixtureFleetSession();
    const detail = fixtureDriverDetail(session);
    const client = fixtureClient(session);
    client.listDrivers = async () => ({
      summary: {
        totalDrivers: 1,
        serviceableDrivers: 0,
        restrictedDrivers: 1,
        reviewAttentionDrivers: 1,
      },
      items: [detail.driver],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: "driver-start",
        endCursor: "driver-end",
        approximateTotal: 1,
      },
      queryDigest: "drivers",
      scopeDigest: "fleet",
      asOf: "2026-07-19T08:00:00.000Z",
      synthetic: true,
    });
    client.getDriver = async () => detail;
    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await login(user, /PollyCar 平台/);
    await user.click(screen.getByRole("button", { name: "车主与车辆" }));
    const search = await screen.findByRole("textbox", { name: "搜索车主" });
    await user.type(search, "林");
    const driverButton = await screen.findByRole("button", {
      name: /林\*/,
    });
    await user.click(driverButton);
    expect(screen.getByRole("region", {
      name: "车主名录工作区详情",
    })).toHaveTextContent("你的工作范围");
    expect(search).toBeInTheDocument();
    expect(driverButton).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /返回车主名录/ }));
    expect(search).toHaveValue("林");
    await waitFor(() => expect(driverButton).toHaveFocus());
  });

  it("车辆审核 Dialog 限制背景交互、确认中防重复并恢复操作焦点", async () => {
    const user = userEvent.setup();
    const session = fixtureFleetSession();
    const client = fixtureClient(session);
    client.listDrivers = async () => ({
      summary: {
        totalDrivers: 0,
        serviceableDrivers: 0,
        restrictedDrivers: 0,
        reviewAttentionDrivers: 0,
      },
      items: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
        approximateTotal: 0,
      },
      queryDigest: "drivers",
      scopeDigest: "fleet",
      asOf: "2026-07-19T10:00:00.000Z",
      synthetic: true,
    });
    client.listVehicles = async () => ({
      summary: {
        totalVehicles: 1,
        approvedVehicles: 0,
        underReviewVehicles: 1,
        changesRequestedVehicles: 0,
        rejectedVehicles: 0,
        openReviewTasks: 1,
      },
      items: [fixtureVehicleDetail(session).vehicle],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: "vehicle-start",
        endCursor: "vehicle-end",
        approximateTotal: 1,
      },
      queryDigest: "vehicles",
      scopeDigest: "fleet",
      asOf: "2026-07-19T10:00:00.000Z",
      synthetic: true,
    });
    client.getVehicle = async () => fixtureVehicleDetail(session, true);
    let confirmOperation!: () => void;
    client.performVehicleReviewAction = async () => {
      await new Promise<void>((resolve) => {
        confirmOperation = resolve;
      });
      return {
        operationId: "vehicle-approve-operation",
        resultState: "confirmed",
        idempotentReplay: false,
        detail: fixtureVehicleDetail(session, true),
        synthetic: true,
      };
    };

    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await login(user, /PollyCar 平台/);
    await user.click(screen.getByRole("button", { name: "车主与车辆" }));
    await user.click(screen.getByRole("tab", { name: "车辆名录" }));
    await user.click(await screen.findByRole("button", { name: "查看详情" }));
    const approveTrigger = await screen.findByRole("button", {
      name: "通过车辆审核",
    });
    await user.click(approveTrigger);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /返回检查/ })).toHaveFocus();
    expect(screen.getByRole("navigation", { name: "主菜单" }))
      .toHaveAttribute("inert");

    await user.click(within(dialog).getByRole("button", { name: "通过车辆审核" }));
    expect(within(dialog).getByRole("button", { name: "正在确认" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    confirmOperation();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "通过车辆审核" })).toHaveFocus();
  });

  it("行程运营完成列表详情动作结果审计并恢复搜索条件", async () => {
    const user = userEvent.setup();
    const session = fixtureTripSession();
    const client = fixtureClient(session);
    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await login(user, /PollyCar 平台/);
    await user.click(await screen.findByRole("button", { name: "行程运营" }));
    expect(await screen.findByRole("heading", { name: "行程运营名录" }))
      .toBeInTheDocument();
    const search = screen.getByRole("textbox", { name: "搜索行程" });
    await user.type(search, "浦东机场");
    const tripButton = await screen.findByRole("button", {
      name: /静安寺 → 浦东机场/,
    });
    await user.click(tripButton);
    expect(await screen.findByRole("heading", {
      name: "静安寺 → 浦东机场",
    })).toBeInTheDocument();
    expect(search).toBeInTheDocument();
    expect(tripButton).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", {
      name: "请求权威领域处理",
    }));
    expect(await screen.findByRole("status")).toHaveTextContent("已确认");
    expect(screen.getByText("已请求权威领域处理")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /返回行程列表/ }));
    expect(await screen.findByRole("textbox", { name: "搜索行程" }))
      .toHaveValue("浦东机场");
    await waitFor(() => expect(tripButton).toHaveFocus());
  });

  it("全局搜索按领域分组并跳转到服务端返回的详情路由", async () => {
    const user = userEvent.setup();
    const session = fixtureTripSession();
    const client = fixtureClient(session);
    client.searchAcrossDomains = async () => ({
      groups: [{
        domain: "trip_operations",
        label: "行程运营",
        hasMore: false,
        items: [{
          resultId: "trip-synthetic-8466",
          domain: "trip_operations",
          kind: "trip",
          title: "静安寺 → 浦东机场",
          description: "申城伙伴运营 · trip-synthetic-8466",
          route: "/admin/trips/trip-synthetic-8466",
        }],
      }],
      totalResults: 1,
      asOf: "2026-07-19T09:00:00.000Z",
      synthetic: true,
    });

    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await login(user, /PollyCar 平台/);
    await user.click(screen.getByRole("button", { name: /全局搜索/ }));
    await user.type(
      screen.getByRole("textbox", { name: "搜索后台记录" }),
      "浦东机场",
    );
    await user.click(await screen.findByRole("button", {
      name: /静安寺 → 浦东机场/,
    }));

    expect(window.location.pathname)
      .toBe("/admin/trips/trip-synthetic-8466");
    expect(await screen.findByRole("heading", {
      name: /静安寺 → 浦东机场/,
    })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "搜索行程" }))
      .toBeInTheDocument();
  });

  it("客服案件从名录进入详情、完成操作并恢复搜索条件", async () => {
    const user = userEvent.setup();
    const session = fixtureCaseSession();
    const client = fixtureClient(session);
    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await login(user, /平台客服/);
    await user.click(screen.getByRole("button", { name: "客服与安全" }));
    expect(await screen.findByRole("heading", { name: "客服与安全案件" }))
      .toBeInTheDocument();
    const search = screen.getByRole("textbox", { name: "搜索案件" });
    await user.type(search, "计划接驾");
    const caseButton = await screen.findByRole("button", {
      name: /乘客询问计划接驾时间/,
    });
    await user.click(caseButton);
    expect(await screen.findByRole("heading", {
      name: "乘客询问计划接驾时间",
    })).toBeInTheDocument();
    expect(search).toBeInTheDocument();
    expect(caseButton).toHaveAttribute("aria-pressed", "true");
    await user.type(
      screen.getByRole("textbox", { name: "案件处理说明" }),
      "已向乘客确认处理结果",
    );
    await user.click(screen.getByRole("button", { name: "解决案件" }));
    expect(await screen.findByRole("status")).toHaveTextContent("已确认");
    expect(screen.getByText("更新客服案件状态")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /返回案件列表/ }));
    expect(await screen.findByRole("textbox", { name: "搜索案件" }))
      .toHaveValue("计划接驾");
    await waitFor(() => expect(caseButton).toHaveFocus());
  });

  it("财务与对账完成列表详情动作结果审计并恢复搜索条件", async () => {
    const user = userEvent.setup();
    const session = fixtureFinanceSession();
    const client = fixtureClient(session);
    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await login(user, /平台财务经办/);
    await user.click(screen.getByRole("button", { name: "财务与对账" }));
    expect(await screen.findByRole("heading", { name: "财务与对账" }))
      .toBeInTheDocument();
    const search = screen.getByRole("textbox", { name: "搜索财务记录" });
    await user.type(search, "沪行");
    await user.click(await screen.findByRole("button", {
      name: /沪行出行服务分配结算批次/,
    }));
    expect(await screen.findByRole("heading", {
      name: "沪行出行服务分配结算批次",
    })).toBeInTheDocument();
    expect(screen.getByText("¥108,420.00")).toBeInTheDocument();
    const actionButton = screen.getByRole("button", {
      name: "准备运营公司结算",
    });
    await user.click(actionButton);
    const dialog = await screen.findByRole("dialog", {
      name: "准备运营公司结算",
    });
    expect(within(dialog).getByRole("button", { name: "返回检查" }))
      .toHaveFocus();
    expect(screen.getByRole("navigation", { name: "主菜单" }))
      .toHaveAttribute("inert");
    await user.click(within(dialog).getByRole("button", {
      name: "确认准备运营公司结算",
    }));
    expect(await screen.findByRole("status")).toHaveTextContent("已确认");
    expect(screen.getByText("提交财务操作")).toBeInTheDocument();
    const backButton = screen.getByRole("button", { name: /返回财务列表/ });
    await waitFor(() => expect(backButton).toHaveFocus());
    await user.click(backButton);
    expect(await screen.findByRole("textbox", { name: "搜索财务记录" }))
      .toHaveValue("沪行");
    await waitFor(() => expect(screen.getByRole("button", {
      name: /沪行出行服务分配结算批次/,
    })).toHaveFocus());
  });

  it("成员与权限在确认暂停前说明影响并阻止重复提交", async () => {
    const user = userEvent.setup();
    const session = fixtureMembershipSession();
    const activeDetail = fixtureMembershipDetail(session);
    const client = fixtureClient(session);
    let operationCount = 0;
    let releaseOperation!: () => void;
    const pendingOperation = new Promise<void>((resolve) => {
      releaseOperation = resolve;
    });
    client.listMemberships = async () => ({
      summary: {
        totalMemberships: 1,
        activeMemberships: 1,
        suspendedMemberships: 0,
        activeSessions: 2,
      },
      items: [activeDetail.item],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: "membership-start",
        endCursor: "membership-end",
        approximateTotal: 1,
      },
      queryDigest: "memberships",
      scopeDigest: "accounts",
      asOf: "2026-07-19T08:00:00.000Z",
      synthetic: true,
    });
    client.getMembership = async () => activeDetail;
    client.performMembershipAction = async () => {
      operationCount += 1;
      await pendingOperation;
      return {
        operationId: "membership-operation-1",
        resultState: "confirmed",
        idempotentReplay: false,
        detail: fixtureMembershipDetail(session, true),
        synthetic: true,
      };
    };
    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await login(user, /平台账号管理员/);
    await user.click(screen.getByRole("button", { name: "成员与权限" }));
    const search = await screen.findByRole("textbox", { name: "搜索成员" });
    await user.type(search, "林");
    const memberButton = await screen.findByRole("button", { name: /林岚/ });
    await user.click(memberButton);
    expect(memberButton).toHaveAttribute("aria-pressed", "true");
    expect(search).toBeInTheDocument();
    const suspendButton = screen.getByRole("button", { name: "暂停成员" });
    await user.click(suspendButton);
    const dialog = await screen.findByRole("dialog", { name: "暂停成员" });
    expect(within(dialog).getByText(/2 个活跃登录将立即失效/))
      .toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "返回检查" }))
      .toHaveFocus();
    const confirmButton = within(dialog).getByRole("button", {
      name: "确认暂停成员",
    });
    await user.dblClick(confirmButton);
    expect(operationCount).toBe(1);
    expect(confirmButton).toBeDisabled();
    releaseOperation();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "成员已暂停",
    );
    await waitFor(() => expect(screen.getByRole("button", {
      name: "恢复成员",
    })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: /返回成员列表/ }));
    expect(search).toHaveValue("林");
    await waitFor(() => expect(memberButton).toHaveFocus());
  });

  it("高层驾驶舱进入待决详情、记录治理意见并恢复列表筛选", async () => {
    const user = userEvent.setup();
    const session = fixtureExecutiveSession();
    const detail = fixtureExecutiveDetail(session);
    const client: AdminProductizationClient = {
      ...fixtureClient(session),
      listExecutiveResources: async () => ({
        summary: {
          totalResources: 1,
          openDecisionItems: 1,
          blockingOperators: 0,
          exportsAwaitingReview: 0,
          unavailableMetrics: 0,
          pageState: "partial",
        },
        headlineMetrics: [],
        notices: ["资金指标包含未关账期间。"],
        items: [detail.item],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: "executive-start",
          endCursor: "executive-end",
          approximateTotal: 1,
        },
        queryDigest: "executive-query",
        scopeDigest: "executive-scope",
        asOf: "2026-07-16T10:00:00.000Z",
        synthetic: true,
      }),
      getExecutiveResource: async () => detail,
      performExecutiveAction: async () => ({
        operationId: "executive-operation-1",
        resultState: "confirmed",
        idempotentReplay: false,
        detail: {
          ...detail,
          item: { ...detail.item, resourceVersion: 2 },
          record: {
            ...detail.record,
            opinions: [{
              opinionId: "opinion-1",
              decisionItemId: detail.record.decisionItemId,
              decisionCode: "continue_controlled_review",
              reasonCode: "executive_governance_review",
              responsibleRole: "operations_lead",
              dueAt: "2026-07-23T10:00:00.000Z",
              recordedBy: "internal-executive-sponsor-001",
              recordedAt: "2026-07-16T10:05:00.000Z",
              businessStateChanged: false,
              appendOnly: true,
              synthetic: true,
            }],
          },
          auditTrail: [
            ...detail.auditTrail,
            {
              eventId: "executive-audit-action-1",
              action: "executive_decision_opinion_recorded",
              actorLabel: "PollyCar 平台",
              actorRole: "项目决策人",
              occurredAt: "2026-07-16T10:05:00.000Z",
              reasonCode: "executive_governance_review",
            },
          ],
        },
        synthetic: true,
      }),
    };
    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await login(user, /PollyCar 平台/);
    await user.click(await screen.findByRole("button", { name: "高层驾驶舱" }));
    const search = await screen.findByRole("textbox", {
      name: "搜索驾驶舱资源",
    });
    await user.type(search, "海湾");
    await user.click(await screen.findByRole("button", {
      name: /海湾城市服务限制状态复核/,
    }));
    expect(window.location.pathname)
      .toBe("/admin/executive/decision_item/decision-operator-haiwan");
    await user.click(screen.getByRole("button", { name: "记录治理意见" }));
    expect(await screen.findByRole("status")).toHaveTextContent("操作已确认");
    expect(screen.getByText("继续跟进")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /返回驾驶舱名录/ }));
    expect(await screen.findByRole("textbox", {
      name: "搜索驾驶舱资源",
    })).toHaveValue("海湾");
  });

  it("审计与系统在主从工作区确认创建调查并恢复列表焦点", async () => {
    const user = userEvent.setup();
    const session = fixtureAuditSession();
    const eventDetail = fixtureAuditEventDetail(session);
    const investigationDetail = fixtureAuditInvestigationDetail(session);
    const client: AdminProductizationClient = {
      ...fixtureClient(session),
      listAuditResources: async () => ({
        summary: {
          totalResources: 1,
          deniedEvents: 1,
          highRiskEvents: 1,
          openInvestigations: 0,
          integrityWarnings: 0,
        },
        items: [eventDetail.item],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: "audit-start",
          endCursor: "audit-end",
          approximateTotal: 1,
        },
        queryDigest: "audit-query",
        scopeDigest: "audit-scope",
        asOf: "2026-07-16T11:00:00.000Z",
        synthetic: true,
      }),
      getAuditResource: async (_accessToken, kind) =>
        kind === "event" ? eventDetail : investigationDetail,
      performAuditAction: async () => ({
        operationId: "audit-operation-1",
        resultState: "confirmed",
        idempotentReplay: false,
        detail: investigationDetail,
        synthetic: true,
      }),
    };
    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await login(user, /PollyCar 平台/);
    await user.click(screen.getByRole("button", { name: "审计与系统" }));
    expect(await screen.findByRole("heading", { name: "审计与系统" })).toBeInTheDocument();
    const auditButton = screen.getByRole("button", { name: /访问决策拒绝/ });
    await user.click(auditButton);
    expect(window.location.pathname).toBe("/admin/governance/event/audit-event-001");
    expect(auditButton).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "创建调查" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "返回检查" })).toHaveFocus();
    expect(within(dialog).getByText(/不改变原业务状态/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "创建调查" }));
    expect(await screen.findByText("调查：访问决策拒绝")).toBeInTheDocument();
    expect(window.location.pathname)
      .toBe("/admin/governance/investigation/audit-investigation-001");
    await user.click(screen.getByRole("button", { name: /返回审计名录/ }));
    await waitFor(() => expect(auditButton).toHaveFocus());
  });

  it("数据与报表完成搜索、详情、刷新确认、审计更新和列表恢复", async () => {
    const user = userEvent.setup();
    const session = fixtureDataReportSession();
    const detail = fixtureDataReportDetail(session);
    let refreshCount = 0;
    let releaseRefresh!: () => void;
    const pendingRefresh = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const client: AdminProductizationClient = {
      ...fixtureClient(session),
      listDataReports: async () => ({
        summary: {
          totalReports: 1,
          readyReports: 1,
          partialReports: 0,
          staleReports: 0,
          totalMetrics: 3,
        },
        items: [detail.item],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: "data-report-start",
          endCursor: "data-report-end",
          approximateTotal: 1,
        },
        queryDigest: "data-report-query",
        scopeDigest: "data-report-scope",
        asOf: "2026-07-16T12:00:00.000Z",
        synthetic: true,
      }),
      getDataReport: async () => detail,
      performDataReportAction: async () => {
        refreshCount += 1;
        await pendingRefresh;
        return {
          operationId: "data-report-operation-001",
          resultState: "confirmed",
          idempotentReplay: false,
          detail: {
            ...detail,
            item: {
              ...detail.item,
              resourceVersion: 2,
              refreshedAt: "2026-07-16T12:05:00.000Z",
            },
            auditTrail: [
              ...detail.auditTrail,
              {
                eventId: "data-report-refresh-001",
                action: "data_report_refreshed",
                actorLabel: session.workIdentity.organizationName,
                actorRole: session.workIdentity.productRoleName,
                occurredAt: "2026-07-16T12:05:00.000Z",
                previousVersion: 1,
                nextVersion: 2,
                reasonCode: "scheduled_quality_review",
              },
            ],
          },
          synthetic: true,
        };
      },
    };
    render(<Providers><ProductizedAdminShell client={client} /></Providers>);
    await login(user, /PollyCar 平台/);
    await user.click(screen.getByRole("button", { name: "数据与报表" }));
    const search = await screen.findByRole("textbox", { name: "搜索数据报表" });
    await user.type(search, "运营");
    const reportButton = await screen.findByRole("button", {
      name: /运营任务健康报表/,
    });
    await user.click(reportButton);
    expect(window.location.pathname).toBe("/admin/reports/operations-health");
    expect(reportButton).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("heading", {
      name: "运营任务健康报表",
    })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "刷新报表指标" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "返回检查" })).toHaveFocus();
    expect(within(dialog).getByText(/历史处理记录会保留/)).toBeInTheDocument();
    const confirmButton = within(dialog).getByRole("button", { name: "确认刷新" });
    await user.dblClick(confirmButton);
    expect(refreshCount).toBe(1);
    expect(confirmButton).toBeDisabled();
    releaseRefresh();
    expect(await screen.findByRole("status")).toHaveTextContent("报表指标已更新");
    expect(screen.getByText("报表指标已刷新")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /返回报表列表/ }));
    expect(await screen.findByRole("textbox", { name: "搜索数据报表" }))
      .toHaveValue("运营");
    await waitFor(() => expect(reportButton).toHaveFocus());
  });
});

async function login(
  user: ReturnType<typeof userEvent.setup>,
  identityName: RegExp = /沪行出行服务/,
) {
  await user.click(await screen.findByRole("button", { name: "继续" }));
  await user.click(await screen.findByRole("button", { name: "验证并继续" }));
  await user.click(await screen.findByRole("button", { name: identityName }));
}

function fixtureClient(
  session: AdminProductSession = fixtureSession(),
): AdminProductizationClient {
  return {
    getInvitation: async () => { throw new Error("unused"); },
    activateInvitation: async () => ({ recoveryCodes: [], synthetic: true }),
    startLogin: async () => ({ challengeId: "challenge", expiresAt: "2026-07-15T10:00:00.000Z", factor: "totp", synthetic: true }),
    verifyMfa: async () => ({
      selectionToken: "selection",
      expiresAt: "2026-07-15T10:00:00.000Z",
      workIdentities: [session.workIdentity],
      synthetic: true,
    }),
    selectWorkIdentity: async () => session,
    switchWorkIdentity: async () => session,
    refreshSession: async () => session,
    logout: async () => undefined,
    getNavigation: async () => session.navigation,
    searchAcrossDomains: async () => ({
      groups: [],
      totalResults: 0,
      asOf: "2026-07-19T09:00:00.000Z",
      synthetic: true,
    }),
    listOperationsTasks: async () => ({
      items: [{
        taskId: "OPS-0001",
        title: "车辆资格跟进 1",
        operatorName: "沪行出行服务",
        domain: "driver_vehicle",
        assigneeName: "林岚",
        dueAt: "2026-07-16T09:00:00.000Z",
        status: "unassigned",
        priority: "normal",
        version: 1,
        updatedAt: "2026-07-15T09:00:00.000Z",
        synthetic: true,
      }],
      pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: "start", endCursor: "end", approximateTotal: 1 },
      queryDigest: "query",
      scopeDigest: "scope",
      asOf: "2026-07-15T09:00:00.000Z",
      synthetic: true,
    }),
    getOperationsTask: async () => fixtureTaskDetail(),
    performOperationsTaskAction: async (_accessToken, _taskId, command) => ({
      operationId: "task-operation-1",
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        ...fixtureTaskDetail(),
        task: {
          ...fixtureTaskDetail().task,
          status: command.action === "review" ? "completed" : "processing",
          version: 2,
          updatedAt: "2026-07-15T09:30:00.000Z",
        },
        allowedActions: [],
        auditTrail: [
          ...fixtureTaskDetail().auditTrail,
          {
            eventId: "audit-OPS-0001-2-assign",
            action: "task_assigned",
            actorLabel: "沪行出行服务",
            actorRole: "运营公司运营负责人",
            occurredAt: "2026-07-15T09:30:00.000Z",
            previousStatus: "unassigned",
            nextStatus: "processing",
            ...(command.note ? { note: command.note } : {}),
          },
        ],
      },
      synthetic: true,
    }),
    listOperators: async () => ({
      summary: {
        totalOperators: 1,
        activeOperators: 1,
        attentionOperators: 0,
        activeDrivers: 128,
        activeVehicles: 132,
      },
      items: [fixtureOperatorDetail(session).operator],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: "operator-start",
        endCursor: "operator-end",
        approximateTotal: 1,
      },
      queryDigest: "operator-query",
      scopeDigest: "operator-scope",
      asOf: "2026-07-15T10:00:00.000Z",
      synthetic: true,
    }),
    getOperator: async () => fixtureOperatorDetail(session),
    performOperatorAction: async (_accessToken, _operatorId, command) => ({
      operationId: "operator-operation-1",
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        ...fixtureOperatorDetail(session),
        operator: {
          ...fixtureOperatorDetail(session).operator,
          lifecycleState:
            command.action === "restrict" ? "restricted" : "active",
          resourceVersion: 19,
          updatedAt: "2026-07-15T10:30:00.000Z",
        },
        allowedActions: command.action === "restrict"
          ? ["reactivate"]
          : ["restrict"],
        auditTrail: [
          ...fixtureOperatorDetail(session).auditTrail,
          {
            eventId: "operator-audit-action-1",
            action: command.action === "restrict"
              ? "operator_restricted"
              : "operator_reactivated",
            actorLabel: session.workIdentity.organizationName,
            actorRole: session.workIdentity.productRoleName,
            occurredAt: "2026-07-15T10:30:00.000Z",
            previousState:
              command.action === "restrict" ? "active" : "restricted",
            nextState:
              command.action === "restrict" ? "restricted" : "active",
            note: command.note,
          },
        ],
      },
      synthetic: true,
    }),
    listDrivers: async () => { throw new Error("unused"); },
    getDriver: async () => { throw new Error("unused"); },
    listVehicles: async () => { throw new Error("unused"); },
    getVehicle: async () => { throw new Error("unused"); },
    performVehicleReviewAction: async () => { throw new Error("unused"); },
    listTrips: async () => ({
      summary: {
        totalTrips: 1,
        activeTrips: 1,
        attentionTrips: 1,
        safetyFrozenTrips: 0,
        awaitingAuthoritativeResultTrips: 0,
      },
      items: [fixtureTripDetail(session).trip],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: "trip-start",
        endCursor: "trip-end",
        approximateTotal: 1,
      },
      queryDigest: "trip-query",
      scopeDigest: "trip-scope",
      asOf: "2026-07-15T10:00:00.000Z",
      synthetic: true,
    }),
    getTrip: async () => fixtureTripDetail(session),
    performTripOperationAction: async () => ({
      operationId: "trip-operation-1",
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        ...fixtureTripDetail(session),
        operationTask: {
          ...fixtureTripDetail(session).operationTask!,
          state: "awaiting_authoritative_result",
          resourceVersion: 5,
        },
        trip: {
          ...fixtureTripDetail(session).trip,
          operationState: "awaiting_authoritative_result",
        },
        allowedActions: [],
        auditTrail: [
          ...fixtureTripDetail(session).auditTrail,
          {
            eventId: "trip-audit-action-1",
            action: "trip_domain_action_requested",
            actorLabel: session.workIdentity.organizationName,
            actorRole: session.workIdentity.productRoleName,
            occurredAt: "2026-07-15T10:30:00.000Z",
            previousState: "coordinating",
            nextState: "awaiting_authoritative_result",
            reasonCode: "schedule_coordination",
          },
        ],
      },
      synthetic: true,
    }),
    listCases: async () => ({
      summary: {
        totalCases: 1,
        supportCases: 1,
        safetyCases: 0,
        activeCases: 1,
        severeSafetyCases: 0,
        awaitingIndependentReviewCases: 0,
      },
      items: [fixtureCaseDetail(session).case],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: "case-start",
        endCursor: "case-end",
        approximateTotal: 1,
      },
      queryDigest: "case-query",
      scopeDigest: "case-scope",
      asOf: "2026-07-16T08:00:00.000Z",
      synthetic: true,
    }),
    getCase: async () => fixtureCaseDetail(session),
    performCaseAction: async (_accessToken, _kind, _caseId, command) => ({
      operationId: "case-operation-1",
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        ...fixtureCaseDetail(session),
        case: {
          ...fixtureCaseDetail(session).case,
          state: command.action === "resolve" ? "resolved" : "investigating",
          resourceVersion: 6,
        },
        profile: {
          ...fixtureCaseDetail(session).profile,
          state: command.action === "resolve" ? "resolved" : "investigating",
          resourceVersion: 6,
        },
        allowedActions: ["close", "reopen"],
        auditTrail: [
          ...fixtureCaseDetail(session).auditTrail,
          {
            eventId: "case-audit-action-1",
            action: "support_case_state_changed",
            actorLabel: session.workIdentity.organizationName,
            actorRole: session.workIdentity.productRoleName,
            occurredAt: "2026-07-16T08:15:00.000Z",
            previousState: "investigating",
            nextState: "resolved",
            ...(command.note ? { note: command.note } : {}),
          },
        ],
      },
      synthetic: true,
    }),
    listFinanceResources: async () => ({
      summary: {
        totalResources: 1,
        blockingResources: 0,
        awaitingIndependentReview: 0,
        unknownResults: 0,
        openReconciliationRuns: 0,
        readyBusinessDays: 0,
      },
      items: [fixtureFinanceDetail(session).item],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: "finance-start",
        endCursor: "finance-end",
        approximateTotal: 1,
      },
      queryDigest: "finance-query",
      scopeDigest: "finance-scope",
      asOf: "2026-07-16T08:00:00.000Z",
      synthetic: true,
    }),
    getFinanceResource: async () => fixtureFinanceDetail(session),
    performFinanceAction: async (_accessToken, _kind, _resourceId, command) => ({
      operationId: "finance-operation-1",
      resultState: "confirmed",
      idempotentReplay: false,
      detail: {
        ...fixtureFinanceDetail(session),
        item: {
          ...fixtureFinanceDetail(session).item,
          state: "ready",
          resourceVersion: 2,
        },
        record: {
          ...fixtureFinanceDetail(session).record,
          state: "ready",
          resourceVersion: 2,
        },
        allowedActions: [],
        auditTrail: [
          ...fixtureFinanceDetail(session).auditTrail,
          {
            eventId: "finance-audit-action-1",
            action: "finance_operation_submitted",
            actorLabel: session.workIdentity.organizationName,
            actorRole: session.workIdentity.productRoleName,
            occurredAt: "2026-07-16T08:15:00.000Z",
            previousState: "eligible",
            nextState: "ready",
            reasonCode: command.reasonCode,
          },
        ],
      } as AdminFinanceDetail,
      synthetic: true,
    }),
    listExecutiveResources: async () => {
      throw new Error("unused");
    },
    getExecutiveResource: async () => {
      throw new Error("unused");
    },
    performExecutiveAction: async () => {
      throw new Error("unused");
    },
    listAuditResources: async () => {
      throw new Error("unused");
    },
    getAuditResource: async () => {
      throw new Error("unused");
    },
    performAuditAction: async () => {
      throw new Error("unused");
    },
    listDataReports: async () => {
      throw new Error("unused");
    },
    getDataReport: async () => {
      throw new Error("unused");
    },
    performDataReportAction: async () => {
      throw new Error("unused");
    },
    listMemberships: async () => {
      throw new Error("unused");
    },
    getMembership: async () => {
      throw new Error("unused");
    },
    performMembershipAction: async () => {
      throw new Error("unused");
    },
  };
}

function fixtureOperatorDetail(
  session: AdminProductSession,
): AdminOperatorDetail {
  return {
    operator: {
      operatorId: "operator-huhang",
      operatorName: "沪行出行服务",
      syntheticReference: "OP-SH-00018",
      lifecycleState: "active",
      cityNames: ["上海"],
      activeDrivers: 128,
      activeVehicles: 132,
      pendingTasks: 7,
      resourceVersion: 18,
      updatedAt: "2026-07-15T10:00:00.000Z",
      contactMasked: "赵** · 138****2041",
      capabilities: [{
        capabilityId: "capability-huhang-driver",
        cityCode: "CN-SH",
        cityName: "上海",
        capabilityType: "driver_operations",
        state: "active",
        effectiveFrom: "2026-07-10T00:00:00.000Z",
        ruleVersion: "operator-capability-v1",
        approvalCaseId: "onboarding-synthetic-018",
        synthetic: true,
      }],
      blockers: [],
      synthetic: true,
    },
    organizationScope: {
      organizationId: session.workIdentity.organizationId,
      organizationName: session.workIdentity.organizationName,
      cityScopes: session.workIdentity.cityScopes,
    },
    allowedActions:
      session.workIdentity.productRole === "operations_lead"
        ? ["restrict"]
        : [],
    auditTrail: [{
      eventId: "operator-audit-view-1",
      action: "operator_profile_viewed",
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.productRoleName,
      occurredAt: "2026-07-15T10:00:00.000Z",
    }],
    synthetic: true,
  };
}

function fixtureTaskDetail(): AdminOperationsTaskDetail {
  return {
    task: {
      taskId: "OPS-0001",
      title: "车辆资格跟进 1",
      operatorName: "沪行出行服务",
      domain: "driver_vehicle",
      assigneeName: "林岚",
      dueAt: "2026-07-16T09:00:00.000Z",
      status: "unassigned",
      priority: "normal",
      version: 1,
      updatedAt: "2026-07-15T09:00:00.000Z",
      synthetic: true,
    },
    organizationScope: {
      organizationId: "operator-huhang",
      organizationName: "沪行出行服务",
      cityScopes: ["上海"],
    },
    allowedActions: ["assign"],
    auditTrail: [{
      eventId: "audit-OPS-0001-created",
      action: "task_created",
      actorLabel: "任务系统",
      occurredAt: "2026-07-15T09:00:00.000Z",
    }],
    synthetic: true,
  };
}

function fixtureSession(): AdminProductSession {
  const workIdentity = {
    workIdentityId: "synthetic-operator-ops-001",
    legacyAccessToken: "synthetic-operator-ops-001",
    type: "operator" as const,
    organizationId: "operator-huhang",
    organizationName: "沪行出行服务",
    productRole: "operator_operations_lead" as const,
    productRoleName: "运营公司运营负责人",
    cityScopes: ["上海"],
    maximumDataClassification: "sensitive" as const,
    synthetic: true as const,
  };
  return {
    accessToken: "access",
    refreshToken: "refresh",
    sessionFamilyId: "family",
    workIdentity,
    navigation: {
      navigationVersion: "1",
      workIdentityId: workIdentity.workIdentityId,
      organizationContext: {
        organizationType: "operator",
        organizationId: "operator-huhang",
        organizationName: "沪行出行服务",
        cityScopes: ["上海"],
        operatorScopes: ["operator-huhang"],
        purpose: "operator_operations",
        fixed: true,
      },
      roleIds: ["operator_operations_lead"],
      items: [
        { id: "workbench", label: "工作台", route: "/admin/workbench", availability: "available", children: [] },
        { id: "operator_management", label: "运营公司", route: "/admin/operators", availability: "available", children: [] },
        { id: "driver_vehicle", label: "车主与车辆", route: "/admin/fleet", availability: "unavailable", unavailableReason: "not_implemented", children: [] },
        { id: "trip_operations", label: "行程运营", route: "/admin/trips", availability: "unavailable", unavailableReason: "not_implemented", children: [] },
        { id: "support_safety", label: "客服与安全", route: "/admin/cases", availability: "unavailable", unavailableReason: "not_implemented", children: [] },
      ],
      routePermissions: ["workbench:read", "operator_management:read", "driver_vehicle:read", "trip_operations:read", "support_safety:read"],
      operationPermissions: ["read", "assign", "review"],
      fieldProfiles: [],
      exportProfiles: [],
      scopeDigest: "scope",
      expiresAt: "2026-07-15T18:00:00.000Z",
      synthetic: true,
    },
    accessTokenExpiresAt: "2026-07-15T10:00:00.000Z",
    absoluteExpiresAt: "2026-07-15T18:00:00.000Z",
    idleExpiresAt: "2026-07-15T10:30:00.000Z",
    synthetic: true,
  };
}

function fixtureExecutiveSession(): AdminProductSession {
  const base = fixtureSession();
  const workIdentity = {
    ...base.workIdentity,
    workIdentityId: "synthetic-executive-sponsor-001",
    legacyAccessToken: "synthetic-executive-sponsor-001",
    type: "platform" as const,
    organizationId: "platform-pollycar",
    organizationName: "PollyCar 平台",
    productRole: "executive_sponsor" as const,
    productRoleName: "项目决策人",
  };
  return {
    ...base,
    workIdentity,
    navigation: {
      ...base.navigation,
      workIdentityId: workIdentity.workIdentityId,
      organizationContext: {
        organizationType: "platform",
        organizationId: "platform-pollycar",
        organizationName: "PollyCar 平台",
        cityScopes: ["上海"],
        operatorScopes: [
          "operator-huhang",
          "operator-shencheng",
          "operator-haiwan",
        ],
        purpose: "platform_operations",
        fixed: false,
      },
      roleIds: ["executive_sponsor"],
      items: [
        {
          id: "workbench",
          label: "工作台",
          route: "/admin/workbench",
          availability: "available",
          children: [],
        },
        {
          id: "executive_dashboard",
          label: "高层驾驶舱",
          route: "/admin/executive",
          availability: "available",
          children: [],
        },
      ],
      routePermissions: ["workbench:read", "executive_dashboard:read"],
    },
  };
}

function fixtureExecutiveDetail(
  session: AdminProductSession,
): Extract<AdminExecutiveDetail, { kind: "decision_item" }> {
  return {
    kind: "decision_item",
    item: {
      resourceId: "decision-operator-haiwan",
      kind: "decision_item",
      domain: "operations",
      operatorId: "operator-haiwan",
      operatorName: "海湾城市服务",
      state: "open",
      title: "海湾城市服务限制状态复核",
      summary: "资金差异未闭环，需确认继续限制或启动退出评估。",
      blocking: false,
      resourceVersion: 1,
      updatedAt: "2026-07-16T10:00:00.000Z",
      synthetic: true,
    },
    record: {
      decisionItemId: "decision-operator-haiwan",
      operatorId: "operator-haiwan",
      domain: "operations",
      title: "海湾城市服务限制状态复核",
      summary: "资金差异未闭环，需确认继续限制或启动退出评估。",
      responsibleRole: "operations_lead",
      dueAt: "2026-07-23T10:00:00.000Z",
      state: "open",
      sourceWorkspace: "operator_management",
      opinions: [],
      directApprovalAllowed: false,
      synthetic: true,
    },
    organizationScope: {
      organizationId: session.workIdentity.organizationId,
      organizationName: session.workIdentity.organizationName,
      cityScopes: session.workIdentity.cityScopes,
    },
    allowedActions: ["record_decision_opinion"],
    auditTrail: [{
      eventId: "executive-audit-view-1",
      action: "executive_resource_viewed",
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.productRoleName,
      occurredAt: "2026-07-16T10:00:00.000Z",
    }],
    directBusinessApprovalAllowed: false,
    personLevelDrilldownAllowed: false,
    containsRealData: false,
    synthetic: true,
  };
}

function fixtureAuditSession(): AdminProductSession {
  const base = fixtureSession();
  const workIdentity = {
    ...base.workIdentity,
    workIdentityId: "synthetic-technical-ops-001",
    legacyAccessToken: "synthetic-technical-ops-001",
    type: "platform" as const,
    organizationId: "platform-pollycar",
    organizationName: "PollyCar 平台",
    productRole: "technical_operations" as const,
    productRoleName: "平台技术运维",
  };
  return {
    ...base,
    workIdentity,
    navigation: {
      ...base.navigation,
      workIdentityId: workIdentity.workIdentityId,
      organizationContext: {
        organizationType: "platform",
        organizationId: "platform-pollycar",
        organizationName: "PollyCar 平台",
        cityScopes: ["上海"],
        operatorScopes: ["operator-huhang", "operator-haiwan"],
        purpose: "platform_operations",
        fixed: false,
      },
      roleIds: ["technical_operations"],
      items: [
        {
          id: "workbench",
          label: "工作台",
          route: "/admin/workbench",
          availability: "available",
          children: [],
        },
        {
          id: "audit_system",
          label: "审计与系统",
          route: "/admin/governance",
          availability: "available",
          children: [],
        },
      ],
      routePermissions: ["workbench:read", "audit_system:read"],
    },
  };
}

function fixtureDataReportSession(): AdminProductSession {
  const base = fixtureSession();
  const workIdentity = {
    ...base.workIdentity,
    workIdentityId: "synthetic-data-analyst-001",
    legacyAccessToken: "synthetic-data-analyst-001",
    type: "platform" as const,
    organizationId: "platform-pollycar",
    organizationName: "PollyCar 平台",
    productRole: "data_analyst" as const,
    productRoleName: "数据分析人员",
  };
  return {
    ...base,
    workIdentity,
    navigation: {
      ...base.navigation,
      workIdentityId: workIdentity.workIdentityId,
      organizationContext: {
        organizationType: "platform",
        organizationId: "platform-pollycar",
        organizationName: "PollyCar 平台",
        cityScopes: ["上海"],
        operatorScopes: ["operator-huhang", "operator-haiwan"],
        purpose: "platform_operations",
        fixed: false,
      },
      roleIds: ["data_analyst"],
      items: [
        {
          id: "workbench",
          label: "工作台",
          route: "/admin/workbench",
          availability: "available",
          children: [],
        },
        {
          id: "data_reports",
          label: "数据与报表",
          route: "/admin/reports",
          availability: "available",
          children: [],
        },
      ],
      routePermissions: ["workbench:read", "data_reports:read"],
    },
  };
}

function fixtureDataReportDetail(
  session: AdminProductSession,
): AdminDataReportDetail {
  return {
    item: {
      reportId: "operations-health",
      domain: "operations",
      title: "运营任务健康报表",
      summary: "范围内运营任务总量、未完成量与受阻量的去标识聚合。",
      state: "ready",
      organizationId: session.workIdentity.organizationId,
      organizationName: session.workIdentity.organizationName,
      metricCount: 3,
      resourceVersion: 1,
      refreshedAt: "2026-07-16T12:00:00.000Z",
      synthetic: true,
    },
    metrics: [
      {
        metricId: "operations_total_tasks",
        label: "范围内任务",
        displayValue: "6",
        state: "ready",
        asOf: "2026-07-16T12:00:00.000Z",
        source: "operations_task_store",
        synthetic: true,
      },
      {
        metricId: "operations_open_tasks",
        label: "未完成任务",
        displayValue: "4",
        state: "ready",
        asOf: "2026-07-16T12:00:00.000Z",
        source: "operations_task_store",
        synthetic: true,
      },
      {
        metricId: "operations_blocked_tasks",
        label: "受阻任务",
        displayValue: "1",
        state: "ready",
        asOf: "2026-07-16T12:00:00.000Z",
        source: "operations_task_store",
        synthetic: true,
      },
    ],
    allowedActions: ["refresh_report"],
    auditTrail: [{
      eventId: "data-report-view-001",
      action: "data_report_viewed",
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.productRoleName,
      occurredAt: "2026-07-16T12:00:00.000Z",
    }],
    sourceBoundary: {
      aggregateOnly: true,
      personLevelDataAvailable: false,
      realDataAvailable: false,
      exportAvailable: false,
    },
    synthetic: true,
  };
}

function fixtureAuditEventDetail(
  session: AdminProductSession,
): Extract<AdminAuditDetail, { kind: "event" }> {
  return {
    kind: "event",
    item: {
      resourceId: "audit-event-001",
      kind: "event",
      domain: "access",
      title: "访问决策拒绝",
      summary: "list_operator_directory · operator_directory",
      organizationType: "platform",
      organizationId: "platform-pollycar",
      organizationName: "PollyCar 平台",
      result: "denied",
      actorRole: "internal-platform-ops-001",
      correlationId: "audit-correlation-001",
      blocking: true,
      resourceVersion: 1,
      occurredAt: "2026-07-16T11:00:00.000Z",
      synthetic: true,
    },
    record: {
      event: {
        eventId: "audit-event-001",
        eventType: "access_denied",
        occurredAt: "2026-07-16T11:00:00.000Z",
        actorInternalUserId: "internal-platform-ops-001",
        actorMembershipId: "membership-platform-ops-001",
        organizationType: "platform",
        organizationId: "platform-pollycar",
        requestId: "audit-request-001",
        correlationId: "audit-correlation-001",
        result: "denied",
        action: "list_operator_directory",
        resourceType: "operator_directory",
        resourceId: "all",
        reasonCode: "AUTHORIZATION_DENIED",
        synthetic: true,
      },
    },
    allowedActions: ["open_investigation"],
    auditTrail: [{
      eventId: "audit-view-001",
      action: "audit_resource_viewed",
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.productRoleName,
      occurredAt: "2026-07-16T11:00:00.000Z",
    }],
    integrity: {
      canonicalPayloadDigest: "digest-audit-event-001",
      appendOnly: true,
      rawSensitivePayloadAvailable: false,
    },
    synthetic: true,
  };
}

function fixtureAuditInvestigationDetail(
  session: AdminProductSession,
): Extract<AdminAuditDetail, { kind: "investigation" }> {
  return {
    kind: "investigation",
    item: {
      resourceId: "audit-investigation-001",
      kind: "investigation",
      domain: "access",
      title: "调查：访问决策拒绝",
      summary: "access_pattern_review",
      organizationType: "platform",
      organizationId: "platform-pollycar",
      organizationName: "PollyCar 平台",
      result: "open",
      blocking: true,
      resourceVersion: 1,
      occurredAt: "2026-07-16T11:01:00.000Z",
      synthetic: true,
    },
    record: {
      investigationId: "audit-investigation-001",
      sourceEventId: "audit-event-001",
      domain: "access",
      state: "open",
      title: "调查：访问决策拒绝",
      reasonCode: "access_pattern_review",
      organizationType: "platform",
      organizationId: "platform-pollycar",
      organizationName: "PollyCar 平台",
      notes: [],
      resourceVersion: 1,
      createdAt: "2026-07-16T11:01:00.000Z",
      updatedAt: "2026-07-16T11:01:00.000Z",
      synthetic: true,
    },
    allowedActions: [
      "assign_investigation",
      "add_investigation_note",
      "resolve_investigation",
    ],
    auditTrail: [{
      eventId: "audit-trail-open-001",
      action: "audit_investigation_opened",
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.productRoleName,
      occurredAt: "2026-07-16T11:01:00.000Z",
      nextState: "open",
      note: "access_pattern_review",
    }],
    integrity: {
      canonicalPayloadDigest: "digest-audit-investigation-001",
      appendOnly: true,
      rawSensitivePayloadAvailable: false,
    },
    synthetic: true,
  };
}

function fixtureFinanceDetail(
  session: AdminProductSession,
): Extract<AdminFinanceDetail, { kind: "settlement" }> {
  const context = {
    organizationType: session.workIdentity.type,
    organizationId: session.workIdentity.organizationId,
    organizationName: session.workIdentity.organizationName,
    cityScopes: session.workIdentity.cityScopes,
    operatorScopes:
      session.workIdentity.type === "platform"
        ? ["operator-huhang"]
        : [session.workIdentity.organizationId],
    purpose:
      session.workIdentity.type === "platform"
        ? "platform_operations" as const
        : "operator_operations" as const,
    fixed: session.workIdentity.type === "operator",
  };
  return {
    kind: "settlement",
    item: {
      resourceId: "settlement-synthetic-184",
      kind: "settlement",
      operatorId: "operator-huhang",
      operatorName: "沪行出行服务",
      businessDate: "2026-07-13",
      state: "eligible",
      summary: "沪行出行服务分配结算批次",
      blocking: false,
      resourceVersion: 1,
      updatedAt: "2026-07-16T08:06:00.000Z",
      synthetic: true,
    },
    record: {
      context,
      settlementBatchId: "settlement-synthetic-184",
      operatorId: "operator-huhang",
      operatorName: "沪行出行服务",
      businessDate: "2026-07-13",
      state: "eligible",
      allocationRuleVersion: "allocation-15-45-40-v1",
      allocationRates: { platform: 15, operator: 45, driver: 40 },
      allocationCount: 127,
      platformShareMinor: "1912500",
      operatorShareMinor: "5733000",
      driverShareMinor: "5109000",
      grossSettlementMinor: "10842000",
      reconciliationRunId: "reconciliation-synthetic-0714-ready",
      blockers: [],
      resourceVersion: 1,
      amountEditable: false,
      synthetic: true,
    },
    organizationScope: {
      organizationId: session.workIdentity.organizationId,
      organizationName: session.workIdentity.organizationName,
      cityScopes: session.workIdentity.cityScopes,
    },
    allowedActions: ["prepare_operator_settlement"],
    auditTrail: [{
      eventId: "finance-audit-view-1",
      action: "finance_profile_viewed",
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.productRoleName,
      occurredAt: "2026-07-16T08:00:00.000Z",
    }],
    directBalanceMutationAllowed: false,
    realMoneyMovementAllowed: false,
    synthetic: true,
  };
}

function fixtureDriverDetail(
  session: AdminProductSession,
): AdminDriverDetail {
  const vehicleDetail = fixtureVehicleDetail(session);
  const driver = vehicleDetail.driver;
  const relationship = vehicleDetail.profile.primaryOperatorRelationship;
  return {
    driver,
    profile: {
      context: session.navigation.organizationContext,
      driverAccountId: driver.driverAccountId,
      displayNameMasked: driver.displayNameMasked,
      phoneMasked: driver.phoneMasked,
      eligibilityState: driver.eligibilityState,
      quotaSummary: "本周期可继续提供服务",
      primaryOperatorRelationship: relationship,
      relationshipHistory: [relationship],
      vehicles: [{
        vehicleId: vehicleDetail.vehicle.vehicleId,
        plateMasked: vehicleDetail.vehicle.plateMasked,
        reviewState: vehicleDetail.vehicle.reviewState,
      }],
      sensitiveFieldsMasked: true,
      synthetic: true,
    },
    organizationScope: {
      organizationId: session.workIdentity.organizationId,
      organizationName: session.workIdentity.organizationName,
      cityScopes: session.workIdentity.cityScopes,
    },
    linkedVehicles: [vehicleDetail.vehicle],
    auditTrail: [{
      eventId: "driver-view-1",
      action: "driver_profile_viewed",
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.productRoleName,
      occurredAt: "2026-07-19T08:00:00.000Z",
    }],
    synthetic: true,
  };
}

function fixtureFleetSession(): AdminProductSession {
  const base = fixtureSession();
  const workIdentity = {
    ...base.workIdentity,
    workIdentityId: "synthetic-reviewer-001",
    legacyAccessToken: "synthetic-reviewer-001",
    type: "platform" as const,
    organizationId: "platform-pollycar",
    organizationName: "PollyCar 平台",
    productRole: "reviewer" as const,
    productRoleName: "车辆审核员",
  };
  return {
    ...base,
    workIdentity,
    navigation: {
      ...base.navigation,
      workIdentityId: workIdentity.workIdentityId,
      organizationContext: {
        ...base.navigation.organizationContext,
        organizationType: "platform",
        organizationId: "platform-pollycar",
        organizationName: "PollyCar 平台",
        operatorScopes: [
          "operator-huhang",
          "operator-shencheng",
          "operator-haiwan",
        ],
        purpose: "platform_operations",
        fixed: false,
      },
      roleIds: ["reviewer"],
      items: base.navigation.items.map((item) => {
        if (item.id !== "driver_vehicle") return item;
        const { unavailableReason: _unavailableReason, ...available } = item;
        return {
          ...available,
          availability: "available" as const,
        };
      }),
      operationPermissions: [
        "read",
        "fleet:claim",
        "fleet:request_material",
        "fleet:approve",
        "fleet:reject",
      ],
    },
  };
}

function fixtureTripSession(): AdminProductSession {
  const base = fixturePlatformSession();
  return {
    ...base,
    navigation: {
      ...base.navigation,
      items: base.navigation.items.map((item) => {
        if (item.id !== "trip_operations") return item;
        const { unavailableReason: _unavailableReason, ...available } = item;
        return {
          ...available,
          availability: "available" as const,
        };
      }),
      operationPermissions: [
        ...base.navigation.operationPermissions,
        "trip:triage",
        "trip:request_domain_action",
      ],
    },
  };
}

function fixtureCaseSession(): AdminProductSession {
  const base = fixturePlatformSession();
  const workIdentity = {
    ...base.workIdentity,
    workIdentityId: "synthetic-support-001",
    legacyAccessToken: "synthetic-support-001",
    productRole: "customer_support" as const,
    productRoleName: "平台客服",
  };
  return {
    ...base,
    workIdentity,
    navigation: {
      ...base.navigation,
      workIdentityId: workIdentity.workIdentityId,
      roleIds: ["customer_support"],
      items: base.navigation.items.map((item) => {
        if (item.id !== "support_safety") return item;
        const { unavailableReason: _unavailableReason, ...available } = item;
        return {
          ...available,
          availability: "available" as const,
        };
      }),
      operationPermissions: [
        ...base.navigation.operationPermissions,
        "case:update",
      ],
    },
  };
}

function fixtureFinanceSession(): AdminProductSession {
  const base = fixturePlatformSession();
  const workIdentity = {
    ...base.workIdentity,
    workIdentityId: "synthetic-finance-officer-001",
    legacyAccessToken: "synthetic-finance-officer-001",
    productRole: "finance_officer" as const,
    productRoleName: "平台财务经办",
  };
  return {
    ...base,
    workIdentity,
    navigation: {
      ...base.navigation,
      workIdentityId: workIdentity.workIdentityId,
      roleIds: ["finance_officer"],
      items: [
        ...base.navigation.items,
        {
          id: "finance_operations" as const,
          label: "财务与对账",
          route: "/admin/finance",
          availability: "available" as const,
          children: [],
        },
      ],
      routePermissions: [
        ...base.navigation.routePermissions,
        "finance_operations:read",
      ],
      operationPermissions: [
        ...base.navigation.operationPermissions,
        "finance:prepare",
      ],
    },
  };
}

function fixtureMembershipSession(): AdminProductSession {
  const base = fixturePlatformSession();
  const workIdentity = {
    ...base.workIdentity,
    workIdentityId: "synthetic-platform-access-admin-001",
    legacyAccessToken: "synthetic-platform-access-admin-001",
    productRole: "platform_access_administrator" as const,
    productRoleName: "平台账号管理员",
  };
  return {
    ...base,
    workIdentity,
    navigation: {
      ...base.navigation,
      workIdentityId: workIdentity.workIdentityId,
      roleIds: ["platform_access_administrator"],
      items: [
        ...base.navigation.items,
        {
          id: "organization_accounts" as const,
          label: "成员与权限",
          route: "/admin/organization-accounts",
          availability: "available" as const,
          children: [],
        },
      ],
      routePermissions: [
        ...base.navigation.routePermissions,
        "organization_accounts:read",
      ],
      operationPermissions: [
        ...base.navigation.operationPermissions,
        "membership:suspend",
        "membership:restore",
      ],
    },
  };
}

function fixtureMembershipDetail(
  session: AdminProductSession,
  suspended = false,
): AdminMembershipDetail {
  return {
    item: {
      membershipId: "membership-platform-ops-001",
      internalUserId: "internal-platform-ops-001",
      workIdentityId: "synthetic-platform-ops-001",
      displayName: "林岚",
      workEmailMasked: "li***@rego.example",
      organizationType: "platform",
      organizationId: "platform-pollycar",
      organizationName: "PollyCar 平台",
      productRole: "operations_lead",
      productRoleName: "平台运营负责人",
      state: suspended ? "suspended" : "active",
      activeSessionCount: suspended ? 0 : 2,
      resourceVersion: suspended ? 2 : 1,
      updatedAt: "2026-07-19T08:00:00.000Z",
      synthetic: true,
    },
    roleBinding: {
      roleId: "operations_lead",
      roleName: "平台运营负责人",
      source: "authoritative_membership",
      mutable: false,
    },
    scopeBindings: {
      organizationId: session.workIdentity.organizationId,
      organizationName: session.workIdentity.organizationName,
      cityScopes: session.workIdentity.cityScopes,
    },
    allowedActions: suspended
      ? ["restore_membership"]
      : ["suspend_membership"],
    auditTrail: [{
      eventId: suspended ? "membership-suspended-1" : "membership-viewed-1",
      action: suspended
        ? "admin_membership_suspended"
        : "admin_membership_viewed",
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.productRoleName,
      occurredAt: "2026-07-19T08:00:00.000Z",
      ...(suspended
        ? {
            previousState: "active" as const,
            nextState: "suspended" as const,
            reasonCode: "access_risk_control",
          }
        : {}),
    }],
    capabilityBoundary: {
      realAccountAvailable: false,
      roleMutationAvailable: false,
      invitationAvailable: false,
      directPermissionBindingAvailable: false,
    },
    synthetic: true,
  };
}

function fixtureCaseDetail(
  session: AdminProductSession,
): import("@pollycar/contracts").AdminSupportCaseDetail {
  const profile = {
    context: session.navigation.organizationContext,
    supportCaseId: "support-synthetic-114",
    tripId: "trip-synthetic-8466",
    operatorId: "operator-shencheng",
    category: "schedule" as const,
    state: "investigating" as const,
    resourceVersion: 5,
    ownerInternalUserId: "internal-support-001",
    userSummary: "乘客询问计划接驾时间",
    investigationSummary: "等待行程领域返回处理结果",
    safetyEvidenceAvailable: false as const,
    financeMutationAllowed: false as const,
    synthetic: true as const,
  };
  const trip = {
    context: session.navigation.organizationContext,
    tripId: profile.tripId,
    operatorId: profile.operatorId,
    operatorName: "申城伙伴运营",
    authoritativeState: "scheduled" as const,
    authoritativeVersion: 11,
    routeSummary: "静安寺 → 浦东机场",
    passengerMasked: "乘客 18**",
    driverMasked: "车主 36**",
    vehicleMasked: "沪B·P6**8",
    relatedSupportCaseId: profile.supportCaseId,
    financeReadOnly: true as const,
    operatorSnapshotImmutable: true as const,
    directTripMutationAllowed: false as const,
    synthetic: true as const,
  };
  return {
    kind: "support",
    case: {
      caseId: profile.supportCaseId,
      kind: "support",
      tripId: profile.tripId,
      operatorId: profile.operatorId,
      operatorName: trip.operatorName,
      state: profile.state,
      category: profile.category,
      summary: profile.userSummary,
      resourceVersion: profile.resourceVersion,
      updatedAt: "2026-07-16T08:00:00.000Z",
      synthetic: true,
    },
    profile,
    trip,
    organizationScope: {
      organizationId: session.workIdentity.organizationId,
      organizationName: session.workIdentity.organizationName,
      cityScopes: session.workIdentity.cityScopes,
    },
    allowedActions: [
      "continue_investigation",
      "await_user",
      "await_internal",
      "resolve",
      "close",
      "escalate_operations",
      "escalate_safety",
      "escalate_finance",
    ],
    auditTrail: [{
      eventId: "case-audit-view-1",
      action: "case_profile_viewed",
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.productRoleName,
      occurredAt: "2026-07-16T08:00:00.000Z",
    }],
    synthetic: true,
  };
}

function fixtureTripDetail(
  session: AdminProductSession,
): import("@pollycar/contracts").AdminTripDetail {
  const profile = {
    context: session.navigation.organizationContext,
    tripId: "trip-synthetic-8466",
    operatorId: "operator-shencheng",
    operatorName: "申城伙伴运营",
    authoritativeState: "scheduled" as const,
    authoritativeVersion: 11,
    routeSummary: "静安寺 → 浦东机场（合成路线）",
    passengerMasked: "乘客 18**",
    driverMasked: "车主 36**",
    vehicleMasked: "沪B·P6**8",
    relatedSupportCaseId: "support-synthetic-114",
    financeReadOnly: true as const,
    operatorSnapshotImmutable: true as const,
    directTripMutationAllowed: false as const,
    synthetic: true as const,
  };
  const operationTask = {
    taskId: "trip-task-synthetic-8466",
    tripId: profile.tripId,
    operatorId: profile.operatorId,
    operatorName: profile.operatorName,
    category: "schedule" as const,
    state: "coordinating" as const,
    priority: "high" as const,
    summary: "计划接驾时间临近，等待权威行程状态",
    resourceVersion: 4,
    synthetic: true as const,
  };
  return {
    trip: {
      tripId: profile.tripId,
      operatorId: profile.operatorId,
      operatorName: profile.operatorName,
      authoritativeState: profile.authoritativeState,
      authoritativeVersion: profile.authoritativeVersion,
      routeSummary: profile.routeSummary,
      passengerMasked: profile.passengerMasked,
      driverMasked: profile.driverMasked,
      vehicleMasked: profile.vehicleMasked,
      operationTaskId: operationTask.taskId,
      operationCategory: operationTask.category,
      operationState: operationTask.state,
      priority: operationTask.priority,
      relatedSupportCaseId: profile.relatedSupportCaseId,
      updatedAt: "2026-07-15T10:00:00.000Z",
      synthetic: true,
    },
    profile,
    operationTask,
    relatedCases: {
      supportCaseId: profile.relatedSupportCaseId,
    },
    organizationScope: {
      organizationId: session.workIdentity.organizationId,
      organizationName: session.workIdentity.organizationName,
      cityScopes: session.workIdentity.cityScopes,
    },
    allowedActions: ["request_domain_action"],
    auditTrail: [{
      eventId: "trip-audit-view-1",
      action: "trip_profile_viewed",
      actorLabel: session.workIdentity.organizationName,
      actorRole: session.workIdentity.productRoleName,
      occurredAt: "2026-07-15T10:00:00.000Z",
    }],
    directTripMutationAllowed: false,
    synthetic: true,
  };
}

function fixtureVehicleDetail(
  session: AdminProductSession,
  claimed = false,
): import("@pollycar/contracts").AdminVehicleDetail {
  const vehicle = {
    vehicleId: "vehicle-synthetic-226",
    plateMasked: "沪D·5**73",
    vehicleSummary: "紧凑型五座轿车",
    driverAccountId: "driver-synthetic-126",
    driverNameMasked: "林*",
    operatorId: "operator-haiwan",
    operatorName: "海湾城市服务",
    reviewState: "under_review" as const,
    reviewTaskId: "task-003",
    reviewTaskStatus: claimed ? "in_progress" as const : "available" as const,
    resourceVersion: 1,
    updatedAt: "2026-07-15T09:30:00.000Z",
    synthetic: true as const,
  };
  const driver = {
    driverAccountId: "driver-synthetic-126",
    displayNameMasked: "林*",
    phoneMasked: "136****5179",
    operatorId: "operator-haiwan",
    operatorName: "海湾城市服务",
    eligibilityState: "restricted" as const,
    vehicleCount: 1,
    reviewAttentionCount: 1,
    updatedAt: "2026-07-15T09:30:00.000Z",
    synthetic: true as const,
  };
  const reviewTask = {
    taskId: "task-003",
    applicationId: "application-003",
    accountReference: "合成账户 · 003",
    status: claimed ? "in_progress" as const : "available" as const,
    submittedAt: "2026-07-11T08:32:00.000Z",
    vehicleCategory: "紧凑型轿车",
    insuranceExpiryStatus: "complete" as const,
    authorizationEvidenceStatus: "complete" as const,
    attachmentValidationStatus: "valid" as const,
    taskVersion: claimed ? 2 : 1,
    vehicleReviewVersion: 1,
    ...(claimed
      ? {
          lease: {
            ownerId: "synthetic-reviewer-001",
            claimedAt: "2026-07-15T10:00:00.000Z",
            expiresAt: "2026-07-15T10:30:00.000Z",
          },
        }
      : {}),
    synthetic: true as const,
  };
  return {
    vehicle,
    profile: {
      context: session.navigation.organizationContext,
      vehicleId: vehicle.vehicleId,
      plateMasked: vehicle.plateMasked,
      vehicleSummary: vehicle.vehicleSummary,
      driverAccountId: driver.driverAccountId,
      driverNameMasked: driver.displayNameMasked,
      review: {
        state: "under_review",
        resourceVersion: 1,
        authoritativeSource: "spec/domain/vehicle-review.yaml",
      },
      primaryOperatorRelationship: {
        relationshipId: "relationship-synthetic-005",
        driverAccountId: driver.driverAccountId,
        vehicleId: vehicle.vehicleId,
        cityCode: "CN-SH",
        operatorId: vehicle.operatorId,
        operatorName: vehicle.operatorName,
        state: "active",
        effectiveFrom: "2026-07-11T00:00:00.000Z",
        authoritativeSource:
          "pollycar_finance.driver_operator_memberships",
        synthetic: true,
      },
      expiringDocumentCount: 0,
      directReviewMutationAllowed: false,
      sensitiveFieldsMasked: true,
      synthetic: true,
    },
    driver,
    organizationScope: {
      organizationId: session.workIdentity.organizationId,
      organizationName: session.workIdentity.organizationName,
      cityScopes: session.workIdentity.cityScopes,
    },
    reviewTask,
    allowedActions: claimed
      ? ["request_material", "reject", "approve"]
      : ["claim"],
    auditTrail: claimed
      ? [{
          id: "audit-task-003-2-task_claimed-succeeded",
          occurredAt: "2026-07-15T10:00:00.000Z",
          actorId: "synthetic-reviewer-001",
          action: "task_claimed",
          outcome: "succeeded",
          reasonCode: "atomic_claim",
          taskId: "task-003",
          correlationId: "correlation-1",
          synthetic: true,
        }]
      : [],
    synthetic: true,
  };
}

function fixturePlatformSession(): AdminProductSession {
  const base = fixtureSession();
  const workIdentity = {
    ...base.workIdentity,
    workIdentityId: "synthetic-platform-ops-001",
    legacyAccessToken: "synthetic-platform-ops-001",
    type: "platform" as const,
    organizationId: "platform-pollycar",
    organizationName: "PollyCar 平台",
    productRole: "operations_lead" as const,
    productRoleName: "平台运营负责人",
  };
  return {
    ...base,
    workIdentity,
    navigation: {
      ...base.navigation,
      workIdentityId: workIdentity.workIdentityId,
      organizationContext: {
        organizationType: "platform",
        organizationId: "platform-pollycar",
        organizationName: "PollyCar 平台",
        cityScopes: ["上海"],
        operatorScopes: ["operator-huhang", "operator-shencheng"],
        purpose: "platform_operations",
        fixed: false,
      },
      roleIds: ["operations_lead"],
      operationPermissions: [
        "read",
        "assign",
        "review",
        "operator:restrict",
        "operator:reactivate",
      ],
    },
  };
}
