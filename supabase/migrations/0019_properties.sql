-- 0019_properties: each client's property address and parking instructions.

create table public.properties (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references public.clients (id) on delete cascade,
  property_type_id     uuid not null references public.property_types (id),
  sqft                 double precision,
  address_line_1       text not null check (char_length(trim(address_line_1)) > 0),
  address_line_2       text,
  city                 text not null check (char_length(trim(city)) > 0),
  province_state       text not null check (char_length(trim(province_state)) > 0),
  postal_code          text not null check (char_length(trim(postal_code)) > 0),
  country_code         text not null check (country_code ~ '^[A-Z]{2}$'),
  parking_instructions text
);

create index properties_client_id_idx on public.properties (client_id);
create index properties_property_type_id_idx on public.properties (property_type_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.properties enable row level security;

revoke all on public.properties from anon, authenticated;
grant select, insert, update, delete on public.properties to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy properties_select
  on public.properties for select to authenticated
  using ((select public.has_permission('properties', 'read')));

create policy properties_insert
  on public.properties for insert to authenticated
  with check ((select public.has_permission('properties', 'create')));

create policy properties_update
  on public.properties for update to authenticated
  using ((select public.has_permission('properties', 'update')))
  with check ((select public.has_permission('properties', 'update')));

create policy properties_delete
  on public.properties for delete to authenticated
  using ((select public.has_permission('properties', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'properties', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'properties', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'properties', true, true,  true,  true);
