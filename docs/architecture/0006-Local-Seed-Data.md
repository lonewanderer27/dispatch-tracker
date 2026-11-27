# 0006 Local seed data

- Ticket: T3C-F35
- Plan: none (decided during the seed work on the T3C-F35 branch)
- Date: 2026-11-27
- Status: implemented

## Summary

`pnpm db:reset` loads everything a developer needs from five ordered files in `supabase/seeds/`,
including about 430 demo cleaning jobs built from an anonymised copy of the real schedule.

## How it works

- `supabase/seed.sql` was split into `01_users.sql`, `02_reference_data.sql`, `03_roster.sql`,
  `04_cleaning_jobs.sql` and `05_cleaning_job_areas_items.sql`. `seed.sql_paths` in
  `supabase/config.jsonc` lists them in order, because they depend on each other. New reference data
  goes in `02_reference_data.sql`.
- `04_cleaning_jobs.sql` holds 239 clients, 327 properties, 432 jobs with their assignments, cleaning
  types and feedback. Names and addresses are generated, notes are rewritten from fixed phrases and no
  phone number or email is kept. Cleaners are spread over the ten roster cleaners. Jobs before
  2026-11-27 are Done. All ids are fixed, so the files can run more than once.
- The real workbook contains personal data, so it is not stored in the repo. Only the anonymised
  output is committed.
- `05_cleaning_job_areas_items.sql` fills `cleaning_job_areas` and `cleaning_job_items`. Areas follow
  the cleaning type of each job (Regular, Deep, Move-In, Move-Out, Construction, Diamond Cleaning),
  with Kitchen and Bathroom as priorities on the thorough cleans, plus the Basement where the notes
  ask for it. Items are the ones named in the notes (oven, fridge, cabinets, windows, baseboards,
  walls, carpet) and are flagged as priorities. The areas are typical for the type, not copied from
  the original schedule, which does not list rooms per job.
- The seed has hundreds of clients, so pgTAP tests that count whole tables delete the seeded rows
  inside their own rolled-back transaction, and the e2e specs open the clients list with a large page
  size and search inside dropdowns.

## Known limits

- The dates are absolute (August to December 2026), so relative filters such as "current week" show
  data only around those dates.
- The anonymised copy was made once; there is no script in the repo to regenerate it.
- Local use only. Never run the seeds against a hosted project.
