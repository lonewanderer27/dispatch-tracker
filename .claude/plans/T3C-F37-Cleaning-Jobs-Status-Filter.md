# T3C-F37 Cleaning Jobs: Cleaning Status filter

> **Status: Draft, not approved.**
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.
>
> **Phases.** Phase 1 (Steps 0 to 3) adds the filter to the database function and its pgTAP test. Phase 2 (Steps 4 to 9) adds it to the web page, with its Vitest updates. Phase 3 (Steps 10 to 11) adds the Playwright test and the docs. Commits are listed in "Conventional commits".

## Why

Source: owner request in conversation (2026-11-27), ticket `T3C-F37` "Cleaning Jobs: Cleaning Status Filter". The ticket text has no more detail than its title, so the acceptance below is derived from it and from the existing filters (T3C-F35).

- Story: "As a dispatcher, I want to filter the Cleaning Jobs list by cleaning status, so that I can see only the jobs that are Booked, Confirmed, In Progress or Done."
- Acceptance:
  - The "Filters" panel on the Cleaning Jobs page has a **Status** multi-select (placeholder "Any status") listing every cleaning status by name.
  - Choosing one or more statuses keeps only jobs whose status is one of them. Several statuses are OR; Status combines with every other filter by AND (the rules of T3C-F35).
  - An active status shows as a removable tag "Status: Booked" with the other active filters, and counts once in the badge on the "Filters" button.
  - "Clear all" and the "No jobs match these filters" empty state clear it like any other filter.
  - The filtering happens in the database function `get_cleaning_jobs`, like every other filter (see architecture [0004](../../docs/architecture/0004-Cleaning-Jobs-List-Function.md)).

## Facts (verified 2026-11-27)

Branch at the time of writing: `feat/T3C-R36-Refactor-Codebase` (the feature folder layout, [0008](../../docs/architecture/0008-Feature-Folders.md), is on it and not yet on the main branch `feat/supabase-refine-starter`). Working tree clean.

1. **The status is already a column and an index exists.** `cleaning_jobs.cleaning_status_id uuid not null references cleaning_statuses (id)` (`0022_cleaning_jobs.sql:8`) with `create index cleaning_jobs_cleaning_status_id_idx on public.cleaning_jobs (cleaning_status_id)` (`0022_cleaning_jobs.sql:21`). **No new index.**
2. **`cleaning_statuses`** (`0012_cleaning_statuses.sql`) has `id`, `name` (unique) and `color_motif` (added in `0029`). Select is allowed by `has_permission('cleaning_statuses', 'read')`. The seed (`supabase/seeds/02_reference_data.sql:26-30`) has four rows: Booked `10000000-0000-0000-0000-000000000001`, Confirmed `...0002`, In Progress `...0003`, Done `...0004`. New jobs default to Booked.
3. **Migrations present:** `0001` to `0012`, `0018` to `0029`, `0031`, `0032`. The migration plans that are not implemented yet reserve `0030` (preferred cleaners) and `0033` to `0035` (invoice statuses, invoice templates, invoices). **This plan uses `0036`**, the next free number. If `0036_*` already exists, **stop and report**.
4. **`get_cleaning_jobs`** is defined in full in `supabase/migrations/0029_color_motifs.sql:47-250`. Its signature there is `(uuid[], uuid[], uuid[], uuid[], text, integer[], text, date, date, text, text, text, integer, integer)`: `p_cleaner_ids, p_company_ids, p_client_ids, p_cleaning_type_ids, p_feedback_search, p_ratings, p_date_range, p_date_from, p_date_to, p_time_zone, p_sort_by, p_sort_dir, p_page, p_page_size`. Adding an argument changes the signature, so `create or replace` would leave the old function next to the new one; the migration therefore drops the old one and recreates it (the same approach `0029` used). All callers (the web, `supabase/tests/database/get_cleaning_jobs*.test.sql`) pass **named** arguments, so inserting a new argument in the middle breaks none of them.
5. **Web filters.** `CleaningJobFilters` (`src/features/cleaning-jobs/api.ts:26-36`) holds `cleanerIds, companyIds, clientIds, cleaningTypeIds, feedbackSearch, ratings, dateRange, dateFrom, dateTo`. `EMPTY_FILTERS` (`api.ts:47`), `hasActiveFilters` (`api.ts:68`) and `fetchCleaningJobs` (`api.ts:89`, sends `p_*` arguments, an empty list as `undefined`) each repeat the field list. `buildFilterChips` and `countPanelFilters` are in `src/features/cleaning-jobs/filterChips.ts`; `CleaningJobFilterBar.tsx` loads each option list with Refine's `useList` (`pagination: { mode: 'off' }`) and builds the panel from an `idFilters` array. `CleaningJobList.tsx` needs **no change**: it passes the filters through and uses `hasActiveFilters` for the empty state.
6. `CleaningStatus` is already exported from `src/types/db.ts:25` (`Tables<'cleaning_statuses'>`). The Refine resource name is `cleaning_statuses` (`src/features/cleaning-statuses/routes.tsx:10`).
7. `src/types/database.types.ts` is generated (`pnpm db:reset` runs `pnpm db:types` at the end); never hand-edit it.
8. **Baseline on 2026-11-27** (before any change): `pnpm vitest run` gives 23 files, 147 tests, all passing. `pnpm test:db` gives 31 files, 469 tests, and **one failure that is not part of this ticket**: `seed.test.sql` test 3 "seeded normal user has 3 todos" (have 5, want 3), caused by leftover rows in the local database. Step 1 runs `pnpm db:reset`, which should clear it. If `seed.test.sql` still fails after the reset, **stop and report** (do not fix it here).
9. Seed data: `04_cleaning_jobs.sql` inserts hundreds of jobs (Aug to Dec 2026), almost all `Done`. The Playwright test below therefore filters on **Done**.
10. Vitest list pages mock `@refinedev/core`'s `useList` by resource name (`CleaningJobFilterBar.test.tsx:6-17`), so a resource the mock does not know returns `[]` and the existing tests keep working.

