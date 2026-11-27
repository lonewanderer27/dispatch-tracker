# 0005 Preferred time zone

- Ticket: T3C-F35
- Plan: `.claude/plans/T3C-F35-Cleaning-Jobs-List.md`
- Date: 2026-11-27
- Status: implemented
- Builds on: [0004 Cleaning jobs list](0004-Cleaning-Jobs-List-Function.md)

## Summary

Each user chooses the time zone dates are shown in. It is saved on their profile and defaults to
Edmonton. Dates stay `timestamptz`; only the display changes.

## How it works

- `profiles.preferred_time_zone` is text holding an IANA name such as `America/Edmonton`, default
  `America/Edmonton`. IANA names were chosen over UTC offsets (wrong for half the year because of
  daylight saving) and abbreviations (ambiguous).
- A check constraint calls `public.is_valid_time_zone(text)`, which looks the name up in
  `pg_timezone_names`. A constraint cannot hold a subquery, hence the function.
- Users can update only their own value: the column is granted to `authenticated` and the existing
  `profiles_update_own` policy limits the row. `role_id` is still not writable.
- The date range filter ("next month", "current week", "last 3 months", a custom range, and so on) is
  worked out inside `get_cleaning_jobs` in the user's time zone, so "this week" matches what the
  Scheduled Date column shows. The browser only formats times, with `Intl.DateTimeFormat`.

## Known limits

- The browser's zone list and Postgres's can differ for very new zone names; the save then fails with
  the database error.
- Weeks start on Monday.
