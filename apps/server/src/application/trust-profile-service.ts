import type {
  AccountTrustProfile,
  FairnessMonitoringReport,
  SubmitCustomAvatarCommand,
  SubmitTripRatingCommand,
  SyntheticAvatarAsset,
  TripRatingView,
} from "@pollycar/contracts";
import type { AuditLog } from "../ports/audit.js";
import type { AvatarObjectStore } from "../ports/avatar-object-store.js";
import type { Repository } from "../ports/storage.js";
import type { SyntheticTripRecord } from "./synthetic-trip-service.js";

export type TrustProfileRecord = Readonly<{
  accountId: string;
  avatarAsset?: SyntheticAvatarAsset;
  avatarObjectKey?: string;
  avatarAccessToken?: string;
  avatarContentType?: "image/jpeg" | "image/png" | "image/webp";
  avatarState: "default" | "pending" | "approved" | "rejected";
  avatarRejectionReason?: "face_missing" | "multiple_people" | "unsafe_content";
  processedKeys: readonly string[];
}>;

export type TripRatingRecord = TripRatingView;

const assetUrls: Record<SyntheticAvatarAsset, string> = {
  "avatar-city-blue": "https://example.invalid/avatar-city-blue.png",
  "avatar-warm-gray": "https://example.invalid/avatar-warm-gray.png",
  "avatar-plum": "https://example.invalid/avatar-plum.png",
};

