# T3C-F35 Cleaning Jobs list page, time zone setting and cleaning job functions

> **Status: PENDING REVIEW.** Not approved for implementation until the owner removes this line.
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

Source: owner request in conversation (2026-11-27), not in the sprint sheet. Ticket id `T3C-F35` was chosen by the owner (the highest id used so far is `T3C-S34`).

- Story: "As a dispatcher, I want a Cleaning Jobs sidebar item that lists every cleaning job, so that I can see who is attending, where, when and what happened, and find a job by filtering and sorting."
- Acceptance:
  - Sidebar item **Cleaning Jobs** opens a list of all cleaning jobs with the columns Assignee, Company, Status, Scheduled Date, Client Name, Address, Cleaning Type, Notes, Feedback, Rating, Rate.
  - Scheduled Date is stored as `timestamptz` (already true, see Fact 8) and displayed in the time zone the user chose.
  - The Cleaning Jobs screen has a setting where the user chooses the display time zone. The default is Edmonton, Canada (`America/Edmonton`). The user can switch to their own device time zone.
  - New column `profiles.preferred_time_zone` stores the choice. Owner decision (2026-11-27): the value is an **IANA time zone name** such as `America/Edmonton`.
  - Rating is shown as stars.
  - When a job has more than one feedback, the Feedback column shows a button that opens a modal listing all of them.
  - Filters for: cleaner, company, client, cleaning type, feedback, rating.
  - A scheduled date filter with the choices: next month, current week, current month, last 3 months, last 6 months, or a custom date range picked with the Ant Design `RangePicker`. The ranges are worked out in the user's chosen time zone.
  - Sorting on: scheduled date, client, cleaning type, rating.
  - RPC function `get_complete_address_for_property_id` returns the complete address for a property id.
  - RPC function `get_cleaners_for_cleaning_job_id` returns the cleaners assigned to a cleaning job.
  - RPC function `get_client_feedbacks_for_cleaning_job_id` returns the feedback left for a cleaning job, newest first. The list function uses it to build the feedback of each row.
  - `cleaning_jobs` and `cleaning_feedbacks` both get a `created_at timestamptz not null default now()` column (added to the T3C-B15 and T3C-B19 plans and migrations, not to this plan).
  - Every database function the web page calls has an equivalent React hook built on React Query (`useCleaningJobs`, `useCompleteAddress`, `useCleanersForCleaningJob`, `useClientFeedbacks`), so the requests are cached and shared. Components never call `supabase.rpc` or `useQuery` directly.
  - RPC function `get_cleaning_jobs` (added for performance, see "Performance") returns one filtered, sorted, counted page of the list in a single call (first drafted as `list_cleaning_jobs`; the owner renamed it on 2026-11-27).

## Performance

The server is small, so the page is designed to do little work per view:

