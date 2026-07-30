import { describe, expect, it } from "vitest";
import { environmentIndicatorLabel, presentBrandCopy, resolveBrandDisplayEnvironment } from "./display-environment";

describe("品牌展示环境", () => {
  it("默认使用完整内部沙箱展示", () => {
    expect(resolveBrandDisplayEnvironment("sandbox")).toBe("sandbox");
    expect(environmentIndicatorLabel("sandbox")).toBe("内部沙箱");
    expect(presentBrandCopy("合成消息由 Server 保存", "sandbox")).toBe("合成消息由 Server 保存");
  });

  it("演示环境使用低干扰标识和演示语义", () => {
    expect(environmentIndicatorLabel("demo")).toBe("演示");
    expect(presentBrandCopy("当前内部沙箱只使用合成数据", "demo")).toBe("当前演示环境只使用演示数据");
  });

  it("只接受公开配置解析后的展示环境", () => {
    expect(resolveBrandDisplayEnvironment("demo")).toBe("demo");
    expect(resolveBrandDisplayEnvironment("production")).toBe("production");
  });

  it("生产环境隐藏纯内部说明", () => {
    expect(environmentIndicatorLabel("production")).toBeUndefined();
    expect(presentBrandCopy("合成消息由 Server 保存", "production")).toBeUndefined();
    expect(presentBrandCopy("◇ 内部沙箱", "production")).toBeUndefined();
  });

  it("生产环境保留费用、安全和责任披露", () => {
    expect(presentBrandCopy("真实支付保持关闭；确认后仅创建合成行程，不会扣款。", "production")).toContain("不会扣款");
    expect(presentBrandCopy("安全冻结期间不能继续履约。", "production")).toBe("安全冻结期间不能继续履约。");
    expect(presentBrandCopy("取消责任由服务端规则判定。", "production")).toBe("取消责任由服务端规则判定。");
  });
});
