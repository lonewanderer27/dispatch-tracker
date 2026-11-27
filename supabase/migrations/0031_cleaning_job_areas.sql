-- 0031_cleaning_job_areas: the areas included in a job, with a priority flag.

create table public.cleaning_job_areas (
  id              uuid primary key default gen_random_uuid(),
  area_id         uuid not null references public.areas (id),
  cleaning_job_id uuid not null references public.cleaning_jobs (id) on delete cascade,
  priority        boolean not null default false,
  description     text,
  constraint cleaning_job_areas_pair_key unique (cleaning_job_id, area_id)
);

create index cleaning_job_areas_area_id_idx on public.cleaning_job_areas (area_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.cleaning_job_areas enable row level security;

revoke all on public.cleaning_job_areas from anon, authenticated;
grant select, insert, update, delete on public.cleaning_job_areas to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy cleaning_job_areas_select
  on public.cleaning_job_areas for select to authenticated
  using ((select public.has_permission('cleaning_job_areas', 'read')));

create policy cleaning_job_areas_insert
  on public.cleaning_job_areas for insert to authenticated
  with check ((select public.has_permission('cleaning_job_areas', 'create')));

create policy cleaning_job_areas_update
  on public.cleaning_job_areas for update to authenticated
  using ((select public.has_permission('cleaning_job_areas', 'update')))
  with check ((select public.has_permission('cleaning_job_areas', 'update')));

create policy cleaning_job_areas_delete
  on public.cleaning_job_areas for delete to authenticated
  using ((select public.has_permission('cleaning_job_areas', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'cleaning_job_areas', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'cleaning_job_areas', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'cleaning_job_areas', true, true,  true,  true);