## Decisions already made (do not reopen)

- **Multi-select, by status id**, exactly like Cleaning type: an empty list means no filter, several values are OR, different filters are AND. The database receives `p_cleaning_status_ids uuid[]`.
- **New argument name and position:** `p_cleaning_status_ids uuid[] default null`, right after `p_cleaning_type_ids`. Web field name `cleaningStatusIds`.
- **Filter in the same place as the others:** inside the `ranked` CTE's `where` of `get_cleaning_jobs`, as `j.cleaning_status_id = any (p_cleaning_status_ids)`. No change to the returned columns, the sorts or the paging.
- **Panel position and chip order:** Status sits right after Company (this mirrors the table, where Status follows Company). It is a panel filter, so it counts in the badge. Its chip text is `Status: <name>`.
- **Option order:** by name (the same helper as the other lists). The table has no sort order column, so Booked, Confirmed, Done, In Progress is the order shown. See open question 1.
- **Option labels are plain text**, not coloured pills.
- **Migration file** `0036_cleaning_job_status_filter.sql`; pgTAP file `get_cleaning_jobs_status.test.sql` (a new file, so the existing files are not touched).
- **Branch** is cut from the current branch `feat/T3C-R36-Refactor-Codebase`, because the feature folders only exist there. See open question 2.
- This is **not a major architectural change** (one more filter on an existing function), so there is no new `docs/architecture/NNNN` file; the existing file 0004 gets one sentence (Step 11).

### Open questions (do not block)

1. If the owner wants the statuses in life-cycle order (Booked, Confirmed, In Progress, Done) in the panel, `cleaning_statuses` needs a sort column; that is a separate ticket.
2. The branch is based on `feat/T3C-R36-Refactor-Codebase`. If that branch is merged first, retarget the PR to `feat/supabase-refine-starter` (or whichever is then the main branch).
3. The status filter is not kept in the URL, like the other filters (open question 3 of T3C-F35).

## Out of scope

