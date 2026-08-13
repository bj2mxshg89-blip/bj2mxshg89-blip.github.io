const FORMATS = new Set(["text", "formula"]);
const NUMBER_PATTERN = /^[+-]?\d+(?:[.,]\d+)?$/;
const TEXT_INPUT_MODES = new Set(["none", "text", "decimal", "numeric", "tel", "search", "email", "url"]);
const UNICODE_MINUS_PATTERN = /[\u2212\u2013\u2014]/g;

function arraysEqual(left = [], right = []) {
  if (left.length !== right.length) return false;
  const a = [...left].sort((x, y) => x - y);
  const b = [...right].sort((x, y) => x - y);
  return a.every((value, index) => value === b[index]);
}

function normalizeChoiceAnswer(question, rawAnswer) {
  if (!Array.isArray(rawAnswer)) return [];
  const answer = [...new Set(rawAnswer)]
    .filter((value) => Number.isInteger(value) && value >= 0 && value < question.options.length)
    .sort((a, b) => a - b);
  return question.type === "single" ? answer.slice(0, 1) : answer;
}

function evaluateChoice(question, rawAnswer) {
  const answer = normalizeChoiceAnswer(question, rawAnswer);
  const correct = arraysEqual(answer, question.correct);
  return {
    earnedPoints: correct ? 1 : 0,
    maxPoints: 1,
    isFullyCorrect: correct,
    details: []
  };
}

function formatChoice(question, rawAnswer) {
  const answer = normalizeChoiceAnswer(question, rawAnswer);
  return answer.length ? answer.map((index) => question.options[index]).join("; ") : "Нет ответа";
}

