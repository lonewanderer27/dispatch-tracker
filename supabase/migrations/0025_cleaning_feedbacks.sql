-- 0025_cleaning_feedbacks: ratings and comments captured after a clean.

create table public.cleaning_feedbacks (
  id              uuid primary key default gen_random_uuid(),
  cleaning_job_id uuid not null references public.cleaning_jobs (id) on delete cascade,
  rating          integer not null check (rating between 0 and 5),
  feedback        text,
  created_at      timestamptz not null default now()
);

create index cleaning_feedbacks_cleaning_job_id_idx on public.cleaning_feedbacks (cleaning_job_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.cleaning_feedbacks enable row level security;

revoke all on public.cleaning_feedbacks from anon, authenticated;
grant select, insert, update, delete on public.cleaning_feedbacks to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy cleaning_feedbacks_select
  on public.cleaning_feedbacks for select to authenticated
  using ((select public.has_permission('cleaning_feedbacks', 'read')));

create policy cleaning_feedbacks_insert
  on public.cleaning_feedbacks for insert to authenticated
  with check ((select public.has_permission('cleaning_feedbacks', 'create')));

create policy cleaning_feedbacks_update
  on public.cleaning_feedbacks for update to authenticated
  using ((select public.has_permission('cleaning_feedbacks', 'update')))
  with check ((select public.has_permission('cleaning_feedbacks', 'update')));

create policy cleaning_feedbacks_delete
  on public.cleaning_feedbacks for delete to authenticated
  using ((select public.has_permission('cleaning_feedbacks', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'cleaning_feedbacks', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'cleaning_feedbacks', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'cleaning_feedbacks', true, true,  true,  true);
