import type { AdminPublicConfig } from "@pollycar/configuration/public";
import { resolveAdminPublicConfig } from "./public-config";

export type AdminPublicCapabilities = Readonly<{
  multiOrganizationEnabled: boolean;
  authenticationEnabled: boolean;
  roleAccessMatrixEnabled: boolean;
  operatorManagementEnabled: boolean;
  tripOperationsEnabled: boolean;
  caseManagementEnabled: boolean;
  financeOperationsEnabled: boolean;
  executiveDashboardEnabled: boolean;
}>;

export function resolveAdminPublicCapabilities(
  config: AdminPublicConfig = resolveAdminPublicConfig(),
): AdminPublicCapabilities {
  return Object.freeze({
    multiOrganizationEnabled: config.capabilities.multiOrganization,
    authenticationEnabled: config.capabilities.authentication,
    roleAccessMatrixEnabled: config.capabilities.roleAccessMatrix,
    operatorManagementEnabled: config.capabilities.operatorManagement,
    tripOperationsEnabled: config.capabilities.tripOperations,
    caseManagementEnabled: config.capabilities.caseManagement,
    financeOperationsEnabled: config.capabilities.financeOperations,
    executiveDashboardEnabled: config.capabilities.executiveDashboard,
  });
}
