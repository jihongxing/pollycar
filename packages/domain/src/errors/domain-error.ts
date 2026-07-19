export type DomainErrorCode =
  | "ELIGIBILITY_INVALID_TRANSITION"
  | "ELIGIBILITY_CONCURRENT_MODIFICATION"
  | "ELIGIBILITY_PAID_PATH_FROZEN"
  | "ELIGIBILITY_ACTIVATION_DAYS_EXCEEDED"
  | "QUOTA_24H_EXCEEDED"
  | "QUOTA_7D_EXCEEDED"
  | "QUOTA_30D_EXCEEDED"
  | "QUOTA_CONCURRENT_MODIFICATION"
  | "QUOTA_DUPLICATE_REQUEST";

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}
