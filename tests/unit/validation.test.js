import test from "node:test";
import assert from "node:assert/strict";
import {
  SUPPORTED_QUESTION_TYPES,
  validateTestDefinition
} from "../../assets/js/utils.js";

function validDefinition() {
  return {
    schemaVersion: 1,
    id: "unit-number-test",
    version: 1,
    title: "Числовой тест",
    description: "Проверка универсального числового вопроса.",
    subject: "chemistry",
    category: "organic",
    symbol: "№",
    theme: { accent: "#5b4bc4", soft: "#f0edff" },
    modes: {
      training: { enabled: true, instantFeedback: true, showExplanation: true },
      test: { enabled: true, instantFeedback: false, showExplanation: false }
    },
    grading: { thresholds: { "3": 50, "4": 70, "5": 90 } },
    settings: { shuffleQuestions: false, shuffleAnswers: false, saveProgress: true, allowBack: true },
    sections: [{ id: "numbers", title: "Числа" }],
    variants: [{
      id: "all",
      title: "Все задания",
      questionIds: ["unit-number-question"],
      selectionCount: { training: 1, test: 1 }
    }],
    questions: [{
      id: "unit-number-question",
      section: "numbers",
      type: "number",
      text: "Введите число.",
      content: { text: "<b>CH₂=CH₂</b>", format: "formula", caption: "Текст формулы" },
      correct: 5,
      number: {
        integer: true,
        min: 0,
        max: 50,
        tolerance: 0,
        unit: "σ-связей",
        placeholder: "Введите число"
      },
      explanation: "Пять связей.",
      difficulty: 1,
      tags: ["number"]
    }]
  };
}

function validTextDefinition() {
  const definition = validDefinition();
  definition.id = "unit-text-test";
  definition.title = "Текстовый тест";
  definition.description = "Проверка универсального текстового вопроса.";
  definition.sections = [{ id: "text-answers", title: "Текстовые ответы" }];
  definition.variants = [{
    id: "all",
    title: "Все задания",
    questionIds: ["unit-text-question"],
    selectionCount: { training: 1, test: 1 }
  }];
  definition.questions = [{
    id: "unit-text-question",
    section: "text-answers",
    type: "text",
    text: "Введите роль вещества.",
    correct: ["окислитель"],
    textAnswer: {
      caseSensitive: false,
      trim: true,
      collapseWhitespace: true,
      normalizeUnicodeMinus: true,
      minLength: 1,
      maxLength: 30,
      placeholder: "Окислитель или восстановитель",
      inputMode: "text"
    },
    validationMessage: "Введите «окислитель» или «восстановитель».",
    explanation: "Вещество принимает электроны.",
    difficulty: 1,
    tags: ["text"]
  }];
  return definition;
}

test("реестр поддерживает number вместе с прежними типами", () => {
  assert.deepEqual(SUPPORTED_QUESTION_TYPES, ["single", "multiple", "matching", "number", "text", "sequence"]);
});

test("валидные number и content проходят общую проверку", () => {
  assert.deepEqual(validateTestDefinition(validDefinition(), "unit-number-test"), {
    valid: true,
    errors: []
  });
});

test("number проверяет integer, диапазон, tolerance и правильный ответ", () => {
  const definition = validDefinition();
  const question = definition.questions[0];
  question.correct = 1.5;
  question.number.integer = true;
  question.number.min = 10;
  question.number.max = 2;
  question.number.tolerance = -0.1;
  const errors = validateTestDefinition(definition, definition.id).errors.join("\n");
  assert.match(errors, /correct.*целым/);
  assert.match(errors, /number\.min.*number\.max/);
  assert.match(errors, /correct.*number\.min/);
  assert.match(errors, /number\.tolerance/);
});

test("number отклоняет правильный ответ вне верхней границы", () => {
  const definition = validDefinition();
  definition.questions[0].correct = 51;
  assert.match(validateTestDefinition(definition, definition.id).errors.join("\n"), /correct.*number\.max/);
});

test("content отклоняет неизвестный format", () => {
  const definition = validDefinition();
  definition.questions[0].content.format = "html";
  assert.match(validateTestDefinition(definition, definition.id).errors.join("\n"), /content\.format/);
});

test("content отклоняет пустой text и caption", () => {
  const definition = validDefinition();
  definition.questions[0].content.text = " ";
  definition.questions[0].content.caption = "";
  const errors = validateTestDefinition(definition, definition.id).errors.join("\n");
  assert.match(errors, /content\.text/);
  assert.match(errors, /content\.caption/);
});

test("HTML-подобная строка остаётся допустимым текстом данных", () => {
  const definition = validDefinition();
  assert.equal(definition.questions[0].content.text, "<b>CH₂=CH₂</b>");
  assert.equal(validateTestDefinition(definition, definition.id).valid, true);
});

test("валидный text проходит общую проверку", () => {
  assert.deepEqual(validateTestDefinition(validTextDefinition(), "unit-text-test"), {
    valid: true,
    errors: []
  });
});

test("text проверяет объект и логические настройки", () => {
  const definition = validTextDefinition();
  definition.questions[0].textAnswer.caseSensitive = "нет";
  definition.questions[0].textAnswer.trim = null;
  const errors = validateTestDefinition(definition, definition.id).errors.join("\n");
  assert.match(errors, /textAnswer\.caseSensitive/);
  assert.match(errors, /textAnswer\.trim/);

  definition.questions[0].textAnswer = null;
  assert.match(validateTestDefinition(definition, definition.id).errors.join("\n"), /textAnswer.*объект/);
});

test("text проверяет длины, placeholder и inputMode", () => {
  const definition = validTextDefinition();
  const settings = definition.questions[0].textAnswer;
  settings.minLength = 31;
  settings.maxLength = 30;
  settings.placeholder = "";
  settings.inputMode = "formula";
  const errors = validateTestDefinition(definition, definition.id).errors.join("\n");
  assert.match(errors, /minLength.*maxLength/);
  assert.match(errors, /placeholder/);
  assert.match(errors, /inputMode/);
});

test("text отклоняет пустые, слишком длинные и повторные допустимые ответы", () => {
  const definition = validTextDefinition();
  const question = definition.questions[0];
  question.correct = ["Окислитель", "  окислитель  ", " ", "а".repeat(31)];
  const errors = validateTestDefinition(definition, definition.id).errors.join("\n");
  assert.match(errors, /дублируется после нормализации/);
  assert.match(errors, /непустой строкой/);
  assert.match(errors, /длиннее textAnswer\.maxLength/);
});
