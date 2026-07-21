import test from "node:test";
import assert from "node:assert/strict";
import {
  createAttemptQuestionOrder,
  restoreQuestionOrder
} from "../../assets/js/attempt-selection.js";

const pool = ["q1", "q2", "q3", "q4", "q5"];
const reverse = (values) => [...values].reverse();

test("selectionCount ограничивает размер выборки", () => {
  const result = createAttemptQuestionOrder({
    baseQuestionIds: pool,
    selectionCount: 3,
    shuffleQuestions: true
  }, reverse);
  assert.deepEqual(result, ["q5", "q4", "q3"]);
});

test("выборка не содержит повторов", () => {
  const result = createAttemptQuestionOrder({
    baseQuestionIds: ["q1", "q1", "q2", "q3"],
    selectionCount: 3,
    shuffleQuestions: false
  });
  assert.deepEqual(result, ["q1", "q2", "q3"]);
});

test("сохранённая конкретная выборка восстанавливается без перестановки", () => {
  assert.deepEqual(restoreQuestionOrder(["q4", "q1", "q3"], pool), ["q4", "q1", "q3"]);
});

test("без selectionCount используются все вопросы", () => {
  assert.deepEqual(createAttemptQuestionOrder({ baseQuestionIds: pool }), pool);
});

test("работа над ошибками использует только сохранённые ошибки без новой случайной выборки", () => {
  const result = createAttemptQuestionOrder({
    baseQuestionIds: pool,
    selectionCount: 2,
    shuffleQuestions: true,
    retryQuestionIds: ["q4", "q2"]
  }, reverse);
  assert.deepEqual(result, ["q4", "q2"]);
});
