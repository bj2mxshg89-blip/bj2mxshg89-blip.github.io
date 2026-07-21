export const SUPPORTED_QUESTION_TYPES = Object.freeze(["single", "multiple"]);

export function formatCount(count, one, few, many) {
  const numeric = Math.abs(Number(count));
  const lastTwo = numeric % 100;
  const last = numeric % 10;
  let word = many;

  if (lastTwo < 11 || lastTwo > 14) {
    if (last === 1) word = one;
    else if (last >= 2 && last <= 4) word = few;
  }

  return `${count} ${word}`;
}

const REQUIRED_TEST_FIELDS = [
  "schemaVersion",
  "id",
  "version",
  "title",
  "description",
  "subject",
  "category",
  "symbol",
  "modes",
  "grading",
  "settings",
  "sections",
  "variants",
  "questions"
];

export class TestLoadError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "TestLoadError";
    this.details = details;
  }
}

export function getTestId(search = window.location.search) {
  const id = new URLSearchParams(search).get("id")?.trim() || "";
  if (!id) {
    throw new TestLoadError("Не указан идентификатор теста.", [
      "Откройте страницу по ссылке вида test.html?id=organic-review."
    ]);
  }

  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new TestLoadError(`Недопустимый идентификатор теста: «${id}».`, [
      "Допустимы строчные латинские буквы, цифры и дефисы."
    ]);
  }

  return id;
}

export async function fetchJson(url, options = {}) {
  const resourceName = typeof options.resourceName === "string" && options.resourceName.trim()
    ? options.resourceName.trim()
    : "данные теста";
  const loadMessage = `Не удалось загрузить ${resourceName}.`;
  const invalidMessage = resourceName === "данные теста"
    ? "Файл теста содержит некорректный JSON."
    : `${resourceName[0].toUpperCase()}${resourceName.slice(1)} содержит некорректный JSON.`;
  let response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      signal: options.signal
    });
  } catch (error) {
    throw new TestLoadError(loadMessage, [
      "Проверьте подключение к интернету и повторите попытку.",
      error instanceof Error ? error.message : String(error)
    ]);
  }

  if (!response.ok) {
    const details = response.status === 404
      ? [options.notFoundMessage || "Файл теста не найден в каталоге data/tests/."]
      : [`Сервер вернул код ${response.status}.`];
    throw new TestLoadError(loadMessage, details);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new TestLoadError(invalidMessage, [
      error instanceof Error ? error.message : String(error)
    ]);
  }
}

export function validateTestDefinition(test, expectedId) {
  const errors = [];

  if (!isPlainObject(test)) {
    return { valid: false, errors: ["Корневое значение JSON должно быть объектом."] };
  }

  REQUIRED_TEST_FIELDS.forEach((field) => {
    if (!(field in test)) errors.push(`Отсутствует обязательное поле «${field}».`);
  });

  if (test.schemaVersion !== 1) {
    errors.push(`Неподдерживаемая версия схемы: ${String(test.schemaVersion)}. Ожидается 1.`);
  }

  if (typeof test.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(test.id)) {
    errors.push("Поле «id» должно содержать строчные латинские буквы, цифры или дефисы.");
  } else if (expectedId && test.id !== expectedId) {
    errors.push(`Идентификатор файла «${expectedId}» не совпадает с id теста «${test.id}».`);
  }

  if (!Number.isInteger(test.version) || test.version < 1) {
    errors.push("Поле «version» должно быть целым положительным числом.");
  }

  ["title", "description", "subject", "category", "symbol"].forEach((field) => {
    if (typeof test[field] !== "string" || !test[field].trim()) {
      errors.push(`Поле «${field}» должно быть непустой строкой.`);
    }
  });

  validateTheme(test.theme, errors);
  validateModes(test.modes, errors);
  validateSettings(test.settings, errors);
  validateGrading(test.grading, errors);

  const sectionIds = validateSections(test.sections, errors);
  const questionIds = validateQuestions(test.questions, sectionIds, errors);
  validateVariants(test.variants, questionIds, errors);

  return { valid: errors.length === 0, errors };
}