function validateChoice(question, errors) {
  const id = question.id;
  if (!Array.isArray(question.options) || question.options.length < 2) {
    errors.push(`Ошибка в вопросе ${id}: требуется не менее двух вариантов ответа.`);
  } else {
    question.options.forEach((option, index) => {
      if (typeof option !== "string" || !option.trim()) {
        errors.push(`Ошибка в вопросе ${id}: вариант ответа ${index} пуст.`);
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
}

function normalizeNumberAnswer(_question, rawAnswer) {
  if (typeof rawAnswer === "string") return rawAnswer.trim();
  return typeof rawAnswer === "number" && Number.isFinite(rawAnswer) ? String(rawAnswer) : "";
}

function parseNumberSyntax(rawAnswer) {
  const enteredText = normalizeNumberAnswer(null, rawAnswer);
  if (!enteredText) return { valid: false, enteredText, parsedValue: null, reason: "empty" };
  if (!NUMBER_PATTERN.test(enteredText)) {
    return { valid: false, enteredText, parsedValue: null, reason: "syntax" };
  }
  const parsedValue = Number(enteredText.replace(",", "."));
  if (!Number.isFinite(parsedValue)) {
    return { valid: false, enteredText, parsedValue: null, reason: "syntax" };
  }
  return { valid: true, enteredText, parsedValue, reason: null };
}

export function parseNumberAnswer(question, rawAnswer) {
  const parsed = parseNumberSyntax(rawAnswer);
  if (!parsed.valid) return parsed;
  const settings = question?.number || {};
  if (settings.integer === true && !Number.isInteger(parsed.parsedValue)) {
    return { ...parsed, valid: false, reason: "integer" };
  }
  if (Number.isFinite(settings.min) && parsed.parsedValue < settings.min) {
    return { ...parsed, valid: false, reason: "min" };
  }
  if (Number.isFinite(settings.max) && parsed.parsedValue > settings.max) {
    return { ...parsed, valid: false, reason: "max" };
  }
  return parsed;
}

function evaluateNumber(question, rawAnswer) {
  const parsed = parseNumberAnswer(question, rawAnswer);
  const tolerance = question.number?.tolerance ?? 0;
  const epsilon = parsed.valid
    ? Number.EPSILON * Math.max(1, Math.abs(parsed.parsedValue), Math.abs(question.correct)) * 4
    : 0;
  const correct = parsed.valid && Math.abs(parsed.parsedValue - question.correct) <= tolerance + epsilon;
  return {
    earnedPoints: correct ? 1 : 0,
    maxPoints: 1,
    isFullyCorrect: correct,
    details: [{
      kind: "number",
      enteredText: parsed.enteredText,
      parsedValue: parsed.valid ? parsed.parsedValue : null,
      correctValue: question.correct,
      tolerance,
      correct
    }]
  };
}

function formatRussianNumber(value) {
  return String(value).replace(".", ",");
}

function formatNumber(_question, rawAnswer) {
  const enteredText = normalizeNumberAnswer(null, rawAnswer);
  return enteredText ? enteredText.replace(".", ",") : "Нет ответа";
}

function formatCorrectNumber(question) {
  const tolerance = question.number?.tolerance ?? 0;
  const value = formatRussianNumber(question.correct);
  const withTolerance = tolerance > 0 ? `${value} ± ${formatRussianNumber(tolerance)}` : value;
  return question.number?.unit ? `${withTolerance} ${question.number.unit}` : withTolerance;
}

function validateNumber(question, errors) {
  const id = question.id;
  const settings = question.number;
  if (!Number.isFinite(question.correct)) {
    errors.push(`Ошибка в вопросе ${id}: поле «correct» должно быть конечным числом.`);
  }
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    errors.push(`Ошибка в вопросе ${id}: поле «number» должно быть объектом.`);
    return;
  }
  if (typeof settings.integer !== "boolean") {
    errors.push(`Ошибка в вопросе ${id}: поле «number.integer» должно быть логическим значением.`);
  }
  if (settings.integer === true && Number.isFinite(question.correct) && !Number.isInteger(question.correct)) {
    errors.push(`Ошибка в вопросе ${id}: поле «correct» должно быть целым при number.integer=true.`);
  }

  ["min", "max"].forEach((field) => {
    if (settings[field] !== undefined && !Number.isFinite(settings[field])) {
      errors.push(`Ошибка в вопросе ${id}: поле «number.${field}» должно быть конечным числом.`);
    }
  });
  if (Number.isFinite(settings.min) && Number.isFinite(settings.max) && settings.min > settings.max) {
    errors.push(`Ошибка в вопросе ${id}: поле «number.min» не может превышать «number.max».`);
  }
  if (Number.isFinite(question.correct) && Number.isFinite(settings.min) && question.correct < settings.min) {
    errors.push(`Ошибка в вопросе ${id}: поле «correct» меньше «number.min».`);
  }
  if (Number.isFinite(question.correct) && Number.isFinite(settings.max) && question.correct > settings.max) {
    errors.push(`Ошибка в вопросе ${id}: поле «correct» больше «number.max».`);
  }

  if (settings.tolerance !== undefined && (!Number.isFinite(settings.tolerance) || settings.tolerance < 0)) {
    errors.push(`Ошибка в вопросе ${id}: поле «number.tolerance» должно быть конечным неотрицательным числом.`);
  }
  ["unit", "placeholder"].forEach((field) => {
    if (settings[field] !== undefined && (typeof settings[field] !== "string" || !settings[field].trim())) {
      errors.push(`Ошибка в вопросе ${id}: поле «number.${field}» должно быть непустой строкой.`);
    }
  });
}

function numberIncompleteMessage(question, rawAnswer) {
  const parsed = parseNumberAnswer(question, rawAnswer);
  const settings = question.number || {};
  if (parsed.reason === "integer" || (parsed.reason === "empty" && settings.integer)) {
    return "Введите одно целое число.";
  }
  if (parsed.reason === "min" || parsed.reason === "max") {
    if (Number.isFinite(settings.min) && Number.isFinite(settings.max)) {
      return `Введите число от ${formatRussianNumber(settings.min)} до ${formatRussianNumber(settings.max)}.`;
    }
    if (Number.isFinite(settings.min)) return `Введите число не меньше ${formatRussianNumber(settings.min)}.`;
    return `Введите число не больше ${formatRussianNumber(settings.max)}.`;
  }
  if (parsed.reason === "syntax") {
    return settings.integer
      ? "Используйте одно целое число без единицы измерения."
      : "Используйте одно число без единицы измерения. Допустимы десятичная запятая или точка.";
  }
  return settings.integer
    ? "Введите одно целое число."
    : "Введите одно число. Допустимы десятичная запятая или точка.";
}

function normalizeStoredTextAnswer(_question, rawAnswer) {
  return typeof rawAnswer === "string" ? rawAnswer : "";
}

export function normalizeTextForComparison(question, rawAnswer) {
  const settings = question?.textAnswer || {};
  let normalized = normalizeStoredTextAnswer(question, rawAnswer);
  if (settings.normalizeUnicodeMinus !== false) normalized = normalized.replace(UNICODE_MINUS_PATTERN, "-");
  if (settings.trim !== false) normalized = normalized.trim();
  if (settings.collapseWhitespace !== false) normalized = normalized.replace(/\s+/gu, " ");
  if (settings.caseSensitive !== true) normalized = normalized.toLocaleLowerCase("ru-RU");
  return normalized;
}

function textLength(question, rawAnswer) {
  return [...normalizeTextForComparison(question, rawAnswer)].length;
}

function textAnswerComplete(question, rawAnswer) {
  const settings = question.textAnswer || {};
  const length = textLength(question, rawAnswer);
  const minLength = Number.isInteger(settings.minLength) ? settings.minLength : 1;
  const maxLength = Number.isInteger(settings.maxLength) ? settings.maxLength : Number.POSITIVE_INFINITY;
  return length >= minLength && length <= maxLength;
}

function evaluateText(question, rawAnswer) {
  const enteredText = normalizeStoredTextAnswer(question, rawAnswer);
  const normalizedEntered = normalizeTextForComparison(question, enteredText);
  const correctAnswers = Array.isArray(question.correct) ? question.correct : [];
  const correct = correctAnswers.some((answer) =>
    normalizeTextForComparison(question, answer) === normalizedEntered
  );
  return {
    earnedPoints: correct ? 1 : 0,
    maxPoints: 1,
    isFullyCorrect: correct,
    details: [{
      enteredText,
      normalizedEntered,
      correctText: correctAnswers[0] || "",
      correct
    }]
  };
}

function formatText(question, rawAnswer) {
  const enteredText = normalizeStoredTextAnswer(question, rawAnswer);
  return enteredText.trim() ? enteredText : "Нет ответа";
}

function formatCorrectText(question) {
  return Array.isArray(question.correct) && typeof question.correct[0] === "string"
    ? question.correct[0]
    : "Ответ не указан";
}

function textIncompleteMessage(question, rawAnswer) {
  const settings = question.textAnswer || {};
  const length = textLength(question, rawAnswer);
  if (length === 0) return "Введите ответ.";
  if (Number.isInteger(settings.maxLength) && length > settings.maxLength) {
    return `Ответ слишком длинный. Допустимо не более ${settings.maxLength} символов.`;
  }
  if (Number.isInteger(settings.minLength) && length < settings.minLength) {
    return question.validationMessage || `Ответ должен содержать не менее ${settings.minLength} символов.`;
  }
  return question.validationMessage || "Проверьте формат ответа.";
}

function validateText(question, errors) {
  const id = question.id;
  const settings = question.textAnswer;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    errors.push(`Ошибка в вопросе ${id}: поле «textAnswer» должно быть объектом.`);
    return;
  }

  ["caseSensitive", "trim", "collapseWhitespace", "normalizeUnicodeMinus"].forEach((field) => {
    if (typeof settings[field] !== "boolean") {
      errors.push(`Ошибка в вопросе ${id}: поле «textAnswer.${field}» должно быть логическим значением.`);
    }
  });

  ["minLength", "maxLength"].forEach((field) => {
    if (!Number.isInteger(settings[field]) || settings[field] < 1) {
      errors.push(`Ошибка в вопросе ${id}: поле «textAnswer.${field}» должно быть целым положительным числом.`);
    }
  });
  if (Number.isInteger(settings.minLength) && Number.isInteger(settings.maxLength) &&
      settings.minLength > settings.maxLength) {
    errors.push(`Ошибка в вопросе ${id}: поле «textAnswer.minLength» не может превышать «textAnswer.maxLength».`);
  }

  if (typeof settings.placeholder !== "string" || !settings.placeholder.trim()) {
    errors.push(`Ошибка в вопросе ${id}: поле «textAnswer.placeholder» должно быть непустой строкой.`);
  }
  if (typeof settings.inputMode !== "string" || !TEXT_INPUT_MODES.has(settings.inputMode)) {
    errors.push(
      `Ошибка в вопросе ${id}: поле «textAnswer.inputMode» должно иметь значение: ` +
      `${[...TEXT_INPUT_MODES].join(", ")}.`
    );
  }
  if (question.validationMessage !== undefined &&
      (typeof question.validationMessage !== "string" || !question.validationMessage.trim())) {
    errors.push(`Ошибка в вопросе ${id}: поле «validationMessage» должно быть непустой строкой.`);
  }

  if (!Array.isArray(question.correct) || question.correct.length === 0) {
    errors.push(`Ошибка в вопросе ${id}: поле «correct» должно быть непустым массивом строк.`);
    return;
  }

  const normalizedAnswers = new Set();
  question.correct.forEach((answer, index) => {
    if (typeof answer !== "string" || !answer.trim()) {
      errors.push(`Ошибка в вопросе ${id}: допустимый ответ correct[${index}] должен быть непустой строкой.`);
      return;
    }
    const normalized = normalizeTextForComparison(question, answer);
    if (!normalized) {
      errors.push(`Ошибка в вопросе ${id}: допустимый ответ correct[${index}] пуст после нормализации.`);
      return;
    }
    const length = [...normalized].length;
    if (Number.isInteger(settings.minLength) && length < settings.minLength) {
      errors.push(`Ошибка в вопросе ${id}: допустимый ответ correct[${index}] короче textAnswer.minLength.`);
    }
    if (Number.isInteger(settings.maxLength) && length > settings.maxLength) {
      errors.push(`Ошибка в вопросе ${id}: допустимый ответ correct[${index}] длиннее textAnswer.maxLength.`);
    }
    if (normalizedAnswers.has(normalized)) {
      errors.push(`Ошибка в вопросе ${id}: допустимый ответ «${answer}» дублируется после нормализации.`);
    }
    normalizedAnswers.add(normalized);
  });
}

function normalizeMatchingAnswer(question, rawAnswer) {
  if (!rawAnswer || typeof rawAnswer !== "object" || Array.isArray(rawAnswer)) return {};
  const itemIds = new Set(question.items.map((item) => item.id));
  const optionIds = new Set(question.options.map((option) => option.id));
  return Object.fromEntries(Object.entries(rawAnswer).filter(([itemId, optionId]) =>
    itemIds.has(itemId) && optionIds.has(optionId)
  ));
}

function matchingComplete(question, rawAnswer) {
  const answer = normalizeMatchingAnswer(question, rawAnswer);
  if (!question.items.every((item) => typeof answer[item.id] === "string")) return false;
  if (!question.allowOptionReuse && new Set(Object.values(answer)).size !== question.items.length) return false;
  return true;
}

function evaluateMatching(question, rawAnswer) {
  const answer = normalizeMatchingAnswer(question, rawAnswer);
  const optionMap = new Map(question.options.map((option) => [option.id, option.text]));
  const details = question.items.map((item) => {
    const selectedOptionId = answer[item.id] || null;
    const correctOptionId = question.correct[item.id];
    return {
      itemId: item.id,
      itemText: item.text,
      itemFormat: item.format || "text",
      selectedOptionId,
      selectedOptionText: selectedOptionId ? optionMap.get(selectedOptionId) || "Неизвестный ответ" : "Нет ответа",
      correctOptionId,
      correctOptionText: optionMap.get(correctOptionId) || "Неизвестный ответ",
      explanation: item.explanation,
      correct: selectedOptionId === correctOptionId
    };
  });
  const earnedPoints = details.filter((detail) => detail.correct).length;
  return {
    earnedPoints,
    maxPoints: question.items.length,
    isFullyCorrect: earnedPoints === question.items.length,
    details
  };
}

function formatMatching(question, rawAnswer) {
  const evaluation = evaluateMatching(question, rawAnswer);
  return evaluation.details
    .map((detail) => `${detail.itemText} — ${detail.selectedOptionText}`)
    .join("; ");
}

function validateMatching(question, errors) {
  const id = question.id;
  const itemIds = new Set();
  const optionIds = new Set();

  if (!Array.isArray(question.items) || question.items.length < 2) {
    errors.push(`Ошибка в вопросе ${id}: поле «items» должно содержать минимум две строки.`);
  } else {
    question.items.forEach((item, index) => {
      const itemId = item?.id;
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`Ошибка в вопросе ${id}: строка items[${index}] должна быть объектом.`);
        return;
      }
      if (typeof itemId !== "string" || !itemId.trim()) {
        errors.push(`Ошибка в вопросе ${id}: у строки ${index + 1} отсутствует id.`);
      } else if (itemIds.has(itemId)) {
        errors.push(`Ошибка в вопросе ${id}: повторяется id строки «${itemId}».`);
      } else {
        itemIds.add(itemId);
      }
      if (typeof item.text !== "string" || !item.text.trim()) {
        errors.push(`Ошибка в вопросе ${id}: у строки «${itemId || index + 1}» отсутствует текст.`);
      }
      if (item.format !== undefined && !FORMATS.has(item.format)) {
        errors.push(`Ошибка в вопросе ${id}: у строки «${itemId || index + 1}» недопустимый format «${String(item.format)}».`);
      }
      if (typeof item.explanation !== "string" || !item.explanation.trim()) {
        errors.push(`Ошибка в вопросе ${id}: у строки «${itemId || index + 1}» отсутствует explanation.`);
      }
    });
  }

  if (!Array.isArray(question.options) || question.options.length < 2) {
    errors.push(`Ошибка в вопросе ${id}: поле «options» должно содержать минимум два варианта.`);
  } else {
    question.options.forEach((option, index) => {
      const optionId = option?.id;
      if (!option || typeof option !== "object" || Array.isArray(option)) {
        errors.push(`Ошибка в вопросе ${id}: вариант options[${index}] должен быть объектом.`);
        return;
      }
      if (typeof optionId !== "string" || !optionId.trim()) {
        errors.push(`Ошибка в вопросе ${id}: у варианта ${index + 1} отсутствует id.`);
      } else if (optionIds.has(optionId)) {
        errors.push(`Ошибка в вопросе ${id}: повторяется id варианта «${optionId}».`);
      } else {
        optionIds.add(optionId);
      }
      if (typeof option.text !== "string" || !option.text.trim()) {
        errors.push(`Ошибка в вопросе ${id}: у варианта «${optionId || index + 1}» отсутствует текст.`);
      }
    });
  }

  if (typeof question.allowOptionReuse !== "boolean") {
    errors.push(`Ошибка в вопросе ${id}: allowOptionReuse должно быть логическим значением.`);
  }

  if (!question.correct || typeof question.correct !== "object" || Array.isArray(question.correct)) {
    errors.push(`Ошибка в вопросе ${id}: поле «correct» должно быть объектом соответствий.`);
  } else {
    Object.keys(question.correct).forEach((itemId) => {
      if (!itemIds.has(itemId)) {
        errors.push(`Ошибка в вопросе ${id}: в correct указан неизвестный itemId «${itemId}».`);
      }
    });
    itemIds.forEach((itemId) => {
      if (!(itemId in question.correct)) {
        errors.push(`Ошибка в вопросе ${id}: для строки «${itemId}» отсутствует правильный ответ.`);
      } else if (!optionIds.has(question.correct[itemId])) {
        errors.push(`Ошибка в вопросе ${id}: для строки «${itemId}» указан неизвестный вариант «${String(question.correct[itemId])}».`);
      }
    });
    if (question.allowOptionReuse === false) {
      const values = Object.values(question.correct);
      if (new Set(values).size !== values.length) {
        errors.push(`Ошибка в вопросе ${id}: правильные варианты повторяются при allowOptionReuse=false.`);
      }
    }
  }

  if (question.allowOptionReuse === false && Array.isArray(question.items) && Array.isArray(question.options) &&
      question.options.length < question.items.length) {
    errors.push(`Ошибка в вопросе ${id}: вариантов меньше, чем строк, при allowOptionReuse=false.`);
  }
}

