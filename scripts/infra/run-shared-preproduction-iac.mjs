import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  assertSharedPreproductionApplyAllowed,
  createSharedPreproductionPlan,
} from "./shared-preproduction-iac-policy.mjs";

const mode = process.argv[2];
if (!["plan", "apply"].includes(mode)) {
  throw new Error("SHARED_PREPRODUCTION_IAC_MODE_REQUIRED");
}

const inputPath = resolve(
  readArgument("--input") ??
    "infrastructure/shared-preproduction/iac-input.example.json",
);
const outputPath = resolve(
  readArgument("--output") ??
    "output/shared-preproduction/iac-plan.json",
);
const specPath = resolve("spec/platform/shared-preproduction.yaml");

const [inputSource, specText] = await Promise.all([
  readFile(inputPath, "utf8"),
  readFile(specPath, "utf8"),
]);
const plan = createSharedPreproductionPlan({
  specText,
  input: JSON.parse(inputSource),
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

if (mode === "apply") {
  assertSharedPreproductionApplyAllowed(plan);
  throw new Error("SHARED_PREPRODUCTION_PROVIDER_ADAPTER_NOT_IMPLEMENTED");
}

process.stdout.write(
  `共享预生产 IaC 只读计划已生成；状态=${plan.status}，阻断项=${plan.blockers.length}，资源变更=0。\n`,
);

function readArgument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`SHARED_PREPRODUCTION_IAC_ARGUMENT_REQUIRED:${name}`);
  }
  return value;
}
