import test from "node:test";
import assert from "node:assert/strict";
import { calculateResult } from "../../assets/js/grading.js";
import {
  createQuestionOptionOrder,
  evaluateAnswer,
  getEmptyAnswer,
  getQuestionMaxPoints,
  hasAnyAnswer,
  incompleteAnswerMessage,
  isAnswerComplete,
  normalizeAnswer,
  normalizeQuestionOptionOrder,
  updateQuestionAnswer,
  validateQuestionType
} from "../../assets/js/question-types.js";
import {
  loadProgress,
  saveProgress,
  storageKeys
} from "../../assets/js/storage.js";
import { grading, sequenceQuestion } from "./fixtures.js";

const clone = (value) => structuredClone(value);

function validationErrors(mutate = () => {}) {
  const question = clone(sequenceQuestion);
  mutate(question);
  const errors = [];
  validateQuestionType(question, errors);
  return errors.join("\n");
}

test("sequence: корректная схема проходит валидацию", () => {
  assert.equal(validationErrors(), "");
});

test("sequence: items должен содержать минимум два элемента", () => {
  assert.match(validationErrors((question) => {
    question.items = question.items.slice(0, 1);
    question.correct = ["a"];
  }), /unit-sequence.*items.*минимум два/);
});

test("sequence: пустой item ID отклоняется", () => {
  assert.match(validationErrors((question) => {
    question.items[0].id = "";
  }), /items\[0\]\.id/);
});

test("sequence: повторный item ID отклоняется", () => {
  assert.match(validationErrors((question) => {
    question.items[1].id = "a";
  }), /повторный itemId «a»/);
});

test("sequence: неизвестный ID в correct отклоняется", () => {
  assert.match(validationErrors((question) => {
    question.correct[3] = "unknown";
  }), /correct.*неизвестный itemId «unknown»/);
});

test("sequence: отсутствующий ID в correct называется в ошибке", () => {
  assert.match(validationErrors((question) => {
    question.correct = ["a", "b", "c", "c"];
  }), /correct.*не содержит itemId «d»/);
});

test("sequence: повтор в correct отклоняется", () => {
  assert.match(validationErrors((question) => {
    question.correct = ["a", "b", "b", "d"];
  }), /correct.*повторный itemId «b»/);
});

test("sequence: разная длина items и correct отклоняется", () => {
  assert.match(validationErrors((question) => {
    question.correct.pop();
  }), /длина.*correct.*items/);
});

test("sequence: неизвестный format отклоняется", () => {
  assert.match(validationErrors((question) => {
    question.items[0].format = "html";
  }), /items\[0\]\.format/);
});

test("sequence: неизвестный scoring отклоняется", () => {
  assert.match(validationErrors((question) => {
    question.sequence.scoring = "all-or-nothing";
  }), /sequence\.scoring/);
});

test("sequence: повреждённый объект настроек отклоняется", () => {
  assert.match(validationErrors((question) => {
    question.sequence = null;
  }), /sequence.*объект/);
});

test("sequence: правильная перестановка сохраняется", () => {
  assert.deepEqual(
    normalizeAnswer(sequenceQuestion, { order: ["c", "a", "d", "b"], touched: true }),
    { order: ["c", "a", "d", "b"], touched: true }
  );
});

test("sequence: неизвестный ID отбрасывается", () => {
  assert.deepEqual(
    normalizeAnswer(sequenceQuestion, { order: ["c", "unknown", "a"], touched: true }),
    { order: ["c", "a", "b", "d"], touched: true }
  );
});

test("sequence: повтор ID удаляется", () => {
  assert.deepEqual(
    normalizeAnswer(sequenceQuestion, { order: ["b", "b", "a"], touched: true }),
    { order: ["b", "a", "c", "d"], touched: true }
  );
});

test("sequence: отсутствующие ID возвращаются в порядке fallback", () => {
  assert.deepEqual(
    normalizeAnswer(
      sequenceQuestion,
      { order: ["c"], touched: false },
      ["d", "b", "a", "c"]
    ),
    { order: ["c", "d", "b", "a"], touched: false }
  );
});

test("sequence: строка вместо массива безопасно заменяется fallback", () => {
  assert.deepEqual(
    normalizeAnswer(sequenceQuestion, "a,b,c,d", ["d", "c", "b", "a"]),
    { order: ["d", "c", "b", "a"], touched: false }
  );
});

test("sequence: объект с числовыми ключами безопасно заменяется fallback", () => {
  assert.deepEqual(
    normalizeAnswer(sequenceQuestion, { 0: "a" }, ["b", "d", "a", "c"]),
    { order: ["b", "d", "a", "c"], touched: false }
  );
});

