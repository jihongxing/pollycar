import { defineConfig, devices } from "@playwright/test";
import { getLocalSandboxProfile } from "@pollycar/configuration";

const profile = getLocalSandboxProfile(process.env);
const serverUrl = new URL(profile.network.apiBaseUrl);
const appUrl = new URL(profile.network.appUrl);
const adminUrl = new URL(profile.network.adminUrl);

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./output/playwright/results",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/playwright/report", open: "never" }],
  ],
  use: {
    baseURL: appUrl.origin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command:
        `powershell.exe -NoProfile -Command "$env:POLLYCAR_LOCAL_SANDBOX_SERVER_PORT='${serverUrl.port}'; $env:POLLYCAR_LOCAL_SANDBOX_ADMIN_PORT='${adminUrl.port}'; $env:POLLYCAR_LOCAL_SANDBOX_APP_PORT='${appUrl.port}'; pnpm --filter @pollycar/server dev:sandbox"`,
      url: `${serverUrl.origin}/v1/internal-sandbox/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `pnpm exec serve apps/app/dist-sandbox -l ${appUrl.port} --no-clipboard --single`,
      url: appUrl.origin,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `pnpm exec serve apps/admin/dist -l ${adminUrl.port} --no-clipboard`,
      url: adminUrl.origin,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
