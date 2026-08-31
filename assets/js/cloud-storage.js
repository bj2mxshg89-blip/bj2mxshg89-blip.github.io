import {
  clearProgress,
  getHistory,
  loadProgress,
  saveProgress
} from "./storage.js?v=13";
import { getAccountContext, getSupabaseClient } from "./supabase-client.js?v=13";
import {
  attemptToCloudRow,
  chooseProgressSource,
  mergeAttemptHistory
} from "./cloud-records.js?v=13";
import { assignmentScope } from "./assignment-records.js?v=13";

const pendingProgress = new Map();

function cloudResult(overrides = {}) {
  return {
    enabled: false,
    signedIn: false,
    profile: null,
    status: "local",
    message: "Без входа прогресс сохраняется только на этом устройстве.",
    ...overrides
  };
}

export async function prepareCloudProgress(test, scope = assignmentScope()) {
  const account = await getAccountContext();
  if (!account.signedIn) {
    return cloudResult({
      status: account.online ? "local" : "offline",
      message: account.online
        ? "Войдите, чтобы продолжать попытки на другом устройстве."
        : "Облако недоступно; локальное сохранение продолжает работать."
    });
  }

  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from("attempt_progress")
      .select("test_id, test_version, scope_key, assignment_id, payload, updated_at")
      .eq("test_id", test.id)
      .eq("scope_key", scope.scopeKey)
      .maybeSingle();
    if (error) throw error;

    const local = loadProgress(test, scope.scopeKey);
    const selected = chooseProgressSource(local, data);
    if (selected.source === "cloud") {
      saveProgress(test.id, selected.data, scope.scopeKey);
    } else if (selected.source === "local") {
      await uploadProgress(account.user.id, test.id, test.version, selected.data, scope);
    }

    return cloudResult({
      enabled: true,
      signedIn: true,
      profile: account.profile,
      status: "synced",
      message: selected.source === "cloud"
        ? "Облачный прогресс загружен."
        : "Прогресс синхронизируется между устройствами."
    });
  } catch (error) {
    return cloudResult({
      enabled: true,
      signedIn: true,
      profile: account.profile,
      status: "offline",
      message: "Не удалось связаться с облаком; локальное сохранение продолжает работать.",
      error
    });
  }
}

async function uploadProgress(userId, testId, testVersion, progress, scope) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("attempt_progress").upsert({
    user_id: userId,
    test_id: testId,
    test_version: testVersion,
    scope_key: scope.scopeKey,
    assignment_id: scope.assignmentId,
    payload: progress,
    updated_at: progress.updatedAt || new Date().toISOString()
  }, { onConflict: "user_id,test_id,scope_key" });
  if (error) throw error;
}

export function queueCloudProgress(testId, testVersion, progress, scope = assignmentScope(), onStatus = null) {
  const pendingKey = `${testId}:${scope.scopeKey}`;
  const previous = pendingProgress.get(pendingKey);
  if (previous) window.clearTimeout(previous);
  onStatus?.("saving");

  const timer = window.setTimeout(async () => {
    pendingProgress.delete(pendingKey);
    const account = await getAccountContext();
    if (!account.signedIn) {
      onStatus?.("local");
      return;
    }
    try {
      await uploadProgress(account.user.id, testId, testVersion, progress, scope);
      onStatus?.("synced");
    } catch (_) {
      onStatus?.("offline");
    }
  }, 350);
  pendingProgress.set(pendingKey, timer);
}

export async function removeCloudProgress(testId, scope = assignmentScope()) {
  const pendingKey = `${testId}:${scope.scopeKey}`;
  const timer = pendingProgress.get(pendingKey);
  if (timer) window.clearTimeout(timer);
  pendingProgress.delete(pendingKey);

  const account = await getAccountContext();
  if (!account.signedIn) return { synced: false, reason: "signed-out" };
  const { error } = await getSupabaseClient()
    .from("attempt_progress")
    .delete()
    .eq("test_id", testId)
    .eq("scope_key", scope.scopeKey);
  if (error) return { synced: false, error };
  return { synced: true };
}

export async function saveCompletedAttempt(attempt) {
  const account = await getAccountContext();
  if (!account.signedIn) return { synced: false, reason: "signed-out" };

  const { error } = await getSupabaseClient()
    .from("attempts")
    .insert(attemptToCloudRow(account.user.id, attempt));
  if (error && error.code !== "23505") return { synced: false, error };
  await removeCloudProgress(attempt.testId, assignmentScope(attempt.assignmentId));
  return { synced: true };
}

export async function getCombinedHistory(testId) {
  const localHistory = getHistory(testId);
  const account = await getAccountContext();
  if (!account.signedIn) {
    return {
      history: localHistory,
      cloud: false,
      profile: null,
      message: account.online
        ? "Данные этого браузера. Войдите для облачной истории."
        : "Облако недоступно; показана история этого браузера."
    };
  }

  try {
    const { data, error } = await getSupabaseClient()
      .from("attempts")
      .select("attempt_id, test_id, test_version, variant_id, mode, started_at, completed_at, duration_ms, correct_count, total_questions, earned_points, max_points, percent, grade, question_ids, mistake_question_ids, selected_answers, retry_of, assignment_id")
      .eq("test_id", testId)
      .order("completed_at", { ascending: true });
    if (error) throw error;
    return {
      history: mergeAttemptHistory(localHistory, data),
      cloud: true,
      profile: account.profile,
      message: "История синхронизирована с аккаунтом и доступна на других устройствах."
    };
  } catch (error) {
    return {
      history: localHistory,
      cloud: false,
      profile: account.profile,
      error,
      message: "Облако временно недоступно; показана история этого браузера."
    };
  }
}

export function resetLocalProgressAfterCloudImport(testId) {
  clearProgress(testId);
}
