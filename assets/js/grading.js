import { arraysEqual } from "./utils.js";

export function isAnswerCorrect(question, selected = []) {
  return arraysEqual(selected, question.correct);
}

export function gradeFromPercent(percent, grading) {
  const thresholds = grading.thresholds;
  if (percent >= Number(thresholds["5"])) return 5;
  if (percent >= Number(thresholds["4"])) return 4;
  if (percent >= Number(thresholds["3"])) return 3;
  return 2;
}

export function calculateResult({ test, questionIds, answers, startedAt, completedAt = new Date() }) {
  const questionMap = new Map(test.questions.map((question) => [question.id, question]));
  const mistakes = [];
  let correctCount = 0;

  questionIds.forEach((questionId) => {
    const question = questionMap.get(questionId);
    if (question && isAnswerCorrect(question, answers[questionId] || [])) correctCount += 1;
    else mistakes.push(questionId);
  });

  const total = questionIds.length;
  const percent = total ? Math.round((correctCount / total) * 100) : 0;
  const grade = gradeFromPercent(percent, test.grading);
  const startDate = new Date(startedAt);
  const endDate = new Date(completedAt);
  const durationMs = Math.max(0, endDate.getTime() - startDate.getTime());

  return { correctCount, total, percent, grade, mistakes, durationMs };
}
