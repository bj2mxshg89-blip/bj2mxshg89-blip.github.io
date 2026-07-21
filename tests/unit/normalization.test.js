import test from "node:test";
import assert from "node:assert/strict";
import { isAnswerComplete, normalizeAnswer } from "../../assets/js/question-types.js";
import { matchingQuestion, multipleQuestion, singleQuestion } from "./fixtures.js";

test("повреждённый массив ответа нормализуется в пустой", () => {
  assert.deepEqual(normalizeAnswer(multipleQuestion, "0,2"), []);
});

test("повторяющиеся индексы удаляются", () => {
  assert.deepEqual(normalizeAnswer(multipleQuestion, [2, 0, 2, 0]), [0, 2]);
});

test("неизвестные индексы удаляются", () => {
  assert.deepEqual(normalizeAnswer(multipleQuestion, [-1, 0, 8, 2]), [0, 2]);
});

test("single сохраняет только один допустимый индекс", () => {
  assert.deepEqual(normalizeAnswer(singleQuestion, [2, 1]), [1]);
});

test("повреждённый matching-объект нормализуется в пустой", () => {
  assert.deepEqual(normalizeAnswer(matchingQuestion, ["one"]), {});
});

test("неизвестный itemId удаляется из matching", () => {
  assert.deepEqual(normalizeAnswer(matchingQuestion, { a: "one", unknown: "two" }), { a: "one" });
});

test("неизвестный optionId удаляется из matching", () => {
  assert.deepEqual(normalizeAnswer(matchingQuestion, { a: "missing", b: "two" }), { b: "two" });
});

test("неполный matching не считается завершённым", () => {
  assert.equal(isAnswerComplete(matchingQuestion, { a: "one", b: "two" }), false);
});

test("повтор варианта запрещает завершение matching", () => {
  assert.equal(isAnswerComplete(matchingQuestion, {
    a: "one", b: "one", c: "three", d: "four"
  }), false);
});
