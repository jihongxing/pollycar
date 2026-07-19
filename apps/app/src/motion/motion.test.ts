import { describe, expect, it } from "vitest";

import { resolveMotionProfile } from "./motion";

describe("App v2 动效配置", () => {
  it("标准模式保持克制的位移、缩放和统一时间", () => {
    expect(resolveMotionProfile(false)).toEqual({
      enterDurationMs: 220,
      feedbackDurationMs: 160,
      overlayDurationMs: 240,
      enterTranslateY: 8,
      pressedScale: 0.985,
    });
  });

  it("减少动态效果时取消非必要位移和缩放", () => {
    expect(resolveMotionProfile(true)).toEqual({
      enterDurationMs: 0,
      feedbackDurationMs: 0,
      overlayDurationMs: 0,
      enterTranslateY: 0,
      pressedScale: 1,
    });
  });
});
