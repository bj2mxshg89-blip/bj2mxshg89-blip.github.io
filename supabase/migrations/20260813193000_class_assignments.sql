-- Class assignments with scoped progress and immutable linked attempts.
-- Test definitions remain public JSON; only assignment metadata and results are stored here.

create table public.assignments (
  id bigint generated always as identity primary key,
  classroom_id bigint not null references public.classrooms(id) on delete cascade,
  test_id text not null
    constraint assignments_test_id_check check (test_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  test_version integer not null
    constraint assignments_test_version_check check (test_version > 0),
  variant_id text not null
    constraint assignments_variant_id_check check (char_length(btrim(variant_id)) between 1 and 80),
  mode text not null
    constraint assignments_mode_check check (mode in ('training', 'test')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  constraint assignments_due_after_creation_check check (due_at is null or due_at > created_at)
);

create index assignments_classroom_due_idx
  on public.assignments (classroom_id, due_at, created_at desc);

alter table public.attempt_progress
  add column scope_key text not null default 'personal',
  add column assignment_id bigint references public.assignments(id) on delete cascade;

alter table public.attempt_progress
  drop constraint attempt_progress_pkey,
  add constraint attempt_progress_pkey primary key (user_id, test_id, scope_key),
  add constraint attempt_progress_scope_key_check check (
    (assignment_id is null and scope_key = 'personal')
    or (
      assignment_id is not null
      and scope_key = 'assignment-' || assignment_id::text
    )
  );

create index attempt_progress_assignment_idx
  on public.attempt_progress (assignment_id, user_id)
  where assignment_id is not null;

alter table public.attempts
  add column assignment_id bigint references public.assignments(id) on delete restrict;

create index attempts_assignment_user_completed_idx
  on public.attempts (assignment_id, user_id, completed_at desc)
  where assignment_id is not null;

create or replace function private.can_submit_assignment(
  p_assignment_id bigint,
  p_user_id uuid,
  p_test_id text,
  p_test_version integer,
  p_variant_id text,
  p_mode text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) = p_user_id
    and (
      p_assignment_id is null
      or exists (
        select 1
        from public.assignments as assignment
        join public.classroom_members as member
          on member.classroom_id = assignment.classroom_id
         and member.student_id = p_user_id
        where assignment.id = p_assignment_id
          and assignment.test_id = p_test_id
          and assignment.test_version = p_test_version
          and assignment.variant_id = p_variant_id
          and assignment.mode = p_mode
      )
    );
$$;

revoke all on function private.can_submit_assignment(bigint, uuid, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function private.can_submit_assignment(bigint, uuid, text, integer, text, text)
  to authenticated;

alter table public.assignments enable row level security;

create policy assignments_select_related
on public.assignments for select
to authenticated
using (
  (select private.is_classroom_teacher(classroom_id))
  or (select private.is_classroom_member(classroom_id))
);

create policy assignments_insert_teacher
on public.assignments for insert
to authenticated
with check ((select private.is_classroom_teacher(classroom_id)));

drop policy attempt_progress_insert_self on public.attempt_progress;
drop policy attempt_progress_update_self on public.attempt_progress;
drop policy attempts_insert_self on public.attempts;

create policy attempt_progress_insert_self
on public.attempt_progress for insert
to authenticated
with check (
  (select private.can_submit_assignment(
    assignment_id,
    user_id,
    test_id,
    test_version,
    payload ->> 'variantId',
    payload ->> 'mode'
  ))
);

create policy attempt_progress_update_self
on public.attempt_progress for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  (select private.can_submit_assignment(
    assignment_id,
    user_id,
    test_id,
    test_version,
    payload ->> 'variantId',
    payload ->> 'mode'
  ))
);

create policy attempts_insert_self
on public.attempts for insert
to authenticated
with check (
  (select private.can_submit_assignment(
    assignment_id,
    user_id,
    test_id,
    test_version,
    variant_id,
    mode
  ))
);

revoke all on table public.assignments from anon, authenticated;
grant select, insert on table public.assignments to authenticated;
grant usage, select on sequence public.assignments_id_seq to authenticated;

comment on table public.assignments is
  'Teacher-created test assignments. Students can read rows only for classrooms they belong to.';
comment on column public.attempt_progress.scope_key is
  'Stable client scope: personal or assignment-<id>. It keeps personal and assigned progress separate.';
comment on column public.attempts.assignment_id is
  'Optional immutable link to the class assignment that produced the completed attempt.';
