import { resolve } from "node:path";
import {
  createProcessEnvironmentSecretProvider,
  loadLocalSandboxServerRuntimeConfig,
} from "@pollycar/configuration";
import { startInternalSandboxHttpServer } from "./internal-sandbox-server.js";

const config = loadLocalSandboxServerRuntimeConfig();
const fixedNow = config.sandbox.fixedNow
  ? new Date(config.sandbox.fixedNow)
  : undefined;
const server = await startInternalSandboxHttpServer({
  config,
  port: config.http.port,
  ...(fixedNow ? { now: () => new Date(fixedNow) } : {}),
  executiveStateDir: resolve(
    process.cwd(),
    config.sandbox.executiveStateDirectory,
  ),
  avatarObjectDirectory: resolve(
    process.cwd(),
    config.sandbox.avatarObjectDirectory,
  ),
  secretProvider: createProcessEnvironmentSecretProvider(),
});
console.log(`PollyCar 内部沙箱 Server 已启动：${server.url}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
}
