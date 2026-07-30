import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  assertNoDeprecatedConfigurationEnvironmentVariables,
  createAppPublicConfig,
  createLocalSandboxAppEnvironment,
  createPublicConfigEnvironment,
  getLocalSandboxProfile,
  parseAppPublicConfig,
} from "@pollycar/configuration";
import { createAmapPublicConfig } from "./amap-client-environment.mjs";

const mode = process.argv[2];
if (!["sandbox", "demo", "production"].includes(mode)) {
  throw new Error("BUILD_BRAND_ENVIRONMENT_REQUIRED");
}

const env = createAppBuildEnvironment(mode, process.env);
const outputDirectory = resolve(`dist-${mode}`);

if (mode === "production") {
  await run(
    process.execPath,
    [resolve("scripts/check-production-release-readiness.mjs")],
    env,
  );
}

await rm(outputDirectory, { recursive: true, force: true });

await run(
  process.env.npm_execpath ? process.execPath : process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  process.env.npm_execpath
    ? [process.env.npm_execpath, "exec", "expo", "export", "--clear", "--platform", "web", "--output-dir", `dist-${mode}`]
    : ["exec", "expo", "export", "--clear", "--platform", "web", "--output-dir", `dist-${mode}`],
  env,
);

if (mode === "production") {
  await run(
    process.execPath,
    [resolve("scripts/check-production-brand-output.mjs"), outputDirectory],
    env,
  );
}

function createAppBuildEnvironment(buildMode, environment) {
  assertNoDeprecatedConfigurationEnvironmentVariables(environment);
  if (buildMode === "sandbox") {
    return createPublicConfigEnvironment(
      environment,
      "EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG",
      parseAppPublicConfig(
        createLocalSandboxAppEnvironment(environment)
          .EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG,
      ),
    );
  }

  if (buildMode === "production") {
    const config = parseAppPublicConfig(
      environment.EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG,
    );
    if (config.profile !== "production") {
      throw new Error("APP_PUBLIC_CONFIG_PRODUCTION_PROFILE_REQUIRED");
    }
    return createPublicConfigEnvironment(
      environment,
      "EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG",
      config,
    );
  }

  const profile = getLocalSandboxProfile(environment);
  return createPublicConfigEnvironment(
    environment,
    "EXPO_PUBLIC_POLLYCAR_PUBLIC_CONFIG",
    createAppPublicConfig({
      profile: buildMode,
      apiBaseUrl: profile.network.apiBaseUrl,
      brandDisplayEnvironment: buildMode,
      maps: createAmapPublicConfig(environment),
    }),
  );
}

function run(command, args, environment) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: environment,
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`BUILD_COMMAND_FAILED:${command}:${code}`));
    });
  });
}
