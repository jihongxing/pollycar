import type {
  AdminAccessClient,
  AdminOperatorManagementClient,
  AdminTripCaseManagementClient,
  AdminFinanceOperationsClient,
  AdminExecutiveDashboardClient,
  AdminProductizationClient,
} from "@pollycar/contracts";
import { LegacyShell } from "./legacy-shell";
import { StageOneShell } from "../features/admin-stage-one/stage-one-shell";
import { ProductizedAdminShell } from "../features/admin-productization/productized-admin-shell";

export function Shell({
  multiOrganizationEnabled = import.meta.env
    .VITE_SYNTHETIC_ADMIN_MULTI_ORGANIZATION === "true",
  operatorManagementEnabled = import.meta.env
    .VITE_SYNTHETIC_ADMIN_OPERATOR_MANAGEMENT === "true",
  tripOperationsEnabled = import.meta.env
    .VITE_SYNTHETIC_ADMIN_TRIP_OPERATIONS === "true",
  caseManagementEnabled = import.meta.env
    .VITE_SYNTHETIC_ADMIN_CASE_MANAGEMENT === "true",
  financeOperationsEnabled = import.meta.env
    .VITE_SYNTHETIC_ADMIN_FINANCE_OPERATIONS === "true",
  executiveDashboardEnabled = import.meta.env
    .VITE_SYNTHETIC_ADMIN_EXECUTIVE_DASHBOARD === "true",
  authenticationEnabled = import.meta.env
    .VITE_SYNTHETIC_ADMIN_AUTHENTICATION === "true",
  roleAccessMatrixEnabled = import.meta.env
    .VITE_SYNTHETIC_ADMIN_ROLE_ACCESS_MATRIX === "true",
  accessClient,
  operatorManagementClient,
  tripCaseManagementClient,
  financeOperationsClient,
  executiveDashboardClient,
  productizationClient,
}: Readonly<{
  multiOrganizationEnabled?: boolean;
  operatorManagementEnabled?: boolean;
  tripOperationsEnabled?: boolean;
  caseManagementEnabled?: boolean;
  financeOperationsEnabled?: boolean;
  executiveDashboardEnabled?: boolean;
  authenticationEnabled?: boolean;
  roleAccessMatrixEnabled?: boolean;
  accessClient?: AdminAccessClient;
  operatorManagementClient?: AdminOperatorManagementClient;
  tripCaseManagementClient?: AdminTripCaseManagementClient;
  financeOperationsClient?: AdminFinanceOperationsClient;
  executiveDashboardClient?: AdminExecutiveDashboardClient;
  productizationClient?: AdminProductizationClient;
}>) {
  if (!multiOrganizationEnabled) return <LegacyShell />;
  if (authenticationEnabled && roleAccessMatrixEnabled) {
    return <ProductizedAdminShell {...(productizationClient ? { client: productizationClient } : {})} />;
  }
  return (
    <StageOneShell
      operatorManagementEnabled={operatorManagementEnabled}
      tripOperationsEnabled={tripOperationsEnabled}
      caseManagementEnabled={caseManagementEnabled}
      financeOperationsEnabled={financeOperationsEnabled}
      executiveDashboardEnabled={resolveExecutiveDashboardEnabled({
        multiOrganizationEnabled,
        operatorManagementEnabled,
        tripOperationsEnabled,
        caseManagementEnabled,
        financeOperationsEnabled,
        executiveDashboardEnabled,
      })}
      {...(accessClient ? { client: accessClient } : {})}
      {...(operatorManagementClient ? { operatorManagementClient } : {})}
      {...(tripCaseManagementClient ? { tripCaseManagementClient } : {})}
      {...(financeOperationsClient ? { financeOperationsClient } : {})}
      {...(executiveDashboardClient ? { executiveDashboardClient } : {})}
    />
  );
}

export function resolveExecutiveDashboardEnabled(
  gates: Readonly<{
    multiOrganizationEnabled: boolean;
    operatorManagementEnabled: boolean;
    tripOperationsEnabled: boolean;
    caseManagementEnabled: boolean;
    financeOperationsEnabled: boolean;
    executiveDashboardEnabled: boolean;
  }>,
): boolean {
  return (
    gates.multiOrganizationEnabled &&
    gates.operatorManagementEnabled &&
    gates.tripOperationsEnabled &&
    gates.caseManagementEnabled &&
    gates.financeOperationsEnabled &&
    gates.executiveDashboardEnabled
  );
}