function checkedAnswerStatus(evaluation) {
  return evaluation.isFullyCorrect
    ? "✓ Ответ проверен: верно"
    : "! Ответ проверен: требуется разбор";
}

function savedAnswerStatus(answered, mode) {
  if (!answered) return "Ответ пока не выбран";
  return mode === "test" ? "● Ответ сохранён" : "Ответ сохранён";
}

function sequenceItemIds(question) {
  return Array.isArray(question.items)
    ? question.items
      .map((item) => item?.id)
      .filter((itemId) => typeof itemId === "string" && itemId.trim())
    : [];
}

function sequenceOrderCandidate(rawAnswer) {
  if (Array.isArray(rawAnswer)) return rawAnswer;
  if (rawAnswer && typeof rawAnswer === "object" && !Array.isArray(rawAnswer) &&
      Array.isArray(rawAnswer.order)) {
    return rawAnswer.order;
  }
  return [];
}

function normalizeSequenceOrder(question, rawOrder, fallbackOrder = null) {
  const itemIds = sequenceItemIds(question);
  const validIds = new Set(itemIds);
  const normalized = [];
  const seen = new Set();
  const appendKnown = (values) => {
    if (!Array.isArray(values)) return;
    values.forEach((itemId) => {
      if (typeof itemId !== "string" || !validIds.has(itemId) || seen.has(itemId)) return;
      normalized.push(itemId);
      seen.add(itemId);
    });
  };

  appendKnown(rawOrder);
  appendKnown(fallbackOrder);
  appendKnown(itemIds);
  return normalized;
}

