-- Reproducible textbook registry schema and security hardening.
-- The browser receives only the minimum privileges required by textbooks.html.

create table if not exists public.book_registry_students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  last_name text not null
    constraint book_registry_students_last_name_check
      check (char_length(btrim(last_name)) > 0),
  first_name text not null
    constraint book_registry_students_first_name_check
      check (char_length(btrim(first_name)) > 0)
);

create table if not exists public.book_registry_textbooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  title text not null
    constraint book_registry_textbooks_title_check
      check (char_length(btrim(title)) > 0),
  quantity integer not null default 0
    constraint book_registry_textbooks_quantity_check
      check (quantity >= 0)
);

create table if not exists public.book_registry_loans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  student_id uuid not null
    references public.book_registry_students(id) on delete cascade,
  textbook_id uuid not null
    references public.book_registry_textbooks(id) on delete cascade,
  constraint book_registry_loans_student_textbook_unique
    unique (student_id, textbook_id)
);

create index if not exists book_registry_students_owner_idx
  on public.book_registry_students (owner_id);
create index if not exists book_registry_textbooks_owner_idx
  on public.book_registry_textbooks (owner_id);
create index if not exists book_registry_loans_owner_idx
  on public.book_registry_loans (owner_id);
create index if not exists book_registry_loans_student_idx
  on public.book_registry_loans (student_id);
create index if not exists book_registry_loans_textbook_idx
  on public.book_registry_loans (textbook_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'book_registry_students_last_name_length_check'
      and conrelid = 'public.book_registry_students'::regclass
  ) then
    alter table public.book_registry_students
      add constraint book_registry_students_last_name_length_check
      check (char_length(btrim(last_name)) <= 80) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'book_registry_students_first_name_length_check'
      and conrelid = 'public.book_registry_students'::regclass
  ) then
    alter table public.book_registry_students
      add constraint book_registry_students_first_name_length_check
      check (char_length(btrim(first_name)) <= 80) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'book_registry_textbooks_title_length_check'
      and conrelid = 'public.book_registry_textbooks'::regclass
  ) then
    alter table public.book_registry_textbooks
      add constraint book_registry_textbooks_title_length_check
      check (char_length(btrim(title)) <= 160) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'book_registry_textbooks_quantity_max_check'
      and conrelid = 'public.book_registry_textbooks'::regclass
  ) then
    alter table public.book_registry_textbooks
      add constraint book_registry_textbooks_quantity_max_check
      check (quantity <= 10000) not valid;
  end if;
end;
$$;

alter table public.book_registry_students
  validate constraint book_registry_students_last_name_length_check;
alter table public.book_registry_students
  validate constraint book_registry_students_first_name_length_check;
alter table public.book_registry_textbooks
  validate constraint book_registry_textbooks_title_length_check;
alter table public.book_registry_textbooks
  validate constraint book_registry_textbooks_quantity_max_check;

alter table public.book_registry_students enable row level security;
alter table public.book_registry_textbooks enable row level security;
alter table public.book_registry_loans enable row level security;

drop policy if exists book_registry_students_select_own on public.book_registry_students;
drop policy if exists book_registry_students_insert_own on public.book_registry_students;
drop policy if exists book_registry_students_update_own on public.book_registry_students;
drop policy if exists book_registry_students_delete_own on public.book_registry_students;

create policy book_registry_students_select_own
on public.book_registry_students for select
to authenticated
using (
  (select private.is_teacher())
  and owner_id = (select auth.uid())
);

create policy book_registry_students_insert_own
on public.book_registry_students for insert
to authenticated
with check (
  (select private.is_teacher())
  and owner_id = (select auth.uid())
);

create policy book_registry_students_update_own
on public.book_registry_students for update
to authenticated
using (
  (select private.is_teacher())
  and owner_id = (select auth.uid())
)
with check (
  (select private.is_teacher())
  and owner_id = (select auth.uid())
);

create policy book_registry_students_delete_own
on public.book_registry_students for delete
to authenticated
using (
  (select private.is_teacher())
  and owner_id = (select auth.uid())
);

drop policy if exists book_registry_textbooks_select_own on public.book_registry_textbooks;
drop policy if exists book_registry_textbooks_insert_own on public.book_registry_textbooks;
drop policy if exists book_registry_textbooks_update_own on public.book_registry_textbooks;
drop policy if exists book_registry_textbooks_delete_own on public.book_registry_textbooks;

create policy book_registry_textbooks_select_own
on public.book_registry_textbooks for select
to authenticated
using (
  (select private.is_teacher())
  and owner_id = (select auth.uid())
);

