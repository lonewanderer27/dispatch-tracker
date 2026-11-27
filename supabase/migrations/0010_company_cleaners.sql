-- 0010_company_cleaners: which companies each cleaner works for.

create table public.company_cleaners (
  id         uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references public.cleaners (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  constraint company_cleaners_pair_key unique (cleaner_id, company_id)
);

create index company_cleaners_company_id_idx on public.company_cleaners (company_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.company_cleaners enable row level security;

revoke all on public.company_cleaners from anon, authenticated;
grant select, insert, update, delete on public.company_cleaners to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy company_cleaners_select
  on public.company_cleaners for select to authenticated
  using ((select public.has_permission('company_cleaners', 'read')));

create policy company_cleaners_insert
  on public.company_cleaners for insert to authenticated
  with check ((select public.has_permission('company_cleaners', 'create')));

create policy company_cleaners_update
  on public.company_cleaners for update to authenticated
  using ((select public.has_permission('company_cleaners', 'update')))
  with check ((select public.has_permission('company_cleaners', 'update')));

create policy company_cleaners_delete
  on public.company_cleaners for delete to authenticated
  using ((select public.has_permission('company_cleaners', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'company_cleaners', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'company_cleaners', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'company_cleaners', true, true,  true,  true);
