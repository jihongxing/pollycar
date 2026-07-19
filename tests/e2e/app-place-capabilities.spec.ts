import { expect, test } from "@playwright/test";
import { openAuthenticatedPage } from "./helpers/authenticated-app";

test("手动上车点、常用地点和最近搜索可刷新恢复", async ({ page }) => {
  await openAuthenticatedPage(page, "/ride-search");
  await page.getByRole("textbox", { name: "手动输入上车点" }).fill("上海图书馆");
  await page.getByRole("button", { name: "使用手动上车点" }).click();
  await expect(page.getByText(/上海图书馆 · 上海图书馆/)).toBeVisible();

  await page.getByRole("textbox", { name: "搜索目的地" }).fill("虹桥");
  await page.getByRole("button", { name: "将虹桥站设为家" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: /虹桥站/ }).first()).toBeVisible();
});

test("位置权限拒绝时提供手动输入恢复路径", async ({ page, context }) => {
  await context.clearPermissions();
  await openAuthenticatedPage(page, "/ride-search");
  await page.getByRole("button", { name: "使用设备位置" }).click();
  await expect(page.getByText("位置权限未授权")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "手动输入上车点" })).toBeVisible();
});

