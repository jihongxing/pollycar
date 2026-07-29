import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const output = resolve(process.argv[2] ?? "output/container-supply-chain/report.json");
const sbomPath = resolve(process.argv[3] ?? "output/sbom.cdx.json");
const inputs = [
  "infrastructure/local-production/Dockerfile",
  "infrastructure/local-production/compose.yaml",
  "package.json",
  "pnpm-lock.yaml",
  "apps/server/package.json",
];
const files = await Promise.all(
  inputs.map(async (path) => ({
    path,
    sha256: createHash("sha256").update(await readFile(resolve(path))).digest("hex"),
  })),
);
let sbom;
try {
  await access(sbomPath);
  sbom = JSON.parse(await readFile(sbomPath, "utf8"));
} catch {
  throw new Error(
    `CONTAINER_SBOM_REQUIRED: 请先运行 pnpm sbom:generate，缺少 ${sbomPath}`,
  );
}
const report = {
  format: "pollycar.container-supply-chain.v1",
  executionMode: "cyclonedx_dependency_evidence",
  publication: { enabled: false, status: "blocked", reason: "IMAGE_REGISTRY_NOT_SELECTED" },
  sbom: {
    enabled: true,
    format: "CycloneDX",
    path: sbomPath,
    serialNumber: sbom.serialNumber,
    componentCount: sbom.components?.length ?? 0,
  },
  provenance: { enabled: true, inputs: files },
  signature: { enabled: false, status: "blocked", reason: "SIGNING_IDENTITY_NOT_APPROVED" },
  vulnerabilityScan: { enabled: false, status: "blocked", reason: "SCANNER_AND_BUDGET_NOT_APPROVED" },
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write("容器供应链本地证据已生成；镜像发布、签名和漏洞扫描保持关闭。\n");
