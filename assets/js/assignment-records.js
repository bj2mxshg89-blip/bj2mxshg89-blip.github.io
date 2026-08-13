const PERSONAL_SCOPE = "personal";

export function normalizeAssignmentId(value) {
  const id = typeof value === "string" && value.trim() !== ""
    ? Number(value)
    : Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function assignmentScope(assignmentId = null) {
  const normalizedId = normalizeAssignmentId(assignmentId);
  return normalizedId
    ? { scopeKey: `assignment-${normalizedId}`, assignmentId: normalizedId }
    : { scopeKey: PERSONAL_SCOPE, assignmentId: null };
}

export function parseAssignmentId(search = globalThis.location?.search || "") {
  const raw = new URLSearchParams(search).get("assignment");
  if (raw === null) return null;
  return normalizeAssignmentId(raw);
}

export function buildAssignmentUrl(assignment) {
  const assignmentId = normalizeAssignmentId(assignment?.id);
  const testId = typeof assignment?.test_id === "string" ? assignment.test_id.trim() : "";
  if (!assignmentId || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(testId)) return null;
  return `test.html?id=${encodeURIComponent(testId)}&assignment=${assignmentId}`;
}

function timestamp(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function latestAttemptByAssignment(attempts) {
  const result = new Map();
  (Array.isArray(attempts) ? attempts : []).forEach((attempt) => {
    const assignmentId = normalizeAssignmentId(attempt?.assignment_id ?? attempt?.assignmentId);
    if (!assignmentId) return;
    const previous = result.get(assignmentId);
    const currentTime = timestamp(attempt.completed_at ?? attempt.completedAt);
    const previousTime = timestamp(previous?.completed_at ?? previous?.completedAt);
    if (!previous || currentTime >= previousTime) result.set(assignmentId, attempt);
  });
  return result;
}

export function getAssignmentState(assignment, attempt = null, now = Date.now()) {
  if (attempt) {
    const dueAt = timestamp(assignment?.due_at ?? assignment?.dueAt);
    const completedAt = timestamp(attempt?.completed_at ?? attempt?.completedAt);
    return {
      key: dueAt && completedAt > dueAt ? "completed-late" : "completed",
      completed: true,
      overdue: Boolean(dueAt && completedAt > dueAt)
    };
  }

  const dueAt = timestamp(assignment?.due_at ?? assignment?.dueAt);
  const nowTime = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  if (dueAt && dueAt < nowTime) {
    return { key: "overdue", completed: false, overdue: true };
  }
  return { key: "pending", completed: false, overdue: false };
}

export function summarizeAssignment(assignment, members, attempts) {
  const assignmentId = normalizeAssignmentId(assignment?.id);
  const studentIds = new Set(
    (Array.isArray(members) ? members : [])
      .filter((member) => member?.classroom_id === assignment?.classroom_id)
      .map((member) => member.student_id)
      .filter(Boolean)
  );
  const completedStudents = new Set(
    (Array.isArray(attempts) ? attempts : [])
      .filter((attempt) => normalizeAssignmentId(attempt?.assignment_id) === assignmentId)
      .map((attempt) => attempt.user_id)
      .filter((userId) => studentIds.has(userId))
  );
  return {
    total: studentIds.size,
    completed: completedStudents.size,
    remaining: Math.max(0, studentIds.size - completedStudents.size)
  };
}
