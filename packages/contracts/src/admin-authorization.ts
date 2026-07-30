export type AdminAuthorizationLevel = "level_1" | "level_2" | "level_3";

export type AdminBusinessCapability =
  | "operations_task"
  | "operator_governance"
  | "fleet_operation"
  | "fleet_review"
  | "trip_operation"
  | "support_case"
  | "safety_investigation"
  | "safety_restoration_review"
  | "finance_operation"
  | "finance_review"
  | "privacy_governance"
  | "analytics_read"
  | "audit_read"
  | "technical_recovery"
  | "executive_read"
  | "membership_governance";