1. **One request per page view.** The first draft of this plan called the two helper functions once per row (up to 20 extra requests for a 10 row page). Each request pays for the HTTP hop, JWT check, role switch and RLS check. `get_cleaning_jobs` returns the page with the address, cleaners, cleaning types and feedbacks already included, and the two helper functions are called inside it, only for the rows of the page.
2. **Filtering, sorting and paging happen in the database.** PostgREST cannot sort a job by a to-many value (its cleaning types, its average rating), and fetching every job to sort it in the browser would not scale. The function ranks the matching jobs with `row_number()`, keeps one page, and computes the display columns only for that page.
3. **Count without a second query.** `count(*) over ()` returns the total with the page.
4. **Sort values are computed only for the chosen sort.** Each sort is a `CASE` branch, so the cleaning type and rating sub-queries run only when that column is the active sort. The default sort (schedule) reads one indexed column.
5. **Indexes already exist** for every filter, and the date range is a plain `schedule >= from and schedule < to` test on the indexed column (no function is applied to `schedule`, so the index stays usable): `cleaning_jobs(client_id)`, `cleaning_jobs(schedule)`, `clients(company_id)`, `cleaning_job_assignments(cleaner_id)` and the unique pair `(cleaning_job_id, cleaner_id)`, `cleaning_job_cleaning_types(cleaning_type_id)` and its unique pair, `cleaning_feedbacks(cleaning_job_id)`. No new index is added.
6. **Page size is capped at 100** inside the function; the page offers 10, 25 and 50.
7. **Measured (local stack, 2026-11-27, superuser so RLS cost is not included):** with 30,030 jobs, 2,000 clients and 15,000 feedbacks, one page took about 15 ms sorted by schedule, 47 ms by rating, 114 ms by cleaning type and 12 ms with a feedback search. The cost grows with the number of matching jobs, not with the page size. If the table reaches hundreds of thousands of jobs, the sorts on cleaning type and rating are the first to slow down (see open question 3).
8. **Caching with React Query.** Each function has one hook in `src/features/cleaning-jobs/hooks.ts`. A result is kept for 5 minutes (React Query's default) and is treated as fresh for 30 seconds: going back to a page, filter or sort you already looked at, or reopening a feedback modal, shows the cached data at once and makes no new request while it is fresh; after 30 seconds it shows the cached data and refreshes it in the background. The list keeps the previous page on screen while the next one loads. Two components that ask for the same job or property share one request. The cache key includes every argument (filters, sort, page, page size, time zone), so a different argument is a different cache entry.
9. **Browser side:** the four filter lists (cleaners, companies, clients, cleaning types) are fetched once each when the page opens (Refine's own React Query cache). The feedback search runs only when the user presses Enter or the search icon, so it does not call the database on every key.

## Facts (verified 2026-11-27)

1. Branch is `main`. Migrations are numbered `NNNN_name.sql`. This plan adds `supabase/migrations/0027_profiles_preferred_time_zone.sql` and `supabase/migrations/0028_cleaning_job_rpc.sql`, so migrations up to `0026` must already exist. The later table plans (T3C-B17, B26, B27, B28-29, B30, S31, B32) were renumbered to `0029` to `0034` to follow this plan.
2. Required earlier migrations (plan that creates each): `0001_init.sql` (profiles); `0003_roles.sql` and `0004_app_permissions.sql` (T3C-B0); `0006_companies.sql` (T3C-B7-S8); `0007_clients.sql` (T3C-B6); `0009_cleaners.sql` (T3C-B9); `0011_cleaning_types.sql` and `0012_cleaning_statuses.sql` (T3C-B11-S12, T3C-B13-S14); `0019_properties.sql` (T3C-B21); `0022_cleaning_jobs.sql` (T3C-B15, with `created_at`); `0024_cleaning_job_assignments.sql` (T3C-B18); `0025_cleaning_feedbacks.sql` (T3C-B19; it must include `created_at`, see the T3C-B19 plan); `0026_cleaning_job_cleaning_types.sql` (T3C-B33). If any is missing, **stop and report**.
3. `public.profiles` (`0001_init.sql`) has `id`, `display_name`, `created_at` and `role_id` (from `0003`). Users can only update the columns they are granted: `grant update (display_name) on public.profiles to authenticated`. The policies `profiles_select_own` and `profiles_update_own` limit a user to their own row. `grant select on public.profiles to authenticated` is table wide, so a new column is readable without a new grant.
4. Function pattern (`0002_todo_stats.sql`): `language sql`, `stable`, `security invoker`, `set search_path = public`, then `revoke execute ... from public, anon` and `grant execute ... to authenticated`. The web side calls such a function through a helper that takes the client as an argument (`fetchTodoStats` in `src/features/integration/api.ts`) and is tested with a mocked `rpc`.
5. `src/App.tsx` holds the `resources` array (the sidebar is built from each resource's `meta.label` and `meta.icon`; the last entry today is `items`), the icon import block from `@ant-design/icons` (the last icon today is `ToolOutlined`), the page imports (the last one before `UserList` is `ItemEdit`) and the `<Routes>` block (the `/items` route is the last before `/users`).
6. `useList` (from `@refinedev/core`) with `pagination: { mode: 'off' }` loads a whole resource, as `src/pages/company-cleaners/CompanyCleanerList.tsx` does. Row types that are not plain tables live in `src/types/db.ts` (for example `UserRow`).
7. `@tanstack/react-query` (`^5.108.4`; `<Refine>` already provides the `QueryClientProvider` the hooks run under, which step 10 confirms in the browser) and `dayjs` (`^1.11.23`) are already direct dependencies. Dates are formatted with the browser's built-in `Intl.DateTimeFormat`; `dayjs` is used only to hand the custom range to the Ant Design `RangePicker`, which works with dayjs values. **No new dependency** is needed. `tsconfig.app.json` uses `lib: ["ES2023", "DOM"]`, which includes `Intl.supportedValuesOf`. The repo's ESLint rules forbid arrow functions that return a void expression and unnecessary conditions; the code below already follows them.
8. `cleaning_jobs.schedule` is `timestamptz not null` (T3C-B15). Postgres stores it in UTC and PostgREST returns it with an offset, so **no migration is needed for the storage requirement**; the page only formats it.
9. The local seed (`supabase/seed.sql`) already holds cleaning types (for example `Deep`) and the four cleaning statuses (`Booked` has id `10000000-0000-0000-0000-000000000001`). The pgTAP files below therefore use fixture names such as `Test Deep`, which do not collide with the seed.
10. `src/types/database.types.ts` is generated (`pnpm db:reset` regenerates it); never hand-edit it. It has no entry yet for `preferred_time_zone`, `get_complete_address_for_property_id`, `get_cleaners_for_cleaning_job_id` or `get_cleaning_jobs`.
11. How this plan was checked: on 2026-11-27 every file below was run in a scratch copy of the repo against the local stack: `pnpm db:reset`, `pnpm test:db` (26 files, 395 tests, `Result: PASS`), `pnpm typecheck`, `pnpm lint`, `npx prettier --check src` and `pnpm vitest run` (9 files, 75 tests). The page itself was **not** opened in a browser (step 10 is the manual check).
12. Time zone data: the Node/ICU tz data on the dev machine gave `America/Edmonton` an offset of UTC-6 on 2026-12-01, not the usual UTC-7. Because rules can change, the Vitest tests use `America/New_York`, `Australia/Sydney` and `UTC`, and never assert a specific Edmonton offset.

## Decisions already made (do not reopen)

- **Time zone standard (owner, 2026-11-27)**: IANA name, text, `not null default 'America/Edmonton'`. The database rejects names that Postgres does not know (`pg_timezone_names`), through the function `public.is_valid_time_zone(text)` used in a check constraint (a check constraint cannot hold a subquery).
- Users can change only their own `preferred_time_zone` (column grant plus the existing `profiles_update_own` policy). They still cannot write `role_id`.
- The time zone setting is a searchable select of the browser's IANA zones (plus `UTC`) and a button "Use my device time zone". It sits above the table and saves to the profile on change. Times are formatted with `Intl.DateTimeFormat` in the saved zone.
- **One list function.** `get_cleaning_jobs` does the filtering, sorting, paging, counting and returns every display column. The list page does not call `get_complete_address_for_property_id` or `get_cleaners_for_cleaning_job_id` for each row; the list function calls them. They stay as public functions because they were requested and are tested on their own, and each still has its React Query hook (`useCompleteAddress`, `useCleanersForCleaningJob`) for any screen that needs one job or property.
- **Filter rules.** An empty filter means no filter. Several values inside one filter are OR (any of these cleaners). Different filters are AND. Cleaner: the job has an assignment with one of the cleaners. Company: the job's client belongs to one of the companies. Client: the job's client is one of the clients. Cleaning type: the job has one of the types. Feedback: plain, case-insensitive substring of any feedback text of the job (`%` and `_` are ordinary characters). Rating: the job has at least one feedback with one of the chosen ratings (0 to 5).
- **Date range rules.** A new filter on the job's scheduled date, sent to the database as `p_date_range` (null for "All dates", the default) plus `p_time_zone` (the user's saved zone, so "today" and "this week" match the Scheduled Date column) and, for `custom` only, `p_date_from` and `p_date_to` (calendar days). Every range is half open (from inclusive, to exclusive) and combines with the other filters by AND:
  - `next_month`: the 1st of next month 00:00 to the 1st of the month after 00:00 (listed right after "All dates" in the choices).
  - `current_week`: Monday 00:00 to the next Monday 00:00 (weeks start on Monday).
  - `current_month`: the 1st 00:00 to the 1st of the next month 00:00.
  - `last_3_months` and `last_6_months`: 00:00 of the day 3 (or 6) months ago up to the end of today. Future jobs are not included.
  - `custom`: `p_date_from` 00:00 to the end of `p_date_to` (the end day is included). Either date may be empty (open ended); both empty means no filter. A start after the end raises `22023`.
  - An unknown range or an unknown time zone raises `22023`.
  - On the page the date range is a row of one-click buttons (see the Filter screen rule); choosing Custom range shows the Ant Design `DatePicker.RangePicker` (either end may stay empty). Changing the choice clears the custom dates and returns to page 1. The page waits for the saved time zone to load before its first request, so it does not fetch twice.
- **Sort rules.** Sort keys are `schedule`, `client`, `cleaning_type`, `rating`; direction `asc` or `desc`. `client` sorts by name ignoring case. `cleaning_type` sorts by the job's type names joined with `, ` in alphabetical order. `rating` sorts by the average rating. Jobs with no value for the sort sort last in both directions. Ties fall back to newest schedule, then id, so paging is stable. Any other key (including `feedback`: the owner removed the feedback sort on 2026-11-27) or direction raises error `22023`. Default sort is `schedule` descending.
- **Column rules.** Assignee = the job's cleaners as tags (or "Unassigned"). Company = the job client's company (owner confirmed 2026-11-27). Status = `cleaning_statuses.name`. Scheduled Date in the saved zone. Client Name. Address = `concat_ws(', ', address_line_1, address_line_2, city, province_state, postal_code, country_code)`, skipping a blank line 2. Cleaning Type = tags. Notes = `cleaning_jobs.description` (owner confirmed 2026-11-27). Rate = `cleaning_jobs.rate` in Canadian dollars (owner confirmed 2026-11-27), formatted with `Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' })`, column title `Rate (CAD)`.
- **Structure (owner, 2026-11-27).** `src/pages/cleaning-jobs/` holds only `CleaningJobList.tsx`. The filter bar, the feedback modal and the time zone picker live in `src/components/cleaning-jobs/`. Data access, hooks and pure helpers live in `src/features/cleaning-jobs/`.
- **Filter screen (owner, 2026-11-27).** A compact main row: a "Scheduled" label with a one-click `Segmented` control (All dates, Current week, Current month, Last 3 months, Last 6 months, Custom range; the range picker shows only for Custom range), the feedback search (press Enter) and a "Filters" button with a badge counting the panel filters in use. The button opens an inline panel with labelled fields: Cleaner, Company, Client, Cleaning type and Rating (stars and text, 5 down to 0). Below the row, every active filter shows as a removable tag (for example "Client: Xavier", "Rating: 4 stars", "Scheduled: Last 3 months") with a "Clear all" link. When filters are on and nothing matches, the table says "No jobs match these filters" with a "Clear filters" button. The tag text comes from the pure helper `buildFilterChips` in `filterChips.ts`. The filter state shape and meaning are unchanged.
- **Hooks (owner, 2026-11-27).** One hook per database function the web calls, each in `src/features/cleaning-jobs/hooks.ts` and each a thin `useQuery` over a fetcher in `api.ts` (the fetcher takes the Supabase client, as in `fetchTodoStats`). Query keys come from `cleaningJobKeys` (`['cleaning-jobs', 'list' | 'address' | 'cleaners' | 'feedbacks', ...arguments]`). `staleTime` is 30 seconds for all four; the id based hooks stay idle until given an id (`enabled`); `useCleaningJobs` also takes an `enabled` flag and uses `placeholderData: keepPreviousData`. Retries, `gcTime` and refetch on focus keep React Query's defaults. `is_valid_time_zone` is a database helper used by a check constraint and by `get_cleaning_jobs`; the web never calls it, so it has no hook. There are no mutations here, so nothing invalidates the cache; saving the time zone changes the key of the list, which loads the right data.
- **Feedback function.** `get_client_feedbacks_for_cleaning_job_id(p_cleaning_job_id)` returns `id`, `rating`, `feedback`, `created_at` for the job, newest first, and no rows for an unknown job. `get_cleaning_jobs` calls it to fill each row's `feedbacks` list (each item has `rating`, `feedback`, `created_at`), the same way it uses the address and cleaners functions; the list reads that list for the Feedback and Rating columns. The modal does not reuse it: it calls `useClientFeedbacks(job.id)` so it always shows the full, current set, and the result is cached per job (opening the modal costs one small request the first time and none while the cached result is fresh). The rating average, the rating filter and the feedback search read `cleaning_feedbacks` directly in the same query.
- **Feedback and Rating columns.** No feedback: `-` in both. One feedback: its text and its stars. More than one feedback: the Feedback column shows a button "View all (N)" that opens a modal listing every feedback, newest first, with its stars and the date it was left (shown in the saved time zone); the Rating column shows the average as half-star stars and the text "avg of N". Stars are the ant design `Rate` component, read only. Rating 0 shows five empty stars.
- All functions are `security invoker` (RLS still applies), executable by `authenticated` only. The address function returns null and the cleaners function returns no rows for an unknown id.
- The list is read only: `List` with `canCreate={false}`, a resource with only `list`, no create, edit or delete pages. No change to `accessControlProvider.ts`.
- Page state (filters, sort, page, page size) lives in the component, not in the URL. No live updates on this page.
- **No** Playwright e2e spec and **no** component test for the page in this plan.

### Open questions (do not block)

1. If the jobs table grows into the hundreds of thousands, add a stored average rating on `cleaning_jobs` (or a materialized summary) so the rating and cleaning type sorts stop recalculating per job.
2. The browser's zone list and Postgres's list can differ for very new zone names. If Postgres rejects a pick, the save fails with the database error and the select keeps the old value.
3. Filters, including the date range, are not kept in the URL, so a page refresh clears them.
4. Weeks start on Monday (Postgres's ISO week). If the business week starts on Sunday, say so and the `current_week` branch changes.
5. The default choice is "All dates". It can default to "Current month" instead if that is how the list is mostly used.

Resolved by the owner on 2026-11-27: a job can have several feedbacks and `created_at` orders them (newest first); there is no feedback sort; migrations are numbered `0027` and `0028`; Company is the client's company; Notes is `cleaning_jobs.description`; rate is in CAD.

## Out of scope

- Create, edit and delete pages for cleaning jobs.
- UI for the other cleaning tables.
- Playwright e2e specs and Vitest component tests.
- Changes to `accessControlProvider.ts`, `authProvider.ts` and the dashboard.
- The role model; loading data into SIT or production.
- `README.md` and `AGENTS.md` edits.

## Steps

Working directory for every command: the repo root (`dispatch-tracker`).

### Step 0. Branch and baseline

```bash
git status --short && git switch -c feat/T3C-F35-Cleaning-Jobs-List && pnpm db:start
```

**Gate:** `git branch --show-current && ls supabase/migrations`
**Expect:** `feat/T3C-F35-Cleaning-Jobs-List`, then a migration list that includes `0022_cleaning_jobs.sql`, `0024_cleaning_job_assignments.sql`, `0025_cleaning_feedbacks.sql` and `0026_cleaning_job_cleaning_types.sql` and ends at `0026_cleaning_job_cleaning_types.sql`. If `git status --short` printed anything before the switch, or the list is different, stop and report.

### Step 1. Migration: profiles.preferred_time_zone (create file)

Create `supabase/migrations/0027_profiles_preferred_time_zone.sql` with exactly this content:

```sql
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
```

### Step 2. Migration: the three functions (create file)

Create `supabase/migrations/0028_cleaning_job_rpc.sql` with exactly this content:

```sql
-- 0028_cleaning_job_rpc: the functions behind the Cleaning Jobs list.

-- One line address built from the property's fields. Null when the property does not exist or
-- the caller cannot read it. security invoker: RLS on properties still applies.
create or replace function public.get_complete_address_for_property_id(p_property_id uuid)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select concat_ws(', ',
    p.address_line_1,
    nullif(trim(p.address_line_2), ''),
    p.city,
    p.province_state,
    p.postal_code,
    p.country_code)
  from public.properties p
  where p.id = p_property_id;
$$;

-- The cleaners assigned to a job, ordered by last name then first name. security invoker: RLS on
-- cleaning_job_assignments and cleaners still applies.
create or replace function public.get_cleaners_for_cleaning_job_id(p_cleaning_job_id uuid)
returns table (cleaner_id uuid, full_name text)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id,
         concat_ws(' ', c.first_name, nullif(trim(c.middle_name), ''), c.last_name)
  from public.cleaning_job_assignments a
  join public.cleaners c on c.id = a.cleaner_id
  where a.cleaning_job_id = p_cleaning_job_id
  order by c.last_name, c.first_name;
$$;

-- The feedback left for a job, newest first. security invoker: RLS on cleaning_feedbacks still
-- applies. Returns no rows for an unknown job.
create or replace function public.get_client_feedbacks_for_cleaning_job_id(p_cleaning_job_id uuid)
returns table (id uuid, rating integer, feedback text, created_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select f.id, f.rating, f.feedback, f.created_at
  from public.cleaning_feedbacks f
  where f.cleaning_job_id = p_cleaning_job_id
  order by f.created_at desc, f.id;
$$;

-- One page of the Cleaning Jobs list: filtered, sorted and counted on the server, with every
-- display column included, so the web page makes one call instead of one per row.
--   * An empty or null filter means "do not filter". Within one filter the values are OR (any of
--     these cleaners); different filters are AND.
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
-- security invoker: RLS on every table it reads still applies.
create or replace function public.get_cleaning_jobs(
  p_cleaner_ids       uuid[]  default null,
  p_company_ids       uuid[]  default null,
  p_client_ids        uuid[]  default null,
  p_cleaning_type_ids uuid[]  default null,
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
    public.get_complete_address_for_property_id(j.property_id),
    (select coalesce(jsonb_agg(jsonb_build_object('cleaner_id', g.cleaner_id, 'full_name', g.full_name)
                              order by g.full_name), '[]'::jsonb)
       from public.get_cleaners_for_cleaning_job_id(j.id) g),
    (select coalesce(jsonb_agg(ct.name order by ct.name), '[]'::jsonb)
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

revoke execute on function public.get_complete_address_for_property_id(uuid) from public, anon;
revoke execute on function public.get_cleaners_for_cleaning_job_id(uuid) from public, anon;
revoke execute on function public.get_client_feedbacks_for_cleaning_job_id(uuid) from public, anon;
grant  execute on function public.get_complete_address_for_property_id(uuid) to authenticated;
grant  execute on function public.get_cleaners_for_cleaning_job_id(uuid) to authenticated;
grant  execute on function public.get_client_feedbacks_for_cleaning_job_id(uuid) to authenticated;
revoke execute on function public.get_cleaning_jobs(uuid[], uuid[], uuid[], uuid[], text, integer[], text, date, date, text, text, text, integer, integer) from public, anon;
grant  execute on function public.get_cleaning_jobs(uuid[], uuid[], uuid[], uuid[], text, integer[], text, date, date, text, text, text, integer, integer) to authenticated;
```

### Step 3. pgTAP tests (create files)

Create `supabase/tests/database/preferred_time_zone.test.sql` with exactly this content:

```sql
-- pgTAP: profiles.preferred_time_zone. Default, validation, who can change it.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Fixed test identities. The whole file runs in one transaction and rolls back.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bob@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

select is(
  (select preferred_time_zone from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  'America/Edmonton',
  'a new profile defaults to America/Edmonton'
);

select ok(public.is_valid_time_zone('Australia/Sydney'), 'a real IANA name is valid');
select ok(not public.is_valid_time_zone('Mars/Olympus'), 'an unknown name is not valid');

-- Alice changes her own value.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);

select lives_ok(
  $$update public.profiles set preferred_time_zone = 'Australia/Sydney' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  'a user can change their own preferred_time_zone'
);

select throws_ok(
  $$update public.profiles set preferred_time_zone = 'Mars/Olympus' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '23514',
  null,
  'an unknown time zone is rejected'
);

-- A silent no-op: RLS hides Bob's row from Alice.
select lives_ok(
  $$update public.profiles set preferred_time_zone = 'UTC' where id = 'bbbbbbbb-0000-0000-0000-00000000000b'$$,
  'a user update of another profile is silently filtered by RLS'
);
reset role;

select is(
  (select preferred_time_zone from public.profiles where id = 'bbbbbbbb-0000-0000-0000-00000000000b'),
  'America/Edmonton',
  'the other user keeps their value'
);

select * from finish();
rollback;
```

Create `supabase/tests/database/cleaning_job_rpc.test.sql` with exactly this content:

```sql
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
```

Create `supabase/tests/database/get_cleaning_jobs.test.sql` with exactly this content:

```sql
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
```

Create `supabase/tests/database/get_cleaning_jobs_date_range.test.sql` with exactly this content:

```sql
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
```

### Step 4. Gate: database

```bash
pnpm db:reset && grep -c "preferred_time_zone\|get_complete_address_for_property_id\|get_cleaners_for_cleaning_job_id\|get_cleaning_jobs" src/types/database.types.ts
```

**Expect:** `db:reset` exits 0 with no SQL error and applies `0027_profiles_preferred_time_zone.sql` and `0028_cleaning_job_rpc.sql`; the `grep` prints a number greater than `0`.

```bash
pnpm test:db
```

**Expect:** every file reports `ok`, the summary ends with `Result: PASS`, `preferred_time_zone.test.sql` runs 7 tests, `cleaning_job_rpc.test.sql` runs 11 tests and `get_cleaning_jobs.test.sql` runs 19 tests and `get_cleaning_jobs_date_range.test.sql` runs 17 tests. If a test fails, stop and report; do not edit the test or the migration to make it pass.

### Step 5. Types (edit file)

In `src/types/db.ts`, find this line and add the block after it:

```ts
export type Item = Tables<'items'>
```

Add after it:

```ts
type PublicFunctions = PublicSchema['Functions']
export type JobCleaner = PublicFunctions['get_cleaners_for_cleaning_job_id']['Returns'][number]
// The generated type says feedback is always text; the column is optional, so it can be null.
export type ClientFeedback = Omit<
  PublicFunctions['get_client_feedbacks_for_cleaning_job_id']['Returns'][number],
  'feedback'
> & { feedback: string | null }
type CleaningJobListReturn = PublicFunctions['get_cleaning_jobs']['Returns'][number]
// The function returns the nested lists as jsonb; these are the shapes it builds.
export type CleaningJobListRow = Omit<
  CleaningJobListReturn,
  'cleaners' | 'cleaning_types' | 'feedbacks' | 'avg_rating'
> & {
  avg_rating: number | null
  cleaners: { cleaner_id: string; full_name: string }[]
  cleaning_types: string[]
  feedbacks: { rating: number; feedback: string | null; created_at: string }[]
}
```

**Gate:** `grep -c "export type CleaningJobListRow\|export type JobCleaner\|export type ClientFeedback" src/types/db.ts`
**Expect:** `3`. Anything else: stop and report.

### Step 6. Feature files (create files)

Create `src/features/cleaning-jobs/timeZone.ts` with exactly this content:

```ts
// Same default as profiles.preferred_time_zone (supabase/migrations/0027_profiles_preferred_time_zone.sql).
export const DEFAULT_TIME_ZONE = 'America/Edmonton'

/** The time zone of the browser the user is on, as an IANA name. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** Every IANA time zone the browser knows, plus UTC, sorted. */
export function listTimeZones(): string[] {
  return [...new Set([...Intl.supportedValuesOf('timeZone'), 'UTC'])].sort()
}

/** Formats a timestamptz string (any offset) as a wall-clock time in the given IANA zone. */
export function formatSchedule(schedule: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(schedule))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? ''
  return `${part('weekday')} ${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')} ${part('dayPeriod')}`
}
```

Create `src/features/cleaning-jobs/api.ts` with exactly this content:

```ts
// Data access for the Cleaning Jobs list. Takes the client as an argument so tests can pass a mock.
import type { AppSupabaseClient } from '@/features/integration/api'
import type { CleaningJobListRow, ClientFeedback, JobCleaner } from '@/types/db'

export type CleaningJobSortKey = 'schedule' | 'client' | 'cleaning_type' | 'rating'
type SortDirection = 'asc' | 'desc'
export type DateRangeKey =
  | 'all'
  | 'next_month'
  | 'current_week'
  | 'current_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'custom'

export const DATE_RANGE_LABELS: Record<DateRangeKey, string> = {
  all: 'All dates',
  next_month: 'Next month',
  current_week: 'Current week',
  current_month: 'Current month',
  last_3_months: 'Last 3 months',
  last_6_months: 'Last 6 months',
  custom: 'Custom range',
}

export interface CleaningJobFilters {
  cleanerIds: string[]
  companyIds: string[]
  clientIds: string[]
  cleaningTypeIds: string[]
  feedbackSearch: string
  ratings: number[]
  dateRange: DateRangeKey
  /** Custom range only. Calendar days as YYYY-MM-DD, read in the user's time zone. */
  dateFrom: string | null
  dateTo: string | null
}

export interface CleaningJobQuery {
  filters: CleaningJobFilters
  sortBy: CleaningJobSortKey
  sortDir: SortDirection
  page: number
  pageSize: number
}

export const EMPTY_FILTERS: CleaningJobFilters = {
  cleanerIds: [],
  companyIds: [],
  clientIds: [],
  cleaningTypeIds: [],
  feedbackSearch: '',
  ratings: [],
  dateRange: 'all',
  dateFrom: null,
  dateTo: null,
}

export const DEFAULT_QUERY: CleaningJobQuery = {
  filters: EMPTY_FILTERS,
  sortBy: 'schedule',
  sortDir: 'desc',
  page: 1,
  pageSize: 10,
}

/** True when any filter is set. A feedback search of only spaces does not count. */
export function hasActiveFilters(filters: CleaningJobFilters): boolean {
  return (
    filters.cleanerIds.length > 0 ||
    filters.companyIds.length > 0 ||
    filters.clientIds.length > 0 ||
    filters.cleaningTypeIds.length > 0 ||
    filters.feedbackSearch.trim() !== '' ||
    filters.ratings.length > 0 ||
    filters.dateRange !== 'all'
  )
}

interface CleaningJobPage {
  rows: CleaningJobListRow[]
  total: number
}

/**
 * Calls get_cleaning_jobs: one page of jobs, filtered and sorted in the database. The time zone is
 * the one the user sees dates in, so "current week" and custom days match the Scheduled Date column.
 */
export async function fetchCleaningJobs(
  client: AppSupabaseClient,
  query: CleaningJobQuery,
  timeZone: string,
): Promise<CleaningJobPage> {
  const { filters } = query
  const { data, error } = await client.rpc('get_cleaning_jobs', {
    p_cleaner_ids: filters.cleanerIds.length > 0 ? filters.cleanerIds : undefined,
    p_company_ids: filters.companyIds.length > 0 ? filters.companyIds : undefined,
    p_client_ids: filters.clientIds.length > 0 ? filters.clientIds : undefined,
    p_cleaning_type_ids: filters.cleaningTypeIds.length > 0 ? filters.cleaningTypeIds : undefined,
    p_feedback_search: filters.feedbackSearch.trim() === '' ? undefined : filters.feedbackSearch,
    p_ratings: filters.ratings.length > 0 ? filters.ratings : undefined,
    p_date_range: filters.dateRange === 'all' ? undefined : filters.dateRange,
    p_date_from: filters.dateRange === 'custom' ? (filters.dateFrom ?? undefined) : undefined,
    p_date_to: filters.dateRange === 'custom' ? (filters.dateTo ?? undefined) : undefined,
    p_time_zone: timeZone,
    p_sort_by: query.sortBy,
    p_sort_dir: query.sortDir,
    p_page: query.page,
    p_page_size: query.pageSize,
  })
  if (error) throw new Error(error.message)
  const rows = data as unknown as CleaningJobListRow[]
  return { rows, total: rows[0]?.total_count ?? 0 }
}

/** Calls get_complete_address_for_property_id. Null when the property is missing or not visible. */
export async function fetchCompleteAddress(
  client: AppSupabaseClient,
  propertyId: string,
): Promise<string | null> {
  const { data, error } = await client.rpc('get_complete_address_for_property_id', {
    p_property_id: propertyId,
  })
  if (error) throw new Error(error.message)
  return data
}

/** Calls get_cleaners_for_cleaning_job_id. Empty array when nobody is assigned. */
export async function fetchCleanersForCleaningJob(
  client: AppSupabaseClient,
  cleaningJobId: string,
): Promise<JobCleaner[]> {
  const { data, error } = await client.rpc('get_cleaners_for_cleaning_job_id', {
    p_cleaning_job_id: cleaningJobId,
  })
  if (error) throw new Error(error.message)
  return data
}

/** Calls get_client_feedbacks_for_cleaning_job_id. Newest first; empty array when none. */
export async function fetchClientFeedbacks(
  client: AppSupabaseClient,
  cleaningJobId: string,
): Promise<ClientFeedback[]> {
  const { data, error } = await client.rpc('get_client_feedbacks_for_cleaning_job_id', {
    p_cleaning_job_id: cleaningJobId,
  })
  if (error) throw new Error(error.message)
  return data
}
```

Create `src/features/cleaning-jobs/usePreferredTimeZone.ts` with exactly this content:

```ts
import { useGetIdentity, useOne, useUpdate } from '@refinedev/core'
import { DEFAULT_TIME_ZONE } from '@/features/cleaning-jobs/timeZone'
import type { Profile } from '@/types/db'

/** Reads and saves profiles.preferred_time_zone for the signed-in user. */
export function usePreferredTimeZone() {
  const { data: identity } = useGetIdentity<{ id: string }>()
  const userId = identity?.id
  const { result: profile } = useOne<Profile>({
    resource: 'profiles',
    id: userId,
    queryOptions: { enabled: userId !== undefined },
  })
  const { mutate, mutation } = useUpdate<Profile>()

  return {
    /** False until the saved zone has loaded, so the list does not fetch twice. */
    isLoaded: profile !== undefined,
    timeZone: profile?.preferred_time_zone ?? DEFAULT_TIME_ZONE,
    isSaving: mutation.isPending,
    save: (timeZone: string) => {
      if (userId === undefined) return
      mutate({
        resource: 'profiles',
        id: userId,
        values: { preferred_time_zone: timeZone },
        successNotification: { type: 'success', message: `Time zone set to ${timeZone}` },
      })
    },
  }
}
```

Create `src/features/cleaning-jobs/timeZone.test.ts` with exactly this content:

```ts
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIME_ZONE,
  deviceTimeZone,
  formatSchedule,
  listTimeZones,
} from '@/features/cleaning-jobs/timeZone'

describe('formatSchedule', () => {
  it('shows the same instant in New York winter time (UTC-5)', () => {
    expect(formatSchedule('2026-12-01T09:00:00+00:00', 'America/New_York')).toBe(
      'Tue 1 Dec 2026, 4:00 AM',
    )
  })

  it('shows the same instant in New York summer time (UTC-4)', () => {
    expect(formatSchedule('2026-07-01T09:00:00+00:00', 'America/New_York')).toBe(
      'Wed 1 Jul 2026, 5:00 AM',
    )
  })

  it('shows the same instant in another zone', () => {
    expect(formatSchedule('2026-12-01T09:00:00+00:00', 'Australia/Sydney')).toBe(
      'Tue 1 Dec 2026, 8:00 PM',
    )
  })

  it('reads an offset in the input', () => {
    expect(formatSchedule('2026-12-01T02:00:00-07:00', 'UTC')).toBe('Tue 1 Dec 2026, 9:00 AM')
  })
})

describe('time zone lists', () => {
  it('defaults to Edmonton', () => {
    expect(DEFAULT_TIME_ZONE).toBe('America/Edmonton')
  })

  it('lists IANA names including the default and UTC', () => {
    const zones = listTimeZones()
    expect(zones).toContain('America/Edmonton')
    expect(zones).toContain('UTC')
  })

  it('reports a device zone', () => {
    expect(deviceTimeZone()).not.toBe('')
  })
})
```

Create `src/features/cleaning-jobs/api.test.ts` with exactly this content:

```ts
import { describe, expect, it, vi } from 'vitest'
import type { AppSupabaseClient } from '@/features/integration/api'
import {
  DEFAULT_QUERY,
  EMPTY_FILTERS,
  fetchCleanersForCleaningJob,
  fetchCleaningJobs,
  fetchClientFeedbacks,
  fetchCompleteAddress,
  hasActiveFilters,
} from '@/features/cleaning-jobs/api'

describe('fetchCleaningJobs', () => {
  it('sends no filters, the default sort and the page for an empty query', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }
    const result = await fetchCleaningJobs(
      client as unknown as AppSupabaseClient,
      DEFAULT_QUERY,
      'America/Edmonton',
    )
    expect(client.rpc).toHaveBeenCalledWith('get_cleaning_jobs', {
      p_cleaner_ids: undefined,
      p_company_ids: undefined,
      p_client_ids: undefined,
      p_cleaning_type_ids: undefined,
      p_feedback_search: undefined,
      p_ratings: undefined,
      p_date_range: undefined,
      p_date_from: undefined,
      p_date_to: undefined,
      p_time_zone: 'America/Edmonton',
      p_sort_by: 'schedule',
      p_sort_dir: 'desc',
      p_page: 1,
      p_page_size: 10,
    })
    expect(result).toEqual({ rows: [], total: 0 })
  })

  it('sends the chosen filters and sort and reads the total from the first row', async () => {
    const rows = [{ id: 'j1', total_count: 42 }]
    const client = { rpc: vi.fn().mockResolvedValue({ data: rows, error: null }) }
    const result = await fetchCleaningJobs(
      client as unknown as AppSupabaseClient,
      {
        filters: {
          cleanerIds: ['k1'],
          companyIds: ['co1'],
          clientIds: ['c1'],
          cleaningTypeIds: ['t1'],
          feedbackSearch: ' oven ',
          ratings: [3, 4],
          dateRange: 'custom',
          dateFrom: '2026-12-01',
          dateTo: '2026-12-31',
        },
        sortBy: 'rating',
        sortDir: 'asc',
        page: 2,
        pageSize: 25,
      },
      'Australia/Sydney',
    )
    expect(client.rpc).toHaveBeenCalledWith('get_cleaning_jobs', {
      p_cleaner_ids: ['k1'],
      p_company_ids: ['co1'],
      p_client_ids: ['c1'],
      p_cleaning_type_ids: ['t1'],
      p_feedback_search: ' oven ',
      p_ratings: [3, 4],
      p_date_range: 'custom',
      p_date_from: '2026-12-01',
      p_date_to: '2026-12-31',
      p_time_zone: 'Australia/Sydney',
      p_sort_by: 'rating',
      p_sort_dir: 'asc',
      p_page: 2,
      p_page_size: 25,
    })
    expect(result).toEqual({ rows, total: 42 })
  })

  it('throws the database message when the call fails', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'denied' } }) }
    await expect(
      fetchCleaningJobs(client as unknown as AppSupabaseClient, DEFAULT_QUERY, 'UTC'),
    ).rejects.toThrow('denied')
  })

  it('sends a named range without custom dates and ignores stale custom dates', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }
    await fetchCleaningJobs(
      client as unknown as AppSupabaseClient,
      {
        ...DEFAULT_QUERY,
        filters: {
          ...EMPTY_FILTERS,
          dateRange: 'last_3_months',
          dateFrom: '2026-01-01',
          dateTo: '2026-01-31',
        },
      },
      'UTC',
    )
    expect(client.rpc).toHaveBeenCalledWith(
      'get_cleaning_jobs',
      expect.objectContaining({
        p_date_range: 'last_3_months',
        p_date_from: undefined,
        p_date_to: undefined,
        p_time_zone: 'UTC',
      }),
    )
  })
})

