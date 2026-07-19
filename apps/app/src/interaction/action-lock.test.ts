import { describe, expect, it, vi } from "vitest";

import { createActionLock } from "./action-lock";

describe("异步操作锁", () => {
  it("同一操作运行期间拒绝重复提交", async () => {
    let finish: (() => void) | undefined;
    const action = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const lock = createActionLock();

    const first = lock.run("vehicle.submit", action);
    const second = lock.run("vehicle.submit", action);

    await expect(second).resolves.toBe(false);
    expect(action).toHaveBeenCalledTimes(1);
    finish?.();
    await expect(first).resolves.toBe(true);
  });

  it("失败后释放操作，允许用户重试", async () => {
    const lock = createActionLock();

    await expect(
      lock.run("message.send", async () => {
        throw new Error("SEND_FAILED");
      }),
    ).rejects.toThrow("SEND_FAILED");
    await expect(lock.run("message.send", async () => undefined)).resolves.toBe(true);
  });
});
