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
import { resolveAdminPublicCapabilities } from "../infrastructure/admin-public-capabilities";

const adminPublicCapabilities = resolveAdminPublicCapabilities();

export function Shell({
  multiOrganizationEnabled = adminPublicCapabilities.multiOrganizationEnabled,
  operatorManagementEnabled = adminPublicCapabilities.operatorManagementEnabled,
  tripOperationsEnabled = adminPublicCapabilities.tripOperationsEnabled,
  caseManagementEnabled = adminPublicCapabilities.caseManagementEnabled,
  financeOperationsEnabled = adminPublicCapabilities.financeOperationsEnabled,
  executiveDashboardEnabled = adminPublicCapabilities.executiveDashboardEnabled,
  authenticationEnabled = adminPublicCapabilities.authenticationEnabled,
  roleAccessMatrixEnabled = adminPublicCapabilities.roleAccessMatrixEnabled,
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
