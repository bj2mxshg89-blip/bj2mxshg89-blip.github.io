import { test, expect } from "@playwright/test";
import { collectRuntimeErrors, expectNoRuntimeErrors } from "./helpers.js";

test("главная показывает необязательный вход", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/index.html");
  await expect(page.locator("[data-account-link]")).toBeVisible();
  await expect(page.locator("[data-account-link]")).toHaveText("Войти");
  await expect(page.locator(".site-hero")).toContainText("аккаунт добавляет синхронизацию");
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

test("кабинет без сессии предлагает перейти ко входу", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto("/dashboard.html");
  await expect(page.locator("#dashboardError")).toBeVisible();
  await expect(page.locator("#dashboardError")).toContainText("Сначала войдите");
  await expect(page.locator("#dashboardError a")).toHaveAttribute("href", "account.html");
  await expectNoRuntimeErrors(runtimeErrors);
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

test("страницы аккаунта не создают горизонтальную прокрутку на 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of ["/account.html", "/dashboard.html"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
