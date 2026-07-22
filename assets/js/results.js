import {
  TestLoadError,
  fetchJson,
  formatDateTime,
  formatDuration,
  getTestId,
  modeTitle,
  validateTestDefinition,
  variantTitle
} from "./utils.js?v=7";
import { clearHistory, getHistory } from "./storage.js?v=7";

const elements = Object.fromEntries([
  "historyTitle", "historyDescription", "historyLoading", "historyError", "historyErrorText",
  "historyPanel", "historyTestTitle", "historySummary", "openTestLink", "clearHistoryButton",
  "historyList"
].map((id) => [id, document.getElementById(id)]));

let test = null;

async function initResults() {
  try {
    const testId = getTestId();
    test = await fetchJson(`data/tests/${encodeURIComponent(testId)}.json`);
    const validation = validateTestDefinition(test, testId);
    if (!validation.valid) throw new TestLoadError("Данные теста некорректны.", validation.errors);

    document.title = `История: ${test.title} — Кабинет учителя`;
    elements.historyTitle.textContent = "История результатов";
    elements.historyDescription.textContent = `${test.title}. Данные остаются только в этом браузере.`;
    elements.historyTestTitle.textContent = test.title;
    elements.openTestLink.href = `test.html?id=${encodeURIComponent(test.id)}`;
    elements.clearHistoryButton.addEventListener("click", clearCurrentHistory);
    renderHistory();
    elements.historyLoading.hidden = true;
    elements.historyPanel.hidden = false;
  } catch (error) {
    console.error(error);
    elements.historyLoading.hidden = true;
    elements.historyError.hidden = false;
    elements.historyErrorText.textContent = error instanceof Error ? error.message : String(error);
  }
}

function renderHistory() {
  const history = getHistory(test.id).slice().reverse();
  elements.historyList.replaceChildren();
  elements.historySummary.textContent = history.length
    ? `Сохранено попыток: ${history.length}. Сначала показаны последние.`
    : "Завершённых попыток пока нет.";
  elements.clearHistoryButton.disabled = history.length === 0;

  if (!history.length) {
    const empty = document.createElement("div");
    empty.className = "trainer-message";
    empty.textContent = "Пройдите тест до конца — результат появится здесь.";
    elements.historyList.appendChild(empty);
    return;
  }

  history.forEach((attempt) => {
    const item = document.createElement("article");
    item.className = "trainer-history-item";

    const main = document.createElement("div");
    main.className = "trainer-history-main";
    const heading = document.createElement("strong");
    heading.textContent = `${variantTitle(test, attempt.variantId)} · ${modeTitle(attempt.mode)}`;
    const date = document.createElement("small");
    date.textContent = `${formatDateTime(attempt.completedAt)} · версия ${attempt.testVersion ?? "—"}`;
    main.append(heading, date);

    const hasPointScore = Number.isFinite(attempt.earnedPoints) && Number.isFinite(attempt.maxPoints) &&
      attempt.maxPoints !== (attempt.totalQuestions ?? attempt.total);
    item.append(
      main,
      hasPointScore
        ? metric(`${attempt.earnedPoints}/${attempt.maxPoints}`, "баллы")
        : metric(`${attempt.correctCount ?? 0}/${attempt.total ?? 0}`, "верно"),
      metric(`${attempt.percent ?? 0}%`, `оценка ${attempt.grade ?? "—"}`),
      metric(formatDuration(attempt.durationMs), "время")
    );
    elements.historyList.appendChild(item);
  });
}

function metric(value, label) {
  const wrapper = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = value;
  const caption = document.createElement("span");
  caption.textContent = label;
  wrapper.append(strong, caption);
  return wrapper;
}

function clearCurrentHistory() {
  if (!test) return;
  const confirmed = window.confirm("Удалить историю результатов этого теста на данном устройстве?");
  if (!confirmed) return;
  clearHistory(test.id);
  renderHistory();
}

initResults();
