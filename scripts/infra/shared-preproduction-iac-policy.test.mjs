import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  assertSharedPreproductionApplyAllowed,
  createSharedPreproductionPlan,
} from "./shared-preproduction-iac-policy.mjs";

const specText = await readFile(
  new URL("../../spec/platform/shared-preproduction.yaml", import.meta.url),
  "utf8",
);
const exampleInput = JSON.parse(
  await readFile(
    new URL(
      "../../infrastructure/shared-preproduction/iac-input.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

describe("共享预生产 IaC 计划", () => {
  it("在外部输入和批准缺失时只生成零资源变更阻断计划", () => {
    const plan = createSharedPreproductionPlan({
      specText,
      input: exampleInput,
      generatedAt: "2026-07-29T00:00:00.000Z",
    });

    expect(plan.status).toBe("blocked");
    expect(plan.resourceCreationAllowed).toBe(false);
    expect(plan.deploymentAllowed).toBe(false);
    expect(plan.resourceChanges).toEqual([]);
    expect(plan.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INPUT_REQUIRED:provider" }),
        expect.objectContaining({
          code: "APPROVAL_REQUIRED:productAndProductionDecision",
        }),
        expect.objectContaining({
          code: "SPEC_APPROVAL_REQUIRED:product_and_production_decision",
        }),
        expect.objectContaining({
          code: "SPEC_GATE_CLOSED:resource_creation_enabled",
        }),
      ]),
    );
  });

  it("当前机器事实源下 apply 必须失败关闭", () => {
    const plan = createSharedPreproductionPlan({
      specText,
      input: exampleInput,
      generatedAt: "2026-07-29T00:00:00.000Z",
    });

    expect(() =>
      assertSharedPreproductionApplyAllowed(plan, {
        POLLYCAR_SHARED_PREPRODUCTION_APPLY_APPROVED: "true",
        POLLYCAR_SHARED_PREPRODUCTION_PLAN_DIGEST: plan.inputDigest,
        POLLYCAR_SHARED_PREPRODUCTION_APPLY_EVIDENCE: "approval",
      }),
    ).toThrow("SHARED_PREPRODUCTION_APPLY_BLOCKED");
  });

  it("拒绝在 IaC 输入中携带原始密钥", () => {
    const input = structuredClone(exampleInput);
    input.secrets.apiKey = "forbidden";

    expect(() =>
      createSharedPreproductionPlan({
        specText,
        input,
        generatedAt: "2026-07-29T00:00:00.000Z",
      }),
    ).toThrow("SHARED_PREPRODUCTION_RAW_SECRET_FORBIDDEN:secrets.apiKey");
  });
});
