import { spawn } from "node:child_process";
import { assertProductionReleaseReady } from "./production-release-readiness.mjs";

const [command, ...args] = process.argv.slice(2);
if (!command) {
  throw new Error("PRODUCTION_BUILD_COMMAND_REQUIRED");
}

console.log(await assertProductionReleaseReady());
await run(resolveCommand(command), args);

function resolveCommand(value) {
  if (process.platform === "win32" && value === "pnpm") return "pnpm.cmd";
  return value;
}

function run(commandName, commandArgs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(commandName, commandArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`PRODUCTION_BUILD_COMMAND_FAILED:${commandName}:${code}`));
    });
  });
}
