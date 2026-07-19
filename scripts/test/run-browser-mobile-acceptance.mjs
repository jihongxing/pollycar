import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.POLLYCAR_APP_URL ?? "http://127.0.0.1:8181";
const outputDirectory = path.resolve("output/manual-qa/browser-mobile");
const viewports = [
  { profileId: "mobile-small", width: 320, height: 568 },
  { profileId: "android-common", width: 360, height: 800 },
  { profileId: "iphone-common", width: 393, height: 852 },
  { profileId: "mobile-large", width: 430, height: 932 },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const results = [];

try {
  for (const profile of viewports) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto(`${baseUrl}/passenger-workbench`);
    await page.getByText("乘客工作台").waitFor();
    await page.getByRole("button", { name: "创建合成行程" }).waitFor();
    await page.screenshot({
      path: path.join(outputDirectory, `${profile.profileId}-passenger.png`),
      fullPage: true,
    });
    const passengerLayout = await layoutSnapshot(page);

    await page.getByRole("tab", { name: "我的" }).click();
    await page.getByText("一个账户，两种身份。").waitFor();
    await page.screenshot({
      path: path.join(outputDirectory, `${profile.profileId}-account.png`),
      fullPage: true,
    });
    const accountLayout = await layoutSnapshot(page);

    await page.getByRole("button", { name: "身份切换，当前使用乘客身份" }).click();
    await page.getByText("一个账户，两种使用身份").waitFor();
    await page.screenshot({
      path: path.join(outputDirectory, `${profile.profileId}-identity.png`),
      fullPage: true,
    });
    const identityLayout = await layoutSnapshot(page);

    results.push({
      profileId: profile.profileId,
      viewport: { width: profile.width, height: profile.height },
      status:
        pageErrors.length === 0 &&
        [passengerLayout, accountLayout, identityLayout].every((layout) => !layout.horizontalOverflow)
          ? "passed"
          : "failed",
      pageErrors,
      layouts: {
        passenger: passengerLayout,
        account: accountLayout,
        identity: identityLayout,
      },
      syntheticOnly: true,
    });
    await context.close();
  }
} finally {
  await browser.close();
}

const report = {
  runId: crypto.randomUUID(),
  recordedAt: new Date().toISOString(),
  executionEnvironment: "browser_mobile_viewport",
  productionEnabled: false,
  results,
};
await writeFile(
  path.join(outputDirectory, "result.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

const failed = results.filter((result) => result.status === "failed");
console.table(
  results.map(({ profileId, viewport, status, pageErrors }) => ({
    profileId,
    viewport: `${viewport.width}x${viewport.height}`,
    status,
    pageErrors: pageErrors.length,
  })),
);
if (failed.length > 0) {
  throw new Error(`浏览器移动视口验收失败: ${failed.map((result) => result.profileId).join(", ")}`);
}

async function layoutSnapshot(page) {
  return page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    activeElementLabel:
      document.activeElement?.getAttribute("aria-label") ??
      document.activeElement?.textContent?.trim().slice(0, 80) ??
      "",
  }));
}
