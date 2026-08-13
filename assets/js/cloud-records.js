function validDate(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function chooseProgressSource(localProgress, cloudRow) {
  const local = localProgress?.status === "compatible" ? localProgress.data : null;
  const cloud = cloudRow?.payload && typeof cloudRow.payload === "object" ? {
    ...cloudRow.payload,
    updatedAt: cloudRow.payload.updatedAt || cloudRow.updated_at
  } : null;

  if (!local && !cloud) return { source: "none", data: null };
  if (!local) return { source: "cloud", data: cloud };
  if (!cloud) return { source: "local", data: local };
  return validDate(cloud.updatedAt) > validDate(local.updatedAt)
    ? { source: "cloud", data: cloud }
    : { source: "local", data: local };
}

export function attemptToCloudRow(userId, attempt) {
  return {
    user_id: userId,
    attempt_id: attempt.attemptId,
    test_id: attempt.testId,
    test_version: attempt.testVersion,
    variant_id: attempt.variantId,
    mode: attempt.mode,
    started_at: attempt.startedAt,
    completed_at: attempt.completedAt,
    duration_ms: attempt.durationMs,
    correct_count: attempt.correctCount,
    total_questions: attempt.totalQuestions ?? attempt.total,
    earned_points: attempt.earnedPoints,
    max_points: attempt.maxPoints,
    percent: attempt.percent,
    grade: attempt.grade,
    question_ids: attempt.questionIds,
    mistake_question_ids: attempt.mistakeQuestionIds || [],
    selected_answers: attempt.selectedAnswers || {},
    retry_of: attempt.retryOf || null
  };
}

export function cloudRowToAttempt(row) {
  return {
    schemaVersion: 1,
    testId: row.test_id,
    testVersion: row.test_version,
    attemptId: row.attempt_id,
    variantId: row.variant_id,
    mode: row.mode,
    questionIds: Array.isArray(row.question_ids) ? row.question_ids : [],
    selectedAnswers: row.selected_answers && typeof row.selected_answers === "object"
      ? row.selected_answers
      : {},
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    correctCount: row.correct_count,
    total: row.total_questions,
    totalQuestions: row.total_questions,
    earnedPoints: row.earned_points,
    maxPoints: row.max_points,
    percent: row.percent,
    grade: row.grade,
    mistakeQuestionIds: Array.isArray(row.mistake_question_ids) ? row.mistake_question_ids : [],
    retryOf: row.retry_of || null,
    cloud: true
  };
}

export function mergeAttemptHistory(localHistory, cloudRows) {
  const merged = new Map();
  (Array.isArray(localHistory) ? localHistory : []).forEach((attempt) => {
    if (attempt?.attemptId) merged.set(attempt.attemptId, attempt);
  });
  (Array.isArray(cloudRows) ? cloudRows : []).map(cloudRowToAttempt).forEach((attempt) => {
    if (attempt.attemptId) merged.set(attempt.attemptId, attempt);
  });
  return [...merged.values()].sort((left, right) => validDate(left.completedAt) - validDate(right.completedAt));
}