- A status filter anywhere other than the Cleaning Jobs list; changes to the cleaning statuses CRUD screens.
- Sorting by status (the sort keys stay `schedule`, `client`, `cleaning_type`, `rating`).
- Reordering the statuses; coloured option labels; keeping filters in the URL.
- `README.md`, `AGENTS.md`, `CleaningJobList.tsx`, `hooks.ts`, the seed and `accessControlProvider.ts`.
- Fixing any baseline failure other than by `pnpm db:reset` (Fact 8).

## Steps

Working directory for every command: the repo root (`dispatch-tracker`).

**Reading the edits.** A "Find" text is the exact text in the file, including its leading spaces. The code blocks under a numbered item are indented 3 columns so Markdown keeps them inside the item; remove those 3 leading spaces when you paste them into the file. Do not run Prettier on this plan file (it would reindent the code blocks); run it only on the source files you edit.

### Phase 1: database

#### Step 0. Branch and baseline

```bash
git status --short && git branch --show-current && git switch -c feat/T3C-F37-Cleaning-Status-Filter && ls supabase/migrations | tail -4
```

**Gate:** the command above.
**Expect:** nothing from `git status --short`, then `feat/T3C-R36-Refactor-Codebase`, then a switch message, then the last four migrations `0028_cleaning_job_rpc.sql`, `0029_color_motifs.sql`, `0031_cleaning_job_areas.sql`, `0032_cleaning_job_items.sql`. If the tree is not clean, the branch is different, or a `0036_*` file exists, stop and report. Make sure Docker is running and the stack is up (`pnpm db:start`).

#### Step 1. Migration (create file)

