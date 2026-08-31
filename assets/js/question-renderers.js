import { evaluateAnswer, formatAnswer, formatCorrectAnswer } from "./question-types.js?v=13";

const renderers = {
  single: renderSingleQuestion,
  multiple: renderMultipleQuestion,
  matching: renderMatchingQuestion,
  number: renderNumberQuestion,
  text: renderTextQuestion,
  sequence: renderSequenceQuestion
};

export function renderQuestionContent(container, content, { append = false, review = false } = {}) {
  if (!append) container.replaceChildren();
  if (!content) {
    if (!append) container.hidden = true;
    return;
  }

  const figure = document.createElement("figure");
  figure.className = `question-content${review ? " is-review" : ""}`;
  const value = document.createElement("div");
  value.className = `question-content-value${content.format === "formula" ? " is-formula" : ""}`;
  value.textContent = content.text;
  figure.appendChild(value);

  if (content.caption) {
    const caption = document.createElement("figcaption");
    caption.className = "question-content-caption";
    caption.textContent = content.caption;
    figure.appendChild(caption);
  }

  container.appendChild(figure);
  container.hidden = false;
}

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

function renderNumberQuestion({
  container,
  question,
  selected,
  locked,
  revealCorrect,
  onChange,
  onEnter
}) {
  const wrapper = document.createElement("div");
  wrapper.className = "number-answer answer-input-card";
  if (revealCorrect) {
    wrapper.classList.add(evaluateAnswer(question, selected).isFullyCorrect ? "is-correct" : "is-wrong");
  }

  const inputId = `number-${question.id}`;
  const label = document.createElement("label");
  label.className = "number-answer-label";
  label.htmlFor = inputId;
  label.textContent = "Ваш ответ";

  const row = document.createElement("div");
  row.className = "number-answer-row";
  const input = document.createElement("input");
  input.id = inputId;
  input.type = "text";
  input.className = "number-answer-input";
  input.value = typeof selected === "string" ? selected : "";
  input.placeholder = question.number.placeholder || "Введите число";
  input.inputMode = question.number.integer ? "numeric" : "decimal";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.readOnly = locked;
  input.dataset.focusKey = "number-input";
  input.dataset.answerControl = "true";

  const describedBy = ["questionHint"];
  if (question.number.unit) {
    const unit = document.createElement("span");
    unit.id = `${inputId}-unit`;
    unit.className = "number-answer-unit";
    unit.textContent = question.number.unit;
    row.append(input, unit);
    describedBy.push(unit.id);
  } else {
    row.appendChild(input);
  }
  input.setAttribute("aria-describedby", describedBy.join(" "));

  input.addEventListener("input", () => onChange({
    value: input.value,
    focusKey: input.dataset.focusKey,
    render: false
  }));
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    onEnter?.(input.dataset.focusKey);
  });

  wrapper.append(label, row);
  container.appendChild(wrapper);
}

function renderTextQuestion({
  container,
  question,
  selected,
  locked,
  revealCorrect,
  onChange,
  onEnter
}) {
  const wrapper = document.createElement("div");
  wrapper.className = "text-answer answer-input-card";
  if (revealCorrect) {
    wrapper.classList.add(evaluateAnswer(question, selected).isFullyCorrect ? "is-correct" : "is-wrong");
  }

  const inputId = `text-${question.id}`;
  const helpId = `${inputId}-help`;
  const label = document.createElement("label");
  label.className = "text-answer-label";
  label.htmlFor = inputId;
  label.textContent = "Ваш ответ";

  const input = document.createElement("input");
  input.id = inputId;
  input.type = "text";
  input.className = "text-answer-input";
  input.value = typeof selected === "string" ? selected : "";
  input.placeholder = question.textAnswer.placeholder;
  input.inputMode = question.textAnswer.inputMode;
  input.maxLength = question.textAnswer.maxLength;
  input.autocomplete = "off";
  input.spellcheck = false;
  input.readOnly = locked;
  input.dataset.focusKey = "text-input";
  input.dataset.answerControl = "true";
  input.setAttribute("aria-describedby", `questionHint ${helpId} questionStatus`);

  const help = document.createElement("div");
  help.id = helpId;
  help.className = "text-answer-help";
  help.textContent = `Не более ${question.textAnswer.maxLength} символов.`;

  input.addEventListener("input", () => onChange({
    value: input.value,
    focusKey: input.dataset.focusKey,
    render: false
  }));

  let isComposing = false;
  input.addEventListener("compositionstart", () => { isComposing = true; });
  input.addEventListener("compositionend", () => { isComposing = false; });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.repeat || event.isComposing || isComposing || event.keyCode === 229) return;
    event.preventDefault();
    onEnter?.(input.dataset.focusKey);
  });

  wrapper.append(label, input, help);
  container.appendChild(wrapper);
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

