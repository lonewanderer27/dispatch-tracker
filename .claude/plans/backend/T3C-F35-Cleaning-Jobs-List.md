# T3C-F35 Cleaning Jobs list page, time zone setting, cleaning job functions and pill colours

> **Status: Approved and implemented** (Phase 1, Steps 0 to 11 and 9a, and Phase 2, Steps 12 to 23) on `feat/T3C-B15-B16-B18-B19-B26-B27-B33-F35-Cleaning-Jobs` (commits `e96c7e1`, `1e55628`, `eafe582`, `d62a47e`; seed `6de699a`, `af712e8`; test fixes `15eee50`, `71a288d`; Step 9a tests `ab6d39b`, `3811b35`, `1da0136`; docs `3c306eb`). Phase 2 (pill colours): commits `a7e078c`, `879706b`, `881d585`, `f7b66a6`, `1dd41d0`, `559a945`, `3defb5f`; the company colours were set by the owner from the logos (The Tidy Team `red`, Total Home Care `cyan`, Maids in Pink `magenta`, Diamond MIP `blue`). The Step 22 manual check in a browser has not been done.
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.
>
> **Phases.** Phase 1 (Steps 0 to 11) builds the list, the time zone setting and the functions. Phase 2 (Steps 12 to 23, section "Phase 2" below) adds a colour to the Company, Status and Cleaning Type pills. Gate totals after Phase 1: pgTAP 27 files and 403 tests, Vitest 14 files and 108 tests, Playwright `e2e/cleaning-jobs.spec.ts` 5 tests plus the setup. After Phase 2: pgTAP 28 files and 429 tests, Vitest 19 files and 132 tests, Playwright 18 tests in all (`cleaning-jobs.spec.ts` 6, `color-motifs.spec.ts` 2).

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
- Phase 2 (owner, 2026-11-27): companies, cleaning types and cleaning statuses get a `color_motif` column, and the Company, Status and Cleaning Type pills on the list show it. See "Phase 2" below.

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

1. Branch is `main`. Migrations are numbered `NNNN_name.sql`. This plan adds `supabase/migrations/0027_profiles_preferred_time_zone.sql` and `supabase/migrations/0028_cleaning_job_rpc.sql`, so migrations up to `0026` must already exist. The later table plans (T3C-B17, B26, B27, B28-29, B30, S31, B32) were renumbered to `0029` to `0034` to follow this plan, then shifted again to `0030` to `0035` because Phase 2 takes `0029`.
2. Required earlier migrations (plan that creates each): `0001_init.sql` (profiles); `0003_roles.sql` and `0004_app_permissions.sql` (T3C-B0); `0006_companies.sql` (T3C-B7-S8); `0007_clients.sql` (T3C-B6); `0009_cleaners.sql` (T3C-B9); `0011_cleaning_types.sql` and `0012_cleaning_statuses.sql` (T3C-B11-S12, T3C-B13-S14); `0019_properties.sql` (T3C-B21); `0022_cleaning_jobs.sql` (T3C-B15, with `created_at`); `0024_cleaning_job_assignments.sql` (T3C-B18); `0025_cleaning_feedbacks.sql` (T3C-B19; it must include `created_at`, see the T3C-B19 plan); `0026_cleaning_job_cleaning_types.sql` (T3C-B33). If any is missing, **stop and report**.
3. `public.profiles` (`0001_init.sql`) has `id`, `display_name`, `created_at` and `role_id` (from `0003`). Users can only update the columns they are granted: `grant update (display_name) on public.profiles to authenticated`. The policies `profiles_select_own` and `profiles_update_own` limit a user to their own row. `grant select on public.profiles to authenticated` is table wide, so a new column is readable without a new grant.
4. Function pattern (`0002_todo_stats.sql`): `language sql`, `stable`, `security invoker`, `set search_path = public`, then `revoke execute ... from public, anon` and `grant execute ... to authenticated`. The web side calls such a function through a helper that takes the client as an argument (`fetchTodoStats` in `src/features/integration/api.ts`) and is tested with a mocked `rpc`.
5. `src/App.tsx` holds the `resources` array (the sidebar is built from each resource's `meta.label` and `meta.icon`; the last entry today is `items`), the icon import block from `@ant-design/icons` (the last icon today is `ToolOutlined`), the page imports (the last one before `UserList` is `ItemEdit`) and the `<Routes>` block (the `/items` route is the last before `/users`).
6. `useList` (from `@refinedev/core`) with `pagination: { mode: 'off' }` loads a whole resource, as `src/pages/company-cleaners/CompanyCleanerList.tsx` does. Row types that are not plain tables live in `src/types/db.ts` (for example `UserRow`).
7. `@tanstack/react-query` (`^5.108.4`; `<Refine>` already provides the `QueryClientProvider` the hooks run under, which step 10 confirms in the browser) and `dayjs` (`^1.11.23`) are already direct dependencies. Dates are formatted with the browser's built-in `Intl.DateTimeFormat`; `dayjs` is used only to hand the custom range to the Ant Design `RangePicker`, which works with dayjs values. **No new dependency** is needed. `tsconfig.app.json` uses `lib: ["ES2023", "DOM"]`, which includes `Intl.supportedValuesOf`. The repo's ESLint rules forbid arrow functions that return a void expression and unnecessary conditions; the code below already follows them.
8. `cleaning_jobs.schedule` is `timestamptz not null` (T3C-B15). Postgres stores it in UTC and PostgREST returns it with an offset, so **no migration is needed for the storage requirement**; the page only formats it.
9. The local seed (`supabase/seed.sql`) already holds cleaning types (for example `Deep`) and the four cleaning statuses (`Booked` has id `10000000-0000-0000-0000-000000000001`). The pgTAP files below therefore use fixture names such as `Test Deep`, which do not collide with the seed.
10. `src/types/database.types.ts` is generated (`pnpm db:reset` regenerates it); never hand-edit it. It has no entry yet for `preferred_time_zone`, `get_complete_address_for_property_id`, `get_cleaners_for_cleaning_job_id` or `get_cleaning_jobs`.
11. How this plan was checked: on 2026-11-27 every file below was run in a scratch copy of the repo against the local stack: `pnpm db:reset`, `pnpm test:db` (26 files, 395 tests, `Result: PASS`), `pnpm typecheck`, `pnpm lint`, `npx prettier --check src` and `pnpm vitest run` (14 files, 108 tests, with the tests of Step 9a). The page itself was **not** opened in a browser (step 10 is the manual check).
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
- Tests above the data layer (added after review): Vitest component tests for the list page, the filter bar, the feedback modal, the time zone picker and `usePreferredTimeZone`, and a Playwright spec `e2e/cleaning-jobs.spec.ts` that runs against the seeded database (Step 9a).

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
- Visual (screenshot) tests.
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

### Step 9a. Component and end-to-end tests (create files)

These run against mocked hooks (Vitest) or the seeded database (Playwright). The Playwright spec changes the seeded user's time zone and puts it back to `America/Edmonton` before it ends, so it can be rerun. The date shown in the page test is pinned to a fixed device zone so it also passes on CI, which runs in UTC.

Create `src/features/cleaning-jobs/usePreferredTimeZone.test.tsx` with exactly this content:

```tsx
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePreferredTimeZone } from '@/features/cleaning-jobs/usePreferredTimeZone'

const useGetIdentity = vi.fn()
const useOne = vi.fn()
const useUpdate = vi.fn()
const mutate = vi.fn()

vi.mock('@refinedev/core', () => ({
  useGetIdentity: () => useGetIdentity() as unknown,
  useOne: (options: unknown) => useOne(options) as unknown,
  useUpdate: () => useUpdate() as unknown,
}))

beforeEach(() => {
  useGetIdentity.mockReturnValue({ data: { id: 'u1' } })
  useOne.mockReturnValue({ result: { preferred_time_zone: 'Australia/Sydney' } })
  useUpdate.mockReturnValue({ mutate, mutation: { isPending: false } })
})

describe('usePreferredTimeZone', () => {
  it('returns the saved zone once the profile has loaded', () => {
    const { result } = renderHook(() => usePreferredTimeZone())
    expect(result.current.timeZone).toBe('Australia/Sydney')
    expect(result.current.isLoaded).toBe(true)
    expect(useOne).toHaveBeenCalledWith(expect.objectContaining({ resource: 'profiles', id: 'u1' }))
  })

  it('falls back to Edmonton and reports not loaded before the profile arrives', () => {
    useOne.mockReturnValue({ result: undefined })
    const { result } = renderHook(() => usePreferredTimeZone())
    expect(result.current.timeZone).toBe('America/Edmonton')
    expect(result.current.isLoaded).toBe(false)
  })

  it('saves the new zone on the signed-in user profile', () => {
    const { result } = renderHook(() => usePreferredTimeZone())
    result.current.save('UTC')
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'profiles',
        id: 'u1',
        values: { preferred_time_zone: 'UTC' },
      }),
    )
  })

  it('does not save before the user is known', () => {
    useGetIdentity.mockReturnValue({ data: undefined })
    const { result } = renderHook(() => usePreferredTimeZone())
    result.current.save('UTC')
    expect(mutate).not.toHaveBeenCalled()
  })

  it('reports saving while the update is running', () => {
    useUpdate.mockReturnValue({ mutate, mutation: { isPending: true } })
    const { result } = renderHook(() => usePreferredTimeZone())
    expect(result.current.isSaving).toBe(true)
  })
})
```

Create `src/components/cleaning-jobs/TimeZonePicker.test.tsx` with exactly this content:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TimeZonePicker } from '@/components/cleaning-jobs/TimeZonePicker'
import { deviceTimeZone } from '@/features/cleaning-jobs/timeZone'

const device = deviceTimeZone()
const other = device === 'UTC' ? 'Australia/Sydney' : 'UTC'

describe('TimeZonePicker', () => {
  it('shows the chosen zone and names the device zone on the button', () => {
    render(<TimeZonePicker value={other} saving={false} onChange={vi.fn()} />)
    expect(screen.getByText('Show times in')).toBeInTheDocument()
    expect(screen.getByText(other)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: `Use my device time zone (${device})` }),
    ).toBeEnabled()
  })

  it('switches to the device zone when the button is pressed', async () => {
    const onChange = vi.fn()
    render(<TimeZonePicker value={other} saving={false} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /use my device time zone/i }))
    expect(onChange).toHaveBeenCalledWith(device)
  })

  it('disables the button when the device zone is already chosen', () => {
    render(<TimeZonePicker value={device} saving={false} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /use my device time zone/i })).toBeDisabled()
  })

  it('disables the button while saving', () => {
    render(<TimeZonePicker value={other} saving onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /use my device time zone/i })).toBeDisabled()
  })
})
```

Create `src/components/cleaning-jobs/FeedbackModal.test.tsx` with exactly this content:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackModal } from '@/components/cleaning-jobs/FeedbackModal'
import type { CleaningJobListRow } from '@/types/db'

const useClientFeedbacks = vi.fn()

vi.mock('@/features/cleaning-jobs/hooks', () => ({
  useClientFeedbacks: (...args: unknown[]) => useClientFeedbacks(...args) as unknown,
}))

const job = { id: 'j1', client_name: 'Xavier Ashby' } as CleaningJobListRow

beforeEach(() => {
  useClientFeedbacks.mockReturnValue({ data: [], isLoading: false, error: null })
})

describe('FeedbackModal', () => {
  it('asks for nothing and shows nothing while no job is chosen', () => {
    render(<FeedbackModal job={null} timeZone="UTC" onClose={vi.fn()} />)
    expect(useClientFeedbacks).toHaveBeenCalledWith(undefined)
    expect(screen.queryByText('Feedback')).not.toBeInTheDocument()
  })

  it('lists every feedback with its stars and the date in the chosen time zone', () => {
    useClientFeedbacks.mockReturnValue({
      data: [
        {
          id: 'f2',
          rating: 3,
          feedback: 'Missed the oven',
          created_at: '2026-12-06T10:00:00+00:00',
        },
        { id: 'f1', rating: 5, feedback: null, created_at: '2026-12-05T10:00:00+00:00' },
      ],
      isLoading: false,
      error: null,
    })
    render(<FeedbackModal job={job} timeZone="UTC" onClose={vi.fn()} />)
    expect(useClientFeedbacks).toHaveBeenCalledWith('j1')
    expect(screen.getByText('Feedback for Xavier Ashby')).toBeInTheDocument()
    expect(screen.getByText('Missed the oven')).toBeInTheDocument()
    expect(screen.getByText('No comment')).toBeInTheDocument()
    expect(screen.getByText('Sun 6 Dec 2026, 10:00 AM')).toBeInTheDocument()
    expect(screen.getByText('Sat 5 Dec 2026, 10:00 AM')).toBeInTheDocument()
    expect(screen.getAllByRole('radio', { checked: true }).length).toBeGreaterThan(0)
  })

  it('shows the database error', () => {
    useClientFeedbacks.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('denied'),
    })
    render(<FeedbackModal job={job} timeZone="UTC" onClose={vi.fn()} />)
    expect(screen.getByText('denied')).toBeInTheDocument()
  })

  it('calls onClose when the modal is dismissed', async () => {
    const onClose = vi.fn()
    render(<FeedbackModal job={job} timeZone="UTC" onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

Create `src/components/cleaning-jobs/CleaningJobFilterBar.test.tsx` with exactly this content:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CleaningJobFilterBar } from '@/components/cleaning-jobs/CleaningJobFilterBar'
import { EMPTY_FILTERS, type CleaningJobFilters } from '@/features/cleaning-jobs/api'

const rowsByResource: Record<string, { id: string; [key: string]: string }[]> = {
  cleaners: [{ id: 'k1', first_name: 'Zed', middle_name: '', last_name: 'Adams' }],
  companies: [{ id: 'co1', name: 'The Tidy Team' }],
  clients: [{ id: 'c1', name: 'Xavier Ashby' }],
  cleaning_types: [{ id: 't1', name: 'Deep' }],
}

vi.mock('@refinedev/core', () => ({
  useList: ({ resource }: { resource: string }) => ({
    result: { data: rowsByResource[resource] ?? [] },
  }),
}))

function setup(value: CleaningJobFilters = EMPTY_FILTERS) {
  const onChange = vi.fn()
  render(<CleaningJobFilterBar value={value} onChange={onChange} />)
  return onChange
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CleaningJobFilterBar', () => {
  it('lists the date choices in order, starting with All dates and Next month', () => {
    setup()
    const labels = screen.getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)
    expect(labels).toEqual([
      'All dates',
      'Next month',
      'Current week',
      'Current month',
      'Last 3 months',
      'Last 6 months',
      'Custom range',
    ])
  })

  it('picks a date range and clears any custom dates', async () => {
    const onChange = setup({
      ...EMPTY_FILTERS,
      dateRange: 'custom',
      dateFrom: '2026-12-01',
      dateTo: null,
    })
    await userEvent.click(screen.getByText('Last 3 months'))
    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      dateRange: 'last_3_months',
      dateFrom: null,
      dateTo: null,
    })
  })

  it('shows the range picker only for the custom range', () => {
    setup()
    expect(screen.queryByPlaceholderText('From date')).not.toBeInTheDocument()
  })

  it('shows the range picker for the custom range', () => {
    setup({ ...EMPTY_FILTERS, dateRange: 'custom' })
    expect(screen.getByPlaceholderText('From date')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('To date')).toBeInTheDocument()
  })

  it('searches the feedback when Enter is pressed', async () => {
    const onChange = setup()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search feedback' }), 'oven{Enter}')
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, feedbackSearch: 'oven' })
  })

  it('opens and closes the filters panel', async () => {
    setup()
    expect(screen.queryByText('Any cleaner')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /filters/i }))
    expect(screen.getByText('Any cleaner')).toBeInTheDocument()
    expect(screen.getByText('Any company')).toBeInTheDocument()
    expect(screen.getByText('Any client')).toBeInTheDocument()
    expect(screen.getByText('Any cleaning type')).toBeInTheDocument()
    expect(screen.getByText('Any rating')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /hide filters/i }))
    expect(screen.queryByText('Any cleaner')).not.toBeInTheDocument()
  })

  it('shows no active filters when nothing is set', () => {
    setup()
    expect(screen.queryByRole('group', { name: 'Active filters' })).not.toBeInTheDocument()
  })

  it('shows each active filter as a tag that can be removed', async () => {
    const onChange = setup({ ...EMPTY_FILTERS, clientIds: ['c1'], ratings: [4] })
    expect(screen.getByText('Client: Xavier Ashby')).toBeInTheDocument()
    expect(screen.getByText('Rating: 4 stars')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove Client: Xavier Ashby' }))
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, ratings: [4] })
  })

  it('clears every filter at once', async () => {
    const onChange = setup({ ...EMPTY_FILTERS, cleanerIds: ['k1'], dateRange: 'current_week' })
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS)
  })
})
```

