import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
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

test("реестр перенаправляет гостя на вход, а ученика — в кабинет", async ({ page }) => {
  await mockAccount(page, "signed-out");
  await page.goto("/textbooks.html");
  await expect(page).toHaveURL(/\/account\.html$/);

  await page.unroute(supabaseClientRoute);
  await mockAccount(page, "student");
  await page.goto("/textbooks.html");
  await expect(page).toHaveURL(/\/dashboard\.html$/);
});

test("ссылка на реестр видна в кабинете учителя и отсутствует в панели ученика", async ({ page }) => {
  await mockAccount(page, "teacher");
  await page.goto("/dashboard.html");
  await expect(page.locator("#teacherPanel")).toBeVisible();
  await expect(page.locator("#textbookRegistryCard")).toContainText("Учёт учебников, выданных ученикам");
  await expect(page.locator("#textbookRegistryCard a")).toHaveAttribute("href", "textbooks.html");
  await expect(page.locator("#studentPanel a[href='textbooks.html']")).toHaveCount(0);
});

test("учитель управляет учениками, учебниками и текущей выдачей", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await mockAccount(page, "teacher");
  await page.goto("/textbooks.html");
  await expect(page.locator("#registryApp")).toBeVisible();
  await expect(page.locator("#registryList")).toContainText("Иванов Максим");
  await expect(page.locator("#registryList")).toContainText("Биология, 8 класс");

  await page.locator("#registrySearch").fill("Петрова");
  await expect(page.locator("#registryList")).toContainText("Петрова Анна");
  await expect(page.locator("#registryList")).not.toContainText("Иванов Максим");
  await page.locator("#registrySearch").fill("");

  await page.locator("#studentsTab").click();
  await page.locator("#registryLastName").fill("Сидоров");
  await page.locator("#registryFirstName").fill("Алексей");
  await page.locator("#registryStudentForm button[type=submit]").click();
  await expect(page.locator("#studentFormStatus")).toContainText("Ученик добавлен");
  await expect(page.locator("#studentsList")).toContainText("Сидоров Алексей");

  await page.locator("#bulkStudents").fill("Орлова Елена\nКим Ирина");
  await page.locator("#bulkStudentsForm button[type=submit]").click();
  await expect(page.locator("#bulkStudentsStatus")).toContainText("Добавлено учеников: 2");
  await expect(page.locator("#studentsList")).toContainText("Орлова Елена");

  await page.locator("#textbooksTab").click();
  await page.locator("#registryTextbookTitle").fill("География, 8 класс");
  await page.locator("#registryTextbookQuantity").fill("1");
  await page.locator("#registryTextbookForm button[type=submit]").click();
  await expect(page.locator("#textbookFormStatus")).toContainText("Учебник добавлен");
  await expect(page.locator("#textbooksList")).toContainText("География, 8 класс");

  await page.locator("#quickStudent").selectOption({ label: "Петрова Анна" });
  const geographyOption = page.locator("#quickTextbook option").filter({ hasText: "География, 8 класс" });
  await page.locator("#quickTextbook").selectOption(await geographyOption.getAttribute("value"));
  await page.locator("#quickLoanForm button[type=submit]").click();
  await expect(page.locator("#quickLoanStatus")).toContainText("Учебник выдан");

  await page.locator("#registryTab").click();
  const petrova = page.locator(".textbooks-person").filter({ hasText: "Петрова Анна" });
  await expect(petrova).toContainText("География, 8 класс");
  await petrova.getByRole("button", { name: "Изменить выдачу" }).click();
  await expect(page.locator("#loanDialog")).toBeVisible();
  const geography = page.locator("#loanDialogList .textbooks-check-row").filter({ hasText: "География, 8 класс" }).locator("input");
  await expect(geography).toBeChecked();
  await geography.uncheck();
  await expect(page.locator("#loanDialogStatus")).toContainText("Учебник возвращён");
  await page.locator("#loanDialog button[value=close]").click();

  await page.locator("#textbooksTab").click();
  const biology = page.locator(".textbooks-book").filter({ hasText: "Биология, 8 класс" });
  await biology.getByRole("button", { name: "Раздать" }).click();
  const sidorov = page.locator("#loanDialogList .textbooks-check-row").filter({ hasText: "Сидоров Алексей" }).locator("input");
  await sidorov.check();
  await expect(page.locator("#loanDialogDescription")).toContainText("Выдано 2 из 2");
  const orlova = page.locator("#loanDialogList .textbooks-check-row").filter({ hasText: "Орлова Елена" }).locator("input");
  await expect(orlova).toBeDisabled();
  await page.locator("#loanDialog button[value=close]").click();

  await page.reload();
  await expect(page.locator("#registryApp")).toBeVisible();
  await expect(page.locator("#registryList")).toContainText("Сидоров Алексей");
  await expect(page.locator("#registryList")).toContainText("Биология, 8 класс");

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#studentsTab").click();
  const kim = page.locator(".textbooks-student-row").filter({ hasText: "Ким Ирина" });
  await kim.getByRole("button", { name: "Удалить" }).click();
  await expect(page.locator("#studentsList")).not.toContainText("Ким Ирина");

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#textbooksTab").click();
  const geographyBook = page.locator(".textbooks-book").filter({ hasText: "География, 8 класс" });
  await geographyBook.getByRole("button", { name: "Удалить" }).click();
  await expect(page.locator("#textbooksList")).not.toContainText("География, 8 класс");
  await expectNoRuntimeErrors(runtimeErrors);
});

test("реестр не создаёт горизонтальную прокрутку на ширине 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await mockAccount(page, "teacher");
  await page.goto("/textbooks.html");
  await expect(page.locator("#registryApp")).toBeVisible();
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    minButton: Math.min(...[...document.querySelectorAll("button:not([hidden])")]
      .filter((button) => button.getBoundingClientRect().width > 0 && button.getBoundingClientRect().height > 0)
      .map((button) => Math.min(button.getBoundingClientRect().width, button.getBoundingClientRect().height)))
  }));
  expect(layout.overflow).toBeLessThanOrEqual(1);
  expect(layout.minButton).toBeGreaterThanOrEqual(43);
});
