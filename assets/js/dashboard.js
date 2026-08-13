import { loadCatalog, visibleCatalogItems } from "./catalog.js?v=9";
import { formatDateTime } from "./utils.js?v=9";
import {
  friendlyAuthError,
  isValidDisplayName,
  isValidLogin,
  isValidPassword,
  loginValidationMessage,
  normalizeDisplayName,
  normalizeLogin,
  passwordValidationMessage
} from "./auth-utils.js?v=9";
import { getAccountContext, getSupabaseClient } from "./supabase-client.js?v=9";
import {
  formatTrend,
  groupAttemptsByUser,
  sortAttemptsNewestFirst,
  summarizeAttempts
} from "./dashboard-records.js?v=9";

const elements = Object.fromEntries([
  "dashboardRole", "dashboardTitle", "dashboardDescription", "dashboardLoading", "dashboardError",
  "dashboardErrorText", "studentPanel", "studentMetrics", "studentAttemptList", "studentClassList",
  "teacherPanel", "classroomForm", "classroomStatus", "studentForm", "studentClassroom",
  "studentStatus", "credentialsCard", "createdLogin", "createdPassword", "teacherClassList"
].map((id) => [id, document.getElementById(id)]));

let account = null;
let classrooms = [];
let testTitles = new Map();

function node(tag, className = "", text = "") {
  const item = document.createElement(tag);
  if (className) item.className = className;
  item.textContent = text;
  return item;
}

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

function testTitle(testId) {
  return testTitles.get(testId) || testId;
}

function empty(message) {
  return node("div", "account-empty", message);
}

function metric(value, label) {
  const item = node("div", "account-metric");
  item.append(node("strong", "", String(value)), node("span", "", label));
  return item;
}

function renderMetrics(container, attempts) {
  const summary = summarizeAttempts(attempts);
  container.replaceChildren(
    metric(summary.count, "завершённых попыток"),
    metric(`${summary.average}%`, "средний результат"),
    metric(`${summary.best}%`, "лучший результат"),
    metric(formatTrend(summary.trend), "изменение к прошлой попытке")
  );
}

function renderAttemptList(container, attempts, limit = 20) {
  const ordered = sortAttemptsNewestFirst(attempts).slice(0, limit);
  container.replaceChildren();
  if (!ordered.length) {
    container.append(empty("Завершённых попыток пока нет."));
    return;
  }
  ordered.forEach((attempt) => {
    const item = node("article", "account-attempt");
    const main = node("div");
    const link = node("a", "trainer-history-link", testTitle(attempt.test_id));
    link.href = `results.html?id=${encodeURIComponent(attempt.test_id)}`;
    const meta = node("small", "", `${formatDateTime(attempt.completed_at)} · оценка ${attempt.grade}`);
    main.append(link, meta);
    item.append(main, node("div", "account-attempt-score", `${attempt.percent}%`));
    container.append(item);
  });
}

async function loadStudentDashboard() {
  const supabase = getSupabaseClient();
  const [attemptResult, memberResult] = await Promise.all([
    supabase.from("attempts")
      .select("test_id, variant_id, mode, completed_at, percent, grade, earned_points, max_points")
      .order("completed_at", { ascending: false }),
    supabase.from("classroom_members")
      .select("classroom_id, joined_at")
      .eq("student_id", account.user.id)
  ]);
  if (attemptResult.error) throw attemptResult.error;
  if (memberResult.error) throw memberResult.error;

  const classIds = memberResult.data.map((item) => item.classroom_id);
  let studentClasses = [];
  if (classIds.length) {
    const { data, error } = await supabase.from("classrooms")
      .select("id, title")
      .in("id", classIds)
      .order("title");
    if (error) throw error;
    studentClasses = data;
  }

  renderMetrics(elements.studentMetrics, attemptResult.data);
  renderAttemptList(elements.studentAttemptList, attemptResult.data);
  elements.studentClassList.replaceChildren();
  if (!studentClasses.length) {
    elements.studentClassList.append(empty("Аккаунт ещё не добавлен ни в один класс."));
  } else {
    studentClasses.forEach((classroom) => {
      const item = node("div", "account-class-item");
      item.append(node("strong", "", classroom.title), node("small", "", "Учебная группа"));
      elements.studentClassList.append(item);
    });
  }

  elements.studentPanel.hidden = false;
}

