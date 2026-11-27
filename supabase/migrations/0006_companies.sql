-- 0006_companies: the companies (brands) we operate under. Shared reference data.

create table public.companies (
  id   uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 200),
  constraint companies_name_key unique (name)
);

-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.companies enable row level security;

revoke all on public.companies from anon, authenticated;
grant select, insert, update, delete on public.companies to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy companies_select
  on public.companies for select to authenticated
  using ((select public.has_permission('companies', 'read')));

create policy companies_insert
  on public.companies for insert to authenticated
  with check ((select public.has_permission('companies', 'create')));

create policy companies_update
  on public.companies for update to authenticated
  using ((select public.has_permission('companies', 'update')))
  with check ((select public.has_permission('companies', 'update')));

create policy companies_delete
  on public.companies for delete to authenticated
  using ((select public.has_permission('companies', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'companies', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'companies', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'companies', true, true,  true,  true);
