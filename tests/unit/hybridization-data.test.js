import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const definition = JSON.parse(readFileSync(
  new URL("../../data/tests/hybridization-theory.json", import.meta.url),
  "utf8"
));

test("банк гибридизации содержит 7 разделов по 15 уникальных вопросов", () => {
  assert.equal(definition.questions.length, 105);
  assert.equal(new Set(definition.questions.map((question) => question.id)).size, 105);
  assert.equal(definition.sections.length, 7);
  definition.sections.forEach((section) => {
    assert.equal(
      definition.questions.filter((question) => question.section === section.id).length,
      15,
      section.id
    );
  });
});

test("распределение типов и структура matching зафиксированы", () => {
  const counts = definition.questions.reduce((result, question) => ({
    ...result,
    [question.type]: (result[question.type] || 0) + 1
  }), {});
  assert.deepEqual(counts, { single: 66, number: 24, matching: 15 });
  definition.questions.filter((question) => question.type === "matching").forEach((question) => {
    assert.equal(question.items.length, 4, question.id);
    assert.equal(question.options.length, 5, question.id);
    assert.equal(question.allowOptionReuse, false, question.id);
    assert.equal(new Set(Object.values(question.correct)).size, 4, question.id);
  });
});

test("восемь вариантов имеют фиксированные объёмы 10/15", () => {
  assert.equal(definition.variants.length, 8);
  definition.variants.forEach((variant) => {
    assert.deepEqual(variant.selectionCount, { training: 10, test: 15 });
  });
});

test("ключевые подсчёты σ- и π-связей химически согласованы", () => {
  const matchingIds = ["hybridization-matching-006", "hybridization-matching-007"];
  const actual = {};
  matchingIds.forEach((id) => {
    const question = definition.questions.find((item) => item.id === id);
    const optionMap = new Map(question.options.map((option) => [option.id, option.text]));
    question.items.forEach((item) => {
      actual[item.text] = optionMap.get(question.correct[item.id]);
    });
  });
  assert.deepEqual(actual, {
    "Метан CH₄": "4 σ, 0 π",
    "Этан C₂H₆": "7 σ, 0 π",
    "Этен C₂H₄": "5 σ, 1 π",
    "Этин C₂H₂": "3 σ, 2 π",
    "Пропан C₃H₈": "10 σ, 0 π",
    "Пропен C₃H₆": "8 σ, 1 π",
    "Пропин C₃H₄": "6 σ, 2 π",
    "Бута-1,3-диен C₄H₆": "9 σ, 2 π"
  });
});

test("формулы не используют HTML-разметку или двусмысленное выделение атома", () => {
  definition.questions.forEach((question) => {
    if (question.content) {
      assert.ok(["text", "formula"].includes(question.content.format), question.id);
      assert.doesNotMatch(question.content.text, /<\/?mark\b/i, question.id);
    }
    assert.doesNotMatch(question.text, /выделенн(ый|ого|ому)/i, question.id);
  });
});

test("формулировки модели и бензола сохраняют научные оговорки", () => {
  const allText = definition.questions
    .flatMap((question) => [question.text, question.explanation])
    .join("\n");
  assert.match(allText, /модельное математическое преобразование/);
  assert.match(allText, /реальные углы могут/);
  assert.match(allText, /делокализованную π-систему/);
});