function renderSequenceQuestion({
  container,
  question,
  selected,
  locked,
  revealCorrect,
  onChange
}) {
  const itemMap = new Map(question.items.map((item) => [item.id, item]));
  const order = Array.isArray(selected?.order) ? selected.order : [];
  const evaluation = evaluateAnswer(question, selected);
  const detailByItem = new Map(evaluation.details.map((detail) => [detail.itemId, detail]));
  const list = document.createElement("div");
  list.className = "sequence-list";
  list.dataset.answerControl = "true";
  list.setAttribute("role", "list");
  list.setAttribute("aria-describedby", "questionHint questionStatus");
  let draggedItemId = null;

  order.forEach((itemId, index) => {
    const item = itemMap.get(itemId);
    if (!item) return;

    const row = document.createElement("div");
    row.className = "sequence-item";
    row.dataset.itemId = itemId;
    row.dataset.focusKey = `sequence-${itemId}-item`;
    row.tabIndex = -1;
    row.setAttribute("role", "listitem");
    if (revealCorrect) {
      row.classList.add(detailByItem.get(itemId)?.correct ? "is-correct" : "is-wrong");
    }

    const position = document.createElement("span");
    position.className = "sequence-position";
    position.setAttribute("aria-label", `Позиция ${index + 1}`);
    position.textContent = String(index + 1);

    const handle = document.createElement("span");
    handle.className = "sequence-drag-handle";
    handle.draggable = !locked;
    handle.setAttribute("aria-hidden", "true");
    handle.textContent = "⠿";
    if (locked) handle.classList.add("is-disabled");

    const value = document.createElement("span");
    value.className = `sequence-text${item.format === "formula" ? " is-formula" : ""}`;
    value.textContent = item.text;

    const controls = document.createElement("span");
    controls.className = "sequence-controls";
    const move = (direction) => {
      onChange({
        action: "move",
        itemId,
        direction,
        focusKey: row.dataset.focusKey
      });
    };
    const up = sequenceMoveButton({
      label: `Переместить ${item.text} выше`,
      symbol: "↑",
      disabled: locked || index === 0,
      focusKey: `sequence-${itemId}-up`,
      onClick: () => move("up")
    });
    const down = sequenceMoveButton({
      label: `Переместить ${item.text} ниже`,
      symbol: "↓",
      disabled: locked || index === order.length - 1,
      focusKey: `sequence-${itemId}-down`,
      onClick: () => move("down")
    });
    controls.append(up, down);

    handle.addEventListener("dragstart", (event) => {
      draggedItemId = itemId;
      row.classList.add("is-dragging");
      event.dataTransfer?.setData("text/plain", itemId);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });
    handle.addEventListener("dragend", () => {
      draggedItemId = null;
      row.classList.remove("is-dragging");
    });
    row.addEventListener("dragover", (event) => {
      if (!draggedItemId || locked) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });
    row.addEventListener("drop", (event) => {
      if (!draggedItemId || locked) return;
      event.preventDefault();
      const nextOrder = [...order];
      const from = nextOrder.indexOf(draggedItemId);
      const to = nextOrder.indexOf(itemId);
      if (from < 0 || to < 0 || from === to) return;
      nextOrder.splice(from, 1);
      nextOrder.splice(to, 0, draggedItemId);
      onChange({
        action: "reorder",
        order: nextOrder,
        focusKey: `sequence-${draggedItemId}-item`
      });
    });

    row.append(position, handle, value, controls);
    if (revealCorrect) {
      const status = document.createElement("span");
      status.className = "sequence-position-status";
      status.textContent = detailByItem.get(itemId)?.correct ? "✓ Верная позиция" : "✕ Неверная позиция";
      row.appendChild(status);
    }
    list.appendChild(row);
  });

  container.appendChild(list);
}

function sequenceMoveButton({ label, symbol, disabled, focusKey, onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sequence-move-button";
  button.disabled = disabled;
  button.dataset.focusKey = focusKey;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.textContent = symbol;
  button.addEventListener("click", onClick);
  return button;
}

export function questionInstruction(question) {
  if (question.hint) return question.hint;
  if (question.type === "matching") return "Для каждой строки выберите подходящий вариант.";
  if (question.type === "sequence") {
    return "Измените порядок кнопками со стрелками; перетаскивание мышью — дополнительный способ.";
  }
  if (question.type === "number") {
    return question.number.integer
      ? "Введите одно целое число без единицы измерения."
      : "Введите одно число; допустимы десятичная запятая или точка.";
  }
  if (question.type === "text") {
    return question.validationMessage || "Введите краткий текстовый ответ.";
  }
  return question.type === "multiple"
    ? "Выберите все правильные ответы."
    : "Выберите один правильный ответ.";
}

export function appendReviewContent(container, question, answer, evaluation) {
  renderQuestionContent(container, question.content, { append: true, review: true });
  if (question.type === "sequence") {
    container.append(
      reviewLine("Ваш порядок", formatAnswer(question, answer)),
      reviewLine("Правильный порядок", formatCorrectAnswer(question)),
      reviewLine("Результат", `${evaluation.earnedPoints} из ${evaluation.maxPoints} позиций`),
      explanationBlock(question.explanation)
    );
    return;
  }
  if (question.type !== "matching") {
    container.append(
      reviewLine("Ваш ответ", formatAnswer(question, answer)),
      reviewLine("Правильный ответ", formatCorrectAnswer(question)),
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
