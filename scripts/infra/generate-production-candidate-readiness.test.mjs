import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("生产候选就绪汇总报告", () => {
  it("外部条件缺失时保持阻断且不产生云资源变更", async () => {
    const output = resolve("output/test-production-candidate-readiness.json");
    try {
      await execFileAsync(process.execPath, [
        "scripts/infra/generate-production-candidate-readiness.mjs",
        output,
      ]);
      const report = JSON.parse(await readFile(output, "utf8"));
      expect(report.status).toBe("blocked");
      expect(report.cloudResourceChanges).toBe(0);
      expect(report.realDataUsed).toBe(false);
      expect(report.blockers.length).toBeGreaterThan(0);
    } finally {
      await rm(output, { force: true });
    }
  });
});
