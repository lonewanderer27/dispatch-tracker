-- 0011_cleaning_types: the kinds of clean a job can be booked as.

create table public.cleaning_types (
  id   uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  constraint cleaning_types_name_key unique (name)
);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.cleaning_types enable row level security;

revoke all on public.cleaning_types from anon, authenticated;
grant select, insert, update, delete on public.cleaning_types to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy cleaning_types_select
  on public.cleaning_types for select to authenticated
  using ((select public.has_permission('cleaning_types', 'read')));

create policy cleaning_types_insert
  on public.cleaning_types for insert to authenticated
  with check ((select public.has_permission('cleaning_types', 'create')));

create policy cleaning_types_update
  on public.cleaning_types for update to authenticated
  using ((select public.has_permission('cleaning_types', 'update')))
  with check ((select public.has_permission('cleaning_types', 'update')));

create policy cleaning_types_delete
  on public.cleaning_types for delete to authenticated
  using ((select public.has_permission('cleaning_types', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'cleaning_types', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'cleaning_types', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'cleaning_types', true, true,  true,  true);
