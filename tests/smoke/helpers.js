import { expect } from "@playwright/test";

export function collectRuntimeErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

export async function expectNoRuntimeErrors(errors) {
  await expect(errors, errors.join("\n")).toEqual([]);
}

export async function startDefaultAttempt(page) {
  await expect(page.locator("#setupPanel")).toBeVisible();
  await page.locator("#startAttemptButton").click();
  await expect(page.locator("#workPanel")).toBeVisible();
}

export async function selectUniqueMatchingAnswers(page, preferred = null) {
  const values = [];
  const count = await page.locator(".matching-select").count();
  for (let index = 0; index < count; index += 1) {
    const select = page.locator(".matching-select").nth(index);
    const available = await select.locator("option").evaluateAll((options) =>
      options.filter((option) => option.value && !option.disabled).map((option) => option.value)
    );
    const wanted = preferred?.[index];
    const value = wanted && available.includes(wanted) ? wanted : available[0];
    if (!value) throw new Error(`Для строки ${index + 1} не найден доступный вариант.`);
    await select.selectOption(value);
    values.push(value);
  }
  return values;
}
