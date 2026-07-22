import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import {
  collectRuntimeErrors,
  expectNoRuntimeErrors,
  selectUniqueMatchingAnswers
} from "./helpers.js";

const definition = JSON.parse(readFileSync(
  new URL("../../data/tests/redox-trainer.json", import.meta.url),
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

test("новая версия ОВР показывает пять вариантов, два режима и памятку", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/test.html?id=redox-trainer");
  await expect(page.locator('input[name="test-variant"]')).toHaveCount(5);
  await expect(page.locator('input[name="test-mode"]')).toHaveCount(2);
  await expect(page.locator("#referencePanel")).toBeVisible();
  await expect(page.locator("#referenceList li")).toHaveCount(7);
  await expect(page.locator("#historyLink")).toHaveAttribute("href", "results.html?id=redox-trainer");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("все пять вариантов ОВР запускаются в тренировке и тесте", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  for (const variant of definition.variants) {
    for (const mode of ["training", "test"]) {
      await page.goto("/test.html?id=redox-trainer");
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

test("text принимает +6, сохраняет исходную строку и восстанавливает её после обновления", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const questionId = "redox-state-001";
  await openSavedProgress(page, savedProgress(questionId, "oxidation-states"));
  const input = page.locator(".text-answer-input");
  await expect(input).toHaveAttribute("type", "text");
  await expect(input).toHaveAttribute("autocomplete", "off");
  await expect(input).toHaveAttribute("spellcheck", "false");
  await expect(input).toHaveAttribute("maxlength", "30");
  await input.fill("  +6  ");
  await expect(input).toBeFocused();
  const saved = await page.evaluate(() => JSON.parse(
    localStorage.getItem("chem-cabinet:progress:redox-trainer")
  ));
  expect(saved.selectedAnswers[questionId]).toBe("  +6  ");

  await page.reload();
  await page.locator("#resumeButton").click();
  await expect(page.locator(".text-answer-input")).toHaveValue("  +6  ");
  await page.locator(".text-answer-input").press("Enter");
  await expect(page.locator("#feedbackPanel")).toContainText("✓ Верно");
  await expect(page.locator("#feedbackPanel")).toContainText("Ваш ответ:   +6  ");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("text принимает Unicode minus и не учитывает регистр кириллицы", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openSavedProgress(page, savedProgress("redox-state-002", "oxidation-states"));
  await page.locator(".text-answer-input").fill("−3");
  await page.locator(".text-answer-input").press("Enter");
  await expect(page.locator("#feedbackPanel")).toContainText("✓ Верно");

  await openSavedProgress(page, savedProgress("redox-agent-001", "agents"));
  await page.locator(".text-answer-input").fill("  ОКИСЛИТЕЛЬ  ");
  await page.locator(".text-answer-input").press("Enter");
  await expect(page.locator("#feedbackPanel")).toContainText("✓ Верно");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("неверный text показывает правильный ответ, печатается и повторяется с тем же ID", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.addInitScript(() => {
    window.print = () => { window.__printCalled = true; };
  });
  const questionId = "redox-state-001";
  await openSavedProgress(page, savedProgress(questionId, "oxidation-states"));
  await page.locator(".text-answer-input").fill("+4");
  await page.locator(".text-answer-input").press("Enter");
  await expect(page.locator("#feedbackPanel")).toContainText("! Есть ошибка");
  await expect(page.locator("#feedbackPanel")).toContainText("Ваш ответ: +4");
  await expect(page.locator("#feedbackPanel")).toContainText("Правильный ответ: +6");
  await page.locator(".text-answer-input").press("Enter");
  await expect(page.locator("#resultPanel")).toBeVisible();
  await expect(page.locator("#resultScore")).toHaveText("0/1");
  await expect(page.locator("#reviewContainer")).toContainText("Ваш ответ: +4");
  await expect(page.locator("#reviewContainer")).toContainText("Правильный ответ: +6");
  await expect(page.locator("#reviewContainer")).toContainText("! Ошибка");
  await page.locator("#printResultButton").click();
  expect(await page.evaluate(() => window.__printCalled)).toBe(true);

  await page.locator("#repeatMistakesButton").click();
  await expect(page.locator("#questionCounter")).toHaveText("1 / 1");
  await expect(page.locator("#questionTitle")).toContainText("серы в серной кислоте");
  await expect(page.locator(".text-answer-input")).toBeVisible();
  const retry = await page.evaluate(() => JSON.parse(
    localStorage.getItem("chem-cabinet:progress:redox-trainer")
  ));
  expect(retry.questionOrder).toEqual([questionId]);
  await expectNoRuntimeErrors(runtimeErrors);
});

test("Enter в режиме теста завершает text-попытку, а история показывает верные ответы", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const questionId = "redox-agent-001";
  await openSavedProgress(page, savedProgress(questionId, "agents", "test"));
  await page.locator(".text-answer-input").fill("окислитель");
  await page.locator(".text-answer-input").press("Enter");
  await expect(page.locator("#resultPanel")).toBeVisible();
  await expect(page.locator("#resultScore")).toHaveText("1/1");
  await expect(page.locator("#resultScoreLabel")).toHaveText("верно");
  await page.goto("/results.html?id=redox-trainer");
  await expect(page.locator(".trainer-history-item").first()).toContainText("1/1");
  await expect(page.locator(".trainer-history-item").first()).toContainText("верно");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("text не выполняет Enter во время IME composition и не допускает слишком длинный ответ", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openSavedProgress(page, savedProgress("redox-agent-001", "agents"));
  const input = page.locator(".text-answer-input");
  await input.fill("окислитель");
  await input.dispatchEvent("compositionstart");
  await input.press("Enter");
  await expect(page.locator("#feedbackPanel")).toBeHidden();
  await input.dispatchEvent("compositionend");
  await input.press("Enter");
  await expect(page.locator("#feedbackPanel")).toContainText("✓ Верно");

  await openSavedProgress(page, savedProgress(
    "redox-agent-001",
    "agents",
    "test",
    "а".repeat(31)
  ));
  await page.locator(".text-answer-input").press("Enter");
  await expect(page.locator("#workPanel")).toBeVisible();
  await expect(page.locator("#resultPanel")).toBeHidden();
  await expect(page.locator("#questionStatus")).toContainText("Допустимо не более 30 символов");
  await expect(page.locator(".text-answer-input")).toHaveAttribute("aria-invalid", "true");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("matching ОВР сохраняет построчную проверку", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const questionId = "redox-analysis-006";
  const question = questions.get(questionId);
  await openSavedProgress(page, savedProgress(questionId, "analysis"));
  await expect(page.locator(".matching-select")).toHaveCount(4);
  await selectUniqueMatchingAnswers(
    page,
    question.items.map((item) => question.correct[item.id])
  );
  await page.locator("#primaryButton").click();
  await expect(page.locator(".matching-row-status")).toHaveCount(4);
  await expect(page.locator("#feedbackPanel")).toContainText("Верно: 4 из 4");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("поле text и длинное уравнение не создают горизонтальную прокрутку на телефоне", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const runtimeErrors = collectRuntimeErrors(page);
  await openSavedProgress(page, savedProgress("redox-agent-001", "agents"));
  await expect(page.locator(".question-content-value")).toBeVisible();
  await expect(page.locator(".text-answer-input")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const height = await page.locator(".text-answer-input").evaluate((element) => element.getBoundingClientRect().height);
  expect(height).toBeGreaterThanOrEqual(44);
  await expectNoRuntimeErrors(runtimeErrors);
});