describe('hasActiveFilters', () => {
  it('is false for the empty filters and for a blank search', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, feedbackSearch: '   ' })).toBe(false)
  })

  it('is true when any filter is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, ratings: [5] })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, cleanerIds: ['k1'] })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, feedbackSearch: 'oven' })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, dateRange: 'current_week' })).toBe(true)
  })
})

describe('fetchCompleteAddress', () => {
  it('calls the function with the property id and returns the text', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: '1 Test St, Edmonton', error: null }) }
    const result = await fetchCompleteAddress(client as unknown as AppSupabaseClient, 'p1')
    expect(client.rpc).toHaveBeenCalledWith('get_complete_address_for_property_id', {
      p_property_id: 'p1',
    })
    expect(result).toBe('1 Test St, Edmonton')
  })

  it('throws the database message when the call fails', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'denied' } }) }
    await expect(
      fetchCompleteAddress(client as unknown as AppSupabaseClient, 'p1'),
    ).rejects.toThrow('denied')
  })
})

describe('fetchCleanersForCleaningJob', () => {
  it('calls the function with the job id and returns the rows', async () => {
    const rows = [{ cleaner_id: 'c1', full_name: 'Zed Adams' }]
    const client = { rpc: vi.fn().mockResolvedValue({ data: rows, error: null }) }
    const result = await fetchCleanersForCleaningJob(client as unknown as AppSupabaseClient, 'j1')
    expect(client.rpc).toHaveBeenCalledWith('get_cleaners_for_cleaning_job_id', {
      p_cleaning_job_id: 'j1',
    })
    expect(result).toEqual(rows)
  })

  it('throws the database message when the call fails', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'denied' } }) }
    await expect(
      fetchCleanersForCleaningJob(client as unknown as AppSupabaseClient, 'j1'),
    ).rejects.toThrow('denied')
  })
})