Create `src/pages/cleaning-jobs/CleaningJobList.test.tsx` with exactly this content:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CleaningJobQuery } from '@/features/cleaning-jobs/api'
import { CleaningJobList } from '@/pages/cleaning-jobs/CleaningJobList'
import type { CleaningJobListRow } from '@/types/db'

const useCleaningJobs = vi.fn()
const save = vi.fn()

vi.mock('@refinedev/antd', () => ({
  List: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock('@refinedev/core', () => ({ useList: () => ({ result: { data: [] } }) }))
vi.mock('@/features/cleaning-jobs/hooks', () => ({
  useCleaningJobs: (...args: unknown[]) => useCleaningJobs(...args) as unknown,
  useClientFeedbacks: () => ({
    data: [
      { id: 'f2', rating: 3, feedback: 'Missed the oven', created_at: '2026-12-06T10:00:00+00:00' },
      { id: 'f1', rating: 5, feedback: 'Great clean', created_at: '2026-12-05T10:00:00+00:00' },
    ],
    isLoading: false,
    error: null,
  }),
}))
// CI runs in UTC; pin the device zone so the "use my device time zone" button is enabled there too.
vi.mock('@/features/cleaning-jobs/timeZone', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/cleaning-jobs/timeZone')>()),
  deviceTimeZone: () => 'Australia/Sydney',
}))
vi.mock('@/features/cleaning-jobs/usePreferredTimeZone', () => ({
  usePreferredTimeZone: () => ({ timeZone: 'UTC', isLoaded: true, save, isSaving: false }),
}))

function job(overrides: Partial<CleaningJobListRow> = {}): CleaningJobListRow {
  return {
    id: 'j1',
    schedule: '2026-12-01T09:00:00+00:00',
    rate: 150,
    description: '6 hr deep clean: oven',
    status_name: 'Booked',
    client_id: 'c1',
    client_name: 'Xavier Ashby',
    company_name: 'The Tidy Team',
    address: '12 Maple Ridge Crescent, Edmonton, AB, T5J 0N3, CA',
    cleaners: [{ cleaner_id: 'k1', full_name: 'Zed Adams' }],
    cleaning_types: ['Deep', 'Move-Out'],
    feedbacks: [],
    avg_rating: null,
    total_count: 1,
    ...overrides,
  }
}

function lastQuery(): CleaningJobQuery {
  const call = useCleaningJobs.mock.calls.at(-1) as [CleaningJobQuery, string, boolean]
  return call[0]
}

beforeEach(() => {
  useCleaningJobs.mockReturnValue({
    data: { rows: [job()], total: 1 },
    isFetching: false,
    error: null,
  })
})

describe('CleaningJobList', () => {
  it('shows every column, in order', () => {
    render(<CleaningJobList />)
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)
    expect(headers).toEqual([
      'Assignee',
      'Company',
      'Status',
      'Scheduled Date',
      'Client Name',
      'Address',
      'Cleaning Type',
      'Notes',
      'Feedback',
      'Rating',
      'Rate (CAD)',
    ])
  })

  it('shows a job with its cleaners, types, date in the chosen zone and rate in CAD', () => {
    render(<CleaningJobList />)
    const row = screen.getByRole('row', { name: /Xavier Ashby/ })
    expect(within(row).getByText('Zed Adams')).toBeInTheDocument()
    expect(within(row).getByText('Deep')).toBeInTheDocument()
    expect(within(row).getByText('Move-Out')).toBeInTheDocument()
    expect(within(row).getByText('The Tidy Team')).toBeInTheDocument()
    expect(within(row).getByText('Booked')).toBeInTheDocument()
    expect(within(row).getByText('Tue 1 Dec 2026, 9:00 AM')).toBeInTheDocument()
    expect(within(row).getByText('$150.00')).toBeInTheDocument()
    expect(within(row).getByText('6 hr deep clean: oven')).toBeInTheDocument()
  })

  it('marks an unassigned job and a job without feedback', () => {
    useCleaningJobs.mockReturnValue({
      data: { rows: [job({ cleaners: [] })], total: 1 },
      isFetching: false,
      error: null,
    })
    render(<CleaningJobList />)
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  it('shows one feedback inline with its stars and the average for several', () => {
    useCleaningJobs.mockReturnValue({
      data: {
        rows: [
          job({
            id: 'j1',
            client_name: 'Single Feedback',
            feedbacks: [
              { rating: 4, feedback: 'Very good', created_at: '2026-12-02T10:00:00+00:00' },
            ],
            avg_rating: 4,
          }),
        ],
        total: 1,
      },
      isFetching: false,
      error: null,
    })
    render(<CleaningJobList />)
    const row = screen.getByRole('row', { name: /Single Feedback/ })
    expect(within(row).getByText('Very good')).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: /view all/i })).not.toBeInTheDocument()
  })

  it('opens every feedback of a job with several in a modal', async () => {
    useCleaningJobs.mockReturnValue({
      data: {
        rows: [
          job({
            feedbacks: [
              { rating: 3, feedback: 'Missed the oven', created_at: '2026-12-06T10:00:00+00:00' },
              { rating: 5, feedback: 'Great clean', created_at: '2026-12-05T10:00:00+00:00' },
            ],
            avg_rating: 4,
          }),
        ],
        total: 1,
      },
      isFetching: false,
      error: null,
    })
    render(<CleaningJobList />)
    expect(screen.getByText('avg of 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'View all (2)' }))
    expect(screen.getByText('Feedback for Xavier Ashby')).toBeInTheDocument()
    expect(screen.getByText('Missed the oven')).toBeInTheDocument()
    expect(screen.getByText('Great clean')).toBeInTheDocument()
  })

  it('asks for the newest jobs first with the default query and the saved time zone', () => {
    render(<CleaningJobList />)
    expect(lastQuery()).toMatchObject({
      sortBy: 'schedule',
      sortDir: 'desc',
      page: 1,
      pageSize: 10,
    })
    const call = useCleaningJobs.mock.calls.at(-1) as [CleaningJobQuery, string, boolean]
    expect(call[1]).toBe('UTC')
    expect(call[2]).toBe(true)
  })

  it('sorts by a column and returns to page 1', async () => {
    render(<CleaningJobList />)
    await userEvent.click(screen.getByRole('columnheader', { name: 'Client Name' }))
    expect(lastQuery()).toMatchObject({ sortBy: 'client', sortDir: 'asc', page: 1 })
    await userEvent.click(screen.getByRole('columnheader', { name: 'Client Name' }))
    expect(lastQuery()).toMatchObject({ sortBy: 'client', sortDir: 'desc' })
    await userEvent.click(screen.getByRole('columnheader', { name: 'Client Name' }))
    expect(lastQuery()).toMatchObject({ sortBy: 'schedule', sortDir: 'desc' })
  })

  it('does not offer sorting on feedback', () => {
    render(<CleaningJobList />)
    expect(screen.getByRole('columnheader', { name: 'Feedback' })).not.toHaveClass(
      'ant-table-column-has-sorters',
    )
  })

  it('filters by a date range and shows the empty state with a way back', async () => {
    useCleaningJobs.mockImplementation((query: CleaningJobQuery) => ({
      data:
        query.filters.dateRange === 'all' ? { rows: [job()], total: 1 } : { rows: [], total: 0 },
      isFetching: false,
      error: null,
    }))
    render(<CleaningJobList />)
    await userEvent.click(screen.getByText('Next month'))
    expect(lastQuery().filters.dateRange).toBe('next_month')
    expect(screen.getByText('No jobs match these filters')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(lastQuery().filters.dateRange).toBe('all')
    expect(screen.getByText('Xavier Ashby')).toBeInTheDocument()
  })

  it('shows the database error', () => {
    useCleaningJobs.mockReturnValue({
      data: undefined,
      isFetching: false,
      error: new Error('denied'),
    })
    render(<CleaningJobList />)
    expect(screen.getByText('denied')).toBeInTheDocument()
  })

  it('saves a new time zone from the picker', async () => {
    render(<CleaningJobList />)
    await userEvent.click(screen.getByRole('button', { name: /use my device time zone/i }))
    expect(save).toHaveBeenCalledWith('Australia/Sydney')
  })
})
```

Create `e2e/cleaning-jobs.spec.ts` with exactly this content:

```ts
import { test, expect, type Page } from '@playwright/test'

// Local seed only (supabase/seeds/04_cleaning_jobs.sql): hundreds of jobs from Aug to Dec 2026.
async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByRole('link', { name: 'Cleaning Jobs' })).toBeVisible()
}

async function openCleaningJobs(page: Page) {
  await page.getByRole('link', { name: 'Cleaning Jobs' }).click()
  await expect(page.getByRole('columnheader', { name: 'Scheduled Date' })).toBeVisible()
  await expect(page.locator('tbody tr.ant-table-row').first()).toBeVisible()
}

// Types into the zone select so the option is rendered (the list has hundreds of zones).
async function chooseZone(page: Page, zone: string) {
  const select = page.getByTestId('time-zone-select')
  // Click the select itself: the selected value sits on top of its search input.
  await select.click()
  await page.keyboard.type(zone)
  // The option text is also repeated in a hidden accessibility list, so target the visible option.
  await page
    .locator(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content',
    )
    .getByText(zone, { exact: true })
    .click()
}

function dataRows(page: Page) {
  return page.locator('tbody tr.ant-table-row')
}

