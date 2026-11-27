-- 0009_cleaners: cleaners (people who attend jobs).

create table public.cleaners (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null check (char_length(trim(first_name)) > 0),
  middle_name text,
  last_name   text not null check (char_length(trim(last_name)) > 0)
);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.cleaners enable row level security;

revoke all on public.cleaners from anon, authenticated;
grant select, insert, update, delete on public.cleaners to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy cleaners_select
  on public.cleaners for select to authenticated
  using ((select public.has_permission('cleaners', 'read')));

create policy cleaners_insert
  on public.cleaners for insert to authenticated
  with check ((select public.has_permission('cleaners', 'create')));

create policy cleaners_update
  on public.cleaners for update to authenticated
  using ((select public.has_permission('cleaners', 'update')))
  with check ((select public.has_permission('cleaners', 'update')));

create policy cleaners_delete
  on public.cleaners for delete to authenticated
  using ((select public.has_permission('cleaners', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'cleaners', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'cleaners', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'cleaners', true, true,  true,  true);
