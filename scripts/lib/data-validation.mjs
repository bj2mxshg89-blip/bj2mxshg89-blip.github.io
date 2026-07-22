import {
  evaluateAnswer,
  getEmptyAnswer,
  getQuestionMaxPoints,
  normalizeAnswer
} from "../../assets/js/question-types.js";
import { validateTestDefinition } from "../../assets/js/utils.js";

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const VALID_DIFFICULTY = new Set([1, 2, 3, 4, 5]);

export function validateParsedJson(value, label) {
  const errors = [];

  function visit(current, pointer) {
    if (current === undefined || typeof current === "function" || typeof current === "symbol") {
      errors.push(`${label}${pointer}: значение невозможно представить в JSON.`);
      return;
    }
    if (typeof current === "number" && !Number.isFinite(current)) {
      errors.push(`${label}${pointer}: число должно быть конечным.`);
      return;
    }
    if (typeof current === "string" && !current.trim()) {
      errors.push(`${label}${pointer}: пустые строки запрещены.`);
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${pointer}[${index}]`));
      return;
    }
    if (current && typeof current === "object") {
      Object.entries(current).forEach(([key, item]) => visit(item, `${pointer}.${key}`));
    }
  }

  visit(value, "");
  return errors;
}

function checkId(value, label, errors) {
  if (typeof value !== "string") return;
  if (value !== value.trim()) errors.push(`${label}: пробелы в начале или конце id запрещены.`);
  if (!ID_PATTERN.test(value)) {
    errors.push(`${label}: id «${value}» должен содержать строчные латинские буквы, цифры и дефисы.`);
  }
}

function duplicateStrings(values) {
  const seen = new Set();
  const duplicates = new Set();
  values.forEach((value) => {
    const normalized = typeof value === "string" ? value.trim() : value;
    if (seen.has(normalized)) duplicates.add(normalized);
    seen.add(normalized);
  });
  return [...duplicates];
}

export function validateTestContent(test, expectedId) {
  const base = validateTestDefinition(test, expectedId);
  const errors = [...base.errors, ...validateParsedJson(test, `Тест ${expectedId}`)];
  const attemptMaximums = [];
  if (!test || typeof test !== "object" || Array.isArray(test)) return { errors, attemptMaximums };

  checkId(test.id, `Тест ${expectedId}`, errors);
  (test.sections || []).forEach((section) => checkId(section?.id, `Раздел ${section?.id ?? "—"}`, errors));
  (test.variants || []).forEach((variant) => checkId(variant?.id, `Вариант ${variant?.id ?? "—"}`, errors));

  const usedQuestions = new Set();
  const questionMap = new Map((test.questions || []).map((question) => [question.id, question]));

  (test.variants || []).forEach((variant) => {
    const questionIds = Array.isArray(variant.questionIds) ? variant.questionIds : [];
    questionIds.forEach((id) => usedQuestions.add(id));
    const duplicates = duplicateStrings(questionIds);
    duplicates.forEach((id) => errors.push(`Вариант «${variant.id}»: вопрос «${id}» указан повторно.`));

    ["training", "test"].forEach((mode) => {
      if (!test.modes?.[mode]?.enabled) return;
      const count = variant.selectionCount?.[mode] ?? questionIds.length;
      const maxima = questionIds
        .map((id) => questionMap.get(id))
        .filter(Boolean)
        .map((question) => getQuestionMaxPoints(question));
      if (!maxima.length || !Number.isInteger(count) || count < 1 || count > maxima.length) return;
      const selectedMaxima = count === maxima.length
        ? maxima
        : test.settings?.shuffleQuestions === false
          ? maxima.slice(0, count)
          : [...maxima].sort((left, right) => left - right).slice(0, count);
      const minimum = selectedMaxima.reduce((sum, value) => sum + value, 0);
      const maximum = count === maxima.length || test.settings?.shuffleQuestions === false
        ? minimum
        : [...maxima].sort((left, right) => right - left)
          .slice(0, count)
          .reduce((sum, value) => sum + value, 0);
      attemptMaximums.push({
        variantId: variant.id,
        mode,
        questions: count,
        minimum,
        maximum,
        dynamic: minimum !== maximum
      });
    });
  });

  (test.questions || []).forEach((question, index) => {
    const label = `Вопрос ${question?.id ?? index + 1}`;
    checkId(question?.id, label, errors);

    if (!usedQuestions.has(question?.id) && question?.reserved !== true && question?.reserve !== true) {
      errors.push(`${label}: вопрос не входит ни в один вариант и не помечен как резервный.`);
    }

    if (question?.tags !== undefined) {
      if (!Array.isArray(question.tags) || question.tags.some((tag) => typeof tag !== "string" || !tag.trim())) {
        errors.push(`${label}: tags должен быть массивом непустых строк.`);
      }
    }
    if (question?.difficulty !== undefined && !VALID_DIFFICULTY.has(question.difficulty)) {
      errors.push(`${label}: difficulty должен быть целым числом от 1 до 5.`);
    }

    if (question?.type === "single" || question?.type === "multiple") {
      const duplicates = duplicateStrings(Array.isArray(question.options) ? question.options : []);
      duplicates.forEach((option) => errors.push(`${label}: вариант ответа «${option}» повторяется.`));
      if (question.type === "single" && question.correct?.length !== 1) {
        errors.push(`${label}: single должен иметь ровно один правильный ответ.`);
      }
    }

    if (question?.type === "matching") {
      (question.items || []).forEach((item) => checkId(item?.id, `${label}, строка ${item?.id ?? "—"}`, errors));
      (question.options || []).forEach((option) => checkId(option?.id, `${label}, вариант ${option?.id ?? "—"}`, errors));
      const duplicates = duplicateStrings((question.options || []).map((option) => option?.text));
      duplicates.forEach((option) => errors.push(`${label}: вариант matching «${option}» повторяется.`));
      if (question.allowOptionReuse === false && question.correct && typeof question.correct === "object") {
        const correctValues = Object.values(question.correct);
        if (new Set(correctValues).size !== correctValues.length) {
          errors.push(`${label}: правильные варианты повторяются при allowOptionReuse=false.`);
        }
      }
    }

    try {
      const maximum = getQuestionMaxPoints(question);
      if (!Number.isFinite(maximum) || maximum <= 0) {
        errors.push(`${label}: максимальный балл должен быть положительным конечным числом.`);
      }
      const empty = getEmptyAnswer(question);
      const normalizedEmpty = normalizeAnswer(question, empty);
      const emptyResult = evaluateAnswer(question, normalizedEmpty);
      if (!Number.isFinite(emptyResult.earnedPoints) || emptyResult.maxPoints !== maximum) {
        errors.push(`${label}: тип вопроса некорректно оценивает пустой ответ.`);
      }
      const testAnswer = normalizeAnswer(question, question.correct);
      const testResult = evaluateAnswer(question, testAnswer);
      if (!testResult.isFullyCorrect || testResult.earnedPoints !== maximum || testResult.maxPoints !== maximum) {
        errors.push(`${label}: правильный тестовый ответ оценивается некорректно.`);
      }
    } catch (error) {
      errors.push(`${label}: реестр типа выбросил исключение — ${error.message}`);
    }
  });

  return { errors: [...new Set(errors)], attemptMaximums };
}
