# T3C-B15 Add the cleaning_jobs table

> **Status: PENDING REVIEW.** Not approved for implementation until the owner removes this line.
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

Source: sprint sheet `The Tidy Team - Digital Platforms Sprint - Sprint 2_ Nov-23-27-2026'.csv`.

- T3C-B15: "As a dispatcher, I want to record each booked clean with when, for whom, how long and at what rate, so that I can plan and dispatch cleaners." Acceptance: table `cleaning_jobs` with columns `id`, `schedule`, `client_id`, `property_id`, `cleaning_status_id`, `est_hours`, `cleaners_needed`, `rate`, `pets`, `description`; `schedule` is a required timestamptz stored in UTC; `client_id`, `property_id` and `cleaning_status_id` are required foreign keys; `est_hours` and `cleaners_needed` are required integers greater than 0; `rate` is required numeric(10,2) and not negative; `pets` and `description` are optional text; new jobs default to the Booked status; cleaning types are not stored on this table (see T3C-B33).
- Change (owner, 2026-11-27): `property_id` was missing from the story. A job is for a property, so it is a required foreign key to `properties` (T3C-B21). Properties, areas and items (T3C-B21, T3C-B22, T3C-B24) are implemented before this table.

## Facts (verified 2026-11-27)

1. Branch is `main`. Migrations are numbered `NNNN_name.sql`. This plan adds `supabase/migrations/0013_cleaning_jobs.sql`, so migrations up to `0012` must already exist. **Known problem:** `property_id` references `public.properties`, which is created by `0019_properties.sql` (T3C-B21). A migration numbered `0013` sorts before `0019` and fails on `pnpm db:reset`. See open question 1 before implementing. Plans are applied in migration order: roles is `0003`, app_permissions is `0004` and user admin is `0005` (T3C-B0), companies is `0006` (`.claude/plans/backend/T3C-B7-S8-Companies-Table.md`).
2. Required earlier migrations (plan that creates each): `0003_roles.sql` and `0004_app_permissions.sql` (T3C-B0); `0007_clients.sql` (T3C-B6); `0012_cleaning_statuses.sql` (T3C-B13-S14); `0019_properties.sql` (T3C-B21). If any is missing, **stop and report**.
3. The seed from T3C-S14 (in `0011`'s plan) must be applied: the `Booked` status row with id `10000000-0000-0000-0000-000000000001` must exist after `pnpm db:reset`.
4. Table `public.cleaning_jobs` does not exist yet, and `src/types/database.types.ts` has no `cleaning_jobs` entry. That file is generated; never hand-edit it.
5. Roles come from T3C-B0 (`.claude/plans/backend/T3C-B0-Users-Table.md`): `supabase/migrations/0003_roles.sql` creates `public.roles` (Admin id `30000000-0000-0000-0000-000000000001`, User id `30000000-0000-0000-0000-000000000002`) and replaces `profiles.role` with `profiles.role_id`. `public.is_admin()` is true when the caller's profile has the Admin role id. Policies of this table do not use it; they call `(select public.has_permission('<table>', '<action>'))`, which needs `0004_app_permissions.sql` (T3C-B0 phase 2: Super Admin role id `30000000-0000-0000-0000-000000000003`, `public.app_permissions`, `public.has_permission`). If `0004_app_permissions.sql` is missing, **stop and report**. If `0003_roles.sql` is missing, **stop and report**.
6. Table pattern (`0001_init.sql`): `id uuid primary key default gen_random_uuid()`, `enable row level security`, `revoke all ... from anon, authenticated`, explicit `grant ... to authenticated`, then policies.
7. `supabase/tests/database/` holds `rls.test.sql`, `seed.test.sql`, `todo_stats.test.sql` (and `roles.test.sql` and `companies.test.sql` once T3C-B0 and T3C-B7-S8 are implemented). `rls.test.sql` already asserts that every public table has RLS enabled.

## Decisions already made (do not reopen)

- `schedule` is `timestamptz`; Postgres stores it in UTC internally and converts on display, which satisfies "stored in UTC".
- The Booked default is the fixed uuid from T3C-S14 written as a literal. An insert on a database where that seed row is missing fails the foreign key (see open question).
- `client_id`, `property_id` and `cleaning_status_id` use `no action` (clients, properties and statuses in use cannot be deleted).
- `est_hours` is an integer, as the story says (no half hours).
- **Access (owner rule)**: a profile with the **Admin** role can read and write this table; a profile with the **User** role can only read it. Implemented as four policies (select, insert, update, delete) that call `has_permission(<table>, <action>)`, plus the table's three rows in `app_permissions` (Admin and Super Admin read and write, User reads only), seeded in the same migration. `anon` gets nothing. There is no per-user ownership on this data, so there is no user-isolation test.
- **Columns are exactly those in the story**, in the story order. No `created_at` unless the story lists it.
- **Required text columns** are `not null` and also reject blank or whitespace-only values (`char_length(trim(col)) > 0`).
- **No UI** in this plan. Backend and seed stories only. Pages for this table are out of scope (see open question).

### Open questions (do not block, except number 1)

1. **Migration number (blocks implementation).** `property_id` needs `0019_properties.sql` to exist first, so this table must be numbered after `0021`. Renumber this migration and its test file to the next free number after `0021`. Plans T3C-B26 and T3C-B27 reference `0022` and `0023` and must be renumbered to follow it. Owner to decide before implementing.
2. `cleaners_needed` is not checked against the number of rows in `cleaning_job_assignments`. Should it be?
3. The Booked default only works where the S14 seed ran. SIT and production need the four statuses loaded (same issue as the companies seed).
4. Pages (list, create, edit) for this table are not planned. Should they be added, as was done for companies?

## Out of scope

- Every other table or story in the sprint sheet.
- UI pages, Playwright e2e specs, Vitest component tests.
- The role model beyond Admin, User and Super Admin.
- Loading data into SIT or production.
- `README.md` and `AGENTS.md` edits.

## Steps

Working directory for every command: the repo root (`dispatch-tracker`).

### Step 0. Branch and baseline

```bash
git status --short && git switch -c feat/T3C-B15-Cleaning-Jobs-Table && pnpm db:start
```

**Gate:** `git branch --show-current && ls supabase/migrations`
**Expect:** `feat/T3C-B15-Cleaning-Jobs-Table`, then a migration list that includes `0019_properties.sql`, `0020_areas.sql` and `0021_items.sql`, and ends at the migration number chosen in open question 1, minus one. If `git status --short` printed anything before the switch, or the list is different, stop and report.

### Step 1. Migration (create file)

Create `supabase/migrations/0013_cleaning_jobs.sql` with exactly this content. (Use the number chosen in open question 1 instead of `0013` if it has been changed.)

```sql
-- 0013_cleaning_jobs: booked cleans: when, for whom, how long and at what rate.

create table public.cleaning_jobs (
  id                 uuid primary key default gen_random_uuid(),
  schedule           timestamptz not null,
  client_id          uuid not null references public.clients (id),
  property_id        uuid not null references public.properties (id),
  cleaning_status_id uuid not null
    default '10000000-0000-0000-0000-000000000001'  -- Booked (fixed id seeded by T3C-S14)
    references public.cleaning_statuses (id),
  est_hours          integer not null check (est_hours > 0),
  cleaners_needed    integer not null check (cleaners_needed > 0),
  rate               numeric(10, 2) not null check (rate >= 0),
  pets               text,
  description        text
);

create index cleaning_jobs_client_id_idx on public.cleaning_jobs (client_id);
create index cleaning_jobs_property_id_idx on public.cleaning_jobs (property_id);
create index cleaning_jobs_cleaning_status_id_idx on public.cleaning_jobs (cleaning_status_id);
create index cleaning_jobs_schedule_idx on public.cleaning_jobs (schedule);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.cleaning_jobs enable row level security;

revoke all on public.cleaning_jobs from anon, authenticated;
grant select, insert, update, delete on public.cleaning_jobs to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy cleaning_jobs_select
  on public.cleaning_jobs for select to authenticated
  using ((select public.has_permission('cleaning_jobs', 'read')));

create policy cleaning_jobs_insert
  on public.cleaning_jobs for insert to authenticated
  with check ((select public.has_permission('cleaning_jobs', 'create')));

create policy cleaning_jobs_update
  on public.cleaning_jobs for update to authenticated
  using ((select public.has_permission('cleaning_jobs', 'update')))
  with check ((select public.has_permission('cleaning_jobs', 'update')));

create policy cleaning_jobs_delete
  on public.cleaning_jobs for delete to authenticated
  using ((select public.has_permission('cleaning_jobs', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'cleaning_jobs', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'cleaning_jobs', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'cleaning_jobs', true, true,  true,  true);
```

### Step 2. pgTAP test (create file)

Create `supabase/tests/database/cleaning_jobs.test.sql` with exactly this content. (Use the migration number from open question 1 in the file name if it has been changed.)

```sql
-- pgTAP: cleaning_jobs. RLS, access, constraints.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

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
insert into public.property_types (id, name) values ('c5000000-0000-0000-0000-000000000001', 'Test Property Type');
insert into public.properties (id, client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code)
values ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '1 Test St', 'Testville', 'NSW', '2000', 'AU');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.cleaning_jobs'::regclass),
  'cleaning_jobs has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.cleaning_jobs$$,
  '42501',
  null,
  'anon is denied select on cleaning_jobs'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values ('2026-12-01 09:00:00+00', 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 2, 1, 50.00)$$,
  'an Admin can insert into cleaning_jobs'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.cleaning_jobs) >= 1,
  'a User can read cleaning_jobs'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values ('2026-12-01 09:00:00+00', 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 2, 1, 50.00)$$,
  '42501',
  null,
  'a User cannot insert into cleaning_jobs'
);

select lives_ok(
  $$update public.cleaning_jobs set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.cleaning_jobs$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.cleaning_jobs) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select is(
  (select cleaning_status_id from public.cleaning_jobs limit 1),
  (select id from public.cleaning_statuses where name = 'Booked'),
  'new jobs default to the Booked status'
);

select is(
  (select count(*) from public.cleaning_jobs where schedule = '2026-12-01 09:00:00+00'),
  1::bigint,
  'schedule round-trips as the same instant'
);

select lives_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate, pets, description) values (now(), 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1, 1, 0, 'Dog', 'Zero rate and optional text')$$,
  'a rate of 0 is allowed and pets and description are optional'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values (null, 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1, 1, 1)$$,
  '23502',
  null,
  'schedule is required'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values (now(), null, 'c2000000-0000-0000-0000-000000000001', 1, 1, 1)$$,
  '23502',
  null,
  'client_id is required'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values (now(), 'c1000000-0000-0000-0000-000000000001', null, 1, 1, 1)$$,
  '23502',
  null,
  'property_id is required'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, cleaning_status_id, est_hours, cleaners_needed, rate) values (now(), 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', null, 1, 1, 1)$$,
  '23502',
  null,
  'cleaning_status_id cannot be null'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values (now(), '99999999-9999-9999-9999-999999999999', 'c2000000-0000-0000-0000-000000000001', 1, 1, 1)$$,
  '23503',
  null,
  'client_id must exist in clients'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values (now(), 'c1000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', 1, 1, 1)$$,
  '23503',
  null,
  'property_id must exist in properties'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, cleaning_status_id, est_hours, cleaners_needed, rate) values (now(), 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', 1, 1, 1)$$,
  '23503',
  null,
  'cleaning_status_id must exist in cleaning_statuses'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values (now(), 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 0, 1, 1)$$,
  '23514',
  null,
  'est_hours must be greater than 0'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values (now(), 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1, 0, 1)$$,
  '23514',
  null,
  'cleaners_needed must be greater than 0'
);

select throws_ok(
  $$insert into public.cleaning_jobs (schedule, client_id, property_id, est_hours, cleaners_needed, rate) values (now(), 'c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1, 1, -0.01)$$,
  '23514',
  null,
  'rate cannot be negative'
);

select * from finish();
rollback;
```

### Step 3. Gate

```bash
pnpm db:reset && grep -c "cleaning_jobs" src/types/database.types.ts
```

**Expect:** `db:reset` exits 0 with no SQL error and applies the cleaning_jobs migration after `0021_items.sql`; the `grep` prints a number greater than `0`.

```bash
pnpm test:db
```

**Expect:** every file reports `ok`, the summary ends with `Result: PASS`, and `cleaning_jobs.test.sql` runs 21 tests. If a test fails, stop and report; do not edit the test or the migration to make it pass.

```bash
pnpm typecheck && pnpm lint
```

**Expect:** both exit 0.

```bash
git status --short
```

**Expect:** only the cleaning_jobs migration, `supabase/tests/database/cleaning_jobs.test.sql`, `src/types/database.types.ts` and this plan file. Anything else: stop and report.

## Rollback

- Before commit: `git switch main && git branch -D feat/T3C-B15-Cleaning-Jobs-Table`, then `pnpm db:reset`.
- After merge, if a hosted DB already has the cleaning_jobs migration: add a new `01NN_drop_cleaning_jobs.sql` migration containing `delete from public.app_permissions where resource = 'cleaning_jobs';` and `drop table public.cleaning_jobs;`. Never edit or delete an applied migration. Stop and ask first if other tables already reference `cleaning_jobs`.

## Conventional commits

Branch: `feat/T3C-B15-Cleaning-Jobs-Table` (from `main`). Stage explicit paths only. Each commit leaves the suites green. Every commit ends with:

```
Refs: T3C-B15

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `feat(db): add cleaning_jobs table with role-based RLS`
   Files: the cleaning_jobs migration, `src/types/database.types.ts`
2. `test(db): cover cleaning_jobs constraints and access`
   Files: `supabase/tests/database/cleaning_jobs.test.sql`
3. `docs(plans): add T3C-B15 plan`
   Files: `.claude/plans/backend/T3C-B15-Cleaning-Jobs-Table.md`

PR title: `feat(db): add cleaning_jobs table` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
