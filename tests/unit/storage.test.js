import test from "node:test";
import assert from "node:assert/strict";
import {
  clearProgress,
  loadProgress,
  saveProgress,
  storageKeys
} from "../../assets/js/storage.js";

const values = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  }
};

const definition = {
  id: "storage-number",
  version: 1,
  variants: [{ id: "all", questionIds: ["number-1"] }]
};

function progress(answer) {
  return {
    schemaVersion: 1,
    testId: definition.id,
    testVersion: definition.version,
    attemptId: "attempt-number",
    variantId: "all",
    mode: "training",
    currentQuestionId: "number-1",
    baseQuestionIds: ["number-1"],
    questionOrder: ["number-1"],
    selectedAnswers: { "number-1": answer },
    checkedQuestionIds: [],
    mistakeQuestionIds: ["number-1"],
    startedAt: "2026-01-01T00:00:00.000Z"
  };
}

test.beforeEach(() => values.clear());

test("числовой ответ сохраняется и восстанавливается строкой", () => {
  saveProgress(definition.id, progress("5"));
  const restored = loadProgress(definition);
  assert.equal(restored.status, "compatible");
  assert.equal(restored.data.selectedAnswers["number-1"], "5");
});

test("десятичная запятая сохраняется без преобразования", () => {
  saveProgress(definition.id, progress("1,5"));
  const raw = JSON.parse(values.get(storageKeys.progress(definition.id)));
  assert.equal(raw.selectedAnswers["number-1"], "1,5");
  assert.equal(loadProgress(definition).data.selectedAnswers["number-1"], "1,5");
});

test("незавершённый ввод сохраняется без аварии", () => {
  saveProgress(definition.id, progress("-"));
  assert.equal(loadProgress(definition).data.selectedAnswers["number-1"], "-");
});

test("очистка удаляет числовой прогресс", () => {
  saveProgress(definition.id, progress("0"));
  clearProgress(definition.id);
  assert.deepEqual(loadProgress(definition), { status: "empty", data: null });
});