describe('fetchClientFeedbacks', () => {
  it('calls the function with the job id and returns the rows', async () => {
    const rows = [
      { id: 'f1', rating: 5, feedback: 'Great', created_at: '2026-12-05T10:00:00+00:00' },
    ]
    const client = { rpc: vi.fn().mockResolvedValue({ data: rows, error: null }) }
    const result = await fetchClientFeedbacks(client as unknown as AppSupabaseClient, 'j1')
    expect(client.rpc).toHaveBeenCalledWith('get_client_feedbacks_for_cleaning_job_id', {
      p_cleaning_job_id: 'j1',
    })
    expect(result).toEqual(rows)
  })

  it('throws the database message when the call fails', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'denied' } }) }
    await expect(
      fetchClientFeedbacks(client as unknown as AppSupabaseClient, 'j1'),
    ).rejects.toThrow('denied')
  })
})
```

Create `src/features/cleaning-jobs/hooks.ts` with exactly this content:

```ts
// One React Query hook per database function. Each hook calls the matching fetcher in api.ts, so
// results are cached by query key and shared by every component that asks for the same thing.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  fetchCleanersForCleaningJob,
  fetchCleaningJobs,
  fetchClientFeedbacks,
  fetchCompleteAddress,
  type CleaningJobQuery,
} from '@/features/cleaning-jobs/api'
import { supabase } from '@/lib/supabase'

