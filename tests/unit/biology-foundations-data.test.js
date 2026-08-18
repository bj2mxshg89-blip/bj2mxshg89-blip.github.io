import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getQuestionMaxPoints } from "../../assets/js/question-types.js";
import { validateTestContent } from "../../scripts/lib/data-validation.mjs";

const definition = JSON.parse(readFileSync(
  new URL("../../data/tests/biology-foundations.json", import.meta.url),
  "utf8"
));

const expectedSections = {
  organization: 15,
  properties: 6,
  cell: 25,
  tissues: 17,
  organs: 10,
  roots: 17,
  integration: 10
};

test("большая диагностика проходит общую валидацию", () => {
  const { errors } = validateTestContent(definition, "biology-foundations");
  assert.deepEqual(errors, []);
});

test("банк содержит 100 постоянных уникальных вопросов в семи разделах", () => {
  assert.equal(definition.questions.length, 100);
  assert.equal(new Set(definition.questions.map((question) => question.id)).size, 100);
  assert.deepEqual(
    definition.sections.map((section) => section.id),
    Object.keys(expectedSections)
  );
  Object.entries(expectedSections).forEach(([section, count]) => {
    assert.equal(
      definition.questions.filter((question) => question.section === section).length,
      count,
      section
    );
  });
});

test("распределение типов совпадает с подготовленным банком", () => {
  const counts = Object.fromEntries(
    Object.entries(Object.groupBy(definition.questions, (question) => question.type))
      .map(([type, questions]) => [type, questions.length])
  );
  assert.deepEqual(counts, {
    single: 67,
    multiple: 12,
    matching: 6,
    sequence: 5,
    text: 10
  });
});

test("девять вариантов покрывают полную, краткую и тематические диагностики", () => {
  assert.deepEqual(definition.variants.map((variant) => variant.id), [
    "full", "quick", "organization", "properties", "cell",
    "tissues", "organs", "roots", "integration"
  ]);
  assert.equal(definition.variants[0].questionIds.length, 100);
  assert.equal(definition.variants[1].questionIds.length, 30);

  definition.variants.slice(2).forEach((variant) => {
    assert.equal(variant.questionIds.length, expectedSections[variant.id], variant.id);
    assert.deepEqual(variant.selectionCount, {
      training: expectedSections[variant.id],
      test: expectedSections[variant.id]
    });
    variant.questionIds.forEach((questionId) => {
      const question = definition.questions.find((item) => item.id === questionId);
      assert.equal(question.section, variant.id, questionId);
    });
  });
});

test("matching имеет пояснения строк, а matching и sequence — корректный максимум", () => {
  definition.questions
    .filter((question) => question.type === "matching")
    .forEach((question) => {
      assert.ok(question.items.every((item) => item.explanation?.trim()), question.id);
    });

  definition.questions
    .filter((question) => question.type === "matching" || question.type === "sequence")
    .forEach((question) => {
      assert.ok(question.items.length >= 2, question.id);
      assert.equal(getQuestionMaxPoints(question), question.items.length, question.id);
    });
});

test("банк не содержит персональных данных и полей класса", () => {
  const serialized = JSON.stringify(definition).toLowerCase();
  assert.doesNotMatch(
    serialized,
    /имя ученика|фамили[яи]|название класса|studentname|classname/
  );
});
