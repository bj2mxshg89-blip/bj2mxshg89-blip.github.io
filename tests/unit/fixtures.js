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

export const grading = {
  thresholds: { "3": 50, "4": 70, "5": 90 }
};
