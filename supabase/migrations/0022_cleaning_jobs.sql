-- 0022_cleaning_jobs: booked cleans: when, for whom, how long and at what rate.

create table public.cleaning_jobs (
  id                 uuid primary key default gen_random_uuid(),
  schedule           timestamptz not null,
  client_id          uuid not null references public.clients (id),
  property_id        uuid not null references public.properties (id),
  cleaning_status_id uuid not null
    default '10000000-0000-0000-0000-000000000001'  -- Booked (fixed id seeded by T3C-S14)
    references public.cleaning_statuses (id),
  est_hours          integer not null check (est_hours > 0),
  cleaners_needed    integer not null check (cleaners_needed > 0),
  rate               numeric(10, 2) not null check (rate >= 0),
  pets               text,
  description        text,
  created_at         timestamptz not null default now()
);

create index cleaning_jobs_client_id_idx on public.cleaning_jobs (client_id);
create index cleaning_jobs_property_id_idx on public.cleaning_jobs (property_id);
create index cleaning_jobs_cleaning_status_id_idx on public.cleaning_jobs (cleaning_status_id);
create index cleaning_jobs_schedule_idx on public.cleaning_jobs (schedule);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.cleaning_jobs enable row level security;

revoke all on public.cleaning_jobs from anon, authenticated;
grant select, insert, update, delete on public.cleaning_jobs to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy cleaning_jobs_select
  on public.cleaning_jobs for select to authenticated
  using ((select public.has_permission('cleaning_jobs', 'read')));

create policy cleaning_jobs_insert
  on public.cleaning_jobs for insert to authenticated
  with check ((select public.has_permission('cleaning_jobs', 'create')));

create policy cleaning_jobs_update
  on public.cleaning_jobs for update to authenticated
  using ((select public.has_permission('cleaning_jobs', 'update')))
  with check ((select public.has_permission('cleaning_jobs', 'update')));

create policy cleaning_jobs_delete
  on public.cleaning_jobs for delete to authenticated
  using ((select public.has_permission('cleaning_jobs', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'cleaning_jobs', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'cleaning_jobs', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'cleaning_jobs', true, true,  true,  true);
