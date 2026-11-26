# T3C-B18 Add the cleaning_job_assignments table

> **Status: PENDING REVIEW.** Not approved for implementation until the owner removes this line.
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

Source: sprint sheet `The Tidy Team - Digital Platforms Sprint - Sprint 2_ Nov-23-27-2026'.csv`.

- T3C-B18: "As a dispatcher, I want to assign cleaners to a job, so that I know who is attending each clean." Acceptance: table `cleaning_job_assignments` with columns `id`, `cleaner_id`, `cleaning_job_id`; both are required foreign keys (`cleaners.id`, `cleaning_jobs.id`); the pair (`cleaning_job_id`, `cleaner_id`) is unique; several cleaners can be assigned to one job.

## Facts (verified 2026-11-27)

1. Branch is `main`. Migrations are numbered `NNNN_name.sql`. This plan adds `supabase/migrations/0014_cleaning_job_assignments.sql`, so migrations up to `0013` must already exist. Plans are applied in migration order: roles is `0003` (T3C-B0), companies is `0004` (`.claude/plans/backend/T3C-B7-S8-Companies-Table.md`).
2. Required earlier migrations (plan that creates each): `0003_roles.sql` (T3C-B0); `0007_cleaners.sql` (T3C-B9); `0011_cleaning_jobs.sql` (T3C-B15). If any is missing, **stop and report**.
3. Table `public.cleaning_job_assignments` does not exist yet, and `src/types/database.types.ts` has no `cleaning_job_assignments` entry. That file is generated; never hand-edit it.
4. Roles come from T3C-B0 (`.claude/plans/backend/T3C-B0-Users-Table.md`): `supabase/migrations/0003_roles.sql` creates `public.roles` (Admin id `30000000-0000-0000-0000-000000000001`, User id `30000000-0000-0000-0000-000000000002`) and replaces `profiles.role` with `profiles.role_id`. `public.is_admin()` is true when the caller's profile has the Admin role id. Policies call it as `(select public.is_admin())`. If `0003_roles.sql` is missing, **stop and report**.
5. Table pattern (`0001_init.sql`): `id uuid primary key default gen_random_uuid()`, `enable row level security`, `revoke all ... from anon, authenticated`, explicit `grant ... to authenticated`, then policies.
6. `supabase/tests/database/` holds `rls.test.sql`, `seed.test.sql`, `todo_stats.test.sql` (and `roles.test.sql` and `companies.test.sql` once T3C-B0 and T3C-B7-S8 are implemented). `rls.test.sql` already asserts that every public table has RLS enabled.

## Decisions already made (do not reopen)

- `cleaning_job_id` is `on delete cascade` (deleting a job removes its assignments). `cleaner_id` is `no action` (a cleaner with assignment history cannot be deleted).
- **Access (owner rule)**: a profile with the **Admin** role can read and write this table; a profile with the **User** role can only read it. Implemented as one select policy for every signed-in user plus one admin-only `for all` policy using `is_admin()`. `anon` gets nothing. There is no per-user ownership on this data, so there is no user-isolation test.
- **Columns are exactly those in the story**, in the story order. No `created_at` unless the story lists it.
- **Required text columns** are `not null` and also reject blank or whitespace-only values (`char_length(trim(col)) > 0`).
- **No UI** in this plan. Backend and seed stories only. Pages for this table are out of scope (see open question).

### Open questions (do not block)

1. Nothing stops a cleaner being assigned to two jobs at the same time. Should overlap be prevented?
2. Pages (list, create, edit) for this table are not planned. Should they be added, as was done for companies?

## Out of scope

- Every other table or story in the sprint sheet.
- UI pages, Playwright e2e specs, Vitest component tests.
- The role model beyond `user` / `admin`.
- Loading data into SIT or production.
- `README.md` and `AGENTS.md` edits.

## Steps

Working directory for every command: the repo root (`dispatch-tracker`).

### Step 0. Branch and baseline

```bash
git status --short && git switch -c feat/T3C-B18-Cleaning-Job-Assignments-Table && pnpm db:start
```

