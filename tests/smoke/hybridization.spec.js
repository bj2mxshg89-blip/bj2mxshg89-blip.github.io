import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import {
  collectRuntimeErrors,
  expectNoRuntimeErrors,
  selectUniqueMatchingAnswers
} from "./helpers.js";

const definition = JSON.parse(readFileSync(
  new URL("../../data/tests/hybridization-theory.json", import.meta.url),
  "utf8"
));
const questions = new Map(definition.questions.map((question) => [question.id, question]));

function optionOrder(question) {
  if (question.type === "matching") return question.options.map((option) => option.id);
  if (question.type === "single" || question.type === "multiple") {
    return question.options.map((_, index) => index);
  }
  return [];
}

function savedProgress(questionId, variantId, mode = "training", answer) {
  const variant = definition.variants.find((item) => item.id === variantId);
  const selectedAnswers = answer === undefined ? {} : { [questionId]: answer };
  return {
    schemaVersion: 1,
    testId: definition.id,
    testVersion: definition.version,
    attemptId: `smoke-${questionId}`,
    variantId,
    mode,
    currentQuestion: 0,
    currentQuestionId: questionId,
    baseQuestionIds: variant.questionIds,
    questionIds: [questionId],
    questionOrder: [questionId],
    optionOrder: { [questionId]: optionOrder(questions.get(questionId)) },
    selectedAnswers,
    checkedQuestionIds: [],
    mistakeQuestionIds: [],
    startedAt: "2026-01-01T10:00:00.000Z",
    completedAt: null,
    retryOf: null
  };
}

async function openSavedProgress(page, progress) {
  await page.goto("/index.html");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: `chem-cabinet:progress:${definition.id}`,
    value: progress
  });
  await page.goto(`/test.html?id=${definition.id}`);
  await expect(page.locator("#resumeCard")).toBeVisible();
  await page.locator("#resumeButton").click();
  await expect(page.locator("#workPanel")).toBeVisible();
}

test("новая гибридизация показывает восемь вариантов, два режима и памятку", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/test.html?id=hybridization-theory");
  await expect(page.locator('input[name="test-variant"]')).toHaveCount(8);
  await expect(page.locator('input[name="test-mode"]')).toHaveCount(2);
  await expect(page.locator("#referencePanel")).toBeVisible();
  await expect(page.locator("#referenceList li")).toHaveCount(7);
  await expect(page.locator("#historyLink")).toHaveAttribute("href", "results.html?id=hybridization-theory");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("все восемь вариантов запускаются в тренировке и тесте", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  for (const variant of definition.variants) {
    for (const mode of ["training", "test"]) {
      await page.goto("/test.html?id=hybridization-theory");
      await page.locator(`input[name="test-variant"][value="${variant.id}"]`).check({ force: true });
      await page.locator(`input[name="test-mode"][value="${mode}"]`).check({ force: true });
      await page.locator("#startAttemptButton").click();
      await expect(page.locator("#workPanel")).toBeVisible();
      await expect(page.locator("#activeVariantBadge")).toHaveText(variant.title);
      await expect(page.locator("#activeModeBadge")).toHaveText(mode === "training" ? "Тренировка" : "Тест");
    }
  }
  await expectNoRuntimeErrors(runtimeErrors);
});