function validateTheme(theme, errors) {
  if (theme === undefined) return;
  if (!isPlainObject(theme)) {
    errors.push("Поле «theme» должно быть объектом.");
    return;
  }

  ["accent", "soft"].forEach((field) => {
    if (theme[field] !== undefined && !/^#[0-9a-f]{6}$/i.test(theme[field])) {
      errors.push(`Поле «theme.${field}» должно содержать цвет в формате #RRGGBB.`);
    }
  });
}

function validateModes(modes, errors) {
  if (!isPlainObject(modes)) {
    errors.push("Поле «modes» должно быть объектом.");
    return;
  }

  const names = ["training", "test"];
  let enabledCount = 0;

  names.forEach((name) => {
    const mode = modes[name];
    if (!isPlainObject(mode)) {
      errors.push(`Отсутствуют настройки режима «${name}».`);
      return;
    }

    if (typeof mode.enabled !== "boolean") {
      errors.push(`Поле «modes.${name}.enabled» должно быть логическим.`);
    } else if (mode.enabled) {
      enabledCount += 1;
    }

    ["instantFeedback", "showExplanation"].forEach((field) => {
      if (typeof mode[field] !== "boolean") {
        errors.push(`Поле «modes.${name}.${field}» должно быть логическим.`);
      }
    });
  });

  if (!enabledCount) errors.push("Должен быть включён хотя бы один режим работы.");
}

function validateSettings(settings, errors) {
  if (!isPlainObject(settings)) {
    errors.push("Поле «settings» должно быть объектом.");
    return;
  }

  ["shuffleQuestions", "shuffleAnswers", "saveProgress", "allowBack"].forEach((field) => {
    if (typeof settings[field] !== "boolean") {
      errors.push(`Поле «settings.${field}» должно быть логическим.`);
    }
  });
}

function validateGrading(grading, errors) {
  const thresholds = grading?.thresholds;
  if (!isPlainObject(thresholds)) {
    errors.push("Поле «grading.thresholds» должно быть объектом.");
    return;
  }

  const values = [3, 4, 5].map((grade) => Number(thresholds[String(grade)]));
  values.forEach((value, index) => {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      errors.push(`Порог оценки «${index + 3}» должен быть числом от 0 до 100.`);
    }
  });

  if (values.every(Number.isFinite) && !(values[0] < values[1] && values[1] < values[2])) {
    errors.push("Пороги оценивания должны возрастать: «3» < «4» < «5».");
  }
}

function validateSections(sections, errors) {
  const ids = new Set();
  if (!Array.isArray(sections) || sections.length === 0) {
    errors.push("Поле «sections» должно быть непустым массивом.");
    return ids;
  }

  sections.forEach((section, index) => {
    if (!isPlainObject(section) || typeof section.id !== "string" || !section.id.trim()) {
      errors.push(`Раздел ${index + 1}: отсутствует непустой id.`);
      return;
    }
    if (ids.has(section.id)) errors.push(`Повторяется id раздела «${section.id}».`);
    ids.add(section.id);
    if (typeof section.title !== "string" || !section.title.trim()) {
      errors.push(`Раздел «${section.id}»: отсутствует название.`);
    }
  });

  return ids;
}

