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

const textDefinition = {
  id: "storage-text",
  version: 1,
  variants: [{ id: "all", questionIds: ["text-1"] }]
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

function textProgress(answer) {
  return {
    schemaVersion: 1,
    testId: textDefinition.id,
    testVersion: textDefinition.version,
    attemptId: "attempt-text",
    variantId: "all",
    mode: "training",
    currentQuestionId: "text-1",
    baseQuestionIds: ["text-1"],
    questionOrder: ["text-1"],
    selectedAnswers: { "text-1": answer },
    checkedQuestionIds: [],
    mistakeQuestionIds: ["text-1"],
    startedAt: "2026-01-01T00:00:00.000Z",
    retryOf: "attempt-original"
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

test("исходная text-строка сохраняется и восстанавливается без нормализации", () => {
  saveProgress(textDefinition.id, textProgress("  Окислитель  "));
  const restored = loadProgress(textDefinition);
  assert.equal(restored.status, "compatible");
  assert.equal(restored.data.selectedAnswers["text-1"], "  Окислитель  ");
});

test("пробелы и промежуточный text-ответ сохраняются без исключения", () => {
  saveProgress(textDefinition.id, textProgress("  "));
  assert.equal(loadProgress(textDefinition).data.selectedAnswers["text-1"], "  ");
  saveProgress(textDefinition.id, textProgress("окисл"));
  assert.equal(loadProgress(textDefinition).data.selectedAnswers["text-1"], "окисл");
});

test("работа над ошибкой сохраняет тот же ID текстового вопроса", () => {
  saveProgress(textDefinition.id, textProgress("восстановитель"));
  const restored = loadProgress(textDefinition).data;
  assert.deepEqual(restored.questionOrder, ["text-1"]);
  assert.deepEqual(restored.mistakeQuestionIds, ["text-1"]);
  assert.equal(restored.retryOf, "attempt-original");
});

test("назначенная работа не затирает личный прогресс того же теста", () => {
  const personal = progress("1");
  const assigned = { ...progress("2"), attemptId: "assignment-attempt", assignmentId: 7 };
  saveProgress(definition.id, personal);
  saveProgress(definition.id, assigned, "assignment-7");

  assert.equal(loadProgress(definition).data.attemptId, "attempt-number");
  assert.equal(loadProgress(definition, "assignment-7").data.attemptId, "assignment-attempt");
  assert.notEqual(
    storageKeys.progress(definition.id),
    storageKeys.progress(definition.id, "assignment-7")
  );

  clearProgress(definition.id, "assignment-7");
  assert.equal(loadProgress(definition, "assignment-7").status, "empty");
  assert.equal(loadProgress(definition).status, "compatible");
});

test("прогресс другого назначения считается несовместимым", () => {
  saveProgress(definition.id, { ...progress("2"), assignmentId: 8 }, "assignment-7");
  assert.equal(loadProgress(definition, "assignment-7").status, "incompatible");
});