test("sequence: null и пустой массив восстанавливают полный набор", () => {
  assert.deepEqual(normalizeAnswer(sequenceQuestion, null).order, ["a", "b", "c", "d"]);
  assert.deepEqual(normalizeAnswer(sequenceQuestion, []).order, ["a", "b", "c", "d"]);
});

test("sequence: известный относительный порядок сохраняется", () => {
  assert.deepEqual(
    normalizeAnswer(sequenceQuestion, ["d", "b", "unknown", "d"]).order.slice(0, 2),
    ["d", "b"]
  );
});

test("sequence: начальный ответ полный, но ещё не отмечен как взаимодействие", () => {
  const answer = getEmptyAnswer(sequenceQuestion, ["d", "b", "a", "c"]);
  assert.deepEqual(answer, { order: ["d", "b", "a", "c"], touched: false });
  assert.equal(isAnswerComplete(sequenceQuestion, answer), true);
  assert.equal(hasAnyAnswer(sequenceQuestion, answer), false);
  assert.equal(incompleteAnswerMessage(sequenceQuestion, answer), "Расположите все элементы в требуемом порядке.");
});

test("sequence: перемещение вверх не мутирует исходный ответ", () => {
  const source = { order: ["a", "b", "c", "d"], touched: false };
  const result = updateQuestionAnswer(sequenceQuestion, source, {
    action: "move", itemId: "c", direction: "up"
  });
  assert.deepEqual(result, { order: ["a", "c", "b", "d"], touched: true });
  assert.deepEqual(source, { order: ["a", "b", "c", "d"], touched: false });
});

test("sequence: перемещение вниз работает", () => {
  assert.deepEqual(
    updateQuestionAnswer(sequenceQuestion, { order: ["a", "b", "c", "d"], touched: false }, {
      action: "move", itemId: "b", direction: "down"
    }).order,
    ["a", "c", "b", "d"]
  );
});

test("sequence: верхний элемент нельзя поднять", () => {
  assert.deepEqual(
    updateQuestionAnswer(sequenceQuestion, { order: ["a", "b", "c", "d"], touched: false }, {
      action: "move", itemId: "a", direction: "up"
    }),
    { order: ["a", "b", "c", "d"], touched: false }
  );
});

test("sequence: нижний элемент нельзя опустить", () => {
  assert.deepEqual(
    updateQuestionAnswer(sequenceQuestion, { order: ["a", "b", "c", "d"], touched: true }, {
      action: "move", itemId: "d", direction: "down"
    }),
    { order: ["a", "b", "c", "d"], touched: true }
  );
});

test("sequence: неизвестный itemId и повреждённое действие безопасны", () => {
  const source = { order: ["a", "b", "c", "d"], touched: false };
  assert.deepEqual(
    updateQuestionAnswer(sequenceQuestion, source, {
      action: "move", itemId: "unknown", direction: "up"
    }),
    source
  );
  assert.deepEqual(updateQuestionAnswer(sequenceQuestion, source, null), source);
});

test("sequence: drag-перестановка нормализуется и не мутирует исходник", () => {
  const source = { order: ["a", "b", "c", "d"], touched: false };
  const result = updateQuestionAnswer(sequenceQuestion, source, {
    action: "reorder", order: ["d", "unknown", "b", "b"]
  });
  assert.deepEqual(result, { order: ["d", "b", "a", "c"], touched: true });
  assert.deepEqual(source.order, ["a", "b", "c", "d"]);
});

test("sequence: правильный порядок оценивается 4/4", () => {
  const result = evaluateAnswer(sequenceQuestion, { order: ["a", "b", "c", "d"], touched: true });
  assert.equal(result.earnedPoints, 4);
  assert.equal(result.maxPoints, 4);
  assert.equal(result.isFullyCorrect, true);
  assert.equal(getQuestionMaxPoints(sequenceQuestion), 4);
});

test("sequence: две переставленные позиции дают 2/4", () => {
  const result = evaluateAnswer(sequenceQuestion, { order: ["a", "c", "b", "d"], touched: true });
  assert.equal(result.earnedPoints, 2);
  assert.equal(result.maxPoints, 4);
  assert.equal(result.isFullyCorrect, false);
  assert.deepEqual(result.details.map((detail) => detail.correct), [true, false, false, true]);
});

test("sequence: циклический сдвиг даёт 0/4", () => {
  const result = evaluateAnswer(sequenceQuestion, { order: ["b", "c", "d", "a"], touched: true });
  assert.equal(result.earnedPoints, 0);
  assert.equal(result.isFullyCorrect, false);
});

