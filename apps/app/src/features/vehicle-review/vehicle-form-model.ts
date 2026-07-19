export type VehicleFormValues = Readonly<{
  vehicleType: string;
  insuranceDate: string;
  maxPassengerCount: 1 | 2 | 3;
}>;

export function normalizeVehicleType(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeInsuranceDate(value: string): string {
  const compact = value.trim().replace(/[./年月]/g, "-").replace(/日/g, "");
  const match = compact.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return value.trim();
  return `${match[1]}-${match[2]!.padStart(2, "0")}-${match[3]!.padStart(2, "0")}`;
}

export function validateVehicleType(value: string): string | undefined {
  const normalized = normalizeVehicleType(value);
  if (!normalized) return "请输入车辆类型。";
  if (normalized.length < 2) return "车辆类型至少需要 2 个字符。";
  if (normalized.length > 40) return "车辆类型不能超过 40 个字符。";
  return undefined;
}

export function validateInsuranceDate(
  value: string,
  today = new Date(),
): string | undefined {
  const normalized = normalizeInsuranceDate(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return "请输入有效日期，例如 2027-08-31。";
  }
  const [year = 0, month = 0, day = 0] = normalized.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return "日期不存在，请检查年、月和日。";
  }
  const startOfToday = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  ));
  if (parsed < startOfToday) return "保险有效期不能早于今天。";
  const latest = new Date(Date.UTC(
    today.getUTCFullYear() + 5,
    today.getUTCMonth(),
    today.getUTCDate(),
  ));
  if (parsed > latest) return "保险有效期不能超过未来 5 年。";
  return undefined;
}