export class TrustProfileService {
  constructor(
    private readonly profiles: Repository<TrustProfileRecord>,
    private readonly ratings: Repository<TripRatingRecord>,
    private readonly trips: Repository<SyntheticTripRecord>,
    private readonly audit: AuditLog,
    private readonly avatarObjects: AvatarObjectStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getProfile(accountId: string): Promise<AccountTrustProfile> {
    return this.toView(accountId, (await this.profiles.get(accountId))?.value);
  }

  async submitAvatar(
    accountId: string,
    asset: SyntheticAvatarAsset,
    idempotencyKey: string,
    correlationId = idempotencyKey,
  ): Promise<AccountTrustProfile> {
    const current = await this.profiles.get(accountId);
    if (current?.value.processedKeys.includes(idempotencyKey)) {
      return this.toView(accountId, current.value);
    }
    const moderation = moderateAvatar(asset);
    const next: TrustProfileRecord = {
      accountId,
      avatarAsset: asset,
      avatarState: moderation.state,
      ...(moderation.reason ? { avatarRejectionReason: moderation.reason } : {}),
      processedKeys: [...(current?.value.processedKeys ?? []), idempotencyKey],
    };
    await this.profiles.put(accountId, next, current?.version ?? 0);
    if (current?.value.avatarObjectKey) {
      await this.avatarObjects.delete(current.value.avatarObjectKey);
    }
    await this.audit.append({
      id: crypto.randomUUID(),
      occurredAt: this.now().toISOString(),
      actorId: accountId,
      action: "trust_profile.avatar.moderated",
      subjectType: "trust_profile",
      subjectId: accountId,
      outcome: moderation.state === "approved" ? "succeeded" : "denied",
      reasonCode: moderation.reason ?? "AVATAR_APPROVED",
      correlationId,
      synthetic: true,
    });
    return this.toView(accountId, next);
  }

  async submitCustomAvatar(
    accountId: string,
    command: SubmitCustomAvatarCommand,
    correlationId = command.idempotencyKey,
  ): Promise<AccountTrustProfile> {
    const current = await this.profiles.get(accountId);
    if (current?.value.processedKeys.includes(command.idempotencyKey)) {
      return this.toView(accountId, current.value);
    }
    const bytes = decodeAvatar(command);
    validateAvatarImage(bytes, command.mimeType, command.byteSize);
    const objectKey = await this.avatarObjects.put({
      contentType: command.mimeType,
      bytes,
    });
    const next: TrustProfileRecord = {
      accountId,
      avatarObjectKey: objectKey,
      avatarAccessToken: crypto.randomUUID(),
      avatarContentType: command.mimeType,
      avatarState: "approved",
      processedKeys: [
        ...(current?.value.processedKeys ?? []),
        command.idempotencyKey,
      ],
    };
    try {
      await this.profiles.put(accountId, next, current?.version ?? 0);
    } catch (error) {
      await this.avatarObjects.delete(objectKey);
      throw error;
    }
    if (current?.value.avatarObjectKey && current.value.avatarObjectKey !== objectKey) {
      await this.avatarObjects.delete(current.value.avatarObjectKey);
    }
    await this.audit.append({
      id: crypto.randomUUID(),
      occurredAt: this.now().toISOString(),
      actorId: accountId,
      action: "trust_profile.avatar.uploaded",
      subjectType: "trust_profile",
      subjectId: accountId,
      outcome: "succeeded",
      reasonCode: "SANDBOX_AVATAR_TECHNICAL_VALIDATION_PASSED",
      correlationId,
      synthetic: true,
    });
    return this.toView(accountId, next);
  }

  async getAvatarObject(key: string, accessToken: string | null) {
    const profiles = await this.profiles.list();
    if (!profiles.some(({ value }) =>
      value.avatarState === "approved" &&
      value.avatarObjectKey === key &&
      value.avatarAccessToken === accessToken
    )) {
      return undefined;
    }
    return this.avatarObjects.get(key);
  }

  async submitRating(
    accountId: string,
    command: SubmitTripRatingCommand,
    correlationId = command.idempotencyKey,
  ): Promise<TripRatingView> {
    const trip = await this.trips.get(command.tripId);
    if (!trip || trip.value.state !== "completed") throw new Error("TRIP_RATING_NOT_ALLOWED");
    const subjectAccountId =
      trip.value.passengerAccountId === accountId
        ? trip.value.driverAccountId
        : trip.value.driverAccountId === accountId
          ? trip.value.passengerAccountId
          : undefined;
    if (!subjectAccountId) throw new Error("TRIP_FORBIDDEN");
    const key = `${command.tripId}:${accountId}`;
    const existing = await this.ratings.get(key);
    if (existing) return existing.value;
    const note = command.note?.trim();
    if (note && note.length > 200) throw new Error("VALIDATION_FAILED");
    const rating: TripRatingRecord = {
      ratingId: crypto.randomUUID(),
      tripId: command.tripId,
      raterAccountId: accountId,
      subjectAccountId,
      score: command.score,
      tags: [...new Set(command.tags ?? [])],
      ...(note ? { note } : {}),
      createdAt: this.now().toISOString(),
      synthetic: true,
    };
    await this.ratings.put(key, rating, 0);
    await this.audit.append({
      id: crypto.randomUUID(),
      occurredAt: rating.createdAt,
      actorId: accountId,
      action: "trip_rating.submitted",
      subjectType: "trip_rating",
      subjectId: rating.ratingId,
      outcome: "succeeded",
      reasonCode: rating.score <= 2 ? "LOW_SCORE_RECORDED_NO_AUTOMATIC_PENALTY" : "RATING_RECORDED",
      correlationId,
      synthetic: true,
    });
    return rating;
  }

  async getRating(accountId: string, tripId: string) {
    return (await this.ratings.get(`${tripId}:${accountId}`))?.value;
  }

  async getFairnessReport(): Promise<FairnessMonitoringReport> {
    const entries = await this.audit.query();
    const trips = await this.trips.list();
    const rows = (["female", "male"] as const).map((group) => {
      const groupedTrips = trips.filter(
        ({ value }) => (value.passengerProfile?.gender ?? "female") === group,
      );
      const viewedTripIds = new Set(
        entries
          .filter(
            (entry) =>
              entry.action === "trip_profile.passenger.pre_acceptance_view" &&
              groupedTrips.some(({ value }) => value.tripId === entry.subjectId),
          )
          .map((entry) => entry.subjectId),
      );
      const acceptedTrips = groupedTrips.filter(({ value }) => Boolean(value.driverAccountId)).length;
      const cancelledTrips = groupedTrips.filter(({ value }) => value.state === "cancelled").length;
      const harassmentReports = entries.filter(
        (entry) =>
          entry.subjectType === "safety_case" &&
          entry.action.includes("report") &&
          groupedTrips.some(({ value }) => value.tripId === entry.subjectId),
      ).length;
      const denominator = Math.max(groupedTrips.length, 1);
      return {
        group,
        profileViews: viewedTripIds.size,
        acceptedTrips,
        acceptanceRate: acceptedTrips / denominator,
        cancellationRate: cancelledTrips / denominator,
        harassmentReportRate: harassmentReports / denominator,
      };
    });
    const largestGap = Math.max(
      Math.abs(rows[0]!.acceptanceRate - rows[1]!.acceptanceRate),
      Math.abs(rows[0]!.cancellationRate - rows[1]!.cancellationRate),
      Math.abs(rows[0]!.harassmentReportRate - rows[1]!.harassmentReportRate),
    ) * 100;
    return {
      dimension: "legal_gender",
      rows,
      alert: largestGap > 10,
      thresholdPercentagePoints: 10,
      automatedDecisionEnabled: false,
      synthetic: true,
    };
  }

  private async toView(
    accountId: string,
    record?: TrustProfileRecord,
  ): Promise<AccountTrustProfile> {
    const ratings = (await this.ratings.list()).filter(
      (item) => item.value.subjectAccountId === accountId,
    );
    const average = ratings.length
      ? ratings.reduce((sum, item) => sum + item.value.score, 0) / ratings.length
      : undefined;
    return {
      accountId,
      avatar: {
        state: record?.avatarState ?? "default",
        source: record?.avatarObjectKey
          ? "custom"
          : record?.avatarAsset
            ? "preset"
            : "default",
        ...(record?.avatarState === "approved" && record.avatarAsset
          ? { publicUrl: assetUrls[record.avatarAsset] }
          : {}),
        ...(record?.avatarState === "approved" &&
          record.avatarObjectKey &&
          record.avatarAccessToken
          ? {
              publicUrl:
                `/v1/internal-sandbox/media/avatars/${encodeURIComponent(record.avatarObjectKey)}` +
                `?access=${encodeURIComponent(record.avatarAccessToken)}`,
            }
          : {}),
        ...(record?.avatarRejectionReason
          ? { rejectionReason: record.avatarRejectionReason }
          : {}),
        customUploadEnabled: true,
        realUploadEnabled: false,
        synthetic: true,
      },
      ...(average === undefined
        ? {}
        : { rating: { average, ratingCount: ratings.length } }),
      synthetic: true,
    };
  }
}

function moderateAvatar(asset: SyntheticAvatarAsset): {
  state: "approved" | "rejected";
  reason?: "unsafe_content";
} {
  if (asset === "avatar-plum") return { state: "rejected", reason: "unsafe_content" };
  return { state: "approved" };
}

const maximumAvatarBytes = 1_500_000;

function decodeAvatar(command: SubmitCustomAvatarCommand): Uint8Array {
  if (
    command.fileName.length < 1 ||
    command.fileName.length > 120 ||
    command.contentBase64.length < 1 ||
    command.contentBase64.length > Math.ceil(maximumAvatarBytes * 4 / 3) + 8 ||
    command.contentBase64.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      command.contentBase64,
    )
  ) {
    throw new Error("AVATAR_UPLOAD_INVALID");
  }
  const bytes = Buffer.from(command.contentBase64, "base64");
  if (bytes.length !== command.byteSize) throw new Error("AVATAR_UPLOAD_INVALID");
  return bytes;
}

