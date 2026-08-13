create index bootstrap_tokens_used_by_idx
  on public.bootstrap_tokens (used_by)
  where used_by is not null;

create index classroom_members_added_by_idx
  on public.classroom_members (added_by);

create policy "bootstrap tokens remain server only"
  on public.bootstrap_tokens
  for all
  to anon, authenticated
  using (false)
  with check (false);
