import { test, expect } from "@playwright/test";
import { collectRuntimeErrors, expectNoRuntimeErrors } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
});

test("главная строит динамический каталог из 10 карточек", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/index.html");
  await expect(page.locator("#catalogStatus")).toHaveText("Каталог обновлён.");
  await expect(page.locator("#toolCatalog .tool-card")).toHaveCount(10);
  await expect(page.locator("#categoryNavigation small")).toHaveText([
    "5 тренажёров", "2 тренажёра", "2 тренажёра", "1 инструмент"
  ]);
  await expect(page.locator('a[href="test.html?id=biology-matching"]')).toHaveCount(1);
  await expect(page.locator('a[href="test.html?id=biology-foundations"]')).toHaveCount(1);
  await expect(page.locator('a[href="test.html?id=alkane-homology"]')).toHaveCount(1);
  await expect(page.locator('a[href="test.html?id=hybridization-theory"]')).toHaveCount(1);
  await expect(page.locator('a[href="test.html?id=organic-classification"]')).toHaveCount(1);
  await expect(page.locator('a[href="test.html?id=redox-trainer"]')).toHaveCount(1);
  await expect(page.locator('a[href="hydrocarbons.html"]')).toHaveCount(1);
  await expect(page.locator("#toolCatalog")).not.toContainText("старая версия");
  await expectNoRuntimeErrors(runtimeErrors);
});