function renderClassroomSelect() {
  elements.studentClassroom.replaceChildren();
  if (!classrooms.length) {
    const option = node("option", "", "Сначала создайте класс");
    option.value = "";
    elements.studentClassroom.append(option);
    elements.studentClassroom.disabled = true;
    elements.studentForm.querySelector("button[type=submit]").disabled = true;
    return;
  }
  classrooms.forEach((classroom) => {
    const option = node("option", "", classroom.title);
    option.value = String(classroom.id);
    elements.studentClassroom.append(option);
  });
  elements.studentClassroom.disabled = false;
  elements.studentForm.querySelector("button[type=submit]").disabled = false;
}

function renderTeacherClassrooms(members, profiles, attempts) {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const attemptsByUser = groupAttemptsByUser(attempts);
  elements.teacherClassList.replaceChildren();
  if (!classrooms.length) {
    elements.teacherClassList.append(empty("Создайте первый класс, затем добавьте учеников."));
    return;
  }

  classrooms.forEach((classroom) => {
    const classMembers = members.filter((member) => member.classroom_id === classroom.id);
    const panel = node("article", "site-panel account-classroom-panel");
    panel.append(
      node("h3", "", classroom.title),
      node("p", "account-classroom-meta", `${classMembers.length} учеников`)
    );
    if (!classMembers.length) {
      panel.append(empty("В этом классе пока нет учеников."));
      elements.teacherClassList.append(panel);
      return;
    }

    const table = node("table", "account-student-table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Ученик", "Попытки", "Средний", "Последний", "Динамика"].forEach((label) => {
      headRow.append(node("th", "", label));
    });
    thead.append(headRow);
    const tbody = document.createElement("tbody");

    classMembers.forEach((member) => {
      const profile = profilesById.get(member.student_id);
      if (!profile) return;
      const summary = summarizeAttempts(attemptsByUser.get(profile.id) || []);
      const row = document.createElement("tr");
      const values = [
        `${profile.display_name} (@${profile.login_name})`,
        String(summary.count),
        summary.count ? `${summary.average}%` : "—",
        summary.latest ? `${summary.latest.percent}% · ${formatDateTime(summary.latest.completed_at)}` : "—",
        formatTrend(summary.trend)
      ];
      ["Ученик", "Попытки", "Средний", "Последний", "Динамика"].forEach((label, index) => {
        const cell = node("td", "", values[index]);
        cell.dataset.label = label;
        row.append(cell);
      });
      tbody.append(row);
    });
    table.append(thead, tbody);
    panel.append(table);
    elements.teacherClassList.append(panel);
  });
}

async function loadTeacherDashboard() {
  const supabase = getSupabaseClient();
  const classResult = await supabase.from("classrooms")
    .select("id, teacher_id, title, created_at")
    .eq("teacher_id", account.user.id)
    .order("title");
  if (classResult.error) throw classResult.error;
  classrooms = classResult.data;
  renderClassroomSelect();

  const classIds = classrooms.map((item) => item.id);
  let members = [];
  let profiles = [];
  let attempts = [];
  if (classIds.length) {
    const memberResult = await supabase.from("classroom_members")
      .select("classroom_id, student_id, joined_at")
      .in("classroom_id", classIds);
    if (memberResult.error) throw memberResult.error;
    members = memberResult.data;
    const studentIds = [...new Set(members.map((item) => item.student_id))];
    if (studentIds.length) {
      const [profileResult, attemptResult] = await Promise.all([
        supabase.from("profiles")
          .select("id, display_name, login_name")
          .in("id", studentIds),
        supabase.from("attempts")
          .select("user_id, test_id, completed_at, percent, grade")
          .in("user_id", studentIds)
          .order("completed_at", { ascending: false })
      ]);
      if (profileResult.error) throw profileResult.error;
      if (attemptResult.error) throw attemptResult.error;
      profiles = profileResult.data;
      attempts = attemptResult.data;
    }
  }

  renderTeacherClassrooms(members, profiles, attempts);
  elements.teacherPanel.hidden = false;
}

