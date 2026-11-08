import { test, expect } from "@playwright/test";
import { collectRuntimeErrors, expectNoRuntimeErrors } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
});

async function enterFirstAnswer(page) {
  if (await page.locator("#mainPanel .option").count()) {
    await page.locator("#mainPanel .option").first().click();
  } else if (await page.locator("#mainPanel .match-row select").count()) {
    for (const select of await page.locator("#mainPanel .match-row select").all()) {
      await select.selectOption({ index: 1 });
    }
  } else {
    await page.locator("#answerInput").fill("метан");
  }
}

test("углеводороды открываются из каталога, все четыре блока работают на телефоне", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/index.html");
  await page.locator('#organic a[href="hydrocarbons.html"]').click();
  await expect(page.getByRole("heading", { name: "Алифатические углеводороды", exact: true })).toBeVisible();
  await expect(page.locator(".topic-card")).toHaveCount(4);
  const quizStages = await page.evaluate(() => window.chemTrainer.topics.map(
    (topic) => topic.stages.findIndex((stage) => stage.kind === "quiz")
  ));
  for (let index = 0; index < 4; index += 1) {
    await page.locator(".topic-card").nth(index).click();
    await page.locator(".stage-link").nth(quizStages[index]).click();
    await expect(page.locator(".question-title")).toBeVisible();
    await enterFirstAnswer(page);
    await page.getByRole("button", { name: "Проверить ответ", exact: true }).click();
    await expect(page.locator(".feedback")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
  await page.getByRole("button", { name: /Увеличить формулы/ }).click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Кабинет учителя" }).click();
  await expect(page).toHaveURL(/\/index\.html$/);
  await expectNoRuntimeErrors(errors);
});

test("контрольная сохраняет ответы после перезагрузки и показывает разбор 24 заданий", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/hydrocarbons.html");
  await page.getByRole("tab", { name: "Контрольная", exact: true }).click();
  await page.getByRole("button", { name: "Начать контрольную →", exact: true }).click();
  await expect(page.locator(".exam-map button")).toHaveCount(24);
  await enterFirstAnswer(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("orgchem_hydrocarbon_html_v4")).exam);
  expect(Object.keys(saved.answers)).toHaveLength(1);
  await page.reload();
  await page.getByRole("tab", { name: "Контрольная", exact: true }).click();
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("orgchem_hydrocarbon_html_v4")).exam);
  expect(restored.questions).toEqual(saved.questions);
  expect(restored.answers).toEqual(saved.answers);
  for (let index = 0; index < 24; index += 1) {
    await page.locator(".exam-map button").nth(index).click();
    await expect(page.locator(".question-title")).toBeVisible();
  }
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Завершить работу", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Результаты и разбор", exact: true })).toBeVisible();
  await expect(page.locator(".review")).toHaveCount(24);
  await expect(page.locator(".breakdown")).toHaveCount(4);
  await expectNoRuntimeErrors(errors);
});

test("резервный каталог содержит ссылку на углеводороды без JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/index.html");
  await expect(page.locator('#organic a[href="hydrocarbons.html"]')).toBeVisible();
  await context.close();
});
