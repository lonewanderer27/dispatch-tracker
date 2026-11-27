-- pgTAP: the cleaning jobs seed (supabase/seeds/04_cleaning_jobs.sql) loaded and is consistent.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select is(
  (select count(*) from public.cleaning_jobs where id::text like 'e3000000%'),
  432::bigint,
  'the seed has 432 cleaning jobs'
);

select is(
  (select count(*) from public.cleaning_jobs j join public.properties p on p.id = j.property_id
     where j.id::text like 'e3000000%' and p.client_id <> j.client_id),
  0::bigint,
  'every seeded job uses a property that belongs to its client'
);

select is(
  (select count(*) from public.cleaning_jobs j join public.cleaning_statuses s on s.id = j.cleaning_status_id
     where j.id::text like 'e3000000%' and s.name = 'Done'),
  420::bigint,
  'past jobs are Done'
);

select is(
  (select count(*) from public.cleaning_jobs j
     where j.id::text like 'e3000000%'
       and not exists (select 1 from public.cleaning_job_cleaning_types t where t.cleaning_job_id = j.id)),
  0::bigint,
  'every seeded job has at least one cleaning type'
);

select is(
  (select count(*) from public.cleaning_job_assignments a where a.cleaning_job_id::text like 'e3000000%'),
  720::bigint,
  'the seed has 720 cleaner assignments'
);

select is(
  (select count(*) from public.cleaning_feedbacks f where f.id::text like 'e4000000%'),
  48::bigint,
  'the seed has 48 feedbacks'
);

select is(
  (select max(total_count) from public.get_cleaning_jobs(p_page_size => 100, p_time_zone => 'America/Edmonton')),
  432::bigint,
  'get_cleaning_jobs counts every seeded job'
);

select is(
  (select count(*) from public.clients c where c.id::text like 'e1000000%' and c.name ~ '[@0-9]')
  + (select count(*) from public.properties p where p.id::text like 'e2000000%' and p.address_line_1 !~ '^[0-9]+ [A-Za-z ]+$'),
  0::bigint,
  'seeded client names have no digits or at signs and addresses are generated'
);

select * from finish();
rollback;
