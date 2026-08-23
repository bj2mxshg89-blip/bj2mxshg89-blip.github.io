import { getAccountContext, getSupabaseClient } from "./supabase-client.js?v=10";
import {
  loanFor,
  loansForStudent,
  loansForTextbook,
  normalizeStudentInput,
  normalizeTextbookInput,
  parseBulkStudents,
  sortStudents,
  sortTextbooks,
  studentDisplayName,
  textbookStats,
  validateLoanAssignment,
  validateStudentInput,
  validateTextbookInput
} from "./textbook-registry.js?v=10";

const elements = Object.fromEntries([
  "registryLoading", "registryError", "registryErrorText", "registryRetry", "registryApp",
  "quickLoanForm", "quickStudent", "quickTextbook", "quickLoanStatus", "registrySearch",
  "registryList", "registryPanel", "studentsPanel", "textbooksPanel", "registryTab",
  "studentsTab", "textbooksTab", "registryStudentForm", "registryStudentId", "registryLastName",
  "registryFirstName", "studentFormTitle", "studentFormCancel", "studentFormStatus",
  "bulkStudentsForm", "bulkStudents", "bulkStudentsStatus", "studentsList", "studentCount",
  "registryTextbookForm", "registryTextbookId", "registryTextbookTitle", "registryTextbookQuantity",
  "textbookFormTitle", "textbookFormCancel", "textbookFormStatus", "textbooksList",
  "textbookCount", "loanDialog", "loanDialogKicker", "loanDialogTitle",
  "loanDialogDescription", "loanDialogList", "loanDialogStatus"
].map((id) => [id, document.getElementById(id)]));

let supabase = null;
let students = [];
let textbooks = [];
let loans = [];
let dialogState = null;

