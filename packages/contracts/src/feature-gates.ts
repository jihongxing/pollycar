export interface FeatureGates {
  readonly productionEnabled: boolean;
  readonly syntheticAdminMultiOrganization: boolean;
  readonly syntheticAdminAuthentication: boolean;
  readonly syntheticAdminRoleAccessMatrix: boolean;
  readonly syntheticAdminOperatorManagement: boolean;
  readonly syntheticAdminDriverVehicle: boolean;
  readonly syntheticAdminTripOperations: boolean;
  readonly syntheticAdminCaseManagement: boolean;
  readonly syntheticAdminFinanceOperations: boolean;
  readonly syntheticAdminExecutiveDashboard: boolean;
  readonly syntheticAdminAuditSystem: boolean;
  readonly syntheticAdminDataReports: boolean;
  readonly syntheticAdminOrganizationAccounts: boolean;
  readonly realAdminOrganizationAccounts: boolean;
  readonly realAdminFinanceOperations: boolean;
  readonly productionAdminEnabled: boolean;
  readonly syntheticFinancialLedger: boolean;
  readonly syntheticFinancialReconciliation: boolean;
  readonly syntheticOperatorFunds: boolean;
  readonly realPayment: boolean;
  readonly realSettlement: boolean;
  readonly realWithdrawal: boolean;
  readonly driverEarlySettlementEnabled: boolean;
  readonly realOperatorOnboarding: boolean;
  readonly paidFlexTrial: boolean;
  readonly realUserInvitation: boolean;
  readonly shanghaiPilot: boolean;
  readonly realDataIngestion: boolean;
  readonly realIdentityVerification: boolean;
  readonly realBiometricVerification: boolean;
  readonly externalIdentityProvider: boolean;
  readonly realSmsDelivery: boolean;
  readonly realPhoneData: boolean;
  readonly productionAuthentication: boolean;
  readonly realMap: boolean;
  readonly externalMapProvider: boolean;
  readonly realDeviceLocation: boolean;
  readonly backgroundLocation: boolean;
  readonly realVehicleLocationStream: boolean;
  readonly amapSdk: boolean;
  readonly amapWebService: boolean;
  readonly internalSandbox: boolean;
}

export type CapabilityApprovalRole =
  | "production_decision_owner"
  | "security_owner"
  | "privacy_owner"
  | "identity_compliance_owner"
  | "map_vendor_owner"
  | "operations_owner"
  | "finance_owner"
  | "legal_owner";

export interface CapabilityLifecycleState {
  readonly implemented: boolean;
  readonly approved: boolean;
  readonly configured: boolean;
  readonly enabled: boolean;
}

export interface CapabilityApprovalEvidence {
  readonly reference: string;
  readonly approvedByRoles: readonly CapabilityApprovalRole[];
  readonly approvedOn: string;
  readonly environment: "production";
  readonly artifactReference: string;
  readonly expiresOn?: string;
}

export const defaultFeatureGates: FeatureGates = Object.freeze({
  productionEnabled: false,
  syntheticAdminMultiOrganization: false,
  syntheticAdminAuthentication: false,
  syntheticAdminRoleAccessMatrix: false,
  syntheticAdminOperatorManagement: false,
  syntheticAdminDriverVehicle: false,
  syntheticAdminTripOperations: false,
  syntheticAdminCaseManagement: false,
  syntheticAdminFinanceOperations: false,
  syntheticAdminExecutiveDashboard: false,
  syntheticAdminAuditSystem: false,
  syntheticAdminDataReports: false,
  syntheticAdminOrganizationAccounts: false,
  realAdminOrganizationAccounts: false,
  realAdminFinanceOperations: false,
  productionAdminEnabled: false,
  syntheticFinancialLedger: false,
  syntheticFinancialReconciliation: false,
  syntheticOperatorFunds: false,
  realPayment: false,
  realSettlement: false,
  realWithdrawal: false,
  driverEarlySettlementEnabled: false,
  realOperatorOnboarding: false,
  paidFlexTrial: false,
  realUserInvitation: false,
  shanghaiPilot: false,
  realDataIngestion: false,
  realIdentityVerification: false,
  realBiometricVerification: false,
  externalIdentityProvider: false,
  realSmsDelivery: false,
  realPhoneData: false,
  productionAuthentication: false,
  realMap: false,
  externalMapProvider: false,
  realDeviceLocation: false,
  backgroundLocation: false,
  realVehicleLocationStream: false,
  amapSdk: false,
  amapWebService: false,
  internalSandbox: true,
});

