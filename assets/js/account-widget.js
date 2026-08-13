import { getAccountContext } from "./supabase-client.js?v=9";

export async function initAccountLinks() {
  const links = [...document.querySelectorAll("[data-account-link]")];
  if (!links.length) return null;

  const context = await getAccountContext();
  links.forEach((link) => {
    link.href = context.signedIn ? "dashboard.html" : "account.html";
    link.textContent = context.signedIn
      ? `${context.profile.role === "teacher" ? "Кабинет учителя" : "Мои результаты"}`
      : "Войти";
    if (!context.online && context.configured) {
      link.title = "Облачное хранилище временно недоступно";
    }
  });
  return context;
}