function node(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function setStatus(element, message = "", kind = "") {
  element.textContent = message;
  element.classList.toggle("is-error", kind === "error");
  element.classList.toggle("is-good", kind === "good");
}

function setFormBusy(form, busy) {
  [...form.elements].forEach((control) => {
    control.disabled = busy;
  });
}

function friendlyDataError(error) {
  if (!error) return "Неизвестная ошибка.";
  if (error.code === "23505") return "Такая выдача уже существует.";
  if (error.code === "23514") return "Проверьте заполненные значения.";
  if (error.code === "42501") return "Недостаточно прав. Войдите в аккаунт учителя заново.";
  return error.message || "Не удалось выполнить операцию.";
}

function empty(message) {
  return node("div", "textbooks-empty", message);
}

function actionButton(label, className = "site-btn ghost textbooks-small-btn") {
  return node("button", className, label);
}

function stat(label, value) {
  const item = node("div", "textbooks-stat");
  item.append(node("span", "", label), node("strong", "", String(value)));
  return item;
}

function selectTab(name, focus = false) {
  const names = ["registry", "students", "textbooks"];
  names.forEach((item) => {
    const tab = elements[item + "Tab"];
    const panel = elements[item + "Panel"];
    const selected = item === name;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    panel.hidden = !selected;
  });
  if (focus) elements[name + "Tab"].focus();
}

function renderRegistry() {
  const query = elements.registrySearch.value.trim().toLocaleLowerCase("ru");
  const visible = sortStudents(students).filter((student) =>
    studentDisplayName(student).toLocaleLowerCase("ru").includes(query)
  );
  elements.registryList.replaceChildren();
  if (!students.length) {
    elements.registryList.append(empty("Добавьте учеников во вкладке «Ученики»."));
    return;
  }
  if (!visible.length) {
    elements.registryList.append(empty("Ученики по этому запросу не найдены."));
    return;
  }

  const textbooksById = new Map(textbooks.map((textbook) => [textbook.id, textbook]));
  visible.forEach((student) => {
    const card = node("article", "site-panel textbooks-person");
    const copy = node("div");
    copy.append(node("h3", "", studentDisplayName(student)));
    const assigned = loansForStudent(loans, student.id)
      .map((loan) => textbooksById.get(loan.textbook_id))
      .filter(Boolean);
    if (!assigned.length) {
      copy.append(node("p", "textbooks-meta", "Учебников на руках нет"));
    } else {
      const chips = node("div", "textbooks-chips");
      sortTextbooks(assigned).forEach((textbook) => chips.append(node("span", "textbooks-chip", textbook.title)));
      copy.append(chips);
    }
    const change = actionButton("Изменить выдачу", "site-btn secondary textbooks-small-btn");
    change.type = "button";
    change.addEventListener("click", () => openStudentLoans(student.id));
    card.append(copy, change);
    elements.registryList.append(card);
  });
}

function renderStudents() {
  elements.studentCount.textContent = students.length + " " + plural(students.length, "ученик", "ученика", "учеников");
  elements.studentsList.replaceChildren();
  if (!students.length) {
    elements.studentsList.append(empty("В реестре пока нет учеников."));
    return;
  }
  sortStudents(students).forEach((student) => {
    const card = node("article", "site-panel textbooks-student-row");
    const copy = node("div");
    const count = loansForStudent(loans, student.id).length;
    copy.append(
      node("h3", "", studentDisplayName(student)),
      node("p", "textbooks-meta", count + " " + plural(count, "учебник на руках", "учебника на руках", "учебников на руках"))
    );
    const actions = node("div", "textbooks-row-actions");
    const edit = actionButton("Изменить");
    edit.type = "button";
    edit.addEventListener("click", () => beginStudentEdit(student));
    const remove = actionButton("Удалить", "site-btn danger textbooks-small-btn");
    remove.type = "button";
    remove.addEventListener("click", () => deleteStudent(student));
    actions.append(edit, remove);
    card.append(copy, actions);
    elements.studentsList.append(card);
  });
}

function renderTextbooks() {
  elements.textbookCount.textContent = textbooks.length + " " + plural(textbooks.length, "позиция", "позиции", "позиций");
  elements.textbooksList.replaceChildren();
  if (!textbooks.length) {
    elements.textbooksList.append(empty("Добавьте первый учебник и укажите количество экземпляров."));
    return;
  }
  sortTextbooks(textbooks).forEach((textbook) => {
    const card = node("article", "site-panel textbooks-book");
    const head = node("div", "textbooks-book-head");
    const copy = node("div");
    copy.append(node("h3", "", textbook.title));
    const actions = node("div", "textbooks-row-actions");
    const distribute = actionButton("Раздать", "site-btn secondary textbooks-small-btn");
    distribute.type = "button";
    distribute.addEventListener("click", () => openTextbookLoans(textbook.id));
    const edit = actionButton("Изменить");
    edit.type = "button";
    edit.addEventListener("click", () => beginTextbookEdit(textbook));
    const remove = actionButton("Удалить", "site-btn danger textbooks-small-btn");
    remove.type = "button";
    remove.addEventListener("click", () => deleteTextbook(textbook));
    actions.append(distribute, edit, remove);
    head.append(copy, actions);
    const stats = textbookStats(textbook, students, loans);
    const statsGrid = node("div", "textbooks-stats");
    statsGrid.append(
      stat("Получено", stats.received),
      stat("Выдано", stats.issued),
      stat("Осталось", stats.remaining),
      stat("Без учебника", stats.without)
    );
    card.append(head, statsGrid);
    elements.textbooksList.append(card);
  });
}

function plural(count, one, few, many) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function renderQuickSelectors(preferredStudent = elements.quickStudent.value, preferredTextbook = "") {
  const sortedStudents = sortStudents(students);
  elements.quickStudent.replaceChildren();
  if (!sortedStudents.length) {
    const option = node("option", "", "Сначала добавьте ученика");
    option.value = "";
    elements.quickStudent.append(option);
  } else {
    sortedStudents.forEach((student) => {
      const option = node("option", "", studentDisplayName(student));
      option.value = student.id;
      elements.quickStudent.append(option);
    });
    if (sortedStudents.some((student) => student.id === preferredStudent)) elements.quickStudent.value = preferredStudent;
  }

  const studentId = elements.quickStudent.value;
  const sortedBooks = sortTextbooks(textbooks);
  elements.quickTextbook.replaceChildren();
  if (!sortedBooks.length) {
    const option = node("option", "", "Сначала добавьте учебник");
    option.value = "";
    elements.quickTextbook.append(option);
  } else {
    sortedBooks.forEach((textbook) => {
      const stats = textbookStats(textbook, students, loans);
      const duplicate = Boolean(studentId && loanFor(loans, studentId, textbook.id));
      const option = node(
        "option",
        "",
        textbook.title + " · осталось " + stats.remaining + (duplicate ? " · уже выдан" : "")
      );
      option.value = textbook.id;
      option.disabled = duplicate || stats.remaining <= 0;
      elements.quickTextbook.append(option);
    });
    const preferred = [...elements.quickTextbook.options].find((option) => option.value === preferredTextbook && !option.disabled);
    const firstAvailable = [...elements.quickTextbook.options].find((option) => !option.disabled);
    elements.quickTextbook.value = (preferred || firstAvailable)?.value || "";
  }
  const available = Boolean(elements.quickStudent.value && elements.quickTextbook.value);
  elements.quickLoanForm.querySelector("button[type=submit]").disabled = !available;
}

function renderAll() {
  renderRegistry();
  renderStudents();
  renderTextbooks();
  renderQuickSelectors();
}

async function loadData() {
  const [studentResult, textbookResult, loanResult] = await Promise.all([
    supabase.from("book_registry_students").select("id,last_name,first_name"),
    supabase.from("book_registry_textbooks").select("id,title,quantity"),
    supabase.from("book_registry_loans").select("id,student_id,textbook_id")
  ]);
  if (studentResult.error) throw studentResult.error;
  if (textbookResult.error) throw textbookResult.error;
  if (loanResult.error) throw loanResult.error;
  students = studentResult.data || [];
  textbooks = textbookResult.data || [];
  loans = loanResult.data || [];
  renderAll();
}

async function refreshAfterMutation() {
  await loadData();
}

function beginStudentEdit(student) {
  selectTab("students");
  elements.registryStudentId.value = student.id;
  elements.registryLastName.value = student.last_name;
  elements.registryFirstName.value = student.first_name;
  elements.studentFormTitle.textContent = "Изменить ученика";
  elements.studentFormCancel.hidden = false;
  setStatus(elements.studentFormStatus);
  elements.registryLastName.focus();
  elements.registryStudentForm.scrollIntoView({ block: "center", behavior: "smooth" });
}

function resetStudentForm() {
  elements.registryStudentForm.reset();
  elements.registryStudentId.value = "";
  elements.studentFormTitle.textContent = "Добавить ученика";
  elements.studentFormCancel.hidden = true;
  setStatus(elements.studentFormStatus);
}

function beginTextbookEdit(textbook) {
  selectTab("textbooks");
  elements.registryTextbookId.value = textbook.id;
  elements.registryTextbookTitle.value = textbook.title;
  elements.registryTextbookQuantity.value = String(textbook.quantity);
  elements.textbookFormTitle.textContent = "Изменить учебник";
  elements.textbookFormCancel.hidden = false;
  setStatus(elements.textbookFormStatus);
  elements.registryTextbookTitle.focus();
  elements.registryTextbookForm.scrollIntoView({ block: "center", behavior: "smooth" });
}

function resetTextbookForm() {
  elements.registryTextbookForm.reset();
  elements.registryTextbookId.value = "";
  elements.textbookFormTitle.textContent = "Добавить учебник";
  elements.textbookFormCancel.hidden = true;
  setStatus(elements.textbookFormStatus);
}

async function saveStudent(event) {
  event.preventDefault();
  const payload = normalizeStudentInput(elements.registryLastName.value, elements.registryFirstName.value);
  const validation = validateStudentInput(payload);
  if (validation) {
    setStatus(elements.studentFormStatus, validation, "error");
    return;
  }
  const id = elements.registryStudentId.value;
  setFormBusy(elements.registryStudentForm, true);
  setStatus(elements.studentFormStatus, "Сохраняем…");
  try {
    const result = id
      ? await supabase.from("book_registry_students").update(payload).eq("id", id)
      : await supabase.from("book_registry_students").insert(payload);
    if (result.error) throw result.error;
    resetStudentForm();
    await loadData();
    setStatus(elements.studentFormStatus, id ? "Данные ученика обновлены." : "Ученик добавлен.", "good");
  } catch (error) {
    setStatus(elements.studentFormStatus, friendlyDataError(error), "error");
  } finally {
    setFormBusy(elements.registryStudentForm, false);
  }
}

async function saveBulkStudents(event) {
  event.preventDefault();
  const parsed = parseBulkStudents(elements.bulkStudents.value);
  if (parsed.errors.length) {
    setStatus(elements.bulkStudentsStatus, parsed.errors.join(" "), "error");
    return;
  }
  const existing = new Set(students.map((student) =>
    (student.last_name + "\u0000" + student.first_name).toLocaleLowerCase("ru")
  ));
  const payload = parsed.students.filter((student) =>
    !existing.has((student.last_name + "\u0000" + student.first_name).toLocaleLowerCase("ru"))
  );
  const skipped = parsed.students.length - payload.length + parsed.duplicateCount;
  if (!payload.length) {
    setStatus(elements.bulkStudentsStatus, "Все ученики из списка уже есть в реестре.", "error");
    return;
  }
  setFormBusy(elements.bulkStudentsForm, true);
  setStatus(elements.bulkStudentsStatus, "Добавляем список…");
  try {
    const result = await supabase.from("book_registry_students").insert(payload);
    if (result.error) throw result.error;
    elements.bulkStudentsForm.reset();
    await loadData();
    const suffix = skipped ? " Пропущено повторов: " + skipped + "." : "";
    setStatus(elements.bulkStudentsStatus, "Добавлено учеников: " + payload.length + "." + suffix, "good");
  } catch (error) {
    setStatus(elements.bulkStudentsStatus, friendlyDataError(error), "error");
  } finally {
    setFormBusy(elements.bulkStudentsForm, false);
  }
}

async function saveTextbook(event) {
  event.preventDefault();
  const payload = normalizeTextbookInput(elements.registryTextbookTitle.value, elements.registryTextbookQuantity.value);
  const validation = validateTextbookInput(payload);
  if (validation) {
    setStatus(elements.textbookFormStatus, validation, "error");
    return;
  }
  const id = elements.registryTextbookId.value;
  if (id) {
    const issued = loansForTextbook(loans, id).length;
    if (payload.quantity < issued) {
      setStatus(elements.textbookFormStatus, "Количество не может быть меньше уже выданных экземпляров (" + issued + ").", "error");
      return;
    }
  }
  setFormBusy(elements.registryTextbookForm, true);
  setStatus(elements.textbookFormStatus, "Сохраняем…");
  try {
    const result = id
      ? await supabase.from("book_registry_textbooks").update(payload).eq("id", id)
      : await supabase.from("book_registry_textbooks").insert(payload);
    if (result.error) throw result.error;
    resetTextbookForm();
    await loadData();
    setStatus(elements.textbookFormStatus, id ? "Учебник обновлён." : "Учебник добавлен.", "good");
  } catch (error) {
    setStatus(elements.textbookFormStatus, friendlyDataError(error), "error");
  } finally {
    setFormBusy(elements.registryTextbookForm, false);
  }
}

async function deleteStudent(student) {
  if (!window.confirm("Удалить ученика «" + studentDisplayName(student) + "»? Его текущая выдача также будет удалена.")) return;
  try {
    const result = await supabase.from("book_registry_students").delete().eq("id", student.id);
    if (result.error) throw result.error;
    await loadData();
  } catch (error) {
    window.alert(friendlyDataError(error));
  }
}

async function deleteTextbook(textbook) {
  if (!window.confirm("Удалить учебник «" + textbook.title + "»? Все связанные выдачи будут удалены.")) return;
  try {
    const result = await supabase.from("book_registry_textbooks").delete().eq("id", textbook.id);
    if (result.error) throw result.error;
    await loadData();
  } catch (error) {
    window.alert(friendlyDataError(error));
  }
}

async function fetchCurrentLoanState() {
  const [loanResult, textbookResult] = await Promise.all([
    supabase.from("book_registry_loans").select("id,student_id,textbook_id"),
    supabase.from("book_registry_textbooks").select("id,title,quantity")
  ]);
  if (loanResult.error) throw loanResult.error;
  if (textbookResult.error) throw textbookResult.error;
  loans = loanResult.data || [];
  textbooks = textbookResult.data || [];
}

async function createLoan(studentId, textbookId) {
  await fetchCurrentLoanState();
  const validation = validateLoanAssignment({ studentId, textbookId, students, textbooks, loans });
  if (!validation.ok) throw new Error(validation.message);
  const result = await supabase.from("book_registry_loans").insert({ student_id: studentId, textbook_id: textbookId });
  if (result.error) throw result.error;
  await refreshAfterMutation();
}

async function removeLoan(studentId, textbookId) {
  const existing = loanFor(loans, studentId, textbookId);
  if (!existing) return;
  const result = await supabase.from("book_registry_loans").delete().eq("id", existing.id);
  if (result.error) throw result.error;
  await refreshAfterMutation();
}

async function quickLoan(event) {
  event.preventDefault();
  const studentId = elements.quickStudent.value;
  const textbookId = elements.quickTextbook.value;
  setFormBusy(elements.quickLoanForm, true);
  setStatus(elements.quickLoanStatus, "Сохраняем выдачу…");
  try {
    await createLoan(studentId, textbookId);
    setStatus(elements.quickLoanStatus, "Учебник выдан.", "good");
  } catch (error) {
    setStatus(elements.quickLoanStatus, friendlyDataError(error), "error");
  } finally {
    setFormBusy(elements.quickLoanForm, false);
    renderQuickSelectors(studentId);
  }
}

function openStudentLoans(studentId) {
  dialogState = { kind: "student", id: studentId };
  renderLoanDialog();
  elements.loanDialog.showModal();
}

function openTextbookLoans(textbookId) {
  dialogState = { kind: "textbook", id: textbookId };
  renderLoanDialog();
  elements.loanDialog.showModal();
}

function renderLoanDialog(focusKey = "") {
  elements.loanDialogList.replaceChildren();
  setStatus(elements.loanDialogStatus);
  if (!dialogState) return;
  if (dialogState.kind === "student") renderStudentLoanDialog();
  else renderTextbookLoanDialog();
  if (focusKey) {
    requestAnimationFrame(() => elements.loanDialogList.querySelector('[data-focus-key="' + CSS.escape(focusKey) + '"]')?.focus());
  }
}

function makeCheckRow({ id, label, meta, checked, disabled, focusKey, onChange }) {
  const row = node("label", "textbooks-check-row" + (disabled ? " is-disabled" : ""));
  const checkbox = node("input");
  checkbox.type = "checkbox";
  checkbox.id = id;
  checkbox.checked = checked;
  checkbox.disabled = disabled;
  checkbox.dataset.focusKey = focusKey;
  const copy = node("strong", "", label);
  row.append(checkbox, copy);
  if (meta) row.append(node("small", "", meta));
  checkbox.addEventListener("change", () => onChange(checkbox));
  return row;
}

function renderStudentLoanDialog() {
  const student = students.find((item) => item.id === dialogState.id);
  if (!student) {
    elements.loanDialog.close();
    dialogState = null;
    return;
  }
  elements.loanDialogKicker.textContent = "Выдача ученику";
  elements.loanDialogTitle.textContent = studentDisplayName(student);
  elements.loanDialogDescription.textContent = "Отметьте учебники, которые сейчас находятся у ученика.";
  const sorted = sortTextbooks(textbooks);
  if (!sorted.length) {
    elements.loanDialogList.append(empty("Сначала добавьте учебники."));
    return;
  }
  sorted.forEach((textbook) => {
    const existing = loanFor(loans, student.id, textbook.id);
    const stats = textbookStats(textbook, students, loans);
    const key = "student:" + student.id + ":" + textbook.id;
    const row = makeCheckRow({
      id: "student-loan-" + textbook.id,
      label: textbook.title,
      meta: "Осталось: " + stats.remaining + " из " + textbook.quantity,
      checked: Boolean(existing),
      disabled: !existing && stats.remaining <= 0,
      focusKey: key,
      onChange: (checkbox) => changeDialogLoan(checkbox, student.id, textbook.id, key)
    });
    elements.loanDialogList.append(row);
  });
}

function renderTextbookLoanDialog() {
  const textbook = textbooks.find((item) => item.id === dialogState.id);
  if (!textbook) {
    elements.loanDialog.close();
    dialogState = null;
    return;
  }
  const stats = textbookStats(textbook, students, loans);
  elements.loanDialogKicker.textContent = "Раздать учебник";
  elements.loanDialogTitle.textContent = textbook.title;
  elements.loanDialogDescription.textContent = "Выдано " + stats.issued + " из " + textbook.quantity + ". Отметьте учеников, у которых есть учебник.";
  const sorted = sortStudents(students);
  if (!sorted.length) {
    elements.loanDialogList.append(empty("Сначала добавьте учеников."));
    return;
  }
  sorted.forEach((student) => {
    const existing = loanFor(loans, student.id, textbook.id);
    const key = "textbook:" + textbook.id + ":" + student.id;
    const row = makeCheckRow({
      id: "textbook-loan-" + student.id,
      label: studentDisplayName(student),
      meta: existing ? "Учебник выдан" : "Учебника нет",
      checked: Boolean(existing),
      disabled: !existing && stats.issued >= textbook.quantity,
      focusKey: key,
      onChange: (checkbox) => changeDialogLoan(checkbox, student.id, textbook.id, key)
    });
    elements.loanDialogList.append(row);
  });
}

async function changeDialogLoan(checkbox, studentId, textbookId, focusKey) {
  checkbox.disabled = true;
  setStatus(elements.loanDialogStatus, "Сохраняем…");
  try {
    if (checkbox.checked) await createLoan(studentId, textbookId);
    else await removeLoan(studentId, textbookId);
    renderLoanDialog(focusKey);
    setStatus(elements.loanDialogStatus, checkbox.checked ? "Учебник выдан." : "Учебник возвращён.", "good");
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    renderLoanDialog(focusKey);
    setStatus(elements.loanDialogStatus, friendlyDataError(error), "error");
  }
}

function setupTabs() {
  const tabs = [elements.registryTab, elements.studentsTab, elements.textbooksTab];
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab.dataset.tab));
    tab.addEventListener("keydown", (event) => {
      if (![
        "ArrowLeft", "ArrowRight", "Home", "End"
      ].includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      selectTab(tabs[next].dataset.tab, true);
    });
  });
}

