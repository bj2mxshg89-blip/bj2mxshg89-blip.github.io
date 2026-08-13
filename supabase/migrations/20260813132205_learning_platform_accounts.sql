-- Cloud accounts and result sync for the learning platform.
-- No student names, classroom names, passwords, or secret API keys are stored in this repository.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student'
    constraint profiles_role_check check (role in ('student', 'teacher')),
  display_name text not null
    constraint profiles_display_name_check check (char_length(btrim(display_name)) between 1 and 80),
  login_name text not null unique
    constraint profiles_login_name_check check (
      login_name = lower(login_name)
      and login_name ~ '^[a-z0-9][a-z0-9._-]{2,31}$'
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.classrooms (
  id bigint generated always as identity primary key,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null
    constraint classrooms_title_check check (char_length(btrim(title)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.classroom_members (
  classroom_id bigint not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid not null references public.profiles(id) on delete restrict,
  joined_at timestamptz not null default now(),
  primary key (classroom_id, student_id),
  constraint classroom_members_distinct_roles_check check (student_id <> added_by)
);

create table public.attempt_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  test_id text not null
    constraint attempt_progress_test_id_check check (test_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  test_version integer not null
    constraint attempt_progress_test_version_check check (test_version > 0),
  payload jsonb not null
    constraint attempt_progress_payload_check check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, test_id)
);

create table public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_id text not null
    constraint attempts_attempt_id_check check (char_length(btrim(attempt_id)) between 1 and 120),
  test_id text not null
    constraint attempts_test_id_check check (test_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  test_version integer not null
    constraint attempts_test_version_check check (test_version > 0),
  variant_id text not null
    constraint attempts_variant_id_check check (char_length(btrim(variant_id)) between 1 and 80),
  mode text not null
    constraint attempts_mode_check check (mode in ('training', 'test')),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  duration_ms bigint not null
    constraint attempts_duration_check check (duration_ms >= 0),
  correct_count integer not null
    constraint attempts_correct_count_check check (correct_count >= 0),
  total_questions integer not null
    constraint attempts_total_questions_check check (total_questions > 0),
  earned_points integer not null
    constraint attempts_earned_points_check check (earned_points >= 0),
  max_points integer not null
    constraint attempts_max_points_check check (max_points > 0),
  percent smallint not null
    constraint attempts_percent_check check (percent between 0 and 100),
  grade smallint not null
    constraint attempts_grade_check check (grade between 2 and 5),
  question_ids text[] not null
    constraint attempts_question_ids_check check (cardinality(question_ids) > 0),
  mistake_question_ids text[] not null default '{}',
  selected_answers jsonb not null
    constraint attempts_selected_answers_check check (jsonb_typeof(selected_answers) = 'object'),
  retry_of text,
  created_at timestamptz not null default now(),
  constraint attempts_completed_after_start_check check (completed_at >= started_at),
  constraint attempts_correct_total_check check (correct_count <= total_questions),
  constraint attempts_points_total_check check (earned_points <= max_points),
  constraint attempts_user_attempt_unique unique (user_id, attempt_id)
);

create table public.bootstrap_tokens (
  id bigint generated always as identity primary key,
  purpose text not null
    constraint bootstrap_tokens_purpose_check check (purpose = 'initial_teacher'),
  token_hash text not null unique
    constraint bootstrap_tokens_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null
);

create index classrooms_teacher_id_idx
  on public.classrooms (teacher_id);

create index classroom_members_student_id_idx
  on public.classroom_members (student_id, classroom_id);

create index attempts_user_completed_idx
  on public.attempts (user_id, completed_at desc);

create index attempts_test_completed_idx
  on public.attempts (test_id, completed_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_login text;
  requested_name text;
begin
  requested_login := lower(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'login_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'user-' || left(new.id::text, 8)
  ));
  requested_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    'Пользователь'
  );

  insert into public.profiles (id, role, display_name, login_name)
  values (new.id, 'student', requested_name, requested_login);

  return new;
end;
$$;

create or replace function private.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = 'teacher'
    );
$$;

create or replace function private.is_classroom_teacher(p_classroom_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.classrooms
      where id = p_classroom_id
        and teacher_id = (select auth.uid())
    )
    and (select private.is_teacher());
$$;

create or replace function private.is_classroom_member(p_classroom_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.classroom_members
      where classroom_id = p_classroom_id
        and student_id = (select auth.uid())
    );
$$;

create or replace function private.can_view_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (select private.is_teacher())
    and exists (
      select 1
      from public.classroom_members as member
      join public.classrooms as classroom
        on classroom.id = member.classroom_id
      where member.student_id = p_student_id
        and classroom.teacher_id = (select auth.uid())
    );
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.is_teacher() from public, anon;
revoke all on function private.is_classroom_teacher(bigint) from public, anon;
revoke all on function private.is_classroom_member(bigint) from public, anon;
revoke all on function private.can_view_student(uuid) from public, anon;

grant execute on function private.is_teacher() to authenticated;
grant execute on function private.is_classroom_teacher(bigint) to authenticated;
grant execute on function private.is_classroom_member(bigint) to authenticated;
grant execute on function private.can_view_student(uuid) to authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger classrooms_set_updated_at
before update on public.classrooms
for each row execute function private.set_updated_at();

create trigger attempt_progress_set_updated_at
before update on public.attempt_progress
for each row execute function private.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.attempt_progress enable row level security;
alter table public.attempts enable row level security;
alter table public.bootstrap_tokens enable row level security;

create policy profiles_select_related
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.can_view_student(id))
);

