import { createHash } from "node:crypto";
import type {
  VehicleMaterialKind,
  VehicleMaterialRecognitionInput,
  VehicleMaterialRecognitionProvider,
} from "../ports/vehicle-material-recognition.js";

export type VehicleMaterialPrecheckResult = Readonly<{
  materialKind: VehicleMaterialKind;
  providerId: "tencent-cloud-ocr";
  providerRequestId: string;
  platformDisposition: "ready_for_vehicle_review" | "manual_review_required";
  normalizedFields: Readonly<Record<string, string>>;
  reasons: readonly string[];
}>;

export class VehicleMaterialPrecheckService {
  public constructor(
    private readonly provider: VehicleMaterialRecognitionProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async precheck(
    input: VehicleMaterialRecognitionInput,
  ): Promise<VehicleMaterialPrecheckResult> {
    const signal = await this.provider.recognize(input);
    if (signal.outcome !== "precheck_passed") {
      return {
        materialKind: input.materialKind,
        providerId: signal.providerId,
        providerRequestId: signal.providerRequestId,
        platformDisposition: "manual_review_required",
        normalizedFields: sanitizeFields(input.materialKind, signal.extractedFields),
        reasons: signal.warningCodes.length > 0
          ? signal.warningCodes
          : ["provider_signal_requires_review"],
      };
    }
    const normalizedFields = sanitizeFields(input.materialKind, signal.extractedFields);
    const reasons = validatePlatformRules(input.materialKind, normalizedFields, this.now());
    return {
      materialKind: input.materialKind,
      providerId: signal.providerId,
      providerRequestId: signal.providerRequestId,
      platformDisposition:
        reasons.length === 0
          ? "ready_for_vehicle_review"
          : "manual_review_required",
      normalizedFields,
      reasons,
    };
  }
}

function sanitizeFields(
  materialKind: VehicleMaterialKind,
  fields: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  if (materialKind === "driver_license") {
    return compact({
      holderNameFingerprint: fingerprint(fields.Name),
      licenseNumberFingerprint: fingerprint(fields.CardCode),
      permittedClass: fields.Class,
      validFrom: normalizeDate(fields.StartDate),
      validUntil: normalizeDate(fields.EndDate),
    });
  }
  if (materialKind === "vehicle_registration") {
    return compact({
      ownerNameFingerprint: fingerprint(fields.Owner),
      plateNumberMasked: maskPlateNumber(fields.PlateNo),
      vinFingerprint: fingerprint(fields.Vin),
      vehicleType: fields.VehicleType,
      registeredOn: normalizeDate(fields.RegisterDate),
      inspectedUntil: normalizeDate(fields.SealDate),
    });
  }
  return compact({
    expiresOn: extractLatestDate(fields.recognizedText),
  });
}

function validatePlatformRules(
  materialKind: VehicleMaterialKind,
  fields: Readonly<Record<string, string>>,
  now: Date,
): readonly string[] {
  if (materialKind === "driver_license") {
    if (!fields.licenseNumberFingerprint) return ["driver_license_number_missing"];
    if (!fields.validUntil) return ["driver_license_expiration_missing"];
    if (isPast(fields.validUntil, now)) return ["driver_license_expired"];
    return [];
  }
  if (materialKind === "vehicle_registration") {
    if (!fields.vinFingerprint) return ["vehicle_vin_missing"];
    if (!fields.plateNumberMasked) return ["vehicle_plate_missing"];
    return [];
  }
  return ["insurance_policy_manual_review_required"];
}

function fingerprint(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return createHash("sha256").update(value.trim()).digest("hex");
}

function maskPlateNumber(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length <= 3) return "*".repeat(normalized.length);
  return `${normalized.slice(0, 2)}${"*".repeat(normalized.length - 3)}${normalized.slice(-1)}`;
}

function normalizeDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const compacted = value.trim().replace(/[./年月]/g, "-").replace(/日/g, "");
  const match = compacted.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  if (!match) return undefined;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function extractLatestDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const dates = [...value.matchAll(/(20\d{2})[年./-](\d{1,2})[月./-](\d{1,2})日?/g)]
    .map((match) =>
      `${match[1]}-${match[2]!.padStart(2, "0")}-${match[3]!.padStart(2, "0")}`)
    .sort();
  return dates.at(-1);
}

function isPast(value: string, now: Date): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  const today = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));
  return Number.isNaN(parsed.getTime()) || parsed < today;
}

function compact(
  values: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(values).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
    ),
  );
}
