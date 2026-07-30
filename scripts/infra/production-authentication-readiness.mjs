const DECISION_NAMES = Object.freeze([
  "phoneScope",
  "recycledNumberPolicy",
  "consumerAccountRecovery",
  "adminAccountStrategy",
  "adminMfaStrategy",
  "sessionLifetimesAndDeviceLimits",
  "adultEligibilityAndLegalGender",
  "retentionPeriods",
  "fraudAndSupportOwnership",
  "preproductionDataScope",
]);
const PROVIDER_NAMES = Object.freeze([
  "sms",
  "adultEligibility",
  "adminWorkforce",
]);
const APPROVAL_NAMES = Object.freeze([
  "productAndAccountPolicy",
  "security",
  "privacyAndLegal",
  "operationsAndCustomerSupport",
  "supplierProcurementAndFinance",
  "productionDecision",
]);
const PROVIDER_BOOLEAN_REQUIREMENTS = Object.freeze([
  "providerSelected",
  "enterpriseAccountReady",
  "testEnvironmentReady",
  "unknownResultRecoveryDocumented",
  "callbackVerificationDocumented",
  "idempotencyDocumented",
  "rateLimitDocumented",
]);
const PROVIDER_EVIDENCE_REQUIREMENTS = Object.freeze([
  "managedSecretReference",
  "contractEvidenceReference",
  "dataProcessingEvidenceReference",
]);
const CRYPTOGRAPHY_REQUIREMENTS = Object.freeze([
  "phoneEncryptionKeyReference",
  "phoneDigestKeyReference",
  "otpHmacKeyReference",
  "sessionSigningKeyReference",
  "rotationRunbookEvidenceReference",
]);
const VERIFICATION_REQUIREMENTS = Object.freeze([
  "supplierSandboxTestEvidenceReference",
  "penetrationTestEvidenceReference",
  "recoveryDrillEvidenceReference",
  "realDeviceTestEvidenceReference",
  "dataDeletionEvidenceReference",
]);
const DECISION_REQUIREMENTS = Object.freeze([
  "status",
  "selectedValue",
  "evidenceReference",
]);
const PROVIDER_REQUIREMENTS = Object.freeze([
  "selectedProviderId",
  ...PROVIDER_BOOLEAN_REQUIREMENTS,
  ...PROVIDER_EVIDENCE_REQUIREMENTS,
]);
const APPROVAL_REQUIREMENTS = Object.freeze([
  "approved",
  "evidenceReference",
]);

export function validateProductionAuthenticationReadinessEvidence(evidence) {
  const errors = [];
  if (!isRecord(evidence)) {
    return Object.freeze(["EVIDENCE_ROOT_INVALID"]);
  }
  if (evidence.contractVersion !== "1.0") {
    errors.push("EVIDENCE_CONTRACT_VERSION_INVALID");
  }
  if (evidence.environment !== "shared-preproduction") {
    errors.push("EVIDENCE_ENVIRONMENT_INVALID");
  }
  validateExactKeys(
    evidence.decisions,
    DECISION_NAMES,
    "EVIDENCE_DECISIONS_KEYS_INVALID",
    errors,
  );
  validateExactKeys(
    evidence.providers,
    PROVIDER_NAMES,
    "EVIDENCE_PROVIDERS_KEYS_INVALID",
    errors,
  );
  validateExactKeys(
    evidence.cryptography,
    CRYPTOGRAPHY_REQUIREMENTS,
    "EVIDENCE_CRYPTOGRAPHY_KEYS_INVALID",
    errors,
  );
  validateExactKeys(
    evidence.approvals,
    APPROVAL_NAMES,
    "EVIDENCE_APPROVALS_KEYS_INVALID",
    errors,
  );
  validateExactKeys(
    evidence.verification,
    VERIFICATION_REQUIREMENTS,
    "EVIDENCE_VERIFICATION_KEYS_INVALID",
    errors,
  );
  for (const name of DECISION_NAMES) {
    validateExactKeys(
      evidence.decisions?.[name],
      DECISION_REQUIREMENTS,
      `EVIDENCE_DECISION_SHAPE_INVALID:${name}`,
      errors,
    );
  }
  for (const name of PROVIDER_NAMES) {
    validateExactKeys(
      evidence.providers?.[name],
      PROVIDER_REQUIREMENTS,
      `EVIDENCE_PROVIDER_SHAPE_INVALID:${name}`,
      errors,
    );
  }
  for (const name of APPROVAL_NAMES) {
    validateExactKeys(
      evidence.approvals?.[name],
      APPROVAL_REQUIREMENTS,
      `EVIDENCE_APPROVAL_SHAPE_INVALID:${name}`,
      errors,
    );
  }
  return Object.freeze([...new Set(errors)].sort());
}

