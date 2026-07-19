export type VehicleFormDraft = Readonly<{
  vehicleType: string;
  insuranceDate: string;
  maxPassengerCount: 1 | 2 | 3;
  updatedAt: string;
}>;

const storageKey = "pollycar.vehicle-form.draft";
let nativeDraft: VehicleFormDraft | undefined;

export function readVehicleFormDraft(): VehicleFormDraft | undefined {
  if (typeof window === "undefined") return nativeDraft;
  const value = window.localStorage.getItem(storageKey);
  if (!value) return undefined;
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
  }>,
): VehicleFormDraft {
  const stored = { ...draft, updatedAt: new Date().toISOString() };
  nativeDraft = stored;
  if (typeof window !== "undefined") window.localStorage.setItem(storageKey, JSON.stringify(stored));
  return stored;
}

export function clearVehicleFormDraft(): void {
  nativeDraft = undefined;
  if (typeof window !== "undefined") window.localStorage.removeItem(storageKey);
}
