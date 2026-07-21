const FORMATS = new Set(["text", "formula"]);

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

const choiceType = {
  getEmptyAnswer: () => [],
  normalizeAnswer: normalizeChoiceAnswer,
  hasAnyAnswer: (_question, answer) => Array.isArray(answer) && answer.length > 0,
  isAnswerComplete: (_question, answer) => Array.isArray(answer) && answer.length > 0,
  evaluateAnswer: evaluateChoice,
  formatAnswer: formatChoice,
  getQuestionMaxPoints: () => 1,
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
  validate: validateChoice
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
    getQuestionMaxPoints: (question) => question.items.length,
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
    validate: validateMatching
  }
});

export const SUPPORTED_QUESTION_TYPES = Object.freeze(Object.keys(questionTypes));

function handler(question) {
  const value = questionTypes[question?.type];
  if (!value) throw new Error(`Тип вопроса «${String(question?.type)}» не поддерживается.`);
  return value;
}

export const getEmptyAnswer = (question) => handler(question).getEmptyAnswer(question);
export const normalizeAnswer = (question, answer) => handler(question).normalizeAnswer(question, answer);
export const hasAnyAnswer = (question, answer) => handler(question).hasAnyAnswer(question, answer);
export const isAnswerComplete = (question, answer) => handler(question).isAnswerComplete(question, answer);
export const evaluateAnswer = (question, answer) => handler(question).evaluateAnswer(question, answer);
export const formatAnswer = (question, answer) => handler(question).formatAnswer(question, answer);
export const getQuestionMaxPoints = (question) => handler(question).getQuestionMaxPoints(question);
export const updateQuestionAnswer = (question, answer, change) => handler(question).updateAnswer(question, answer, change);
export const createQuestionOptionOrder = (question, shuffle) => handler(question).createOptionOrder(question, shuffle);
export const normalizeQuestionOptionOrder = (question, order) => handler(question).normalizeOptionOrder(question, order);
export const validateQuestionType = (question, errors) => handler(question).validate(question, errors);

export function incompleteAnswerMessage(question, rawAnswer) {
  if (question.type !== "matching") return "Сначала выберите ответ.";
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
}

export { questionTypes };
