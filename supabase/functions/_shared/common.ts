export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
  });
}

export function normalizeLogin(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeDisplayName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function validateAccountInput(input: Record<string, unknown>) {
  const login = normalizeLogin(input.login);
  const displayName = normalizeDisplayName(input.displayName);
  const password = typeof input.password === "string" ? input.password : "";
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(login)) {
    return { error: "Логин должен содержать 3–32 допустимых символа." };
  }
  if (displayName.length < 1 || displayName.length > 80) {
    return { error: "Имя должно содержать 1–80 символов." };
  }
  if (password.length < 10 || password.length > 72) {
    return { error: "Пароль должен содержать 10–72 символа." };
  }
  return { login, displayName, password };
}

export function accountEmail(login: string) {
  return `${login}@accounts.chem-cabinet.invalid`;
}

export function serverCredentials() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const secretKey = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const publicKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  return { url, secretKey, publicKey };
}
