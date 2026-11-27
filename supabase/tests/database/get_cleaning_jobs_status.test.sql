-- pgTAP: get_cleaning_jobs status filter (p_cleaning_status_ids).
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;

-- The local seed (04_cleaning_jobs.sql) adds demo rows; remove them inside this transaction (it rolls back) so the exact counts below hold.
delete from public.cleaning_jobs where id::text like 'e3000000%';
delete from public.properties where id::text like 'e2000000%';
select plan(8);

-- Fixed test identity. The whole file runs in one transaction and rolls back.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

-- Fixture rows. The statuses are the seeded ones (supabase/seeds/02_reference_data.sql):
--   Booked    10000000-0000-0000-0000-000000000001
--   Confirmed 10000000-0000-0000-0000-000000000002
--   Done      10000000-0000-0000-0000-000000000004
-- Jobs, newest first:
--   J1 now()          Booked
--   J2 45 days ago    Confirmed
--   J3 46 days ago    Booked
--   J4 100 days ago   Done    (outside "last 3 months")
insert into public.companies (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Test Co');
insert into public.clients (id, company_id, name) values ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Test Client');
insert into public.property_types (id, name) values ('c5000000-0000-0000-0000-000000000001', 'Test Property Type');
insert into public.properties (id, client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code)
values ('c6000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '1 Test St', 'Testville', 'NSW', '2000', 'AU');
insert into public.cleaning_jobs (id, schedule, client_id, property_id, cleaning_status_id, est_hours, cleaners_needed, rate) values
  ('c3000000-0000-0000-0000-000000000001', now(),                     'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 1, 10),
  ('c3000000-0000-0000-0000-000000000002', now() - interval '45 days',  'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 1, 1, 10),
  ('c3000000-0000-0000-0000-000000000003', now() - interval '46 days',  'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 1, 10),
  ('c3000000-0000-0000-0000-000000000004', now() - interval '100 days', 'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 1, 1, 10);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_cleaning_status_ids => array['10000000-0000-0000-0000-000000000001']::uuid[])$$,
  $$values ('c3000000-0000-0000-0000-000000000001'::uuid), ('c3000000-0000-0000-0000-000000000003'::uuid)$$,
  'one status returns only the jobs in that status'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_cleaning_status_ids => array['10000000-0000-0000-0000-000000000002']::uuid[])$$,
  $$values ('c3000000-0000-0000-0000-000000000002'::uuid)$$,
  'a status with one job returns that job'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_cleaning_status_ids => array['10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004']::uuid[])$$,
  $$values ('c3000000-0000-0000-0000-000000000001'::uuid), ('c3000000-0000-0000-0000-000000000003'::uuid), ('c3000000-0000-0000-0000-000000000004'::uuid)$$,
  'several statuses match any of them (OR)'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_cleaning_status_ids => array[]::uuid[])$$,
  $$values ('c3000000-0000-0000-0000-000000000001'::uuid), ('c3000000-0000-0000-0000-000000000002'::uuid), ('c3000000-0000-0000-0000-000000000003'::uuid), ('c3000000-0000-0000-0000-000000000004'::uuid)$$,
  'an empty list is no filter'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_cleaning_status_ids => array['10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004']::uuid[], p_date_range => 'last_3_months', p_time_zone => 'UTC')$$,
  $$values ('c3000000-0000-0000-0000-000000000001'::uuid), ('c3000000-0000-0000-0000-000000000003'::uuid)$$,
  'the status filter combines with another filter (AND)'
);

select is(
  (select max(total_count) from public.get_cleaning_jobs(p_cleaning_status_ids => array['10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004']::uuid[], p_page_size => 1)),
  3::bigint,
  'total_count counts every matching job, not only the page'
);

select results_eq(
  $$select status_name from public.get_cleaning_jobs(p_cleaning_status_ids => array['10000000-0000-0000-0000-000000000002']::uuid[])$$,
  $$values ('Confirmed'::text)$$,
  'the returned status name is the one filtered on'
);

select is_empty(
  $$select id from public.get_cleaning_jobs(p_cleaning_status_ids => array['99999999-9999-9999-9999-999999999999']::uuid[])$$,
  'an unknown status id matches nothing'
);
reset role;

select * from finish();
rollback;
