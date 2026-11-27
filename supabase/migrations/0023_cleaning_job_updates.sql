-- 0023_cleaning_job_updates: progress notes logged against a job.

create table public.cleaning_job_updates (
  id              uuid primary key default gen_random_uuid(),
  cleaning_job_id uuid not null references public.cleaning_jobs (id) on delete cascade,
  description     text not null check (char_length(trim(description)) > 0),
  created_at      timestamptz not null default now()
);

create index cleaning_job_updates_cleaning_job_id_idx on public.cleaning_job_updates (cleaning_job_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.cleaning_job_updates enable row level security;

revoke all on public.cleaning_job_updates from anon, authenticated;
grant select, insert, update, delete on public.cleaning_job_updates to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy cleaning_job_updates_select
  on public.cleaning_job_updates for select to authenticated
  using ((select public.has_permission('cleaning_job_updates', 'read')));

create policy cleaning_job_updates_insert
  on public.cleaning_job_updates for insert to authenticated
  with check ((select public.has_permission('cleaning_job_updates', 'create')));

create policy cleaning_job_updates_update
  on public.cleaning_job_updates for update to authenticated
  using ((select public.has_permission('cleaning_job_updates', 'update')))
  with check ((select public.has_permission('cleaning_job_updates', 'update')));

create policy cleaning_job_updates_delete
  on public.cleaning_job_updates for delete to authenticated
  using ((select public.has_permission('cleaning_job_updates', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'cleaning_job_updates', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'cleaning_job_updates', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'cleaning_job_updates', true, true,  true,  true);