function validateQuestions(questions, sectionIds, errors) {
  const ids = new Set();
  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push("Поле «questions» должно быть непустым массивом.");
    return ids;
  }

  questions.forEach((question, index) => {
    const fallbackId = `с индексом ${index}`;
    if (!isPlainObject(question)) {
      errors.push(`Вопрос ${fallbackId}: значение должно быть объектом.`);
      return;
    }

    const id = typeof question.id === "string" && question.id.trim() ? question.id : fallbackId;
    if (id === fallbackId) errors.push(`Вопрос ${fallbackId}: отсутствует постоянный id.`);
    else if (ids.has(id)) errors.push(`Повторяется id вопроса «${id}».`);
    ids.add(id);

    if (!sectionIds.has(question.section)) {
      errors.push(`Ошибка в вопросе ${id}: раздел «${String(question.section)}» не существует.`);
    }

    if (!SUPPORTED_QUESTION_TYPES.includes(question.type)) {
      errors.push(
        `Ошибка в вопросе ${id}: тип «${String(question.type)}» не поддерживается. ` +
        `Допустимые типы: ${SUPPORTED_QUESTION_TYPES.join(", ")}.`
      );
    }

    if (typeof question.text !== "string" || !question.text.trim()) {
      errors.push(`Ошибка в вопросе ${id}: отсутствует текст вопроса.`);
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
      errors.push(`Ошибка в вопросе ${id}: требуется не менее двух вариантов ответа.`);
    } else {
      question.options.forEach((option, optionIndex) => {
        if (typeof option !== "string" || !option.trim()) {
          errors.push(`Ошибка в вопросе ${id}: вариант ответа ${optionIndex} пуст.`);
        }
      });
    }

    if (!Array.isArray(question.correct) || question.correct.length === 0) {
      errors.push(`Ошибка в вопросе ${id}: должен быть хотя бы один правильный ответ.`);
    } else if (Array.isArray(question.options)) {
      const seen = new Set();
      question.correct.forEach((answerIndex) => {
        if (!Number.isInteger(answerIndex)) {
          errors.push(`Ошибка в вопросе ${id}: индекс правильного ответа должен быть целым числом.`);
        } else if (answerIndex < 0 || answerIndex >= question.options.length) {
          errors.push(
            `Ошибка в вопросе ${id}: индекс правильного ответа ${answerIndex} отсутствует. ` +
            `Допустимые индексы: 0–${question.options.length - 1}.`
          );
        } else if (seen.has(answerIndex)) {
          errors.push(`Ошибка в вопросе ${id}: индекс правильного ответа ${answerIndex} повторяется.`);
        }
        seen.add(answerIndex);
      });
    }

    if (question.type === "single" && Array.isArray(question.correct) && question.correct.length !== 1) {
      errors.push(`Ошибка в вопросе ${id}: тип single должен иметь ровно один правильный ответ.`);
    }

    if (typeof question.explanation !== "string" || !question.explanation.trim()) {
      errors.push(`Ошибка в вопросе ${id}: отсутствует объяснение.`);
    }
  });

  return ids;
}

function validateVariants(variants, questionIds, errors) {
  const variantIds = new Set();
  if (!Array.isArray(variants) || variants.length === 0) {
    errors.push("Поле «variants» должно быть непустым массивом.");
    return;
  }

  variants.forEach((variant, index) => {
    if (!isPlainObject(variant) || typeof variant.id !== "string" || !variant.id.trim()) {
      errors.push(`Вариант ${index + 1}: отсутствует непустой id.`);
      return;
    }
    if (variantIds.has(variant.id)) errors.push(`Повторяется id варианта «${variant.id}».`);
    variantIds.add(variant.id);

    if (typeof variant.title !== "string" || !variant.title.trim()) {
      errors.push(`Вариант «${variant.id}»: отсутствует название.`);
    }

    if (!Array.isArray(variant.questionIds) || variant.questionIds.length === 0) {
      errors.push(`Вариант «${variant.id}»: список questionIds пуст.`);
      return;
    }

    const ownIds = new Set();
    variant.questionIds.forEach((questionId) => {
      if (!questionIds.has(questionId)) {
        errors.push(`Вариант «${variant.id}»: вопрос «${String(questionId)}» не найден.`);
      } else if (ownIds.has(questionId)) {
        errors.push(`Вариант «${variant.id}»: вопрос «${questionId}» указан повторно.`);
      }
      ownIds.add(questionId);
    });
  });
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function arraysEqual(left = [], right = []) {
  if (left.length !== right.length) return false;
  const a = [...left].sort((x, y) => x - y);
  const b = [...right].sort((x, y) => x - y);
  return a.every((value, index) => value === b[index]);
}

export function shuffledCopy(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

export function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.round(Number(milliseconds || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function createAttemptId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `attempt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getSectionTitle(test, sectionId) {
  return test.sections.find((section) => section.id === sectionId)?.title || sectionId;
}

export function modeTitle(mode) {
  return mode === "test" ? "Тест" : "Тренировка";
}

export function variantTitle(test, variantId) {
  return test.variants.find((variant) => variant.id === variantId)?.title || `Вариант ${variantId}`;
}

export function subjectTitle(subject) {
  const titles = { chemistry: "Химия", biology: "Биология" };
  return titles[subject] || subject;
}

export function categoryTitle(category) {
  const titles = { organic: "Органическая химия", inorganic: "Неорганическая химия" };
  return titles[category] || category;
}