test("number принимает 0, не теряет focus и восстанавливает строку после обновления", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const questionId = "hybridization-sigma-pi-002";
  await openSavedProgress(page, savedProgress(questionId, "sigma-pi"));
  const input = page.locator(".number-answer-input");
  await expect(input).toHaveAttribute("type", "text");
  await expect(input).toHaveAttribute("inputmode", "numeric");
  await input.fill("0");
  await expect(input).toBeFocused();
  const saved = await page.evaluate(() => JSON.parse(
    localStorage.getItem("chem-cabinet:progress:hybridization-theory")
  ));
  expect(saved.selectedAnswers["hybridization-sigma-pi-002"]).toBe("0");

  await page.reload();
  await page.locator("#resumeButton").click();
  await expect(page.locator(".number-answer-input")).toHaveValue("0");
  await page.locator(".number-answer-input").press("Enter");
  await expect(page.locator("#feedbackPanel")).toContainText("✓ Верно");
  await expect(page.locator("#feedbackPanel")).toContainText("Ваш ответ: 0");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("неправильный number показывает правильный ответ и повторяется целиком", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const questionId = "hybridization-sigma-pi-004";
  await openSavedProgress(page, savedProgress(questionId, "sigma-pi"));
  await page.locator(".number-answer-input").fill("4");
  await page.locator(".number-answer-input").press("Enter");
  await expect(page.locator("#feedbackPanel")).toContainText("! Есть ошибка");
  await expect(page.locator("#feedbackPanel")).toContainText("Ваш ответ: 4");
  await expect(page.locator("#feedbackPanel")).toContainText("Правильный ответ: 5 σ-связей");
  await page.locator(".number-answer-input").press("Enter");
  await expect(page.locator("#resultPanel")).toBeVisible();
  await expect(page.locator("#resultScore")).toHaveText("0/1");
  await page.locator("#repeatMistakesButton").click();
  await expect(page.locator("#questionCounter")).toHaveText("1 / 1");
  await expect(page.locator(".number-answer-input")).toBeVisible();
  await expect(page.locator("#questionTitle")).toContainText("этена");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("Enter в режиме теста сохраняет number и завершает попытку", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const questionId = "hybridization-sigma-pi-004";
  await openSavedProgress(page, savedProgress(questionId, "sigma-pi", "test"));
  await page.locator(".number-answer-input").fill("5");
  await page.locator(".number-answer-input").press("Enter");
  await expect(page.locator("#resultPanel")).toBeVisible();
  await expect(page.locator("#resultScore")).toHaveText("1/1");
  await expect(page.locator("#reviewContainer")).toContainText("Правильный ответ: 5 σ-связей");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("режим теста не завершается с некорректным числовым вводом", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const questionId = "hybridization-sigma-pi-004";
  await openSavedProgress(page, savedProgress(questionId, "sigma-pi", "test"));
  await page.locator(".number-answer-input").fill("1,5");
  await page.locator(".number-answer-input").press("Enter");
  await expect(page.locator("#workPanel")).toBeVisible();
  await expect(page.locator("#resultPanel")).toBeHidden();
  await expect(page.locator("#questionStatus")).toContainText("Введите одно целое число");
  await expect(page.locator(".number-answer-input")).toHaveAttribute("aria-invalid", "true");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("десятичная запятая и HTML-подобный content безопасны в браузерной fixture", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const fixture = structuredClone(definition);
  const question = fixture.questions.find((item) => item.id === "hybridization-sigma-pi-004");
  question.correct = 1.5;
  question.number.integer = false;
  question.number.tolerance = 0;
  question.number.unit = "условной единицы";
  question.content.text = "<b>CH₂=CH₂</b>";
  question.content.caption = "HTML-подобная строка выводится как текст";
  fixture.variants = [{
    id: "decimal",
    title: "Десятичное число",
    questionIds: [question.id],
    selectionCount: { training: 1, test: 1 }
  }];
  fixture.questions = [question];

  await page.route("**/data/tests/hybridization-theory.json", (route) => route.fulfill({ json: fixture }));
  await page.goto("/test.html?id=hybridization-theory");
  await page.locator("#startAttemptButton").click();
  await expect(page.locator(".number-answer-input")).toHaveAttribute("inputmode", "decimal");
  await expect(page.locator(".question-content-value")).toHaveText("<b>CH₂=CH₂</b>");
  await expect(page.locator(".question-content-value b")).toHaveCount(0);
  await page.locator(".number-answer-input").pressSequentially("1,5");
  await expect(page.locator(".number-answer-input")).toBeFocused();
  await page.locator(".number-answer-input").press("Enter");
  await expect(page.locator("#feedbackPanel")).toContainText("✓ Верно");
  await expect(page.locator("#feedbackPanel")).toContainText("Ваш ответ: 1,5");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("matching новой гибридизации сохраняет построчную проверку", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const questionId = "hybridization-matching-001";
  await openSavedProgress(page, savedProgress(questionId, "matching"));
  await expect(page.locator(".matching-select")).toHaveCount(4);
  await selectUniqueMatchingAnswers(page);
  await page.locator("#primaryButton").click();
  await expect(page.locator(".matching-row-status")).toHaveCount(4);
  await expect(page.locator("#feedbackPanel")).toContainText(/Верно: \d из 4/);
  await expectNoRuntimeErrors(runtimeErrors);
});

test("формула и числовое поле не создают горизонтальную прокрутку на телефоне", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const runtimeErrors = collectRuntimeErrors(page);
  await openSavedProgress(page, savedProgress("hybridization-sigma-pi-013", "sigma-pi"));
  await expect(page.locator(".question-content-value")).toBeVisible();
  await expect(page.locator(".number-answer-input")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const height = await page.locator(".number-answer-input").evaluate((element) => element.getBoundingClientRect().height);
  expect(height).toBeGreaterThanOrEqual(44);
  await expectNoRuntimeErrors(runtimeErrors);
});

test("история гибридизации различает верные ответы и баллы", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/index.html");
  await page.evaluate(() => {
    localStorage.setItem("chem-cabinet:history:hybridization-theory", JSON.stringify([
      {
        variantId: "sigma-pi", mode: "test", completedAt: "2026-01-01T10:00:00.000Z",
        testVersion: 1, correctCount: 12, total: 15, totalQuestions: 15,
        earnedPoints: 12, maxPoints: 15, percent: 80, grade: 4, durationMs: 60_000
      },
      {
        variantId: "mixed", mode: "test", completedAt: "2026-01-02T10:00:00.000Z",
        testVersion: 1, correctCount: 12, total: 15, totalQuestions: 15,
        earnedPoints: 18, maxPoints: 21, percent: 86, grade: 4, durationMs: 60_000
      }
    ]));
  });
  await page.goto("/results.html?id=hybridization-theory");
  await expect(page.locator(".trainer-history-item")).toHaveCount(2);
  await expect(page.locator(".trainer-history-item").nth(0)).toContainText("18/21");
  await expect(page.locator(".trainer-history-item").nth(0)).toContainText("баллы");
  await expect(page.locator(".trainer-history-item").nth(1)).toContainText("12/15");
  await expect(page.locator(".trainer-history-item").nth(1)).toContainText("верно");
  await expectNoRuntimeErrors(runtimeErrors);
});
