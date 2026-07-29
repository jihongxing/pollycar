import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("容器供应链本地证据", () => {
  it("生成 SBOM 与来源摘要，且发布、签名和扫描保持关闭", async () => {
    const output = resolve("output/test-container-supply-chain-report.json");
    try {
      await execFileAsync(process.execPath, [
        "scripts/infra/generate-container-supply-chain-report.mjs",
        output,
      ]);
      const report = JSON.parse(await readFile(output, "utf8"));
      expect(report.sbom.components).toHaveLength(5);
      expect(report.publication.status).toBe("blocked");
      expect(report.signature.status).toBe("blocked");
      expect(report.vulnerabilityScan.status).toBe("blocked");
    } finally {
      await rm(output, { force: true });
    }
  });
});
