-- 0003_roles: a roles table, and profiles.role (text) becomes profiles.role_id (foreign key).

create table public.roles (
  id   uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  constraint roles_name_key unique (name)
);

-- Fixed ids: is_admin(), the profiles default and the tests rely on them.
insert into public.roles (id, name) values
  ('30000000-0000-0000-0000-000000000001', 'Admin'),
  ('30000000-0000-0000-0000-000000000002', 'User');

-- profiles: add role_id, link every existing row, then drop the old text column.
alter table public.profiles
  add column role_id uuid references public.roles (id);

update public.profiles
set role_id = case role
  when 'admin' then '30000000-0000-0000-0000-000000000001'::uuid
  else '30000000-0000-0000-0000-000000000002'::uuid
end;

alter table public.profiles
  alter column role_id set default '30000000-0000-0000-0000-000000000002',
  alter column role_id set not null;

alter table public.profiles drop column role;

create index profiles_role_id_idx on public.profiles (role_id);

-- Same signature as before, so the grants and every policy that calls it keep working.
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
      and p.role_id = '30000000-0000-0000-0000-000000000001'
  );
$$;

-- roles: RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.roles enable row level security;

revoke all on public.roles from anon, authenticated;
grant select, insert, update, delete on public.roles to authenticated;

-- Everyone signed in can read.
create policy roles_select_authenticated
  on public.roles for select to authenticated
  using (true);

-- Only admins can change.
create policy roles_admin_all
  on public.roles for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
