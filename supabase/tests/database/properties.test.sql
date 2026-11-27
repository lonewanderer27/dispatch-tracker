-- pgTAP: properties. RLS, access, constraints.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;

-- The local seed (04_cleaning_jobs.sql) adds demo rows; remove them inside this transaction (it rolls back) so the exact counts below hold.
delete from public.cleaning_jobs where id::text like 'e3000000%';
delete from public.properties where id::text like 'e2000000%';
select plan(18);

-- Fixed test identities. The whole file runs in one transaction and rolls back.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'carol@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'cccccccc-0000-0000-0000-00000000000c';

-- Fixture rows, inserted as the table owner (bypasses RLS).
insert into public.companies (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Test Co');
insert into public.clients (id, company_id, name) values ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Test Client');
insert into public.property_types (id, name) values ('c5000000-0000-0000-0000-000000000001', 'Test Property Type');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.properties'::regclass),
  'properties has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.properties$$,
  '42501',
  null,
  'anon is denied select on properties'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '1 Test St', 'Testville', 'NSW', '2000', 'AU')$$,
  'an Admin can insert into properties'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.properties) >= 1,
  'a User can read properties'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '1 Test St', 'Testville', 'NSW', '2000', 'AU')$$,
  '42501',
  null,
  'a User cannot insert into properties'
);

select lives_ok(
  $$update public.properties set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.properties$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.properties) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select is(
  (select count(*) from public.properties where sqft is null and address_line_2 is null and parking_instructions is null),
  1::bigint,
  'sqft, address_line_2 and parking_instructions are optional'
);

select lives_ok(
  $$insert into public.properties (client_id, property_type_id, sqft, address_line_1, address_line_2, city, province_state, postal_code, country_code, parking_instructions) values ('c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 1200.5, '2 Test St', 'Unit 4', 'Testville', 'NSW', '2000', 'CA', 'Visitor bay')$$,
  'one client can have many properties, with all optional fields set'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'x', 'x', 'x', 'x', 'au')$$,
  '23514',
  null,
  'lowercase country_code is rejected'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'x', 'x', 'x', 'x', 'AUS')$$,
  '23514',
  null,
  'three-letter country_code is rejected'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'x', 'x', 'x', 'x', null)$$,
  '23502',
  null,
  'country_code is required'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values (null, 'c5000000-0000-0000-0000-000000000001', 'x', 'x', 'x', 'x', 'AU')$$,
  '23502',
  null,
  'client_id is required'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('c1000000-0000-0000-0000-000000000001', null, 'x', 'x', 'x', 'x', 'AU')$$,
  '23502',
  null,
  'property_type_id is required'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('99999999-9999-9999-9999-999999999999', 'c5000000-0000-0000-0000-000000000001', 'x', 'x', 'x', 'x', 'AU')$$,
  '23503',
  null,
  'client_id must exist in clients'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('c1000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', 'x', 'x', 'x', 'x', 'AU')$$,
  '23503',
  null,
  'property_type_id must exist in property_types'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '  ', 'x', 'x', 'x', 'AU')$$,
  '23514',
  null,
  'address_line_1 cannot be blank'
);

select * from finish();
rollback;
