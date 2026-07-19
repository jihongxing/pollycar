import type { DomainError } from "../errors/domain-error.js";
import type { EligibilityAggregate, EligibilityCommand, EligibilityContext, EligibilityState } from "./model.js";

export interface EligibilityDecision {
  readonly ok: true;
  readonly next: EligibilityAggregate;
  readonly eventType: string;
}

export interface EligibilityRejection {
  readonly ok: false;
  readonly error: DomainError;
}

type Transition = {
  readonly from: EligibilityState;
  readonly command: EligibilityCommand["type"];
  readonly to: EligibilityState;
  readonly eventType: string;
};

const transitions: readonly Transition[] = [
  { from: "not_applied", command: "submit_application", to: "under_review", eventType: "flex_eligibility_application_submitted" },
  { from: "under_review", command: "approve_application", to: "awaiting_confirmation", eventType: "flex_eligibility_application_approved" },
  { from: "under_review", command: "reject_application", to: "rejected", eventType: "flex_eligibility_application_rejected" },
  { from: "awaiting_confirmation", command: "confirm_free_trial", to: "pending_activation", eventType: "flex_eligibility_terms_accepted" },
  { from: "pending_activation", command: "activate", to: "active", eventType: "flex_eligibility_activated" },
  { from: "active", command: "suspend", to: "suspended", eventType: "flex_eligibility_suspended" },
  { from: "suspended", command: "request_restoration", to: "pending_restoration", eventType: "flex_eligibility_restoration_requested" },
  { from: "pending_restoration", command: "restore", to: "active", eventType: "flex_eligibility_restored" },
  { from: "active", command: "revoke", to: "revoked", eventType: "flex_eligibility_revoked" },
  { from: "suspended", command: "revoke", to: "revoked", eventType: "flex_eligibility_revoked" },
  { from: "rejected", command: "submit_appeal", to: "appealing", eventType: "flex_eligibility_appeal_submitted" },
  { from: "suspended", command: "submit_appeal", to: "appealing", eventType: "flex_eligibility_appeal_submitted" },
  { from: "revoked", command: "submit_appeal", to: "appealing", eventType: "flex_eligibility_appeal_submitted" },
  { from: "active", command: "expire", to: "expired", eventType: "flex_eligibility_expired" },
  { from: "suspended", command: "expire", to: "expired", eventType: "flex_eligibility_expired" },
  { from: "pending_restoration", command: "expire", to: "expired", eventType: "flex_eligibility_expired" },
];

export function decideEligibilityTransition(
  aggregate: EligibilityAggregate,
  command: EligibilityCommand,
  context: EligibilityContext,
): EligibilityDecision | EligibilityRejection {
  if (aggregate.version !== context.expectedVersion) {
    return { ok: false, error: { code: "ELIGIBILITY_CONCURRENT_MODIFICATION", retryable: true } };
  }

  if (command.type === "confirm_paid_trial") {
    return { ok: false, error: { code: "ELIGIBILITY_PAID_PATH_FROZEN", retryable: false } };
  }

  if (command.type === "activate" && context.activationDaysInLookback >= 60) {
    return { ok: false, error: { code: "ELIGIBILITY_ACTIVATION_DAYS_EXCEEDED", retryable: false } };
  }

  const transition = transitions.find((item) => item.from === aggregate.state && item.command === command.type);
  if (!transition) {
    return {
      ok: false,
      error: {
        code: "ELIGIBILITY_INVALID_TRANSITION",
        retryable: false,
        details: { state: aggregate.state, command: command.type },
      },
    };
  }

  return {
    ok: true,
    next: {
      ...aggregate,
      state: transition.to,
      version: aggregate.version + 1,
      ...(command.type === "activate" ? { cycleEndsAt: command.cycleEndsAt } : {}),
    },
    eventType: transition.eventType,
  };
}
