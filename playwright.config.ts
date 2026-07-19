import { defineConfig, devices } from "@playwright/test";

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
    baseURL: "http://127.0.0.1:8181",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command:
        "powershell.exe -NoProfile -Command \"$env:POLLYCAR_SANDBOX_PORT='4321'; pnpm --filter @pollycar/server dev:sandbox\"",
      url: "http://127.0.0.1:4321/v1/internal-sandbox/health",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "pnpm exec serve apps/app/dist-sandbox -l 8181 --no-clipboard --single",
      url: "http://127.0.0.1:8181",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "pnpm exec serve apps/admin/dist -l 4174 --no-clipboard",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
