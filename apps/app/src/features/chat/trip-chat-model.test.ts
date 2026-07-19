import { describe, expect, it } from "vitest";

import {
  appendSyntheticMessage,
  createSyntheticTripChat,
  shouldShowTripEndedNotice,
  tripEndedNoticeWindowMs,
} from "./trip-chat-model";

describe("trip-chat-model", () => {
  it("仅在开放会话追加合成消息", () => {
    const chat = createSyntheticTripChat("trip-1");
    expect(appendSyntheticMessage(chat, "  我到了  ").messages.at(-1)?.text).toBe("我到了");
    expect(appendSyntheticMessage({ ...chat, state: "frozen" }, "测试").messages).toHaveLength(1);
  });

  it("仅在行程结束后二十四小时内向乘车人显示结束提示", () => {
    const completedAt = "2026-07-17T08:00:00.000Z";
    const completedAtMs = new Date(completedAt).getTime();
    const baseInput = {
      activeIdentity: "passenger" as const,
      tripState: "completed",
      chatState: "open",
      completedAt,
    };

    expect(shouldShowTripEndedNotice({ ...baseInput, nowMs: completedAtMs })).toBe(true);
    expect(
      shouldShowTripEndedNotice({
        ...baseInput,
        nowMs: completedAtMs + tripEndedNoticeWindowMs - 1,
      }),
    ).toBe(true);
    expect(
      shouldShowTripEndedNotice({
        ...baseInput,
        nowMs: completedAtMs + tripEndedNoticeWindowMs,
      }),
    ).toBe(false);
    expect(
      shouldShowTripEndedNotice({
        ...baseInput,
        activeIdentity: "owner",
        nowMs: completedAtMs,
      }),
    ).toBe(false);
    expect(
      shouldShowTripEndedNotice({
        ...baseInput,
        chatState: "closed",
        nowMs: completedAtMs,
      }),
    ).toBe(false);
  });
});
