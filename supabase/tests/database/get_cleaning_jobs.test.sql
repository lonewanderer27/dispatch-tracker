-- pgTAP: get_cleaning_jobs. Filters, sorting, paging, row content, access.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Fixed test identity. The whole file runs in one transaction and rolls back.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

-- Fixture rows, inserted as the table owner (bypasses RLS).
--   J1 2026-12-01 client Xavier (Alpha Co): cleaners Zed Adams + Amy Brown, types Test Deep + Test Move-Out,
--      feedback 5 "Great clean" and 3 "Missed oven"
--   J2 2026-12-02 client Yara (Beta Co): cleaner Amy Brown, type Test Move-Out, feedback 5 "Good"
--   J3 2026-12-03 client Xavier (Alpha Co): no cleaners, no types, no feedback
insert into public.companies (id, name) values
  ('c0000000-0000-0000-0000-000000000001', 'Alpha Co'),
  ('c0000000-0000-0000-0000-000000000002', 'Beta Co');
insert into public.clients (id, company_id, name) values
  ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Xavier'),
  ('c1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'Yara');
insert into public.property_types (id, name) values ('c5000000-0000-0000-0000-000000000001', 'Test Property Type');
insert into public.properties (id, client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values
  ('c6000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '1 Test St', 'Edmonton', 'AB', 'T5J 0N3', 'CA'),
  ('c6000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 'c5000000-0000-0000-0000-000000000001', '9 Other Rd', 'Calgary', 'AB', 'T2P 1J9', 'CA');
insert into public.cleaning_jobs (id, schedule, client_id, property_id, est_hours, cleaners_needed, rate) values
  ('c3000000-0000-0000-0000-000000000001', '2026-12-01 09:00:00+00', 'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 2, 2, 50.00),
  ('c3000000-0000-0000-0000-000000000002', '2026-12-02 09:00:00+00', 'c1000000-0000-0000-0000-000000000002', 'c6000000-0000-0000-0000-000000000002', 2, 1, 60.00),
  ('c3000000-0000-0000-0000-000000000003', '2026-12-03 09:00:00+00', 'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 2, 1, 70.00);
insert into public.cleaners (id, first_name, last_name) values
  ('c2000000-0000-0000-0000-000000000001', 'Zed', 'Adams'),
  ('c2000000-0000-0000-0000-000000000002', 'Amy', 'Brown');
insert into public.cleaning_job_assignments (cleaner_id, cleaning_job_id) values
  ('c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001'),
  ('c2000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000001'),
  ('c2000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000002');
insert into public.cleaning_types (id, name) values
  ('c4000000-0000-0000-0000-000000000001', 'Test Deep'),
  ('c4000000-0000-0000-0000-000000000002', 'Test Move-Out');
insert into public.cleaning_job_cleaning_types (cleaning_job_id, cleaning_type_id) values
  ('c3000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001'),
  ('c3000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000002'),
  ('c3000000-0000-0000-0000-000000000002', 'c4000000-0000-0000-0000-000000000002');
insert into public.cleaning_feedbacks (cleaning_job_id, rating, feedback, created_at) values
  ('c3000000-0000-0000-0000-000000000001', 5, 'Great clean', '2026-12-05 10:00:00+00'),
  ('c3000000-0000-0000-0000-000000000001', 3, 'Missed oven', '2026-12-06 10:00:00+00'),
  ('c3000000-0000-0000-0000-000000000002', 5, 'Good', '2026-12-07 10:00:00+00');

-- Anon cannot call it.
set local role anon;
select throws_ok(
  $$select * from public.get_cleaning_jobs()$$,
  '42501', null, 'anon cannot call get_cleaning_jobs'
);
reset role;

-- Act as Alice (User role, read only).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);

select results_eq(
  $$select id from public.get_cleaning_jobs()$$,
  $$values ('c3000000-0000-0000-0000-000000000003'::uuid), ('c3000000-0000-0000-0000-000000000002'::uuid), ('c3000000-0000-0000-0000-000000000001'::uuid)$$,
  'default order is newest schedule first'
);

select is(
  (select max(total_count) from public.get_cleaning_jobs()),
  3::bigint,
  'total_count is the number of matching jobs'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_client_ids => array['c1000000-0000-0000-0000-000000000001']::uuid[])$$,
  $$values ('c3000000-0000-0000-0000-000000000003'::uuid), ('c3000000-0000-0000-0000-000000000001'::uuid)$$,
  'filter by client'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_company_ids => array['c0000000-0000-0000-0000-000000000002']::uuid[])$$,
  $$values ('c3000000-0000-0000-0000-000000000002'::uuid)$$,
  'filter by company (the client''s company)'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_cleaner_ids => array['c2000000-0000-0000-0000-000000000001']::uuid[])$$,
  $$values ('c3000000-0000-0000-0000-000000000001'::uuid)$$,
  'filter by cleaner'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_cleaning_type_ids => array['c4000000-0000-0000-0000-000000000002']::uuid[])$$,
  $$values ('c3000000-0000-0000-0000-000000000002'::uuid), ('c3000000-0000-0000-0000-000000000001'::uuid)$$,
  'filter by cleaning type'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_feedback_search => ' OVEN ')$$,
  $$values ('c3000000-0000-0000-0000-000000000001'::uuid)$$,
  'filter by feedback text ignores case and surrounding spaces'
);

