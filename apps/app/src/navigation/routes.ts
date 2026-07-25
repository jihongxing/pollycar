import type { Href } from "expo-router";

import type { AppScreen } from "../features/vehicle-review/screens";

export const appRoutes = Object.freeze({
  "adult-eligibility": "/adult-eligibility" as Href,
  "adult-eligibility-appeal": "/adult-eligibility-appeal" as Href,
  "ride-home": "/ride-home" as Href,
  "ride-search": "/ride-search" as Href,
  "ride-confirmation": "/ride-confirmation" as Href,
  "ride-matching": "/ride-matching" as Href,
  "ride-pickup": "/ride-pickup" as Href,
  "ride-cancellation": "/ride-cancellation" as Href,
  "ride-active": "/ride-active" as Href,
  "ride-completion": "/ride-completion" as Href,
  "ride-history": "/ride-history" as Href,
  "ride-detail": "/ride-detail" as Href,
  "driver-home": "/driver-home" as Href,
  "driver-orders": "/driver-orders" as Href,
  "driver-pickup": "/driver-pickup" as Href,
  "driver-waiting-pickup": "/driver-waiting-pickup" as Href,
  "driver-active": "/driver-active" as Href,
  "driver-completion": "/driver-completion" as Href,
  "driver-history": "/driver-history" as Href,
  "driver-order-detail": "/driver-order-detail" as Href,
  "driver-wallet": "/driver-wallet" as Href,
  "driver-bank-card": "/driver-bank-card" as Href,
  "driver-withdraw": "/driver-withdraw" as Href,
  "trip-chat": "/trip-chat" as Href,
  "message-center": "/message-center" as Href,
  "passenger-workbench": "/passenger-workbench" as Href,
  "owner-apply-intro": "/owner-apply-intro" as Href,
  "owner-profile": "/owner-profile" as Href,
  "vehicle-form": "/vehicle-form" as Href,
  "submission-review": "/submission-review" as Href,
  "review-pending": "/review-pending" as Href,
  "review-needs-material": "/review-needs-material" as Href,
  "review-approved": "/review-approved" as Href,
  "owner-workbench": "/owner-workbench" as Href,
  account: "/account" as Href,
  "account-profile": "/account-profile" as Href,
  "account-login": "/account-login" as Href,
  "legal-information": "/legal-information" as Href,
  "service-agreement": "/service-agreement" as Href,
  "privacy-policy": "/privacy-policy" as Href,
  "phone-auth-notice": "/phone-auth-notice" as Href,
  "identity-settings": "/identity-settings" as Href,
  "vehicle-settings": "/vehicle-settings" as Href,
  "eligibility-settings": "/eligibility-settings" as Href,
  "quota-settings": "/quota-settings" as Href,
  "theme-settings": "/theme-settings" as Href,
  "privacy-safety-settings": "/privacy-safety-settings" as Href,
  notifications: "/notifications" as Href,
  "notification-detail": "/notification-detail" as Href,
  "notification-settings": "/notification-settings" as Href,
  "help-feedback": "/help-feedback" as Href,
  "trip-create": "/trip-create" as Href,
  "trip-payment": "/trip-payment" as Href,
  "trip-matching": "/trip-matching" as Href,
  "trip-active": "/trip-active" as Href,
  "trip-result": "/trip-result" as Href,
  "trip-recovery": "/trip-recovery" as Href,
  "driver-offers": "/driver-offers" as Href,
  "driver-trip": "/driver-trip" as Href,
  "safety-chat": "/safety-chat" as Href,
  "safety-report": "/safety-report" as Href,
  "safety-frozen": "/safety-frozen" as Href,
  "safety-appeal": "/safety-appeal" as Href,
  "safety-result": "/safety-result" as Href,
} satisfies Record<AppScreen, Href>);

export function routeForScreen(screen: AppScreen): Href {
  return appRoutes[screen];
}

export function resolveScreenFromReview(
  current: AppScreen,
  reviewStatus:
    | "draft"
    | "under_review"
    | "needs_material"
    | "approved"
    | "suspended"
    | "appealing"
    | "revoked"
    | "expired",
): AppScreen {
  if (reviewStatus === "approved" && ["review-pending", "review-needs-material"].includes(current)) {
    return "review-approved";
  }
  if (reviewStatus === "needs_material" && current === "review-pending") {
    return "review-needs-material";
  }
  if (reviewStatus === "under_review" && current === "review-approved") {
    return "review-pending";
  }
  if (
    ["suspended", "appealing", "revoked", "expired"].includes(reviewStatus) &&
    ["review-pending", "review-needs-material", "review-approved"].includes(current)
  ) {
    return "passenger-workbench";
  }
  return current;
}
