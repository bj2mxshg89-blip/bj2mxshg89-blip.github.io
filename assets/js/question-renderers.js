import { evaluateAnswer, formatAnswer } from "./question-types.js?v=4";

const renderers = {
  single: renderSingleQuestion,
  multiple: renderMultipleQuestion,
  matching: renderMatchingQuestion
};

export function renderQuestionOptions(context) {
  const renderer = renderers[context.question.type];
  context.container.replaceChildren();

  if (!renderer) {
    const error = document.createElement("div");
    error.className = "trainer-message trainer-message-error";
    error.setAttribute("role", "alert");
    error.textContent = `Тип вопроса «${context.question.type}» пока не поддерживается.`;
    context.container.appendChild(error);
    return;
  }

  renderer(context);
}

function renderSingleQuestion(context) {
  renderChoiceQuestion(context, "radio");
}

function renderMultipleQuestion(context) {
  renderChoiceQuestion(context, "checkbox");
}

function renderChoiceQuestion({
  container,
  question,
  selected,
  locked,
  revealCorrect,
  optionOrder,
  onChange
}, inputType) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "answer-fieldset";

  const legend = document.createElement("legend");
  legend.className = "visually-hidden";
  legend.textContent = question.type === "multiple"
    ? "Выберите все правильные ответы"
    : "Выберите один правильный ответ";
  fieldset.appendChild(legend);

  optionOrder.forEach((originalIndex, displayIndex) => {
    const label = document.createElement("label");
    const isSelected = selected.includes(originalIndex);
    const isCorrect = question.correct.includes(originalIndex);
    label.className = "answer-option";
    if (isSelected) label.classList.add("is-selected");
    if (revealCorrect && isCorrect) label.classList.add("is-correct");
    if (revealCorrect && isSelected && !isCorrect) label.classList.add("is-wrong");

    const input = document.createElement("input");
    input.type = inputType;
    input.name = `answer-${question.id}`;
    input.value = String(originalIndex);
    input.dataset.focusKey = `choice-${originalIndex}`;
    input.checked = isSelected;
    input.disabled = locked;
    input.addEventListener("change", () => onChange({
      optionIndex: originalIndex,
      checked: input.checked,
      focusKey: input.dataset.focusKey
    }));

    const marker = document.createElement("span");
    marker.className = "answer-marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = String.fromCharCode(65 + displayIndex);

    const text = document.createElement("span");
    text.className = "answer-text";
    text.textContent = question.options[originalIndex];

    label.append(input, marker, text);

    if (revealCorrect && (isCorrect || (isSelected && !isCorrect))) {
      const status = document.createElement("span");
      status.className = "answer-option-status";
      status.textContent = isCorrect ? "✓ Правильный ответ" : "✕ Ваш выбор";
      label.appendChild(status);
    }

    fieldset.appendChild(label);
  });

  container.appendChild(fieldset);
}

function renderMatchingQuestion({
  container,
  question,
  selected,
  locked,
  revealCorrect,
  optionOrder,
  onChange
}) {
  const optionMap = new Map(question.options.map((option) => [option.id, option]));
  const evaluation = evaluateAnswer(question, selected);
  const detailMap = new Map(evaluation.details.map((detail) => [detail.itemId, detail]));
  const usedOptions = new Set(Object.values(selected));
  const grid = document.createElement("div");
  grid.className = "matching-grid";

  question.items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "matching-row";
    const detail = detailMap.get(item.id);
    if (revealCorrect) row.classList.add(detail.correct ? "is-correct" : "is-wrong");

    const prompt = document.createElement("div");
    prompt.className = "matching-prompt";
    const marker = document.createElement("span");
    marker.className = "matching-marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = String.fromCharCode(65 + index);
    const label = document.createElement("label");
    const selectId = `matching-${question.id}-${item.id}`;
    label.htmlFor = selectId;
    label.className = item.format === "formula" ? "matching-text is-formula" : "matching-text";
    label.textContent = item.text;
    prompt.append(marker, label);

    const control = document.createElement("div");
    control.className = "matching-control";
    const select = document.createElement("select");
    select.id = selectId;
    select.className = "matching-select";
    select.dataset.focusKey = `matching-${item.id}`;
    select.disabled = locked;
    select.setAttribute("aria-label", `${String.fromCharCode(65 + index)}. ${item.text}`);

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Выберите ответ";
    select.appendChild(placeholder);

    optionOrder.forEach((optionId) => {
      const option = optionMap.get(optionId);
      if (!option) return;
      const node = document.createElement("option");
      node.value = option.id;
      node.textContent = option.text;
      node.selected = selected[item.id] === option.id;
      node.disabled = !question.allowOptionReuse && usedOptions.has(option.id) && selected[item.id] !== option.id;
      select.appendChild(node);
    });

    select.addEventListener("change", () => onChange({
      itemId: item.id,
      optionId: select.value || null,
      focusKey: select.dataset.focusKey
    }));
    control.appendChild(select);

    if (revealCorrect) {
      const status = document.createElement("div");
      status.className = "matching-row-status";
      status.textContent = detail.correct ? "✓ Верно" : "✕ Ошибка";
      const answer = document.createElement("div");
      answer.className = "matching-row-answer";
      answer.textContent = detail.correct
        ? `Ответ: ${detail.correctOptionText}`
        : `Ваш ответ: ${detail.selectedOptionText}. Правильный ответ: ${detail.correctOptionText}.`;
      const explanation = document.createElement("div");
      explanation.className = "matching-row-explanation";
      explanation.textContent = item.explanation;
      control.append(status, answer, explanation);
    }

    row.append(prompt, control);
    grid.appendChild(row);
  });

  container.appendChild(grid);
}

export function questionInstruction(question) {
  if (question.hint) return question.hint;
  if (question.type === "matching") return "Для каждой строки выберите подходящий вариант.";
  return question.type === "multiple"
    ? "Выберите все правильные ответы."
    : "Выберите один правильный ответ.";
}

export function appendReviewContent(container, question, answer, evaluation) {
  if (question.type !== "matching") {
    container.append(
      reviewLine("Ваш ответ", formatAnswer(question, answer)),
      reviewLine("Правильный ответ", formatAnswer(question, question.correct)),
      explanationBlock(question.explanation)
    );
    return;
  }

  const rows = document.createElement("div");
  rows.className = "matching-review";
  evaluation.details.forEach((detail) => {
    const row = document.createElement("div");
    row.className = `matching-review-row${detail.correct ? "" : " is-wrong"}`;
    const prompt = document.createElement("strong");
    prompt.className = detail.itemFormat === "formula" ? "is-formula" : "";
    prompt.textContent = detail.itemText;
    const status = document.createElement("span");
    status.className = "matching-review-status";
    status.textContent = detail.correct ? "✓ Верно" : "✕ Ошибка";
    row.append(
      prompt,
      status,
      reviewLine("Ваш ответ", detail.selectedOptionText),
      reviewLine("Правильный ответ", detail.correctOptionText),
      explanationBlock(detail.explanation)
    );
    rows.appendChild(row);
  });
  container.append(rows, explanationBlock(question.explanation));
}

function reviewLine(label, value) {
  const line = document.createElement("div");
  line.className = "trainer-review-line";
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  line.append(strong, document.createTextNode(value));
  return line;
}

function explanationBlock(value) {
  const explanation = document.createElement("div");
  explanation.className = "trainer-review-explanation";
  explanation.textContent = value;
  return explanation;
}

export { renderers };