async function invokeTeacherFunction(name, body) {
  const { data, error } = await getSupabaseClient().functions.invoke(name, { body });
  if (!error) return data;
  let message = error.message;
  try {
    const details = await error.context?.json();
    message = details?.error || details?.message || message;
  } catch (_) {
    // Keep the SDK message if the response body is not JSON.
  }
  throw new Error(message);
}

elements.classroomForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = normalizeDisplayName(new FormData(elements.classroomForm).get("title"));
  if (!isValidDisplayName(title)) {
    setStatus(elements.classroomStatus, "Название должно содержать от 1 до 80 символов.", "error");
    return;
  }
  setFormBusy(elements.classroomForm, true);
  setStatus(elements.classroomStatus, "Создаём класс…");
  try {
    const { error } = await getSupabaseClient().from("classrooms").insert({
      teacher_id: account.user.id,
      title
    });
    if (error) throw error;
    elements.classroomForm.reset();
    setStatus(elements.classroomStatus, "Класс создан.", "good");
    await loadTeacherDashboard();
  } catch (error) {
    setStatus(elements.classroomStatus, friendlyAuthError(error), "error");
  } finally {
    setFormBusy(elements.classroomForm, false);
  }
});

elements.studentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(elements.studentForm);
  const classroomId = Number(form.get("classroomId"));
  const displayName = normalizeDisplayName(form.get("displayName"));
  const login = normalizeLogin(form.get("login"));
  const password = String(form.get("password") || "");
  if (!classrooms.some((item) => item.id === classroomId)) {
    setStatus(elements.studentStatus, "Выберите существующий класс.", "error");
    return;
  }
  if (!isValidDisplayName(displayName)) {
    setStatus(elements.studentStatus, "Имя должно содержать от 1 до 80 символов.", "error");
    return;
  }
  if (!isValidLogin(login)) {
    setStatus(elements.studentStatus, loginValidationMessage(login), "error");
    return;
  }
  if (!isValidPassword(password)) {
    setStatus(elements.studentStatus, passwordValidationMessage(password), "error");
    return;
  }

  setFormBusy(elements.studentForm, true);
  setStatus(elements.studentStatus, "Создаём аккаунт ученика…");
  try {
    await invokeTeacherFunction("create-student", { classroomId, displayName, login, password });
    elements.createdLogin.textContent = login;
    elements.createdPassword.textContent = password;
    elements.credentialsCard.hidden = false;
    elements.studentForm.reset();
    setStatus(elements.studentStatus, "Аккаунт создан и добавлен в класс.", "good");
    await loadTeacherDashboard();
  } catch (error) {
    setStatus(elements.studentStatus, friendlyAuthError(error), "error");
  } finally {
    setFormBusy(elements.studentForm, false);
  }
});

async function initDashboard() {
  try {
    const catalog = await loadCatalog();
    testTitles = new Map(visibleCatalogItems(catalog)
      .filter((item) => item.url.startsWith("test.html?id="))
      .map((item) => [item.id, item.title.replace(/ — новая версия$/, "")]));
  } catch (_) {
    testTitles = new Map();
  }

  account = await getAccountContext({ refresh: true });
  if (!account.signedIn) {
    elements.dashboardLoading.hidden = true;
    elements.dashboardError.hidden = false;
    elements.dashboardErrorText.textContent = account.online
      ? "Сначала войдите в аккаунт."
      : "Не удалось связаться с облачным хранилищем. Проверьте интернет-соединение.";
    return;
  }

  const isTeacher = account.profile.role === "teacher";
  document.title = `${isTeacher ? "Кабинет учителя" : "Мои результаты"} — ${account.profile.display_name}`;
  elements.dashboardRole.textContent = isTeacher ? "Учитель" : "Ученик";
  elements.dashboardTitle.textContent = account.profile.display_name;
  elements.dashboardDescription.textContent = isTeacher
    ? "Создавайте классы и аккаунты учеников, отслеживайте результаты и динамику."
    : "Ваши результаты сохраняются в аккаунте и доступны на разных устройствах.";

  try {
    if (isTeacher) await loadTeacherDashboard();
    else await loadStudentDashboard();
    elements.dashboardLoading.hidden = true;
  } catch (error) {
    console.error(error);
    elements.dashboardLoading.hidden = true;
    elements.dashboardError.hidden = false;
    elements.dashboardErrorText.textContent = friendlyAuthError(error);
  }
}

initDashboard();
