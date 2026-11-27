-- 0027_profiles_preferred_time_zone: the time zone each user sees dates and times in.

-- Check constraints cannot contain a subquery, so the lookup lives in a function.
-- pg_timezone_names lists the IANA names Postgres knows (for example America/Edmonton).
create function public.is_valid_time_zone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

revoke execute on function public.is_valid_time_zone(text) from public, anon;
grant  execute on function public.is_valid_time_zone(text) to authenticated;

alter table public.profiles
  add column preferred_time_zone text not null default 'America/Edmonton'
    constraint profiles_preferred_time_zone_valid
    check (public.is_valid_time_zone(preferred_time_zone));

-- Users may change their own value (the existing profiles_update_own policy limits them to their
-- own row). They still cannot write role_id.
grant update (preferred_time_zone) on public.profiles to authenticated;
