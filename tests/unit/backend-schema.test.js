import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL(
  "../../supabase/migrations/20260813132205_learning_platform_accounts.sql",
  import.meta.url
), "utf8");
const hardeningMigration = readFileSync(new URL(
  "../../supabase/migrations/20260813143000_harden_learning_platform_accounts.sql",
  import.meta.url
), "utf8");

const expectedTables = [
  "profiles",
  "classrooms",
  "classroom_members",
  "attempt_progress",
  "attempts",
  "bootstrap_tokens"
];

test("облачная схема создаёт все таблицы и включает RLS", () => {
  expectedTables.forEach((table) => {
    assert.match(migration, new RegExp(`create table public\\.${table} \\(`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
  });
});

test("анонимная роль не получает доступ к пользовательским таблицам", () => {
  assert.doesNotMatch(migration, /grant\s+[^;]+\s+to\s+anon\s*;/i);
  expectedTables.forEach((table) => {
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated;`));
  });
});

test("служебный bootstrap закрыт явной deny-политикой, а внешние ключи индексированы", () => {
  assert.match(hardeningMigration, /on public\.bootstrap_tokens[\s\S]+to anon, authenticated[\s\S]+using \(false\)[\s\S]+with check \(false\)/);
  assert.match(hardeningMigration, /on public\.bootstrap_tokens \(used_by\)/);
  assert.match(hardeningMigration, /on public\.classroom_members \(added_by\)/);
});

test("ученик пишет только собственный прогресс и результат", () => {
  assert.match(migration, /attempt_progress_insert_self[\s\S]+user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /attempts_insert_self[\s\S]+user_id = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /grant\s+(?:[^;]*,\s*)?update[^;]*on table public\.attempts to authenticated/i);
  assert.doesNotMatch(migration, /grant\s+(?:[^;]*,\s*)?delete[^;]*on table public\.attempts to authenticated/i);
});

test("роль берётся из защищённого профиля, а не user_metadata JWT", () => {
  assert.match(migration, /from public\.profiles[\s\S]+role = 'teacher'/);
  assert.doesNotMatch(migration, /auth\.jwt\(\)[\s\S]*user_metadata/i);
});

test("репозиторий не содержит service-role или secret key", () => {
  assert.doesNotMatch(migration, /sb_secret_[a-z0-9_-]+/i);
  assert.doesNotMatch(migration, /service_role_key\s*=\s*['"][^'"]+/i);
  assert.match(migration, /token_hash ~ '\^\[0-9a-f\]\{64\}\$'/);
});
