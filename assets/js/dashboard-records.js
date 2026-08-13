function timestamp(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function sortAttemptsNewestFirst(attempts) {
  return [...(Array.isArray(attempts) ? attempts : [])]
    .sort((left, right) => timestamp(right.completed_at) - timestamp(left.completed_at));
}

export function summarizeAttempts(attempts) {
  const ordered = sortAttemptsNewestFirst(attempts);
  if (!ordered.length) {
    return { count: 0, average: 0, best: 0, latest: null, trend: null };
  }
  const percentages = ordered.map((item) => Number(item.percent) || 0);
  return {
    count: ordered.length,
    average: Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length),
    best: Math.max(...percentages),
    latest: ordered[0],
    trend: ordered.length > 1 ? percentages[0] - percentages[1] : null
  };
}

export function groupAttemptsByUser(attempts) {
  const result = new Map();
  (Array.isArray(attempts) ? attempts : []).forEach((attempt) => {
    const userId = attempt?.user_id;
    if (!userId) return;
    const bucket = result.get(userId) || [];
    bucket.push(attempt);
    result.set(userId, bucket);
  });
  return result;
}

export function formatTrend(value) {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "без изменений";
  return `${value > 0 ? "+" : ""}${value} п.п.`;
}
