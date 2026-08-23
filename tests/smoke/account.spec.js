import { test, expect } from "@playwright/test";
import { collectRuntimeErrors, expectNoRuntimeErrors } from "./helpers.js";

test("главная показывает необязательный вход", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/index.html");
  await expect(page.locator("[data-account-link]")).toBeVisible();
  await expect(page.locator("[data-account-link]")).toHaveText("Войти");
  await expect(page.locator(".site-hero")).toContainText("аккаунт добавляет задания");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("страница входа доступна без аккаунта и проверяет логин", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/account.html");
  await expect(page.locator("#signedOutPanel")).toBeVisible();
  await expect(page.locator("#loginForm")).toBeVisible();
  await page.locator("#loginName").fill("неверный логин");
  await page.locator("#loginPassword").fill("long-password");
  await page.locator("#loginForm button[type=submit]").click();
  await expect(page.locator("#loginStatus")).toContainText("латинские буквы");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("карточки форм имеют аккуратные отступы и удобные поля", async ({ page }) => {
  await page.goto("/account.html");
  const geometry = await page.locator("#signedOutPanel .account-card").first().evaluate((card) => {
    const field = card.querySelector("input");
    const cardBox = card.getBoundingClientRect();
    const fieldBox = field.getBoundingClientRect();
    const cardStyle = getComputedStyle(card);
    return {
      paddingLeft: Number.parseFloat(cardStyle.paddingLeft),
      fieldHeight: fieldBox.height,
      leftInset: fieldBox.left - cardBox.left,
      rightInset: cardBox.right - fieldBox.right
    };
  });

  expect(geometry.paddingLeft).toBeGreaterThanOrEqual(22);
  expect(geometry.fieldHeight).toBeGreaterThanOrEqual(50);
  expect(geometry.leftInset).toBeGreaterThanOrEqual(22);
  expect(geometry.rightInset).toBeGreaterThanOrEqual(22);
  await expect(page.locator("#loginName")).toHaveAttribute("placeholder", /anton\.efremov/);
});

test("кабинет без сессии предлагает перейти ко входу", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/dashboard.html");
  await expect(page.locator("#dashboardError")).toBeVisible();
  await expect(page.locator("#dashboardError")).toContainText("Сначала войдите");
  await expect(page.locator("#dashboardError a")).toHaveAttribute("href", "account.html");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("кабинет содержит интерфейс выдачи и получения работ", async ({ page }) => {
  await page.goto("/dashboard.html");
  await expect(page.locator("#assignmentForm")).toHaveCount(1);
  await expect(page.locator("#assignmentClassroom")).toHaveCount(1);
  await expect(page.locator("#assignmentTest")).toHaveCount(1);
  await expect(page.locator("#assignmentVariant")).toHaveCount(1);
  await expect(page.locator("#assignmentMode")).toHaveCount(1);
  await expect(page.locator("#assignmentDueAt")).toHaveAttribute("type", "datetime-local");
  await expect(page.locator("#studentAssignmentList")).toHaveCount(1);
  await expect(page.locator("#teacherPanel a[href='textbooks.html']")).toHaveText("Открыть реестр");
  await expect(page.locator("#studentPanel a[href='textbooks.html']")).toHaveCount(0);
});

test("тренажёр без входа сохраняет локальный режим", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/test.html?id=biology-matching");
  await expect(page.locator("#setupPanel")).toBeVisible();
  await expect(page.locator("#cloudStatus")).toContainText("Войдите");
  await page.locator("#startAttemptButton").click();
  await expect(page.locator("#workPanel")).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem("chem-cabinet:progress:biology-matching"));
  expect(stored).not.toBeNull();
  await expectNoRuntimeErrors(runtimeErrors);
});

test("назначенная работа проверяет параметр и требует аккаунт ученика", async ({ page }) => {
  await page.goto("/test.html?id=organic-review&assignment=broken");
  await expect(page.locator("#errorPanel")).toContainText("положительным целым числом");

  await page.goto("/test.html?id=organic-review&assignment=1");
  await expect(page.locator("#errorPanel")).toContainText("нужен аккаунт ученика");
});

test("страницы аккаунта не создают горизонтальную прокрутку на 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of ["/account.html", "/dashboard.html"]) {
    await page.goto(path);
    const layout = await page.evaluate(() => {
      const brandBox = document.querySelector(".site-brand").getBoundingClientRect();
      const navBox = document.querySelector(".site-nav").getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        headerGap: navBox.left - brandBox.right
      };
    });
    expect(layout.overflow, path).toBeLessThanOrEqual(1);
    expect(layout.headerGap, path).toBeGreaterThanOrEqual(0);
  }
});
