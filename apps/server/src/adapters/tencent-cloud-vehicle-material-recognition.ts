import { createHash, createHmac } from "node:crypto";
import type {
  VehicleMaterialKind,
  VehicleMaterialRecognitionInput,
  VehicleMaterialRecognitionProvider,
  VehicleMaterialRecognitionSignal,
} from "../ports/vehicle-material-recognition.js";

type TencentCloudOcrConfig = Readonly<{
  secretId: string;
  secretKey: string;
  region?: string;
  endpoint?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
}>;

type TencentCloudResponse = Readonly<{
  Response?: Readonly<Record<string, unknown>> & {
    RequestId?: string;
    Error?: Readonly<{ Code?: string; Message?: string }>;
  };
}>;

const service = "ocr";
const version = "2018-11-19";

export class TencentCloudVehicleMaterialRecognitionProvider
implements VehicleMaterialRecognitionProvider {
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;
  private readonly now: () => Date;

  public constructor(private readonly config: TencentCloudOcrConfig) {
    if (!config.secretId || !config.secretKey) {
      throw new Error("TENCENT_CLOUD_OCR_CREDENTIALS_REQUIRED");
    }
    this.endpoint = config.endpoint ?? "https://ocr.tencentcloudapi.com";
    this.fetcher = config.fetcher ?? globalThis.fetch.bind(globalThis);
    this.now = config.now ?? (() => new Date());
  }

  public async recognize(
    input: VehicleMaterialRecognitionInput,
  ): Promise<VehicleMaterialRecognitionSignal> {
    validateInput(input);
    const action = actionFor(input.materialKind);
    const payload = JSON.stringify({
      ImageBase64: Buffer.from(input.content).toString("base64"),
    });
    const timestamp = Math.floor(this.now().getTime() / 1000);
    const headers = createTencentCloudHeaders({
      action,
      endpoint: this.endpoint,
      payload,
      secretId: this.config.secretId,
      secretKey: this.config.secretKey,
      timestamp,
      ...(this.config.region ? { region: this.config.region } : {}),
    });
    let response: Response;
    try {
      response = await this.fetcher(this.endpoint, {
        method: "POST",
        headers,
        body: payload,
      });
    } catch {
      return unknownSignal(input.materialKind, "provider_unavailable");
    }
    if (!response.ok) {
      return unknownSignal(input.materialKind, `http_${response.status}`);
    }
    const body = await response.json() as TencentCloudResponse;
    const providerResponse = body.Response;
    const providerRequestId = providerResponse?.RequestId;
    if (!providerResponse || !providerRequestId) {
      return unknownSignal(input.materialKind, "missing_request_id");
    }
    if (providerResponse.Error?.Code) {
      return {
        providerId: "tencent-cloud-ocr",
        providerRequestId,
        materialKind: input.materialKind,
        outcome: providerResponse.Error.Code.includes("Image")
          ? "failed"
          : "unknown",
        extractedFields: {},
        warningCodes: [providerResponse.Error.Code],
      };
    }
    return mapProviderResponse(input.materialKind, {
      ...providerResponse,
      RequestId: providerRequestId,
    });
  }
}

function validateInput(input: VehicleMaterialRecognitionInput): void {
  const maximumBytes = input.materialKind === "vehicle_registration"
    ? 7 * 1024 * 1024
    : 10 * 1024 * 1024;
  if (input.content.byteLength === 0 || input.content.byteLength > maximumBytes) {
    throw new Error("VEHICLE_MATERIAL_FILE_SIZE_INVALID");
  }
}

function actionFor(materialKind: VehicleMaterialKind): string {
  if (materialKind === "driver_license") return "DriverLicenseOCR";
  if (materialKind === "vehicle_registration") return "VehicleLicenseOCR";
  return "GeneralAccurateOCR";
}

function mapProviderResponse(
  materialKind: VehicleMaterialKind,
  response: Readonly<Record<string, unknown>> & { RequestId: string },
): VehicleMaterialRecognitionSignal {
  const extractedFields = materialKind === "driver_license"
    ? pickStrings(response, [
      "Name",
      "CardCode",
      "Class",
      "StartDate",
      "EndDate",
    ])
    : materialKind === "vehicle_registration"
      ? pickStrings(response, [
        "PlateNo",
        "Owner",
        "VehicleType",
        "Vin",
        "RegisterDate",
        "SealDate",
      ])
      : extractInsuranceText(response);
  const warningCodes = readStringArray(response.RecognizeWarnCode);
  const hasRequiredFields = materialKind === "driver_license"
    ? Boolean(extractedFields.CardCode && extractedFields.EndDate)
    : materialKind === "vehicle_registration"
      ? Boolean(extractedFields.PlateNo && extractedFields.Vin)
      : false;
  return {
    providerId: "tencent-cloud-ocr",
    providerRequestId: response.RequestId,
    materialKind,
    outcome:
      warningCodes.length > 0 || materialKind === "insurance_proof"
        ? "needs_manual_review"
        : hasRequiredFields
          ? "precheck_passed"
          : "needs_manual_review",
    extractedFields,
    warningCodes,
  };
}

function pickStrings(
  source: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    keys.flatMap((key) => typeof source[key] === "string" && source[key]
      ? [[key, source[key]] as const]
      : []),
  );
}

function extractInsuranceText(
  source: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string>> {
  const detections = Array.isArray(source.TextDetections)
    ? source.TextDetections
    : [];
  const text = detections
    .flatMap((item) =>
      item && typeof item === "object" && typeof (item as { DetectedText?: unknown }).DetectedText === "string"
        ? [(item as { DetectedText: string }).DetectedText]
        : [])
    .join("\n");
  return text ? { recognizedText: text } : {};
}

function readStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function unknownSignal(
  materialKind: VehicleMaterialKind,
  warningCode: string,
): VehicleMaterialRecognitionSignal {
  return {
    providerId: "tencent-cloud-ocr",
    providerRequestId: "unavailable",
    materialKind,
    outcome: "unknown",
    extractedFields: {},
    warningCodes: [warningCode],
  };
}

export function createTencentCloudHeaders(input: Readonly<{
  action: string;
  endpoint: string;
  payload: string;
  region?: string;
  secretId: string;
  secretKey: string;
  timestamp: number;
}>): Readonly<Record<string, string>> {
  const host = new URL(input.endpoint).host;
  const date = new Date(input.timestamp * 1000).toISOString().slice(0, 10);
  const contentType = "application/json; charset=utf-8";
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-tc-action:${input.action.toLowerCase()}`,
    "",
  ].join("\n");
  const signedHeaders = "content-type;host;x-tc-action";
  const hashedPayload = sha256(input.payload);
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join("\n");
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    input.timestamp,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const secretDate = hmac(`TC3${input.secretKey}`, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = createHmac("sha256", secretSigning)
    .update(stringToSign)
    .digest("hex");
  return {
    Authorization:
      `TC3-HMAC-SHA256 Credential=${input.secretId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "Content-Type": contentType,
    Host: host,
    "X-TC-Action": input.action,
    "X-TC-Timestamp": String(input.timestamp),
    "X-TC-Version": version,
    ...(input.region ? { "X-TC-Region": input.region } : {}),
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}
