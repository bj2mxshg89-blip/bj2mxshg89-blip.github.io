import test from "node:test";
import assert from "node:assert/strict";
import {
  attemptToCloudRow,
  chooseProgressSource,
  cloudRowToAttempt,
  mergeAttemptHistory
} from "../../assets/js/cloud-records.js";

const localProgress = {
  status: "compatible",
  data: { attemptId: "local", updatedAt: "2026-08-13T10:00:00.000Z" }
};

test("более новый облачный прогресс заменяет локальный", () => {
  const selected = chooseProgressSource(localProgress, {
    payload: { attemptId: "cloud" },
    updated_at: "2026-08-13T11:00:00.000Z"
  });
  assert.equal(selected.source, "cloud");
  assert.equal(selected.data.attemptId, "cloud");
});

test("при более новом локальном прогрессе выбирается локальная копия", () => {
  const selected = chooseProgressSource(localProgress, {
    payload: { attemptId: "cloud", updatedAt: "2026-08-13T09:00:00.000Z" }
  });
  assert.equal(selected.source, "local");
});

test("пустые и повреждённые данные не вызывают исключение", () => {
  assert.deepEqual(chooseProgressSource({ status: "empty", data: null }, null), {
    source: "none",
    data: null
  });
  assert.equal(chooseProgressSource({ status: "empty", data: null }, { payload: "broken" }).source, "none");
});

test("завершённая попытка преобразуется в строку базы и обратно", () => {
  const attempt = {
    attemptId: "attempt-1",
    testId: "organic-review",
    testVersion: 1,
    variantId: "1",
    mode: "training",
    startedAt: "2026-08-13T10:00:00.000Z",
    completedAt: "2026-08-13T10:02:00.000Z",
    durationMs: 120000,
    correctCount: 8,
    totalQuestions: 10,
    earnedPoints: 8,
    maxPoints: 10,
    percent: 80,
    grade: 4,
    questionIds: ["q1", "q2"],
    mistakeQuestionIds: ["q2"],
    selectedAnswers: { q1: [0], q2: [1] },
    retryOf: null,
    assignmentId: 23
  };
  const row = attemptToCloudRow("user-1", attempt);
  assert.equal(row.user_id, "user-1");
  assert.equal(row.total_questions, 10);
  assert.equal(row.assignment_id, 23);
  assert.deepEqual(cloudRowToAttempt(row).mistakeQuestionIds, ["q2"]);
  assert.equal(cloudRowToAttempt(row).assignmentId, 23);
});

test("слияние истории удаляет дубликаты по attemptId и сохраняет порядок", () => {
  const local = [{ attemptId: "same", completedAt: "2026-08-13T10:00:00Z", percent: 10 }];
  const cloud = [{
    attempt_id: "same", test_id: "x", test_version: 1, variant_id: "all", mode: "test",
    started_at: "2026-08-13T09:00:00Z", completed_at: "2026-08-13T10:00:00Z",
    duration_ms: 1, correct_count: 1, total_questions: 1, earned_points: 1, max_points: 1,
    percent: 100, grade: 5, question_ids: ["q"], mistake_question_ids: [], selected_answers: {}
  }];
  const merged = mergeAttemptHistory(local, cloud);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].percent, 100);
  assert.equal(merged[0].cloud, true);
});
