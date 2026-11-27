-- 0004_app_permissions: role-based access.
-- Adds the Super Admin role and a permission matrix (role x table x read/create/update/delete).
-- The policies of roles and app_permissions read the matrix through has_permission().

insert into public.roles (id, name) values
  ('30000000-0000-0000-0000-000000000003', 'Super Admin');

create table public.app_permissions (
  role_id  uuid    not null references public.roles (id) on delete cascade,
  resource text    not null check (char_length(trim(resource)) > 0),
  "read"   boolean not null default false,
  "create" boolean not null default false,
  "update" boolean not null default false,
  "delete" boolean not null default false,
  primary key (role_id, resource)
);

-- Seed: today's access. Admin 000...001, User 000...002, Super Admin 000...003.
-- profiles and todos rows describe current behaviour (their policies are unchanged).
-- roles: only Super Admin writes (Phase 1 let Admin write it; this migration removes that).
-- Every later table migration inserts its own rows.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'roles',           true, false, false, false),
  ('30000000-0000-0000-0000-000000000001', 'profiles',        true, false, true,  false),
  ('30000000-0000-0000-0000-000000000001', 'todos',           true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000001', 'app_permissions', true, false, false, false),
  ('30000000-0000-0000-0000-000000000002', 'roles',           true, false, false, false),
  ('30000000-0000-0000-0000-000000000002', 'profiles',        true, false, true,  false),
  ('30000000-0000-0000-0000-000000000002', 'todos',           true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'app_permissions', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'roles',           true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000003', 'profiles',        true, false, true,  false),
  ('30000000-0000-0000-0000-000000000003', 'todos',           true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000003', 'app_permissions', true, true,  true,  true);

-- Same signature as before. Super Admin is an Admin for every policy that calls is_admin().
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role_id in (
        '30000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000003'
      )
  );
$$;

-- Does the signed-in user's role allow this action on this table? Deny by default.
create function public.has_permission(p_resource text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(bool_or(
    case p_action
      when 'read'   then ap."read"
      when 'create' then ap."create"
      when 'update' then ap."update"
      when 'delete' then ap."delete"
      else false
    end
  ), false)
  from public.profiles p
  join public.app_permissions ap on ap.role_id = p.role_id
  where p.id = (select auth.uid())
    and ap.resource = p_resource;
$$;

revoke all on function public.has_permission(text, text) from public, anon;
grant execute on function public.has_permission(text, text) to authenticated;

-- roles: replace the two Phase 1 policies with one policy per action (only Super Admin writes).
drop policy roles_select_authenticated on public.roles;
drop policy roles_admin_all on public.roles;

create policy roles_select
  on public.roles for select to authenticated
  using ((select public.has_permission('roles', 'read')));

create policy roles_insert
  on public.roles for insert to authenticated
  with check ((select public.has_permission('roles', 'create')));

create policy roles_update
  on public.roles for update to authenticated
  using ((select public.has_permission('roles', 'update')))
  with check ((select public.has_permission('roles', 'update')));

create policy roles_delete
  on public.roles for delete to authenticated
  using ((select public.has_permission('roles', 'delete')));

-- app_permissions: RLS on, deny by default. Everyone signed in can read; only Super Admin can write.
alter table public.app_permissions enable row level security;

revoke all on public.app_permissions from anon, authenticated;
grant select, insert, update, delete on public.app_permissions to authenticated;

create policy app_permissions_select
  on public.app_permissions for select to authenticated
  using ((select public.has_permission('app_permissions', 'read')));

create policy app_permissions_insert
  on public.app_permissions for insert to authenticated
  with check ((select public.has_permission('app_permissions', 'create')));

create policy app_permissions_update
  on public.app_permissions for update to authenticated
  using ((select public.has_permission('app_permissions', 'update')))
  with check ((select public.has_permission('app_permissions', 'update')));

create policy app_permissions_delete
  on public.app_permissions for delete to authenticated
  using ((select public.has_permission('app_permissions', 'delete')));