select is_empty(
  $$select id from public.get_cleaning_jobs(p_feedback_search => '%')$$,
  'a percent sign in the feedback search is a plain character, not a wildcard'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_ratings => array[3])$$,
  $$values ('c3000000-0000-0000-0000-000000000001'::uuid)$$,
  'filter by rating matches any feedback of the job'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_client_ids => array['c1000000-0000-0000-0000-000000000001']::uuid[], p_ratings => array[5])$$,
  $$values ('c3000000-0000-0000-0000-000000000001'::uuid)$$,
  'different filters combine with AND'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_sort_by => 'client', p_sort_dir => 'asc')$$,
  $$values ('c3000000-0000-0000-0000-000000000003'::uuid), ('c3000000-0000-0000-0000-000000000001'::uuid), ('c3000000-0000-0000-0000-000000000002'::uuid)$$,
  'sort by client, ties fall back to newest schedule'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_sort_by => 'cleaning_type', p_sort_dir => 'asc')$$,
  $$values ('c3000000-0000-0000-0000-000000000001'::uuid), ('c3000000-0000-0000-0000-000000000002'::uuid), ('c3000000-0000-0000-0000-000000000003'::uuid)$$,
  'sort by cleaning type, jobs without a type last'
);

select throws_ok(
  $$select * from public.get_cleaning_jobs(p_sort_by => 'feedback')$$,
  '22023', null, 'sorting by feedback is not offered'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_sort_by => 'rating', p_sort_dir => 'desc')$$,
  $$values ('c3000000-0000-0000-0000-000000000002'::uuid), ('c3000000-0000-0000-0000-000000000001'::uuid), ('c3000000-0000-0000-0000-000000000003'::uuid)$$,
  'sort by average rating, highest first, jobs without feedback last'
);

select results_eq(
  $$select id, total_count from public.get_cleaning_jobs(p_page => 2, p_page_size => 1)$$,
  $$values ('c3000000-0000-0000-0000-000000000002'::uuid, 3::bigint)$$,
  'paging returns the requested page and the full total_count'
);

select throws_ok(
  $$select * from public.get_cleaning_jobs(p_sort_by => 'rate; drop table x')$$,
  '22023', null, 'an unknown sort column is rejected'
);

select throws_ok(
  $$select * from public.get_cleaning_jobs(p_sort_dir => 'sideways')$$,
  '22023', null, 'an unknown sort direction is rejected'
);

select results_eq(
  $$select client_name, company_name, status_name, address, cleaners, cleaning_types, (select jsonb_agg(e - 'created_at') from jsonb_array_elements(feedbacks) e), avg_rating, rate from public.get_cleaning_jobs(p_client_ids => array['c1000000-0000-0000-0000-000000000001']::uuid[], p_ratings => array[3])$$,
  $$values ('Xavier', 'Alpha Co', 'Booked', '1 Test St, Edmonton, AB, T5J 0N3, CA',
    '[{"cleaner_id": "c2000000-0000-0000-0000-000000000002", "full_name": "Amy Brown"}, {"cleaner_id": "c2000000-0000-0000-0000-000000000001", "full_name": "Zed Adams"}]'::jsonb,
    '["Test Deep", "Test Move-Out"]'::jsonb,
    '[{"rating": 3, "feedback": "Missed oven"}, {"rating": 5, "feedback": "Great clean"}]'::jsonb,
    4.0::numeric, 50.00::numeric)$$,
  'a row carries every display column, with the feedback newest first'
);
reset role;

select * from finish();
rollback;
