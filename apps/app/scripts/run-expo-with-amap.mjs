import { spawn } from "node:child_process";
import {
  assertNoDeprecatedConfigurationEnvironmentVariables,
  createLocalSandboxAppEnvironment,
  createPublicConfigEnvironment,
  parseAppPublicConfig,
} from "@pollycar/configuration";

const args = process.argv.slice(2);
if (args.length === 0) throw new Error("EXPO_COMMAND_REQUIRED");

assertNoDeprecatedConfigurationEnvironmentVariables(process.env);
const localEnvironment = createLocalSandboxAppEnvironment(process.env);
const environment = createPublicConfigEnvironment(
  process.env,
  "EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG",
  parseAppPublicConfig(
    localEnvironment.EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG,
  ),
);
const command = process.env.npm_execpath
  ? process.execPath
  : process.platform === "win32"
    ? "pnpm.cmd"
    : "pnpm";
const commandArgs = process.env.npm_execpath
  ? [process.env.npm_execpath, "exec", "expo", ...args]
  : ["exec", "expo", ...args];

const child = spawn(command, commandArgs, {
  cwd: process.cwd(),
  env: environment,
  stdio: "inherit",
  shell: false,
});
child.once("error", (error) => {
  throw error;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