Create `supabase/migrations/0036_cleaning_job_status_filter.sql` with exactly this content (it is `0029`'s `get_cleaning_jobs` with one new argument and one new `where` line; those, the header comment and the signature in the drop, revoke and grant lines are the only differences):

```sql
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
```

Then reset the database, which applies the migration, runs the seeds and regenerates `src/types/database.types.ts`:

```bash
pnpm db:reset
```

**Gate:** `git status --short && grep -c "p_cleaning_status_ids" src/types/database.types.ts`
**Expect:** two lines, `?? supabase/migrations/0036_cleaning_job_status_filter.sql` and ` M src/types/database.types.ts`, then `1`. `git diff src/types/database.types.ts` must show only `"p_cleaning_status_ids"?: (string)[]` added inside the `get_cleaning_jobs` `Args`. Any other change in that file: stop and report.

#### Step 2. pgTAP test (create file)

Create `supabase/tests/database/get_cleaning_jobs_status.test.sql` with exactly this content:

```sql
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
```

**Gate:** `pnpm test:db`
**Expect:** `Result: PASS`, 32 files (31 before this plan plus the new one) and 477 tests (469 plus the 8 above). If `seed.test.sql` fails, see Fact 8 and stop. If a new test fails, stop and report.

#### Step 3. Phase 1 commits

Only when asked to commit: commits 1 to 3 in "Conventional commits".

### Phase 2: web

#### Step 4. Edit `src/features/cleaning-jobs/api.ts`

Four edits. Each Find text appears once in the file.

1. Find:
   ```ts
     cleaningTypeIds: string[]
     feedbackSearch: string
   ```
   Replace with:
   ```ts
     cleaningTypeIds: string[]
     cleaningStatusIds: string[]
     feedbackSearch: string
   ```
2. Find:
   ```ts
     cleaningTypeIds: [],
     feedbackSearch: '',
   ```
   Replace with:
   ```ts
     cleaningTypeIds: [],
     cleaningStatusIds: [],
     feedbackSearch: '',
   ```
3. Find: `    filters.cleaningTypeIds.length > 0 ||`
   Replace with:
   ```ts
       filters.cleaningTypeIds.length > 0 ||
       filters.cleaningStatusIds.length > 0 ||
   ```
4. Find: `    p_cleaning_type_ids: filters.cleaningTypeIds.length > 0 ? filters.cleaningTypeIds : undefined,`
   Replace with:
   ```ts
       p_cleaning_type_ids: filters.cleaningTypeIds.length > 0 ? filters.cleaningTypeIds : undefined,
       p_cleaning_status_ids:
         filters.cleaningStatusIds.length > 0 ? filters.cleaningStatusIds : undefined,
   ```

#### Step 5. Edit `src/features/cleaning-jobs/filterChips.ts`

Four edits.

1. Find `  cleaningTypes: ReadonlyMap<string, string>` Replace with:
   ```ts
     cleaningStatuses: ReadonlyMap<string, string>
     cleaningTypes: ReadonlyMap<string, string>
   ```
2. Find `type IdFilterKey = 'cleanerIds' | 'companyIds' | 'clientIds' | 'cleaningTypeIds'` Replace with:
   ```ts
   type IdFilterKey =
     | 'cleanerIds'
     | 'companyIds'
     | 'cleaningStatusIds'
     | 'clientIds'
     | 'cleaningTypeIds'
   ```
3. Find `  { field: 'companyIds', title: 'Company', lookup: 'companies' },` Replace with:
   ```ts
     { field: 'companyIds', title: 'Company', lookup: 'companies' },
     { field: 'cleaningStatusIds', title: 'Status', lookup: 'cleaningStatuses' },
   ```
4. Find `    filters.companyIds,` (inside `countPanelFilters`) Replace with:
   ```ts
       filters.companyIds,
       filters.cleaningStatusIds,
   ```

#### Step 6. Edit `src/features/cleaning-jobs/components/CleaningJobFilterBar.tsx`

Six edits.

1. Find `import type { Cleaner, CleaningType, Client, Company } from '@/types/db'`
   Replace with `import type { Cleaner, CleaningStatus, CleaningType, Client, Company } from '@/types/db'`
2. Find `  field: 'cleanerIds' | 'companyIds' | 'clientIds' | 'cleaningTypeIds'`
   Replace with `  field: 'cleanerIds' | 'companyIds' | 'cleaningStatusIds' | 'clientIds' | 'cleaningTypeIds'`
3. Find:
   ```tsx
     const { result: typeRows } = useList<CleaningType>({
       resource: 'cleaning_types',
       pagination: { mode: 'off' },
     })
   ```
   Replace with that same block followed by:
   ```tsx
     const { result: statusRows } = useList<CleaningStatus>({
       resource: 'cleaning_statuses',
       pagination: { mode: 'off' },
     })
   ```
4. Find `  const companies = toOptions(companyRows.data, (c) => c.name)` Replace with:
   ```tsx
     const companies = toOptions(companyRows.data, (c) => c.name)
     const cleaningStatuses = toOptions(statusRows.data, (s) => s.name)
   ```
5. Find `    companies: toLookup(companies),` Replace with:
   ```tsx
       companies: toLookup(companies),
       cleaningStatuses: toLookup(cleaningStatuses),
   ```
6. Find:
   ```tsx
         options: companies,
       },
       {
         key: 'client',
   ```
   Replace with:
   ```tsx
         options: companies,
       },
       {
         key: 'status',
         field: 'cleaningStatusIds',
         label: 'Status',
         placeholder: 'Any status',
         options: cleaningStatuses,
       },
       {
         key: 'client',
   ```

#### Step 7. Edit `src/features/cleaning-jobs/api.test.ts`

Four edits.

1. Find:
   ```ts
         p_cleaning_type_ids: undefined,
         p_feedback_search: undefined,
   ```
   Replace with:
   ```ts
         p_cleaning_type_ids: undefined,
         p_cleaning_status_ids: undefined,
         p_feedback_search: undefined,
   ```
2. Find:
   ```ts
             cleaningTypeIds: ['t1'],
             feedbackSearch: ' oven ',
   ```
   Replace with:
   ```ts
             cleaningTypeIds: ['t1'],
             cleaningStatusIds: ['s1'],
             feedbackSearch: ' oven ',
   ```
3. Find:
   ```ts
         p_cleaning_type_ids: ['t1'],
         p_feedback_search: ' oven ',
   ```
   Replace with:
   ```ts
         p_cleaning_type_ids: ['t1'],
         p_cleaning_status_ids: ['s1'],
         p_feedback_search: ' oven ',
   ```
4. Find `    expect(hasActiveFilters({ ...EMPTY_FILTERS, cleanerIds: ['k1'] })).toBe(true)`
   Replace with:
   ```ts
       expect(hasActiveFilters({ ...EMPTY_FILTERS, cleanerIds: ['k1'] })).toBe(true)
       expect(hasActiveFilters({ ...EMPTY_FILTERS, cleaningStatusIds: ['s1'] })).toBe(true)
   ```

#### Step 8. Edit `src/features/cleaning-jobs/filterChips.test.ts`

Four edits.

1. Find `  cleaningTypes: new Map([['t-1', 'Deep clean']]),`
   Replace with:
   ```ts
     cleaningStatuses: new Map([['s-1', 'Booked']]),
     cleaningTypes: new Map([['t-1', 'Deep clean']]),
   ```
2. Find:
   ```ts
           companyIds: ['co-1'],
           clientIds: ['c-1', 'c-2'],
   ```
   Replace with:
   ```ts
           companyIds: ['co-1'],
           cleaningStatusIds: ['s-1'],
           clientIds: ['c-1', 'c-2'],
   ```
3. Find:
   ```ts
         'Company: Acme',
         'Client: Xavier',
   ```
   Replace with:
   ```ts
         'Company: Acme',
         'Status: Booked',
         'Client: Xavier',
   ```
4. Find:
   ```ts
           clientIds: ['c-1', 'c-2'],
           ratings: [3],
           dateRange: 'current_week',
           feedbackSearch: 'late',
         }),
       ).toBe(2)
   ```
   Replace with:
   ```ts
           clientIds: ['c-1', 'c-2'],
           cleaningStatusIds: ['s-1', 's-2'],
           ratings: [3],
           dateRange: 'current_week',
           feedbackSearch: 'late',
         }),
       ).toBe(3)
   ```

#### Step 9. Edit `src/features/cleaning-jobs/components/CleaningJobFilterBar.test.tsx`

Three edits.

1. Find `  cleaning_types: [{ id: 't1', name: 'Deep' }],`
   Replace with:
   ```tsx
     cleaning_statuses: [
       { id: 's1', name: 'Done' },
       { id: 's2', name: 'Booked' },
     ],
     cleaning_types: [{ id: 't1', name: 'Deep' }],
   ```
2. Find `    expect(screen.getByText('Any cleaning type')).toBeInTheDocument()`
   Replace with:
   ```tsx
       expect(screen.getByText('Any cleaning type')).toBeInTheDocument()
       expect(screen.getByText('Any status')).toBeInTheDocument()
   ```
3. Find `  it('clears every filter at once', async () => {` Replace with:
   ```tsx
     it('lists the statuses by name and tags the chosen one', async () => {
       const onChange = setup({ ...EMPTY_FILTERS, cleaningStatusIds: ['s2'] })
       expect(screen.getByText('Status: Booked')).toBeInTheDocument()
       await userEvent.click(screen.getByRole('button', { name: 'Remove Status: Booked' }))
       expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS)
     })

     it('clears every filter at once', async () => {
   ```

**Gate (Steps 4 to 9):** `pnpm typecheck && pnpm lint && pnpm format:check && pnpm vitest run`
**Expect:** typecheck and lint exit 0; `format:check` ends `All matched files use Prettier code style!` (if it names a file you edited, run `npx prettier --write <that file>` and run the gate again; it must name no file you did not edit); Vitest ends with `Test Files  23 passed (23)` and `Tests  148 passed (148)` (147 before, plus the one new test). Typecheck fails until all of Steps 4 to 9 are done, because the tests build `CleaningJobFilters` objects; do not run it earlier.

#### Step 10. Playwright test: edit `e2e/cleaning-jobs.spec.ts`

Find:
```ts
  test('shows an empty state when nothing matches and a way back', async ({ page }) => {
```
Replace with (the new test, then the original line):
```ts
  test('filters by status and clears it', async ({ page }) => {
    await signIn(page, 'user@example.com', 'user-password-123')
    await openCleaningJobs(page)

    await page.getByRole('button', { name: 'Filters' }).click()
    const status = page.getByRole('combobox', { name: 'Status' })
    await status.click()
    await page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
      .getByText('Done', { exact: true })
      .click()
    const filters = page.getByRole('group', { name: 'Active filters' })
    await expect(filters.getByText('Status: Done')).toBeVisible()
    // Every row that is left is Done (column 2 is Status, see the header test).
    await expect(dataRows(page).first()).toBeVisible()
    const rows = await dataRows(page).count()
    for (let i = 0; i < rows; i++) {
      await expect(dataRows(page).nth(i).locator('td').nth(2)).toHaveText('Done')
    }

    await filters.getByRole('button', { name: 'Clear all' }).click()
    await expect(filters).toHaveCount(0)
    await expect(dataRows(page)).toHaveCount(10)
  })

  test('shows an empty state when nothing matches and a way back', async ({ page }) => {
```

**Gate:** `pnpm exec playwright test e2e/cleaning-jobs.spec.ts`
**Expect:** all tests in the file pass, including the new one (9 tests in the file after this change, 8 before). Playwright starts its own dev server per `playwright.config.ts`. If `getByRole('combobox', { name: 'Status' })` finds no element or two, stop and report the accessible names you see.

### Phase 3: docs

#### Step 11. Edit `docs/architecture/0004-Cleaning-Jobs-List-Function.md`

Find:
```
- `get_cleaning_jobs` takes the filters (cleaner, company, client, cleaning type, feedback text,
  rating, date range), the sort
```
Replace with:
```
- `get_cleaning_jobs` takes the filters (cleaner, company, client, cleaning type, cleaning status,
  feedback text, rating, date range), the sort
```
If the find text does not match exactly (line wrapping), **stop and report**; do not rewrap the file.

**Gate (whole plan):** `pnpm test:all`
**Expect:** every stage passes: lint, typecheck, Vitest (23 files, 148 tests), pgTAP (`Result: PASS`, 32 files, 477 tests), Deno function tests, Playwright (the 21 tests counted in T3C-R36 plus 1 new).

## Rollback

Nothing is deployed by this plan. To undo locally before the branch is merged: `git switch feat/T3C-R36-Refactor-Codebase && git branch -D feat/T3C-F37-Cleaning-Status-Filter && pnpm db:reset` (the reset drops migration `0036` from the local database and regenerates `database.types.ts`). If `0036` has been applied to a shared database, do not edit it: add a later migration that drops the new function and recreates the `0029` version, with the grants.

## Conventional commits

Branch: `feat/T3C-F37-Cleaning-Status-Filter`. Stage explicit paths only. Every commit ends with the footer lines:

```
Refs: T3C-F37
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `docs(plans): add the T3C-F37 plan`. Stage: `.claude/plans/T3C-F37-Cleaning-Jobs-Status-Filter.md` (skip if the plan is already committed).
2. `feat(db): add a cleaning status filter to get_cleaning_jobs` (after Step 1's gate). Stage: `supabase/migrations/0036_cleaning_job_status_filter.sql`, `src/types/database.types.ts`. Body: the function gains `p_cleaning_status_ids`; it is dropped and recreated because its signature changes.
3. `test(db): cover the cleaning status filter` (after Step 2's gate). Stage: `supabase/tests/database/get_cleaning_jobs_status.test.sql`.
4. `feat(web): add a Status filter to the Cleaning Jobs list` (after Step 9's gate). Stage: `src/features/cleaning-jobs/api.ts`, `src/features/cleaning-jobs/filterChips.ts`, `src/features/cleaning-jobs/components/CleaningJobFilterBar.tsx`, `src/features/cleaning-jobs/api.test.ts`, `src/features/cleaning-jobs/filterChips.test.ts`, `src/features/cleaning-jobs/components/CleaningJobFilterBar.test.tsx`. Code and its unit tests are one commit because the existing tests fail without the test edits and no commit may leave the suites red.
5. `test(e2e): cover the Cleaning Jobs status filter` (after Step 10's gate). Stage: `e2e/cleaning-jobs.spec.ts`.
6. `docs(db): add the status filter to the list function doc` (after Step 11). Stage: `docs/architecture/0004-Cleaning-Jobs-List-Function.md`.

PR title: `feat(web): add a Status filter to the Cleaning Jobs list` (base: see open question 2). Body from `.github/pull_request_template.md` if it exists, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
