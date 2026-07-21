import test from "node:test";
import assert from "node:assert/strict";
import { calculateResult, gradeFromPercent } from "../../assets/js/grading.js";
import { evaluateAnswer } from "../../assets/js/question-types.js";
import { grading, matchingQuestion, multipleQuestion, singleQuestion } from "./fixtures.js";

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
