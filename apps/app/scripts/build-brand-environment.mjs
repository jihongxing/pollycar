import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const mode = process.argv[2];
if (!["sandbox", "demo", "production"].includes(mode)) {
  throw new Error("BUILD_BRAND_ENVIRONMENT_REQUIRED");
}

const outputDirectory = resolve(`dist-${mode}`);
await rm(outputDirectory, { recursive: true, force: true });

const env = {
  ...process.env,
  EXPO_PUBLIC_BRAND_DEMO: mode === "demo" ? "true" : "",
  EXPO_PUBLIC_BRAND_PRODUCTION: mode === "production" ? "true" : "",
  EXPO_PUBLIC_BRAND_DISPLAY_ENV: "",
};

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
