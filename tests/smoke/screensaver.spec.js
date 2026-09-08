import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { biologyCardPairs } from "../../assets/js/screensaver-biology-cards.js";
import { collectRuntimeErrors, expectNoRuntimeErrors } from "./helpers.js";

const mockSource = await readFile(new URL("./fixtures/supabase-client.mock.js", import.meta.url), "utf8");
const supabaseClientRoute = /\/assets\/js\/supabase-client\.js\?v=\d+$/;

async function mockAccount(page, role) {
  await page.route(supabaseClientRoute, (route) => {
    route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: mockSource.replaceAll("__ROLE__", role)
    });
  });
}

async function chooseOnlyBiologyGrade(page, grade) {
  await page.locator('input[name="subject"][value="chemistry"]').uncheck({ force: true });
  await page.locator('input[name="subject"][value="geography"]').uncheck({ force: true });
  await page.locator(`input[name="biologyGrade"][value="${grade === 5 ? 6 : 5}"]`).uncheck({ force: true });
}

test("заставка перенаправляет гостя и ученика", async ({ page }) => {
  await mockAccount(page, "signed-out");
  await page.goto("/screensaver.html");
  await expect(page).toHaveURL(/\/account\.html$/);

  await page.unroute(supabaseClientRoute);
  await mockAccount(page, "student");
  await page.goto("/screensaver.html");
  await expect(page).toHaveURL(/\/dashboard\.html$/);
});

for (const grade of [5, 6]) {
  test(`учитель запускает отдельный набор биологии ${grade} класса`, async ({ page }) => {
    const expectedQuestions = new Set(
      biologyCardPairs.filter((card) => card.grade === grade).map((card) => card.question)
    );
    const runtimeErrors = collectRuntimeErrors(page);
    await mockAccount(page, "teacher");
    await page.goto("/screensaver.html");
    await expect(page.locator("#launcher")).toBeVisible();
    await chooseOnlyBiologyGrade(page, grade);
    await page.locator("#settingsForm").evaluate((form) => form.requestSubmit());
    await expect(page.locator("#show")).toBeVisible();

    const seenQuestions = new Set();
    for (let index = 0; index < 90; index += 1) {
      const question = await page.locator("#slideText").textContent();
      expect(expectedQuestions.has(question)).toBe(true);
      seenQuestions.add(question);
      await expect(page.locator("#slideImage")).toHaveAttribute("src", /bio/);
      if (index < 89) await page.locator('[data-action="next"]').evaluate((button) => button.click());
    }
    expect(seenQuestions.size).toBe(expectedQuestions.size);
    await expectNoRuntimeErrors(runtimeErrors);
  });
}

test("все вопросы и ответы биологии помещаются на экран доски", async ({ page }) => {
  test.setTimeout(60_000);
  await mockAccount(page, "teacher");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/screensaver.html");
  await page.locator('input[name="subject"][value="chemistry"]').uncheck({ force: true });
  await page.locator('input[name="subject"][value="geography"]').uncheck({ force: true });
  await page.locator("#settingsForm").evaluate((form) => form.requestSubmit());
  await expect(page.locator("#show")).toBeVisible();

  async function expectCurrentTextFits() {
    const result = await page.locator("#slideText").evaluate(async (text) => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const copy = text.closest(".screensaver-copy");
      const textBox = text.getBoundingClientRect();
      const copyBox = copy.getBoundingClientRect();
      return {
        value: text.textContent,
        fitsHeight: copy.scrollHeight <= copy.clientHeight + 1,
        fitsWidth: text.scrollWidth <= copy.clientWidth + 1,
        inside: textBox.top >= copyBox.top - 1 && textBox.bottom <= copyBox.bottom + 1
      };
    });
    expect(result.fitsHeight, result.value).toBe(true);
    expect(result.fitsWidth, result.value).toBe(true);
    expect(result.inside, result.value).toBe(true);
  }

  for (let index = 0; index < biologyCardPairs.length; index += 1) {
    await expectCurrentTextFits();
    const imageReady = await page.locator("#slideImage").evaluate((image) => image.complete && image.naturalWidth > 0);
    expect(imageReady).toBe(true);
    await page.locator('[data-action="reveal"]').evaluate((button) => button.click());
    await expectCurrentTextFits();
    if (index < biologyCardPairs.length - 1) {
      await page.locator('[data-action="next"]').evaluate((button) => button.click());
    }
  }
});

test("для выбранной биологии требуется хотя бы один класс", async ({ page }) => {
  await mockAccount(page, "teacher");
  await page.goto("/screensaver.html");
  await page.locator('input[name="biologyGrade"]').evaluateAll((inputs) => {
    inputs.forEach((input) => { input.checked = false; });
  });
  await page.locator("#settingsForm").evaluate((form) => form.requestSubmit());
  await expect(page.locator("#settingsError")).toHaveText("Выберите хотя бы один класс биологии.");
  await expect(page.locator("#launcher")).toBeVisible();
});

test("выбор классов отключается вместе с предметом", async ({ page }) => {
  await mockAccount(page, "teacher");
  await page.goto("/screensaver.html");
  await page.locator('input[name="subject"][value="biology"]').uncheck({ force: true });
  await expect(page.locator("#biologyGradeFieldset")).toHaveAttribute("disabled", "");
});

test("выбранный класс сохраняется после перезагрузки", async ({ page }) => {
  await mockAccount(page, "teacher");
  await page.goto("/screensaver.html");
  await chooseOnlyBiologyGrade(page, 5);
  await page.locator("#settingsForm").evaluate((form) => form.requestSubmit());
  await expect(page.locator("#show")).toBeVisible();
  await page.reload();
  await expect(page.locator('input[name="biologyGrade"][value="5"]')).toBeChecked();
  await expect(page.locator('input[name="biologyGrade"][value="6"]')).not.toBeChecked();
});

test("настройка классов помещается на экран шириной 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await mockAccount(page, "teacher");
  await page.goto("/screensaver.html");
  await expect(page.locator("#launcher")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
