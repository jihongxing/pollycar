import { describe, expect, it } from "vitest";

import { presentAppError } from "./error-messages";

describe("中文错误映射", () => {
  it("将机器错误码转换为用户可执行文案", () => {
    expect(presentAppError(new Error("STORAGE_CONCURRENT_MODIFICATION"))).toEqual({
      title: "状态已经变化",
      message: "其他操作已更新当前记录，请刷新后继续。",
      retryable: true,
    });
  });

  it("未知错误不暴露内部错误码", () => {
    const result = presentAppError(new Error("DATABASE_SECRET_FAILURE"));
    expect(result.message).not.toContain("DATABASE_SECRET_FAILURE");
    expect(result.title).toBe("操作未完成");
  });

  it("会话过期提示重新使用手机号登录", () => {
    expect(presentAppError(new Error("AUTHENTICATION_REQUIRED"))).toEqual({
      title: "登录已过期",
      message: "请重新使用手机号验证码登录。",
      retryable: true,
    });
  });
});
