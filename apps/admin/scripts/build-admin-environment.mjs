import { spawnSync } from "node:child_process";
import {
  assertNoDeprecatedConfigurationEnvironmentVariables,
  createAdminPublicConfig,
  createPublicConfigEnvironment,
  getLocalSandboxProfile,
} from "@pollycar/configuration";

const environment = process.argv[2] ?? "sandbox";
if (environment !== "sandbox") {
  throw new Error(`不支持的 Admin 构建环境: ${environment}`);
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
assertNoDeprecatedConfigurationEnvironmentVariables(process.env);
const profile = getLocalSandboxProfile(process.env);
const env = createPublicConfigEnvironment(
  process.env,
  "VITE_POLLYCAR_PUBLIC_CONFIG",
  createAdminPublicConfig({
    profile: profile.id,
    apiBaseUrl: profile.network.apiBaseUrl,
    capabilities: Object.fromEntries(
      Object.keys(profile.capabilities).map((name) => [
        name.replace(/^syntheticAdmin/, "").replace(/^./, (letter) =>
          letter.toLowerCase(),
        ),
        true,
      ]),
    ),
  }),
);

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