test("sequence: для полной перестановки четырёх элементов результат 3/4 математически невозможен", () => {
  const permutations = [
    ["a", "b", "c", "d"], ["a", "b", "d", "c"], ["a", "c", "b", "d"], ["a", "c", "d", "b"],
    ["a", "d", "b", "c"], ["a", "d", "c", "b"], ["b", "a", "c", "d"], ["b", "a", "d", "c"],
    ["b", "c", "a", "d"], ["b", "c", "d", "a"], ["b", "d", "a", "c"], ["b", "d", "c", "a"],
    ["c", "a", "b", "d"], ["c", "a", "d", "b"], ["c", "b", "a", "d"], ["c", "b", "d", "a"],
    ["c", "d", "a", "b"], ["c", "d", "b", "a"], ["d", "a", "b", "c"], ["d", "a", "c", "b"],
    ["d", "b", "a", "c"], ["d", "b", "c", "a"], ["d", "c", "a", "b"], ["d", "c", "b", "a"]
  ];
  assert.equal(permutations.some((order) => evaluateAnswer(sequenceQuestion, order).earnedPoints === 3), false);
});

test("sequence: частичная ошибка целиком входит в mistakes", () => {
  const result = calculateResult({
    test: { questions: [sequenceQuestion], grading },
    questionIds: [sequenceQuestion.id],
    answers: { [sequenceQuestion.id]: { order: ["a", "c", "b", "d"], touched: true } },
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: new Date("2026-01-01T00:00:10.000Z")
  });
  assert.deepEqual(result.mistakes, [sequenceQuestion.id]);
  assert.equal(result.earnedPoints, 2);
  assert.equal(result.maxPoints, 4);
});

const values = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  }
};

const storageDefinition = {
  id: "storage-sequence",
  version: 1,
  variants: [{ id: "sequence", questionIds: [sequenceQuestion.id] }]
};

function sequenceProgress(answer, optionOrder) {
  return {
    schemaVersion: 1,
    testId: storageDefinition.id,
    testVersion: storageDefinition.version,
    attemptId: "attempt-sequence",
    variantId: "sequence",
    mode: "training",
    currentQuestionId: sequenceQuestion.id,
    baseQuestionIds: [sequenceQuestion.id],
    questionOrder: [sequenceQuestion.id],
    optionOrder: { [sequenceQuestion.id]: optionOrder },
    selectedAnswers: { [sequenceQuestion.id]: answer },
    checkedQuestionIds: [],
    mistakeQuestionIds: [sequenceQuestion.id],
    startedAt: "2026-01-01T00:00:00.000Z",
    retryOf: "attempt-original"
  };
}

test.beforeEach(() => values.clear());

test("sequence: порядок сохраняется и после reload восстанавливается точно", () => {
  const answer = { order: ["c", "a", "d", "b"], touched: true };
  saveProgress(storageDefinition.id, sequenceProgress(answer, ["c", "a", "d", "b"]));
  const restored = loadProgress(storageDefinition);
  assert.equal(restored.status, "compatible");
  assert.deepEqual(restored.data.selectedAnswers[sequenceQuestion.id], answer);
  assert.deepEqual(restored.data.optionOrder[sequenceQuestion.id], ["c", "a", "d", "b"]);
});

test("sequence: начальная перестановка не меняется при повторной нормализации", () => {
  const initial = ["d", "b", "a", "c"];
  assert.deepEqual(normalizeQuestionOptionOrder(sequenceQuestion, initial), initial);
  assert.deepEqual(getEmptyAnswer(sequenceQuestion, initial).order, initial);
  assert.deepEqual(getEmptyAnswer(sequenceQuestion, initial).order, initial);
});

test("sequence: повтор ошибки использует тот же question ID", () => {
  saveProgress(
    storageDefinition.id,
    sequenceProgress({ order: ["a", "c", "b", "d"], touched: true }, ["a", "c", "b", "d"])
  );
  const restored = loadProgress(storageDefinition).data;
  assert.deepEqual(restored.questionOrder, [sequenceQuestion.id]);
  assert.deepEqual(restored.mistakeQuestionIds, [sequenceQuestion.id]);
  assert.equal(restored.retryOf, "attempt-original");
});

test("sequence: новая попытка может создать новый начальный порядок", () => {
  const reversed = createQuestionOptionOrder(sequenceQuestion, (values) => [...values].reverse());
  const rotated = createQuestionOptionOrder(sequenceQuestion, (values) => [...values.slice(1), values[0]]);
  assert.deepEqual(reversed, ["d", "c", "b", "a"]);
  assert.deepEqual(rotated, ["b", "c", "d", "a"]);
  assert.notDeepEqual(reversed, rotated);
});

test("sequence: сохранение содержит объект order/touched, а не отображаемый текст", () => {
  const answer = { order: ["b", "a", "d", "c"], touched: true };
  saveProgress(storageDefinition.id, sequenceProgress(answer, answer.order));
  const raw = JSON.parse(values.get(storageKeys.progress(storageDefinition.id)));
  assert.deepEqual(raw.selectedAnswers[sequenceQuestion.id], answer);
  assert.equal(JSON.stringify(raw).includes('"A"'), false);
});
