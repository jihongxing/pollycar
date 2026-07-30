import type {
  AdminBusinessCapability,
  AdminNavigationDomain,
} from "@pollycar/contracts";

export const adminV2CanonicalShell = "ProductizedAdminShell" as const;

export const adminV2CanonicalShellModules = Object.freeze([
  "ProductizedAdminLayout",
  "AdminMasterDetailWorkspace",
  "AdminRiskConfirmationDialog",
  "VehicleReviewWorkspace",
  "FocusTrapDialog",
] as const);

export const adminV2CompatibilityShells = Object.freeze([
  "LegacyShell",
  "StageOneShell",
] as const);

export const adminV2RequiredViewports = Object.freeze([
  { id: "desktop-standard", width: 1280, height: 800 },
  { id: "desktop-wide", width: 1440, height: 900 },
] as const);

export const adminV2Domains = Object.freeze([
  { id: "workbench", label: "工作台", route: "/admin/workbench" },
  {
    id: "organization_accounts",
    label: "成员与权限",
    route: "/admin/organization-accounts",
  },
  {
    id: "operator_management",
    label: "运营公司",
    route: "/admin/operators",
  },
  { id: "driver_vehicle", label: "车主与车辆", route: "/admin/fleet" },
  { id: "trip_operations", label: "行程运营", route: "/admin/trips" },
  { id: "support_safety", label: "客服与安全", route: "/admin/cases" },
  {
    id: "finance_operations",
    label: "财务与对账",
    route: "/admin/finance",
  },
  { id: "data_reports", label: "数据与报表", route: "/admin/reports" },
  {
    id: "executive_dashboard",
    label: "高层驾驶舱",
    route: "/admin/executive",
  },
  { id: "audit_system", label: "审计与系统", route: "/admin/governance" },
] satisfies readonly Readonly<{
  id: AdminNavigationDomain;
  label: string;
  route: string;
}>[]);

export type AdminV2TaskMode =
  | "account_governance"
  | "operations"
  | "admission_review"
  | "support_safety"
  | "finance"
  | "governance_analysis"
  | "decision_management";

export const adminV2CapabilityTaskModes = Object.freeze({
  account_governance: ["membership_governance"],
  operations: [
    "operations_task",
    "operator_governance",
    "trip_operation",
  ],
  admission_review: ["fleet_operation", "fleet_review"],
  support_safety: [
    "support_case",
    "safety_investigation",
    "safety_restoration_review",
  ],
  finance: ["finance_operation", "finance_review"],
  governance_analysis: [
    "privacy_governance",
    "analytics_read",
    "audit_read",
    "technical_recovery",
  ],
  decision_management: ["executive_read"],
} satisfies Readonly<Record<AdminV2TaskMode, readonly AdminBusinessCapability[]>>);

export const adminV2MissingAcceptanceCapabilities = Object.freeze(
  [] satisfies readonly AdminBusinessCapability[],
);

export const adminV2DetailRoutePatterns = Object.freeze([
  "/admin/workbench/tasks/:taskId",
  "/admin/operators/:operatorId",
  "/admin/fleet/drivers/:driverId",
  "/admin/fleet/vehicles/:vehicleId",
  "/admin/trips/:tripId",
  "/admin/cases/:kind/:caseId",
  "/admin/finance/:kind/:resourceId",
  "/admin/reports/:reportId",
  "/admin/executive/:kind/:resourceId",
  "/admin/governance/:kind/:resourceId",
  "/admin/organization-accounts/:membershipId",
] as const);