function normalizeSequenceAnswer(question, rawAnswer, fallbackOrder = null) {
  const touched = Array.isArray(rawAnswer) ||
    Boolean(rawAnswer && typeof rawAnswer === "object" && !Array.isArray(rawAnswer) && rawAnswer.touched === true);
  return {
    order: normalizeSequenceOrder(question, sequenceOrderCandidate(rawAnswer), fallbackOrder),
    touched
  };
}

function sequenceComplete(question, rawAnswer) {
  const itemIds = sequenceItemIds(question);
  const answer = normalizeSequenceAnswer(question, rawAnswer);
  return itemIds.length >= 2 &&
    answer.order.length === itemIds.length &&
    new Set(answer.order).size === itemIds.length &&
    answer.order.every((itemId) => itemIds.includes(itemId));
}

function evaluateSequence(question, rawAnswer) {
  const answer = normalizeSequenceAnswer(question, rawAnswer);
  const itemMap = new Map(question.items.map((item) => [item.id, item]));
  const correct = Array.isArray(question.correct) ? question.correct : [];
  const details = correct.map((expectedItemId, index) => {
    const itemId = answer.order[index] || null;
    const item = itemMap.get(itemId);
    const expectedItem = itemMap.get(expectedItemId);
    return {
      position: index + 1,
      itemId,
      itemText: item?.text || "Нет элемента",
      itemFormat: item?.format || "text",
      expectedItemId,
      expectedItemText: expectedItem?.text || "Неизвестный элемент",
      expectedPosition: itemId ? correct.indexOf(itemId) + 1 : null,
      explanation: item?.explanation,
      correct: itemId === expectedItemId
    };
  });
  const earnedPoints = details.filter((detail) => detail.correct).length;
  return {
    earnedPoints,
    maxPoints: question.items.length,
    isFullyCorrect: earnedPoints === question.items.length,
    details
  };
}

