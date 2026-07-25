import { describe, expect, it } from "vitest";
import type {
  VehicleMaterialRecognitionProvider,
  VehicleMaterialRecognitionSignal,
} from "../ports/vehicle-material-recognition.js";
import { VehicleMaterialPrecheckService } from "./vehicle-material-precheck-service.js";

describe("车辆材料平台预审", () => {
  it("驾驶证字段满足平台规则时进入车辆审核而非直接批准", async () => {
    const service = new VehicleMaterialPrecheckService(
      provider({
        providerId: "tencent-cloud-ocr",
        providerRequestId: "driver-request-1",
        materialKind: "driver_license",
        outcome: "precheck_passed",
        extractedFields: {
          Name: "测试用户",
          CardCode: "310000000000000000",
          Class: "C1",
          EndDate: "2030-01-01",
        },
        warningCodes: [],
      }),
      () => new Date("2026-07-23T00:00:00.000Z"),
    );

    const result = await service.precheck({
      materialKind: "driver_license",
      mimeType: "image/jpeg",
      content: new Uint8Array([1]),
    });

    expect(result.platformDisposition).toBe("ready_for_vehicle_review");
    expect(result.normalizedFields).not.toHaveProperty("Name");
    expect(result.normalizedFields).not.toHaveProperty("CardCode");
    expect(result.normalizedFields.licenseNumberFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("过期驾驶证必须进入人工复核且不能自动放行", async () => {
    const service = new VehicleMaterialPrecheckService(
      provider({
        providerId: "tencent-cloud-ocr",
        providerRequestId: "driver-request-expired",
        materialKind: "driver_license",
        outcome: "precheck_passed",
        extractedFields: {
          CardCode: "310000000000000000",
          EndDate: "2025-01-01",
        },
        warningCodes: [],
      }),
      () => new Date("2026-07-23T00:00:00.000Z"),
    );

    await expect(service.precheck({
      materialKind: "driver_license",
      mimeType: "image/jpeg",
      content: new Uint8Array([1]),
    })).resolves.toMatchObject({
      platformDisposition: "manual_review_required",
      reasons: ["driver_license_expired"],
    });
  });

  it("保险 OCR 只提取日期并始终要求平台人工复核", async () => {
    const service = new VehicleMaterialPrecheckService(
      provider({
        providerId: "tencent-cloud-ocr",
        providerRequestId: "insurance-request-1",
        materialKind: "insurance_proof",
        outcome: "needs_manual_review",
        extractedFields: {
          recognizedText: "保险期间自 2026年08月01日至 2027年08月31日",
        },
        warningCodes: [],
      }),
    );

    const result = await service.precheck({
      materialKind: "insurance_proof",
      mimeType: "image/png",
      content: new Uint8Array([1]),
    });

    expect(result).toMatchObject({
      platformDisposition: "manual_review_required",
      normalizedFields: { expiresOn: "2027-08-31" },
    });
    expect(JSON.stringify(result)).not.toContain("保险期间自");
  });
});

function provider(
  signal: VehicleMaterialRecognitionSignal,
): VehicleMaterialRecognitionProvider {
  return {
    recognize: async () => signal,
  };
}
