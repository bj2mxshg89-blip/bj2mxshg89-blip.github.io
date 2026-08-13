import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import {
  accountEmail,
  corsHeaders,
  jsonResponse,
  serverCredentials,
  validateAccountInput
} from "../_shared/common.ts";

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Метод не поддерживается." }, 405);

  try {
    const input = await request.json();
    const validated = validateAccountInput(input);
    if (validated.error) return jsonResponse({ error: validated.error }, 400);
    const bootstrapCode = typeof input.bootstrapCode === "string" ? input.bootstrapCode.trim() : "";
    if (bootstrapCode.length < 20 || bootstrapCode.length > 100) {
      return jsonResponse({ error: "Одноразовый код неверен." }, 403);
    }

    const { url, secretKey } = serverCredentials();
    if (!url || !secretKey) return jsonResponse({ error: "Сервис аккаунтов не настроен." }, 503);
    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const tokenHash = await sha256(bootstrapCode);
    const { data: token, error: tokenError } = await admin
      .from("bootstrap_tokens")
      .select("id")
      .eq("purpose", "initial_teacher")
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .maybeSingle();
    if (tokenError) return jsonResponse({ error: "Не удалось проверить одноразовый код." }, 500);
    if (!token) return jsonResponse({ error: "Одноразовый код неверен или уже использован." }, 403);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: accountEmail(validated.login),
      password: validated.password,
      email_confirm: true,
      user_metadata: {
        login_name: validated.login,
        display_name: validated.displayName
      },
      app_metadata: { account_type: "teacher" }
    });
    if (createError || !created.user) {
      const status = createError?.message?.toLowerCase().includes("registered") ? 409 : 400;
      return jsonResponse({ error: status === 409 ? "Такой логин уже занят." : "Не удалось создать аккаунт." }, status);
    }

    const userId = created.user.id;
    const now = new Date().toISOString();
    const { data: claimed, error: claimError } = await admin
      .from("bootstrap_tokens")
      .update({ used_at: now, used_by: userId })
      .eq("id", token.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (claimError || !claimed) {
      await admin.auth.admin.deleteUser(userId);
      return jsonResponse({ error: "Одноразовый код уже был использован." }, 409);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({ role: "teacher" })
      .eq("id", userId);
    if (profileError) {
      await admin.from("bootstrap_tokens").update({ used_at: null, used_by: null }).eq("id", token.id).eq("used_by", userId);
      await admin.auth.admin.deleteUser(userId);
      return jsonResponse({ error: "Не удалось назначить роль учителя." }, 500);
    }

    return jsonResponse({
      created: true,
      profile: { id: userId, role: "teacher", displayName: validated.displayName, login: validated.login }
    }, 201);
  } catch (_) {
    return jsonResponse({ error: "Некорректный запрос." }, 400);
  }
});
