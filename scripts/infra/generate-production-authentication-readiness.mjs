import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  evaluateProductionAuthenticationReadiness,
} from "./production-authentication-readiness.mjs";

const input = resolve(
  process.argv[2] ??
    "infrastructure/production-authentication/readiness-evidence.current.json",
);
const output = resolve(
  process.argv[3] ??
    "output/production-authentication/readiness.json",
);
const evidence = JSON.parse(await readFile(input, "utf8"));
const report = {
  ...evaluateProductionAuthenticationReadiness(evidence),
  generatedAt: new Date().toISOString(),
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(
  `真实账号与认证就绪报告已生成；状态=${report.status}，阻断项=${report.blockers.length}，真实数据=false。\n`,
);
