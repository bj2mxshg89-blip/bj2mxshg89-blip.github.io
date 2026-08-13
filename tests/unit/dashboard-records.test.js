import test from "node:test";
import assert from "node:assert/strict";
import {
  formatTrend,
  groupAttemptsByUser,
  sortAttemptsNewestFirst,
  summarizeAttempts
} from "../../assets/js/dashboard-records.js";

const attempts = [
  { user_id: "student-1", completed_at: "2026-08-12T10:00:00Z", percent: 60 },
  { user_id: "student-1", completed_at: "2026-08-13T10:00:00Z", percent: 80 },
  { user_id: "student-2", completed_at: "2026-08-13T11:00:00Z", percent: 70 }
];

test("попытки сортируются от новых к старым", () => {
  assert.equal(sortAttemptsNewestFirst(attempts)[0].user_id, "student-2");
});

test("сводка считает средний, лучший и динамику", () => {
  const summary = summarizeAttempts(attempts.filter((item) => item.user_id === "student-1"));
  assert.deepEqual({ count: summary.count, average: summary.average, best: summary.best, trend: summary.trend }, {
    count: 2,
    average: 70,
    best: 80,
    trend: 20
  });
});

test("пустая сводка безопасна", () => {
  assert.deepEqual(summarizeAttempts([]), { count: 0, average: 0, best: 0, latest: null, trend: null });
});

test("группировка использует ID ученика", () => {
  const grouped = groupAttemptsByUser(attempts);
  assert.equal(grouped.get("student-1").length, 2);
  assert.equal(grouped.get("student-2").length, 1);
});

test("динамика форматируется в процентных пунктах", () => {
  assert.equal(formatTrend(20), "+20 п.п.");
  assert.equal(formatTrend(-5), "-5 п.п.");
  assert.equal(formatTrend(0), "без изменений");
  assert.equal(formatTrend(null), "—");
});
