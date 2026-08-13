import { assignmentScope, parseAssignmentId } from "./assignment-records.js?v=10";
import { getAccountContext, getSupabaseClient } from "./supabase-client.js?v=10";
import { TestLoadError } from "./utils.js?v=10";

function assignmentError(message, detail) {
  return new TestLoadError(message, [detail]);
}

export async function loadAssignmentContext(test, search = globalThis.location?.search || "") {
  const params = new URLSearchParams(search);
  if (!params.has("assignment")) return null;

  const assignmentId = parseAssignmentId(search);
  if (!assignmentId) {
    throw assignmentError(
      "Не удалось открыть назначенную работу.",
      "Параметр assignment должен быть положительным целым числом."
    );
  }

  const account = await getAccountContext();
  if (!account.signedIn) {
    throw assignmentError(
      "Для назначенной работы нужен аккаунт ученика.",
      "Войдите в аккаунт, который учитель добавил в класс, и откройте ссылку ещё раз."
    );
  }
  if (account.profile?.role !== "student") {
    throw assignmentError(
      "Назначенную работу открывает ученик.",
      "Для предварительного просмотра учитель может открыть обычную карточку теста без параметра assignment."
    );
  }

  const supabase = getSupabaseClient();
  const { data: assignment, error } = await supabase
    .from("assignments")
    .select("id, classroom_id, test_id, test_version, variant_id, mode, due_at, created_at")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) throw assignmentError("Не удалось загрузить назначенную работу.", error.message);
  if (!assignment) {
    throw assignmentError(
      "Назначенная работа не найдена.",
      "Работа не существует либо этот аккаунт не входит в нужный класс."
    );
  }

  if (assignment.test_id !== test.id || assignment.test_version !== test.version) {
    throw assignmentError(
      "Назначенная работа несовместима с текущей версией теста.",
      "Попросите учителя выдать работу заново."
    );
  }
  if (!test.variants.some((variant) => variant.id === assignment.variant_id)) {
    throw assignmentError(
      "В назначенной работе указан недоступный вариант.",
      `Вариант «${assignment.variant_id}» отсутствует в текущем тесте.`
    );
  }
  if (!test.modes?.[assignment.mode]?.enabled) {
    throw assignmentError(
      "В назначенной работе указан недоступный режим.",
      `Режим «${assignment.mode}» отключён в текущем тесте.`
    );
  }

  const { data: classroom, error: classroomError } = await supabase
    .from("classrooms")
    .select("id, title")
    .eq("id", assignment.classroom_id)
    .maybeSingle();
  if (classroomError) throw assignmentError("Не удалось загрузить класс.", classroomError.message);

  return {
    id: assignment.id,
    classroomId: assignment.classroom_id,
    classroomTitle: classroom?.title || "Учебная группа",
    testId: assignment.test_id,
    testVersion: assignment.test_version,
    variantId: assignment.variant_id,
    mode: assignment.mode,
    dueAt: assignment.due_at,
    createdAt: assignment.created_at,
    scope: assignmentScope(assignment.id)
  };
}
