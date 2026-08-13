import { loadCatalog, visibleCatalogItems } from "./catalog.js?v=10";
import { fetchJson, formatDateTime, modeTitle } from "./utils.js?v=10";
import {
  buildAssignmentUrl,
  getAssignmentState,
  latestAttemptByAssignment,
  summarizeAssignment
} from "./assignment-records.js?v=10";
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
import { getAccountContext, getSupabaseClient } from "./supabase-client.js?v=10";
import {
  formatTrend,
  groupAttemptsByUser,
  sortAttemptsNewestFirst,
  summarizeAttempts
} from "./dashboard-records.js?v=10";

const elements = Object.fromEntries([
  "dashboardRole", "dashboardTitle", "dashboardDescription", "dashboardLoading", "dashboardError",
  "dashboardErrorText", "studentPanel", "studentMetrics", "studentAttemptList", "studentClassList",
  "studentAssignmentList", "teacherPanel", "classroomForm", "classroomStatus", "studentForm",
  "studentClassroom", "studentStatus", "credentialsCard", "createdLogin", "createdPassword",
  "teacherClassList", "assignmentForm", "assignmentClassroom", "assignmentTest", "assignmentVariant",
  "assignmentMode", "assignmentDueAt", "assignmentStatus", "teacherAssignmentList"
].map((id) => [id, document.getElementById(id)]));

let account = null;
let classrooms = [];
let catalogTests = [];
let testTitles = new Map();
const testDefinitions = new Map();

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

async function getTestDefinition(testId) {
  if (!testDefinitions.has(testId)) {
    testDefinitions.set(testId, fetchJson(`data/tests/${encodeURIComponent(testId)}.json`));
  }
  try {
    const definition = await testDefinitions.get(testId);
    testDefinitions.set(testId, definition);
    return definition;
  } catch (error) {
    testDefinitions.delete(testId);
    throw error;
  }
}

async function preloadAssignmentDefinitions(assignments) {
  const ids = [...new Set((assignments || []).map((item) => item.test_id))];
  await Promise.all(ids.map((id) => getTestDefinition(id).catch(() => null)));
}

function assignmentVariantTitle(assignment) {
  const definition = testDefinitions.get(assignment.test_id);
  if (!definition || typeof definition.then === "function") return assignment.variant_id;
  return definition.variants?.find((variant) => variant.id === assignment.variant_id)?.title || assignment.variant_id;
}

function assignmentMeta(assignment, classroomTitle = "") {
  const parts = [];
  if (classroomTitle) parts.push(classroomTitle);
  parts.push(assignmentVariantTitle(assignment), modeTitle(assignment.mode));
  parts.push(assignment.due_at ? `до ${formatDateTime(assignment.due_at)}` : "без срока");
  return parts.join(" · ");
}

function assignmentStatusLabel(state, attempt = null) {
  if (state.key === "completed-late") return `Сдано с опозданием · ${attempt.percent}%`;
  if (state.key === "completed") return `Сдано · ${attempt.percent}%`;
  if (state.key === "overdue") return "Срок истёк";
  return "К выполнению";
}

function renderStudentAssignments(assignments, attempts, classTitles) {
  const latest = latestAttemptByAssignment(attempts);
  const ordered = [...assignments].sort((left, right) => {
    const leftState = getAssignmentState(left, latest.get(left.id));
    const rightState = getAssignmentState(right, latest.get(right.id));
    if (leftState.completed !== rightState.completed) return Number(leftState.completed) - Number(rightState.completed);
    return new Date(left.due_at || "9999-12-31").getTime() - new Date(right.due_at || "9999-12-31").getTime();
  });
  elements.studentAssignmentList.replaceChildren();
  if (!ordered.length) {
    elements.studentAssignmentList.append(empty("Учитель пока не выдавал работ вашему классу."));
    return;
  }

  ordered.forEach((assignment) => {
    const attempt = latest.get(assignment.id) || null;
    const state = getAssignmentState(assignment, attempt);
    const item = node("article", `site-panel account-assignment is-${state.key}`);
    const copy = node("div", "account-assignment-copy");
    copy.append(
      node("h3", "", testTitle(assignment.test_id)),
      node("p", "", assignmentMeta(assignment, classTitles.get(assignment.classroom_id)))
    );
    const actions = node("div", "account-assignment-actions");
    actions.append(node("span", "account-assignment-status", assignmentStatusLabel(state, attempt)));
    const url = buildAssignmentUrl(assignment);
    if (url) {
      const link = node("a", "site-btn", state.completed ? "Пройти ещё раз" : "Начать работу");
      link.href = url;
      actions.append(link);
    }
    item.append(copy, actions);
    elements.studentAssignmentList.append(item);
  });
}

