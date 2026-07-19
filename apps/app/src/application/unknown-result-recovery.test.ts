import { describe, expect, it, vi } from "vitest";

import { executeWriteWithReconciliation } from "./unknown-result-recovery";

describe("未知写入结果恢复", () => {
  it("只读取最新状态且不自动重放写入", async () => {
    const write = vi.fn().mockRejectedValue(new Error("UNKNOWN_RESULT"));
    const refresh = vi.fn().mockResolvedValue(undefined);

    await expect(executeWriteWithReconciliation(write, refresh)).rejects.toThrow("UNKNOWN_RESULT");
    expect(write).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("确定失败时不执行恢复读取", async () => {
    const write = vi.fn().mockRejectedValue(new Error("VEHICLE_REVIEW_INVALID_STATE"));
    const refresh = vi.fn();

    await expect(executeWriteWithReconciliation(write, refresh)).rejects.toThrow(
      "VEHICLE_REVIEW_INVALID_STATE",
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
