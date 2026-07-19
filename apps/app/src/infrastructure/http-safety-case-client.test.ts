import { describe, expect, it, vi } from "vitest";
import { HttpSafetyCaseClient } from "./http-safety-case-client";

describe("安全案件 HTTP 客户端", () => {
  it("只发送合成消息和结构化举报原因", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(dashboard), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new HttpSafetyCaseClient("http://127.0.0.1:4311", fetcher as typeof fetch);

    await client.sendMessage("synthetic-trip-1", "合成消息：请确认位置。");

    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string)).toEqual({
      body: "合成消息：请确认位置。",
    });
  });
});

const dashboard = {
  chat: { tripId: "synthetic-trip-1", state: "open", messages: [], synthetic: true },
  realChatEnabled: false,
  realEvidenceEnabled: false,
};
