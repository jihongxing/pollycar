export type PassengerCount = 1 | 2 | 3;

export const passengerCountOptions = Object.freeze([1, 2, 3] as const);

export function isPassengerCount(value: unknown): value is PassengerCount {
  return value === 1 || value === 2 || value === 3;
}
