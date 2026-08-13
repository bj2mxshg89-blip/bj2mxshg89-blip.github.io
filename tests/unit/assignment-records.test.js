import test from "node:test";
import assert from "node:assert/strict";
import {
  assignmentScope,
  buildAssignmentUrl,
  getAssignmentState,
  latestAttemptByAssignment,
  normalizeAssignmentId,
  parseAssignmentId,
  summarizeAssignment
} from "../../assets/js/assignment-records.js";

test("ID назначения принимает только положительное безопасное целое", () => {
  assert.equal(normalizeAssignmentId("42"), 42);
  assert.equal(normalizeAssignmentId(1), 1);
  for (const value of [null, "", "0", -1, "1.5", "12x", Number.MAX_VALUE]) {
    assert.equal(normalizeAssignmentId(value), null);
  }
});

test("личная и назначенная попытки получают разные стабильные scope", () => {
  assert.deepEqual(assignmentScope(), { scopeKey: "personal", assignmentId: null });
  assert.deepEqual(assignmentScope(17), { scopeKey: "assignment-17", assignmentId: 17 });
  assert.equal(parseAssignmentId("?id=test&assignment=17"), 17);
  assert.equal(parseAssignmentId("?assignment=broken"), null);
});

test("ссылка назначения содержит постоянные ID теста и работы", () => {
  assert.equal(
    buildAssignmentUrl({ id: 8, test_id: "organic-review" }),
    "test.html?id=organic-review&assignment=8"
  );
  assert.equal(buildAssignmentUrl({ id: 0, test_id: "organic-review" }), null);
  assert.equal(buildAssignmentUrl({ id: 8, test_id: "../secret" }), null);
});

test("последняя попытка определяется отдельно для каждого назначения", () => {
  const latest = latestAttemptByAssignment([
    { assignment_id: 4, completed_at: "2026-08-13T10:00:00Z", percent: 60 },
    { assignment_id: 4, completed_at: "2026-08-13T11:00:00Z", percent: 90 },
    { assignment_id: 5, completed_at: "2026-08-13T09:00:00Z", percent: 70 },
    { assignment_id: null, completed_at: "2026-08-13T12:00:00Z", percent: 100 }
  ]);
  assert.equal(latest.size, 2);
  assert.equal(latest.get(4).percent, 90);
  assert.equal(latest.get(5).percent, 70);
});

test("статус различает ожидание, просрочку и сдачу с опозданием", () => {
  const dueAt = "2026-08-13T10:00:00Z";
  assert.equal(getAssignmentState({ due_at: dueAt }, null, Date.parse("2026-08-13T09:00:00Z")).key, "pending");
  assert.equal(getAssignmentState({ due_at: dueAt }, null, Date.parse("2026-08-13T11:00:00Z")).key, "overdue");
  assert.equal(getAssignmentState({ due_at: dueAt }, { completed_at: "2026-08-13T09:30:00Z" }).key, "completed");
  assert.equal(getAssignmentState({ due_at: dueAt }, { completed_at: "2026-08-13T10:30:00Z" }).key, "completed-late");
});

test("сводка считает уникальных учеников, завершивших конкретную работу", () => {
  const assignment = { id: 9, classroom_id: 3 };
  const members = [
    { classroom_id: 3, student_id: "a" },
    { classroom_id: 3, student_id: "b" },
    { classroom_id: 4, student_id: "c" }
  ];
  const attempts = [
    { assignment_id: 9, user_id: "a" },
    { assignment_id: 9, user_id: "a" },
    { assignment_id: 10, user_id: "b" },
    { assignment_id: 9, user_id: "c" }
  ];
  assert.deepEqual(summarizeAssignment(assignment, members, attempts), {
    total: 2,
    completed: 1,
    remaining: 1
  });
});
