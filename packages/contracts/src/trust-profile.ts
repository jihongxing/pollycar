export type AvatarModerationState =
  | "default"
  | "pending"
  | "approved"
  | "rejected";

export type SyntheticAvatarAsset =
  | "avatar-city-blue"
  | "avatar-warm-gray"
  | "avatar-plum";

export type AccountTrustProfile = Readonly<{
  accountId: string;
  avatar: Readonly<{
    state: AvatarModerationState;
    source: "default" | "preset" | "custom";
    publicUrl?: string;
    rejectionReason?: "face_missing" | "multiple_people" | "unsafe_content";
    customUploadEnabled: true;
    realUploadEnabled: false;
    synthetic: true;
  }>;
  rating?: Readonly<{
    average: number;
    ratingCount: number;
  }>;
  synthetic: true;
}>;

export type SubmitAvatarCommand = Readonly<{
  asset: SyntheticAvatarAsset;
  idempotencyKey: string;
}>;

export type SubmitCustomAvatarCommand = Readonly<{
  fileName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  contentBase64: string;
  idempotencyKey: string;
}>;

export type FairnessMetricDimension = "legal_gender";

export type FairnessMetricRow = Readonly<{
  group: "female" | "male";
  profileViews: number;
  acceptedTrips: number;
  acceptanceRate: number;
  cancellationRate: number;
  harassmentReportRate: number;
}>;

export type FairnessMonitoringReport = Readonly<{
  dimension: FairnessMetricDimension;
  rows: readonly FairnessMetricRow[];
  alert: boolean;
  thresholdPercentagePoints: number;
  automatedDecisionEnabled: false;
  synthetic: true;
}>;

export interface TrustProfileClient {
  getProfile(): Promise<AccountTrustProfile>;
  submitAvatar(command: SubmitAvatarCommand): Promise<AccountTrustProfile>;
  submitCustomAvatar(command: SubmitCustomAvatarCommand): Promise<AccountTrustProfile>;
  getFairnessReport(): Promise<FairnessMonitoringReport>;
}
