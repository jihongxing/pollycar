import { describe, expect, it } from "vitest";
import {
  createOperationalDrillTemplate,
  validateOperationalDrillEvidence,
} from "./operational-drill-evidence.mjs";

describe("本地故障演练证据", () => {
  it("未执行的模板必须保持阻断", () => {
    const result = validateOperationalDrillEvidence(
      createOperationalDrillTemplate("2026-07-29T00:00:00.000Z"),
    );
    expect(result.status).toBe("blocked");
    expect(result.violations).toContain("SCENARIO_NOT_PASSED:backup_restore");
  });

  it("完整且满足 RPO/RTO 的合成演练证据可以通过", () => {
    const evidence = createOperationalDrillTemplate();
    evidence.scenarios = evidence.scenarios.map((item) => ({
      ...item,
      status: "passed",
      startedAt: "2026-07-29T00:00:00.000Z",
      completedAt: "2026-07-29T00:10:00.000Z",
      observedResult: "本地合成演练通过",
      evidenceReference: `local://${item.id}`,
      owner: "local-operator",
      ...(item.id === "backup_restore"
        ? {
            actualRtoMinutes: 10,
            actualRpoMinutes: 1,
            migrationHistoryValid: true,
            healthCheckValid: true,
            accessControlValid: true,
          }
        : {}),
    }));
    expect(validateOperationalDrillEvidence(evidence)).toEqual({
      valid: true,
      status: "passed",
      violations: [],
    });
  });
});
