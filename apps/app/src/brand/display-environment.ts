export type BrandDisplayEnvironment = "sandbox" | "demo" | "production";

const internalMarkers = [
  "内部沙箱", "合成数据", "合成材料", "合成资产", "合成消息", "合成记录",
  "合成账户", "合成车辆", "合成位置", "合成行程", "合成金额", "合成卡",
  "合成银行卡", "测试卡", "Server", "机器码", "生产数据库",
] as const;

const requiredDisclosureMarkers = [
  "费用", "支付", "扣款", "结算", "提现", "绑卡", "银行卡", "安全", "责任",
  "取消", "身份", "人脸", "授权", "隐私", "位置", "数据", "删除", "保留",
  "冻结", "申诉", "审核", "资格", "配额",
] as const;

export function resolveBrandDisplayEnvironment(
  value = process.env.EXPO_PUBLIC_BRAND_DISPLAY_ENV,
): BrandDisplayEnvironment {
  if (process.env.EXPO_PUBLIC_BRAND_PRODUCTION === "true") return "production";
  if (process.env.EXPO_PUBLIC_BRAND_DEMO === "true") return "demo";
  if (value === "demo" || value === "production") return value;
  return "sandbox";
}

export function presentBrandCopy(
  value: string,
  environment = resolveBrandDisplayEnvironment(),
): string | undefined {
  if (environment === "sandbox") return value;
  if (environment === "demo") {
    return value
      .replaceAll("◇ 内部沙箱", "演示")
      .replaceAll("内部沙箱", "演示环境")
      .replaceAll("合成数据", "演示数据")
      .replaceAll("合成", "演示");
  }
  if (value.includes("◇ 内部沙箱")) return undefined;
  const internal = internalMarkers.some((marker) => value.includes(marker));
  const disclosure = requiredDisclosureMarkers.some((marker) => value.includes(marker));
  if (internal && !disclosure) return undefined;
  return value
    .replaceAll("真实支付保持关闭；确认后仅创建合成行程，不会扣款。", "确认后将创建行程；当前不会扣款。")
    .replaceAll("当前内部沙箱只使用合成材料", "当前验证流程不会保存非必要身份材料")
    .replaceAll("内部沙箱", "")
    .replaceAll("合成数据", "当前数据")
    .replaceAll("合成材料", "验证材料")
    .replaceAll("合成资产", "当前资产")
    .replaceAll("合成消息", "行程消息")
    .replaceAll("合成记录", "当前记录")
    .replaceAll("合成账户", "账户")
    .replaceAll("合成车辆", "车辆")
    .replaceAll("合成位置", "位置")
    .replaceAll("合成行程", "行程")
    .replaceAll("合成金额", "金额")
    .replaceAll("合成银行卡", "银行卡")
    .replaceAll("合成卡", "银行卡")
    .replaceAll("测试卡", "银行卡")
    .replaceAll("合成", "")
    .replaceAll("真实支付保持关闭", "当前不会扣款")
    .replaceAll("真实资金能力关闭", "资金能力暂不可用")
    .replaceAll("真实绑卡关闭", "绑卡能力暂不可用")
    .replaceAll("真实提现关闭", "提现能力暂不可用")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function environmentIndicatorLabel(
  environment = resolveBrandDisplayEnvironment(),
): string | undefined {
  if (environment === "sandbox") return "内部沙箱";
  if (environment === "demo") return "演示";
  return undefined;
}