function formatSequence(question, rawAnswer) {
  const itemMap = new Map(question.items.map((item) => [item.id, item.text]));
  const order = normalizeSequenceOrder(question, sequenceOrderCandidate(rawAnswer));
  return order.length
    ? order.map((itemId) => itemMap.get(itemId) || "Неизвестный элемент").join(" → ")
    : "Нет ответа";
}

function validateSequence(question, errors) {
  const id = question.id;
  const itemIds = new Set();

  if (!Array.isArray(question.items)) {
    errors.push(`Ошибка в вопросе ${id}: поле «items» должно быть массивом.`);
  } else if (question.items.length < 2) {
    errors.push(`Ошибка в вопросе ${id}: поле «items» должно содержать минимум два элемента.`);
  }

  if (Array.isArray(question.items)) {
    question.items.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`Ошибка в вопросе ${id}: поле «items[${index}]» должно быть объектом.`);
        return;
      }
      if (typeof item.id !== "string" || !item.id.trim()) {
        errors.push(`Ошибка в вопросе ${id}: поле «items[${index}].id» должно быть непустой строкой.`);
      } else if (itemIds.has(item.id)) {
        errors.push(`Ошибка в вопросе ${id}: поле «items» содержит повторный itemId «${item.id}».`);
      } else {
        itemIds.add(item.id);
      }
      if (typeof item.text !== "string" || !item.text.trim()) {
        errors.push(`Ошибка в вопросе ${id}: поле «items[${index}].text» должно быть непустой строкой.`);
      }
      if (item.format !== undefined && !FORMATS.has(item.format)) {
        errors.push(
          `Ошибка в вопросе ${id}: поле «items[${index}].format» должно иметь значение «text» или «formula».`
        );
      }
      if (item.explanation !== undefined &&
          (typeof item.explanation !== "string" || !item.explanation.trim())) {
        errors.push(`Ошибка в вопросе ${id}: поле «items[${index}].explanation» должно быть непустой строкой.`);
      }
    });
  }

  if (!Array.isArray(question.correct)) {
    errors.push(`Ошибка в вопросе ${id}: поле «correct» должно быть массивом itemId.`);
  } else {
    if (Array.isArray(question.items) && question.correct.length !== question.items.length) {
      errors.push(`Ошибка в вопросе ${id}: длина поля «correct» должна совпадать с длиной «items».`);
    }
    const correctIds = new Set();
    question.correct.forEach((itemId, index) => {
      if (typeof itemId !== "string" || !itemId.trim()) {
        errors.push(`Ошибка в вопросе ${id}: поле «correct[${index}]» должно содержать непустой itemId.`);
        return;
      }
      if (correctIds.has(itemId)) {
        errors.push(`Ошибка в вопросе ${id}: поле «correct» содержит повторный itemId «${itemId}».`);
      }
      correctIds.add(itemId);
      if (!itemIds.has(itemId)) {
        errors.push(`Ошибка в вопросе ${id}: поле «correct» содержит неизвестный itemId «${itemId}».`);
      }
    });
    itemIds.forEach((itemId) => {
      if (!correctIds.has(itemId)) {
        errors.push(`Ошибка в вопросе ${id}: поле «correct» не содержит itemId «${itemId}».`);
      }
    });
  }

  const settings = question.sequence;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    errors.push(`Ошибка в вопросе ${id}: поле «sequence» должно быть объектом.`);
    return;
  }
  if (typeof settings.shuffleInitial !== "boolean") {
    errors.push(`Ошибка в вопросе ${id}: поле «sequence.shuffleInitial» должно быть логическим значением.`);
  }
  if (settings.scoring !== "position") {
    errors.push(`Ошибка в вопросе ${id}: поле «sequence.scoring» поддерживает только значение «position».`);
  }
}

