-- pgTAP: cleaning_job_cleaning_types. RLS, access, constraints.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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
values ('c6000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '1 Test St', 'Testville', 'NSW', '2000', 'AU');
insert into public.cleaning_jobs (id, schedule, client_id, property_id, est_hours, cleaners_needed, rate)
values ('c3000000-0000-0000-0000-000000000001', '2026-12-01 09:00:00+00', 'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 2, 1, 50.00);
insert into public.cleaning_types (id, name) values ('c4000000-0000-0000-0000-000000000001', 'Test Type'), ('c4000000-0000-0000-0000-000000000002', 'Test Type 2');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.cleaning_job_cleaning_types'::regclass),
  'cleaning_job_cleaning_types has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.cleaning_job_cleaning_types$$,
  '42501',
  null,
  'anon is denied select on cleaning_job_cleaning_types'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.cleaning_job_cleaning_types (cleaning_job_id, cleaning_type_id) values ('c3000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001')$$,
  'an Admin can insert into cleaning_job_cleaning_types'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.cleaning_job_cleaning_types) >= 1,
  'a User can read cleaning_job_cleaning_types'
);

select throws_ok(
  $$insert into public.cleaning_job_cleaning_types (cleaning_job_id, cleaning_type_id) values ('c3000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'a User cannot insert into cleaning_job_cleaning_types'
);

select lives_ok(
  $$update public.cleaning_job_cleaning_types set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.cleaning_job_cleaning_types$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.cleaning_job_cleaning_types) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select throws_ok(
  $$insert into public.cleaning_job_cleaning_types (cleaning_job_id, cleaning_type_id) values ('c3000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001')$$,
  '23505',
  null,
  'the (cleaning_job_id, cleaning_type_id) pair must be unique'
);

select lives_ok(
  $$insert into public.cleaning_job_cleaning_types (cleaning_job_id, cleaning_type_id) values ('c3000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000002')$$,
  'a job can have several cleaning types'
);

select throws_ok(
  $$insert into public.cleaning_job_cleaning_types (cleaning_job_id, cleaning_type_id) values (null, 'c4000000-0000-0000-0000-000000000001')$$,
  '23502',
  null,
  'cleaning_job_id is required'
);

select throws_ok(
  $$insert into public.cleaning_job_cleaning_types (cleaning_job_id, cleaning_type_id) values ('c3000000-0000-0000-0000-000000000001', null)$$,
  '23502',
  null,
  'cleaning_type_id is required'
);

select throws_ok(
  $$insert into public.cleaning_job_cleaning_types (cleaning_job_id, cleaning_type_id) values ('99999999-9999-9999-9999-999999999999', 'c4000000-0000-0000-0000-000000000001')$$,
  '23503',
  null,
  'cleaning_job_id must exist in cleaning_jobs'
);

select throws_ok(
  $$insert into public.cleaning_job_cleaning_types (cleaning_job_id, cleaning_type_id) values ('c3000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999')$$,
  '23503',
  null,
  'cleaning_type_id must exist in cleaning_types'
);

select * from finish();
rollback;
