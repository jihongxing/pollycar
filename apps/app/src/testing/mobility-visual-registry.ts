export const mobilityVisualViewports = Object.freeze([
  { id: "390", width: 390, height: 844 },
  { id: "430", width: 430, height: 932 },
  { id: "desktop", width: 1280, height: 900 },
] as const);

export type MobilityVisualViewportId = (typeof mobilityVisualViewports)[number]["id"];
export type MobilityVisualGroup = "passenger" | "driver" | "shared";
export type MobilityVisualBaselineState = "planned" | "active";

export type MobilityVisualPage = Readonly<{
  id: `R0${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}` | `D${`0${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}` | "10"}` | `S0${1 | 2 | 3}`;
  group: MobilityVisualGroup;
  route: string;
  title: string;
  fixture: string;
  expectedAnchor: string;
  viewports: readonly MobilityVisualViewportId[];
  baselineState: MobilityVisualBaselineState;
}>;

const requiredViewports = mobilityVisualViewports.map((viewport) => viewport.id);

export const mobilityVisualPages = Object.freeze([
  page("R01", "passenger", "/ride-home", "乘客叫车首页", "passenger-ready", "你要去哪里？", "active"),
  page("R02", "passenger", "/ride-search", "地点搜索", "passenger-search", "选择目的地", "active"),
  page("R03", "passenger", "/ride-confirmation", "行程确认", "passenger-confirmation", "确认行程", "active"),
  page("R04", "passenger", "/ride-matching", "等待接单", "passenger-matching", "正在等待附近车主", "active"),
  page("R05", "passenger", "/ride-pickup", "接驾状态", "passenger-pickup", "车主正在前往上车点", "active"),
  page("R06", "passenger", "/ride-cancellation", "取消行程", "passenger-cancellation", "取消行程", "active"),
  page("R07", "passenger", "/ride-active", "行程进行中", "passenger-active", "行程进行中", "active"),
  page("R08", "passenger", "/ride-completion", "行程完成", "passenger-completion", "已到达目的地", "active"),
  page("D01", "driver", "/driver-home", "车主工作台", "driver-offline", "准备接单", "active"),
  page("D02", "driver", "/driver-orders", "附近订单", "driver-orders", "附近订单", "active"),
  page("D03", "driver", "/driver-pickup", "车主接驾", "driver-pickup", "前往上车点", "active"),
    page("D04", "driver", "/driver-waiting-pickup", "等待乘客上车", "driver-waiting", "等待乘车人上车", "active"),
  page("D05", "driver", "/driver-active", "车主履约中", "driver-active", "行程进行中", "active"),
  page("D06", "driver", "/driver-completion", "车主履约完成", "driver-completion", "行程已完成", "active"),
  page("D07", "driver", "/driver-history", "车主订单历史", "driver-history", "我的订单", "active"),
  page("D08", "driver", "/driver-wallet", "车主钱包", "driver-wallet", "资金中心", "active"),
  page("D09", "driver", "/driver-bank-card", "银行卡管理", "driver-bank-card", "绑定银行卡", "active"),
  page("D10", "driver", "/driver-withdraw", "提现申请", "driver-withdraw", "提现", "active"),
  page("S01", "shared", "/trip-chat", "行程联系", "shared-trip-chat", "行程联系", "active"),
  page("S02", "shared", "/message-center", "消息中心", "shared-message-center", "消息", "active"),
    page("S03", "shared", "/account", "账户与身份", "shared-account", "账户与设置", "active"),
] satisfies readonly MobilityVisualPage[]);

function page(
  id: MobilityVisualPage["id"],
  group: MobilityVisualGroup,
  route: string,
  title: string,
  fixture: string,
  expectedAnchor: string,
  baselineState: MobilityVisualBaselineState = "planned",
): MobilityVisualPage {
  return {
    id,
    group,
    route,
    title,
    fixture,
    expectedAnchor,
    viewports: requiredViewports,
    baselineState,
  };
}
