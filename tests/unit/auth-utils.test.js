import test from "node:test";
import assert from "node:assert/strict";
import {
  friendlyAuthError,
  isValidDisplayName,
  isValidLogin,
  isValidPassword,
  loginToEmail,
  normalizeDisplayName,
  normalizeLogin
} from "../../assets/js/auth-utils.js";

test("логин нормализуется и преобразуется во внутренний адрес", () => {
  assert.equal(normalizeLogin("  Student.7  "), "student.7");
  assert.equal(loginToEmail("Student.7"), "student.7@accounts.chem-cabinet.invalid");
});

test("логин принимает только безопасный ограниченный алфавит", () => {
  assert.equal(isValidLogin("teacher_demo"), true);
  assert.equal(isValidLogin("a-b.c_7"), true);
  assert.equal(isValidLogin("абв"), false);
  assert.equal(isValidLogin("-student"), false);
  assert.equal(isValidLogin("ab"), false);
  assert.equal(isValidLogin("student@example.com"), false);
});

test("имя хранится как отображаемая строка без лишних пробелов", () => {
  assert.equal(normalizeDisplayName("  Анна   П. "), "Анна П.");
  assert.equal(isValidDisplayName("Ученик 7"), true);
  assert.equal(isValidDisplayName(" "), false);
  assert.equal(isValidDisplayName("а".repeat(81)), false);
});

test("пароль требует 10–72 символа", () => {
  assert.equal(isValidPassword("long-pass-1"), true);
  assert.equal(isValidPassword("short"), false);
  assert.equal(isValidPassword("x".repeat(73)), false);
});

test("ошибки входа переводятся в понятные сообщения", () => {
  assert.equal(friendlyAuthError(new Error("Invalid login credentials")), "Неверный логин или пароль.");
  assert.match(friendlyAuthError(new Error("Failed to fetch")), /Нет связи/);
});