/** Cached results stay fresh for 30 seconds, then refresh in the background when used again. */
const STALE_TIME_MS = 30_000

const cleaningJobKeys = {
  all: ['cleaning-jobs'] as const,
  list: (query: CleaningJobQuery, timeZone: string) =>
    [...cleaningJobKeys.all, 'list', query, timeZone] as const,
  address: (propertyId: string | undefined) =>
    [...cleaningJobKeys.all, 'address', propertyId] as const,
  cleaners: (cleaningJobId: string | undefined) =>
    [...cleaningJobKeys.all, 'cleaners', cleaningJobId] as const,
  feedbacks: (cleaningJobId: string | undefined) =>
    [...cleaningJobKeys.all, 'feedbacks', cleaningJobId] as const,
}

/** get_cleaning_jobs. Keeps the previous page on screen while the next one loads. */
export function useCleaningJobs(query: CleaningJobQuery, timeZone: string, enabled = true) {
  return useQuery({
    queryKey: cleaningJobKeys.list(query, timeZone),
    queryFn: () => fetchCleaningJobs(supabase, query, timeZone),
    enabled,
    staleTime: STALE_TIME_MS,
    placeholderData: keepPreviousData,
  })
}

/** get_complete_address_for_property_id. Does nothing until a property id is given. */
export function useCompleteAddress(propertyId: string | undefined) {
  return useQuery({
    queryKey: cleaningJobKeys.address(propertyId),
    queryFn: () => fetchCompleteAddress(supabase, propertyId ?? ''),
    enabled: propertyId !== undefined,
    staleTime: STALE_TIME_MS,
  })
}

/** get_cleaners_for_cleaning_job_id. Does nothing until a job id is given. */
export function useCleanersForCleaningJob(cleaningJobId: string | undefined) {
  return useQuery({
    queryKey: cleaningJobKeys.cleaners(cleaningJobId),
    queryFn: () => fetchCleanersForCleaningJob(supabase, cleaningJobId ?? ''),
    enabled: cleaningJobId !== undefined,
    staleTime: STALE_TIME_MS,
  })
}

/** get_client_feedbacks_for_cleaning_job_id. Does nothing until a job id is given. */
export function useClientFeedbacks(cleaningJobId: string | undefined) {
  return useQuery({
    queryKey: cleaningJobKeys.feedbacks(cleaningJobId),
    queryFn: () => fetchClientFeedbacks(supabase, cleaningJobId ?? ''),
    enabled: cleaningJobId !== undefined,
    staleTime: STALE_TIME_MS,
  })
}
```

Create `src/features/cleaning-jobs/hooks.test.tsx` with exactly this content:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_QUERY } from '@/features/cleaning-jobs/api'
import {
  useCleanersForCleaningJob,
  useCleaningJobs,
  useClientFeedbacks,
  useCompleteAddress,
} from '@/features/cleaning-jobs/hooks'

const rpc = vi.fn<(...args: unknown[]) => Promise<unknown>>()

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}))

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return wrapper
}

describe('useCleaningJobs', () => {
  it('calls get_cleaning_jobs and returns the rows and the total', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'j1', total_count: 7 }], error: null })
    const { result } = renderHook(() => useCleaningJobs(DEFAULT_QUERY, 'UTC'), {
      wrapper: setup(),
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(rpc).toHaveBeenCalledWith(
      'get_cleaning_jobs',
      expect.objectContaining({ p_time_zone: 'UTC', p_sort_by: 'schedule' }),
    )
    expect(result.current.data?.total).toBe(7)
  })

  it('does not call the database while disabled', () => {
    renderHook(() => useCleaningJobs(DEFAULT_QUERY, 'UTC', false), { wrapper: setup() })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('asks again when the time zone changes', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    const wrapper = setup()
    const { result, rerender } = renderHook(
      ({ zone }: { zone: string }) => useCleaningJobs(DEFAULT_QUERY, zone),
      { wrapper, initialProps: { zone: 'UTC' } },
    )
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    rerender({ zone: 'Australia/Sydney' })
    await waitFor(() => {
      expect(rpc).toHaveBeenCalledTimes(2)
    })
  })
})

describe('useCompleteAddress', () => {
  it('calls get_complete_address_for_property_id', async () => {
    rpc.mockResolvedValue({ data: '1 Test St', error: null })
    const { result } = renderHook(() => useCompleteAddress('p1'), { wrapper: setup() })
    await waitFor(() => {
      expect(result.current.data).toBe('1 Test St')
    })
    expect(rpc).toHaveBeenCalledWith('get_complete_address_for_property_id', {
      p_property_id: 'p1',
    })
  })

  it('does nothing without a property id', () => {
    renderHook(() => useCompleteAddress(undefined), { wrapper: setup() })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('shares one cached request between two components', async () => {
    rpc.mockResolvedValue({ data: '1 Test St', error: null })
    const wrapper = setup()
    const first = renderHook(() => useCompleteAddress('p1'), { wrapper })
    await waitFor(() => {
      expect(first.result.current.isSuccess).toBe(true)
    })
    const second = renderHook(() => useCompleteAddress('p1'), { wrapper })
    expect(second.result.current.data).toBe('1 Test St')
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

describe('useCleanersForCleaningJob', () => {
  it('calls get_cleaners_for_cleaning_job_id', async () => {
    const rows = [{ cleaner_id: 'c1', full_name: 'Zed Adams' }]
    rpc.mockResolvedValue({ data: rows, error: null })
    const { result } = renderHook(() => useCleanersForCleaningJob('j1'), { wrapper: setup() })
    await waitFor(() => {
      expect(result.current.data).toEqual(rows)
    })
    expect(rpc).toHaveBeenCalledWith('get_cleaners_for_cleaning_job_id', {
      p_cleaning_job_id: 'j1',
    })
  })

  it('does nothing without a job id', () => {
    renderHook(() => useCleanersForCleaningJob(undefined), { wrapper: setup() })
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('useClientFeedbacks', () => {
  it('calls get_client_feedbacks_for_cleaning_job_id', async () => {
    const rows = [
      { id: 'f1', rating: 5, feedback: 'Great', created_at: '2026-12-05T10:00:00+00:00' },
    ]
    rpc.mockResolvedValue({ data: rows, error: null })
    const { result } = renderHook(() => useClientFeedbacks('j1'), { wrapper: setup() })
    await waitFor(() => {
      expect(result.current.data).toEqual(rows)
    })
    expect(rpc).toHaveBeenCalledWith('get_client_feedbacks_for_cleaning_job_id', {
      p_cleaning_job_id: 'j1',
    })
  })

  it('does nothing without a job id and reports an error from the database', async () => {
    renderHook(() => useClientFeedbacks(undefined), { wrapper: setup() })
    expect(rpc).not.toHaveBeenCalled()
    rpc.mockResolvedValue({ data: null, error: { message: 'denied' } })
    const { result } = renderHook(() => useClientFeedbacks('j1'), { wrapper: setup() })
    await waitFor(() => {
      expect(result.current.error?.message).toBe('denied')
    })
  })
})
```

Create `src/features/cleaning-jobs/filterChips.ts` with exactly this content:

