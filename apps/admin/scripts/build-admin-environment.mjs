import { spawnSync } from "node:child_process";

const environment = process.argv[2] ?? "sandbox";
if (environment !== "sandbox") {
  throw new Error(`不支持的 Admin 构建环境: ${environment}`);
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const env = {
  ...process.env,
  VITE_ADMIN_API_BASE_URL:
    process.env.VITE_ADMIN_API_BASE_URL ?? "http://127.0.0.1:4321",
  VITE_SYNTHETIC_ADMIN_MULTI_ORGANIZATION: "true",
  VITE_SYNTHETIC_ADMIN_AUTHENTICATION: "true",
  VITE_SYNTHETIC_ADMIN_ROLE_ACCESS_MATRIX: "true",
  VITE_SYNTHETIC_ADMIN_OPERATOR_MANAGEMENT: "true",
  VITE_SYNTHETIC_ADMIN_TRIP_OPERATIONS: "true",
  VITE_SYNTHETIC_ADMIN_CASE_MANAGEMENT: "true",
  VITE_SYNTHETIC_ADMIN_FINANCE_OPERATIONS: "true",
  VITE_SYNTHETIC_ADMIN_EXECUTIVE_DASHBOARD: "true",
};

run(["exec", "tsc", "--noEmit"], env);
run(["exec", "vite", "build"], env);

function run(arguments_, environmentVariables) {
  const result = spawnSync(command, arguments_, {
    cwd: process.cwd(),
    env: environmentVariables,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
