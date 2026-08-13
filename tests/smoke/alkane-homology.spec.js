import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import {
  collectRuntimeErrors,
  expectNoRuntimeErrors,
  selectUniqueMatchingAnswers
} from "./helpers.js";

const definition = JSON.parse(readFileSync(
  new URL("../../data/tests/alkane-homology.json", import.meta.url),
  "utf8"
));
const questions = new Map(definition.questions.map((question) => [question.id, question]));

function optionOrder(question) {
  if (question.type === "matching") return question.options.map((option) => option.id);
  if (question.type === "sequence") return question.items.map((item) => item.id);
  if (question.type === "single" || question.type === "multiple") {
    return question.options.map((_, index) => index);
  }
  return [];
}

function savedProgress({
  questionIds,
  variantId,
  mode = "training",
  answers = {},
  currentQuestionId = questionIds[0],
  optionOrders = {}
}) {
  const variant = definition.variants.find((item) => item.id === variantId);
  return {
    schemaVersion: 1,
    testId: definition.id,
    testVersion: definition.version,
    attemptId: `smoke-${currentQuestionId}`,
    variantId,
    mode,
    currentQuestion: questionIds.indexOf(currentQuestionId),
    currentQuestionId,
    baseQuestionIds: variant.questionIds,
    questionIds,
    questionOrder: questionIds,
    optionOrder: Object.fromEntries(questionIds.map((questionId) => [
      questionId,
      optionOrders[questionId] || optionOrder(questions.get(questionId))
    ])),
    selectedAnswers: answers,
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

test("новая гомология показывает 13 вариантов, два режима, памятку и историю", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/test.html?id=alkane-homology");
  await expect(page.locator('input[name="test-variant"]')).toHaveCount(13);
  await expect(page.locator('input[name="test-mode"]')).toHaveCount(2);
  await expect(page.locator("#referencePanel")).toBeVisible();
  await expect(page.locator("#referenceList li")).toHaveCount(6);
  await expect(page.locator("#historyLink")).toHaveAttribute("href", "results.html?id=alkane-homology");

  await page.goto("/results.html?id=alkane-homology");
  await expect(page.locator("#historyPanel")).toBeVisible();
  await expect(page.locator("#historyTestTitle")).toHaveText("Гомология алканов");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("все 13 вариантов запускаются в тренировке и тесте с объёмом 10/15", async ({ page }) => {
  test.setTimeout(70_000);
  const runtimeErrors = collectRuntimeErrors(page);
  for (const variant of definition.variants) {
    for (const mode of ["training", "test"]) {
      await page.goto("/test.html?id=alkane-homology");
      await page.locator(`input[name="test-variant"][value="${variant.id}"]`).check({ force: true });
      await page.locator(`input[name="test-mode"][value="${mode}"]`).check({ force: true });
      await page.locator("#startAttemptButton").click();
      await expect(page.locator("#workPanel")).toBeVisible();
      await expect(page.locator("#activeVariantBadge")).toHaveText(variant.title);
      await expect(page.locator("#activeModeBadge")).toHaveText(mode === "training" ? "Тренировка" : "Тест");
      const progress = await page.evaluate(() => JSON.parse(
        localStorage.getItem("chem-cabinet:progress:alkane-homology")
      ));
      expect(progress.questionOrder, `${variant.id}/${mode}`).toHaveLength(mode === "training" ? 10 : 15);
      if (variant.id === "sequence") {
        const initialAnswer = progress.selectedAnswers[progress.questionOrder[0]];
        expect(initialAnswer.order).toHaveLength(4);
        expect(new Set(initialAnswer.order).size).toBe(4);
        expect(initialAnswer.touched).toBe(false);
      }
    }
  }
  await expectNoRuntimeErrors(runtimeErrors);
});

test("sequence управляется кнопками, сохраняет focus и точно восстанавливает порядок", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const question = questions.get("alkane-sequence-001");
  const initialOrder = question.items.map((item) => item.id);
  await openSavedProgress(page, savedProgress({
    questionIds: [question.id],
    variantId: "sequence",
    optionOrders: { [question.id]: initialOrder }
  }));

  await expect(page.locator(".sequence-item")).toHaveCount(4);
  await expect(page.locator(".sequence-move-button")).toHaveCount(8);
  await expect(page.locator(".sequence-item").first().locator(".sequence-move-button").first()).toBeDisabled();
  await expect(page.locator(".sequence-item").last().locator(".sequence-move-button").last()).toBeDisabled();

  const firstItem = question.items[0];
  await page.getByRole("button", { name: `Переместить ${firstItem.text} ниже` }).click();
  await expect(page.locator(`[data-focus-key="sequence-${firstItem.id}-item"]`)).toBeFocused();
  await expect(page.locator("#questionStatus")).toHaveText("Порядок обновлён");

  await page.getByRole("button", { name: `Переместить ${firstItem.text} выше` }).click();
  await expect(page.locator(`[data-focus-key="sequence-${firstItem.id}-item"]`)).toBeFocused();
  await page.getByRole("button", { name: `Переместить ${firstItem.text} ниже` }).click();

  const saved = await page.evaluate(() => JSON.parse(
    localStorage.getItem("chem-cabinet:progress:alkane-homology")
  ));
  expect(saved.selectedAnswers[question.id]).toEqual({
    order: [initialOrder[1], initialOrder[0], initialOrder[2], initialOrder[3]],
    touched: true
  });

  await page.reload();
  await page.locator("#resumeButton").click();
  const restoredOrder = await page.locator(".sequence-item").evaluateAll((items) =>
    items.map((item) => item.dataset.itemId)
  );
  expect(restoredOrder).toEqual(saved.selectedAnswers[question.id].order);
  await expectNoRuntimeErrors(runtimeErrors);
});

test("частичный sequence даёт 2/4, печатается и целиком попадает в повтор ошибок", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.addInitScript(() => {
    window.print = () => { window.__printCalled = true; };
  });
  const question = questions.get("alkane-sequence-002");
  const [a, b, c, d] = question.correct;
  const answer = { order: [a, c, b, d], touched: true };
  await openSavedProgress(page, savedProgress({
    questionIds: [question.id],
    variantId: "sequence",
    answers: { [question.id]: answer },
    optionOrders: { [question.id]: answer.order }
  }));

  await page.locator("#primaryButton").click();
  await expect(page.locator("#feedbackPanel")).toContainText("! Есть ошибки");
  await expect(page.locator("#feedbackPanel")).toContainText("Правильно расположено: 2 из 4");
  await expect(page.locator("#questionStatus")).toHaveText("! Ответ проверен: 2 из 4 позиций");
  await expect(page.locator(".sequence-position-status")).toHaveCount(4);

  await page.locator("#primaryButton").click();
  await expect(page.locator("#resultPanel")).toBeVisible();
  await expect(page.locator("#resultScore")).toHaveText("2/4");
  await expect(page.locator("#reviewContainer")).toContainText("Ваш порядок:");
  await expect(page.locator("#reviewContainer")).toContainText("Правильный порядок:");
  await expect(page.locator("#reviewContainer")).toContainText("Результат: 2 из 4 позиций");
  await page.locator("#printResultButton").click();
  expect(await page.evaluate(() => window.__printCalled)).toBe(true);

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#reviewContainer")).toContainText("→");
  await page.emulateMedia({ media: "screen" });
  await page.locator("#repeatMistakesButton").click();
  await expect(page.locator("#questionCounter")).toHaveText("1 / 1");
  await expect(page.locator("#questionTitle")).toContainText(question.text);
  await expect(page.locator(".sequence-item")).toHaveCount(4);
  await expectNoRuntimeErrors(runtimeErrors);
});

test("правильный sequence даёт полный балл и все четыре верные позиции", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const question = questions.get("alkane-sequence-003");
  const answer = { order: [...question.correct], touched: true };
  await openSavedProgress(page, savedProgress({
    questionIds: [question.id],
    variantId: "sequence",
    answers: { [question.id]: answer },
    optionOrders: { [question.id]: answer.order }
  }));
  await page.locator("#primaryButton").click();
  await expect(page.locator("#feedbackPanel")).toContainText("✓ Верно");
  await expect(page.locator("#feedbackPanel")).toContainText("Все 4 позиции расположены правильно");
  await expect(page.locator(".sequence-item.is-correct")).toHaveCount(4);
  await page.locator("#primaryButton").click();
  await expect(page.locator("#resultScore")).toHaveText("4/4");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("matching, number и single работают в тематических вариантах", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);

  const matching = questions.get("alkane-matching-001");
  await openSavedProgress(page, savedProgress({
    questionIds: [matching.id],
    variantId: "matching"
  }));
  await selectUniqueMatchingAnswers(page, matching.items.map((item) => matching.correct[item.id]));
  await page.locator("#primaryButton").click();
  await expect(page.locator("#feedbackPanel")).toContainText("✓ Верно");
  await expect(page.locator(".matching-row.is-correct")).toHaveCount(4);

  const number = questions.get("alkane-steps-001");
  await openSavedProgress(page, savedProgress({
    questionIds: [number.id],
    variantId: "steps"
  }));
  await page.locator(".number-answer-input").fill(String(number.correct));
  await page.locator("#primaryButton").click();
  await expect(page.locator("#feedbackPanel")).toContainText("✓ Верно");

  const single = questions.get("alkane-neighbor-001");
  await openSavedProgress(page, savedProgress({
    questionIds: [single.id],
    variantId: "neighbor"
  }));
  await page.locator(`input[type="radio"][value="${single.correct[0]}"]`).check();
  await page.locator("#primaryButton").click();
  await expect(page.locator("#feedbackPanel")).toContainText("✓ Верно");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("смешанный максимум вычисляется по фактическим типам вопросов", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const selected = [
    questions.get("alkane-neighbor-001"),
    questions.get("alkane-steps-001"),
    questions.get("alkane-matching-001"),
    questions.get("alkane-sequence-001")
  ];
  const answers = {
    [selected[0].id]: selected[0].correct,
    [selected[1].id]: String(selected[1].correct),
    [selected[2].id]: selected[2].correct,
    [selected[3].id]: { order: selected[3].correct, touched: true }
  };
  await openSavedProgress(page, savedProgress({
    questionIds: selected.map((question) => question.id),
    variantId: "mixed",
    mode: "test",
    answers,
    currentQuestionId: selected[3].id
  }));
  await page.locator("#primaryButton").click();
  await expect(page.locator("#resultPanel")).toBeVisible();
  await expect(page.locator("#resultScore")).toHaveText("10/10");
  await expect(page.locator("#reviewContainer .trainer-review-item")).toHaveCount(4);
  await expectNoRuntimeErrors(runtimeErrors);
});

test("sequence на ширине 360 px не создаёт горизонтальную прокрутку", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const runtimeErrors = collectRuntimeErrors(page);
  const question = questions.get("alkane-sequence-015");
  await openSavedProgress(page, savedProgress({
    questionIds: [question.id],
    variantId: "sequence"
  }));
  await expect(page.locator(".sequence-item")).toHaveCount(4);
  await expect(page.locator(".sequence-text.is-formula")).toHaveCount(4);
  const buttonSizes = await page.locator(".sequence-move-button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { width: box.width, height: box.height };
    })
  );
  expect(buttonSizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  )).toBe(true);
  await expectNoRuntimeErrors(runtimeErrors);
});
