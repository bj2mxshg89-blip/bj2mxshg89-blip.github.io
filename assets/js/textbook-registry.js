const collator = new Intl.Collator("ru", { sensitivity: "base", numeric: true });

export const REGISTRY_LIMITS = Object.freeze({
  name: 80,
  title: 160,
  quantity: 10000
});

export function normalizeRegistryText(value, maxLength = Number.POSITIVE_INFINITY) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function normalizeStudentInput(lastName, firstName) {
  return {
    last_name: normalizeRegistryText(lastName, REGISTRY_LIMITS.name),
    first_name: normalizeRegistryText(firstName, REGISTRY_LIMITS.name)
  };
}

export function validateStudentInput(student) {
  if (!student.last_name || !student.first_name) {
    return "Укажите фамилию и имя ученика.";
  }
  if (student.last_name.length > REGISTRY_LIMITS.name || student.first_name.length > REGISTRY_LIMITS.name) {
    return "Фамилия и имя должны быть не длиннее " + REGISTRY_LIMITS.name + " символов.";
  }
  return "";
}

export function studentDisplayName(student) {
  return (student.last_name + " " + student.first_name).trim();
}

export function sortStudents(students) {
  return [...students].sort((left, right) =>
    collator.compare(left.last_name, right.last_name) ||
    collator.compare(left.first_name, right.first_name)
  );
}

export function sortTextbooks(textbooks) {
  return [...textbooks].sort((left, right) => collator.compare(left.title, right.title));
}

export function parseBulkStudents(value) {
  const students = [];
  const errors = [];
  const seen = new Set();
  let duplicateCount = 0;

  String(value ?? "").split(/\r?\n/).forEach((sourceLine, index) => {
    const line = normalizeRegistryText(sourceLine);
    if (!line) return;
    const parts = line.split(" ");
    if (parts.length !== 2) {
      errors.push("Строка " + (index + 1) + ": укажите только фамилию и имя, без отчества.");
      return;
    }
    const student = normalizeStudentInput(parts[0], parts[1]);
    const validation = validateStudentInput(student);
    if (validation) {
      errors.push("Строка " + (index + 1) + ": " + validation);
      return;
    }
    const key = (student.last_name + "\u0000" + student.first_name).toLocaleLowerCase("ru");
    if (seen.has(key)) {
      duplicateCount += 1;
      return;
    }
    seen.add(key);
    students.push(student);
  });

  if (!students.length && !errors.length) errors.push("Вставьте хотя бы одну строку «Фамилия Имя».");
  return { students, errors, duplicateCount };
}

export function normalizeTextbookInput(title, quantity) {
  const normalizedQuantity = typeof quantity === "number" ? quantity : Number(String(quantity ?? "").trim());
  return {
    title: normalizeRegistryText(title, REGISTRY_LIMITS.title),
    quantity: normalizedQuantity
  };
}

export function validateTextbookInput(textbook) {
  if (!textbook.title) return "Укажите название учебника.";
  if (textbook.title.length > REGISTRY_LIMITS.title) {
    return "Название должно быть не длиннее " + REGISTRY_LIMITS.title + " символов.";
  }
  if (!Number.isInteger(textbook.quantity) || textbook.quantity < 0 || textbook.quantity > REGISTRY_LIMITS.quantity) {
    return "Количество должно быть целым числом от 0 до " + REGISTRY_LIMITS.quantity + ".";
  }
  return "";
}

export function loanFor(loans, studentId, textbookId) {
  return loans.find((loan) => loan.student_id === studentId && loan.textbook_id === textbookId) || null;
}

export function loansForStudent(loans, studentId) {
  return loans.filter((loan) => loan.student_id === studentId);
}

export function loansForTextbook(loans, textbookId) {
  return loans.filter((loan) => loan.textbook_id === textbookId);
}

export function textbookStats(textbook, students, loans) {
  const assignedStudentIds = new Set(
    loansForTextbook(loans, textbook.id).map((loan) => loan.student_id)
  );
  const issued = assignedStudentIds.size;
  return {
    received: textbook.quantity,
    issued,
    remaining: Math.max(0, textbook.quantity - issued),
    without: Math.max(0, students.length - issued)
  };
}

export function validateLoanAssignment({ studentId, textbookId, students, textbooks, loans }) {
  const student = students.find((item) => item.id === studentId);
  if (!student) return { ok: false, code: "student", message: "Ученик больше не найден." };
  const textbook = textbooks.find((item) => item.id === textbookId);
  if (!textbook) return { ok: false, code: "textbook", message: "Учебник больше не найден." };
  if (loanFor(loans, studentId, textbookId)) {
    return { ok: false, code: "duplicate", message: "Этот учебник уже выдан выбранному ученику." };
  }
  const stats = textbookStats(textbook, students, loans);
  if (stats.issued >= textbook.quantity) {
    return { ok: false, code: "quantity", message: "Все доступные экземпляры этого учебника уже выданы." };
  }
  return { ok: true, code: "ok", message: "" };
}

export function planTextbookDistribution({ textbook, students, loans, selectedStudentIds }) {
  const validIds = new Set(students.map((student) => student.id));
  const selected = [...new Set(selectedStudentIds)].filter((id) => validIds.has(id));
  if (selected.length > textbook.quantity) {
    return {
      ok: false,
      message: "Можно выдать не более " + textbook.quantity + " экземпляров.",
      toAdd: [],
      toRemove: []
    };
  }
  const current = new Set(loansForTextbook(loans, textbook.id).map((loan) => loan.student_id));
  return {
    ok: true,
    message: "",
    toAdd: selected.filter((id) => !current.has(id)),
    toRemove: [...current].filter((id) => !selected.includes(id))
  };
}
