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
const assignmentsMigration = readFileSync(new URL(
  "../../supabase/migrations/20260813193000_class_assignments.sql",
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

test("назначения связаны с классом и доступны только связанным ролям", () => {
  assert.match(assignmentsMigration, /create table public\.assignments \(/);
  assert.match(assignmentsMigration, /classroom_id bigint not null references public\.classrooms\(id\) on delete cascade/);
  assert.match(assignmentsMigration, /alter table public\.assignments enable row level security/);
  assert.match(assignmentsMigration, /assignments_select_related[\s\S]+is_classroom_teacher\(classroom_id\)[\s\S]+is_classroom_member\(classroom_id\)/);
  assert.match(assignmentsMigration, /assignments_insert_teacher[\s\S]+is_classroom_teacher\(classroom_id\)/);
  assert.doesNotMatch(assignmentsMigration, /grant\s+[^;]+\s+to\s+anon\s*;/i);
  assert.doesNotMatch(assignmentsMigration, /grant\s+(?:[^;]*,\s*)?(?:update|delete)[^;]*on table public\.assignments to authenticated/i);
});

test("сервер связывает результат с параметрами выданной работы", () => {
  assert.match(assignmentsMigration, /create or replace function private\.can_submit_assignment/);
  for (const field of ["test_id", "test_version", "variant_id", "mode"]) {
    assert.match(assignmentsMigration, new RegExp(`assignment\\.${field} = p_${field}`));
  }
  assert.match(assignmentsMigration, /join public\.classroom_members[\s\S]+member\.student_id = p_user_id/);
  assert.match(assignmentsMigration, /attempts_insert_self[\s\S]+can_submit_assignment/);
});

test("личный и назначенный прогресс разделены составным ключом", () => {
  assert.match(assignmentsMigration, /add column scope_key text not null default 'personal'/);
  assert.match(assignmentsMigration, /primary key \(user_id, test_id, scope_key\)/);
  assert.match(assignmentsMigration, /scope_key = 'assignment-' \|\| assignment_id::text/);
  assert.match(assignmentsMigration, /attempt_progress_insert_self[\s\S]+payload ->> 'variantId'[\s\S]+payload ->> 'mode'/);
});

test("внешние ключи назначений индексированы", () => {
  assert.match(assignmentsMigration, /on public\.assignments \(classroom_id, due_at, created_at desc\)/);
  assert.match(assignmentsMigration, /on public\.attempt_progress \(assignment_id, user_id\)/);
  assert.match(assignmentsMigration, /on public\.attempts \(assignment_id, user_id, completed_at desc\)/);
});
