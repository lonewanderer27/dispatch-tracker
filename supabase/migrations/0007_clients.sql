-- 0007_clients: clients, each booked against one company.

create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name       text not null check (char_length(trim(name)) > 0)
);

create index clients_company_id_idx on public.clients (company_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.clients enable row level security;

revoke all on public.clients from anon, authenticated;
grant select, insert, update, delete on public.clients to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy clients_select
  on public.clients for select to authenticated
  using ((select public.has_permission('clients', 'read')));

create policy clients_insert
  on public.clients for insert to authenticated
  with check ((select public.has_permission('clients', 'create')));

create policy clients_update
  on public.clients for update to authenticated
  using ((select public.has_permission('clients', 'update')))
  with check ((select public.has_permission('clients', 'update')));

create policy clients_delete
  on public.clients for delete to authenticated
  using ((select public.has_permission('clients', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'clients', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'clients', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'clients', true, true,  true,  true);
