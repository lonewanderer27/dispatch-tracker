-- 0021_items: lookup list of items.

create table public.items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) > 0),
  description text,
  constraint items_name_key unique (name)
);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.items enable row level security;

revoke all on public.items from anon, authenticated;
grant select, insert, update, delete on public.items to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy items_select
  on public.items for select to authenticated
  using ((select public.has_permission('items', 'read')));

create policy items_insert
  on public.items for insert to authenticated
  with check ((select public.has_permission('items', 'create')));

create policy items_update
  on public.items for update to authenticated
  using ((select public.has_permission('items', 'update')))
  with check ((select public.has_permission('items', 'update')));

create policy items_delete
  on public.items for delete to authenticated
  using ((select public.has_permission('items', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'items', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'items', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'items', true, true,  true,  true);
