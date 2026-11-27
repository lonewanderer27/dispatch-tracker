-- 0008_contacts: contacts (name and phone number) for each client.

create table public.contacts (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) > 0),
  last_name  text not null check (char_length(trim(last_name)) > 0),
  contact_no text not null check (char_length(trim(contact_no)) > 0)
);

create index contacts_client_id_idx on public.contacts (client_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.contacts enable row level security;

revoke all on public.contacts from anon, authenticated;
grant select, insert, update, delete on public.contacts to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy contacts_select
  on public.contacts for select to authenticated
  using ((select public.has_permission('contacts', 'read')));

create policy contacts_insert
  on public.contacts for insert to authenticated
  with check ((select public.has_permission('contacts', 'create')));

create policy contacts_update
  on public.contacts for update to authenticated
  using ((select public.has_permission('contacts', 'update')))
  with check ((select public.has_permission('contacts', 'update')));

create policy contacts_delete
  on public.contacts for delete to authenticated
  using ((select public.has_permission('contacts', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'contacts', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'contacts', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'contacts', true, true,  true,  true);
