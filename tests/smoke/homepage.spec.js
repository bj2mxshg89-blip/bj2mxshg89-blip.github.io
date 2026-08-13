import { test, expect } from "@playwright/test";
import { collectRuntimeErrors, expectNoRuntimeErrors } from "./helpers.js";

test("главная строит динамический каталог из 8 канонических карточек", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/index.html");
  await expect(page.locator("#catalogStatus")).toHaveText("Каталог обновлён.");
  await expect(page.locator("#toolCatalog .tool-card")).toHaveCount(8);
  await expect(page.locator("#categoryNavigation small")).toHaveText([
    "4 тренажёра", "2 тренажёра", "1 тренажёр", "1 инструмент"
  ]);
  await expect(page.locator('a[href="test.html?id=biology-matching"]')).toHaveCount(1);
  await expect(page.locator('a[href="test.html?id=alkane-homology"]')).toHaveCount(1);
  await expect(page.locator('a[href="test.html?id=hybridization-theory"]')).toHaveCount(1);
  await expect(page.locator('a[href="test.html?id=organic-classification"]')).toHaveCount(1);
  await expect(page.locator('a[href="test.html?id=redox-trainer"]')).toHaveCount(1);
  await expect(page.locator("#toolCatalog")).not.toContainText("старая версия");
  await expectNoRuntimeErrors(runtimeErrors);
});
