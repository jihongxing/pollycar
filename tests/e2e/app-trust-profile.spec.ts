import { expect, test } from "@playwright/test";
import { openAuthenticatedPage } from "./helpers/authenticated-app";
import { mockMobilityDashboard, syntheticTrip } from "./helpers/mobility-fixtures";

test("账户资料只公开审核通过的合成头像", async ({ page }) => {
  let state: "default" | "approved" | "rejected" = "default";
  await page.route("**/v1/internal-sandbox/app/trust-profile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(profile(state)),
    });
  });
  await page.route("**/v1/internal-sandbox/app/trust-profile/avatar", async (route) => {
    const body = route.request().postDataJSON() as { asset: string };
    state = body.asset === "avatar-plum" ? "rejected" : "approved";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(profile(state)),
    });
  });
  await openAuthenticatedPage(page, "/account-profile");
  await expect(page.getByText("公开资料")).toBeVisible();
  await expect(page.getByText("性别")).toBeVisible();
  await page.getByRole("radio", { name: "暖灰头像" }).click();
  await page.getByRole("button", { name: "保存更改" }).click();
  await expect(page.getByText("头像已更新")).toBeVisible();
  await page.getByRole("radio", { name: "梅紫头像" }).click();
  await page.getByRole("button", { name: "保存更改" }).click();
  await expect(page.getByRole("alert", { name: /暂时不能使用这张头像/ })).toBeVisible();
});

test("账户资料支持选择、预览并保存自定义头像", async ({ page }) => {
  await openAuthenticatedPage(page, "/account-profile");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "从照片中选择" }).click();
  await (await chooser).setFiles("apps/app/assets/brand/rego-app-icon.png");

  await expect(page.getByLabel("当前选择的头像照片")).toBeVisible();
  await expect(page.getByRole("status", { name: /照片已准备好/ })).toBeVisible();
  const mediaResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/v1/internal-sandbox/media/avatars/") &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: "保存更改" }).click();
  await expect(page.getByRole("status", { name: /头像已更新/ })).toBeVisible();

  const response = await mediaResponse;
  expect(response.url()).toContain("/v1/internal-sandbox/media/avatars/");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
});

test("完成行程评分写入 Server 且每单只展示一次提交", async ({ page }) => {
  const completed = syntheticTrip("completed");
  let storedScore: number | undefined;
  await mockMobilityDashboard(page, { passengerTrip: completed });
  await page.route(`**/v1/internal-sandbox/app/synthetic-trips/${completed.tripId}/rating`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: storedScore
          ? JSON.stringify({
              ratingId: "rating-e2e",
              tripId: completed.tripId,
              raterAccountId: "synthetic-account-7",
              subjectAccountId: "synthetic-driver",
              score: storedScore,
              tags: [],
              createdAt: new Date().toISOString(),
              synthetic: true,
            })
          : "",
      });
      return;
    }
    storedScore = Number((route.request().postDataJSON() as { score: number }).score);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ratingId: "rating-e2e",
        tripId: completed.tripId,
        raterAccountId: "synthetic-account-7",
        subjectAccountId: "synthetic-driver",
        score: storedScore,
        tags: [],
        createdAt: new Date().toISOString(),
        synthetic: true,
      }),
    });
  });
  await openAuthenticatedPage(page, "/ride-completion");
  await page.getByRole("radio", { name: "5 星" }).click();
  await page.getByRole("button", { name: "提交评价" }).click();
  await expect(page.getByRole("button", { name: "评价已提交" })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("button", { name: "评价已提交" })).toBeDisabled();
  await expect(page.getByText("不会直接触发自动处罚", { exact: false })).toBeVisible();
});

function profile(state: "default" | "approved" | "rejected") {
  return {
    accountId: "synthetic-account-7",
    avatar: {
      state,
      source: state === "approved" ? "preset" : "default",
      ...(state === "approved"
        ? { publicUrl: "https://example.invalid/avatar-city-blue.png" }
        : {}),
      ...(state === "rejected" ? { rejectionReason: "unsafe_content" } : {}),
      customUploadEnabled: true,
      realUploadEnabled: false,
      synthetic: true,
    },
    synthetic: true,
  };
}
