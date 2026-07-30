import { describe, expect, it } from "vitest";
import {
  advanceDriverLivenessAction,
  driverLivenessActionTimeoutMs,
  driverLivenessErrorPresentation,
} from "./driver-liveness-flow-model";

describe("车主活体检测交互模型", () => {
  it("按顺序推进动作并只在最后一步提交", () => {
    expect(advanceDriverLivenessAction(0, 3)).toEqual({
      nextIndex: 1,
      completed: false,
    });
    expect(advanceDriverLivenessAction(1, 3)).toEqual({
      nextIndex: 2,
      completed: false,
    });
    expect(advanceDriverLivenessAction(2, 3)).toEqual({
      nextIndex: 2,
      completed: true,
    });
  });

  it("相机拒绝、未知结果和网络异常均明确保持离线并提供恢复动作", () => {
    expect(
      driverLivenessErrorPresentation("CAMERA_PERMISSION_DENIED"),
    ).toMatchObject({ title: "需要相机权限" });
    expect(
      driverLivenessErrorPresentation("DRIVER_LIVENESS_RESULT_UNKNOWN"),
    ).toMatchObject({
      title: "结果仍在确认",
      description: expect.stringContaining("离线"),
    });
    expect(
      driverLivenessErrorPresentation("SERVICE_UNAVAILABLE"),
    ).toMatchObject({
      title: "暂时无法完成检测",
      description: expect.stringContaining("重试"),
    });
  });

  it("按服务端动作时限建立失败关闭倒计时", () => {
    expect(driverLivenessActionTimeoutMs(12)).toBe(12_000);
    expect(() => driverLivenessActionTimeoutMs(0)).toThrow(
      "DRIVER_LIVENESS_ACTION_TIMEOUT_INVALID",
    );
    expect(
      driverLivenessErrorPresentation("DRIVER_LIVENESS_ACTION_TIMEOUT"),
    ).toMatchObject({
      title: "动作已超时",
      description: expect.stringContaining("离线"),
    });
  });
});