**Gate:** `git branch --show-current && ls supabase/migrations`
**Expect:** `feat/T3C-B18-Cleaning-Job-Assignments-Table`, then a migration list that ends at `0013_preferred_cleaners.sql` (the file just before this plan's `0014`). If `git status --short` printed anything before the switch, or the list is different, stop and report.

### Step 1. Migration (create file)

Create `supabase/migrations/0014_cleaning_job_assignments.sql` with exactly this content:

```sql
-- 0014_cleaning_job_assignments: which cleaners are assigned to which job.

create table public.cleaning_job_assignments (
  id              uuid primary key default gen_random_uuid(),
  cleaner_id      uuid not null references public.cleaners (id),
  cleaning_job_id uuid not null references public.cleaning_jobs (id) on delete cascade,
  constraint cleaning_job_assignments_pair_key unique (cleaning_job_id, cleaner_id)
);

create index cleaning_job_assignments_cleaner_id_idx on public.cleaning_job_assignments (cleaner_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.cleaning_job_assignments enable row level security;

revoke all on public.cleaning_job_assignments from anon, authenticated;
grant select, insert, update, delete on public.cleaning_job_assignments to authenticated;

-- Everyone signed in can read.
create policy cleaning_job_assignments_select_authenticated
  on public.cleaning_job_assignments for select to authenticated
  using (true);

-- Only admins can change.
create policy cleaning_job_assignments_admin_all
  on public.cleaning_job_assignments for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
```

### Step 2. pgTAP test (create file)

Create `supabase/tests/database/cleaning_job_assignments.test.sql` with exactly this content:

```sql
-- pgTAP: cleaning_job_assignments. RLS, access, constraints.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Fixed test identities. The whole file runs in one transaction and rolls back.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'carol@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'cccccccc-0000-0000-0000-00000000000c';

-- Fixture rows, inserted as the table owner (bypasses RLS).
insert into public.companies (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Test Co');
insert into public.clients (id, company_id, name) values ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Test Client');
insert into public.cleaning_jobs (id, schedule, client_id, est_hours, cleaners_needed, rate)
values ('c3000000-0000-0000-0000-000000000001', '2026-12-01 09:00:00+00', 'c1000000-0000-0000-0000-000000000001', 2, 1, 50.00);
insert into public.cleaners (id, first_name, last_name) values
  ('c2000000-0000-0000-0000-000000000001', 'Test', 'Cleaner'),
  ('c2000000-0000-0000-0000-000000000002', 'Second', 'Cleaner');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.cleaning_job_assignments'::regclass),
  'cleaning_job_assignments has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.cleaning_job_assignments$$,
  '42501',
  null,
  'anon is denied select on cleaning_job_assignments'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.cleaning_job_assignments (cleaner_id, cleaning_job_id) values ('c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001')$$,
  'an Admin can insert into cleaning_job_assignments'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.cleaning_job_assignments) >= 1,
  'a User can read cleaning_job_assignments'
);

select throws_ok(
  $$insert into public.cleaning_job_assignments (cleaner_id, cleaning_job_id) values ('c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'a User cannot insert into cleaning_job_assignments'
);

select lives_ok(
  $$update public.cleaning_job_assignments set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.cleaning_job_assignments$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.cleaning_job_assignments) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select throws_ok(
  $$insert into public.cleaning_job_assignments (cleaner_id, cleaning_job_id) values ('c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001')$$,
  '23505',
  null,
  'the (cleaning_job_id, cleaner_id) pair must be unique'
);

select lives_ok(
  $$insert into public.cleaning_job_assignments (cleaner_id, cleaning_job_id) values ('c2000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000001')$$,
  'several cleaners can be assigned to one job'
);

select throws_ok(
  $$insert into public.cleaning_job_assignments (cleaner_id, cleaning_job_id) values (null, 'c3000000-0000-0000-0000-000000000001')$$,
  '23502',
  null,
  'cleaner_id is required'
);

select throws_ok(
  $$insert into public.cleaning_job_assignments (cleaner_id, cleaning_job_id) values ('c2000000-0000-0000-0000-000000000001', null)$$,
  '23502',
  null,
  'cleaning_job_id is required'
);

select throws_ok(
  $$insert into public.cleaning_job_assignments (cleaner_id, cleaning_job_id) values ('99999999-9999-9999-9999-999999999999', 'c3000000-0000-0000-0000-000000000001')$$,
  '23503',
  null,
  'cleaner_id must exist in cleaners'
);

select throws_ok(
  $$insert into public.cleaning_job_assignments (cleaner_id, cleaning_job_id) values ('c2000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999')$$,
  '23503',
  null,
  'cleaning_job_id must exist in cleaning_jobs'
);

select * from finish();
rollback;
```

### Step 3. Gate

```bash
pnpm db:reset && grep -c "cleaning_job_assignments" src/types/database.types.ts
```

**Expect:** `db:reset` exits 0 with no SQL error and applies `0014_cleaning_job_assignments.sql`; the `grep` prints a number greater than `0`.

```bash
pnpm test:db
```

**Expect:** every file reports `ok`, the summary ends with `Result: PASS`, and `cleaning_job_assignments.test.sql` runs 14 tests. If a test fails, stop and report; do not edit the test or the migration to make it pass.

```bash
pnpm typecheck && pnpm lint
```

**Expect:** both exit 0.

```bash
git status --short
```

**Expect:** only `supabase/migrations/0014_cleaning_job_assignments.sql`, `supabase/tests/database/cleaning_job_assignments.test.sql`, `src/types/database.types.ts` and this plan file. Anything else: stop and report.

## Rollback

- Before commit: `git switch main && git branch -D feat/T3C-B18-Cleaning-Job-Assignments-Table`, then `pnpm db:reset`.
- After merge, if a hosted DB already has `0014_cleaning_job_assignments.sql`: add `0114_drop_cleaning_job_assignments.sql` containing `drop table public.cleaning_job_assignments;`. Never edit or delete an applied migration. Stop and ask first if other tables already reference `cleaning_job_assignments`.

## Conventional commits

Branch: `feat/T3C-B18-Cleaning-Job-Assignments-Table` (from `main`). Stage explicit paths only. Each commit leaves the suites green. Every commit ends with:

```
Refs: T3C-B18

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `feat(db): add cleaning_job_assignments table with admin-write RLS`
   Files: `supabase/migrations/0014_cleaning_job_assignments.sql`, `src/types/database.types.ts`
2. `test(db): cover cleaning_job_assignments constraints and access`
   Files: `supabase/tests/database/cleaning_job_assignments.test.sql`
3. `docs(plans): add T3C-B18 plan`
   Files: `.claude/plans/T3C-B18-Cleaning-Job-Assignments-Table.md`

PR title: `feat(db): add cleaning_job_assignments table` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