export const capabilityGateNames = Object.freeze(
  Object.keys(defaultFeatureGates) as readonly (keyof FeatureGates)[],
);

const internallyImplementedCapabilities = new Set<keyof FeatureGates>([
  "productionEnabled",
  "syntheticAdminMultiOrganization",
  "syntheticAdminAuthentication",
  "syntheticAdminRoleAccessMatrix",
  "syntheticAdminOperatorManagement",
  "syntheticAdminDriverVehicle",
  "syntheticAdminTripOperations",
  "syntheticAdminCaseManagement",
  "syntheticAdminFinanceOperations",
  "syntheticAdminExecutiveDashboard",
  "syntheticAdminAuditSystem",
  "syntheticAdminDataReports",
  "syntheticAdminOrganizationAccounts",
  "syntheticFinancialLedger",
  "syntheticFinancialReconciliation",
  "syntheticOperatorFunds",
  "externalMapProvider",
  "realMap",
  "realDeviceLocation",
  "amapSdk",
  "amapWebService",
  "internalSandbox",
]);

export const defaultCapabilityLifecycleStates = Object.freeze(
  Object.fromEntries(
    capabilityGateNames.map((name) => [
      name,
      Object.freeze({
        implemented: internallyImplementedCapabilities.has(name),
        approved: name === "internalSandbox",
        configured: name === "internalSandbox",
        enabled: name === "internalSandbox",
      }),
    ]),
  ),
) as Readonly<Record<keyof FeatureGates, CapabilityLifecycleState>>;

export function isCapabilityLifecycleReady(state: CapabilityLifecycleState): boolean {
  return state.implemented && state.approved && state.configured && state.enabled;
}

