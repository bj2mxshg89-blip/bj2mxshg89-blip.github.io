import { test, expect } from "@playwright/test";
import {
  collectRuntimeErrors,
  expectNoRuntimeErrors,
  selectUniqueMatchingAnswers,
  startDefaultAttempt
} from "./helpers.js";

test("organic-review: настройка и ответ single", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/test.html?id=organic-review");
  await expect(page.locator('input[name="test-variant"]')).toHaveCount(5);
  await expect(page.locator('input[name="test-mode"]')).toHaveCount(2);
  await startDefaultAttempt(page);
  await expect(page.locator('input[type="radio"][name^="answer-"]')).toHaveCount(4);
  await page.locator('input[type="radio"][name^="answer-"]').first().check();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("chem-cabinet:progress:organic-review")));
  expect(Object.values(saved.selectedAnswers)[0]).toHaveLength(1);
  await expectNoRuntimeErrors(runtimeErrors);
});

test("organic-review: вопрос multiple принимает несколько ответов", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/test.html?id=organic-review");
  await startDefaultAttempt(page);
  await page.getByRole("button", { name: "Перейти к заданию 11" }).click();
  const checkboxes = page.locator('input[type="checkbox"][name^="answer-"]');
  await expect(checkboxes).toHaveCount(4);
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await expect(page.locator("#questionStatus")).toContainText("Выбрано вариантов: 2");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("inorg-nomenclature: single загружается и сохраняется", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/test.html?id=inorg-nomenclature");
  await startDefaultAttempt(page);
  const options = page.locator('input[type="radio"][name^="answer-"]');
  await expect(options.first()).toBeVisible();
  await options.first().check();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("chem-cabinet:progress:inorg-nomenclature")));
  expect(Object.values(saved.selectedAnswers)[0]).toHaveLength(1);
  await expectNoRuntimeErrors(runtimeErrors);
});

test("organic-classification: matching работает на узком экране", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/test.html?id=organic-classification");
  await startDefaultAttempt(page);
  await expect(page.locator(".matching-select")).toHaveCount(4);
  expect(await page.locator(".trainer-message-error").count()).toBe(0);

  const first = page.locator(".matching-select").first();
  const firstValue = await first.locator("option").evaluateAll((options) =>
    options.find((option) => option.value && !option.disabled)?.value
  );
  await first.selectOption(firstValue);
  const disabledElsewhere = await page.locator(".matching-select").nth(1)
    .locator(`option[value="${firstValue}"]`).isDisabled();
  expect(disabledElsewhere).toBe(true);

  await selectUniqueMatchingAnswers(page);
  await page.locator("#primaryButton").click();
  await expect(page.locator(".matching-row-status")).toHaveCount(4);
  await expect(page.locator("#feedbackPanel")).toContainText(/Верно: \d из 4/);
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflows).toBe(false);
  await expectNoRuntimeErrors(runtimeErrors);
});