function validateAvatarImage(
  bytes: Uint8Array,
  mimeType: SubmitCustomAvatarCommand["mimeType"],
  declaredSize: number,
) {
  if (declaredSize < 1 || declaredSize > maximumAvatarBytes) {
    throw new Error("AVATAR_FILE_TOO_LARGE");
  }
  const dimensions = imageDimensions(bytes, mimeType);
  if (!dimensions) throw new Error("AVATAR_IMAGE_INVALID");
  if (
    dimensions.width < 128 ||
    dimensions.height < 128 ||
    dimensions.width > 4096 ||
    dimensions.height > 4096
  ) {
    throw new Error("AVATAR_DIMENSIONS_INVALID");
  }
}

function imageDimensions(
  bytes: Uint8Array,
  mimeType: SubmitCustomAvatarCommand["mimeType"],
): Readonly<{ width: number; height: number }> | undefined {
  if (mimeType === "image/png") {
    if (
      bytes.length < 24 ||
      !matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ||
      String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR"
    ) return undefined;
    return {
      width: readUint32(bytes, 16),
      height: readUint32(bytes, 20),
    };
  }
  if (mimeType === "image/webp") {
    if (
      bytes.length < 25 ||
      !matches(bytes, [0x52, 0x49, 0x46, 0x46]) ||
      String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP"
    ) return undefined;
    const encoding = String.fromCharCode(...bytes.slice(12, 16));
    if (encoding === "VP8X" && bytes.length >= 30) {
      return {
        width: 1 + readUint24LittleEndian(bytes, 24),
        height: 1 + readUint24LittleEndian(bytes, 27),
      };
    }
    if (
      encoding === "VP8 " &&
      bytes.length >= 30 &&
      matchesAt(bytes, 23, [0x9d, 0x01, 0x2a])
    ) {
      return {
        width: readUint16LittleEndian(bytes, 26) & 0x3fff,
        height: readUint16LittleEndian(bytes, 28) & 0x3fff,
      };
    }
    if (encoding === "VP8L" && bytes[20] === 0x2f) {
      return {
        width: 1 + bytes[21]! + ((bytes[22]! & 0x3f) << 8),
        height:
          1 +
          (bytes[22]! >> 6) +
          (bytes[23]! << 2) +
          ((bytes[24]! & 0x0f) << 10),
      };
    }
    return undefined;
  }
  if (
    mimeType !== "image/jpeg" ||
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8
  ) return undefined;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;
    const marker = bytes[offset + 1]!;
    const length = (bytes[offset + 2]! << 8) + bytes[offset + 3]!;
    if (length < 2 || offset + length + 2 > bytes.length) return undefined;
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        height: (bytes[offset + 5]! << 8) + bytes[offset + 6]!,
        width: (bytes[offset + 7]! << 8) + bytes[offset + 8]!,
      };
    }
    offset += length + 2;
  }
  return undefined;
}

function matches(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function matchesAt(
  bytes: Uint8Array,
  offset: number,
  signature: readonly number[],
): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! * 0x1000000 +
    (bytes[offset + 1]! << 16) +
    (bytes[offset + 2]! << 8) +
    bytes[offset + 3]!
  );
}

function readUint16LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! + (bytes[offset + 1]! << 8);
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! + (bytes[offset + 1]! << 8) + (bytes[offset + 2]! << 16);
}
