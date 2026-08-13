import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import {
  collectRuntimeErrors,
  expectNoRuntimeErrors,
  selectUniqueMatchingAnswers,
  startDefaultAttempt
} from "./helpers.js";

const definition = JSON.parse(readFileSync(
  new URL("../../data/tests/biology-matching.json", import.meta.url),
  "utf8"
));

test("биологический тест показывает четыре варианта, два режима и историю", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/test.html?id=biology-matching");
  await expect(page.locator("#heroTitle")).toHaveText("Биология: сопоставление");
  await expect(page.locator("#heroChips")).toContainText("Биология");
  await expect(page.locator('input[name="test-variant"]')).toHaveCount(4);
  await expect(page.locator('input[name="test-mode"]')).toHaveCount(2);
  await expect(page.locator("#historyLink")).toHaveAttribute("href", "results.html?id=biology-matching");

  await page.goto("/results.html?id=biology-matching");
  await expect(page.locator("#historyPanel")).toBeVisible();
  await expect(page.locator("#historyTestTitle")).toHaveText("Биология: сопоставление");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("все четыре варианта запускаются в тренировке и тесте", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  for (const variant of definition.variants) {
    for (const mode of ["training", "test"]) {
      await page.goto("/index.html");
      await page.evaluate(() => localStorage.removeItem("chem-cabinet:progress:biology-matching"));
      await page.goto("/test.html?id=biology-matching");
      await page.locator(`input[name="test-variant"][value="${variant.id}"]`).check({ force: true });
      await page.locator(`input[name="test-mode"][value="${mode}"]`).check({ force: true });
      await page.locator("#startAttemptButton").click();
      await expect(page.locator("#workPanel")).toBeVisible();
      await expect(page.locator("#activeVariantBadge")).toHaveText(variant.title);
      const progress = await page.evaluate(() => JSON.parse(
        localStorage.getItem("chem-cabinet:progress:biology-matching")
      ));
      expect(progress.questionOrder, `${variant.id}/${mode}`).toHaveLength(
        variant.selectionCount[mode]
      );
    }
  }
  await expectNoRuntimeErrors(runtimeErrors);
});

test("весь тест сохраняет все 27 правильных соответствий и полный результат", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/test.html?id=biology-matching");
  await startDefaultAttempt(page);

  for (let index = 0; index < definition.questions.length; index += 1) {
    const question = definition.questions[index];
    const answers = question.items.map((item) => question.correct[item.id]);
    await expect(page.locator(".matching-select")).toHaveCount(question.items.length);
    await selectUniqueMatchingAnswers(page, answers);
    await page.locator("#primaryButton").click();
    await expect(page.locator("#feedbackPanel")).toContainText("✓ Верно");
    await expect(page.locator(".matching-row.is-correct")).toHaveCount(question.items.length);
    await page.locator("#primaryButton").click();
  }

  await expect(page.locator("#resultPanel")).toBeVisible();
  await expect(page.locator("#resultScore")).toHaveText("27/27");
  await expect(page.locator("#resultPercent")).toHaveText("100%");
  await expect(page.locator("#resultGrade")).toHaveText("5");
  const history = await page.evaluate(() => JSON.parse(
    localStorage.getItem("chem-cabinet:history:biology-matching")
  ));
  expect(history[0].earnedPoints).toBe(27);
  expect(history[0].maxPoints).toBe(27);
  await expectNoRuntimeErrors(runtimeErrors);
});

test("растительная клетка восстанавливает ответ и даёт частичный балл на ширине 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const runtimeErrors = collectRuntimeErrors(page);
  const question = definition.questions.find((item) => item.section === "plant-cell");
  const correct = question.items.map((item) => question.correct[item.id]);
  const partial = [correct[1], correct[0], ...correct.slice(2)];

  await page.goto("/test.html?id=biology-matching");
  await page.locator('input[name="test-variant"][value="plant-cell"]').check({ force: true });
  await page.locator("#startAttemptButton").click();
  await page.locator(".matching-select").first().selectOption(correct[0]);
  const savedValue = await page.locator(".matching-select").first().inputValue();

  await page.reload();
  await expect(page.locator("#resumeCard")).toBeVisible();
  await page.locator("#resumeButton").click();
  await expect(page.locator(".matching-select").first()).toHaveValue(savedValue);

  await selectUniqueMatchingAnswers(page, partial);
  await page.locator("#primaryButton").click();
  await expect(page.locator("#feedbackPanel")).toContainText("Верно: 10 из 12");
  await expect(page.locator(".matching-row.is-correct")).toHaveCount(10);
  await expect(page.locator(".matching-row.is-wrong")).toHaveCount(2);
  await page.locator("#primaryButton").click();
  await expect(page.locator("#resultScore")).toHaveText("10/12");
  await expect(page.locator("#repeatMistakesButton")).toBeVisible();

  const overflows = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflows).toBe(false);
  await expectNoRuntimeErrors(runtimeErrors);
});