function setupEvents() {
  setupTabs();
  elements.registrySearch.addEventListener("input", renderRegistry);
  elements.quickStudent.addEventListener("change", () => renderQuickSelectors(elements.quickStudent.value));
  elements.quickLoanForm.addEventListener("submit", quickLoan);
  elements.registryStudentForm.addEventListener("submit", saveStudent);
  elements.studentFormCancel.addEventListener("click", resetStudentForm);
  elements.bulkStudentsForm.addEventListener("submit", saveBulkStudents);
  elements.registryTextbookForm.addEventListener("submit", saveTextbook);
  elements.textbookFormCancel.addEventListener("click", resetTextbookForm);
  elements.registryRetry.addEventListener("click", openRegistry);
  elements.loanDialog.addEventListener("close", () => {
    dialogState = null;
    setStatus(elements.loanDialogStatus);
  });
}

async function openRegistry() {
  elements.registryError.hidden = true;
  elements.registryApp.hidden = true;
  elements.registryLoading.hidden = false;
  try {
    const account = await getAccountContext();
    if (!account.signedIn) {
      window.location.replace("account.html");
      return;
    }
    if (account.profile?.role !== "teacher") {
      window.location.replace("dashboard.html");
      return;
    }
    supabase = getSupabaseClient();
    if (!supabase) throw new Error("Облачное хранилище не настроено.");
    await loadData();
    elements.registryLoading.hidden = true;
    elements.registryApp.hidden = false;
  } catch (error) {
    elements.registryLoading.hidden = true;
    elements.registryErrorText.textContent = friendlyDataError(error);
    elements.registryError.hidden = false;
  }
}

setupEvents();
openRegistry();
