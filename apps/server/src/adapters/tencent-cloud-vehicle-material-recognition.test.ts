import { describe, expect, it, vi } from "vitest";
import {
  createTencentCloudHeaders,
  TencentCloudVehicleMaterialRecognitionProvider,
} from "./tencent-cloud-vehicle-material-recognition.js";

describe("腾讯云车辆材料 OCR 适配器", () => {
  it("按 TC3-HMAC-SHA256 生成服务端请求头", () => {
    const headers = createTencentCloudHeaders({
      action: "DriverLicenseOCR",
      endpoint: "https://ocr.tencentcloudapi.com",
      payload: "{\"ImageBase64\":\"AQID\"}",
      region: "ap-shanghai",
      secretId: "test-secret-id",
      secretKey: "test-secret-key",
      timestamp: 1_721_891_200,
    });

    expect(headers.Authorization).toContain("TC3-HMAC-SHA256 Credential=test-secret-id/");
    expect(headers["X-TC-Action"]).toBe("DriverLicenseOCR");
    expect(headers["X-TC-Version"]).toBe("2018-11-19");
    expect(headers["X-TC-Region"]).toBe("ap-shanghai");
  });

  it("驾驶证字段完整时只返回平台预审信号", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ "X-TC-Action": "DriverLicenseOCR" });
      return new Response(JSON.stringify({
        Response: {
          RequestId: "request-driver-1",
          Name: "测试用户",
          CardCode: "310000000000000000",
          Class: "C1",
          StartDate: "2020-01-01",
          EndDate: "2030-01-01",
          RecognizeWarnCode: [],
        },
      }), { status: 200 });
    });
    const provider = new TencentCloudVehicleMaterialRecognitionProvider({
      secretId: "test-secret-id",
      secretKey: "test-secret-key",
      fetcher: fetcher as typeof fetch,
      now: () => new Date("2026-07-23T00:00:00.000Z"),
    });

    await expect(provider.recognize({
      materialKind: "driver_license",
      mimeType: "image/jpeg",
      content: new Uint8Array([1, 2, 3]),
    })).resolves.toMatchObject({
      providerId: "tencent-cloud-ocr",
      providerRequestId: "request-driver-1",
      outcome: "precheck_passed",
      extractedFields: {
        CardCode: "310000000000000000",
        EndDate: "2030-01-01",
      },
    });
  });

  it("保险通用 OCR 始终进入平台人工复核", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ "X-TC-Action": "GeneralAccurateOCR" });
      return new Response(JSON.stringify({
        Response: {
          RequestId: "request-insurance-1",
          TextDetections: [
            { DetectedText: "机动车交通事故责任强制保险单" },
            { DetectedText: "保险期间至 2027-08-31" },
          ],
        },
      }), { status: 200 });
    });
    const provider = new TencentCloudVehicleMaterialRecognitionProvider({
      secretId: "test-secret-id",
      secretKey: "test-secret-key",
      fetcher: fetcher as typeof fetch,
    });

    await expect(provider.recognize({
      materialKind: "insurance_proof",
      mimeType: "image/png",
      content: new Uint8Array([1, 2, 3]),
    })).resolves.toMatchObject({
      providerRequestId: "request-insurance-1",
      outcome: "needs_manual_review",
      extractedFields: {
        recognizedText: expect.stringContaining("保险期间"),
      },
    });
  });

  it("供应商不可用时失败关闭", async () => {
    const provider = new TencentCloudVehicleMaterialRecognitionProvider({
      secretId: "test-secret-id",
      secretKey: "test-secret-key",
      fetcher: vi.fn(async () => {
        throw new TypeError("network unavailable");
      }) as typeof fetch,
    });

    await expect(provider.recognize({
      materialKind: "vehicle_registration",
      mimeType: "image/jpeg",
      content: new Uint8Array([1, 2, 3]),
    })).resolves.toMatchObject({
      outcome: "unknown",
      warningCodes: ["provider_unavailable"],
    });
  });
});