test.describe('Cleaning Jobs', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('lists the jobs with every column, newest first, ten to a page', async ({ page }) => {
    await signIn(page, 'user@example.com', 'user-password-123')
    await openCleaningJobs(page)

    const headers = await page.getByRole('columnheader').allTextContents()
    expect(headers).toEqual([
      'Assignee',
      'Company',
      'Status',
      'Scheduled Date',
      'Client Name',
      'Address',
      'Cleaning Type',
      'Notes',
      'Feedback',
      'Rating',
      'Rate (CAD)',
    ])
    await expect(dataRows(page)).toHaveCount(10)
    // Rates are shown in Canadian dollars.
    await expect(dataRows(page).first().getByText(/^\$\d/)).toBeVisible()
    // Hundreds of jobs: the pager shows more than one page.
    await expect(page.locator('.ant-pagination-item').last()).not.toHaveText('1')
  })

  test('filters by date range, cleaning type and feedback, and clears them', async ({ page }) => {
    await signIn(page, 'user@example.com', 'user-password-123')
    await openCleaningJobs(page)

    await page.getByText('Last 6 months', { exact: true }).click()
    const filters = page.getByRole('group', { name: 'Active filters' })
    await expect(filters.getByText('Scheduled: Last 6 months')).toBeVisible()

    await page.getByRole('button', { name: 'Filters' }).click()
    const type = page.getByRole('combobox', { name: 'Cleaning type' })
    await type.click()
    await type.fill('Deep')
    await page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
      .getByText('Deep', { exact: true })
      .click()
    await expect(filters.getByText('Cleaning type: Deep')).toBeVisible()
    // Every row that is left has the Deep tag.
    await expect(dataRows(page).first()).toBeVisible()
    const rows = await dataRows(page).count()
    for (let i = 0; i < rows; i++) {
      await expect(
        dataRows(page)
          .nth(i)
          .locator('.ant-tag', { hasText: /^Deep$/ }),
      ).toBeVisible()
    }

    await page.getByRole('searchbox', { name: 'Search feedback' }).fill('excellent')
    await page.getByRole('searchbox', { name: 'Search feedback' }).press('Enter')
    await expect(filters.getByText(/Feedback: .excellent./)).toBeVisible()

    await filters.getByRole('button', { name: 'Clear all' }).click()
    await expect(filters).toHaveCount(0)
    await expect(dataRows(page)).toHaveCount(10)
  })

  test('shows an empty state when nothing matches and a way back', async ({ page }) => {
    await signIn(page, 'user@example.com', 'user-password-123')
    await openCleaningJobs(page)

    await page.getByRole('searchbox', { name: 'Search feedback' }).fill('zzzz no such feedback')
    await page.getByRole('searchbox', { name: 'Search feedback' }).press('Enter')
    await expect(page.getByText('No jobs match these filters')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(dataRows(page)).toHaveCount(10)
  })

  test('sorts by a column and returns to newest first on the third click', async ({ page }) => {
    await signIn(page, 'user@example.com', 'user-password-123')
    await openCleaningJobs(page)

    const header = page.getByRole('columnheader', { name: 'Client Name' })
    await header.click()
    await expect(header).toHaveAttribute('aria-sort', 'ascending')
    await header.click()
    await expect(header).toHaveAttribute('aria-sort', 'descending')
    await header.click()
    await expect(header).not.toHaveAttribute('aria-sort', /ascending|descending/)
    await expect(page.getByRole('columnheader', { name: 'Scheduled Date' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
    // Feedback is not sortable.
    await expect(page.getByRole('columnheader', { name: 'Feedback' })).not.toHaveClass(
      /ant-table-column-has-sorters/,
    )
  })

  test('shows the schedule in the time zone the user chooses and remembers it', async ({
    page,
  }) => {
    await signIn(page, 'user@example.com', 'user-password-123')
    await openCleaningJobs(page)

    const firstDate = () => dataRows(page).first().locator('td').nth(3)
    const select = page.getByTestId('time-zone-select')
    await expect(select).toContainText('America/Edmonton')
    const edmonton = await firstDate().textContent()

    try {
      await chooseZone(page, 'UTC')
      await expect(select).toContainText('UTC')
      await expect(firstDate()).not.toHaveText(edmonton ?? '')

      // The choice is saved on the profile, so it survives a reload.
      await page.reload()
      await expect(page.getByTestId('time-zone-select')).toContainText('UTC')
    } finally {
      // Put the seeded user back to the default so reruns start the same way.
      await chooseZone(page, 'America/Edmonton')
      await expect(page.getByTestId('time-zone-select')).toContainText('America/Edmonton')
    }
  })
})
```

**Gate:** `pnpm test && pnpm exec playwright test e2e/cleaning-jobs.spec.ts`
**Expect:** Vitest reports 14 files and 108 tests, all passing (the new files add 5 files and 33 tests); Playwright reports `6 passed` (the setup plus 5 tests). If a test fails, stop and report.

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

### Step 11. Document the architecture (create files)

The decisions in this plan are architectural (data access, the stored time zone and the seed). They are written up in `docs/architecture/0004-Cleaning-Jobs-List-Function.md`, `0005-Preferred-Time-Zone.md` and `0006-Local-Seed-Data.md`; the job tables are in `0003-Cleaning-Job-Data-Model.md`. Each starts with the ticket, the plan path, the date and the status, and `README.md` links to all four.

**Gate:** `ls docs/architecture`
**Expect:** the files `0003` to `0006` are listed. `README.md` links to them.

## Phase 2: colour motifs on the pills (Steps 12 to 23)

> **For the implementer:** Phase 2 starts only after Phase 1 (Steps 0 to 11) is committed. Follow Steps 12 to 23 in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Phase 2 Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked. Edits are applied in the order given; the line number of an edit is its line in the file after the earlier edits to that file.

### Why (Phase 2)

Source: owner request in conversation (2026-11-27): "add new column called color_motif to each of the resources (cleaning types, cleaning statuses, companies), to use as the distinguishing factor on the pills ... make sure to implement this with tests as well."

- Story: "As a dispatcher, I want the Company, Status and Cleaning Type pills on the Cleaning Jobs list to have their own colours, so that I can tell them apart at a glance."
- Acceptance:
  - `companies`, `cleaning_types` and `cleaning_statuses` each get a `color_motif` column. Only the palette values are accepted; a new row gets `default`.
  - An Admin or Super Admin picks the colour on the Create and Edit pages of each resource. A User cannot change it.
  - The Cleaning Jobs list shows Company, Status and each Cleaning Type as an Ant Design `Tag` in its colour. The pill keeps its text, so colour is never the only signal.
  - The local seed gives every seeded company, cleaning type and status its own colour.
  - pgTAP, Vitest and Playwright tests cover the column, the seed, the function, the forms and the list.

### Facts (verified 2026-11-27, Phase 2)

1. Phase 2 runs on the branch Phase 1 landed on, `feat/T3C-B15-B16-B18-B19-B33-F35-Cleaning-Jobs` (not merged). The last migration is `supabase/migrations/0028_cleaning_job_rpc.sql`, so this phase adds `0029_color_motifs.sql`. The later table plans (T3C-B17, B26, B27, B28-29, B30, S31, B32) and the "plans now run to" note in T3C-B0 were shifted by one to `0030` to `0035` (rollbacks `0130` to `0135`) in the same change as this phase. Phase 1's rollbacks are `0127` and `0128`; Phase 2's is `0129`.
2. `0006_companies.sql`, `0011_cleaning_types.sql` and `0012_cleaning_statuses.sql` create tables with only `id` and `name` (unique). Their update policies are `<table>_update ... using ((select public.has_permission('<table>', 'update')))`, and `app_permissions` gives `update` to Admin (`30000000-...-0001`) and Super Admin (`...-0003`) only; User (`...-0002`) reads only. These migrations belong to older tickets and are **not** edited.
3. `0028_cleaning_job_rpc.sql` lines 75 to 246 define `get_cleaning_jobs` (14 arguments, `returns table (...)` at line 91, `company_name text` at line 99). Line 227 builds `cleaning_types` as `jsonb_agg(ct.name order by ct.name)` (a list of strings). Lines 254 and 255 revoke and grant execute. `create or replace` cannot change a function's returned columns, so the function is dropped and created again.
4. `supabase/seeds/02_reference_data.sql`: companies insert at line 5 and cleaning types at line 13 use `on conflict (name) do nothing`; statuses at line 24 insert fixed ids with `on conflict do nothing`. `04_cleaning_jobs.sql` looks up companies, types and statuses by name and needs no change.
5. `src/pages/cleaning-jobs/CleaningJobList.tsx` line 126 is the Company column (`dataIndex="company_name"`), line 127 the Status column, line 155 maps `record.cleaning_types` (strings) to `<Tag>`. `Tag` stays imported: line 120 still uses it for the cleaners.
6. `src/types/db.ts` line 41 overrides `cleaning_types: string[]` on `CleaningJobListRow`. `company_color` and `status_color` come from the generated type as `string`.
7. The Create and Edit pages of the three resources (`src/pages/{companies,cleaning-types,cleaning-statuses}/`) are one `Form` with a `Name` item and use Refine's `useForm`. Routes are `/companies`, `/cleaning-types` and `/cleaning-statuses`. `src/providers/accessControlProvider.ts` line 11 (`ADMIN_WRITE_ONLY`) hides the write buttons from a User for `cleaning_types` and `cleaning_statuses`, but not for `companies` (unchanged here, see open question 1; the database still refuses a User's change).
8. Ant Design 5 (`antd ^5.29.3`): `<Tag color="blue">` renders the class `ant-tag-blue`, and `color="default"` renders `ant-tag-default` (the grey tag). Both are checked by the Vitest tests below.
9. `tsconfig.app.json` has `types: ["vite/client"]` and no Node types, so a Vitest file cannot use `node:fs`. `import.meta.glob(..., { query: '?raw', import: 'default', eager: true })` (typed by `vite/client`) reads files as text inside Vitest; `colorMotif.test.ts` uses it to read the migrations.
10. `supabase/tests/database/cleaning_jobs.test.sql` line 84 reads `(select cleaning_status_id from public.cleaning_jobs limit 1)`, which returns whichever row is first on disk. With this phase's migration and seed the first row is a seeded demo job with status Confirmed, and the test "new jobs default to the Booked status" fails (observed on 2026-11-27). Step 15 points it at the test's own job.
11. In jsdom an Ant Design `Select` renders only part of a virtual option list, so `ColorMotifSelect` sets `virtual={false}` (12 options). In Chromium, clicking the `combobox` input of a select that shows a value times out because the chosen pill sits on top of it; the Playwright spec clicks the `.ant-select` element instead.
12. How Phase 2 was checked: on 2026-11-27 every file below was applied to a scratch copy of the repo (Phase 1 files included) and run against the local stack: `pnpm db:reset`, `pnpm test:db` (28 files, 429 tests, `Result: PASS`), `npx prettier --check src e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (19 files, 132 tests) and `pnpm exec playwright test` (18 tests: 17 passed; `edge-function.spec.ts` failed only because the edge runtime was not running). The colour spec was run twice in a row and passed both times. Every find/replace pair below was checked to apply once to the current files and to give exactly the tested files. Playwright ran against a dev server on port 5199 (`E2E_BASE_URL=http://127.0.0.1:5199`) because another checkout's server was on port 5173; the default config needs nothing else. The rollback migration in "Rollback (Phase 2)" was run inside a transaction and rolled back. The pages were **not** checked by eye (Step 22 is the manual check).

### Decisions already made (do not reopen)

- **Palette (owner and reviewer, 2026-11-27).** Ant Design's preset tag colours `magenta`, `red`, `volcano`, `orange`, `gold`, `lime`, `green`, `cyan`, `blue`, `geekblue`, `purple`, plus `default` (the neutral grey tag), in that order with `default` first. They work with `Tag color`, adapt to the light and dark themes and leave no free-form hex to validate.
- **Column.** `color_motif text not null default 'default'` on each table, with a check constraint `<table>_color_motif_valid` = `color_motif = any (public.color_motifs())`. Spelling follows the owner: the column is `color_motif` and the form label is "Color"; prose in comments may say colour.
- **One list per side, compared by a test.** The database list is the function `public.color_motifs()` (immutable, `search_path = ''`, executable by `authenticated` because a check constraint runs with the writer's rights). The web list is `COLOR_MOTIFS` in `src/features/color-motif/colorMotif.ts`. The comparison: `colorMotif.test.ts` (Vitest, no database) reads every migration with `import.meta.glob`, takes the `array[...]` of the newest one that runs `create [or replace] function public.color_motifs()`, and expects it to equal `COLOR_MOTIFS` in order; `color_motifs.test.sql` (pgTAP) expects `public.color_motifs()` to equal the same literal and checks that all three constraints call the function. A change on one side only fails one of the two suites.
- **Who can change a colour.** No new policy or grant: the existing update policies already allow Admin and Super Admin and filter out a User. pgTAP proves both.
- **`get_cleaning_jobs` (owner and reviewer).** Migration `0029` drops and recreates it with the same 14 arguments, filters, sorts and paging. It adds `company_color` and `status_color` (after `company_name`), and each `cleaning_types` item becomes `{"name": ..., "color": ...}` ordered by name. The cleaning type sort still uses the names. Its revoke and grant are given again (a drop removes them). `0028` is not edited.
- **Seed colours.** Companies, chosen by the owner from the logos (2026-11-27): The Tidy Team `red` (the palette has no maroon, and `red` is the closest preset to the maroon the owner asked for), Total Home Care `cyan` (teal), Maids in Pink `magenta` (pink), Diamond MIP `blue` (the blue lettering of the Diamond Cleaning logo). Cleaning types: Regular `lime`, Deep `purple`, Move-In `cyan`, Move-Out `orange`, Construction `gold`, 1500+ Square Feet `geekblue`, Diamond Cleaning `magenta`. Statuses by life cycle: Booked `blue`, Confirmed `cyan`, In Progress `orange`, Done `green`. Distinct within each resource; `red` and `default` are left free. Companies and types use `on conflict (name) do update set color_motif = excluded.color_motif`; statuses use `on conflict (id) do update ...` because their ids are fixed and `cleaning_jobs` defaults to the Booked id (a name conflict target would fail on an id clash). A re-run of the seed puts the seeded colours back.
- **Web structure.** The palette module lives in a shared `src/features/color-motif/` (not `cleaning-jobs/`) because four resources use it. `ColorMotifTag` (the only place a pill colour is drawn; unknown values fall back to `default`) and `ColorMotifSelect` (the "Color" field; each option is the pill itself with its name) live in `src/components/color-motif/`. `src/pages/` keeps only Create, Edit and List pages.
- **Forms.** Each Create page gets a required "Color" item with `initialValue` `default`, so a new row always sends `color_motif`. Each Edit page gets the same item without an initial value (the record supplies it). A stored value the palette does not know shows as "Grey (default)".
- **Resource lists.** The Name column of the companies, cleaning types and cleaning statuses lists renders the name as its pill (four lines each), so an Admin sees the result of a change at once.
- **Jobs list.** Company, Status and each Cleaning Type render through `ColorMotifTag`. The cleaners (Assignee) keep the plain tag. Column order and headers do not change.
- **Test fix.** The fragile `limit 1` in `cleaning_jobs.test.sql` (Fact 10) is fixed in its own commit, before the migration.
- **Commit 2 carries the web follow-up of the row shape.** The generated row type gains required columns and `cleaning_types` changes shape, so the database change, the type override, the page and its test fixture land in one commit; otherwise that commit would fail `pnpm typecheck` and Playwright.

### Open questions (do not block)

1. `companies` is not in `ADMIN_WRITE_ONLY` (Fact 7), so a User sees Create and Edit buttons on Companies (the database refuses the save). Adding it is a one-line change to `accessControlProvider.ts` and its test; left for the owner.
2. The seed colours are a first pick. The owner can change them in `02_reference_data.sql` (and the expected pairs in `color_motifs.test.sql`).
3. The filter bar options and the active filter chips are not coloured. They can use `ColorMotifTag` later if wanted.
4. Rows created on a hosted database start as `default` until an Admin picks a colour.

### Out of scope (Phase 2)

- Free-form or hex colours, a colour picker, or per-user colours.
- Colours for cleaners, clients or any other table.
- Colour in the filter bar, the filter chips or the feedback modal.
- Changes to `accessControlProvider.ts`, `04_cleaning_jobs.sql`, `0006`, `0011`, `0012` and `0028`.
- Visual (screenshot) or contrast tests.

### Step 12. Baseline and backup

```bash
git status --short && git branch --show-current && git log --oneline -1 -- e2e/cleaning-jobs.spec.ts && ls supabase/migrations | tail -1 && pnpm db:start
```

**Expect:** `git status --short` prints nothing (or only files under `.claude/plans/`); the branch is `feat/T3C-B15-B16-B18-B19-B33-F35-Cleaning-Jobs`; `git log` prints one commit (Phase 1 is committed); the last migration is `0028_cleaning_job_rpc.sql`. Anything else: stop and report.

Back up the local data first (the migration changes three tables):

```bash
pnpm exec supabase db dump --local --data-only -f /tmp/dispatch-before-0029.sql
```

**Gate:** `pnpm db:reset && pnpm test:db && pnpm test`
**Expect:** the dump command prints `Dumped schema to /tmp/dispatch-before-0029.sql`; `test:db` reports `Files=27, Tests=403` and `Result: PASS`; Vitest reports 14 files and 108 tests, all passing. Anything else: stop and report.

### Step 13. Migration: color_motif columns and get_cleaning_jobs (create file)

Create `supabase/migrations/0029_color_motifs.sql` with exactly this content:

```sql
-- 0029_color_motifs: a colour for the pills of companies, cleaning types and cleaning statuses.

-- The palette: Ant Design's preset tag colours plus 'default' (the neutral grey tag). This function
-- is the only copy of the list in the database. The web has the only other copy, COLOR_MOTIFS in
-- src/features/color-motif/colorMotif.ts, and colorMotif.test.ts fails when the two differ (it reads
-- the array below from the newest migration that defines this function). To change the palette, add
-- a migration that replaces this function, then update COLOR_MOTIFS.
create function public.color_motifs()
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select array[
    'default', 'magenta', 'red', 'volcano', 'orange', 'gold',
    'lime', 'green', 'cyan', 'blue', 'geekblue', 'purple'
  ]::text[];
$$;

-- The check constraints below call it as the user who writes the row, so authenticated needs it.
revoke execute on function public.color_motifs() from public, anon;
grant  execute on function public.color_motifs() to authenticated;

-- Existing rows get 'default'; 02_reference_data.sql gives the seeded rows their colours. The
-- existing update policies (has_permission ... 'update') decide who may change a colour: Admin and
-- Super Admin, not User.
alter table public.companies
  add column color_motif text not null default 'default'
    constraint companies_color_motif_valid
    check (color_motif = any (public.color_motifs()));

alter table public.cleaning_types
  add column color_motif text not null default 'default'
    constraint cleaning_types_color_motif_valid
    check (color_motif = any (public.color_motifs()));

alter table public.cleaning_statuses
  add column color_motif text not null default 'default'
    constraint cleaning_statuses_color_motif_valid
    check (color_motif = any (public.color_motifs()));

-- get_cleaning_jobs (0028) now also returns the colour of each pill. A function's return type
-- cannot change with "create or replace", so it is dropped and created again with the same
-- arguments, filters, sorts and paging; only the returned columns change. Its grants go with it,
-- so they are given again below.
drop function public.get_cleaning_jobs(uuid[], uuid[], uuid[], uuid[], text, integer[], text, date, date, text, text, text, integer, integer);

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
--   * company_color and status_color are the color_motif of the job's company and status; each
--     cleaning_types item is {"name", "color"}, ordered by name.
-- security invoker: RLS on every table it reads still applies.
create function public.get_cleaning_jobs(
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

revoke execute on function public.get_cleaning_jobs(uuid[], uuid[], uuid[], uuid[], text, integer[], text, date, date, text, text, text, integer, integer) from public, anon;
grant  execute on function public.get_cleaning_jobs(uuid[], uuid[], uuid[], uuid[], text, integer[], text, date, date, text, text, text, integer, integer) to authenticated;
```

### Step 14. Seed colours (edit file)

Edit 1 of 3 in `supabase/seeds/02_reference_data.sql`. Find (it starts at line 4, `-- Reference data: the companies we operate under. Safe to run more than once.`):

```sql
-- Reference data: the companies we operate under. Safe to run more than once.
insert into public.companies (name) values
  ('The Tidy Team'),
  ('Total Home Care'),
  ('Maids in Pink'),
  ('Diamond MIP')
on conflict (name) do nothing;
```

Replace with:

```sql
-- Reference data: the companies we operate under, each with its pill colour (0029_color_motifs.sql).
-- Safe to run more than once: a re-run resets the colours to these values.
insert into public.companies (name, color_motif) values
  ('The Tidy Team', 'red'),
  ('Total Home Care', 'cyan'),
  ('Maids in Pink', 'magenta'),
  ('Diamond MIP', 'blue')
on conflict (name) do update set color_motif = excluded.color_motif;
```

Edit 2 of 3 in `supabase/seeds/02_reference_data.sql`. Find (it starts at line 13, `-- Reference data: cleaning types. Safe to run more than once.`):

```sql
-- Reference data: cleaning types. Safe to run more than once.
insert into public.cleaning_types (name) values
  ('Regular'),
  ('Deep'),
  ('Move-In'),
  ('Move-Out'),
  ('Construction'),
  ('1500+ Square Feet'),
  ('Diamond Cleaning')
on conflict (name) do nothing;
```

Replace with:

```sql
-- Reference data: cleaning types, each with its pill colour. Safe to run more than once.
insert into public.cleaning_types (name, color_motif) values
  ('Regular', 'lime'),
  ('Deep', 'purple'),
  ('Move-In', 'cyan'),
  ('Move-Out', 'orange'),
  ('Construction', 'gold'),
  ('1500+ Square Feet', 'geekblue'),
  ('Diamond Cleaning', 'magenta')
on conflict (name) do update set color_motif = excluded.color_motif;
```

Edit 3 of 3 in `supabase/seeds/02_reference_data.sql`. Find (it starts at line 24, `-- Reference data: job statuses, in life-cycle order. Fixed ids: cleaning_jobs defaults to Booked.`):

```sql
-- Reference data: job statuses, in life-cycle order. Fixed ids: cleaning_jobs defaults to Booked.
insert into public.cleaning_statuses (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Booked'),
  ('10000000-0000-0000-0000-000000000002', 'Confirmed'),
  ('10000000-0000-0000-0000-000000000003', 'In Progress'),
  ('10000000-0000-0000-0000-000000000004', 'Done')
on conflict do nothing;
```

Replace with:

```sql
-- Reference data: job statuses, in life-cycle order, coloured by life-cycle stage. Fixed ids:
-- cleaning_jobs defaults to Booked. Safe to run more than once.
insert into public.cleaning_statuses (id, name, color_motif) values
  ('10000000-0000-0000-0000-000000000001', 'Booked', 'blue'),
  ('10000000-0000-0000-0000-000000000002', 'Confirmed', 'cyan'),
  ('10000000-0000-0000-0000-000000000003', 'In Progress', 'orange'),
  ('10000000-0000-0000-0000-000000000004', 'Done', 'green')
on conflict (id) do update set color_motif = excluded.color_motif;
```

### Step 15. pgTAP tests (edit two files, create one)

Edit 1 of 1 in `supabase/tests/database/cleaning_jobs.test.sql`. Find (it starts at line 84, `(select cleaning_status_id from public.cleaning_jobs limit 1),`):

```sql
  (select cleaning_status_id from public.cleaning_jobs limit 1),
```

Replace with:

```sql
  (select cleaning_status_id from public.cleaning_jobs where client_id = 'c1000000-0000-0000-0000-000000000001'),
```

Edit 1 of 5 in `supabase/tests/database/get_cleaning_jobs.test.sql`. Find (it starts at line 9, `select plan(19);`):

```sql
select plan(19);
```

Replace with:

```sql
select plan(20);
```

Edit 2 of 5 in `supabase/tests/database/get_cleaning_jobs.test.sql`. Find (it starts at line 23, `--   J3 2026-12-03 client Xavier (Alpha Co): no cleaners, no types, no feedback`):

```sql
--   J3 2026-12-03 client Xavier (Alpha Co): no cleaners, no types, no feedback
insert into public.companies (id, name) values
  ('c0000000-0000-0000-0000-000000000001', 'Alpha Co'),
  ('c0000000-0000-0000-0000-000000000002', 'Beta Co');
```

Replace with:

```sql
--   J3 2026-12-03 client Xavier (Alpha Co): no cleaners, no types, no feedback
-- Colours (0029_color_motifs.sql): Alpha Co red, Beta Co default; Test Deep gold, Test Move-Out
-- default; every job keeps the default status Booked (blue in the seed).
insert into public.companies (id, name, color_motif) values
  ('c0000000-0000-0000-0000-000000000001', 'Alpha Co', 'red'),
  ('c0000000-0000-0000-0000-000000000002', 'Beta Co', 'default');
```

Edit 3 of 5 in `supabase/tests/database/get_cleaning_jobs.test.sql`. Find (it starts at line 47, `insert into public.cleaning_types (id, name) values`):

```sql
insert into public.cleaning_types (id, name) values
  ('c4000000-0000-0000-0000-000000000001', 'Test Deep'),
  ('c4000000-0000-0000-0000-000000000002', 'Test Move-Out');
```

Replace with:

```sql
insert into public.cleaning_types (id, name, color_motif) values
  ('c4000000-0000-0000-0000-000000000001', 'Test Deep', 'gold'),
  ('c4000000-0000-0000-0000-000000000002', 'Test Move-Out', 'default');
```

Edit 4 of 5 in `supabase/tests/database/get_cleaning_jobs.test.sql`. Find (it starts at line 174, `'["Test Deep", "Test Move-Out"]'::jsonb,`):

```sql
    '["Test Deep", "Test Move-Out"]'::jsonb,
```

Replace with:

```sql
    '[{"name": "Test Deep", "color": "gold"}, {"name": "Test Move-Out", "color": "default"}]'::jsonb,
```

Edit 5 of 5 in `supabase/tests/database/get_cleaning_jobs.test.sql`. Find (it starts at line 177, `'a row carries every display column, with the feedback newest first'`):

```sql
  'a row carries every display column, with the feedback newest first'
);
```

Replace with:

```sql
  'a row carries every display column, with the feedback newest first'
);

select results_eq(
  $$select id, company_color, status_color, cleaning_types from public.get_cleaning_jobs()$$,
  $$values
    ('c3000000-0000-0000-0000-000000000003'::uuid, 'red', 'blue', '[]'::jsonb),
    ('c3000000-0000-0000-0000-000000000002'::uuid, 'default', 'blue', '[{"name": "Test Move-Out", "color": "default"}]'::jsonb),
    ('c3000000-0000-0000-0000-000000000001'::uuid, 'red', 'blue', '[{"name": "Test Deep", "color": "gold"}, {"name": "Test Move-Out", "color": "default"}]'::jsonb)$$,
  'each row carries the colour of its company, its status and each cleaning type'
);
```

Create `supabase/tests/database/color_motifs.test.sql` with exactly this content:

```sql
-- pgTAP: color_motif on companies, cleaning_types and cleaning_statuses (0029_color_motifs.sql).
-- Palette, default, check constraint, seed colours and who may change a colour.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- The palette. This literal must equal COLOR_MOTIFS in src/features/color-motif/colorMotif.ts, in
-- the same order. colorMotif.test.ts compares COLOR_MOTIFS with the array in the newest migration
-- that defines public.color_motifs(), and this test compares that function with the literal, so a
-- change on either side fails one of the two suites.
select is(
  public.color_motifs(),
  array['default', 'magenta', 'red', 'volcano', 'orange', 'gold',
        'lime', 'green', 'cyan', 'blue', 'geekblue', 'purple']::text[],
  'color_motifs() is the Ant Design preset tag palette plus default'
);

-- Each table's check constraint uses the function, so there is one list in the database.
select set_eq(
  $$select conrelid::regclass::text from pg_constraint
    where conname like '%\_color\_motif\_valid' and contype = 'c'
      and pg_get_constraintdef(oid) like '%color_motifs()%'$$,
  $$values ('companies'), ('cleaning_types'), ('cleaning_statuses')$$,
  'each table checks color_motif against color_motifs()'
);

-- Column shape.
select col_not_null('public', 'companies', 'color_motif', 'companies.color_motif is required');
select col_not_null('public', 'cleaning_types', 'color_motif', 'cleaning_types.color_motif is required');
select col_not_null('public', 'cleaning_statuses', 'color_motif', 'cleaning_statuses.color_motif is required');

-- Fixture rows without a colour, inserted as the table owner (bypasses RLS).
insert into public.companies (id, name) values ('d0000000-0000-0000-0000-000000000001', 'Motif Co');
insert into public.cleaning_types (id, name) values ('d4000000-0000-0000-0000-000000000001', 'Motif Type');
insert into public.cleaning_statuses (id, name) values ('d7000000-0000-0000-0000-000000000001', 'Motif Status');

select is(
  (select color_motif from public.companies where id = 'd0000000-0000-0000-0000-000000000001'),
  'default', 'a new company gets the default colour'
);
select is(
  (select color_motif from public.cleaning_types where id = 'd4000000-0000-0000-0000-000000000001'),
  'default', 'a new cleaning type gets the default colour'
);
select is(
  (select color_motif from public.cleaning_statuses where id = 'd7000000-0000-0000-0000-000000000001'),
  'default', 'a new cleaning status gets the default colour'
);

-- The check rejects anything outside the palette (including a hex value and a different case).
select throws_ok(
  $$update public.companies set color_motif = 'pink' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'companies rejects a colour outside the palette'
);
select throws_ok(
  $$update public.cleaning_types set color_motif = '#ff0000' where id = 'd4000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'cleaning_types rejects a hex colour'
);
select throws_ok(
  $$update public.cleaning_statuses set color_motif = 'Blue' where id = 'd7000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'cleaning_statuses rejects a colour in the wrong case'
);

-- Every palette value is accepted by every table.
select lives_ok(
  $$insert into public.companies (name, color_motif)
    select 'Motif Co ' || m, m from unnest(public.color_motifs()) m$$,
  'companies accepts every palette colour'
);
select lives_ok(
  $$insert into public.cleaning_types (name, color_motif)
    select 'Motif Type ' || m, m from unnest(public.color_motifs()) m$$,
  'cleaning_types accepts every palette colour'
);
select lives_ok(
  $$insert into public.cleaning_statuses (name, color_motif)
    select 'Motif Status ' || m, m from unnest(public.color_motifs()) m$$,
  'cleaning_statuses accepts every palette colour'
);

-- Seed (02_reference_data.sql): every seeded row has its own, non-default colour.
select results_eq(
  $$select name, color_motif from public.companies
    where name in ('The Tidy Team', 'Total Home Care', 'Maids in Pink', 'Diamond MIP') order by name$$,
  $$values ('Diamond MIP', 'blue'), ('Maids in Pink', 'magenta'), ('The Tidy Team', 'red'), ('Total Home Care', 'cyan')$$,
  'the seeded companies have their colours'
);
select results_eq(
  $$select name, color_motif from public.cleaning_types
    where name in ('Regular', 'Deep', 'Move-In', 'Move-Out', 'Construction', '1500+ Square Feet', 'Diamond Cleaning') order by name$$,
  $$values ('1500+ Square Feet', 'geekblue'), ('Construction', 'gold'), ('Deep', 'purple'), ('Diamond Cleaning', 'magenta'), ('Move-In', 'cyan'), ('Move-Out', 'orange'), ('Regular', 'lime')$$,
  'the seeded cleaning types have their colours'
);
select results_eq(
  $$select name, color_motif from public.cleaning_statuses where id::text like '10000000-%' order by id$$,
  $$values ('Booked', 'blue'), ('Confirmed', 'cyan'), ('In Progress', 'orange'), ('Done', 'green')$$,
  'the seeded statuses are coloured by life-cycle stage'
);

-- Re-running the seed keeps one row per name and puts a changed colour back.
update public.cleaning_types set color_motif = 'red' where name = 'Deep';
insert into public.cleaning_types (name, color_motif) values ('Deep', 'purple')
on conflict (name) do update set color_motif = excluded.color_motif;
select results_eq(
  $$select count(*), min(color_motif) from public.cleaning_types where name = 'Deep'$$,
  $$values (1::bigint, 'purple')$$,
  'seeding again restores the colour without a duplicate'
);

-- Fixed test identities: Alice is a User, Carol an Admin.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'carol@test.local', '', '{}', '{}', now(), now(), '', '', '', '');
update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'cccccccc-0000-0000-0000-00000000000c';

-- Act as Alice (User role): the update policies filter her updates out, so nothing changes.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
update public.companies set color_motif = 'red' where id = 'd0000000-0000-0000-0000-000000000001';
update public.cleaning_types set color_motif = 'red' where id = 'd4000000-0000-0000-0000-000000000001';
update public.cleaning_statuses set color_motif = 'red' where id = 'd7000000-0000-0000-0000-000000000001';
reset role;

select is(
  (select color_motif from public.companies where id = 'd0000000-0000-0000-0000-000000000001'),
  'default', 'a User cannot change a company colour'
);
select is(
  (select color_motif from public.cleaning_types where id = 'd4000000-0000-0000-0000-000000000001'),
  'default', 'a User cannot change a cleaning type colour'
);
select is(
  (select color_motif from public.cleaning_statuses where id = 'd7000000-0000-0000-0000-000000000001'),
  'default', 'a User cannot change a cleaning status colour'
);

-- Act as Carol (Admin role): she can change a colour, but only to a palette value.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
update public.companies set color_motif = 'green' where id = 'd0000000-0000-0000-0000-000000000001';
update public.cleaning_types set color_motif = 'green' where id = 'd4000000-0000-0000-0000-000000000001';
update public.cleaning_statuses set color_motif = 'green' where id = 'd7000000-0000-0000-0000-000000000001';
select throws_ok(
  $$update public.cleaning_types set color_motif = 'pink' where id = 'd4000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'an Admin is held to the palette too'
);
reset role;

select is(
  (select color_motif from public.companies where id = 'd0000000-0000-0000-0000-000000000001'),
  'green', 'an Admin can change a company colour'
);
select is(
  (select color_motif from public.cleaning_types where id = 'd4000000-0000-0000-0000-000000000001'),
  'green', 'an Admin can change a cleaning type colour'
);
select is(
  (select color_motif from public.cleaning_statuses where id = 'd7000000-0000-0000-0000-000000000001'),
  'green', 'an Admin can change a cleaning status colour'
);

select * from finish();
rollback;
```

### Step 16. Gate: database

```bash
pnpm db:reset && grep -c '"color_motif' src/types/database.types.ts && grep -c '"company_color": string' src/types/database.types.ts
```

**Expect:** `db:reset` exits 0 with no SQL error and applies `0029_color_motifs.sql`; the first `grep` prints `9` (Row, Insert and Update of three tables) and the second prints `1`. Anything else: stop and report.

```bash
pnpm test:db
```

**Expect:** every file reports `ok`, the summary is `Files=28, Tests=429` and `Result: PASS`; `color_motifs.test.sql` runs 25 tests and `get_cleaning_jobs.test.sql` runs 20. If a test fails, stop and report; do not edit the test or the migration to make it pass.

### Step 17. Palette, pill and the jobs list (create three files, edit three)

Create `src/features/color-motif/colorMotif.ts` with exactly this content:

```ts
// The colours a company, cleaning type or cleaning status can show on its pill: Ant Design's preset
// tag colours plus 'default' (the neutral grey tag). Preset colours adapt to the light and dark
// themes, so there is no hex value to validate.
//
// This is the only copy of the list in the web code. The database has the only other copy,
// public.color_motifs() (supabase/migrations/0029_color_motifs.sql), and colorMotif.test.ts fails
// when the two differ. The order is the order of the options in ColorMotifSelect.
export const COLOR_MOTIFS = [
  'default',
  'magenta',
  'red',
  'volcano',
  'orange',
  'gold',
  'lime',
  'green',
  'cyan',
  'blue',
  'geekblue',
  'purple',
] as const

export type ColorMotif = (typeof COLOR_MOTIFS)[number]

export const DEFAULT_COLOR_MOTIF: ColorMotif = 'default'

// Names shown next to each swatch in ColorMotifSelect.
export const COLOR_MOTIF_LABELS: Record<ColorMotif, string> = {
  default: 'Grey (default)',
  magenta: 'Magenta',
  red: 'Red',
  volcano: 'Volcano',
  orange: 'Orange',
  gold: 'Gold',
  lime: 'Lime',
  green: 'Green',
  cyan: 'Cyan',
  blue: 'Blue',
  geekblue: 'Geek blue',
  purple: 'Purple',
}

export function isColorMotif(value: unknown): value is ColorMotif {
  return COLOR_MOTIFS.some((motif) => motif === value)
}

// Anything the palette does not know (null, an old or misspelt value) shows as the grey pill.
export function toColorMotif(value: unknown): ColorMotif {
  return isColorMotif(value) ? value : DEFAULT_COLOR_MOTIF
}
```

Create `src/components/color-motif/ColorMotifTag.tsx` with exactly this content:

```tsx
import type { ReactNode } from 'react'
import { Tag } from 'antd'
import { toColorMotif } from '@/features/color-motif/colorMotif'

interface Props {
  // The row's color_motif. An unknown or missing value shows the grey default pill.
  motif: string | null | undefined
  // The pill text. Colour is never the only signal, so the text is required.
  children: ReactNode
}

export function ColorMotifTag({ motif, children }: Props) {
  return <Tag color={toColorMotif(motif)}>{children}</Tag>
}
```

Create `src/components/color-motif/ColorMotifSelect.tsx` with exactly this content:

```tsx
import { Select } from 'antd'
import {
  COLOR_MOTIF_LABELS,
  COLOR_MOTIFS,
  toColorMotif,
  type ColorMotif,
} from '@/features/color-motif/colorMotif'
import { ColorMotifTag } from '@/components/color-motif/ColorMotifTag'

// Form.Item passes id, value and onChange; the id ties the select to the item's "Color" label.
interface Props {
  id?: string
  value?: string | null
  onChange?: (value: ColorMotif) => void
}

// Each option is the pill itself, so the admin sees the colour and its name together.
const OPTIONS = COLOR_MOTIFS.map((motif) => ({
  value: motif,
  label: <ColorMotifTag motif={motif}>{COLOR_MOTIF_LABELS[motif]}</ColorMotifTag>,
}))

export function ColorMotifSelect({ id, value, onChange }: Props) {
  return (
    <Select<ColorMotif>
      id={id}
      // Before the record loads the value is undefined; show nothing rather than a guess.
      value={value === undefined ? undefined : toColorMotif(value)}
      onChange={onChange}
      options={OPTIONS}
      // Twelve options: render them all (no virtual list), so every pill is in the page at once.
      virtual={false}
      style={{ maxWidth: 240 }}
    />
  )
}
```

Edit 1 of 1 in `src/types/db.ts`. Find (it starts at line 41, `cleaning_types: string[]`):

```ts
  cleaning_types: string[]
```

Replace with:

```ts
  // Each cleaning type's name and color_motif (0029_color_motifs.sql), ordered by name.
  cleaning_types: { name: string; color: string }[]
```

Edit 1 of 3 in `src/pages/cleaning-jobs/CleaningJobList.tsx`. Find (it starts at line 18, `import { TimeZonePicker } from '@/components/cleaning-jobs/TimeZonePicker'`):

```tsx
import { TimeZonePicker } from '@/components/cleaning-jobs/TimeZonePicker'
```

Replace with:

```tsx
import { TimeZonePicker } from '@/components/cleaning-jobs/TimeZonePicker'
import { ColorMotifTag } from '@/components/color-motif/ColorMotifTag'
```

Edit 2 of 3 in `src/pages/cleaning-jobs/CleaningJobList.tsx`. Find (it starts at line 127, `<Table.Column<CleaningJobListRow> title="Company" dataIndex="company_name" />`):

```tsx
        <Table.Column<CleaningJobListRow> title="Company" dataIndex="company_name" />
        <Table.Column<CleaningJobListRow> title="Status" dataIndex="status_name" />
```

Replace with:

```tsx
        <Table.Column<CleaningJobListRow>
          title="Company"
          render={(_, record) => (
            <ColorMotifTag motif={record.company_color}>{record.company_name}</ColorMotifTag>
          )}
        />
        <Table.Column<CleaningJobListRow>
          title="Status"
          render={(_, record) => (
            <ColorMotifTag motif={record.status_color}>{record.status_name}</ColorMotifTag>
          )}
        />
```

Edit 3 of 3 in `src/pages/cleaning-jobs/CleaningJobList.tsx`. Find (it starts at line 166, `{record.cleaning_types.map((name) => (`):

```tsx
              {record.cleaning_types.map((name) => (
                <Tag key={name}>{name}</Tag>
              ))}
```

Replace with:

```tsx
              {record.cleaning_types.map((type) => (
                <ColorMotifTag key={type.name} motif={type.color}>
                  {type.name}
                </ColorMotifTag>
              ))}
```

The page test follows the new row shape (two new fields and the cleaning type objects) and gains two pill tests:

Edit 1 of 3 in `src/pages/cleaning-jobs/CleaningJobList.test.tsx`. Find (it starts at line 45, `company_name: 'The Tidy Team',`):

```tsx
    company_name: 'The Tidy Team',
```

Replace with:

```tsx
    company_name: 'The Tidy Team',
    company_color: 'geekblue',
    status_color: 'blue',
```

Edit 2 of 3 in `src/pages/cleaning-jobs/CleaningJobList.test.tsx`. Find (it starts at line 50, `cleaning_types: ['Deep', 'Move-Out'],`):

```tsx
    cleaning_types: ['Deep', 'Move-Out'],
```

Replace with:

```tsx
    cleaning_types: [
      { name: 'Deep', color: 'purple' },
      { name: 'Move-Out', color: 'orange' },
    ],
```

Edit 3 of 3 in `src/pages/cleaning-jobs/CleaningJobList.test.tsx`. Find (it starts at line 106, `it('marks an unassigned job and a job without feedback', () => {`):

```tsx
  it('marks an unassigned job and a job without feedback', () => {
```

Replace with:

```tsx
  it('shows Company, Status and each Cleaning Type as a pill in its colour, text kept', () => {
    render(<CleaningJobList />)
    const row = screen.getByRole('row', { name: /Xavier Ashby/ })
    expect(within(row).getByText('The Tidy Team')).toHaveClass('ant-tag', 'ant-tag-geekblue')
    expect(within(row).getByText('Booked')).toHaveClass('ant-tag', 'ant-tag-blue')
    expect(within(row).getByText('Deep')).toHaveClass('ant-tag', 'ant-tag-purple')
    expect(within(row).getByText('Move-Out')).toHaveClass('ant-tag', 'ant-tag-orange')
  })

  it('shows a colour the palette does not know as the grey default pill', () => {
    useCleaningJobs.mockReturnValue({
      data: {
        rows: [
          job({
            company_color: 'pink',
            status_color: 'default',
            cleaning_types: [{ name: 'Deep', color: '#ff0000' }],
          }),
        ],
        total: 1,
      },
      isFetching: false,
      error: null,
    })
    render(<CleaningJobList />)
    const row = screen.getByRole('row', { name: /Xavier Ashby/ })
    expect(within(row).getByText('The Tidy Team')).toHaveClass('ant-tag-default')
    expect(within(row).getByText('The Tidy Team')).not.toHaveClass('ant-tag-pink')
    expect(within(row).getByText('Booked')).toHaveClass('ant-tag-default')
    expect(within(row).getByText('Deep')).toHaveClass('ant-tag-default')
  })

  it('marks an unassigned job and a job without feedback', () => {
```

**Gate:** `pnpm typecheck && pnpm exec vitest run src/pages/cleaning-jobs`
**Expect:** `tsc -b` exits 0; Vitest reports 1 file with 13 tests, all passing. Anything else: stop and report.

### Step 18. Color field on the forms and pills on the resource lists (edit nine files)

Edit 1 of 2 in `src/pages/companies/CompanyCreate.tsx`. Find (it starts at line 3, `import type { TablesInsert } from '@/types/db'`):

```tsx
import type { TablesInsert } from '@/types/db'
```

Replace with:

```tsx
import type { TablesInsert } from '@/types/db'
import { ColorMotifSelect } from '@/components/color-motif/ColorMotifSelect'
import { DEFAULT_COLOR_MOTIF } from '@/features/color-motif/colorMotif'
```

Edit 2 of 2 in `src/pages/companies/CompanyCreate.tsx`. Find (it starts at line 23, `</Form>`):

```tsx
      </Form>
```

Replace with:

```tsx
        <Form.Item
          label="Color"
          name="color_motif"
          initialValue={DEFAULT_COLOR_MOTIF}
          rules={[{ required: true, message: 'Color is required' }]}
        >
          <ColorMotifSelect />
        </Form.Item>
      </Form>
```

Edit 1 of 2 in `src/pages/companies/CompanyEdit.tsx`. Find (it starts at line 4, `TablesUpdate } from '@/types/db'`):

```tsx
TablesUpdate } from '@/types/db'
```

Replace with:

```tsx
TablesUpdate } from '@/types/db'
import { ColorMotifSelect } from '@/components/color-motif/ColorMotifSelect'
```

Edit 2 of 2 in `src/pages/companies/CompanyEdit.tsx`. Find (it starts at line 28, `</Form>`):

```tsx
      </Form>
```

Replace with:

```tsx
        <Form.Item
          label="Color"
          name="color_motif"
          rules={[{ required: true, message: 'Color is required' }]}
        >
          <ColorMotifSelect />
        </Form.Item>
      </Form>
```

Edit 1 of 2 in `src/pages/companies/CompanyList.tsx`. Find (it starts at line 3, `import type { Company } from '@/types/db'`):

```tsx
import type { Company } from '@/types/db'
```

Replace with:

```tsx
import type { Company } from '@/types/db'
import { ColorMotifTag } from '@/components/color-motif/ColorMotifTag'
```

Edit 2 of 2 in `src/pages/companies/CompanyList.tsx`. Find (it starts at line 15, `<Table.Column<Company> dataIndex="name" title="Name" sorter />`):

```tsx
        <Table.Column<Company> dataIndex="name" title="Name" sorter />
```

Replace with:

```tsx
        <Table.Column<Company>
          dataIndex="name"
          title="Name"
          sorter
          render={(name: string, record) => (
            <ColorMotifTag motif={record.color_motif}>{name}</ColorMotifTag>
          )}
        />
```

Edit 1 of 2 in `src/pages/cleaning-types/CleaningTypeCreate.tsx`. Find (it starts at line 3, `import type { TablesInsert } from '@/types/db'`):

```tsx
import type { TablesInsert } from '@/types/db'
```

Replace with:

```tsx
import type { TablesInsert } from '@/types/db'
import { ColorMotifSelect } from '@/components/color-motif/ColorMotifSelect'
import { DEFAULT_COLOR_MOTIF } from '@/features/color-motif/colorMotif'
```

Edit 2 of 2 in `src/pages/cleaning-types/CleaningTypeCreate.tsx`. Find (it starts at line 25, `</Form>`):

```tsx
      </Form>
```

Replace with:

```tsx
        <Form.Item
          label="Color"
          name="color_motif"
          initialValue={DEFAULT_COLOR_MOTIF}
          rules={[{ required: true, message: 'Color is required' }]}
        >
          <ColorMotifSelect />
        </Form.Item>
      </Form>
```

Edit 1 of 2 in `src/pages/cleaning-types/CleaningTypeEdit.tsx`. Find (it starts at line 4, `TablesUpdate } from '@/types/db'`):

```tsx
TablesUpdate } from '@/types/db'
```

Replace with:

```tsx
TablesUpdate } from '@/types/db'
import { ColorMotifSelect } from '@/components/color-motif/ColorMotifSelect'
```

Edit 2 of 2 in `src/pages/cleaning-types/CleaningTypeEdit.tsx`. Find (it starts at line 28, `</Form>`):

```tsx
      </Form>
```

Replace with:

```tsx
        <Form.Item
          label="Color"
          name="color_motif"
          rules={[{ required: true, message: 'Color is required' }]}
        >
          <ColorMotifSelect />
        </Form.Item>
      </Form>
```

Edit 1 of 2 in `src/pages/cleaning-types/CleaningTypeList.tsx`. Find (it starts at line 3, `import type { CleaningType } from '@/types/db'`):

```tsx
import type { CleaningType } from '@/types/db'
```

Replace with:

```tsx
import type { CleaningType } from '@/types/db'
import { ColorMotifTag } from '@/components/color-motif/ColorMotifTag'
```

Edit 2 of 2 in `src/pages/cleaning-types/CleaningTypeList.tsx`. Find (it starts at line 15, `<Table.Column<CleaningType> dataIndex="name" title="Name" sorter />`):

```tsx
        <Table.Column<CleaningType> dataIndex="name" title="Name" sorter />
```

Replace with:

```tsx
        <Table.Column<CleaningType>
          dataIndex="name"
          title="Name"
          sorter
          render={(name: string, record) => (
            <ColorMotifTag motif={record.color_motif}>{name}</ColorMotifTag>
          )}
        />
```

Edit 1 of 2 in `src/pages/cleaning-statuses/CleaningStatusCreate.tsx`. Find (it starts at line 3, `import type { TablesInsert } from '@/types/db'`):

```tsx
import type { TablesInsert } from '@/types/db'
```

Replace with:

```tsx
import type { TablesInsert } from '@/types/db'
import { ColorMotifSelect } from '@/components/color-motif/ColorMotifSelect'
import { DEFAULT_COLOR_MOTIF } from '@/features/color-motif/colorMotif'
```

Edit 2 of 2 in `src/pages/cleaning-statuses/CleaningStatusCreate.tsx`. Find (it starts at line 25, `</Form>`):

```tsx
      </Form>
```

Replace with:

```tsx
        <Form.Item
          label="Color"
          name="color_motif"
          initialValue={DEFAULT_COLOR_MOTIF}
          rules={[{ required: true, message: 'Color is required' }]}
        >
          <ColorMotifSelect />
        </Form.Item>
      </Form>
```

Edit 1 of 2 in `src/pages/cleaning-statuses/CleaningStatusEdit.tsx`. Find (it starts at line 4, `TablesUpdate } from '@/types/db'`):

```tsx
TablesUpdate } from '@/types/db'
```

Replace with:

```tsx
TablesUpdate } from '@/types/db'
import { ColorMotifSelect } from '@/components/color-motif/ColorMotifSelect'
```

Edit 2 of 2 in `src/pages/cleaning-statuses/CleaningStatusEdit.tsx`. Find (it starts at line 28, `</Form>`):

```tsx
      </Form>
```

Replace with:

```tsx
        <Form.Item
          label="Color"
          name="color_motif"
          rules={[{ required: true, message: 'Color is required' }]}
        >
          <ColorMotifSelect />
        </Form.Item>
      </Form>
```

Edit 1 of 2 in `src/pages/cleaning-statuses/CleaningStatusList.tsx`. Find (it starts at line 3, `import type { CleaningStatus } from '@/types/db'`):

```tsx
import type { CleaningStatus } from '@/types/db'
```

Replace with:

```tsx
import type { CleaningStatus } from '@/types/db'
import { ColorMotifTag } from '@/components/color-motif/ColorMotifTag'
```

Edit 2 of 2 in `src/pages/cleaning-statuses/CleaningStatusList.tsx`. Find (it starts at line 16, `<Table.Column<CleaningStatus> dataIndex="name" title="Name" />`):

```tsx
        <Table.Column<CleaningStatus> dataIndex="name" title="Name" />
```

Replace with:

```tsx
        <Table.Column<CleaningStatus>
          dataIndex="name"
          title="Name"
          render={(name: string, record) => (
            <ColorMotifTag motif={record.color_motif}>{name}</ColorMotifTag>
          )}
        />
```

**Gate:** `pnpm typecheck && pnpm lint`
**Expect:** both exit 0. Anything else: stop and report.

### Step 19. Vitest tests (create five files)

The form tests replace Refine's `useForm` with a real antd form, so they check exactly the values a save would send.

Create `src/features/color-motif/colorMotif.test.ts` with exactly this content:

```ts
import { describe, expect, it } from 'vitest'
import {
  COLOR_MOTIF_LABELS,
  COLOR_MOTIFS,
  DEFAULT_COLOR_MOTIF,
  isColorMotif,
  toColorMotif,
} from '@/features/color-motif/colorMotif'

// Every migration's text, keyed by path. Vite reads them at test time, so no Node types are needed.
const migrations = import.meta.glob<string>('/supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// The palette as the database defines it: the array in the newest migration that (re)defines
// public.color_motifs(). Migration file names sort in apply order (NNNN_name.sql).
function databasePalette(): string[] {
  const definitions = Object.keys(migrations)
    .sort()
    .map((path) => migrations[path] ?? '')
    .filter((sql) => /create (or replace )?function public\.color_motifs\(\)/.test(sql))
  const newest = definitions.at(-1) ?? ''
  const array = /array\[([^\]]*)\]::text\[\]/.exec(newest)?.[1] ?? ''
  return [...array.matchAll(/'([^']*)'/g)].map((match) => match[1] ?? '')
}

describe('COLOR_MOTIFS', () => {
  it('matches public.color_motifs() in the newest migration that defines it, in order', () => {
    expect(databasePalette()).toEqual([...COLOR_MOTIFS])
  })

  it('is the Ant Design preset tag palette with the grey default first', () => {
    expect(COLOR_MOTIFS[0]).toBe(DEFAULT_COLOR_MOTIF)
    expect(new Set(COLOR_MOTIFS).size).toBe(12)
  })

  it('has a label for every colour', () => {
    expect(Object.keys(COLOR_MOTIF_LABELS)).toEqual([...COLOR_MOTIFS])
    expect(COLOR_MOTIF_LABELS.geekblue).toBe('Geek blue')
    expect(COLOR_MOTIF_LABELS.default).toBe('Grey (default)')
  })
})

describe('isColorMotif', () => {
  it('accepts every palette value', () => {
    for (const motif of COLOR_MOTIFS) expect(isColorMotif(motif)).toBe(true)
  })

  it('rejects anything else', () => {
    for (const value of ['pink', 'Blue', '#ff0000', '', null, undefined, 3]) {
      expect(isColorMotif(value)).toBe(false)
    }
  })
})

describe('toColorMotif', () => {
  it('keeps a palette value', () => {
    expect(toColorMotif('geekblue')).toBe('geekblue')
  })

  it('falls back to the grey default for an unknown value', () => {
    expect(toColorMotif('pink')).toBe('default')
    expect(toColorMotif(null)).toBe('default')
    expect(toColorMotif(undefined)).toBe('default')
  })
})
```

Create `src/components/color-motif/ColorMotifSelect.test.tsx` with exactly this content:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import { describe, expect, it, vi } from 'vitest'
import { ColorMotifSelect } from '@/components/color-motif/ColorMotifSelect'
import { ColorMotifTag } from '@/components/color-motif/ColorMotifTag'
import { COLOR_MOTIF_LABELS, COLOR_MOTIFS } from '@/features/color-motif/colorMotif'

// The open dropdown (antd renders it in a portal on document.body).
function dropdown() {
  const element = document.querySelector<HTMLElement>(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
  )
  if (!element) throw new Error('the dropdown is not open')
  return element
}

// The same wiring the Create and Edit pages use: a Form.Item labelled "Color".
function renderInForm(value: string | undefined, onChange = vi.fn()) {
  render(
    <Form>
      <Form.Item label="Color" htmlFor="color">
        <ColorMotifSelect id="color" value={value} onChange={onChange} />
      </Form.Item>
    </Form>,
  )
  return onChange
}

describe('ColorMotifTag', () => {
  it('shows its text in the colour it is given', () => {
    render(<ColorMotifTag motif="geekblue">The Tidy Team</ColorMotifTag>)
    expect(screen.getByText('The Tidy Team')).toHaveClass('ant-tag', 'ant-tag-geekblue')
  })

  it('shows an unknown or missing colour as the grey default', () => {
    render(
      <>
        <ColorMotifTag motif="pink">Unknown</ColorMotifTag>
        <ColorMotifTag motif={null}>Missing</ColorMotifTag>
      </>,
    )
    expect(screen.getByText('Unknown')).toHaveClass('ant-tag-default')
    expect(screen.getByText('Missing')).toHaveClass('ant-tag-default')
  })
})

describe('ColorMotifSelect', () => {
  it('is named Color and shows the chosen colour as a pill', () => {
    renderInForm('blue')
    expect(screen.getByRole('combobox', { name: 'Color' })).toBeInTheDocument()
    expect(screen.getByText('Blue')).toHaveClass('ant-tag-blue')
  })

  it('offers every palette colour as a pill with its name, in palette order', async () => {
    renderInForm('default')
    await userEvent.click(screen.getByRole('combobox', { name: 'Color' }))
    const pills = Array.from(dropdown().querySelectorAll('.ant-select-item-option .ant-tag'))
    expect(pills.map((pill) => pill.textContent)).toEqual(
      COLOR_MOTIFS.map((motif) => COLOR_MOTIF_LABELS[motif]),
    )
    pills.forEach((pill, index) => {
      expect(pill).toHaveClass(`ant-tag-${COLOR_MOTIFS[index] ?? ''}`)
    })
  })

  it('reports the colour the user picks', async () => {
    const onChange = renderInForm('default')
    await userEvent.click(screen.getByRole('combobox', { name: 'Color' }))
    await userEvent.click(within(dropdown()).getByText('Geek blue'))
    expect(onChange).toHaveBeenCalledWith('geekblue', expect.anything())
  })

  it('shows a stored value the palette does not know as the grey default', () => {
    renderInForm('pink')
    expect(screen.getByText('Grey (default)')).toHaveClass('ant-tag-default')
  })
})
```

Create `src/pages/companies/CompanyForms.test.tsx` with exactly this content:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CompanyCreate } from '@/pages/companies/CompanyCreate'
import { CompanyEdit } from '@/pages/companies/CompanyEdit'

const onFinish = vi.fn()
const loaded = vi.hoisted((): { values: Record<string, unknown> } => ({ values: {} }))

// Refine's useForm, reduced to a real antd form: Save submits it and onFinish receives the values
// Refine would send. For the Edit page the loaded record is the form's initial values.
vi.mock('@refinedev/antd', () => {
  function useForm() {
    const [form] = Form.useForm()
    return {
      formProps: { form, onFinish, initialValues: loaded.values },
      saveButtonProps: {
        onClick: () => {
          form.submit()
        },
      },
      query: { isLoading: false },
    }
  }
  function Page({ children, saveButtonProps }: { children: ReactNode; saveButtonProps: object }) {
    return (
      <div>
        {children}
        <button type="button" {...saveButtonProps}>
          Save
        </button>
      </div>
    )
  }
  return { useForm, Create: Page, Edit: Page }
})

function dropdown() {
  const element = document.querySelector<HTMLElement>(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
  )
  if (!element) throw new Error('the dropdown is not open')
  return element
}

describe('CompanyCreate', () => {
  it('sends the grey default colour when none is picked', async () => {
    loaded.values = {}
    render(<CompanyCreate />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Sparkle Co')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({ name: 'Sparkle Co', color_motif: 'default' })
    })
  })

  it('sends the picked colour', async () => {
    loaded.values = {}
    render(<CompanyCreate />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Sparkle Co')
    await userEvent.click(screen.getByRole('combobox', { name: 'Color' }))
    await userEvent.click(within(dropdown()).getByText('Lime'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({ name: 'Sparkle Co', color_motif: 'lime' })
    })
  })
})

describe('CompanyEdit', () => {
  it('shows the stored colour and sends the new one', async () => {
    loaded.values = { name: 'The Tidy Team', color_motif: 'geekblue' }
    render(<CompanyEdit />)
    expect(screen.getByText('Geek blue')).toHaveClass('ant-tag-geekblue')
    await userEvent.click(screen.getByRole('combobox', { name: 'Color' }))
    await userEvent.click(within(dropdown()).getByText('Red'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({ name: 'The Tidy Team', color_motif: 'red' })
    })
  })
})
```

Create `src/pages/cleaning-types/CleaningTypeForms.test.tsx` with exactly this content:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CleaningTypeCreate } from '@/pages/cleaning-types/CleaningTypeCreate'
import { CleaningTypeEdit } from '@/pages/cleaning-types/CleaningTypeEdit'

const onFinish = vi.fn()
const loaded = vi.hoisted((): { values: Record<string, unknown> } => ({ values: {} }))

// Refine's useForm, reduced to a real antd form: Save submits it and onFinish receives the values
// Refine would send. For the Edit page the loaded record is the form's initial values.
vi.mock('@refinedev/antd', () => {
  function useForm() {
    const [form] = Form.useForm()
    return {
      formProps: { form, onFinish, initialValues: loaded.values },
      saveButtonProps: {
        onClick: () => {
          form.submit()
        },
      },
      query: { isLoading: false },
    }
  }
  function Page({ children, saveButtonProps }: { children: ReactNode; saveButtonProps: object }) {
    return (
      <div>
        {children}
        <button type="button" {...saveButtonProps}>
          Save
        </button>
      </div>
    )
  }
  return { useForm, Create: Page, Edit: Page }
})

function dropdown() {
  const element = document.querySelector<HTMLElement>(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
  )
  if (!element) throw new Error('the dropdown is not open')
  return element
}

describe('CleaningTypeCreate', () => {
  it('sends the grey default colour when none is picked', async () => {
    loaded.values = {}
    render(<CleaningTypeCreate />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Window')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({ name: 'Window', color_motif: 'default' })
    })
  })

  it('sends the picked colour', async () => {
    loaded.values = {}
    render(<CleaningTypeCreate />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Window')
    await userEvent.click(screen.getByRole('combobox', { name: 'Color' }))
    await userEvent.click(within(dropdown()).getByText('Lime'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({ name: 'Window', color_motif: 'lime' })
    })
  })
})

describe('CleaningTypeEdit', () => {
  it('shows the stored colour and sends the new one', async () => {
    loaded.values = { name: 'Deep', color_motif: 'purple' }
    render(<CleaningTypeEdit />)
    expect(screen.getByText('Purple')).toHaveClass('ant-tag-purple')
    await userEvent.click(screen.getByRole('combobox', { name: 'Color' }))
    await userEvent.click(within(dropdown()).getByText('Red'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({ name: 'Deep', color_motif: 'red' })
    })
  })
})
```

Create `src/pages/cleaning-statuses/CleaningStatusForms.test.tsx` with exactly this content:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CleaningStatusCreate } from '@/pages/cleaning-statuses/CleaningStatusCreate'
import { CleaningStatusEdit } from '@/pages/cleaning-statuses/CleaningStatusEdit'

const onFinish = vi.fn()
const loaded = vi.hoisted((): { values: Record<string, unknown> } => ({ values: {} }))

// Refine's useForm, reduced to a real antd form: Save submits it and onFinish receives the values
// Refine would send. For the Edit page the loaded record is the form's initial values.
vi.mock('@refinedev/antd', () => {
  function useForm() {
    const [form] = Form.useForm()
    return {
      formProps: { form, onFinish, initialValues: loaded.values },
      saveButtonProps: {
        onClick: () => {
          form.submit()
        },
      },
      query: { isLoading: false },
    }
  }
  function Page({ children, saveButtonProps }: { children: ReactNode; saveButtonProps: object }) {
    return (
      <div>
        {children}
        <button type="button" {...saveButtonProps}>
          Save
        </button>
      </div>
    )
  }
  return { useForm, Create: Page, Edit: Page }
})

function dropdown() {
  const element = document.querySelector<HTMLElement>(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
  )
  if (!element) throw new Error('the dropdown is not open')
  return element
}

describe('CleaningStatusCreate', () => {
  it('sends the grey default colour when none is picked', async () => {
    loaded.values = {}
    render(<CleaningStatusCreate />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Cancelled')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({ name: 'Cancelled', color_motif: 'default' })
    })
  })

  it('sends the picked colour', async () => {
    loaded.values = {}
    render(<CleaningStatusCreate />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Cancelled')
    await userEvent.click(screen.getByRole('combobox', { name: 'Color' }))
    await userEvent.click(within(dropdown()).getByText('Lime'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({ name: 'Cancelled', color_motif: 'lime' })
    })
  })
})

describe('CleaningStatusEdit', () => {
  it('shows the stored colour and sends the new one', async () => {
    loaded.values = { name: 'Booked', color_motif: 'blue' }
    render(<CleaningStatusEdit />)
    expect(screen.getByText('Blue')).toHaveClass('ant-tag-blue')
    await userEvent.click(screen.getByRole('combobox', { name: 'Color' }))
    await userEvent.click(within(dropdown()).getByText('Red'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onFinish).toHaveBeenCalledWith({ name: 'Booked', color_motif: 'red' })
    })
  })
})
```

**Gate:** `pnpm test`
**Expect:** Vitest reports 19 files and 132 tests, all passing: `colorMotif.test.ts` 7, `ColorMotifSelect.test.tsx` 6, `CompanyForms.test.tsx` 3, `CleaningTypeForms.test.tsx` 3, `CleaningStatusForms.test.tsx` 3 and `CleaningJobList.test.tsx` 13. Anything else: stop and report.

### Step 20. Playwright (edit one spec, create one)

The new spec changes the seeded Deep cleaning type to red and puts it back to purple in a `finally` block, so it can be rerun.

Edit 1 of 1 in `e2e/cleaning-jobs.spec.ts`. Find (it starts at line 65, `test('filters by date range, cleaning type and feedback, and clears them', async ({ page }) => {`):

```ts
  test('filters by date range, cleaning type and feedback, and clears them', async ({ page }) => {
```

Replace with:

```ts
  test('shows Company, Status and Cleaning Type as pills in their seeded colours', async ({
    page,
  }) => {
    await signIn(page, 'user@example.com', 'user-password-123')
    await openCleaningJobs(page)

    // Columns: 0 Assignee, 1 Company, 2 Status, ... 6 Cleaning Type (see the header test).
    // supabase/seeds/02_reference_data.sql gives every seeded row a colour other than the default.
    const rows = await dataRows(page).count()
    for (let i = 0; i < rows; i++) {
      const cells = dataRows(page).nth(i).locator('td')
      await expect(cells.nth(1).locator('.ant-tag')).toHaveClass(
        /ant-tag-(red|cyan|magenta|blue)/,
      )
      await expect(cells.nth(2).locator('.ant-tag')).toHaveClass(/ant-tag-(blue|cyan|orange|green)/)
      await expect(cells.nth(2).locator('.ant-tag')).toHaveText(
        /^(Booked|Confirmed|In Progress|Done)$/,
      )
      for (const tag of await cells.nth(6).locator('.ant-tag').all()) {
        await expect(tag).not.toHaveClass(/ant-tag-default/)
      }
    }
  })

  test('filters by date range, cleaning type and feedback, and clears them', async ({ page }) => {
```

Create `e2e/color-motifs.spec.ts` with exactly this content:

```ts
import { test, expect, type Page } from '@playwright/test'

// Local seed only (supabase/seeds/02_reference_data.sql): the Deep cleaning type is purple.
const TYPE = 'Deep'
const SEEDED_LABEL = 'Purple'
const SEEDED_CLASS = /ant-tag-purple/

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByRole('link', { name: 'Cleaning types' })).toBeVisible()
}

// The visible dropdown (antd keeps closed ones in the page, hidden).
function openDropdown(page: Page) {
  return page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
}

// Opens the cleaning type's Edit page, picks a colour by its label and saves.
async function setTypeColor(page: Page, name: string, label: string) {
  await page.goto('/cleaning-types')
  await page.getByRole('row', { name }).getByRole('button', { name: 'edit' }).click()
  // Wait for the record to load first, or the loaded value overwrites the picked one.
  await expect(page.getByRole('textbox', { name: /Name$/ })).toHaveValue(name)
  // Click the select itself: the chosen pill sits on top of its input.
  await page.locator('.ant-form-item', { hasText: 'Color' }).locator('.ant-select').click()
  await openDropdown(page)
    .locator('.ant-select-item-option')
    .getByText(label, { exact: true })
    .click()
  await page.getByRole('button', { name: /save/i }).click()
  await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible()
}

function typePill(page: Page, name: string) {
  return page.getByRole('row', { name }).locator('.ant-tag', { hasText: name })
}

test.describe('Color motifs', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('a User sees the colour but cannot edit a cleaning type', async ({ page }) => {
    await signIn(page, 'user@example.com', 'user-password-123')
    await page.goto('/cleaning-types')
    await expect(typePill(page, TYPE)).toHaveClass(SEEDED_CLASS)
    await expect(
      page.getByRole('row', { name: TYPE }).getByRole('button', { name: 'edit' }),
    ).toBeDisabled()
  })

  test('an Admin changes a cleaning type colour and the jobs list shows it', async ({ page }) => {
    test.setTimeout(60_000)
    await signIn(page, 'admin@example.com', 'admin-password-123')
    await page.goto('/cleaning-types')
    await expect(typePill(page, TYPE)).toHaveClass(SEEDED_CLASS)

    try {
      await setTypeColor(page, TYPE, 'Red')
      await expect(typePill(page, TYPE)).toHaveClass(/ant-tag-red/)

      // The Cleaning Jobs list, filtered to Deep jobs: every Deep pill is red now.
      await page.getByRole('link', { name: 'Cleaning Jobs' }).click()
      await expect(page.locator('tbody tr.ant-table-row').first()).toBeVisible()
      await page.getByRole('button', { name: 'Filters' }).click()
      const type = page.getByRole('combobox', { name: 'Cleaning type' })
      await type.click()
      await type.fill(TYPE)
      await openDropdown(page).getByText(TYPE, { exact: true }).click()
      await expect(
        page.getByRole('group', { name: 'Active filters' }).getByText(`Cleaning type: ${TYPE}`),
      ).toBeVisible()
      const pills = page.locator('tbody tr.ant-table-row .ant-tag', { hasText: /^Deep$/ })
      await expect(pills.first()).toBeVisible()
      for (const pill of await pills.all()) await expect(pill).toHaveClass(/ant-tag-red/)
    } finally {
      // Put the seeded colour back so reruns start the same way.
      await setTypeColor(page, TYPE, SEEDED_LABEL)
      await expect(typePill(page, TYPE)).toHaveClass(SEEDED_CLASS)
    }
  })
})
```

**Gate:** `pnpm exec playwright test e2e/cleaning-jobs.spec.ts e2e/color-motifs.spec.ts && pnpm exec playwright test e2e/color-motifs.spec.ts && docker exec supabase_db_dispatch-tracker psql -U postgres -Atc "select color_motif from public.cleaning_types where name = 'Deep'"`
**Expect:** the first run reports `9 passed` (the setup, 6 Cleaning Jobs tests and 2 colour tests), the rerun reports `3 passed`, and `psql` prints `purple`. Anything else: stop and report.

**Gate:** `pnpm exec playwright test`
**Expect:** 18 tests; all pass when the edge runtime is running (`pnpm exec supabase functions serve`). Without it, only `edge-function.spec.ts` fails and 17 pass. Any other failure: stop and report.

### Step 21. Gate: web

```bash
npx prettier --check src e2e && pnpm typecheck && pnpm lint && pnpm test
```

**Expect:** all four exit 0 and Vitest reports 19 files and 132 tests. If `prettier --check` fails only on files from this phase, run `npx prettier --write` on those files and re-run; any other failure: stop and report.

```bash
git status --short
```

**Expect:** modified: `supabase/seeds/02_reference_data.sql`, `supabase/tests/database/cleaning_jobs.test.sql`, `supabase/tests/database/get_cleaning_jobs.test.sql`, `src/types/database.types.ts`, `src/types/db.ts`, `src/pages/cleaning-jobs/CleaningJobList.tsx`, `src/pages/cleaning-jobs/CleaningJobList.test.tsx`, the six Create and Edit pages and three List pages of companies, cleaning types and cleaning statuses, `e2e/cleaning-jobs.spec.ts`; new: `supabase/migrations/0029_color_motifs.sql`, `supabase/tests/database/color_motifs.test.sql`, `src/features/color-motif/`, `src/components/color-motif/`, the three `*Forms.test.tsx` files, `e2e/color-motifs.spec.ts`; plus plan files under `.claude/plans/`. Anything else: stop and report.

### Step 22. Manual check (no code)

Run `pnpm dev` and sign in as `admin@example.com`.

**Expect:**
- **Cleaning Jobs:** Company, Status and each Cleaning Type show as coloured pills with their text (for example Booked blue, Done green, Deep purple). Assignee tags stay grey. Every pill still reads as text (colour is never the only signal).
- **Cleaning types:** each name shows as its pill. Edit Deep: the "Color" field shows "Purple"; its list shows every colour as a pill with its name. Pick Red, save: the list and the jobs list show Deep in red. Put it back to Purple.
- **Companies** and **Cleaning statuses:** the same "Color" field on Create and Edit; a new row saved without picking shows the grey pill.
- Sign in as `user@example.com`: Cleaning types and Cleaning statuses show the pills but their Edit and Create buttons are disabled.

Report what you saw.

### Step 23. Document the architecture (create file, edit `README.md`)

Create `docs/architecture/0007-Color-Motifs.md` with exactly this content:

```md
# 0007 Color motifs: one palette for the pills of companies, cleaning types and statuses

- Ticket: T3C-F35 (Phase 2)
- Plan: `.claude/plans/backend/T3C-F35-Cleaning-Jobs-List.md`
- Date: 2026-11-27
- Status: implemented
- Builds on: [0004 Cleaning jobs list function](0004-Cleaning-Jobs-List-Function.md)

## Summary

`companies`, `cleaning_types` and `cleaning_statuses` each have a `color_motif` column. The Cleaning
Jobs list shows Company, Status and each Cleaning Type as an Ant Design `Tag` in that colour, and an
Admin picks the colour on the Create and Edit pages of each resource.

## Why

The owner asked for a distinguishing colour on the pills. A fixed palette of Ant Design's preset tag
colours works with `Tag color`, adapts to the light and dark themes and leaves no free-form hex value
to validate.

## How it works

- The palette is `default` (the neutral grey tag) plus `magenta`, `red`, `volcano`, `orange`, `gold`,
  `lime`, `green`, `cyan`, `blue`, `geekblue` and `purple`. It exists twice, once per side:
  `public.color_motifs()` in the database (`0029_color_motifs.sql`) and `COLOR_MOTIFS` in
  `src/features/color-motif/colorMotif.ts`.
- They cannot drift: `colorMotif.test.ts` (Vitest) reads the array from the newest migration that
  defines `public.color_motifs()` and compares it with `COLOR_MOTIFS`; `color_motifs.test.sql`
  (pgTAP) compares the function with the same list and checks that every table's constraint calls it.
- Each column is `text not null default 'default'` with a check constraint
  `color_motif = any (public.color_motifs())`. The existing update policies (`has_permission`) decide
  who may change it: Admin and Super Admin, not User.
- `get_cleaning_jobs` returns `company_color`, `status_color` and each cleaning type as
  `{"name", "color"}`. Its return type changed, so `0029` drops and recreates it with the same
  arguments, filters, sorts and paging.
- The web never trusts the stored value blindly: `toColorMotif` turns anything unknown into
  `default`. `ColorMotifTag` (`src/components/color-motif/`) draws every pill and always keeps its
  text, so colour is never the only signal. `ColorMotifSelect` is the "Color" field of the six
  Create and Edit pages; each option is the pill itself.
- The local seed (`02_reference_data.sql`) gives every seeded row its own colour; statuses follow the
  life cycle (Booked blue, Confirmed cyan, In Progress orange, Done green).

## Known limits

- Changing the palette takes a migration that replaces `public.color_motifs()` and an edit of
  `COLOR_MOTIFS`, in the same change. Removing a colour that rows still use fails the migration until
  those rows are moved.
- Preset colours are not checked for contrast by this repo; Ant Design's preset tags are designed to
  be readable in both themes.
- The colours of rows created on a hosted database start as `default` until an Admin sets them.
```

`docs/architecture/0004-Cleaning-Jobs-List-Function.md` stays as it is: it does not describe the returned columns, so nothing in it becomes wrong.

Edit 1 of 2 in `README.md`. Find (it starts at line 34, `Local data: [0006 Seed data](docs/architecture/0006-Local-Seed-Data.md).`):

```md
Local data: [0006 Seed data](docs/architecture/0006-Local-Seed-Data.md).
```

Replace with:

```md
Local data: [0006 Seed data](docs/architecture/0006-Local-Seed-Data.md). Pill colours: [0007 Color motifs](docs/architecture/0007-Color-Motifs.md).
```

Edit 2 of 2 in `README.md`. Find (it starts at line 77, `features/cleaning-jobs/      data access, React Query hooks and helpers for the Cleaning Jobs list`):

```md
  features/cleaning-jobs/      data access, React Query hooks and helpers for the Cleaning Jobs list
```

Replace with:

```md
  features/cleaning-jobs/      data access, React Query hooks and helpers for the Cleaning Jobs list
  features/color-motif/        the pill colour palette (COLOR_MOTIFS) shared by every list and form
```

**Gate:** `ls docs/architecture && grep -c "0007-Color-Motifs.md" README.md && npx prettier --check README.md docs/architecture/0007-Color-Motifs.md`
**Expect:** the files `0001` to `0007` are listed, `grep` prints `1`, and prettier reports `All matched files use Prettier code style!`. Anything else: stop and report.

## Rollback

- Before commit: `git switch main && git branch -D feat/T3C-F35-Cleaning-Jobs-List`, then `pnpm db:reset`.
- After merge, if a hosted DB already has the migrations: add `0127_drop_cleaning_job_rpc.sql` containing `drop function public.get_cleaning_jobs(uuid[], uuid[], uuid[], uuid[], text, integer[], text, date, date, text, text, text, integer, integer);`, `drop function public.get_client_feedbacks_for_cleaning_job_id(uuid);`, `drop function public.get_complete_address_for_property_id(uuid);` and `drop function public.get_cleaners_for_cleaning_job_id(uuid);` (in that order), and `0128_drop_preferred_time_zone.sql` containing `alter table public.profiles drop column preferred_time_zone;` and `drop function public.is_valid_time_zone(text);` (in that order: the column check needs the function). Never edit or delete an applied migration.

### Rollback (Phase 2)

- Before commit: put the edited files back, remove the new ones and reset the local database:

```bash
git restore supabase/seeds/02_reference_data.sql supabase/tests/database/cleaning_jobs.test.sql supabase/tests/database/get_cleaning_jobs.test.sql src/types/database.types.ts src/types/db.ts src/pages e2e/cleaning-jobs.spec.ts README.md
rm -r supabase/migrations/0029_color_motifs.sql supabase/tests/database/color_motifs.test.sql src/features/color-motif src/components/color-motif src/pages/companies/CompanyForms.test.tsx src/pages/cleaning-types/CleaningTypeForms.test.tsx src/pages/cleaning-statuses/CleaningStatusForms.test.tsx e2e/color-motifs.spec.ts docs/architecture/0007-Color-Motifs.md
pnpm db:reset
```

- After merge, if a hosted DB already has `0029_color_motifs.sql`: never edit or delete it; add `supabase/migrations/0129_drop_color_motifs.sql`. It first recreates the old `get_cleaning_jobs` (the block of `0028_cleaning_job_rpc.sql` lines 75 to 246, with `create or replace` written as `create`, and its revoke and grant), then drops the columns and the palette function. In the same change, put the `src/` and `e2e/` files of Phase 2 back to their Phase 1 versions (`git checkout <last Phase 1 commit> -- <file>`) and delete the new ones, because the old function returns no colours. Keep `0029` and the seed as they are (the seed then needs its `color_motif` values removed too, or `db:reset` fails on a missing column). The file, as checked on 2026-11-27 (run inside a transaction, then rolled back):

```sql
-- 0129_drop_color_motifs: undoes 0029_color_motifs.
-- 1. Put back get_cleaning_jobs as 0028 defined it (no colour columns). Its return type differs,
--    so the 0029 version is dropped first.
drop function public.get_cleaning_jobs(uuid[], uuid[], uuid[], uuid[], text, integer[], text, date, date, text, text, text, integer, integer);

create function public.get_cleaning_jobs(
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

revoke execute on function public.get_cleaning_jobs(uuid[], uuid[], uuid[], uuid[], text, integer[], text, date, date, text, text, text, integer, integer) from public, anon;
grant  execute on function public.get_cleaning_jobs(uuid[], uuid[], uuid[], uuid[], text, integer[], text, date, date, text, text, text, integer, integer) to authenticated;

-- 2. The columns (their check constraints go with them), then the palette function they used.
alter table public.companies drop column color_motif;
alter table public.cleaning_types drop column color_motif;
alter table public.cleaning_statuses drop column color_motif;
drop function public.color_motifs();
```

- To roll back both phases on a hosted DB, do not add `0129`: add Phase 1's `0127` and `0128`, and put the last four statements of the `0129` above (the three `drop column` lines and `drop function public.color_motifs();`) at the end of `0127`.

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
   Files: `src/features/cleaning-jobs/timeZone.test.ts`, `src/features/cleaning-jobs/api.test.ts`, `src/features/cleaning-jobs/hooks.test.tsx`, `src/features/cleaning-jobs/filterChips.test.ts`, `src/features/cleaning-jobs/usePreferredTimeZone.test.tsx`, `src/components/cleaning-jobs/*.test.tsx`, `src/pages/cleaning-jobs/CleaningJobList.test.tsx`, `e2e/cleaning-jobs.spec.ts`
5. `docs(plans): add T3C-F35 plan`
   Files: `.claude/plans/backend/T3C-F35-Cleaning-Jobs-List.md`

PR title: `feat(web): add Cleaning Jobs list` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.

### Conventional commits (Phase 2)

Branch: the Phase 1 branch, `feat/T3C-B15-B16-B18-B19-B33-F35-Cleaning-Jobs` (no new branch). Stage explicit paths only; each file belongs to exactly one commit, so whole files can be staged. Each commit leaves the suites green (commit 2 carries the web follow-up of the row shape for that reason, see the decisions). Every commit ends with:

```
Refs: T3C-F35

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `test(db): pin the default status test to its own job`
   Files: `supabase/tests/database/cleaning_jobs.test.sql`
2. `feat(db): add color motifs and return them from get_cleaning_jobs`
   Body: `The row shape of get_cleaning_jobs changes, so the type override, the list page and its test fixture move with it and every suite stays green.`
   Files: `supabase/migrations/0029_color_motifs.sql`, `supabase/seeds/02_reference_data.sql`, `src/types/database.types.ts`, `supabase/tests/database/get_cleaning_jobs.test.sql`, `src/types/db.ts`, `src/features/color-motif/colorMotif.ts`, `src/components/color-motif/ColorMotifTag.tsx`, `src/pages/cleaning-jobs/CleaningJobList.tsx`, `src/pages/cleaning-jobs/CleaningJobList.test.tsx`
3. `test(db): cover color motifs`
   Files: `supabase/tests/database/color_motifs.test.sql`
4. `feat(web): pick a pill colour on the company, type and status forms`
   Files: `src/components/color-motif/ColorMotifSelect.tsx`, `src/pages/companies/CompanyCreate.tsx`, `src/pages/companies/CompanyEdit.tsx`, `src/pages/companies/CompanyList.tsx`, `src/pages/cleaning-types/CleaningTypeCreate.tsx`, `src/pages/cleaning-types/CleaningTypeEdit.tsx`, `src/pages/cleaning-types/CleaningTypeList.tsx`, `src/pages/cleaning-statuses/CleaningStatusCreate.tsx`, `src/pages/cleaning-statuses/CleaningStatusEdit.tsx`, `src/pages/cleaning-statuses/CleaningStatusList.tsx`
5. `test(web): cover the colour palette, the select and the forms`
   Files: `src/features/color-motif/colorMotif.test.ts`, `src/components/color-motif/ColorMotifSelect.test.tsx`, `src/pages/companies/CompanyForms.test.tsx`, `src/pages/cleaning-types/CleaningTypeForms.test.tsx`, `src/pages/cleaning-statuses/CleaningStatusForms.test.tsx`
6. `test(e2e): check pill colours and an admin colour change`
   Files: `e2e/cleaning-jobs.spec.ts`, `e2e/color-motifs.spec.ts`
7. `docs(agents): document the color motifs architecture`
   Files: `docs/architecture/0007-Color-Motifs.md`, `README.md`
8. `docs(plans): shift later table plans past 0029_color_motifs`
   Files: `.claude/plans/backend/T3C-B0-Users-Table.md`, `.claude/plans/backend/T3C-B17-Preferred-Cleaners-Table.md`, `.claude/plans/backend/T3C-B26-Cleaning-Job-Areas-Table.md`, `.claude/plans/backend/T3C-B27-Cleaning-Job-Items-Table.md`, `.claude/plans/backend/T3C-B28-S29-Invoice-Statuses-Table.md`, `.claude/plans/backend/T3C-B30-Invoice-Templates-Table.md`, `.claude/plans/backend/T3C-S31-Invoice-Templates-Seed.md`, `.claude/plans/backend/T3C-B32-Invoices-Table.md`
9. `docs(plans): add the color motifs phase to the T3C-F35 plan`
   Files: `.claude/plans/backend/T3C-F35-Cleaning-Jobs-List.md`

The Phase 2 commits go on the same pull request as Phase 1 (PR title `feat(web): add Cleaning Jobs list`, unchanged). Merge with a normal merge commit.
