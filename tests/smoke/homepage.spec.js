import { test, expect } from "@playwright/test";
import { collectRuntimeErrors, expectNoRuntimeErrors } from "./helpers.js";

test("главная строит динамический каталог из 12 карточек", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/index.html");
  await expect(page.locator("#catalogStatus")).toHaveText("Каталог обновлён.");
  await expect(page.locator("#toolCatalog .tool-card")).toHaveCount(12);
  await expect(page.locator("#categoryNavigation small")).toHaveText([
    "7 тренажёров", "4 тренажёра", "1 инструмент"
  ]);
  await expect(page.locator('a[href="test.html?id=hybridization-theory"]')).toHaveCount(1);
  await expect(page.locator('a[href="hybridization-theory.html"]')).toHaveCount(1);
  await expect(page.locator('a[href="test.html?id=organic-classification"]')).toHaveCount(1);
  await expect(page.locator('a[href="organic-classification.html"]')).toHaveCount(1);
  await expect(page.locator('a[href="test.html?id=redox-trainer"]')).toHaveCount(1);
  await expect(page.locator('a[href="trainer.html"]')).toHaveCount(1);
  await expectNoRuntimeErrors(runtimeErrors);
});
