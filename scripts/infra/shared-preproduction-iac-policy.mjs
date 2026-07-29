import { createHash } from "node:crypto";

const APPROVALS = Object.freeze([
  [
    "productAndProductionDecision",
    "product_and_production_decision",
    "产品与生产决策",
  ],
  ["engineeringAndOperations", "engineering_and_operations", "工程与运维"],
  ["security", "security", "安全"],
  ["privacyAndCompliance", "privacy_and_compliance", "隐私与合规"],
  ["finance", "finance", "财务"],
]);

const REQUIRED_INPUTS = Object.freeze([
  ["provider", "云供应商候选"],
  ["contractEntity", "合同主体"],
  ["accountReference", "独立账号或订阅引用"],
  ["billing.currency", "计费币种"],
  ["billing.monthlyBudgetLimit", "月度预算上限"],
  ["region.mainlandChinaRegion", "境内主区域"],
  ["region.availabilityZones", "至少两个可用区"],
  ["domains.publicDomain", "公开域名"],
  ["domains.internalDomain", "内部域名"],
  ["domains.dnsProvider", "DNS 托管方"],
  ["managedPostgresql.service", "托管 PostgreSQL 产品"],
  ["managedPostgresql.version", "PostgreSQL 版本"],
  ["managedPostgresql.instanceClass", "数据库规格"],
  ["managedPostgresql.storageGb", "数据库存储容量"],
  ["managedPostgresql.connectionLimit", "数据库连接上限"],
  ["managedPostgresql.maintenanceWindow", "数据库维护窗口"],
  ["certificates.managedCertificateService", "托管证书服务"],
  ["secrets.managedSecretStore", "托管密钥服务"],
  ["secrets.encryptionKeyReference", "加密密钥引用"],
  ["secrets.workloadIdentityReference", "工作负载身份引用"],
  ["network.administrativeAccess", "受控运维访问方案"],
  ["network.allowedEgressDomains", "出站域名允许列表"],
  ["monitoring.provider", "监控供应商"],
  ["monitoring.storageRegion", "监控存储区域"],
  ["monitoring.monthlyBudgetLimit", "监控月度预算"],
  ["monitoring.onCallOwner", "值班责任人"],
]);

const FORBIDDEN_SECRET_KEY_PATTERN =
  /(?:password|passphrase|privatekey|private_key|secretvalue|secret_value|accesskey|access_key|apikey|api_key|token)$/i;

export function createSharedPreproductionPlan({
  specText,
  input,
  generatedAt = new Date().toISOString(),
}) {
  assertInputEnvelope(input);
  assertNoRawSecrets(input);
  const specState = readSpecState(specText);
  const blockers = [];

  for (const [path, label] of REQUIRED_INPUTS) {
    const value = readPath(input, path);
    if (isMissingRequiredValue(path, value)) {
      blockers.push({
        code: `INPUT_REQUIRED:${path}`,
        message: `${label}尚未提供。`,
      });
    }
  }

  for (const [name, specName, label] of APPROVALS) {
    const approval = input.approvals[name];
    if (
      approval?.approved !== true ||
      !approval.evidenceReference?.trim() ||
      approval.revoked === true ||
      isExpired(approval.expiresAt, generatedAt)
    ) {
      blockers.push({
        code: `APPROVAL_REQUIRED:${name}`,
        message: `${label}批准证据尚未生效。`,
      });
    }
    const specApproval = specState.approvals[specName];
    if (!specApproval.approved || !specApproval.evidenceReference) {
      blockers.push({
        code: `SPEC_APPROVAL_REQUIRED:${specName}`,
        message: `机器事实源中的${label}批准仍未生效。`,
      });
    }
  }

  if (!specState.executionGates.resource_creation_enabled) {
    blockers.push({
      code: "SPEC_GATE_CLOSED:resource_creation_enabled",
      message: "机器事实源仍禁止创建共享预生产资源。",
    });
  }

  if (!specState.providerSelected) {
    blockers.push({
      code: "SPEC_SELECTION_REQUIRED:provider",
      message: "机器事实源尚未确认云供应商。",
    });
  }
  if (!specState.accountSelected) {
    blockers.push({
      code: "SPEC_SELECTION_REQUIRED:account",
      message: "机器事实源尚未确认独立账号。",
    });
  }
  if (!specState.regionSelected) {
    blockers.push({
      code: "SPEC_SELECTION_REQUIRED:region",
      message: "机器事实源尚未确认境内区域。",
    });
  }

  const status = blockers.length === 0 ? "ready" : "blocked";
  const resourceCreationAllowed =
    status === "ready" &&
    specState.executionGates.resource_creation_enabled;
  return Object.freeze({
    planVersion: "1.0",
    environmentName: "shared-preproduction",
    generatedAt,
    executionMode: "plan_only",
    status,
    productionEnabled: specState.executionGates.production_enabled,
    resourceCreationAllowed,
    deploymentAllowed:
      resourceCreationAllowed && specState.executionGates.deployment_enabled,
    businessRoutesEnabled: false,
    realDataAllowed: false,
    inputDigest: digestInput(input),
    blockers,
    proposedLayers: [
      "organization_and_account",
      "network_and_security",
      "managed_postgresql",
      "identity_and_secrets",
      "compute_and_ingress",
      "observability",
      "disaster_recovery",
    ],
    resourceChanges: [],
  });
}

