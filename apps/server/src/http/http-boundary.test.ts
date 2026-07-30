import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import {
  bindRequestBodyLimit,
  readJsonObject,
} from "./http-boundary.js";

describe("HTTP 安全边界", () => {
  it("解析受限大小内的 JSON 对象", async () => {
    const request = createRequest('{"value":"ok"}');
    await expect(readJsonObject(request, { maximumBytes: 64 })).resolves.toEqual({ value: "ok" });
  });

  it("根据 Content-Length 提前拒绝过大请求", async () => {
    const request = createRequest("{}", { "content-length": "1024" });
    await expect(readJsonObject(request, { maximumBytes: 64 })).rejects.toThrow("PAYLOAD_TOO_LARGE");
  });

  it("拒绝分块传输中超过限制的请求", async () => {
    const request = createRequest('{"value":"too-large"}');
    await expect(readJsonObject(request, { maximumBytes: 8 })).rejects.toThrow("PAYLOAD_TOO_LARGE");
  });

  it("拒绝数组和无效 JSON", async () => {
    await expect(readJsonObject(createRequest("[]"))).rejects.toThrow("VALIDATION_FAILED");
    await expect(readJsonObject(createRequest("{"))).rejects.toThrow("VALIDATION_FAILED");
  });

  it("使用 Server 为请求绑定的统一 Body Limit", async () => {
    const request = createRequest('{"value":"too-large"}');
    bindRequestBodyLimit(request, 8);
    await expect(readJsonObject(request)).rejects.toThrow(
      "PAYLOAD_TOO_LARGE",
    );
  });
});

function createRequest(
  body: string,
  headers: IncomingMessage["headers"] = {},
): IncomingMessage {
  const stream = Readable.from([Buffer.from(body)]) as IncomingMessage;
  stream.headers = headers;
  return stream;
}
