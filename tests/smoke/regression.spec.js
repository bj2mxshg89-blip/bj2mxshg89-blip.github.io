import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import {
  collectRuntimeErrors,
  expectNoRuntimeErrors,
  selectUniqueMatchingAnswers,
  startDefaultAttempt
} from "./helpers.js";

const classification = JSON.parse(readFileSync(new URL("../../data/tests/organic-classification.json", import.meta.url), "utf8"));

test("история показывает старый формат и новый балльный формат", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/index.html");
  await page.evaluate(() => {
    localStorage.setItem("chem-cabinet:history:organic-review", JSON.stringify([{
      variantId: "1", mode: "training", completedAt: "2026-01-01T10:00:00.000Z",
      testVersion: 1, correctCount: 8, total: 10, percent: 80, grade: 4, durationMs: 60_000
    }]));
    localStorage.setItem("chem-cabinet:history:organic-classification", JSON.stringify([{
      variantId: "mixed", mode: "test", completedAt: "2026-01-01T10:00:00.000Z",
      testVersion: 1, correctCount: 14, total: 15, totalQuestions: 15,
      earnedPoints: 59, maxPoints: 60, percent: 98, grade: 5, durationMs: 60_000
    }]));
  });

  await page.goto("/results.html?id=organic-review");
  await expect(page.locator(".trainer-history-item")).toContainText("8/10");
  await expect(page.locator(".trainer-history-item")).toContainText("верно");
  await page.goto("/results.html?id=organic-classification");
  await expect(page.locator(".trainer-history-item")).toContainText("59/60");
  await expect(page.locator(".trainer-history-item")).toContainText("баллы");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("случайная выборка и matching-ответ восстанавливаются после обновления", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/test.html?id=organic-classification");
  await startDefaultAttempt(page);
  const first = page.locator(".matching-select").first();
  const value = await first.locator("option").evaluateAll((options) =>
    options.find((option) => option.value && !option.disabled)?.value
  );
  await first.selectOption(value);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("chem-cabinet:progress:organic-classification")));

  await page.reload();
  await expect(page.locator("#resumeCard")).toBeVisible();
  await page.locator("#resumeButton").click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("chem-cabinet:progress:organic-classification")));
  expect(after.questionOrder).toEqual(before.questionOrder);
  await expect(page.locator(".matching-select").first()).toHaveValue(value);
  await expectNoRuntimeErrors(runtimeErrors);
});

test("частичный matching завершается, печатается и повторяет ровно ошибку", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.addInitScript(() => {
    window.print = () => { window.__printCalled = true; };
  });
  const variant = classification.variants[0];
  const questionId = variant.questionIds[0];
  const question = classification.questions.find((item) => item.id === questionId);
  const progress = {
    schemaVersion: 1,
    testId: classification.id,
    testVersion: classification.version,
    attemptId: "smoke-partial",
    variantId: variant.id,
    mode: "training",
    currentQuestion: 0,
    currentQuestionId: questionId,
    baseQuestionIds: variant.questionIds,
    questionIds: [questionId],
    questionOrder: [questionId],
    optionOrder: { [questionId]: question.options.map((option) => option.id) },
    selectedAnswers: {},
    checkedQuestionIds: [],
    mistakeQuestionIds: [],
    startedAt: "2026-01-01T10:00:00.000Z",
    completedAt: null,
    retryOf: null
  };

  await page.goto("/index.html");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: "chem-cabinet:progress:organic-classification",
    value: progress
  });
  await page.goto("/test.html?id=organic-classification");
  await page.locator("#resumeButton").click();

  const correctFirstThree = question.items.slice(0, 3).map((item) => question.correct[item.id]);
  const used = new Set(correctFirstThree);
  const fourthCorrect = question.correct[question.items[3].id];
  const wrongFourth = question.options.find((option) => !used.has(option.id) && option.id !== fourthCorrect).id;
  await selectUniqueMatchingAnswers(page, [...correctFirstThree, wrongFourth]);
  await page.locator("#primaryButton").click();
  await expect(page.locator("#feedbackPanel")).toContainText("Верно: 3 из 4");
  await page.locator("#primaryButton").click();
  await expect(page.locator("#resultPanel")).toBeVisible();
  await expect(page.locator("#resultScore")).toHaveText("3/4");

  await page.locator("#printResultButton").click();
  expect(await page.evaluate(() => window.__printCalled)).toBe(true);
  await page.locator("#repeatMistakesButton").click();
  await expect(page.locator("#questionCounter")).toHaveText("1 / 1");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("test.html показывает понятные ошибки адреса", async ({ page }) => {
  await page.goto("/test.html");
  await expect(page.locator("#errorPanel")).toContainText("Не указан идентификатор теста");
  await page.goto("/test.html?id=unknown-test");
  await expect(page.locator("#errorPanel")).toContainText("Файл теста не найден");
});

test("results.html показывает понятные ошибки адреса", async ({ page }) => {
  await page.goto("/results.html");
  await expect(page.locator("#historyError")).toContainText("Не указан идентификатор теста");
  await page.goto("/results.html?id=unknown-test");
  await expect(page.locator("#historyError")).toContainText("Не удалось загрузить данные теста");
});

test("семь старых страниц загружаются без JavaScript-ошибок", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const pages = [
    "organic-review.html",
    "inorg-nomenclature.html",
    "organic-classification.html",
    "hybridization-theory.html",
    "alkane-homology.html",
    "trainer.html",
    "seating-v2.html"
  ];
  for (const path of pages) {
    runtimeErrors.length = 0;
    const response = await page.goto(`/${path}`);
    expect(response.ok(), path).toBe(true);
    await expect(page.locator("h1").first()).toBeVisible();
    await expectNoRuntimeErrors(runtimeErrors);
  }
});
