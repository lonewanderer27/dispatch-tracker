-- 0024_cleaning_job_assignments: which cleaners are assigned to which job.

create table public.cleaning_job_assignments (
  id              uuid primary key default gen_random_uuid(),
  cleaner_id      uuid not null references public.cleaners (id),
  cleaning_job_id uuid not null references public.cleaning_jobs (id) on delete cascade,
  constraint cleaning_job_assignments_pair_key unique (cleaning_job_id, cleaner_id)
);

create index cleaning_job_assignments_cleaner_id_idx on public.cleaning_job_assignments (cleaner_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.cleaning_job_assignments enable row level security;

revoke all on public.cleaning_job_assignments from anon, authenticated;
grant select, insert, update, delete on public.cleaning_job_assignments to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy cleaning_job_assignments_select
  on public.cleaning_job_assignments for select to authenticated
  using ((select public.has_permission('cleaning_job_assignments', 'read')));

create policy cleaning_job_assignments_insert
  on public.cleaning_job_assignments for insert to authenticated
  with check ((select public.has_permission('cleaning_job_assignments', 'create')));

create policy cleaning_job_assignments_update
  on public.cleaning_job_assignments for update to authenticated
  using ((select public.has_permission('cleaning_job_assignments', 'update')))
  with check ((select public.has_permission('cleaning_job_assignments', 'update')));

create policy cleaning_job_assignments_delete
  on public.cleaning_job_assignments for delete to authenticated
  using ((select public.has_permission('cleaning_job_assignments', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'cleaning_job_assignments', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'cleaning_job_assignments', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'cleaning_job_assignments', true, true,  true,  true);
