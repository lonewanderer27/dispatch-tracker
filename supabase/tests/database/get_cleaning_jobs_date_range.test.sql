-- pgTAP: get_cleaning_jobs date range filter on the scheduled date.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Fixed test identity. The whole file runs in one transaction and rolls back.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

-- Fixture rows. Schedules are relative to now() so the file passes on any day. All checks use
-- p_time_zone => 'UTC' so the boundaries do not depend on the server's own zone.
--   NOW  = now()                  (always in the current week and month)
--   P45  = 45 days ago            (not this month; inside 3 and 6 months)
--   P100 = 100 days ago           (outside 3 months; inside 6 months)
--   P200 = 200 days ago           (outside 6 months)
--   NM   = day 11 of next month   (the future: only in next month)
--   Y2K  = 2000-12-02 03:00 UTC   (a fixed instant: still 2000-12-01 evening in Edmonton)
insert into public.companies (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Test Co');
insert into public.clients (id, company_id, name) values ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Test Client');
insert into public.property_types (id, name) values ('c5000000-0000-0000-0000-000000000001', 'Test Property Type');
insert into public.properties (id, client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code)
values ('c6000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '1 Test St', 'Testville', 'NSW', '2000', 'AU');
insert into public.cleaning_jobs (id, schedule, client_id, property_id, est_hours, cleaners_needed, rate) values
  ('c3000000-0000-0000-0000-000000000001', now(),                      'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 1, 1, 10),
  ('c3000000-0000-0000-0000-000000000002', now() - interval '45 days',  'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 1, 1, 10),
  ('c3000000-0000-0000-0000-000000000003', now() - interval '100 days', 'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 1, 1, 10),
  ('c3000000-0000-0000-0000-000000000004', now() - interval '200 days', 'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 1, 1, 10),
  ('c3000000-0000-0000-0000-000000000005', (date_trunc('month', now() at time zone 'UTC') + interval '1 month 10 days') at time zone 'UTC', 'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 1, 1, 10),
  ('c3000000-0000-0000-0000-000000000006', '2000-12-02 03:00:00+00',   'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 1, 1, 10);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);

-- The ids come back newest first (the default sort), so the expected lists are newest first too.
select results_eq(
  $$select id from public.get_cleaning_jobs(p_time_zone => 'UTC')$$,
  $$values ('c3000000-0000-0000-0000-000000000005'::uuid), ('c3000000-0000-0000-0000-000000000001'::uuid), ('c3000000-0000-0000-0000-000000000002'::uuid), ('c3000000-0000-0000-0000-000000000003'::uuid), ('c3000000-0000-0000-0000-000000000004'::uuid), ('c3000000-0000-0000-0000-000000000006'::uuid)$$,
  'no date range returns every job'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_date_range => 'next_month', p_time_zone => 'UTC')$$,
  $$values ('c3000000-0000-0000-0000-000000000005'::uuid)$$,
  'next_month returns only next month'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_date_range => 'current_week', p_time_zone => 'UTC')$$,
  $$values ('c3000000-0000-0000-0000-000000000001'::uuid)$$,
  'current_week returns only this week'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_date_range => 'current_month', p_time_zone => 'UTC')$$,
  $$values ('c3000000-0000-0000-0000-000000000001'::uuid)$$,
  'current_month returns only this month'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_date_range => 'last_3_months', p_time_zone => 'UTC')$$,
  $$values ('c3000000-0000-0000-0000-000000000001'::uuid), ('c3000000-0000-0000-0000-000000000002'::uuid)$$,
  'last_3_months returns the last 3 months up to today, not the future'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_date_range => 'last_6_months', p_time_zone => 'UTC')$$,
  $$values ('c3000000-0000-0000-0000-000000000001'::uuid), ('c3000000-0000-0000-0000-000000000002'::uuid), ('c3000000-0000-0000-0000-000000000003'::uuid)$$,
  'last_6_months returns the last 6 months up to today'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_date_range => 'custom',
      p_date_from => ((now() at time zone 'UTC')::date - 110), p_date_to => ((now() at time zone 'UTC')::date - 40), p_time_zone => 'UTC')$$,
  $$values ('c3000000-0000-0000-0000-000000000002'::uuid), ('c3000000-0000-0000-0000-000000000003'::uuid)$$,
  'custom with both dates returns the jobs between them'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_date_range => 'custom',
      p_date_from => ((now() at time zone 'UTC')::date - 45), p_date_to => ((now() at time zone 'UTC')::date - 45), p_time_zone => 'UTC')$$,
  $$values ('c3000000-0000-0000-0000-000000000002'::uuid)$$,
  'custom with the same day twice returns that whole day (the end date is included)'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_date_range => 'custom',
      p_date_from => ((now() at time zone 'UTC')::date - 50), p_time_zone => 'UTC')$$,
  $$values ('c3000000-0000-0000-0000-000000000005'::uuid), ('c3000000-0000-0000-0000-000000000001'::uuid), ('c3000000-0000-0000-0000-000000000002'::uuid)$$,
  'custom with only a start date has no end'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_date_range => 'custom',
      p_date_to => ((now() at time zone 'UTC')::date - 150), p_time_zone => 'UTC')$$,
  $$values ('c3000000-0000-0000-0000-000000000004'::uuid), ('c3000000-0000-0000-0000-000000000006'::uuid)$$,
  'custom with only an end date has no start'
);

select is(
  (select count(*) from public.get_cleaning_jobs(p_date_range => 'custom', p_time_zone => 'UTC')),
  6::bigint,
  'custom with no dates does not filter'
);

select is(
  (select max(total_count) from public.get_cleaning_jobs(p_date_range => 'last_6_months', p_time_zone => 'UTC', p_page_size => 1)),
  3::bigint,
  'total_count counts the jobs inside the date range, not the page'
);

select results_eq(
  $$select id from public.get_cleaning_jobs(p_date_range => 'custom', p_date_from => date '2000-12-01', p_date_to => date '2000-12-01', p_time_zone => 'America/Edmonton')$$,
  $$values ('c3000000-0000-0000-0000-000000000006'::uuid)$$,
  'the day is read in the given time zone: 03:00 UTC on Dec 2 is still Dec 1 in Edmonton'
);

select is_empty(
  $$select id from public.get_cleaning_jobs(p_date_range => 'custom', p_date_from => date '2000-12-01', p_date_to => date '2000-12-01', p_time_zone => 'UTC')$$,
  'the same dates in UTC do not include it'
);

select throws_ok(
  $$select * from public.get_cleaning_jobs(p_date_range => 'next_year', p_time_zone => 'UTC')$$,
  '22023', null, 'an unknown date range is rejected'
);

select throws_ok(
  $$select * from public.get_cleaning_jobs(p_date_range => 'current_week', p_time_zone => 'Mars/Olympus')$$,
  '22023', null, 'an unknown time zone is rejected'
);

select throws_ok(
  $$select * from public.get_cleaning_jobs(p_date_range => 'custom', p_date_from => date '2026-12-02', p_date_to => date '2026-12-01', p_time_zone => 'UTC')$$,
  '22023', null, 'a custom range that starts after it ends is rejected'
);
reset role;

select * from finish();
rollback;
