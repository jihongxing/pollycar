import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  createOperationalDrillTemplate,
  validateOperationalDrillEvidence,
} from "./operational-drill-evidence.mjs";

const mode = process.argv[2];
const path = resolve(
  process.argv[3] ?? "output/operational-readiness/drill-evidence.json",
);
if (mode === "template") {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify(createOperationalDrillTemplate(), null, 2)}\n`,
    "utf8",
  );
  process.stdout.write("本地故障演练证据模板已生成；状态=blocked。\n");
} else if (mode === "validate") {
  const result = validateOperationalDrillEvidence(
    JSON.parse(await readFile(path, "utf8")),
  );
  process.stdout.write(
    `故障演练证据校验状态=${result.status}，问题数=${result.violations.length}。\n`,
  );
  if (!result.valid) process.exitCode = 1;
} else {
  throw new Error("OPERATIONAL_DRILL_EVIDENCE_MODE_REQUIRED");
}
