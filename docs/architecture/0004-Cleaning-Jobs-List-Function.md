# 0004 Cleaning jobs list: one database function and one hook per function

- Ticket: T3C-F35
- Plan: `.claude/plans/T3C-F35-Cleaning-Jobs-List.md`
- Date: 2026-11-27
- Status: implemented
- Builds on: [0003 Cleaning job data model](0003-Cleaning-Job-Data-Model.md)

## Summary

The Cleaning Jobs page gets its rows from one database function, `get_cleaning_jobs`, and every
database function the web calls has its own React Query hook. The browser never filters, sorts or
pages the list itself.

## Why

The first draft called two helper functions once per row (about 20 extra requests per page) and could
not sort a job by a many-valued column such as its cleaning types or its average rating. The server is
small, so the work moved to where the data is.

## How it works

- `get_cleaning_jobs` takes the filters (cleaner, company, client, cleaning type, cleaning status,
  feedback text, rating, date range), the sort (scheduled date, client, cleaning type, rating), a page and a page
  size. It returns one page with every display column and the total count. Sort values are computed
  only for the sort that is chosen. The page size is capped at 100.
- It calls `get_complete_address_for_property_id`, `get_cleaners_for_cleaning_job_id` and
  `get_client_feedbacks_for_cleaning_job_id` for the rows of the page only. These stay public functions
  with their own tests.
- All four functions are `security invoker` and executable by `authenticated` only, so RLS from
  [0001](0001-Role-Based-Access.md) still decides what a user sees.
- Web code is split as: `src/features/cleaning-jobs/` for fetchers (they take the Supabase client, so
  tests can pass a mock), hooks and pure helpers; `src/features/cleaning-jobs/components/` for components;
  `src/features/cleaning-jobs/pages/` for the list page only.
- Each function has one hook in `hooks.ts` (`useCleaningJobs`, `useCompleteAddress`,
  `useCleanersForCleaningJob`, `useClientFeedbacks`). Components never call `supabase.rpc` or
  `useQuery` directly. Results are fresh for 30 seconds; the cache key includes every argument,
  including the time zone.

## Known limits

- The page keeps its filters, sort and page in memory, not in the URL, so a refresh clears them.
- The sort on cleaning type and rating recalculates per job. If the table grows to hundreds of
  thousands of jobs, store the average rating on the job.
- There is no live update on this page.