export function assertSharedPreproductionApplyAllowed(
  plan,
  environment = process.env,
) {
  if (plan.status !== "ready" || plan.blockers.length !== 0) {
    throw new Error("SHARED_PREPRODUCTION_APPLY_BLOCKED");
  }
  if (
    plan.resourceCreationAllowed !== true
  ) {
    throw new Error("SHARED_PREPRODUCTION_APPLY_DISABLED");
  }
  if (environment.POLLYCAR_SHARED_PREPRODUCTION_APPLY_APPROVED !== "true") {
    throw new Error("SHARED_PREPRODUCTION_APPLY_APPROVAL_REQUIRED");
  }
  if (
    environment.POLLYCAR_SHARED_PREPRODUCTION_PLAN_DIGEST !== plan.inputDigest
  ) {
    throw new Error("SHARED_PREPRODUCTION_PLAN_DIGEST_MISMATCH");
  }
  const evidence = environment.POLLYCAR_SHARED_PREPRODUCTION_APPLY_EVIDENCE?.trim();
  if (!evidence) {
    throw new Error("SHARED_PREPRODUCTION_APPLY_EVIDENCE_REQUIRED");
  }
}

export function readSpecState(specText) {
  return Object.freeze({
    executionGates: Object.freeze({
      production_enabled: readBoolean(specText, "production_enabled"),
      resource_creation_enabled: readBoolean(
        specText,
        "resource_creation_enabled",
      ),
      deployment_enabled: readBoolean(specText, "deployment_enabled"),
    }),
    providerSelected: readBoolean(specText, "provider_selected"),
    accountSelected: readBoolean(specText, "account_selected"),
    regionSelected: readBoolean(specText, "region_selected"),
    approvals: Object.freeze(
      Object.fromEntries(
        APPROVALS.map(([, specName]) => [
          specName,
          readSpecApproval(specText, specName),
        ]),
      ),
    ),
  });
}

function assertInputEnvelope(input) {
  if (
    !input ||
    input.contractVersion !== "1.0" ||
    input.environmentName !== "shared-preproduction" ||
    !input.approvals
  ) {
    throw new Error("SHARED_PREPRODUCTION_IAC_INPUT_INVALID");
  }
}

function assertNoRawSecrets(value, path = "") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRawSecrets(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nestedValue] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (
      FORBIDDEN_SECRET_KEY_PATTERN.test(key) &&
      nestedValue !== null &&
      nestedValue !== ""
    ) {
      throw new Error(`SHARED_PREPRODUCTION_RAW_SECRET_FORBIDDEN:${nextPath}`);
    }
    assertNoRawSecrets(nestedValue, nextPath);
  }
}

function readBoolean(source, name) {
  const matches = [
    ...source.matchAll(new RegExp(`^\\s*${name}:\\s*(true|false)\\s*$`, "gm")),
  ];
  if (matches.length !== 1) {
    throw new Error(`SHARED_PREPRODUCTION_SPEC_BOOLEAN_INVALID:${name}`);
  }
  return matches[0][1] === "true";
}

function readSpecApproval(source, name) {
  const pattern = new RegExp(
    `^\\s{2}${name}:\\s*\\r?\\n\\s{4}approved:\\s*(true|false)\\s*\\r?\\n\\s{4}evidence_reference:\\s*([^\\r\\n]+)\\s*$`,
    "m",
  );
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`SHARED_PREPRODUCTION_SPEC_APPROVAL_INVALID:${name}`);
  }
  const evidence = match[2].trim();
  return Object.freeze({
    approved: match[1] === "true",
    evidenceReference:
      evidence === "null" || evidence === '""' || evidence === "''"
        ? undefined
        : evidence,
  });
}

function readPath(value, path) {
  return path.split(".").reduce((current, segment) => current?.[segment], value);
}

function isMissingRequiredValue(path, value) {
  if (path === "region.availabilityZones") {
    return !Array.isArray(value) || value.length < 2;
  }
  if (path === "network.allowedEgressDomains") {
    return !Array.isArray(value) || value.length === 0;
  }
  return value === null || value === undefined || value === "";
}

function isExpired(expiresAt, generatedAt) {
  if (!expiresAt) return false;
  return Date.parse(expiresAt) <= Date.parse(generatedAt);
}

function digestInput(input) {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
