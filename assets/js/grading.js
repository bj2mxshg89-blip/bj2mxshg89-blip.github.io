import { evaluateAnswer } from "./question-types.js?v=10";

export function isAnswerCorrect(question, selected) {
  return evaluateAnswer(question, selected).isFullyCorrect;
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
  let earnedPoints = 0;
  let maxPoints = 0;
  let fullyCorrectCount = 0;

  questionIds.forEach((questionId) => {
    const question = questionMap.get(questionId);
    if (!question) {
      mistakes.push(questionId);
      return;
    }
    const evaluation = evaluateAnswer(question, answers[questionId]);
    earnedPoints += evaluation.earnedPoints;
    maxPoints += evaluation.maxPoints;
    if (evaluation.isFullyCorrect) fullyCorrectCount += 1;
    else mistakes.push(questionId);
  });

  const totalQuestions = questionIds.length;
  const percent = maxPoints ? Math.round((earnedPoints / maxPoints) * 100) : 0;
  const grade = gradeFromPercent(percent, test.grading);
  const startDate = new Date(startedAt);
  const endDate = new Date(completedAt);
  const durationMs = Math.max(0, endDate.getTime() - startDate.getTime());

  return {
    earnedPoints,
    maxPoints,
    fullyCorrectCount,
    totalQuestions,
    correctCount: fullyCorrectCount,
    total: totalQuestions,
    percent,
    grade,
    mistakes,
    durationMs
  };
}
