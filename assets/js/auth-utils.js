import { backendConfig } from "./backend-config.js?v=9";

const LOGIN_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizeLogin(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidLogin(value) {
  return LOGIN_PATTERN.test(normalizeLogin(value));
}

export function loginValidationMessage(value) {
  const login = normalizeLogin(value);
  if (!login) return "Введите логин.";
  if (login.length < 3 || login.length > 32) return "Логин должен содержать от 3 до 32 символов.";
  return "Используйте латинские буквы, цифры, точку, дефис или подчёркивание; начните с буквы или цифры.";
}

export function loginToEmail(value) {
  const login = normalizeLogin(value);
  if (!isValidLogin(login)) throw new Error(loginValidationMessage(login));
  return `${login}@${backendConfig.accountEmailDomain}`;
}

export function normalizeDisplayName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function isValidDisplayName(value) {
  const normalized = normalizeDisplayName(value);
  return normalized.length >= 1 && normalized.length <= 80;
}

export function passwordValidationMessage(value) {
  if (typeof value !== "string" || value.length < 10) return "Пароль должен содержать не менее 10 символов.";
  if (value.length > 72) return "Пароль должен содержать не более 72 символов.";
  return "";
}

export function isValidPassword(value) {
  return passwordValidationMessage(value) === "";
}

export function friendlyAuthError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  if (message.includes("invalid login credentials")) return "Неверный логин или пароль.";
  if (message.includes("email not confirmed")) return "Аккаунт ещё не активирован.";
  if (message.includes("user already registered") || message.includes("already been registered")) {
    return "Такой логин уже занят.";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Нет связи с облачным хранилищем. Проверьте интернет-соединение.";
  }
  return error?.message || "Не удалось выполнить операцию. Попробуйте ещё раз.";
}
