-- 0036_cleaning_job_status_filter: filter get_cleaning_jobs by cleaning status.

-- Adding an argument changes the function's signature, so "create or replace" would leave the old
-- version beside the new one. It is dropped and created again; its grants go with it and are given
-- again below. Everything except the new argument and its filter is unchanged from 0029.
drop function public.get_cleaning_jobs(uuid[], uuid[], uuid[], uuid[], text, integer[], text, date, date, text, text, text, integer, integer);

-- One page of the Cleaning Jobs list: filtered, sorted and counted on the server, with every
-- display column included, so the web page makes one call instead of one per row.
--   * An empty or null filter means "do not filter". Within one filter the values are OR (any of
--     these cleaners); different filters are AND.
--   * p_cleaning_status_ids matches jobs whose status is one of these ids.
--   * p_feedback_search matches any feedback text of the job as a plain substring, ignoring case.
--   * p_ratings matches jobs that have at least one feedback with one of these ratings.
--   * p_date_range limits the scheduled date. It is null (no limit) or one of:
--       next_month      the 1st of next month 00:00 up to the 1st of the month after 00:00
--       current_week    Monday 00:00 up to the next Monday 00:00
--       current_month   the 1st 00:00 up to the 1st of next month 00:00
--       last_3_months   00:00 of the day 3 months ago up to the end of today
--       last_6_months   00:00 of the day 6 months ago up to the end of today
--       custom          p_date_from 00:00 up to the end of p_date_to; either may be null
--     Every boundary is read in p_time_zone (an IANA name), so "today" and "this week" match
--     what the user sees. p_date_from and p_date_to are only used by custom.
--   * p_sort_by is schedule, client, cleaning_type or rating. cleaning_type sorts by the type
--     names joined with commas; rating sorts by the average rating. Jobs
--     without a value sort last. Ties fall back to newest schedule, then id, so paging is stable.
--   * p_page_size is limited to 1..100. total_count is the number of jobs that match the filters.
--   * company_color and status_color are the color_motif of the job's company and status; each
--     cleaning_types item is {"name", "color"}, ordered by name.
-- security invoker: RLS on every table it reads still applies.
create function public.get_cleaning_jobs(
  p_cleaner_ids       uuid[]  default null,
  p_company_ids       uuid[]  default null,
  p_client_ids        uuid[]  default null,
  p_cleaning_type_ids uuid[]  default null,
  p_cleaning_status_ids uuid[] default null,
  p_feedback_search   text    default null,
  p_ratings           integer[] default null,
  p_date_range        text    default null,
  p_date_from         date    default null,
  p_date_to           date    default null,
  p_time_zone         text    default 'America/Edmonton',
  p_sort_by           text    default 'schedule',
  p_sort_dir          text    default 'desc',
  p_page              integer default 1,
  p_page_size         integer default 10
)
returns table (
  id             uuid,
  schedule       timestamptz,
  rate           numeric,
  description    text,
  status_name    text,
  client_id      uuid,
  client_name    text,
  company_name   text,
  company_color  text,
  status_color   text,
  address        text,
  cleaners       jsonb,
  cleaning_types jsonb,
  feedbacks      jsonb,
  avg_rating     numeric,
  total_count    bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_size integer := least(greatest(coalesce(p_page_size, 10), 1), 100);
  v_offset integer := (greatest(coalesce(p_page, 1), 1) - 1) * v_size;
  v_search text := nullif(trim(p_feedback_search), '');
  v_tz     text := coalesce(p_time_zone, 'America/Edmonton');
  v_today  timestamp;
  v_from   timestamptz;
  v_to     timestamptz;
begin
  if p_sort_by is null or p_sort_by not in ('schedule', 'client', 'cleaning_type', 'rating') then
    raise exception 'invalid sort column: %', p_sort_by using errcode = '22023';
  end if;
  if p_sort_dir is null or p_sort_dir not in ('asc', 'desc') then
    raise exception 'invalid sort direction: %', p_sort_dir using errcode = '22023';
  end if;

  if not public.is_valid_time_zone(v_tz) then
    raise exception 'invalid time zone: %', v_tz using errcode = '22023';
  end if;

  -- Midnight today in the user's time zone, as a plain timestamp. "timestamp at time zone"
  -- turns a wall clock time in that zone back into a timestamptz.
  v_today := date_trunc('day', now() at time zone v_tz);
  if p_date_range is not null then
    case p_date_range
      when 'next_month' then
        v_from := (date_trunc('month', v_today) + interval '1 month') at time zone v_tz;
        v_to   := (date_trunc('month', v_today) + interval '2 months') at time zone v_tz;
      when 'current_week' then
        v_from := date_trunc('week', v_today) at time zone v_tz;
        v_to   := (date_trunc('week', v_today) + interval '7 days') at time zone v_tz;
      when 'current_month' then
        v_from := date_trunc('month', v_today) at time zone v_tz;
        v_to   := (date_trunc('month', v_today) + interval '1 month') at time zone v_tz;
      when 'last_3_months' then
        v_from := (v_today - interval '3 months') at time zone v_tz;
        v_to   := (v_today + interval '1 day') at time zone v_tz;
      when 'last_6_months' then
        v_from := (v_today - interval '6 months') at time zone v_tz;
        v_to   := (v_today + interval '1 day') at time zone v_tz;
      when 'custom' then
        if p_date_from is not null and p_date_to is not null and p_date_from > p_date_to then
          raise exception 'date range starts after it ends' using errcode = '22023';
        end if;
        v_from := p_date_from::timestamp at time zone v_tz;
        v_to   := (p_date_to + 1)::timestamp at time zone v_tz;
      else
        raise exception 'invalid date range: %', p_date_range using errcode = '22023';
    end case;
  end if;

  return query
  with ranked as (
    select
      j.id,
      count(*) over () as total_count,
      row_number() over (
        order by
          case when p_sort_by = 'schedule' and p_sort_dir = 'asc'  then j.schedule end asc  nulls last,
          case when p_sort_by = 'schedule' and p_sort_dir = 'desc' then j.schedule end desc nulls last,
          case when p_sort_by = 'client' and p_sort_dir = 'asc'  then lower(c.name) end asc  nulls last,
          case when p_sort_by = 'client' and p_sort_dir = 'desc' then lower(c.name) end desc nulls last,
          case when p_sort_by = 'cleaning_type' and p_sort_dir = 'asc' then (
            select string_agg(ct.name, ', ' order by ct.name)
            from public.cleaning_job_cleaning_types jct
            join public.cleaning_types ct on ct.id = jct.cleaning_type_id
            where jct.cleaning_job_id = j.id) end asc nulls last,
          case when p_sort_by = 'cleaning_type' and p_sort_dir = 'desc' then (
            select string_agg(ct.name, ', ' order by ct.name)
            from public.cleaning_job_cleaning_types jct
            join public.cleaning_types ct on ct.id = jct.cleaning_type_id
            where jct.cleaning_job_id = j.id) end desc nulls last,
          case when p_sort_by = 'rating' and p_sort_dir = 'asc' then (
            select avg(f.rating) from public.cleaning_feedbacks f
            where f.cleaning_job_id = j.id) end asc nulls last,
          case when p_sort_by = 'rating' and p_sort_dir = 'desc' then (
            select avg(f.rating) from public.cleaning_feedbacks f
            where f.cleaning_job_id = j.id) end desc nulls last,
          j.schedule desc,
          j.id
      ) as pos
    from public.cleaning_jobs j
    join public.clients c on c.id = j.client_id
    where (v_from is null or j.schedule >= v_from)
      and (v_to is null or j.schedule < v_to)
      and (coalesce(cardinality(p_client_ids), 0) = 0 or j.client_id = any (p_client_ids))
      and (coalesce(cardinality(p_company_ids), 0) = 0 or c.company_id = any (p_company_ids))
      and (coalesce(cardinality(p_cleaner_ids), 0) = 0 or exists (
            select 1 from public.cleaning_job_assignments a
            where a.cleaning_job_id = j.id and a.cleaner_id = any (p_cleaner_ids)))
      and (coalesce(cardinality(p_cleaning_status_ids), 0) = 0
           or j.cleaning_status_id = any (p_cleaning_status_ids))
      and (coalesce(cardinality(p_cleaning_type_ids), 0) = 0 or exists (
            select 1 from public.cleaning_job_cleaning_types jct
            where jct.cleaning_job_id = j.id and jct.cleaning_type_id = any (p_cleaning_type_ids)))
      and (v_search is null or exists (
            select 1 from public.cleaning_feedbacks f
            where f.cleaning_job_id = j.id
              and strpos(lower(f.feedback), lower(v_search)) > 0))
      and (coalesce(cardinality(p_ratings), 0) = 0 or exists (
            select 1 from public.cleaning_feedbacks f
            where f.cleaning_job_id = j.id and f.rating = any (p_ratings)))
  )
  select
    j.id,
    j.schedule,
    j.rate,
    j.description,
    s.name,
    c.id,
    c.name,
    co.name,
    co.color_motif,
    s.color_motif,
    public.get_complete_address_for_property_id(j.property_id),
    (select coalesce(jsonb_agg(jsonb_build_object('cleaner_id', g.cleaner_id, 'full_name', g.full_name)
                              order by g.full_name), '[]'::jsonb)
       from public.get_cleaners_for_cleaning_job_id(j.id) g),
    (select coalesce(jsonb_agg(jsonb_build_object('name', ct.name, 'color', ct.color_motif)
                              order by ct.name), '[]'::jsonb)
       from public.cleaning_job_cleaning_types jct
       join public.cleaning_types ct on ct.id = jct.cleaning_type_id
      where jct.cleaning_job_id = j.id),
    (select coalesce(jsonb_agg(jsonb_build_object('rating', f.rating, 'feedback', f.feedback,
                                                  'created_at', f.created_at)
                              order by f.created_at desc, f.id), '[]'::jsonb)
       from public.get_client_feedbacks_for_cleaning_job_id(j.id) f),
    (select round(avg(f.rating), 1) from public.cleaning_feedbacks f
      where f.cleaning_job_id = j.id),
    r.total_count
  from ranked r
  join public.cleaning_jobs j on j.id = r.id
  join public.clients c on c.id = j.client_id
  join public.companies co on co.id = c.company_id
  join public.cleaning_statuses s on s.id = j.cleaning_status_id
  where r.pos > v_offset and r.pos <= v_offset + v_size
  order by r.pos;
end;
$$;

revoke execute on function public.get_cleaning_jobs(uuid[], uuid[], uuid[], uuid[], uuid[], text, integer[], text, date, date, text, text, text, integer, integer) from public, anon;
grant  execute on function public.get_cleaning_jobs(uuid[], uuid[], uuid[], uuid[], uuid[], text, integer[], text, date, date, text, text, text, integer, integer) to authenticated;
