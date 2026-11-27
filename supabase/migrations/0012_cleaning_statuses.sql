-- 0012_cleaning_statuses: the life-cycle statuses of a job.

create table public.cleaning_statuses (
  id   uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  constraint cleaning_statuses_name_key unique (name)
);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.cleaning_statuses enable row level security;

revoke all on public.cleaning_statuses from anon, authenticated;
grant select, insert, update, delete on public.cleaning_statuses to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy cleaning_statuses_select
  on public.cleaning_statuses for select to authenticated
  using ((select public.has_permission('cleaning_statuses', 'read')));

create policy cleaning_statuses_insert
  on public.cleaning_statuses for insert to authenticated
  with check ((select public.has_permission('cleaning_statuses', 'create')));

create policy cleaning_statuses_update
  on public.cleaning_statuses for update to authenticated
  using ((select public.has_permission('cleaning_statuses', 'update')))
  with check ((select public.has_permission('cleaning_statuses', 'update')));

create policy cleaning_statuses_delete
  on public.cleaning_statuses for delete to authenticated
  using ((select public.has_permission('cleaning_statuses', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'cleaning_statuses', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'cleaning_statuses', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'cleaning_statuses', true, true,  true,  true);
