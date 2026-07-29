export function createOperationalDrillTemplate(
  generatedAt = new Date().toISOString(),
) {
  return {
    evidenceVersion: "1.0",
    environment: "local-production-readiness",
    dataMode: "synthetic_only",
    generatedAt,
    overallStatus: "blocked",
    scenarios: [
      scenario("backup_restore"),
      scenario("database_unavailable"),
      scenario("certificate_expiry"),
    ],
  };
}

export function validateOperationalDrillEvidence(evidence) {
  const violations = [];
  if (evidence.environment !== "local-production-readiness") {
    violations.push("ENVIRONMENT_INVALID");
  }
  if (evidence.dataMode !== "synthetic_only") {
    violations.push("SYNTHETIC_DATA_REQUIRED");
  }
  const scenarios = new Map(
    (evidence.scenarios ?? []).map((item) => [item.id, item]),
  );
  for (const id of [
    "backup_restore",
    "database_unavailable",
    "certificate_expiry",
  ]) {
    const item = scenarios.get(id);
    if (!item || item.status !== "passed") {
      violations.push(`SCENARIO_NOT_PASSED:${id}`);
      continue;
    }
    for (const field of [
      "startedAt",
      "completedAt",
      "observedResult",
      "evidenceReference",
      "owner",
    ]) {
      if (!item[field]) violations.push(`SCENARIO_EVIDENCE_REQUIRED:${id}:${field}`);
    }
  }
  const restore = scenarios.get("backup_restore");
  if (restore?.status === "passed") {
    if (restore.actualRtoMinutes > 60) violations.push("RESTORE_RTO_EXCEEDED");
    if (restore.actualRpoMinutes > 5) violations.push("RESTORE_RPO_EXCEEDED");
    if (restore.migrationHistoryValid !== true) {
      violations.push("RESTORE_MIGRATION_HISTORY_INVALID");
    }
    if (restore.healthCheckValid !== true) {
      violations.push("RESTORE_HEALTH_CHECK_INVALID");
    }
    if (restore.accessControlValid !== true) {
      violations.push("RESTORE_ACCESS_CONTROL_INVALID");
    }
  }
  return {
    valid: violations.length === 0,
    status: violations.length === 0 ? "passed" : "blocked",
    violations,
  };
}

function scenario(id) {
  return {
    id,
    status: "not_run",
    startedAt: null,
    completedAt: null,
    observedResult: null,
    evidenceReference: null,
    owner: null,
  };
}
