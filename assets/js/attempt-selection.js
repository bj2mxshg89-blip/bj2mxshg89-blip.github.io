function uniqueKnownIds(values, allowedIds) {
  const allowed = new Set(allowedIds);
  const seen = new Set();
  return (Array.isArray(values) ? values : []).filter((id) => {
    if (!allowed.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function validPermutation(candidate, source) {
  return Array.isArray(candidate) && candidate.length === source.length &&
    new Set(candidate).size === source.length && candidate.every((id) => source.includes(id));
}

export function createAttemptQuestionOrder({
  baseQuestionIds,
  selectionCount,
  selectionGroups = null,
  shuffleQuestions = false,
  retryQuestionIds = null
}, shuffle = (values) => [...values]) {
  const base = uniqueKnownIds(baseQuestionIds, baseQuestionIds || []);
  if (Array.isArray(retryQuestionIds) && retryQuestionIds.length) {
    return uniqueKnownIds(retryQuestionIds, base);
  }

  if (Array.isArray(selectionGroups) && selectionGroups.length) {
    const selected = selectionGroups.flatMap((group) => {
      const ids = uniqueKnownIds(group.questionIds, base);
      const candidate = shuffleQuestions ? shuffle([...ids]) : ids;
      const ordered = validPermutation(candidate, ids) ? candidate : ids;
      return ordered.slice(0, group.count);
    });
    const unique = uniqueKnownIds(selected, base);
    const candidate = shuffleQuestions ? shuffle([...unique]) : unique;
    return validPermutation(candidate, unique) ? candidate : unique;
  }

  let ordered = [...base];
  if (shuffleQuestions) {
    const candidate = shuffle([...base]);
    if (validPermutation(candidate, base)) ordered = [...candidate];
  }

  const count = Number.isInteger(selectionCount) && selectionCount > 0
    ? Math.min(selectionCount, ordered.length)
    : ordered.length;
  return ordered.slice(0, count);
}

export function restoreQuestionOrder(savedOrder, baseQuestionIds) {
  return uniqueKnownIds(savedOrder, baseQuestionIds || []);
}