```ts
// Turns the Cleaning Jobs filters into removable chips ("Client: Xavier"). Pure, so it is easy to test.
import { DATE_RANGE_LABELS, type CleaningJobFilters } from '@/features/cleaning-jobs/api'

interface FilterChip {
  /** Stable React key, unique within one list of chips. */
  key: string
  label: string
  /** The filters after this chip is removed. */
  next: CleaningJobFilters
}

/** Id to display name, one map per option list. A missing id shows as "Unknown". */
export interface FilterLookups {
  cleaners: ReadonlyMap<string, string>
  companies: ReadonlyMap<string, string>
  clients: ReadonlyMap<string, string>
  cleaningTypes: ReadonlyMap<string, string>
}

type IdFilterKey = 'cleanerIds' | 'companyIds' | 'clientIds' | 'cleaningTypeIds'

const ID_FILTERS: { field: IdFilterKey; title: string; lookup: keyof FilterLookups }[] = [
  { field: 'cleanerIds', title: 'Cleaner', lookup: 'cleaners' },
  { field: 'companyIds', title: 'Company', lookup: 'companies' },
  { field: 'clientIds', title: 'Client', lookup: 'clients' },
  { field: 'cleaningTypeIds', title: 'Cleaning type', lookup: 'cleaningTypes' },
]

/** "1 star", "2 stars"; also used for the Rating filter options. */
export function ratingLabel(rating: number): string {
  return rating === 1 ? '1 star' : `${String(rating)} stars`
}

function dateRangeLabel(filters: CleaningJobFilters): string {
  if (filters.dateRange !== 'custom') return DATE_RANGE_LABELS[filters.dateRange]
  const { dateFrom, dateTo } = filters
  if (dateFrom && dateTo) return `${dateFrom} to ${dateTo}`
  if (dateFrom) return `from ${dateFrom}`
  if (dateTo) return `until ${dateTo}`
  return DATE_RANGE_LABELS.custom
}

/** One chip per active value, in the order the filters appear on the page. */
export function buildFilterChips(
  filters: CleaningJobFilters,
  lookups: FilterLookups,
): FilterChip[] {
  const chips: FilterChip[] = []
  if (filters.dateRange !== 'all') {
    chips.push({
      key: 'dateRange',
      label: `Scheduled: ${dateRangeLabel(filters)}`,
      next: { ...filters, dateRange: 'all', dateFrom: null, dateTo: null },
    })
  }
  if (filters.feedbackSearch.trim() !== '') {
    chips.push({
      key: 'feedbackSearch',
      label: `Feedback: "${filters.feedbackSearch.trim()}"`,
      next: { ...filters, feedbackSearch: '' },
    })
  }
  for (const { field, title, lookup } of ID_FILTERS) {
    for (const id of filters[field]) {
      chips.push({
        key: `${field}:${id}`,
        label: `${title}: ${lookups[lookup].get(id) ?? 'Unknown'}`,
        next: { ...filters, [field]: filters[field].filter((other) => other !== id) },
      })
    }
  }
  for (const rating of filters.ratings) {
    chips.push({
      key: `ratings:${String(rating)}`,
      label: `Rating: ${ratingLabel(rating)}`,
      next: { ...filters, ratings: filters.ratings.filter((other) => other !== rating) },
    })
  }
  return chips
}

/** How many of the filters behind the "Filters" button are in use (one per filter, not per value). */
export function countPanelFilters(filters: CleaningJobFilters): number {
  return [
    filters.cleanerIds,
    filters.companyIds,
    filters.clientIds,
    filters.cleaningTypeIds,
    filters.ratings,
  ].filter((values) => values.length > 0).length
}
```

Create `src/features/cleaning-jobs/filterChips.test.ts` with exactly this content:

```ts
import { describe, expect, it } from 'vitest'
import { EMPTY_FILTERS } from '@/features/cleaning-jobs/api'
import {
  buildFilterChips,
  countPanelFilters,
  ratingLabel,
  type FilterLookups,
} from '@/features/cleaning-jobs/filterChips'

const LOOKUPS: FilterLookups = {
  cleaners: new Map([['cl-1', 'Ana Cruz']]),
  companies: new Map([['co-1', 'Acme']]),
  clients: new Map([
    ['c-1', 'Xavier'],
    ['c-2', 'Yara'],
  ]),
  cleaningTypes: new Map([['t-1', 'Deep clean']]),
}

describe('buildFilterChips', () => {
  it('returns no chips for empty filters', () => {
    expect(buildFilterChips(EMPTY_FILTERS, LOOKUPS)).toEqual([])
  })

  it('labels every active value in page order', () => {
    const chips = buildFilterChips(
      {
        ...EMPTY_FILTERS,
        dateRange: 'last_3_months',
        feedbackSearch: '  late  ',
        cleanerIds: ['cl-1'],
        companyIds: ['co-1'],
        clientIds: ['c-1', 'c-2'],
        cleaningTypeIds: ['t-1'],
        ratings: [4, 1],
      },
      LOOKUPS,
    )
    expect(chips.map((chip) => chip.label)).toEqual([
      'Scheduled: Last 3 months',
      'Feedback: "late"',
      'Cleaner: Ana Cruz',
      'Company: Acme',
      'Client: Xavier',
      'Client: Yara',
      'Cleaning type: Deep clean',
      'Rating: 4 stars',
      'Rating: 1 star',
    ])
    expect(new Set(chips.map((chip) => chip.key)).size).toBe(chips.length)
  })

  it('removes only its own value', () => {
    const filters = { ...EMPTY_FILTERS, clientIds: ['c-1', 'c-2'], ratings: [0, 5] }
    const [xavier, , zero] = buildFilterChips(filters, LOOKUPS)
    expect(xavier?.next).toEqual({ ...filters, clientIds: ['c-2'] })
    expect(zero?.label).toBe('Rating: 0 stars')
    expect(zero?.next).toEqual({ ...filters, ratings: [5] })
  })

  it('shows an unknown id as Unknown', () => {
    const [chip] = buildFilterChips({ ...EMPTY_FILTERS, cleanerIds: ['missing'] }, LOOKUPS)
    expect(chip?.label).toBe('Cleaner: Unknown')
  })

  it('describes a custom range and resets it to all dates', () => {
    const base = { ...EMPTY_FILTERS, dateRange: 'custom' as const }
    const label = (dateFrom: string | null, dateTo: string | null) =>
      buildFilterChips({ ...base, dateFrom, dateTo }, LOOKUPS)[0]?.label
    expect(label('2026-01-01', '2026-01-31')).toBe('Scheduled: 2026-01-01 to 2026-01-31')
    expect(label('2026-01-01', null)).toBe('Scheduled: from 2026-01-01')
    expect(label(null, '2026-01-31')).toBe('Scheduled: until 2026-01-31')
    expect(label(null, null)).toBe('Scheduled: Custom range')
    const [chip] = buildFilterChips({ ...base, dateFrom: '2026-01-01', dateTo: null }, LOOKUPS)
    expect(chip?.next).toEqual(EMPTY_FILTERS)
  })

  it('ignores a blank feedback search', () => {
    expect(buildFilterChips({ ...EMPTY_FILTERS, feedbackSearch: '   ' }, LOOKUPS)).toEqual([])
  })
})

describe('countPanelFilters', () => {
  it('counts filters, not values, and skips date and feedback', () => {
    expect(countPanelFilters(EMPTY_FILTERS)).toBe(0)
    expect(
      countPanelFilters({
        ...EMPTY_FILTERS,
        clientIds: ['c-1', 'c-2'],
        ratings: [3],
        dateRange: 'current_week',
        feedbackSearch: 'late',
      }),
    ).toBe(2)
  })
})

describe('ratingLabel', () => {
  it('uses the singular only for one', () => {
    expect([0, 1, 2].map(ratingLabel)).toEqual(['0 stars', '1 star', '2 stars'])
  })
})
```

### Step 7. Component and page files (create files)

Structure rule (owner, 2026-11-27): `src/pages/<feature>/` holds only the Create, Edit and List pages; every other component lives in `src/components/<feature>/`. Here the only page is `CleaningJobList.tsx`.

Create `src/components/cleaning-jobs/TimeZonePicker.tsx` with exactly this content:

```tsx
import { useMemo } from 'react'
import { Button, Select, Space, Typography } from 'antd'
import { deviceTimeZone, listTimeZones } from '@/features/cleaning-jobs/timeZone'

interface Props {
  value: string
  saving: boolean
  onChange: (timeZone: string) => void
}

/** Lets the user choose the time zone that scheduled dates and feedback dates are shown in. */
export function TimeZonePicker({ value, saving, onChange }: Props) {
  const options = useMemo(() => listTimeZones().map((zone) => ({ label: zone, value: zone })), [])
  const device = deviceTimeZone()

  return (
    <Space wrap style={{ marginBottom: 16 }}>
      <Typography.Text>Show times in</Typography.Text>
      <Select
        showSearch
        style={{ minWidth: 280 }}
        value={value}
        options={options}
        loading={saving}
        onChange={onChange}
        data-testid="time-zone-select"
      />
      <Button
        disabled={saving || value === device}
        onClick={() => {
          onChange(device)
        }}
      >
        Use my device time zone ({device})
      </Button>
    </Space>
  )
}
```

Create `src/components/cleaning-jobs/CleaningJobFilterBar.tsx` with exactly this content:

