-- pgTAP: cleaning_jobs. RLS, access, constraints.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

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
insert into public.properties (id, client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code)
values ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '1 Test St', 'Testville', 'NSW', '2000', 'AU');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.cleaning_jobs'::regclass),
  'cleaning_jobs has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.cleaning_jobs$$,
  '42501',
  null,
  'anon is denied select on cleaning_jobs'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values ('2026-12-01 09:00:00+00', 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 2, 1, 50.00)$$,
  'an Admin can insert into cleaning_jobs'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.cleaning_jobs) >= 1,
  'a User can read cleaning_jobs'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values ('2026-12-01 09:00:00+00', 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 2, 1, 50.00)$$,
  '42501',
  null,
  'a User cannot insert into cleaning_jobs'
);

select lives_ok(
  $$update public.cleaning_jobs set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.cleaning_jobs$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.cleaning_jobs) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select is(
  (select cleaning_status_id from public.cleaning_jobs limit 1),
  (select id from public.cleaning_statuses where name = 'Booked'),
  'new jobs default to the Booked status'
);

select is(
  (select count(*) from public.cleaning_jobs where schedule = '2026-12-01 09:00:00+00'),
  1::bigint,
  'schedule round-trips as the same instant'
);

select lives_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate, pets, description) values (now(), 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1, 1, 0, 'Dog', 'Zero rate and optional text')$$,
  'a rate of 0 is allowed and pets and description are optional'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values (null, 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1, 1, 1)$$,
  '23502',
  null,
  'schedule is required'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values (now(), null, 'c2000000-0000-0000-0000-000000000001', 1, 1, 1)$$,
  '23502',
  null,
  'client_id is required'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values (now(), 'c1000000-0000-0000-0000-000000000001', null, 1, 1, 1)$$,
  '23502',
  null,
  'property_id is required'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, cleaning_status_id, est_hours, cleaners_needed, rate) values (now(), 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', null, 1, 1, 1)$$,
  '23502',
  null,
  'cleaning_status_id cannot be null'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values (now(), '99999999-9999-9999-9999-999999999999', 'c2000000-0000-0000-0000-000000000001', 1, 1, 1)$$,
  '23503',
  null,
  'client_id must exist in clients'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values (now(), 'c1000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', 1, 1, 1)$$,
  '23503',
  null,
  'property_id must exist in properties'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, cleaning_status_id, est_hours, cleaners_needed, rate) values (now(), 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', 1, 1, 1)$$,
  '23503',
  null,
  'cleaning_status_id must exist in cleaning_statuses'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values (now(), 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 0, 1, 1)$$,
  '23514',
  null,
  'est_hours must be greater than 0'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values (now(), 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1, 0, 1)$$,
  '23514',
  null,
  'cleaners_needed must be greater than 0'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values (now(), 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1, 1, -0.01)$$,
  '23514',
  null,
  'rate cannot be negative'
);

select ok(
  (select bool_and(created_at is not null) from public.cleaning_jobs),
  'created_at is filled in automatically'
);

select * from finish();
rollback;
