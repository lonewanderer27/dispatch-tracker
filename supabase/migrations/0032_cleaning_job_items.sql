-- 0032_cleaning_job_items: the items included in a job, with a priority flag.

create table public.cleaning_job_items (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.items (id),
  cleaning_job_id uuid not null references public.cleaning_jobs (id) on delete cascade,
  priority        boolean not null default false,
  description     text,
  constraint cleaning_job_items_pair_key unique (cleaning_job_id, item_id)
);

create index cleaning_job_items_item_id_idx on public.cleaning_job_items (item_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.cleaning_job_items enable row level security;

revoke all on public.cleaning_job_items from anon, authenticated;
grant select, insert, update, delete on public.cleaning_job_items to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy cleaning_job_items_select
  on public.cleaning_job_items for select to authenticated
  using ((select public.has_permission('cleaning_job_items', 'read')));

create policy cleaning_job_items_insert
  on public.cleaning_job_items for insert to authenticated
  with check ((select public.has_permission('cleaning_job_items', 'create')));

create policy cleaning_job_items_update
  on public.cleaning_job_items for update to authenticated
  using ((select public.has_permission('cleaning_job_items', 'update')))
  with check ((select public.has_permission('cleaning_job_items', 'update')));

create policy cleaning_job_items_delete
  on public.cleaning_job_items for delete to authenticated
  using ((select public.has_permission('cleaning_job_items', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'cleaning_job_items', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'cleaning_job_items', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'cleaning_job_items', true, true,  true,  true);
