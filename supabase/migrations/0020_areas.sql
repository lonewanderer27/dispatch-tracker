-- 0020_areas: lookup list of areas.

create table public.areas (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) > 0),
  description text,
  constraint areas_name_key unique (name)
);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.areas enable row level security;

revoke all on public.areas from anon, authenticated;
grant select, insert, update, delete on public.areas to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy areas_select
  on public.areas for select to authenticated
  using ((select public.has_permission('areas', 'read')));

create policy areas_insert
  on public.areas for insert to authenticated
  with check ((select public.has_permission('areas', 'create')));

create policy areas_update
  on public.areas for update to authenticated
  using ((select public.has_permission('areas', 'update')))
  with check ((select public.has_permission('areas', 'update')));

create policy areas_delete
  on public.areas for delete to authenticated
  using ((select public.has_permission('areas', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'areas', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'areas', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'areas', true, true,  true,  true);