create policy book_registry_textbooks_insert_own
on public.book_registry_textbooks for insert
to authenticated
with check (
  (select private.is_teacher())
  and owner_id = (select auth.uid())
);

create policy book_registry_textbooks_update_own
on public.book_registry_textbooks for update
to authenticated
using (
  (select private.is_teacher())
  and owner_id = (select auth.uid())
)
with check (
  (select private.is_teacher())
  and owner_id = (select auth.uid())
);

create policy book_registry_textbooks_delete_own
on public.book_registry_textbooks for delete
to authenticated
using (
  (select private.is_teacher())
  and owner_id = (select auth.uid())
);

drop policy if exists book_registry_loans_select_own on public.book_registry_loans;
drop policy if exists book_registry_loans_insert_own on public.book_registry_loans;
drop policy if exists book_registry_loans_delete_own on public.book_registry_loans;

create policy book_registry_loans_select_own
on public.book_registry_loans for select
to authenticated
using (
  (select private.is_teacher())
  and owner_id = (select auth.uid())
);

create policy book_registry_loans_insert_own
on public.book_registry_loans for insert
to authenticated
with check (
  (select private.is_teacher())
  and owner_id = (select auth.uid())
  and exists (
    select 1 from public.book_registry_students as student
    where student.id = student_id
      and student.owner_id = (select auth.uid())
  )
  and exists (
    select 1 from public.book_registry_textbooks as textbook
    where textbook.id = textbook_id
      and textbook.owner_id = (select auth.uid())
  )
);

create policy book_registry_loans_delete_own
on public.book_registry_loans for delete
to authenticated
using (
  (select private.is_teacher())
  and owner_id = (select auth.uid())
);

create or replace function private.enforce_book_registry_loan_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  available_quantity integer;
  issued_quantity integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.textbook_id::text, 0)
  );

  select textbook.quantity
    into available_quantity
  from public.book_registry_textbooks as textbook
  where textbook.id = new.textbook_id
    and textbook.owner_id = new.owner_id
  for update;

  if available_quantity is null then
    raise exception using
      errcode = '23514',
      message = 'Учебник не принадлежит текущему реестру.';
  end if;

  select count(*)::integer
    into issued_quantity
  from public.book_registry_loans as loan
  where loan.textbook_id = new.textbook_id
    and loan.owner_id = new.owner_id;

  if issued_quantity >= available_quantity then
    raise exception using
      errcode = '23514',
      message = 'Количество выданных экземпляров превышает доступный остаток.';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_book_registry_textbook_quantity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  issued_quantity integer;
begin
  select count(*)::integer
    into issued_quantity
  from public.book_registry_loans as loan
  where loan.textbook_id = new.id
    and loan.owner_id = new.owner_id;

  if new.quantity < issued_quantity then
    raise exception using
      errcode = '23514',
      message = 'Количество экземпляров не может быть меньше числа выданных.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_book_registry_loan_capacity()
  from public, anon, authenticated;
revoke all on function private.enforce_book_registry_textbook_quantity()
  from public, anon, authenticated;

drop trigger if exists book_registry_loans_capacity_check
  on public.book_registry_loans;
create trigger book_registry_loans_capacity_check
before insert on public.book_registry_loans
for each row execute function private.enforce_book_registry_loan_capacity();

drop trigger if exists book_registry_textbooks_quantity_check
  on public.book_registry_textbooks;
create trigger book_registry_textbooks_quantity_check
before update of quantity on public.book_registry_textbooks
for each row execute function private.enforce_book_registry_textbook_quantity();

revoke all on table public.book_registry_students from public, anon, authenticated;
revoke all on table public.book_registry_textbooks from public, anon, authenticated;
revoke all on table public.book_registry_loans from public, anon, authenticated;

grant select, insert, delete on table public.book_registry_students to authenticated;
grant update (last_name, first_name) on table public.book_registry_students to authenticated;

grant select, insert, delete on table public.book_registry_textbooks to authenticated;
grant update (title, quantity) on table public.book_registry_textbooks to authenticated;

grant select, insert, delete on table public.book_registry_loans to authenticated;

grant all on table public.book_registry_students to service_role;
grant all on table public.book_registry_textbooks to service_role;
grant all on table public.book_registry_loans to service_role;

comment on table public.book_registry_students is
  'Teacher-owned textbook registry. Stores only a student first name and last name.';
comment on table public.book_registry_textbooks is
  'Teacher-owned textbook titles and available quantities.';
comment on table public.book_registry_loans is
  'Current textbook assignments without issue/return history.';