const choiceType = {
  getEmptyAnswer: () => [],
  normalizeAnswer: normalizeChoiceAnswer,
  hasAnyAnswer: (_question, answer) => Array.isArray(answer) && answer.length > 0,
  isAnswerComplete: (_question, answer) => Array.isArray(answer) && answer.length > 0,
  evaluateAnswer: evaluateChoice,
  formatAnswer: formatChoice,
  formatCorrectAnswer: formatChoice,
  getFeedbackDetails: () => [],
  getQuestionMaxPoints: () => 1,
  incompleteAnswerMessage: () => "Сначала выберите ответ.",
  updateAnswer(question, current, change) {
    const answer = normalizeChoiceAnswer(question, current);
    if (question.type === "single") return [change.optionIndex];
    return change.checked
      ? normalizeChoiceAnswer(question, [...answer, change.optionIndex])
      : answer.filter((value) => value !== change.optionIndex);
  },
  createOptionOrder(question, shuffle) {
    const values = question.options.map((_, index) => index);
    return shuffle(values);
  },
  normalizeOptionOrder(question, candidate) {
    const valid = Array.isArray(candidate) && candidate.length === question.options.length &&
      new Set(candidate).size === candidate.length &&
      candidate.every((value) => Number.isInteger(value) && value >= 0 && value < question.options.length);
    return valid ? [...candidate] : question.options.map((_, index) => index);
  },
  validate: validateChoice,
  getValidationAnswer: (question) => question.correct,
  getAnswerStatus(question, answer, context) {
    if (context.isChecked) return checkedAnswerStatus(evaluateChoice(question, answer));
    const normalized = normalizeChoiceAnswer(question, answer);
    if (question.type === "multiple" && normalized.length) {
      return `Выбрано вариантов: ${normalized.length}`;
    }
    return savedAnswerStatus(normalized.length > 0, context.mode);
  }
};

