import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { collectRuntimeErrors, expectNoRuntimeErrors } from "./helpers.js";

const definition = JSON.parse(readFileSync(
  new URL("../../data/tests/biology-foundations.json", import.meta.url),
  "utf8"
));

test("большая диагностика показывает девять вариантов, два режима и историю", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/test.html?id=biology-foundations");
  await expect(page.locator("#heroTitle")).toHaveText(
    "Большая диагностика по биологии: клетка, ткани и органы растения"
  );
  await expect(page.locator("#heroChips")).toContainText("Биология");
  await expect(page.locator('input[name="test-variant"]')).toHaveCount(9);
  await expect(page.locator('input[name="test-mode"]')).toHaveCount(2);
  await expect(page.locator("#historyLink")).toHaveAttribute(
    "href",
    "results.html?id=biology-foundations"
  );
  await expectNoRuntimeErrors(runtimeErrors);
});

test("все девять вариантов запускаются в тренировке и тесте", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  for (const variant of definition.variants) {
    for (const mode of ["training", "test"]) {
      await page.goto("/index.html");
      await page.evaluate(() =>
        localStorage.removeItem("chem-cabinet:progress:biology-foundations")
      );
      await page.goto("/test.html?id=biology-foundations");
      await page.locator(
        `input[name="test-variant"][value="${variant.id}"]`
      ).check({ force: true });
      await page.locator(
        `input[name="test-mode"][value="${mode}"]`
      ).check({ force: true });
      await page.locator("#startAttemptButton").click();
      await expect(page.locator("#workPanel")).toBeVisible();
      await expect(page.locator("#activeVariantBadge")).toHaveText(variant.title);
      const progress = await page.evaluate(() => JSON.parse(
        localStorage.getItem("chem-cabinet:progress:biology-foundations")
      ));
      expect(progress.questionOrder, `${variant.id}/${mode}`).toHaveLength(
        variant.selectionCount[mode]
      );
    }
  }
  await expectNoRuntimeErrors(runtimeErrors);
});

test("диагностика не создаёт горизонтальную прокрутку на ширине 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/test.html?id=biology-foundations");
  await page.locator('input[name="test-variant"][value="quick"]').check({ force: true });
  await page.locator("#startAttemptButton").click();
  await expect(page.locator("#workPanel")).toBeVisible();
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expectNoRuntimeErrors(runtimeErrors);
});
