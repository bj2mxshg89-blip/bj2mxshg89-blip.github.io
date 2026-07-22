import test from "node:test";
import assert from "node:assert/strict";
import { calculateResult, gradeFromPercent } from "../../assets/js/grading.js";
import { evaluateAnswer, getQuestionMaxPoints } from "../../assets/js/question-types.js";
import {
  decimalNumberQuestion,
  grading,
  matchingQuestion,
  multipleQuestion,
  numberQuestion,
  singleQuestion
} from "./fixtures.js";

test("single: правильный и неправильный ответы", () => {
  assert.deepEqual(evaluateAnswer(singleQuestion, [1]), {
    earnedPoints: 1, maxPoints: 1, isFullyCorrect: true, details: []
  });
  assert.equal(evaluateAnswer(singleQuestion, [0]).earnedPoints, 0);
});

test("multiple: полный набор даёт один балл", () => {
  const result = evaluateAnswer(multipleQuestion, [2, 0]);
  assert.equal(result.earnedPoints, 1);
  assert.equal(result.isFullyCorrect, true);
});

test("multiple: неполный набор не получает частичный балл", () => {
  const result = evaluateAnswer(multipleQuestion, [0]);
  assert.equal(result.earnedPoints, 0);
  assert.equal(result.maxPoints, 1);
  assert.equal(result.isFullyCorrect, false);
});

test("matching: результат 4/4", () => {
  const result = evaluateAnswer(matchingQuestion, matchingQuestion.correct);
  assert.equal(result.earnedPoints, 4);
  assert.equal(result.maxPoints, 4);
  assert.equal(result.isFullyCorrect, true);
});

test("matching: результат 3/4", () => {
  const result = evaluateAnswer(matchingQuestion, {
    a: "one", b: "two", c: "three", d: "extra"
  });
  assert.equal(result.earnedPoints, 3);
  assert.equal(result.maxPoints, 4);
  assert.equal(result.isFullyCorrect, false);
});

test("matching: результат 0/4", () => {
  const result = evaluateAnswer(matchingQuestion, {
    a: "two", b: "three", c: "four", d: "extra"
  });
  assert.equal(result.earnedPoints, 0);
  assert.equal(result.isFullyCorrect, false);
});

test("number: точное совпадение даёт один балл", () => {
  const result = evaluateAnswer(numberQuestion, "5");
  assert.equal(result.earnedPoints, 1);
  assert.equal(result.maxPoints, 1);
  assert.equal(result.isFullyCorrect, true);
  assert.equal(getQuestionMaxPoints(numberQuestion), 1);
});

test("number: неправильный и повреждённый ответы безопасны", () => {
  assert.equal(evaluateAnswer(numberQuestion, "4").earnedPoints, 0);
  assert.equal(evaluateAnswer(numberQuestion, "12abc").earnedPoints, 0);
  assert.equal(evaluateAnswer(numberQuestion, null).earnedPoints, 0);
});

test("number: допуск включает границу и исключает значение за ней", () => {
  assert.equal(evaluateAnswer(decimalNumberQuestion, "12,4").isFullyCorrect, true);
  assert.equal(evaluateAnswer(decimalNumberQuestion, "12.6").isFullyCorrect, true);
  assert.equal(evaluateAnswer(decimalNumberQuestion, "12,61").isFullyCorrect, false);
});

test("number: ноль может быть правильным ответом", () => {
  const zeroQuestion = { ...numberQuestion, correct: 0 };
  assert.equal(evaluateAnswer(zeroQuestion, "0").isFullyCorrect, true);
  assert.equal(evaluateAnswer(zeroQuestion, "").isFullyCorrect, false);
});

test("number: ошибка целиком попадает в mistakes", () => {
  const definition = { questions: [numberQuestion], grading };
  const result = calculateResult({
    test: definition,
    questionIds: [numberQuestion.id],
    answers: { [numberQuestion.id]: "4" },
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: new Date("2026-01-01T00:00:10.000Z")
  });
  assert.deepEqual(result.mistakes, [numberQuestion.id]);
  assert.equal(result.maxPoints, 1);
});

test("общий результат суммирует баллы разных типов", () => {
  const definition = {
    questions: [singleQuestion, multipleQuestion, matchingQuestion],
    grading
  };
  const result = calculateResult({
    test: definition,
    questionIds: [singleQuestion.id, multipleQuestion.id, matchingQuestion.id],
    answers: {
      [singleQuestion.id]: [1],
      [multipleQuestion.id]: [0],
      [matchingQuestion.id]: { a: "one", b: "two", c: "three", d: "extra" }
    },
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: new Date("2026-01-01T00:01:00.000Z")
  });
  assert.equal(result.earnedPoints, 4);
  assert.equal(result.maxPoints, 6);
  assert.equal(result.percent, 67);
  assert.equal(result.grade, 3);
  assert.deepEqual(result.mistakes, [multipleQuestion.id, matchingQuestion.id]);
});

test("шкала оценивания соблюдает границы 49/50/69/70/89/90", () => {
  const expected = new Map([[49, 2], [50, 3], [69, 3], [70, 4], [89, 4], [90, 5]]);
  expected.forEach((grade, percent) => assert.equal(gradeFromPercent(percent, grading), grade));
});