const questionTypes = Object.freeze({
  single: choiceType,
  multiple: choiceType,
  matching: {
    getEmptyAnswer: () => ({}),
    normalizeAnswer: normalizeMatchingAnswer,
    hasAnyAnswer: (question, answer) => Object.keys(normalizeMatchingAnswer(question, answer)).length > 0,
    isAnswerComplete: matchingComplete,
    evaluateAnswer: evaluateMatching,
    formatAnswer: formatMatching,
    formatCorrectAnswer: formatMatching,
    getFeedbackDetails: () => [],
    getQuestionMaxPoints: (question) => question.items.length,
    incompleteAnswerMessage(question, rawAnswer) {
      const answer = normalizeMatchingAnswer(question, rawAnswer);
      const isFilled = question.items.every((item) => answer[item.id]);
      if (isFilled && !question.allowOptionReuse && new Set(Object.values(answer)).size !== question.items.length) {
        return "Каждый вариант ответа можно использовать только один раз.";
      }
      const count = question.items.length;
      const lastTwo = count % 100;
      const last = count % 10;
      const word = lastTwo >= 11 && lastTwo <= 14 ? "соответствий"
        : last === 1 ? "соответствие"
          : last >= 2 && last <= 4 ? "соответствия" : "соответствий";
      return `Установите все ${count} ${word}.`;
    },
    updateAnswer(question, current, change) {
      const answer = normalizeMatchingAnswer(question, current);
      const next = { ...answer };
      if (change.optionId) next[change.itemId] = change.optionId;
      else delete next[change.itemId];
      return next;
    },
    createOptionOrder(question, shuffle) {
      return shuffle(question.options.map((option) => option.id));
    },
    normalizeOptionOrder(question, candidate) {
      const ids = question.options.map((option) => option.id);
      const valid = Array.isArray(candidate) && candidate.length === ids.length &&
        new Set(candidate).size === candidate.length && candidate.every((value) => ids.includes(value));
      return valid ? [...candidate] : ids;
    },
    validate: validateMatching,
    getValidationAnswer: (question) => question.correct,
    getAnswerStatus(question, answer, context) {
      if (context.isChecked) return checkedAnswerStatus(evaluateMatching(question, answer));
      return savedAnswerStatus(Object.keys(normalizeMatchingAnswer(question, answer)).length > 0, context.mode);
    }
  },
  number: {
    getEmptyAnswer: () => "",
    normalizeAnswer: normalizeNumberAnswer,
    hasAnyAnswer: (_question, answer) => typeof answer === "string" && answer.trim().length > 0,
    isAnswerComplete: (question, answer) => parseNumberAnswer(question, answer).valid,
    evaluateAnswer: evaluateNumber,
    formatAnswer: formatNumber,
    formatCorrectAnswer: formatCorrectNumber,
    getFeedbackDetails(question, answer, evaluation) {
      const answerText = formatNumber(question, answer);
      const displayedAnswer = evaluation.isFullyCorrect && question.number?.unit
        ? `${answerText} ${question.number.unit}`
        : answerText;
      const details = [{ label: "Ваш ответ", value: displayedAnswer }];
      if (!evaluation.isFullyCorrect) {
        details.push({ label: "Правильный ответ", value: formatCorrectNumber(question) });
      }
      return details;
    },
    getQuestionMaxPoints: () => 1,
    incompleteAnswerMessage: numberIncompleteMessage,
    updateAnswer(_question, _current, change) {
      return typeof change.value === "string" ? change.value : "";
    },
    createOptionOrder: () => [],
    normalizeOptionOrder: () => [],
    validate: validateNumber,
    getValidationAnswer: (question) => question.correct,
    getAnswerStatus(question, answer, context) {
      if (context.isChecked) return checkedAnswerStatus(evaluateNumber(question, answer));
      return savedAnswerStatus(normalizeNumberAnswer(question, answer).length > 0, context.mode);
    }
  },
  text: {
    getEmptyAnswer: () => "",
    normalizeAnswer: normalizeStoredTextAnswer,
    hasAnyAnswer: (_question, answer) => typeof answer === "string" && answer.trim().length > 0,
    isAnswerComplete: textAnswerComplete,
    evaluateAnswer: evaluateText,
    formatAnswer: formatText,
    formatCorrectAnswer: formatCorrectText,
    getFeedbackDetails(question, answer, evaluation) {
      const details = [{ label: "Ваш ответ", value: formatText(question, answer) }];
      if (!evaluation.isFullyCorrect) {
        details.push({ label: "Правильный ответ", value: formatCorrectText(question) });
      }
      return details;
    },
    getQuestionMaxPoints: () => 1,
    incompleteAnswerMessage: textIncompleteMessage,
    updateAnswer(_question, _current, change) {
      return typeof change.value === "string" ? change.value : "";
    },
    createOptionOrder: () => [],
    normalizeOptionOrder: () => [],
    validate: validateText,
    getValidationAnswer: (question) => question.correct?.[0],
    getAnswerStatus(question, answer, context) {
      if (context.isChecked) return checkedAnswerStatus(evaluateText(question, answer));
      return savedAnswerStatus(normalizeStoredTextAnswer(question, answer).trim().length > 0, context.mode);
    }
  },
  sequence: {
    getEmptyAnswer(question, optionOrder) {
      return {
        order: normalizeSequenceOrder(question, optionOrder),
        touched: false
      };
    },
    normalizeAnswer: normalizeSequenceAnswer,
    hasAnyAnswer: (question, answer) => normalizeSequenceAnswer(question, answer).touched,
    isAnswerComplete: sequenceComplete,
    evaluateAnswer: evaluateSequence,
    formatAnswer: formatSequence,
    formatCorrectAnswer: formatSequence,
    getFeedbackDetails(question, _answer, evaluation) {
      const result = evaluation.isFullyCorrect
        ? `Все ${evaluation.maxPoints} позиции расположены правильно.`
        : `Правильно расположено: ${evaluation.earnedPoints} из ${evaluation.maxPoints}.`;
      return [
        { label: "Результат", value: result },
        ...evaluation.details.map((detail) => ({
          label: String(detail.position),
          value: detail.correct
            ? `${detail.itemText} — верная позиция.`
            : `${detail.itemText} — должно находиться на позиции ${detail.expectedPosition}.`
        }))
      ];
    },
    getFeedbackHeading(_question, _answer, evaluation) {
      return evaluation.isFullyCorrect ? "✓ Верно" : "! Есть ошибки";
    },
    getQuestionMaxPoints: (question) => question.items.length,
    incompleteAnswerMessage: () => "Расположите все элементы в требуемом порядке.",
    updateAnswer(question, current, change) {
      const answer = normalizeSequenceAnswer(question, current);
      const order = [...answer.order];
      if (!change || typeof change !== "object") return { order, touched: answer.touched };

      if (change.action === "reorder") {
        return {
          order: normalizeSequenceOrder(question, change.order, order),
          touched: true
        };
      }

      if (change.action !== "move" || typeof change.itemId !== "string" ||
          !["up", "down"].includes(change.direction)) {
        return { order, touched: answer.touched };
      }

      const index = order.indexOf(change.itemId);
      const target = change.direction === "up" ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= order.length) {
        return { order, touched: answer.touched };
      }
      [order[index], order[target]] = [order[target], order[index]];
      return { order, touched: true };
    },
    createOptionOrder(question, shuffle) {
      const itemIds = sequenceItemIds(question);
      return question.sequence?.shuffleInitial ? shuffle(itemIds) : itemIds;
    },
    normalizeOptionOrder(question, candidate) {
      return normalizeSequenceOrder(question, candidate);
    },
    validate: validateSequence,
    getValidationAnswer: (question) => question.correct,
    getAnswerStatus(question, answer, context) {
      const normalized = normalizeSequenceAnswer(question, answer);
      if (context.isChecked) {
        const evaluation = evaluateSequence(question, normalized);
        return evaluation.isFullyCorrect
          ? `✓ Ответ проверен: ${evaluation.maxPoints} из ${evaluation.maxPoints} позиций`
          : `! Ответ проверен: ${evaluation.earnedPoints} из ${evaluation.maxPoints} позиций`;
      }
      return normalized.touched ? "Порядок обновлён" : "Порядок сохранён";
    }
  }
});

