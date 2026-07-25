import { join } from "node:path";
import { startInternalSandboxHttpServer } from "./internal-sandbox-server.js";

const configuredPort = process.env.POLLYCAR_SANDBOX_PORT;
const configuredOrigins = process.env.POLLYCAR_SANDBOX_ALLOWED_ORIGINS
  ?.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const configuredNow = process.env.POLLYCAR_SANDBOX_NOW;
const fixedNow = configuredNow ? new Date(configuredNow) : undefined;
if (fixedNow && Number.isNaN(fixedNow.getTime())) {
  throw new Error("POLLYCAR_SANDBOX_NOW 必须是有效的 ISO 8601 时间");
}
const multiOrganizationEnabled =
  process.env.POLLYCAR_SYNTHETIC_ADMIN_MULTI_ORGANIZATION === "true";
const authenticationEnabled =
  process.env.POLLYCAR_SYNTHETIC_ADMIN_AUTHENTICATION === "true";
const roleAccessMatrixEnabled =
  process.env.POLLYCAR_SYNTHETIC_ADMIN_ROLE_ACCESS_MATRIX === "true";
const operatorManagementEnabled =
  process.env.POLLYCAR_SYNTHETIC_ADMIN_OPERATOR_MANAGEMENT === "true";
const driverVehicleEnabled =
  process.env.POLLYCAR_SYNTHETIC_ADMIN_DRIVER_VEHICLE === "true";
const tripOperationsEnabled =
  process.env.POLLYCAR_SYNTHETIC_ADMIN_TRIP_OPERATIONS === "true";
const caseManagementEnabled =
  process.env.POLLYCAR_SYNTHETIC_ADMIN_CASE_MANAGEMENT === "true";
const financeOperationsEnabled =
  process.env.POLLYCAR_SYNTHETIC_ADMIN_FINANCE_OPERATIONS === "true";
const executiveDashboardEnabled =
  process.env.POLLYCAR_SYNTHETIC_ADMIN_EXECUTIVE_DASHBOARD === "true";
const auditSystemEnabled =
  process.env.POLLYCAR_SYNTHETIC_ADMIN_AUDIT_SYSTEM === "true";
const dataReportsEnabled =
  process.env.POLLYCAR_SYNTHETIC_ADMIN_DATA_REPORTS === "true";
const organizationAccountsEnabled =
  process.env.POLLYCAR_SYNTHETIC_ADMIN_ORGANIZATION_ACCOUNTS === "true";
const executiveStateDir =
  process.env.POLLYCAR_EXECUTIVE_STATE_DIR ??
  join(process.cwd(), ".codex-runtime", "admin-executive-dashboard");
const server = await startInternalSandboxHttpServer({
  ...(configuredPort ? { port: Number(configuredPort) } : {}),
  ...(fixedNow ? { now: () => new Date(fixedNow) } : {}),
  ...(configuredOrigins && configuredOrigins.length > 0
    ? { allowedOrigins: configuredOrigins }
    : {}),
  executiveStateDir,
  ...(multiOrganizationEnabled
    ? {
        featureGates: {
          syntheticAdminMultiOrganization: true,
          syntheticAdminAuthentication: authenticationEnabled,
          syntheticAdminRoleAccessMatrix: roleAccessMatrixEnabled,
          syntheticAdminOperatorManagement: operatorManagementEnabled,
          syntheticAdminDriverVehicle: driverVehicleEnabled,
          syntheticAdminTripOperations: tripOperationsEnabled,
          syntheticAdminCaseManagement: caseManagementEnabled,
          syntheticAdminFinanceOperations: financeOperationsEnabled,
          syntheticAdminExecutiveDashboard: executiveDashboardEnabled,
          syntheticAdminAuditSystem: auditSystemEnabled,
          syntheticAdminDataReports: dataReportsEnabled,
          syntheticAdminOrganizationAccounts: organizationAccountsEnabled,
        },
      }
    : {}),
});
console.log(`PollyCar 内部沙箱 Server 已启动：${server.url}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
}
