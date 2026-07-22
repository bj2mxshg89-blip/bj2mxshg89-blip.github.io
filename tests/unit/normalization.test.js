import test from "node:test";
import assert from "node:assert/strict";
import {
  hasAnyAnswer,
  incompleteAnswerMessage,
  isAnswerComplete,
  normalizeAnswer,
  normalizeTextForComparison,
  parseNumberAnswer,
  updateQuestionAnswer
} from "../../assets/js/question-types.js";
import {
  decimalNumberQuestion,
  matchingQuestion,
  multipleQuestion,
  numberQuestion,
  oxidationStateTextQuestion,
  singleQuestion,
  textQuestion
} from "./fixtures.js";

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

test("number хранит строку и не путает пустой ответ с нулём", () => {
  assert.equal(normalizeAnswer(numberQuestion, ""), "");
  assert.equal(normalizeAnswer(numberQuestion, "0"), "0");
  assert.equal(normalizeAnswer(numberQuestion, 0), "0");
  assert.equal(hasAnyAnswer(numberQuestion, ""), false);
  assert.equal(hasAnyAnswer(numberQuestion, "0"), true);
});

test("number принимает положительные и отрицательные целые", () => {
  assert.deepEqual(parseNumberAnswer(numberQuestion, "7"), {
    valid: true, enteredText: "7", parsedValue: 7, reason: null
  });
  const unrestricted = { ...numberQuestion, number: { ...numberQuestion.number, min: -10 } };
  assert.equal(parseNumberAnswer(unrestricted, "-3").parsedValue, -3);
});

test("number принимает десятичную точку и запятую", () => {
  assert.equal(parseNumberAnswer(decimalNumberQuestion, "1.5").parsedValue, 1.5);
  assert.equal(parseNumberAnswer(decimalNumberQuestion, "1,5").parsedValue, 1.5);
  assert.equal(updateQuestionAnswer(decimalNumberQuestion, "1", { value: "1,5" }), "1,5");
});

test("number удаляет пробелы по краям", () => {
  assert.equal(normalizeAnswer(decimalNumberQuestion, "  1,5  "), "1,5");
  assert.equal(parseNumberAnswer(decimalNumberQuestion, "  1,5  ").parsedValue, 1.5);
});

test("number отклоняет экспоненту, NaN, Infinity, hex и посторонние символы", () => {
  ["1e3", "NaN", "Infinity", "0x10", "12abc", "1,2,3", "--"].forEach((value) => {
    assert.equal(parseNumberAnswer(decimalNumberQuestion, value).valid, false, value);
  });
});

test("integer запрещает десятичное значение", () => {
  assert.equal(isAnswerComplete(numberQuestion, "5"), true);
  assert.equal(isAnswerComplete(numberQuestion, "5,5"), false);
  assert.equal(incompleteAnswerMessage(numberQuestion, "5,5"), "Введите одно целое число.");
});

test("number соблюдает min и max вместе с границами", () => {
  assert.equal(isAnswerComplete(numberQuestion, "0"), true);
  assert.equal(isAnswerComplete(numberQuestion, "50"), true);
  assert.equal(isAnswerComplete(numberQuestion, "-1"), false);
  assert.equal(isAnswerComplete(numberQuestion, "51"), false);
  assert.equal(incompleteAnswerMessage(numberQuestion, "51"), "Введите число от 0 до 50.");
});

test("повреждённый number безопасно нормализуется", () => {
  assert.equal(normalizeAnswer(numberQuestion, null), "");
  assert.equal(normalizeAnswer(numberQuestion, { value: 5 }), "");
  assert.equal(isAnswerComplete(numberQuestion, "-"), false);
});

test("text хранит исходную строку и безопасно отбрасывает неизвестный тип значения", () => {
  assert.equal(normalizeAnswer(textQuestion, "  Окислитель  "), "  Окислитель  ");
  assert.equal(normalizeAnswer(textQuestion, null), "");
  assert.equal(normalizeAnswer(textQuestion, ["окислитель"]), "");
  assert.equal(normalizeAnswer(textQuestion, { value: "окислитель" }), "");
});

test("text различает пустую строку и введённый ответ", () => {
  assert.equal(normalizeTextForComparison(textQuestion, ""), "");
  assert.equal(hasAnyAnswer(textQuestion, "   "), false);
  assert.equal(hasAnyAnswer(textQuestion, "0"), true);
  assert.equal(isAnswerComplete(textQuestion, "0"), true);
});

test("text обрезает края и сворачивает внутренние пробелы только для сравнения", () => {
  assert.equal(normalizeTextForComparison(textQuestion, "  отдача   электронов  "), "отдача электронов");
  assert.equal(normalizeAnswer(textQuestion, "  отдача   электронов  "), "  отдача   электронов  ");
});

test("text нормализует регистр, включая кириллицу", () => {
  assert.equal(normalizeTextForComparison(textQuestion, "ОКИСЛИТЕЛЬ"), "окислитель");
  const sensitive = {
    ...textQuestion,
    textAnswer: { ...textQuestion.textAnswer, caseSensitive: true }
  };
  assert.equal(normalizeTextForComparison(sensitive, "Окислитель"), "Окислитель");
});

test("text приводит Unicode minus к дефису, но сохраняет знак и порядок", () => {
  ["−3", "–3", "—3", "-3"].forEach((value) => {
    assert.equal(normalizeTextForComparison(oxidationStateTextQuestion, value), "-3");
  });
  assert.equal(normalizeTextForComparison(oxidationStateTextQuestion, "+6"), "+6");
  assert.notEqual(normalizeTextForComparison(oxidationStateTextQuestion, "6+"), "+6");
});

test("text отклоняет строку длиннее maxLength", () => {
  const value = "а".repeat(textQuestion.textAnswer.maxLength + 1);
  assert.equal(isAnswerComplete(textQuestion, value), false);
  assert.equal(
    incompleteAnswerMessage(textQuestion, value),
    "Ответ слишком длинный. Допустимо не более 30 символов."
  );
});
