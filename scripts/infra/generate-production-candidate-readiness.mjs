import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { validateOperationalDrillEvidence } from "./operational-drill-evidence.mjs";

const execFileAsync = promisify(execFile);
const output = resolve(
  process.argv[2] ?? "output/production-candidate/readiness.json",
);
const temporaryRoot = resolve("output/production-candidate/.evidence");
const iacPath = resolve(temporaryRoot, "iac.json");
const supplyChainPath = resolve(temporaryRoot, "supply-chain.json");
const drillPath = resolve(temporaryRoot, "drill.json");

await mkdir(temporaryRoot, { recursive: true });
await execFileAsync(process.execPath, [
  "scripts/infra/run-shared-preproduction-iac.mjs",
  "plan",
  "--output",
  iacPath,
]);
await execFileAsync(process.execPath, [
  "scripts/infra/generate-container-supply-chain-report.mjs",
  supplyChainPath,
]);
await execFileAsync(process.execPath, [
  "scripts/infra/run-operational-drill-evidence.mjs",
  "template",
  drillPath,
]);

const [iac, supplyChain, drill] = await Promise.all([
  readJson(iacPath),
  readJson(supplyChainPath),
  readJson(drillPath),
]);
const drillValidation = validateOperationalDrillEvidence(drill);
const blockers = [
  ...iac.blockers.map((item) => item.code),
  supplyChain.publication.reason,
  supplyChain.signature.reason,
  supplyChain.vulnerabilityScan.reason,
  ...drillValidation.violations,
];
const report = {
  reportVersion: "1.0",
  generatedAt: new Date().toISOString(),
  targetState: "production_candidate_ready",
  status: blockers.length === 0 ? "ready" : "blocked",
  cloudResourceChanges: 0,
  realDataUsed: false,
  evidence: {
    iac: { status: iac.status, inputDigest: iac.inputDigest },
    supplyChain: {
      publication: supplyChain.publication.status,
      signature: supplyChain.signature.status,
      vulnerabilityScan: supplyChain.vulnerabilityScan.status,
    },
    operationalDrill: drillValidation,
  },
  blockers: [...new Set(blockers)].sort(),
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await rm(temporaryRoot, { recursive: true, force: true });
process.stdout.write(
  `生产候选就绪报告已生成；状态=${report.status}，阻断项=${report.blockers.length}，云资源变更=0。\n`,
);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
