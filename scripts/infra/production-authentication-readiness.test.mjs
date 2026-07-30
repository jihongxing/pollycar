import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  evaluateProductionAuthenticationReadiness,
  validateProductionAuthenticationReadinessEvidence,
} from "./production-authentication-readiness.mjs";

describe("真实账号与认证就绪报告", () => {
  it("空值模板满足固定证据结构", async () => {
    const evidence = JSON.parse(
      await readFile(
        "infrastructure/production-authentication/readiness-evidence.example.json",
        "utf8",
      ),
    );

    expect(validateProductionAuthenticationReadinessEvidence(evidence)).toEqual(
      [],
    );
  });

  it("错误环境、缺项和额外字段必须失败关闭", async () => {
    const evidence = JSON.parse(
      await readFile(
        "infrastructure/production-authentication/readiness-evidence.example.json",
        "utf8",
      ),
    );
    evidence.environment = "production";
    delete evidence.decisions.phoneScope;
    evidence.approvals.unexpectedApproval = {
      approved: true,
      evidenceReference: "approval://unexpected",
    };

    expect(validateProductionAuthenticationReadinessEvidence(evidence)).toEqual([
      "EVIDENCE_APPROVALS_KEYS_INVALID",
      "EVIDENCE_DECISIONS_KEYS_INVALID",
      "EVIDENCE_DECISION_SHAPE_INVALID:phoneScope",
      "EVIDENCE_ENVIRONMENT_INVALID",
    ]);
    const report = evaluateProductionAuthenticationReadiness(evidence);
    expect(report.status).toBe("blocked");
    expect(report.providerTestingAllowed).toBe(false);
    expect(report.blockers).toEqual(
      expect.arrayContaining([
        "EVIDENCE_APPROVALS_KEYS_INVALID",
        "EVIDENCE_DECISION_SHAPE_INVALID:phoneScope",
        "EVIDENCE_DECISIONS_KEYS_INVALID",
        "EVIDENCE_ENVIRONMENT_INVALID",
      ]),
    );
  });

  it("根证据无效时仍返回阻断报告而不是抛出异常", () => {
    expect(validateProductionAuthenticationReadinessEvidence(null)).toEqual([
      "EVIDENCE_ROOT_INVALID",
    ]);

    const report = evaluateProductionAuthenticationReadiness(null);
    expect(report.status).toBe("blocked");
    expect(report.providerTestingAllowed).toBe(false);
    expect(report.productionAuthenticationEnabled).toBe(false);
    expect(report.blockers).toContain("EVIDENCE_ROOT_INVALID");
  });

  it("空值证据稳定失败关闭且不启用真实能力", async () => {
    const evidence = JSON.parse(
      await readFile(
        "infrastructure/production-authentication/readiness-evidence.example.json",
        "utf8",
      ),
    );
    const report = evaluateProductionAuthenticationReadiness(evidence);

    expect(report.status).toBe("blocked");
    expect(report.providerTestingAllowed).toBe(false);
    expect(report.productionAuthenticationEnabled).toBe(false);
    expect(report.authenticationRoutesEnabled).toBe(false);
    expect(report.productionMigrationsEnabled).toBe(false);
    expect(report.realDataUsed).toBe(false);
    expect(report.blockers).toContain("DECISION_PENDING:phoneScope");
    expect(report.blockers).toContain("APPROVAL_MISSING:security");
    expect(report.blockers).toContain(
      "PROVIDER_CAPABILITY_MISSING:sms.providerSelected",
    );
  });

  it("当前快照关闭供应商选择和账号策略阻断但保持外部证据失败关闭", async () => {
    const evidence = JSON.parse(
      await readFile(
        "infrastructure/production-authentication/readiness-evidence.current.json",
        "utf8",
      ),
    );
    const report = evaluateProductionAuthenticationReadiness(evidence);

    expect(validateProductionAuthenticationReadinessEvidence(evidence)).toEqual(
      [],
    );
    expect(report.status).toBe("blocked");
    expect(report.blockers).toHaveLength(37);
    expect(report.blockers).not.toContain("DECISION_PENDING:phoneScope");
    expect(report.blockers).not.toContain(
      "PROVIDER_CAPABILITY_MISSING:sms.providerSelected",
    );
    expect(report.blockers).toContain(
      "PROVIDER_CAPABILITY_MISSING:sms.enterpriseAccountReady",
    );
    expect(report.blockers).toContain("APPROVAL_MISSING:security");
    expect(report.providerTestingAllowed).toBe(false);
    expect(report.productionAuthenticationEnabled).toBe(false);
    expect(report.realDataUsed).toBe(false);
  });

  it("已选择供应商时必须登记稳定供应商标识", async () => {
    const evidence = JSON.parse(
      await readFile(
        "infrastructure/production-authentication/readiness-evidence.current.json",
        "utf8",
      ),
    );
    evidence.providers.sms.selectedProviderId = null;

    const report = evaluateProductionAuthenticationReadiness(evidence);
    expect(report.status).toBe("blocked");
    expect(report.blockers).toContain("PROVIDER_SELECTION_INVALID:sms");
  });

  it("全部证据齐备也只允许供应商测试，不直接启用生产认证", async () => {
    const evidence = JSON.parse(
      await readFile(
        "infrastructure/production-authentication/readiness-evidence.example.json",
        "utf8",
      ),
    );
    for (const decision of Object.values(evidence.decisions)) {
      decision.status = "approved";
      decision.selectedValue ??= "approved-value";
      decision.evidenceReference ??= "approval://decision";
    }
    evidence.decisions.preproductionDataScope.selectedValue =
      "synthetic_and_provider_test_data_only";
    for (const provider of Object.values(evidence.providers)) {
      provider.selectedProviderId = "approved-provider";
      for (const name of [
        "providerSelected",
        "enterpriseAccountReady",
        "testEnvironmentReady",
        "unknownResultRecoveryDocumented",
        "callbackVerificationDocumented",
        "idempotencyDocumented",
        "rateLimitDocumented",
      ]) provider[name] = true;
      provider.managedSecretReference = "vault://provider/test";
      provider.contractEvidenceReference = "contract://provider";
      provider.dataProcessingEvidenceReference = "evidence://provider/data";
    }
    for (const name of Object.keys(evidence.cryptography)) {
      evidence.cryptography[name] = "vault://authentication/key";
    }
    for (const approval of Object.values(evidence.approvals)) {
      approval.approved = true;
      approval.evidenceReference = "approval://authentication";
    }
    for (const name of Object.keys(evidence.verification)) {
      evidence.verification[name] = "evidence://authentication/verification";
    }

    const report = evaluateProductionAuthenticationReadiness(evidence);
    expect(report.status).toBe("ready");
    expect(report.providerTestingAllowed).toBe(true);
    expect(report.productionAuthenticationEnabled).toBe(false);
    expect(report.authenticationRoutesEnabled).toBe(false);
    expect(report.productionMigrationsEnabled).toBe(false);
  });
});
