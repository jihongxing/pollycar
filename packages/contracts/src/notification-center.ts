export type SyntheticNotificationDomain = "review" | "trip" | "safety" | "eligibility";

export type SyntheticNotificationPriority = "urgent" | "action" | "information";

export type SyntheticNotificationTarget =
  | "vehicle-settings"
  | "review-pending"
  | "review-needs-material"
  | "review-approved"
  | "eligibility-settings"
  | "trip-payment"
  | "trip-matching"
  | "trip-active"
  | "trip-result"
  | "driver-offers"
  | "driver-trip"
  | "safety-frozen"
  | "safety-result";

export type SyntheticNotificationItem = Readonly<{
  notificationId: string;
  domain: SyntheticNotificationDomain;
  priority: SyntheticNotificationPriority;
  title: string;
  body: string;
  requiresAction: boolean;
  target: SyntheticNotificationTarget;
  synthetic: true;
}>;

export type SyntheticNotificationCenter = Readonly<{
  pendingTaskCount: number;
  items: readonly SyntheticNotificationItem[];
  realPushEnabled: false;
  synthetic: true;
}>;