```tsx
import { useId, useState } from 'react'
import { useList } from '@refinedev/core'
import dayjs from 'dayjs'
import { CloseOutlined, FilterOutlined } from '@ant-design/icons'
import {
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Flex,
  Form,
  Input,
  Rate,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import {
  DATE_RANGE_LABELS,
  EMPTY_FILTERS,
  type CleaningJobFilters,
  type DateRangeKey,
} from '@/features/cleaning-jobs/api'
import {
  buildFilterChips,
  countPanelFilters,
  ratingLabel,
} from '@/features/cleaning-jobs/filterChips'
import type { Cleaner, CleaningType, Client, Company } from '@/types/db'

interface Props {
  value: CleaningJobFilters
  onChange: (filters: CleaningJobFilters) => void
}

interface Option {
  value: string
  label: string
}

/** One multi-select in the "Filters" panel. `key` builds the input id. */
interface IdFilter {
  key: string
  field: 'cleanerIds' | 'companyIds' | 'clientIds' | 'cleaningTypeIds'
  label: string
  placeholder: string
  options: Option[]
}

const DATE_FORMAT = 'YYYY-MM-DD'
const DATE_RANGE_OPTIONS = (Object.keys(DATE_RANGE_LABELS) as DateRangeKey[]).map((key) => ({
  value: key,
  label: DATE_RANGE_LABELS[key],
}))

const RATING_OPTIONS = [5, 4, 3, 2, 1, 0].map((n) => ({
  value: n,
  title: ratingLabel(n),
  label: (
    <Space size={4}>
      <Rate disabled count={5} value={n} style={{ fontSize: 12 }} />
      <span>{ratingLabel(n)}</span>
    </Space>
  ),
}))

/** Select options sorted by label. */
function toOptions<T extends { id: string }>(rows: T[], label: (row: T) => string): Option[] {
  return rows
    .map((row) => ({ value: row.id, label: label(row) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

function toLookup(options: Option[]): Map<string, string> {
  return new Map(options.map((option) => [option.value, option.label]))
}

/** Date range, feedback search, the "Filters" panel and the removable chips of active filters. */
export function CleaningJobFilterBar({ value, onChange }: Props) {
  const ids = useId()
  const [panelOpen, setPanelOpen] = useState(false)
  // One option list per filter, loaded once (no paging) and searched in the browser.
  const { result: cleanerRows } = useList<Cleaner>({
    resource: 'cleaners',
    pagination: { mode: 'off' },
  })
  const { result: companyRows } = useList<Company>({
    resource: 'companies',
    pagination: { mode: 'off' },
  })
  const { result: clientRows } = useList<Client>({
    resource: 'clients',
    pagination: { mode: 'off' },
  })
  const { result: typeRows } = useList<CleaningType>({
    resource: 'cleaning_types',
    pagination: { mode: 'off' },
  })
  const cleaners = toOptions(cleanerRows.data, (c) =>
    [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' '),
  )
  const companies = toOptions(companyRows.data, (c) => c.name)
  const clients = toOptions(clientRows.data, (c) => c.name)
  const cleaningTypes = toOptions(typeRows.data, (c) => c.name)

  const chips = buildFilterChips(value, {
    cleaners: toLookup(cleaners),
    companies: toLookup(companies),
    clients: toLookup(clients),
    cleaningTypes: toLookup(cleaningTypes),
  })
  const panelCount = countPanelFilters(value)
  const panelId = `${ids}-panel`
  const dateLabelId = `${ids}-date`

  const idFilters: IdFilter[] = [
    {
      key: 'cleaner',
      field: 'cleanerIds',
      label: 'Cleaner',
      placeholder: 'Any cleaner',
      options: cleaners,
    },
    {
      key: 'company',
      field: 'companyIds',
      label: 'Company',
      placeholder: 'Any company',
      options: companies,
    },
    {
      key: 'client',
      field: 'clientIds',
      label: 'Client',
      placeholder: 'Any client',
      options: clients,
    },
    {
      key: 'cleaning-type',
      field: 'cleaningTypeIds',
      label: 'Cleaning type',
      placeholder: 'Any cleaning type',
      options: cleaningTypes,
    },
  ]

  return (
    <div style={{ marginBottom: 16 }}>
      <Flex wrap gap="small" align="center">
        <Typography.Text type="secondary" id={dateLabelId}>
          Scheduled
        </Typography.Text>
        <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
          <Segmented<DateRangeKey>
            aria-labelledby={dateLabelId}
            value={value.dateRange}
            options={DATE_RANGE_OPTIONS}
            onChange={(dateRange) => {
              onChange({ ...value, dateRange, dateFrom: null, dateTo: null })
            }}
          />
        </div>
        {value.dateRange === 'custom' && (
          <DatePicker.RangePicker
            aria-label="Custom scheduled date range"
            allowEmpty={[true, true]}
            placeholder={['From date', 'To date']}
            value={[
              value.dateFrom ? dayjs(value.dateFrom) : null,
              value.dateTo ? dayjs(value.dateTo) : null,
            ]}
            onChange={(dates) => {
              onChange({
                ...value,
                dateFrom: dates?.[0]?.format(DATE_FORMAT) ?? null,
                dateTo: dates?.[1]?.format(DATE_FORMAT) ?? null,
              })
            }}
          />
        )}
        <Input.Search
          aria-label="Search feedback"
          allowClear
          placeholder="Search feedback, press Enter"
          style={{ width: 280, maxWidth: '100%' }}
          defaultValue={value.feedbackSearch}
          key={value.feedbackSearch === '' ? 'empty' : 'set'}
          onSearch={(feedbackSearch) => {
            onChange({ ...value, feedbackSearch })
          }}
        />
        <Badge count={panelCount} size="small">
          <Button
            icon={<FilterOutlined />}
            aria-expanded={panelOpen}
            aria-controls={panelId}
            type={panelOpen ? 'primary' : 'default'}
            onClick={() => {
              setPanelOpen(!panelOpen)
            }}
          >
            {panelOpen ? 'Hide filters' : 'Filters'}
          </Button>
        </Badge>
      </Flex>
      {panelOpen && (
        <Card size="small" id={panelId} style={{ marginTop: 12 }}>
          <Form layout="vertical" component={false}>
            <Row gutter={[16, 0]}>
              {idFilters.map(({ key, field, label, placeholder, options }) => (
                <Col xs={24} sm={12} lg={8} key={key}>
                  <Form.Item label={label} htmlFor={`${ids}-${key}`} style={{ marginBottom: 8 }}>
                    <Select
                      id={`${ids}-${key}`}
                      mode="multiple"
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      maxTagCount="responsive"
                      placeholder={placeholder}
                      options={options}
                      value={value[field]}
                      onChange={(selectedIds: string[]) => {
                        onChange({ ...value, [field]: selectedIds })
                      }}
                    />
                  </Form.Item>
                </Col>
              ))}
              <Col xs={24} sm={12} lg={8}>
                <Form.Item label="Rating" htmlFor={`${ids}-rating`} style={{ marginBottom: 8 }}>
                  <Select
                    id={`${ids}-rating`}
                    mode="multiple"
                    allowClear
                    maxTagCount="responsive"
                    optionLabelProp="title"
                    placeholder="Any rating"
                    options={RATING_OPTIONS}
                    value={value.ratings}
                    onChange={(ratings: number[]) => {
                      onChange({ ...value, ratings })
                    }}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Typography.Text type="secondary">
              Several values in one filter match any of them. Different filters must all match.
            </Typography.Text>
          </Form>
        </Card>
      )}
      {chips.length > 0 && (
        <Flex
          wrap
          gap={6}
          align="center"
          style={{ marginTop: 12 }}
          role="group"
          aria-label="Active filters"
        >
          <Typography.Text type="secondary">Active filters:</Typography.Text>
          {chips.map((chip) => (
            <Tag key={chip.key} style={{ marginInlineEnd: 0, paddingInlineEnd: 0 }}>
              {chip.label}
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                aria-label={`Remove ${chip.label}`}
                onClick={() => {
                  onChange(chip.next)
                }}
              />
            </Tag>
          ))}
          <Button
            type="link"
            size="small"
            onClick={() => {
              onChange(EMPTY_FILTERS)
            }}
          >
            Clear all
          </Button>
        </Flex>
      )}
    </div>
  )
}
```

Create `src/components/cleaning-jobs/FeedbackModal.tsx` with exactly this content:

```tsx
import { Alert, List, Modal, Rate, Typography } from 'antd'
import { useClientFeedbacks } from '@/features/cleaning-jobs/hooks'
import { formatSchedule } from '@/features/cleaning-jobs/timeZone'
import type { CleaningJobListRow } from '@/types/db'

interface Props {
  job: CleaningJobListRow | null
  timeZone: string
  onClose: () => void
}

/**
 * Every feedback of one job, newest first, opened from the Feedback column. The request is made
 * only while the modal is open, and reopening the same job reads the cache.
 */
export function FeedbackModal({ job, timeZone, onClose }: Props) {
  const { data, isLoading, error } = useClientFeedbacks(job?.id)

  return (
    <Modal
      open={job !== null}
      title={job ? `Feedback for ${job.client_name}` : 'Feedback'}
      footer={null}
      onCancel={onClose}
    >
      {error && <Alert type="error" showIcon message={error.message} />}
      <List
        loading={isLoading}
        dataSource={data ?? []}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              title={<Rate disabled value={item.rating} />}
              description={
                <>
                  <div>
                    {item.feedback ?? (
                      <Typography.Text type="secondary">No comment</Typography.Text>
                    )}
                  </div>
                  <Typography.Text type="secondary">
                    {formatSchedule(item.created_at, timeZone)}
                  </Typography.Text>
                </>
              }
            />
          </List.Item>
        )}
      />
    </Modal>
  )
}
```

Create `src/pages/cleaning-jobs/CleaningJobList.tsx` with exactly this content:

