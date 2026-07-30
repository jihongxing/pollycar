import { describe, expect, it } from "vitest";
import { DisabledProductionDriverLivenessProvider } from "./disabled-production-driver-liveness-provider.js";

describe("真实车主活体供应商关闭 Adapter", () => {
  it("拒绝合成调用绕到生产 Adapter", async () => {
    const provider = new DisabledProductionDriverLivenessProvider();
    await expect(provider.evaluateSynthetic("passed")).rejects.toThrow(
      "FEATURE_DISABLED",
    );
  });

  it("在缺少外部批准时拒绝创建真实供应商会话", async () => {
    const provider = new DisabledProductionDriverLivenessProvider();
    await expect(provider.createRealSession()).rejects.toThrow(
      "EXTERNAL_IDENTITY_PROVIDER_DISABLED",
    );
  });
});
