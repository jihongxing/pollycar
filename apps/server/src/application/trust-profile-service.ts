import type {
  AccountTrustProfile,
  FairnessMonitoringReport,
  SubmitTripRatingCommand,
  SyntheticAvatarAsset,
  TripRatingView,
} from "@pollycar/contracts";
import type { AuditLog } from "../ports/audit.js";
import type { Repository } from "../ports/storage.js";
import type { SyntheticTripRecord } from "./synthetic-trip-service.js";

export type TrustProfileRecord = Readonly<{
  accountId: string;
  avatarAsset?: SyntheticAvatarAsset;
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
        ...(record?.avatarState === "approved" && record.avatarAsset
          ? { publicUrl: assetUrls[record.avatarAsset] }
          : {}),
        ...(record?.avatarRejectionReason
          ? { rejectionReason: record.avatarRejectionReason }
          : {}),
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
