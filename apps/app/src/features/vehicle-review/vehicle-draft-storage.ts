import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from "../../infrastructure/browser-storage";

export type VehicleFormDraft = Readonly<{
  vehicleType: string;
  insuranceDate: string;
  maxPassengerCount: 1 | 2 | 3;
  preparedMaterials: readonly VehicleMaterialCode[];
  updatedAt: string;
}>;

export type VehicleMaterialCode =
  | "driver_license"
  | "vehicle_registration"
  | "insurance_proof";

const storageKey = "pollycar.vehicle-form.draft";
let nativeDraft: VehicleFormDraft | undefined;
const materialCodes: readonly VehicleMaterialCode[] = [
  "driver_license",
  "vehicle_registration",
  "insurance_proof",
];

function isMaterialCode(value: unknown): value is VehicleMaterialCode {
  return typeof value === "string" && materialCodes.includes(value as VehicleMaterialCode);
}

export function readVehicleFormDraft(): VehicleFormDraft | undefined {
  const value = readBrowserStorage(storageKey);
  if (!value) return nativeDraft;
  try {
    const parsed = JSON.parse(value) as Partial<VehicleFormDraft>;
    if (
      typeof parsed.vehicleType !== "string" ||
      typeof parsed.insuranceDate !== "string" ||
      ![1, 2, 3].includes(Number(parsed.maxPassengerCount ?? 1))
    ) {
      return undefined;
    }
    return {
      vehicleType: parsed.vehicleType,
      insuranceDate: parsed.insuranceDate,
      maxPassengerCount: (parsed.maxPassengerCount ?? 1) as 1 | 2 | 3,
      preparedMaterials: Array.isArray(parsed.preparedMaterials)
        ? parsed.preparedMaterials.filter(isMaterialCode)
        : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return undefined;
  }
}

export function saveVehicleFormDraft(
  draft: Readonly<{
    vehicleType: string;
    insuranceDate: string;
    maxPassengerCount: 1 | 2 | 3;
    preparedMaterials?: readonly VehicleMaterialCode[];
  }>,
): VehicleFormDraft {
  const stored = {
    ...draft,
    preparedMaterials: draft.preparedMaterials?.filter(isMaterialCode) ?? [],
    updatedAt: new Date().toISOString(),
  };
  nativeDraft = stored;
  writeBrowserStorage(storageKey, JSON.stringify(stored));
  return stored;
}

export function clearVehicleFormDraft(): void {
  nativeDraft = undefined;
  removeBrowserStorage(storageKey);
}