create policy profiles_update_self
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy classrooms_select_related
on public.classrooms for select
to authenticated
using (
  teacher_id = (select auth.uid())
  or (select private.is_classroom_member(id))
);

create policy classrooms_insert_teacher
on public.classrooms for insert
to authenticated
with check (
  teacher_id = (select auth.uid())
  and (select private.is_teacher())
);

create policy classrooms_update_teacher
on public.classrooms for update
to authenticated
using (
  teacher_id = (select auth.uid())
  and (select private.is_teacher())
)
with check (
  teacher_id = (select auth.uid())
  and (select private.is_teacher())
);

create policy classrooms_delete_teacher
on public.classrooms for delete
to authenticated
using (
  teacher_id = (select auth.uid())
  and (select private.is_teacher())
);

create policy classroom_members_select_related
on public.classroom_members for select
to authenticated
using (
  student_id = (select auth.uid())
  or (select private.is_classroom_teacher(classroom_id))
);

create policy attempt_progress_select_self
on public.attempt_progress for select
to authenticated
using (user_id = (select auth.uid()));

create policy attempt_progress_insert_self
on public.attempt_progress for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy attempt_progress_update_self
on public.attempt_progress for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy attempt_progress_delete_self
on public.attempt_progress for delete
to authenticated
using (user_id = (select auth.uid()));

create policy attempts_select_related
on public.attempts for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.can_view_student(user_id))
);

create policy attempts_insert_self
on public.attempts for insert
to authenticated
with check (user_id = (select auth.uid()));

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.classrooms from anon, authenticated;
revoke all on table public.classroom_members from anon, authenticated;
revoke all on table public.attempt_progress from anon, authenticated;
revoke all on table public.attempts from anon, authenticated;
revoke all on table public.bootstrap_tokens from anon, authenticated;

grant select, update on table public.bootstrap_tokens to service_role;
grant select, update on table public.profiles to service_role;
grant select on table public.classrooms to service_role;
grant insert on table public.classroom_members to service_role;

grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

grant select, insert, delete on table public.classrooms to authenticated;
grant update (title) on table public.classrooms to authenticated;

grant select on table public.classroom_members to authenticated;

grant select, insert, update, delete on table public.attempt_progress to authenticated;

grant select, insert on table public.attempts to authenticated;

grant usage, select on sequence public.classrooms_id_seq to authenticated;
grant usage, select on sequence public.attempts_id_seq to authenticated;

insert into public.bootstrap_tokens (purpose, token_hash)
values ('initial_teacher', '17dc2231fd4b29ade49664c207d7367aad9f167bf9d8a77ed4d3339e1b393fad');

comment on table public.profiles is
  'Minimal account profiles. Names and logins are stored only in Supabase, never in the public test bank.';
comment on table public.attempts is
  'Immutable completed attempts. Students see their own rows; teachers see rows for members of their classrooms.';
comment on table public.attempt_progress is
  'One resumable in-progress attempt per user and test.';
comment on table public.bootstrap_tokens is
  'One-time hashed bootstrap credentials. This table has no browser role grants.';
