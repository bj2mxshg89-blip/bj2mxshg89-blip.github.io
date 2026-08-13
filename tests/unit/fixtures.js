export const singleQuestion = {
  id: "unit-single",
  type: "single",
  options: ["A", "B", "C"],
  correct: [1]
};

export const multipleQuestion = {
  id: "unit-multiple",
  type: "multiple",
  options: ["A", "B", "C", "D"],
  correct: [0, 2]
};

export const matchingQuestion = {
  id: "unit-matching",
  type: "matching",
  items: [
    { id: "a", text: "A", explanation: "A → 1" },
    { id: "b", text: "B", explanation: "B → 2" },
    { id: "c", text: "C", explanation: "C → 3" },
    { id: "d", text: "D", explanation: "D → 4" }
  ],
  options: [
    { id: "one", text: "1" },
    { id: "two", text: "2" },
    { id: "three", text: "3" },
    { id: "four", text: "4" },
    { id: "extra", text: "5" }
  ],
  correct: { a: "one", b: "two", c: "three", d: "four" },
  allowOptionReuse: false
};

export const sequenceQuestion = {
  id: "unit-sequence",
  type: "sequence",
  text: "Расположите элементы по порядку.",
  items: [
    { id: "a", text: "A", explanation: "A занимает позицию 1." },
    { id: "b", text: "B", explanation: "B занимает позицию 2." },
    { id: "c", text: "C", explanation: "C занимает позицию 3." },
    { id: "d", text: "D", explanation: "D занимает позицию 4." }
  ],
  correct: ["a", "b", "c", "d"],
  sequence: {
    shuffleInitial: true,
    scoring: "position"
  }
};

export const numberQuestion = {
  id: "unit-number",
  type: "number",
  correct: 5,
  number: {
    integer: true,
    min: 0,
    max: 50,
    tolerance: 0,
    unit: "σ-связей",
    placeholder: "Введите число"
  }
};

export const decimalNumberQuestion = {
  id: "unit-decimal-number",
  type: "number",
  correct: 12.5,
  number: {
    integer: false,
    min: -20,
    max: 20,
    tolerance: 0.1,
    unit: "градуса"
  }
};

export const textQuestion = {
  id: "unit-text",
  type: "text",
  correct: ["окислитель"],
  textAnswer: {
    caseSensitive: false,
    trim: true,
    collapseWhitespace: true,
    normalizeUnicodeMinus: true,
    minLength: 1,
    maxLength: 30,
    placeholder: "Введите ответ",
    inputMode: "text"
  }
};

export const oxidationStateTextQuestion = {
  ...textQuestion,
  id: "unit-oxidation-state-text",
  correct: ["-3"],
  validationMessage: "Используйте знак и число, например +6 или −3."
};

export const grading = {
  thresholds: { "3": 50, "4": 70, "5": 90 }
};
