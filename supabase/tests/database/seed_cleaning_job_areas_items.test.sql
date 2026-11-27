-- pgTAP: the areas and items seed (supabase/seeds/05_cleaning_job_areas_items.sql) loaded and is
-- consistent with the seeded jobs and their cleaning types.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select is(
  (select count(*) from public.cleaning_job_areas where cleaning_job_id::text like 'e3000000%'),
  1950::bigint,
  'the seed has 1950 job areas (1937 from the cleaning types and 13 basements)'
);

select is(
  (select count(*) from public.cleaning_job_items where cleaning_job_id::text like 'e3000000%'),
  144::bigint,
  'the seed has 144 job items'
);

select is(
  (select count(*) from public.cleaning_jobs j
     where j.id::text like 'e3000000%'
       and not exists (select 1 from public.cleaning_job_areas a where a.cleaning_job_id = j.id)),
  0::bigint,
  'every seeded job has at least one area'
);

select is(
  (select count(*) from public.cleaning_job_areas a
     join public.areas ar on ar.id = a.area_id
     where a.cleaning_job_id::text like 'e3000000%' and ar.name = 'Basement'),
  13::bigint,
  'the notes asked for the basement on 13 jobs'
);

select is(
  (select count(*) from public.cleaning_jobs j
     join public.cleaning_job_cleaning_types jct on jct.cleaning_job_id = j.id
     join public.cleaning_types ct on ct.id = jct.cleaning_type_id
     where j.id::text like 'e3000000%' and ct.name = 'Deep'
       and not exists (
         select 1 from public.cleaning_job_areas a join public.areas ar on ar.id = a.area_id
         where a.cleaning_job_id = j.id and ar.name = 'Kitchen' and a.priority)),
  0::bigint,
  'every Deep job has the Kitchen as a priority area'
);

select is(
  (select count(*) from public.cleaning_jobs j
     join public.cleaning_job_cleaning_types jct on jct.cleaning_job_id = j.id
     join public.cleaning_types ct on ct.id = jct.cleaning_type_id
     where j.id::text like 'e3000000%' and ct.name = 'Regular'
       and exists (select 1 from public.cleaning_job_areas a where a.cleaning_job_id = j.id and a.priority)),
  0::bigint,
  'a Regular job has no priority area'
);

select is(
  (select count(*) from public.cleaning_job_items where cleaning_job_id::text like 'e3000000%' and not priority),
  0::bigint,
  'seeded items are the specific asks, so all are priorities'
);

select is(
  (select count(distinct i.name) from public.cleaning_job_items ji join public.items i on i.id = ji.item_id
     where ji.cleaning_job_id::text like 'e3000000%'),
  7::bigint,
  'seven different items are used: oven, fridge, cabinet, window, baseboard, wall and carpet'
);

select * from finish();
rollback;
