import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStudentInput,
  normalizeTextbookInput,
  parseBulkStudents,
  planTextbookDistribution,
  sortStudents,
  studentDisplayName,
  textbookStats,
  validateLoanAssignment,
  validateStudentInput,
  validateTextbookInput
} from "../../assets/js/textbook-registry.js";

const students = [
  { id: "s2", last_name: "Петрова", first_name: "Анна" },
  { id: "s1", last_name: "Иванов", first_name: "Максим" },
  { id: "s3", last_name: "Сидоров", first_name: "Алексей" }
];
const textbooks = [{ id: "b1", title: "Биология, 8 класс", quantity: 2 }];

test("данные ученика нормализуются и содержат только фамилию и имя", () => {
  const value = normalizeStudentInput("  Иванов  ", " Максим ");
  assert.deepEqual(value, { last_name: "Иванов", first_name: "Максим" });
  assert.equal(validateStudentInput(value), "");
  assert.equal(studentDisplayName(value), "Иванов Максим");
});

test("массовый ввод принимает формат «Фамилия Имя» и удаляет повторы", () => {
  const parsed = parseBulkStudents("Иванов Максим\nПетрова Анна\nИванов Максим");
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.students.length, 2);
  assert.equal(parsed.duplicateCount, 1);
});

test("массовый ввод отклоняет отчество и неполную строку", () => {
  const parsed = parseBulkStudents("Иванов Максим Сергеевич\nПетрова");
  assert.equal(parsed.students.length, 0);
  assert.equal(parsed.errors.length, 2);
  assert.match(parsed.errors[0], /без отчества/);
});

test("ученики сортируются по фамилии и имени без мутации исходного массива", () => {
  const original = students.map((student) => student.id);
  assert.deepEqual(sortStudents(students).map((student) => student.id), ["s1", "s2", "s3"]);
  assert.deepEqual(students.map((student) => student.id), original);
});

test("название и количество учебника валидируются", () => {
  assert.deepEqual(normalizeTextbookInput("  Биология, 8 класс ", "30"), {
    title: "Биология, 8 класс",
    quantity: 30
  });
  assert.equal(validateTextbookInput({ title: "Биология", quantity: 30 }), "");
  assert.match(validateTextbookInput({ title: "Биология", quantity: 2.5 }), /целым числом/);
  assert.match(validateTextbookInput({ title: "", quantity: 30 }), /название/);
});

test("статистика учебника считает полученные, выданные, остаток и учеников без учебника", () => {
  const loans = [
    { id: "l1", student_id: "s1", textbook_id: "b1" },
    { id: "l2", student_id: "s2", textbook_id: "b1" }
  ];
  assert.deepEqual(textbookStats(textbooks[0], students, loans), {
    received: 2,
    issued: 2,
    remaining: 0,
    without: 1
  });
});

test("повторная выдача и превышение количества блокируются", () => {
  const oneLoan = [{ id: "l1", student_id: "s1", textbook_id: "b1" }];
  assert.equal(validateLoanAssignment({ studentId: "s1", textbookId: "b1", students, textbooks, loans: oneLoan }).code, "duplicate");
  const full = [...oneLoan, { id: "l2", student_id: "s2", textbook_id: "b1" }];
  assert.equal(validateLoanAssignment({ studentId: "s3", textbookId: "b1", students, textbooks, loans: full }).code, "quantity");
});

test("план массовой раздачи вычисляет добавления и возвраты", () => {
  const current = [{ id: "l1", student_id: "s1", textbook_id: "b1" }];
  const plan = planTextbookDistribution({
    textbook: textbooks[0], students, loans: current, selectedStudentIds: ["s2", "s3"]
  });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.toAdd, ["s2", "s3"]);
  assert.deepEqual(plan.toRemove, ["s1"]);
});

test("план массовой раздачи не допускает больше отметок, чем экземпляров", () => {
  const plan = planTextbookDistribution({
    textbook: textbooks[0], students, loans: [], selectedStudentIds: ["s1", "s2", "s3"]
  });
  assert.equal(plan.ok, false);
  assert.match(plan.message, /не более 2/);
});
