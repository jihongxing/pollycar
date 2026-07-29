import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createAdminToken(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function digestAdminValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safelyCompareAdminCredentials(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
