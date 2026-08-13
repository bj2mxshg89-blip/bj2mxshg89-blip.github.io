import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import {
  accountEmail,
  corsHeaders,
  jsonResponse,
  serverCredentials,
  validateAccountInput
} from "../_shared/common.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Метод не поддерживается." }, 405);

  try {
    const authorization = request.headers.get("Authorization") || "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!accessToken) return jsonResponse({ error: "Требуется вход учителя." }, 401);

    const input = await request.json();
    const validated = validateAccountInput(input);
    if (validated.error) return jsonResponse({ error: validated.error }, 400);
    const classroomId = Number(input.classroomId);
    if (!Number.isSafeInteger(classroomId) || classroomId < 1) {
      return jsonResponse({ error: "Класс не найден." }, 400);
    }

    const { url, secretKey, publicKey } = serverCredentials();
    if (!url || !secretKey || !publicKey) return jsonResponse({ error: "Сервис аккаунтов не настроен." }, 503);
    const userClient = createClient(url, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userData.user) return jsonResponse({ error: "Сессия недействительна." }, 401);

    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const teacherId = userData.user.id;
    const { data: teacher, error: teacherError } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", teacherId)
      .eq("role", "teacher")
      .maybeSingle();
    if (teacherError || !teacher) return jsonResponse({ error: "Операция доступна только учителю." }, 403);

    const { data: classroom, error: classroomError } = await admin
      .from("classrooms")
      .select("id")
      .eq("id", classroomId)
      .eq("teacher_id", teacherId)
      .maybeSingle();
    if (classroomError || !classroom) return jsonResponse({ error: "Класс не найден или принадлежит другому учителю." }, 403);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: accountEmail(validated.login),
      password: validated.password,
      email_confirm: true,
      user_metadata: {
        login_name: validated.login,
        display_name: validated.displayName
      },
      app_metadata: { account_type: "student" }
    });
    if (createError || !created.user) {
      const status = createError?.message?.toLowerCase().includes("registered") ? 409 : 400;
      return jsonResponse({ error: status === 409 ? "Такой логин уже занят." : "Не удалось создать аккаунт ученика." }, status);
    }

    const studentId = created.user.id;
    const { error: membershipError } = await admin.from("classroom_members").insert({
      classroom_id: classroomId,
      student_id: studentId,
      added_by: teacherId
    });
    if (membershipError) {
      await admin.auth.admin.deleteUser(studentId);
      return jsonResponse({ error: "Не удалось добавить ученика в класс." }, 500);
    }

    return jsonResponse({
      created: true,
      student: {
        id: studentId,
        login: validated.login,
        displayName: validated.displayName,
        classroomId
      }
    }, 201);
  } catch (_) {
    return jsonResponse({ error: "Некорректный запрос." }, 400);
  }
});