async function loadStudentDashboard() {
  const supabase = getSupabaseClient();
  const [attemptResult, memberResult] = await Promise.all([
    supabase.from("attempts")
      .select("test_id, variant_id, mode, completed_at, percent, grade, earned_points, max_points, assignment_id")
      .order("completed_at", { ascending: false }),
    supabase.from("classroom_members")
      .select("classroom_id, joined_at")
      .eq("student_id", account.user.id)
  ]);
  if (attemptResult.error) throw attemptResult.error;
  if (memberResult.error) throw memberResult.error;

  const classIds = memberResult.data.map((item) => item.classroom_id);
  let studentClasses = [];
  let assignments = [];
  if (classIds.length) {
    const [classResult, assignmentResult] = await Promise.all([
      supabase.from("classrooms").select("id, title").in("id", classIds).order("title"),
      supabase.from("assignments")
        .select("id, classroom_id, test_id, test_version, variant_id, mode, due_at, created_at")
        .in("classroom_id", classIds)
        .order("created_at", { ascending: false })
    ]);
    if (classResult.error) throw classResult.error;
    if (assignmentResult.error) throw assignmentResult.error;
    studentClasses = classResult.data;
    assignments = assignmentResult.data;
  }

  await preloadAssignmentDefinitions(assignments);
  const classTitles = new Map(studentClasses.map((item) => [item.id, item.title]));
  renderStudentAssignments(assignments, attemptResult.data, classTitles);
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

function fillClassroomSelect(select, emptyLabel) {
  select.replaceChildren();
  if (!classrooms.length) {
    const option = node("option", "", emptyLabel);
    option.value = "";
    select.append(option);
    select.disabled = true;
    return;
  }
  classrooms.forEach((classroom) => {
    const option = node("option", "", classroom.title);
    option.value = String(classroom.id);
    select.append(option);
  });
  select.disabled = false;
}

function renderClassroomSelects() {
  fillClassroomSelect(elements.studentClassroom, "Сначала создайте класс");
  fillClassroomSelect(elements.assignmentClassroom, "Сначала создайте класс");
  elements.studentForm.querySelector("button[type=submit]").disabled = !classrooms.length;
  elements.assignmentForm.querySelector("button[type=submit]").disabled = !classrooms.length || !catalogTests.length;
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
    panel.append(node("h3", "", classroom.title), node("p", "account-classroom-meta", `${classMembers.length} учеников`));
    if (!classMembers.length) {
      panel.append(empty("В этом классе пока нет учеников."));
      elements.teacherClassList.append(panel);
      return;
    }

    const table = node("table", "account-student-table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Ученик", "Попытки", "Средний", "Последний", "Динамика"].forEach((label) => headRow.append(node("th", "", label)));
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

function renderTeacherAssignments(assignments, members, attempts) {
  const classTitles = new Map(classrooms.map((item) => [item.id, item.title]));
  elements.teacherAssignmentList.replaceChildren();
  if (!assignments.length) {
    elements.teacherAssignmentList.append(empty("Выданных работ пока нет."));
    return;
  }
  assignments.forEach((assignment) => {
    const summary = summarizeAssignment(assignment, members, attempts);
    const state = getAssignmentState(assignment);
    const item = node("article", `site-panel account-assignment teacher-assignment is-${state.key}`);
    const copy = node("div", "account-assignment-copy");
    copy.append(
      node("h3", "", testTitle(assignment.test_id)),
      node("p", "", assignmentMeta(assignment, classTitles.get(assignment.classroom_id)))
    );
    const actions = node("div", "account-assignment-actions");
    actions.append(
      node("strong", "account-assignment-progress", `${summary.completed} из ${summary.total} сдали`),
      node("span", "account-assignment-status", state.overdue ? "Срок завершён" : "Принимается")
    );
    const preview = node("a", "trainer-history-link", "Открыть тест →");
    preview.href = `test.html?id=${encodeURIComponent(assignment.test_id)}`;
    actions.append(preview);
    item.append(copy, actions);
    elements.teacherAssignmentList.append(item);
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
  renderClassroomSelects();

  const classIds = classrooms.map((item) => item.id);
  let members = [];
  let profiles = [];
  let attempts = [];
  let assignments = [];
  if (classIds.length) {
    const [memberResult, assignmentResult] = await Promise.all([
      supabase.from("classroom_members").select("classroom_id, student_id, joined_at").in("classroom_id", classIds),
      supabase.from("assignments")
        .select("id, classroom_id, test_id, test_version, variant_id, mode, due_at, created_at")
        .in("classroom_id", classIds)
        .order("created_at", { ascending: false })
    ]);
    if (memberResult.error) throw memberResult.error;
    if (assignmentResult.error) throw assignmentResult.error;
    members = memberResult.data;
    assignments = assignmentResult.data;
    const studentIds = [...new Set(members.map((item) => item.student_id))];
    if (studentIds.length) {
      const [profileResult, attemptResult] = await Promise.all([
        supabase.from("profiles").select("id, display_name, login_name").in("id", studentIds),
        supabase.from("attempts")
          .select("user_id, test_id, completed_at, percent, grade, assignment_id")
          .in("user_id", studentIds)
          .order("completed_at", { ascending: false })
      ]);
      if (profileResult.error) throw profileResult.error;
      if (attemptResult.error) throw attemptResult.error;
      profiles = profileResult.data;
      attempts = attemptResult.data;
    }
  }

  await preloadAssignmentDefinitions(assignments);
  renderTeacherAssignments(assignments, members, attempts);
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

function replaceOptions(select, items, label, value) {
  select.replaceChildren(...items.map((item) => {
    const option = node("option", "", label(item));
    option.value = value(item);
    return option;
  }));
  select.disabled = items.length === 0;
}

async function updateAssignmentDefinitionChoices() {
  const testId = elements.assignmentTest.value;
  if (!testId) return;
  setStatus(elements.assignmentStatus, "Загружаем варианты теста…");
  try {
    const definition = await getTestDefinition(testId);
    replaceOptions(elements.assignmentVariant, definition.variants || [], (item) => item.title, (item) => item.id);
    const modes = ["training", "test"].filter((mode) => definition.modes?.[mode]?.enabled);
    replaceOptions(elements.assignmentMode, modes, (mode) => modeTitle(mode), (mode) => mode);
    setStatus(elements.assignmentStatus, "");
  } catch (error) {
    elements.assignmentVariant.replaceChildren();
    elements.assignmentMode.replaceChildren();
    setStatus(elements.assignmentStatus, friendlyAuthError(error), "error");
  }
}

function localDateTimeValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function prepareAssignmentForm() {
  replaceOptions(elements.assignmentTest, catalogTests, (item) => item.title, (item) => item.id);
  const now = new Date();
  elements.assignmentDueAt.min = localDateTimeValue(now);
  const defaultDue = new Date(now);
  defaultDue.setDate(defaultDue.getDate() + 7);
  defaultDue.setHours(18, 0, 0, 0);
  elements.assignmentDueAt.value = localDateTimeValue(defaultDue);
  void updateAssignmentDefinitionChoices();
}

elements.assignmentTest.addEventListener("change", () => void updateAssignmentDefinitionChoices());

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
    const { error } = await getSupabaseClient().from("classrooms").insert({ teacher_id: account.user.id, title });
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

elements.assignmentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(elements.assignmentForm);
  const classroomId = Number(form.get("classroomId"));
  const testId = String(form.get("testId") || "");
  const variantId = String(form.get("variantId") || "");
  const mode = String(form.get("mode") || "");
  const dueAt = new Date(String(form.get("dueAt") || ""));
  if (!classrooms.some((item) => item.id === classroomId)) {
    setStatus(elements.assignmentStatus, "Выберите существующий класс.", "error");
    return;
  }
  if (!Number.isFinite(dueAt.getTime()) || dueAt.getTime() <= Date.now()) {
    setStatus(elements.assignmentStatus, "Срок сдачи должен быть в будущем.", "error");
    return;
  }

  setFormBusy(elements.assignmentForm, true);
  setStatus(elements.assignmentStatus, "Выдаём работу…");
  try {
    const definition = await getTestDefinition(testId);
    if (!definition.variants.some((item) => item.id === variantId) || !definition.modes?.[mode]?.enabled) {
      throw new Error("Выбранные параметры теста больше недоступны.");
    }
    const { error } = await getSupabaseClient().from("assignments").insert({
      classroom_id: classroomId,
      test_id: testId,
      test_version: definition.version,
      variant_id: variantId,
      mode,
      due_at: dueAt.toISOString()
    });
    if (error) throw error;
    setStatus(elements.assignmentStatus, "Работа выдана классу.", "good");
    await loadTeacherDashboard();
  } catch (error) {
    setStatus(elements.assignmentStatus, friendlyAuthError(error), "error");
  } finally {
    setFormBusy(elements.assignmentForm, false);
  }
});

async function initDashboard() {
  try {
    const catalog = await loadCatalog();
    catalogTests = visibleCatalogItems(catalog).filter((item) => item.url.startsWith("test.html?id="));
    testTitles = new Map(catalogTests.map((item) => [item.id, item.title]));
    prepareAssignmentForm();
  } catch (_) {
    catalogTests = [];
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
    ? "Создавайте классы и аккаунты учеников, выдавайте работы и отслеживайте динамику."
    : "Выполняйте назначенные работы и отслеживайте результаты на разных устройствах.";

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