```tsx
import { useState } from 'react'
import { List } from '@refinedev/antd'
import { Alert, Button, Empty, Rate, Space, Table, Tag, Typography, type TableProps } from 'antd'
import {
  DEFAULT_QUERY,
  EMPTY_FILTERS,
  hasActiveFilters,
  type CleaningJobFilters,
  type CleaningJobQuery,
  type CleaningJobSortKey,
} from '@/features/cleaning-jobs/api'
import { useCleaningJobs } from '@/features/cleaning-jobs/hooks'
import { formatSchedule } from '@/features/cleaning-jobs/timeZone'
import { usePreferredTimeZone } from '@/features/cleaning-jobs/usePreferredTimeZone'
import type { CleaningJobListRow } from '@/types/db'
import { CleaningJobFilterBar } from '@/components/cleaning-jobs/CleaningJobFilterBar'
import { FeedbackModal } from '@/components/cleaning-jobs/FeedbackModal'
import { TimeZonePicker } from '@/components/cleaning-jobs/TimeZonePicker'

const CAD = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' })
const SORT_KEYS: readonly CleaningJobSortKey[] = ['schedule', 'client', 'cleaning_type', 'rating']

function isSortKey(key: unknown): key is CleaningJobSortKey {
  return SORT_KEYS.some((sortKey) => sortKey === key)
}

export function CleaningJobList() {
  const { timeZone, isLoaded, save, isSaving } = usePreferredTimeZone()
  const [query, setQuery] = useState<CleaningJobQuery>(DEFAULT_QUERY)
  const [feedbackJob, setFeedbackJob] = useState<CleaningJobListRow | null>(null)
  const { data, isFetching, error } = useCleaningJobs(query, timeZone, isLoaded)

  const sortOrderFor = (key: CleaningJobSortKey) =>
    query.sortBy === key ? (query.sortDir === 'asc' ? 'ascend' : 'descend') : null

  const handleChange: TableProps<CleaningJobListRow>['onChange'] = (
    pagination,
    _filters,
    sorter,
    extra,
  ) => {
    if (extra.action === 'sort') {
      const single = Array.isArray(sorter) ? sorter[0] : sorter
      if (single?.order && isSortKey(single.columnKey)) {
        setQuery({
          ...query,
          sortBy: single.columnKey,
          sortDir: single.order === 'ascend' ? 'asc' : 'desc',
          page: 1,
        })
      } else {
        // Sorting was cleared: back to the default order.
        setQuery({
          ...query,
          sortBy: DEFAULT_QUERY.sortBy,
          sortDir: DEFAULT_QUERY.sortDir,
          page: 1,
        })
      }
      return
    }
    setQuery({
      ...query,
      page: pagination.current ?? 1,
      pageSize: pagination.pageSize ?? DEFAULT_QUERY.pageSize,
    })
  }

  const setFilters = (filters: CleaningJobFilters) => {
    setQuery({ ...query, filters, page: 1 })
  }

  // With filters on, an empty table offers to clear them; otherwise antd's default empty state.
  const tableLocale = hasActiveFilters(query.filters)
    ? {
        emptyText: (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No jobs match these filters">
            <Button
              onClick={() => {
                setFilters(EMPTY_FILTERS)
              }}
            >
              Clear filters
            </Button>
          </Empty>
        ),
      }
    : undefined

  return (
    <List canCreate={false}>
      <TimeZonePicker value={timeZone} saving={isSaving} onChange={save} />
      <CleaningJobFilterBar value={query.filters} onChange={setFilters} />
      {error && (
        <Alert type="error" showIcon message={error.message} style={{ marginBottom: 16 }} />
      )}
      <Table<CleaningJobListRow>
        rowKey="id"
        dataSource={data?.rows ?? []}
        loading={isFetching}
        scroll={{ x: 'max-content' }}
        onChange={handleChange}
        locale={tableLocale}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: [10, 25, 50],
        }}
      >
        <Table.Column<CleaningJobListRow>
          title="Assignee"
          render={(_, record) =>
            record.cleaners.length === 0 ? (
              <Typography.Text type="secondary">Unassigned</Typography.Text>
            ) : (
              <Space wrap>
                {record.cleaners.map((cleaner) => (
                  <Tag key={cleaner.cleaner_id}>{cleaner.full_name}</Tag>
                ))}
              </Space>
            )
          }
        />
        <Table.Column<CleaningJobListRow> title="Company" dataIndex="company_name" />
        <Table.Column<CleaningJobListRow> title="Status" dataIndex="status_name" />
        <Table.Column<CleaningJobListRow>
          key="schedule"
          title="Scheduled Date"
          dataIndex="schedule"
          sorter
          sortOrder={sortOrderFor('schedule')}
          render={(value: string) => formatSchedule(value, timeZone)}
        />
        <Table.Column<CleaningJobListRow>
          key="client"
          title="Client Name"
          dataIndex="client_name"
          sorter
          sortOrder={sortOrderFor('client')}
        />
        <Table.Column<CleaningJobListRow>
          title="Address"
          dataIndex="address"
          render={(value: string | null) => value ?? '-'}
        />
        <Table.Column<CleaningJobListRow>
          key="cleaning_type"
          title="Cleaning Type"
          sorter
          sortOrder={sortOrderFor('cleaning_type')}
          render={(_, record) => (
            <Space wrap>
              {record.cleaning_types.map((name) => (
                <Tag key={name}>{name}</Tag>
              ))}
            </Space>
          )}
        />
        <Table.Column<CleaningJobListRow>
          title="Notes"
          dataIndex="description"
          render={(value: string | null) => value ?? '-'}
        />
        <Table.Column<CleaningJobListRow>
          title="Feedback"
          render={(_, record) => {
            if (record.feedbacks.length === 0) return '-'
            if (record.feedbacks.length === 1) return record.feedbacks[0]?.feedback ?? '-'
            return (
              <Button
                size="small"
                onClick={() => {
                  setFeedbackJob(record)
                }}
              >
                View all ({record.feedbacks.length})
              </Button>
            )
          }}
        />
        <Table.Column<CleaningJobListRow>
          key="rating"
          title="Rating"
          sorter
          sortOrder={sortOrderFor('rating')}
          render={(_, record) =>
            record.avg_rating === null ? (
              '-'
            ) : (
              <Space size={4}>
                <Rate disabled allowHalf value={Math.round(record.avg_rating * 2) / 2} />
                {record.feedbacks.length > 1 && (
                  <Typography.Text type="secondary">
                    avg of {record.feedbacks.length}
                  </Typography.Text>
                )}
              </Space>
            )
          }
        />
        <Table.Column<CleaningJobListRow>
          title="Rate (CAD)"
          dataIndex="rate"
          render={(value: number) => CAD.format(value)}
        />
      </Table>
      <FeedbackModal
        job={feedbackJob}
        timeZone={timeZone}
        onClose={() => {
          setFeedbackJob(null)
        }}
      />
    </List>
  )
}
```

### Step 8. Sidebar item and route (edit `src/App.tsx`)

Four find/replace pairs. Apply each once.

1. Icon import. Find:

```ts
  ToolOutlined,
} from '@ant-design/icons'
```

Replace with:

```ts
  ToolOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
```

2. Page import. Find:

```ts
import { UserList } from '@/pages/users/UserList'
```

Replace with:

```ts
import { CleaningJobList } from '@/pages/cleaning-jobs/CleaningJobList'
import { UserList } from '@/pages/users/UserList'
```

3. Resource. Find:

```tsx
    meta: { label: 'Items', icon: <ToolOutlined /> },
  },
]
```

Replace with:

```tsx
    meta: { label: 'Items', icon: <ToolOutlined /> },
  },
  {
    name: 'cleaning_jobs',
    list: '/cleaning-jobs',
    meta: { label: 'Cleaning Jobs', icon: <CalendarOutlined /> },
  },
]
```

4. Route. Find:

```tsx
              <Route path="edit/:id" element={<ItemEdit />} />
            </Route>
```

Replace with:

```tsx
              <Route path="edit/:id" element={<ItemEdit />} />
            </Route>
            <Route path="/cleaning-jobs">
              <Route index element={<CleaningJobList />} />
            </Route>
```

If any find text is not found exactly once, stop and report.

### Step 9. Gate: web

```bash
npx prettier --check src/App.tsx src/types/db.ts src/features/cleaning-jobs src/components/cleaning-jobs src/pages/cleaning-jobs && pnpm typecheck && pnpm lint && pnpm test
```

**Expect:** all four exit 0; Vitest reports `timeZone.test.ts` with 7 tests and `api.test.ts` with 12 tests, `hooks.test.tsx` with 10 tests and `filterChips.test.ts` with 8 tests, and no failures. If `prettier --check` fails only on files from this plan, run `npx prettier --write` on those files and re-run; any other failure: stop and report.

```bash
git status --short
```

**Expect:** only the two new migrations, the four new test files under `supabase/tests/database/`, `src/types/database.types.ts`, `src/types/db.ts`, `src/App.tsx`, `src/features/cleaning-jobs/`, `src/components/cleaning-jobs/`, `src/pages/cleaning-jobs/` and this plan file. Anything else: stop and report.

### Step 10. Manual check (no code)

Run `pnpm dev`, sign in, open **Cleaning Jobs** in the sidebar. Use a database that has a few jobs with assignments, cleaning types and feedback (one job with two feedbacks).

**Expect:**
- The table has the 11 columns in the order listed in the Why section; Rating shows stars and Rate shows `$` amounts.
- "Show times in" shows `America/Edmonton`; choosing another zone changes the Scheduled Date values and survives a reload; "Use my device time zone" switches to the browser zone.
- A job with two or more feedbacks shows a "View all (N)" button in Feedback; it opens a modal with every feedback, newest first, each with its stars and date.
- Each filter (cleaner, company, client, cleaning type, feedback search, rating) narrows the list and returns to page 1; each active filter shows as a tag that can be removed, and "Clear all" resets them; with no match the table shows "No jobs match these filters". The date quick-choice buttons still fit on a phone width screen.
- The date select works: Next month shows only jobs in the coming calendar month; Current week and Current month show only jobs in that week or month; Last 3 months and Last 6 months show jobs from that far back up to today (no future jobs); Custom range shows the range picker, and a one-day range shows that whole day. Change the time zone in "Show times in" and check that the boundaries follow it.
- Clicking the headers Scheduled Date, Client Name, Cleaning Type and Rating sorts the list (Feedback is not sortable); a third click returns to newest first.
- Caching: go to page 2 and back to page 1, or switch a filter off and on again within 30 seconds: the rows appear at once and the network tab shows no new `get_cleaning_jobs` call. Open the same feedback modal twice: one `get_client_feedbacks_for_cleaning_job_id` call, not two. If the page shows a "No QueryClient set" error, stop and report.
- While you change a filter or sort, the browser's network tab shows one `get_cleaning_jobs` call per change (plus the four filter lists once when the page opens), not one call per row.

Report what you saw.

## Rollback

- Before commit: `git switch main && git branch -D feat/T3C-F35-Cleaning-Jobs-List`, then `pnpm db:reset`.
- After merge, if a hosted DB already has the migrations: add `0127_drop_cleaning_job_rpc.sql` containing `drop function public.get_cleaning_jobs(uuid[], uuid[], uuid[], uuid[], text, integer[], text, date, date, text, text, text, integer, integer);`, `drop function public.get_client_feedbacks_for_cleaning_job_id(uuid);`, `drop function public.get_complete_address_for_property_id(uuid);` and `drop function public.get_cleaners_for_cleaning_job_id(uuid);` (in that order), and `0128_drop_preferred_time_zone.sql` containing `alter table public.profiles drop column preferred_time_zone;` and `drop function public.is_valid_time_zone(text);` (in that order: the column check needs the function). Never edit or delete an applied migration.

## Conventional commits

Branch: `feat/T3C-F35-Cleaning-Jobs-List` (from `main`). Stage explicit paths only. Each commit leaves the suites green. Every commit ends with:

```
Refs: T3C-F35

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `feat(db): add preferred time zone and cleaning job functions`
   Files: `supabase/migrations/0027_profiles_preferred_time_zone.sql`, `supabase/migrations/0028_cleaning_job_rpc.sql`, `src/types/database.types.ts`
2. `test(db): cover preferred time zone and cleaning job functions`
   Files: `supabase/tests/database/preferred_time_zone.test.sql`, `supabase/tests/database/cleaning_job_rpc.test.sql`, `supabase/tests/database/get_cleaning_jobs.test.sql`, `supabase/tests/database/get_cleaning_jobs_date_range.test.sql`
3. `feat(web): add Cleaning Jobs list with filters and time zone`
   Files: `src/types/db.ts`, `src/App.tsx`, `src/features/cleaning-jobs/timeZone.ts`, `src/features/cleaning-jobs/api.ts`, `src/features/cleaning-jobs/hooks.ts`, `src/features/cleaning-jobs/filterChips.ts`, `src/features/cleaning-jobs/usePreferredTimeZone.ts`, `src/components/cleaning-jobs/TimeZonePicker.tsx`, `src/components/cleaning-jobs/CleaningJobFilterBar.tsx`, `src/components/cleaning-jobs/FeedbackModal.tsx`, `src/pages/cleaning-jobs/CleaningJobList.tsx`
4. `test(web): cover time zone formatting and cleaning job hooks`
   Files: `src/features/cleaning-jobs/timeZone.test.ts`, `src/features/cleaning-jobs/api.test.ts`, `src/features/cleaning-jobs/hooks.test.tsx`, `src/features/cleaning-jobs/filterChips.test.ts`
5. `docs(plans): add T3C-F35 plan`
   Files: `.claude/plans/backend/T3C-F35-Cleaning-Jobs-List.md`

PR title: `feat(web): add Cleaning Jobs list` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
