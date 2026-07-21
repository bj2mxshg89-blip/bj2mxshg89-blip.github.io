const PREFIX = "chem-cabinet";
const HISTORY_LIMIT = 50;
const memoryStorage = new Map();

export const storageKeys = Object.freeze({
  progress: (testId) => `${PREFIX}:progress:${testId}`,
  history: (testId) => `${PREFIX}:history:${testId}`,
  settings: `${PREFIX}:settings`
});

function getItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_) {
    return memoryStorage.has(key) ? memoryStorage.get(key) : null;
  }
}

function setItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (_) {
    memoryStorage.set(key, String(value));
  }
}

function removeItem(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (_) {
    memoryStorage.delete(key);
  }
}

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

export function loadProgress(test) {
  const raw = getItem(storageKeys.progress(test.id));
  if (!raw) return { status: "empty", data: null };

  const data = parseJson(raw, null);
  if (!data || typeof data !== "object") {
    return { status: "incompatible", data: null, reason: "Сохранение повреждено." };
  }

  if (data.testId !== test.id || data.testVersion !== test.version) {
    return {
      status: "incompatible",
      data,
      reason: "Сохранение создано для другой версии теста."
    };
  }

  const variant = test.variants.find((item) => item.id === data.variantId);
  if (!variant) {
    return { status: "incompatible", data, reason: "Сохранённый вариант больше не существует." };
  }

  const expectedIds = new Set(variant.questionIds);
  const savedIds = Array.isArray(data.baseQuestionIds) ? data.baseQuestionIds : [];
  if (savedIds.length !== expectedIds.size || savedIds.some((id) => !expectedIds.has(id))) {
    return {
      status: "incompatible",
      data,
      reason: "Состав заданий изменился и не совместим с сохранённой попыткой."
    };
  }

  if (!Array.isArray(data.questionOrder) || data.questionOrder.some((id) => !expectedIds.has(id))) {
    return { status: "incompatible", data, reason: "Порядок заданий в сохранении повреждён." };
  }

  return { status: "compatible", data };
}

export function saveProgress(testId, progress) {
  setItem(storageKeys.progress(testId), JSON.stringify({
    ...progress,
    updatedAt: new Date().toISOString()
  }));
}

export function clearProgress(testId) {
  removeItem(storageKeys.progress(testId));
}

export function getHistory(testId) {
  const history = parseJson(getItem(storageKeys.history(testId)), []);
  return Array.isArray(history) ? history.filter((item) => item && typeof item === "object") : [];
}

export function appendHistory(testId, attempt) {
  const history = getHistory(testId);
  history.push(attempt);
  setItem(storageKeys.history(testId), JSON.stringify(history.slice(-HISTORY_LIMIT)));
}

export function clearHistory(testId) {
  removeItem(storageKeys.history(testId));
}

export function getSettings() {
  const settings = parseJson(getItem(storageKeys.settings), {});
  return settings && typeof settings === "object" ? settings : {};
}

export function updateSettings(patch) {
  const next = { ...getSettings(), ...patch };
  setItem(storageKeys.settings, JSON.stringify(next));
  return next;
}
