import {
  friendlyAuthError,
  isValidDisplayName,
  isValidLogin,
  isValidPassword,
  loginValidationMessage,
  normalizeDisplayName,
  normalizeLogin,
  passwordValidationMessage
} from "./auth-utils.js?v=10";
import {
  getAccountContext,
  getSupabaseClient,
  signInWithLogin,
  signOutAccount,
  updateAccountPassword
} from "./supabase-client.js?v=10";

const elements = Object.fromEntries([
  "pageStatus", "signedOutPanel", "signedInPanel", "loginForm", "loginStatus",
  "bootstrapForm", "bootstrapStatus", "accountRole", "accountName", "accountLogin",
  "dashboardLink", "signOutButton", "passwordForm", "passwordStatus"
].map((id) => [id, document.getElementById(id)]));

function setStatus(element, message, kind = "") {
  element.textContent = message;
  element.classList.toggle("is-error", kind === "error");
  element.classList.toggle("is-good", kind === "good");
}

function setFormBusy(form, busy) {
  [...form.elements].forEach((control) => {
    control.disabled = busy;
  });
}

async function renderAccount() {
  const context = await getAccountContext({ refresh: true });
  elements.signedOutPanel.hidden = context.signedIn;
  elements.signedInPanel.hidden = !context.signedIn;

  if (!context.signedIn) {
    setStatus(elements.pageStatus, context.online
      ? "Без входа тесты продолжают работать и сохраняются в этом браузере."
      : "Облачное хранилище временно недоступно. Тесты и локальный прогресс продолжают работать.",
    context.online ? "" : "error");
    return;
  }

  const isTeacher = context.profile.role === "teacher";
  document.title = `${context.profile.display_name} — Кабинет учителя`;
  elements.accountRole.textContent = isTeacher ? "Учитель" : "Ученик";
  elements.accountName.textContent = context.profile.display_name;
  elements.accountLogin.textContent = `Логин: ${context.profile.login_name}`;
  elements.dashboardLink.textContent = isTeacher ? "Открыть кабинет учителя" : "Открыть мои результаты";
  setStatus(elements.pageStatus, "Аккаунт подключён. Прогресс и результаты синхронизируются.", "good");
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(elements.loginForm);
  const login = normalizeLogin(form.get("login"));
  const password = String(form.get("password") || "");
  if (!isValidLogin(login)) {
    setStatus(elements.loginStatus, loginValidationMessage(login), "error");
    return;
  }
  if (!password) {
    setStatus(elements.loginStatus, "Введите пароль.", "error");
    return;
  }

  setFormBusy(elements.loginForm, true);
  setStatus(elements.loginStatus, "Выполняем вход…");
  try {
    await signInWithLogin(login, password);
    elements.loginForm.reset();
    await renderAccount();
  } catch (error) {
    setStatus(elements.loginStatus, friendlyAuthError(error), "error");
  } finally {
    setFormBusy(elements.loginForm, false);
  }
});

async function invokeBootstrap(payload) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Облачное хранилище не настроено.");
  const { data, error } = await supabase.functions.invoke("bootstrap-teacher", { body: payload });
  if (!error) return data;

  let message = error.message;
  try {
    const details = await error.context?.json();
    message = details?.error || details?.message || message;
  } catch (_) {
    // The generic SDK error remains useful when the response has no JSON body.
  }
  throw new Error(message);
}

elements.bootstrapForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(elements.bootstrapForm);
  const displayName = normalizeDisplayName(form.get("displayName"));
  const login = normalizeLogin(form.get("login"));
  const password = String(form.get("password") || "");
  const bootstrapCode = String(form.get("bootstrapCode") || "").trim();

  if (!isValidDisplayName(displayName)) {
    setStatus(elements.bootstrapStatus, "Имя должно содержать от 1 до 80 символов.", "error");
    return;
  }
  if (!isValidLogin(login)) {
    setStatus(elements.bootstrapStatus, loginValidationMessage(login), "error");
    return;
  }
  if (!isValidPassword(password)) {
    setStatus(elements.bootstrapStatus, passwordValidationMessage(password), "error");
    return;
  }
  if (!bootstrapCode) {
    setStatus(elements.bootstrapStatus, "Введите одноразовый код владельца.", "error");
    return;
  }

  setFormBusy(elements.bootstrapForm, true);
  setStatus(elements.bootstrapStatus, "Создаём защищённый аккаунт учителя…");
  try {
    await invokeBootstrap({ displayName, login, password, bootstrapCode });
    await signInWithLogin(login, password);
    elements.bootstrapForm.reset();
    await renderAccount();
  } catch (error) {
    setStatus(elements.bootstrapStatus, friendlyAuthError(error), "error");
  } finally {
    setFormBusy(elements.bootstrapForm, false);
  }
});

elements.passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(elements.passwordForm);
  const password = String(form.get("password") || "");
  const confirmation = String(form.get("confirmation") || "");
  if (!isValidPassword(password)) {
    setStatus(elements.passwordStatus, passwordValidationMessage(password), "error");
    return;
  }
  if (password !== confirmation) {
    setStatus(elements.passwordStatus, "Пароли не совпадают.", "error");
    return;
  }

  setFormBusy(elements.passwordForm, true);
  setStatus(elements.passwordStatus, "Сохраняем новый пароль…");
  try {
    await updateAccountPassword(password);
    elements.passwordForm.reset();
    setStatus(elements.passwordStatus, "Пароль изменён.", "good");
  } catch (error) {
    setStatus(elements.passwordStatus, friendlyAuthError(error), "error");
  } finally {
    setFormBusy(elements.passwordForm, false);
  }
});

elements.signOutButton.addEventListener("click", async () => {
  elements.signOutButton.disabled = true;
  try {
    await signOutAccount();
    await renderAccount();
  } catch (error) {
    setStatus(elements.pageStatus, friendlyAuthError(error), "error");
  } finally {
    elements.signOutButton.disabled = false;
  }
});

renderAccount();
