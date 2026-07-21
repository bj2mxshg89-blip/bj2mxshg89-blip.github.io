const renderers = {
  single: renderSingleQuestion,
  multiple: renderMultipleQuestion
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
    input.checked = isSelected;
    input.disabled = locked;
    input.addEventListener("change", () => onChange(originalIndex, input.checked));

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

export function questionInstruction(question) {
  if (question.hint) return question.hint;
  return question.type === "multiple"
    ? "Выберите все правильные ответы."
    : "Выберите один правильный ответ.";
}

export { renderers };