export function evaluateProductionAuthenticationReadiness(evidence) {
  const blockers = [
    ...validateProductionAuthenticationReadinessEvidence(evidence),
  ];
  for (const name of DECISION_NAMES) {
    const decision = evidence?.decisions?.[name];
    if (decision?.status !== "approved") {
      blockers.push(`DECISION_PENDING:${name}`);
    }
    if (!isEvidenceReference(decision?.evidenceReference)) {
      blockers.push(`DECISION_EVIDENCE_MISSING:${name}`);
    }
  }
  if (
    evidence?.decisions?.preproductionDataScope?.selectedValue !==
    "synthetic_and_provider_test_data_only"
  ) {
    blockers.push("PREPRODUCTION_REAL_DATA_SCOPE_FORBIDDEN");
  }
  for (const providerName of PROVIDER_NAMES) {
    const provider = evidence?.providers?.[providerName];
    if (
      provider?.providerSelected === true &&
      !isNonEmptyString(provider?.selectedProviderId)
    ) {
      blockers.push(`PROVIDER_SELECTION_INVALID:${providerName}`);
    }
    for (const requirement of PROVIDER_BOOLEAN_REQUIREMENTS) {
      if (provider?.[requirement] !== true) {
        blockers.push(`PROVIDER_CAPABILITY_MISSING:${providerName}.${requirement}`);
      }
    }
    for (const requirement of PROVIDER_EVIDENCE_REQUIREMENTS) {
      if (!isEvidenceReference(provider?.[requirement])) {
        blockers.push(`PROVIDER_EVIDENCE_MISSING:${providerName}.${requirement}`);
      }
    }
  }
  for (const name of CRYPTOGRAPHY_REQUIREMENTS) {
    if (!isEvidenceReference(evidence?.cryptography?.[name])) {
      blockers.push(`CRYPTOGRAPHY_EVIDENCE_MISSING:${name}`);
    }
  }
  for (const name of APPROVAL_NAMES) {
    const approval = evidence?.approvals?.[name];
    if (approval?.approved !== true) {
      blockers.push(`APPROVAL_MISSING:${name}`);
    }
    if (!isEvidenceReference(approval?.evidenceReference)) {
      blockers.push(`APPROVAL_EVIDENCE_MISSING:${name}`);
    }
  }
  for (const name of VERIFICATION_REQUIREMENTS) {
    if (!isEvidenceReference(evidence?.verification?.[name])) {
      blockers.push(`VERIFICATION_EVIDENCE_MISSING:${name}`);
    }
  }

  const uniqueBlockers = [...new Set(blockers)].sort();
  return Object.freeze({
    reportVersion: "1.0",
    targetState: "production_authentication_provider_testing_ready",
    status: uniqueBlockers.length === 0 ? "ready" : "blocked",
    providerTestingAllowed: uniqueBlockers.length === 0,
    productionAuthenticationEnabled: false,
    authenticationRoutesEnabled: false,
    productionMigrationsEnabled: false,
    realDataUsed: false,
    blockers: Object.freeze(uniqueBlockers),
  });
}

function isEvidenceReference(value) {
  return (
    typeof value === "string" &&
    /^(approval|evidence|contract|vault|secret):\/\/.+/.test(value)
  );
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateExactKeys(value, expectedKeys, errorCode, errors) {
  if (!isRecord(value)) {
    errors.push(errorCode);
    return;
  }
  const actualKeys = Object.keys(value).sort();
  const requiredKeys = [...expectedKeys].sort();
  if (
    actualKeys.length !== requiredKeys.length ||
    actualKeys.some((key, index) => key !== requiredKeys[index])
  ) {
    errors.push(errorCode);
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
