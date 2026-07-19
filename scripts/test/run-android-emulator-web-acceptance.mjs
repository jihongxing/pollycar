import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const cdpUrl = process.env.POLLYCAR_ANDROID_CDP_URL ?? "http://127.0.0.1:9222";
const appUrl = process.env.POLLYCAR_ANDROID_APP_URL ?? "http://127.0.0.1:8181";
const outputDirectory = path.resolve("output/manual-qa/android");
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.connectOverCDP(cdpUrl);
const context = browser.contexts()[0];
let page = context.pages().find((candidate) => candidate.url().startsWith(appUrl));
if (!page) {
  page = await context.newPage();
}

const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
const checks = [];

try {
  await page.goto(`${appUrl}/passenger-workbench`);
  await page.getByText("乘客工作台").waitFor();
  await page.getByLabel("当前为内部沙箱，仅使用合成数据").waitFor();
  checks.push("Android Chrome 加载内部沙箱");

  await page.getByRole("tab", { name: "我的" }).click();
  await page.getByText("一个账户，两种身份。").waitFor();
  checks.push("底部导航触控", "账户页面");
  await page.screenshot({
    path: path.join(outputDirectory, "android-emulator-cdp-account.png"),
  });

  await page.getByRole("button", { name: "身份切换，当前使用乘客身份" }).click();
  await page.getByText("一个账户，两种使用身份").waitFor();
  checks.push("身份设置");
  await page.screenshot({
    path: path.join(outputDirectory, "android-emulator-cdp-identity.png"),
  });

  await page.getByRole("button", { name: "返回我的" }).click();
  await page.getByRole("button", { name: /车辆，当前状态/ }).click();
  await page.getByText("车辆准入与审核").waitFor();
  checks.push("车辆申请入口");

  const recoveryAlert = page.getByRole("alert", { name: /最新状态同步失败/ });
  if (await recoveryAlert.count()) {
    throw new Error("Android 模拟器通过标准反向端口访问时 Server 状态同步失败。");
  }
  checks.push("Server 状态同步");
} finally {
  await browser.close();
}

const result = {
  runId: crypto.randomUUID(),
  recordedAt: new Date().toISOString(),
  profileId: "HiddenShield_QA_API36",
  platform: "android",
  osVersion: "16",
  deviceName: "sdk_gphone64_x86_64",
  executionEnvironment: "android_emulator_web",
  status: pageErrors.length === 0 ? "passed" : "failed",
  completedChecks: checks,
  pageErrors,
  nativeCoverage: false,
  nativeStatus: "blocked",
  nativeBlockedReason:
    "Expo Go 与 Gradle 9.3.1 均需下载外部构建依赖，当前网络连接超时；未执行原生日期选择器、系统返回、软键盘、前后台切换和 TalkBack 验收。",
  syntheticOnly: true,
};
await writeFile(
  path.join(outputDirectory, "result-web.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  throw new Error("Android 模拟器 Web 验收失败。");
}