export const SUPPORTED_QUESTION_TYPES = Object.freeze(Object.keys(questionTypes));

function handler(question) {
  const value = questionTypes[question?.type];
  if (!value) throw new Error(`Тип вопроса «${String(question?.type)}» не поддерживается.`);
  return value;
}

export const getEmptyAnswer = (question, optionOrder) => handler(question).getEmptyAnswer(question, optionOrder);
export const normalizeAnswer = (question, answer, optionOrder) =>
  handler(question).normalizeAnswer(question, answer, optionOrder);
export const hasAnyAnswer = (question, answer) => handler(question).hasAnyAnswer(question, answer);
export const isAnswerComplete = (question, answer) => handler(question).isAnswerComplete(question, answer);
export const evaluateAnswer = (question, answer) => handler(question).evaluateAnswer(question, answer);
export const formatAnswer = (question, answer) => handler(question).formatAnswer(question, answer);
export const formatCorrectAnswer = (question) => handler(question).formatCorrectAnswer(question, question.correct);
export const getFeedbackDetails = (question, answer, evaluation) =>
  handler(question).getFeedbackDetails(question, answer, evaluation);
export const getFeedbackHeading = (question, answer, evaluation) =>
  handler(question).getFeedbackHeading?.(question, answer, evaluation) ??
  (evaluation.maxPoints > 1
    ? `${evaluation.isFullyCorrect ? "✓" : "!"} Верно: ${evaluation.earnedPoints} из ${evaluation.maxPoints}.`
    : evaluation.isFullyCorrect ? "✓ Верно" : "! Есть ошибка");
export const getQuestionMaxPoints = (question) => handler(question).getQuestionMaxPoints(question);
export const getQuestionValidationAnswer = (question) => handler(question).getValidationAnswer(question);
export const updateQuestionAnswer = (question, answer, change) => handler(question).updateAnswer(question, answer, change);
export const createQuestionOptionOrder = (question, shuffle) => handler(question).createOptionOrder(question, shuffle);
export const normalizeQuestionOptionOrder = (question, order) => handler(question).normalizeOptionOrder(question, order);
export const validateQuestionType = (question, errors) => handler(question).validate(question, errors);

export const incompleteAnswerMessage = (question, rawAnswer) =>
  handler(question).incompleteAnswerMessage(question, rawAnswer);
export const getAnswerStatus = (question, rawAnswer, context) =>
  handler(question).getAnswerStatus(question, rawAnswer, context);

export { questionTypes };
