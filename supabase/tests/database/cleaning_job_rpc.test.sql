-- pgTAP: get_complete_address_for_property_id, get_cleaners_for_cleaning_job_id and
-- get_client_feedbacks_for_cleaning_job_id.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Fixed test identity. The whole file runs in one transaction and rolls back.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

-- A sign-up has no role (0040). These tests were written for a User, so give the test users that role.
update public.profiles set role_id = '30000000-0000-0000-0000-000000000002' where role_id is null;

-- Fixture rows, inserted as the table owner (bypasses RLS).
insert into public.companies (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Test Co');
insert into public.clients (id, company_id, name) values ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Test Client');
insert into public.property_types (id, name) values ('c5000000-0000-0000-0000-000000000001', 'Test Property Type');
insert into public.properties (id, client_id, property_type_id, address_line_1, address_line_2, city, province_state, postal_code, country_code) values
  ('c6000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '1 Test St', 'Unit 2', 'Edmonton', 'AB', 'T5J 0N3', 'CA'),
  ('c6000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '9 Other Rd', null, 'Sydney', 'NSW', '2000', 'AU');
insert into public.cleaning_jobs (id, schedule, client_id, property_id, est_hours, cleaners_needed, rate) values
  ('c3000000-0000-0000-0000-000000000001', '2026-12-01 09:00:00+00', 'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 2, 2, 50.00),
  ('c3000000-0000-0000-0000-000000000002', '2026-12-02 09:00:00+00', 'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 2, 1, 50.00);
insert into public.cleaners (id, first_name, middle_name, last_name) values
  ('c2000000-0000-0000-0000-000000000001', 'Zed', null, 'Adams'),
  ('c2000000-0000-0000-0000-000000000002', 'Amy', 'Lee', 'Brown');
insert into public.cleaning_job_assignments (cleaner_id, cleaning_job_id) values
  ('c2000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000001'),
  ('c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001');

insert into public.cleaning_feedbacks (cleaning_job_id, rating, feedback, created_at) values
  ('c3000000-0000-0000-0000-000000000001', 4, 'Older', '2026-12-05 10:00:00+00'),
  ('c3000000-0000-0000-0000-000000000001', 2, 'Newer', '2026-12-06 10:00:00+00');

-- Anon cannot call any of the functions.
set local role anon;
select throws_ok(
  $$select public.get_complete_address_for_property_id('c6000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'anon cannot call get_complete_address_for_property_id'
);
select throws_ok(
  $$select * from public.get_cleaners_for_cleaning_job_id('c3000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'anon cannot call get_cleaners_for_cleaning_job_id'
);
select throws_ok(
  $$select * from public.get_client_feedbacks_for_cleaning_job_id('c3000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'anon cannot call get_client_feedbacks_for_cleaning_job_id'
);
reset role;

-- A signed-in User (read only) can call both.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);

select is(
  public.get_complete_address_for_property_id('c6000000-0000-0000-0000-000000000001'),
  '1 Test St, Unit 2, Edmonton, AB, T5J 0N3, CA',
  'the address joins every field in order'
);

select is(
  public.get_complete_address_for_property_id('c6000000-0000-0000-0000-000000000002'),
  '9 Other Rd, Sydney, NSW, 2000, AU',
  'an empty address_line_2 is skipped'
);

select is(
  public.get_complete_address_for_property_id('99999999-9999-9999-9999-999999999999'),
  null,
  'an unknown property gives null'
);

select results_eq(
  $$select cleaner_id, full_name from public.get_cleaners_for_cleaning_job_id('c3000000-0000-0000-0000-000000000001')$$,
  $$values ('c2000000-0000-0000-0000-000000000001'::uuid, 'Zed Adams'), ('c2000000-0000-0000-0000-000000000002'::uuid, 'Amy Lee Brown')$$,
  'the assigned cleaners come back ordered by last name, with the middle name when present'
);

select is_empty(
  $$select * from public.get_cleaners_for_cleaning_job_id('c3000000-0000-0000-0000-000000000002')$$,
  'a job with no assignments returns no rows'
);

select is_empty(
  $$select * from public.get_cleaners_for_cleaning_job_id('99999999-9999-9999-9999-999999999999')$$,
  'an unknown job returns no rows'
);

select results_eq(
  $$select rating, feedback from public.get_client_feedbacks_for_cleaning_job_id('c3000000-0000-0000-0000-000000000001')$$,
  $$values (2, 'Newer'), (4, 'Older')$$,
  'the feedback of a job comes back newest first'
);

select is_empty(
  $$select * from public.get_client_feedbacks_for_cleaning_job_id('c3000000-0000-0000-0000-000000000002')$$,
  'a job without feedback returns no rows'
);
reset role;

select * from finish();
rollback;
