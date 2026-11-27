-- 0018_property_types: the kinds of property a client can have.

create table public.property_types (
  id   uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  constraint property_types_name_key unique (name)
);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.property_types enable row level security;

revoke all on public.property_types from anon, authenticated;
grant select, insert, update, delete on public.property_types to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy property_types_select
  on public.property_types for select to authenticated
  using ((select public.has_permission('property_types', 'read')));

create policy property_types_insert
  on public.property_types for insert to authenticated
  with check ((select public.has_permission('property_types', 'create')));

create policy property_types_update
  on public.property_types for update to authenticated
  using ((select public.has_permission('property_types', 'update')))
  with check ((select public.has_permission('property_types', 'update')));

create policy property_types_delete
  on public.property_types for delete to authenticated
  using ((select public.has_permission('property_types', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'property_types', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'property_types', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'property_types', true, true,  true,  true);
