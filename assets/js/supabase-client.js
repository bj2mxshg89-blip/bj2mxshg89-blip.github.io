import { createClient } from "./vendor/supabase.js?v=9";
import { backendConfig } from "./backend-config.js?v=9";
import { loginToEmail } from "./auth-utils.js?v=9";

let client = null;
let accountPromise = null;

export function isCloudConfigured() {
  return Boolean(
    backendConfig.enabled &&
    backendConfig.url?.startsWith("https://") &&
    backendConfig.publishableKey?.startsWith("sb_publishable_")
  );
}

export function getSupabaseClient() {
  if (!isCloudConfigured()) return null;
  if (client) return client;

  client = createClient(backendConfig.url, backendConfig.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: backendConfig.authStorageKey
    }
  });
  client.auth.onAuthStateChange(() => {
    accountPromise = null;
  });
  return client;
}

export async function getAccountContext({ refresh = false } = {}) {
  if (refresh) accountPromise = null;
  if (accountPromise) return accountPromise;

  accountPromise = resolveAccountContext().catch((error) => ({
    configured: isCloudConfigured(),
    signedIn: false,
    online: false,
    user: null,
    profile: null,
    error
  }));
  return accountPromise;
}

async function resolveAccountContext() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { configured: false, signedIn: false, online: false, user: null, profile: null, error: null };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const session = sessionData.session;
  if (!session?.user) {
    return { configured: true, signedIn: false, online: true, user: null, profile: null, error: null };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const user = userData.user;
  if (!user) {
    return { configured: true, signedIn: false, online: true, user: null, profile: null, error: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, display_name, login_name, created_at, updated_at")
    .eq("id", user.id)
    .single();
  if (profileError) throw profileError;

  return { configured: true, signedIn: true, online: true, user, profile, error: null };
}

export async function signInWithLogin(login, password) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Облачное хранилище не настроено.");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginToEmail(login),
    password
  });
  if (error) throw error;
  accountPromise = null;
  return data;
}

export async function signOutAccount() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  accountPromise = null;
}

export async function updateAccountPassword(password) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Облачное хранилище не настроено.");
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export function clearAccountCache() {
  accountPromise = null;
}
