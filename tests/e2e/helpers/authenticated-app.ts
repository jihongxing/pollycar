import { expect, type Page } from "@playwright/test";

const syntheticPhoneNumbers = ["18800000007", "18800000008", "18800000009"] as const;
const syntheticVerificationCode = "246810";
let syntheticPhoneCursor = 0;

export async function loginThroughPhoneVerification(
  page: Page,
  options: Readonly<{
    completeAdultEligibility?: boolean;
    expectedIdentity?: "passenger" | "driver";
  }> = {},
): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => undefined }],
        }),
      },
    });
  });
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.removeItem("rego.authentication.refresh-token");
    window.localStorage.removeItem("rego.authentication.device-id");
  });
  await page.reload();
  await page.waitForFunction(
    () =>
      ["/adult-eligibility", "/ride-home", "/driver-home"].includes(
        window.location.pathname,
      ) ||
      document.body.textContent?.includes("欢迎回来"),
  );
  if (await page.getByText("欢迎回来").isVisible()) {
    const preferredIndex = syntheticPhoneCursor++ % syntheticPhoneNumbers.length;
    let challengeReady = false;
    for (let offset = 0; offset < syntheticPhoneNumbers.length; offset += 1) {
      const phoneNumber =
        syntheticPhoneNumbers[(preferredIndex + offset) % syntheticPhoneNumbers.length]!;
      await page.getByRole("button", { name: "使用验收号码 18800000007" }).click();
      await page.getByRole("textbox", { name: "手机号" }).fill(phoneNumber);
      await expect(page.getByRole("button", { name: "获取验证码" })).toBeEnabled();
      await page.getByRole("button", { name: "获取验证码" }).click();
      await page.waitForFunction(
        () =>
          Boolean(document.querySelector('input[aria-label="六位验证码"]')) ||
          document.body.textContent?.includes("请等待倒计时结束后再获取验证码。"),
      );
      if (await page.getByRole("textbox", { name: "六位验证码" }).isVisible()) {
        challengeReady = true;
        break;
      }
    }
    expect(challengeReady).toBe(true);
    await page.getByRole("textbox", { name: "六位验证码" }).fill(syntheticVerificationCode);
    await page.getByRole("button", { name: "验证并登录" }).click();
  }

  await expect(page).toHaveURL(/\/(adult-eligibility|ride-home|driver-home)$/);
  if (options.completeAdultEligibility === false) return;
  if (/\/adult-eligibility$/.test(page.url())) {
    await completeAdultEligibility(page);
  }
  await expect(page).toHaveURL(
    options.expectedIdentity === "driver"
      ? /\/driver-home$/
      : /\/ride-home$/,
  );
}

export async function openAuthenticatedPage(page: Page, path: string): Promise<void> {
  const driverPath = isDriverPath(path);
  if (driverPath) await projectAuthenticationAsDriver(page);
  await loginThroughPhoneVerification(page, {
    expectedIdentity: driverPath ? "driver" : "passenger",
  });
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(path)}$`));
}

export async function completeOwnerParticipationConsent(page: Page): Promise<void> {
  for (const agreementName of [
    "车主参与协议，未阅读",
    "行程与安全责任，未阅读",
    "认证材料与隐私说明，未阅读",
  ]) {
    await page.getByRole("button", { name: agreementName }).click();
  }
  await page.getByRole("checkbox", { name: "我已阅读并同意以上内容" }).click();
  await page.getByRole("button", { name: "我已了解，继续添加车辆" }).click();
}

export async function completeVehicleMaterialChecklist(page: Page): Promise<void> {
  for (const materialName of [
    "驾驶资格材料，添加",
    "车辆材料，添加",
    "保险材料，添加",
  ]) {
    await page.getByRole("button", { name: materialName }).click();
  }
}

async function completeAdultEligibility(page: Page): Promise<void> {
  const enterHome = page.getByRole("button", { name: "进入乘客首页" });
  if (await enterHome.isVisible()) {
    await enterHome.click();
    return;
  }
  const authorize = page.getByRole("button", { name: "同意并继续" });
  if (await authorize.isVisible()) {
    for (const agreementName of [
      "实名与成年条件，未阅读",
      "本人验证说明，未阅读",
      "信息处理与安全，未阅读",
    ]) {
      await page.getByRole("button", { name: agreementName }).click();
    }
    await page.getByRole("checkbox", { name: "我已阅读并同意以上内容" }).click();
    await authorize.click();
  }
  const startVerification = page.getByRole("button", { name: "开始实名确认" });
  if (await startVerification.isVisible()) {
    await startVerification.click();
    await expect(page.getByRole("heading", { name: "实名资料" })).toBeVisible();
    await page.getByRole("button", { name: "进入乘客首页" }).click();
    return;
  }
  await startVerification.waitFor();
  await startVerification.click();
  await expect(page.getByRole("heading", { name: "实名资料" })).toBeVisible();
  await page.getByRole("button", { name: "进入乘客首页" }).click();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDriverPath(path: string): boolean {
  return path.startsWith("/driver-") || path === "/owner-workbench";
}

async function projectAuthenticationAsDriver(page: Page): Promise<void> {
  for (const path of [
    "**/v1/auth/phone/verify",
    "**/v1/auth/session/refresh",
  ]) {
    await page.route(path, async (route) => {
      const response = await route.fetch();
      const payload = (await response.json()) as {
        session: {
          activeIdentity: "passenger" | "driver";
          availableIdentities: readonly ("passenger" | "driver")[];
        };
      };
      await route.fulfill({
        response,
        json: {
          ...payload,
          session: {
            ...payload.session,
            activeIdentity: "driver",
            availableIdentities: ["passenger", "driver"],
          },
        },
      });
    });
  }
  await page.route(
    "**/v1/internal-sandbox/app/vehicle-reviews/vehicle-application-7**",
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          applicationId: "vehicle-application-7",
          accountId: "synthetic-account-7",
          status: "approved",
          version: 3,
          ownerIdentityAvailable: true,
          maxPassengerCount: 3,
          vehicleType: "中大型轿车 · 示例 A",
          insuranceExpiresOn: "2027-08-31",
          syntheticAttachmentId: "synthetic-insurance-a",
          requestedMaterialCodes: [],
          timeline: [],
          synthetic: true,
        }),
      });
    },
  );
}