export function resolveFeatureGates(overrides: Partial<FeatureGates> = {}): FeatureGates {
  const gates = { ...defaultFeatureGates, ...overrides };
  const syntheticAdminMultiOrganization =
    gates.syntheticAdminMultiOrganization && gates.internalSandbox;
  const syntheticAdminAuthentication =
    gates.syntheticAdminAuthentication &&
    syntheticAdminMultiOrganization &&
    gates.internalSandbox;
  const syntheticAdminRoleAccessMatrix =
    gates.syntheticAdminRoleAccessMatrix &&
    syntheticAdminAuthentication &&
    syntheticAdminMultiOrganization &&
    gates.internalSandbox;
  const syntheticAdminOperatorManagement =
    gates.syntheticAdminOperatorManagement &&
    syntheticAdminMultiOrganization &&
    gates.internalSandbox;
  const syntheticAdminDriverVehicle =
    gates.syntheticAdminDriverVehicle &&
    syntheticAdminRoleAccessMatrix &&
    syntheticAdminOperatorManagement &&
    gates.internalSandbox;
  const syntheticAdminTripOperations =
    gates.syntheticAdminTripOperations &&
    syntheticAdminMultiOrganization &&
    gates.internalSandbox;
  const syntheticAdminCaseManagement =
    gates.syntheticAdminCaseManagement &&
    syntheticAdminMultiOrganization &&
    gates.internalSandbox;
  const syntheticFinancialLedger =
    gates.syntheticFinancialLedger && gates.internalSandbox;
  const syntheticFinancialReconciliation =
    gates.syntheticFinancialReconciliation &&
    syntheticFinancialLedger &&
    gates.internalSandbox;
  const syntheticOperatorFunds =
    gates.syntheticOperatorFunds &&
    syntheticFinancialLedger &&
    syntheticFinancialReconciliation &&
    gates.internalSandbox;
  const syntheticAdminFinanceOperations =
    gates.syntheticAdminFinanceOperations &&
    syntheticAdminMultiOrganization &&
    syntheticFinancialLedger &&
    syntheticFinancialReconciliation &&
    syntheticOperatorFunds &&
    gates.internalSandbox;
  const externalIdentityProvider =
    gates.externalIdentityProvider &&
    gates.productionEnabled &&
    gates.realDataIngestion;
  const realIdentityVerification =
    gates.realIdentityVerification &&
    gates.productionEnabled &&
    gates.realDataIngestion &&
    externalIdentityProvider;
  const externalMapProvider =
    gates.externalMapProvider &&
    gates.productionEnabled &&
    gates.realDataIngestion;
  const realMap =
    gates.realMap &&
    gates.productionEnabled &&
    gates.realDataIngestion &&
    externalMapProvider;
  const realDeviceLocation =
    gates.realDeviceLocation &&
    gates.productionEnabled &&
    gates.realDataIngestion;
  const syntheticAdminExecutiveDashboard =
    gates.syntheticAdminExecutiveDashboard &&
    syntheticAdminMultiOrganization &&
    syntheticAdminOperatorManagement &&
    syntheticAdminTripOperations &&
    syntheticAdminCaseManagement &&
    syntheticAdminFinanceOperations &&
    gates.internalSandbox;
  const syntheticAdminAuditSystem =
    gates.syntheticAdminAuditSystem &&
    syntheticAdminMultiOrganization &&
    syntheticAdminExecutiveDashboard &&
    gates.internalSandbox;
  return Object.freeze({
    ...gates,
    syntheticAdminMultiOrganization,
    syntheticAdminAuthentication,
    syntheticAdminRoleAccessMatrix,
    syntheticAdminOperatorManagement,
    syntheticAdminDriverVehicle,
    syntheticAdminTripOperations,
    syntheticAdminCaseManagement,
    syntheticAdminFinanceOperations,
    syntheticFinancialLedger,
    syntheticFinancialReconciliation,
    syntheticOperatorFunds,
    syntheticAdminExecutiveDashboard,
    syntheticAdminAuditSystem,
    syntheticAdminDataReports:
      gates.syntheticAdminDataReports &&
      syntheticAdminMultiOrganization &&
      syntheticAdminExecutiveDashboard &&
      syntheticAdminAuditSystem &&
      gates.internalSandbox,
    syntheticAdminOrganizationAccounts:
      gates.syntheticAdminOrganizationAccounts &&
      syntheticAdminRoleAccessMatrix &&
      syntheticAdminAuditSystem &&
      gates.internalSandbox,
    realAdminOrganizationAccounts:
      gates.realAdminOrganizationAccounts &&
      gates.productionEnabled &&
      gates.productionAuthentication &&
      gates.realDataIngestion,
    realAdminFinanceOperations:
      gates.realAdminFinanceOperations &&
      gates.productionEnabled &&
      gates.realAdminOrganizationAccounts &&
      gates.realPayment,
    productionAdminEnabled:
      gates.productionAdminEnabled &&
      gates.productionEnabled &&
      gates.productionAuthentication &&
      gates.realAdminOrganizationAccounts,
    realOperatorOnboarding:
      gates.realOperatorOnboarding &&
      gates.productionEnabled &&
      gates.productionAuthentication &&
      gates.realDataIngestion,
    realPayment:
      gates.realPayment &&
      gates.productionEnabled &&
      gates.shanghaiPilot &&
      gates.realUserInvitation &&
      gates.realDataIngestion,
    realSettlement:
      gates.realSettlement &&
      gates.productionEnabled &&
      gates.realPayment &&
      gates.realAdminFinanceOperations,
    realWithdrawal:
      gates.realWithdrawal &&
      gates.productionEnabled &&
      gates.realSettlement,
    driverEarlySettlementEnabled:
      gates.driverEarlySettlementEnabled &&
      gates.productionEnabled &&
      gates.realSettlement &&
      gates.realWithdrawal,
    paidFlexTrial:
      gates.paidFlexTrial &&
      gates.productionEnabled &&
      gates.realPayment &&
      gates.shanghaiPilot,
    realUserInvitation:
      gates.realUserInvitation &&
      gates.productionEnabled &&
      gates.shanghaiPilot &&
      gates.realDataIngestion,
    shanghaiPilot: gates.shanghaiPilot && gates.productionEnabled,
    realIdentityVerification,
    realBiometricVerification:
      gates.realBiometricVerification &&
      gates.productionEnabled &&
      gates.realDataIngestion &&
      realIdentityVerification &&
      externalIdentityProvider,
    externalIdentityProvider,
    realSmsDelivery:
      gates.realSmsDelivery &&
      gates.productionEnabled &&
      gates.realDataIngestion,
    realPhoneData:
      gates.realPhoneData &&
      gates.productionEnabled &&
      gates.realDataIngestion,
    productionAuthentication:
      gates.productionAuthentication &&
      gates.productionEnabled &&
      gates.realPhoneData &&
      gates.realSmsDelivery,
    externalMapProvider,
    realMap,
    realDeviceLocation,
    backgroundLocation:
      gates.backgroundLocation &&
      realDeviceLocation &&
      gates.productionEnabled,
    realVehicleLocationStream:
      gates.realVehicleLocationStream &&
      realMap &&
      realDeviceLocation &&
      gates.productionEnabled,
    amapSdk:
      gates.amapSdk &&
      realMap &&
      externalMapProvider,
    amapWebService:
      gates.amapWebService &&
      realMap &&
      externalMapProvider,
  });
}
