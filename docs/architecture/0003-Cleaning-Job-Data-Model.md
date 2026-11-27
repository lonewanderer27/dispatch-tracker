# 0003 Cleaning job data model

- Ticket: T3C-B15, T3C-B16, T3C-B18, T3C-B19, T3C-B26, T3C-B27, T3C-B33
- Plans: `.claude/plans/backend/T3C-B15-Cleaning-Jobs-Table.md`, `T3C-B16-Cleaning-Job-Updates-Table.md`, `T3C-B18-Cleaning-Job-Assignments-Table.md`, `T3C-B19-Cleaning-Feedbacks-Table.md`, `T3C-B26-Cleaning-Job-Areas-Table.md`, `T3C-B27-Cleaning-Job-Items-Table.md`, `T3C-B33-Cleaning-Job-Cleaning-Types-Table.md`
- Date: 2026-11-27
- Status: implemented
- Builds on: [0001 Role-based access](0001-Role-Based-Access.md)

## Summary

A booked clean is one row in `cleaning_jobs`. Everything else about the job hangs off it in small
tables, so a job can have several cleaners, several cleaning types and several feedbacks.

## How it works

- `cleaning_jobs`: `schedule` (`timestamptz`, stored in UTC by Postgres), `client_id`, `property_id`,
  `cleaning_status_id` (defaults to Booked, fixed id `10000000-0000-0000-0000-000000000001`),
  `est_hours` and `cleaners_needed` (integers above 0), `rate` (`numeric(10,2)`, not negative), optional
  `pets` and `description`, and `created_at`.
- Child tables: `cleaning_job_updates` (progress notes), `cleaning_job_assignments` (cleaner on a job),
  `cleaning_job_cleaning_types` (a job can be Deep and Move-Out) and `cleaning_feedbacks` (rating 0 to 5
  and optional text, more than one per job allowed). `cleaning_feedbacks` and `cleaning_job_updates` also
  have `created_at`.
- `cleaning_job_areas` and `cleaning_job_items` list the areas and items a job covers, each with a `priority` flag (default false) and an optional `description`.
- Assignments, cleaning types, areas and items are unique per pair (job and cleaner, type, area or item).
- Deleting a job deletes its updates, assignments, types, areas, items and feedbacks (`on delete cascade`). A client,
  property, status, cleaner, cleaning type, area or item that is in use cannot be deleted (`no action`).
- Access follows 0001: every table has RLS, four policies that call `has_permission`, and rows in
  `app_permissions` (Admin and Super Admin read and write, User reads only).
- `created_at` on jobs and feedbacks was added at the owner's request; it is what orders feedback
  (newest first).
- Migration numbers: the job tables are `0022` to `0026`, plus `0031` and `0032` for areas and items, not `0013` to `0017` as first planned,
  because `cleaning_jobs.property_id` needs `properties` (`0019`) to exist first. The later table plans
  were renumbered to follow.

## Known limits

- `cleaners_needed` is not checked against the number of assignments.
- Nothing stops a cleaner being assigned to two jobs at the same time.
- A job can have any number of feedbacks; there is no "one per job" rule.
