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

async function completeAdultEligibility(page: Page): Promise<void> {
  const enterHome = page.getByRole("button", { name: "进入乘客首页" });
  if (await enterHome.isVisible()) {
    await enterHome.click();
    return;
  }
  const authorize = page.getByRole("button", { name: "了解并继续" });
  await authorize.waitFor();
  await authorize.click();
  await page.getByRole("button", { name: "开始实名确认" }).click();
  await expect(page.getByText("实名信息已确认")).toBeVisible();
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
