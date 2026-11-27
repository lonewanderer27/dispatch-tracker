# T3C-B19 Add the cleaning_feedbacks table

> **Status: PENDING REVIEW.** Not approved for implementation until the owner removes this line.
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

Source: sprint sheet `The Tidy Team - Digital Platforms Sprint - Sprint 2_ Nov-23-27-2026'.csv`.

- T3C-B19: "As a dispatcher, I want to capture a rating and comments after a clean, so that I can monitor quality." Acceptance: table `cleaning_feedbacks` with columns `id`, `cleaning_job_id`, `rating`, `feedback`; `cleaning_job_id` is a required foreign key to `cleaning_jobs.id`; `rating` is a required integer with a check constraint of 0 to 5; `feedback` is optional text.

## Facts (verified 2026-11-27)

1. Branch is `main`. Migrations are numbered `NNNN_name.sql`. This plan adds `supabase/migrations/0017_cleaning_feedbacks.sql`, so migrations up to `0016` must already exist. Plans are applied in migration order: roles is `0003`, app_permissions is `0004` and user admin is `0005` (T3C-B0), companies is `0006` (`.claude/plans/backend/T3C-B7-S8-Companies-Table.md`).
2. Required earlier migrations (plan that creates each): `0003_roles.sql` and `0004_app_permissions.sql` (T3C-B0); `0013_cleaning_jobs.sql` (T3C-B15). If any is missing, **stop and report**.
3. Table `public.cleaning_feedbacks` does not exist yet, and `src/types/database.types.ts` has no `cleaning_feedbacks` entry. That file is generated; never hand-edit it.
4. Roles come from T3C-B0 (`.claude/plans/backend/T3C-B0-Users-Table.md`): `supabase/migrations/0003_roles.sql` creates `public.roles` (Admin id `30000000-0000-0000-0000-000000000001`, User id `30000000-0000-0000-0000-000000000002`) and replaces `profiles.role` with `profiles.role_id`. `public.is_admin()` is true when the caller's profile has the Admin role id. Policies of this table do not use it; they call `(select public.has_permission('<table>', '<action>'))`, which needs `0004_app_permissions.sql` (T3C-B0 phase 2: Super Admin role id `30000000-0000-0000-0000-000000000003`, `public.app_permissions`, `public.has_permission`). If `0004_app_permissions.sql` is missing, **stop and report**. If `0003_roles.sql` is missing, **stop and report**.
5. Table pattern (`0001_init.sql`): `id uuid primary key default gen_random_uuid()`, `enable row level security`, `revoke all ... from anon, authenticated`, explicit `grant ... to authenticated`, then policies.
6. `supabase/tests/database/` holds `rls.test.sql`, `seed.test.sql`, `todo_stats.test.sql` (and `roles.test.sql` and `companies.test.sql` once T3C-B0 and T3C-B7-S8 are implemented). `rls.test.sql` already asserts that every public table has RLS enabled.

## Decisions already made (do not reopen)

- `cleaning_job_id` is `on delete cascade`.
- Not unique per job: a job may have more than one feedback row (the story does not limit it).
- The rating range 0 to 5 is inclusive.
- **Access (owner rule)**: a profile with the **Admin** role can read and write this table; a profile with the **User** role can only read it. Implemented as four policies (select, insert, update, delete) that call `has_permission(<table>, <action>)`, plus the table's three rows in `app_permissions` (Admin and Super Admin read and write, User reads only), seeded in the same migration. `anon` gets nothing. There is no per-user ownership on this data, so there is no user-isolation test.
- **Columns are exactly those in the story**, in the story order. No `created_at` unless the story lists it.
- **Required text columns** are `not null` and also reject blank or whitespace-only values (`char_length(trim(col)) > 0`).
- **No UI** in this plan. Backend and seed stories only. Pages for this table are out of scope (see open question).

### Open questions (do not block)

1. Should a job be limited to one feedback row?
2. Pages (list, create, edit) for this table are not planned. Should they be added, as was done for companies?

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
git status --short && git switch -c feat/T3C-B19-Cleaning-Feedbacks-Table && pnpm db:start
```

**Gate:** `git branch --show-current && ls supabase/migrations`
**Expect:** `feat/T3C-B19-Cleaning-Feedbacks-Table`, then a migration list that ends at `0016_cleaning_job_assignments.sql` (the file just before this plan's `0017`). If `git status --short` printed anything before the switch, or the list is different, stop and report.

### Step 1. Migration (create file)

Create `supabase/migrations/0017_cleaning_feedbacks.sql` with exactly this content:

```sql
-- 0017_cleaning_feedbacks: ratings and comments captured after a clean.

create table public.cleaning_feedbacks (
  id              uuid primary key default gen_random_uuid(),
  cleaning_job_id uuid not null references public.cleaning_jobs (id) on delete cascade,
  rating          integer not null check (rating between 0 and 5),
  feedback        text
);

create index cleaning_feedbacks_cleaning_job_id_idx on public.cleaning_feedbacks (cleaning_job_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.cleaning_feedbacks enable row level security;

revoke all on public.cleaning_feedbacks from anon, authenticated;
grant select, insert, update, delete on public.cleaning_feedbacks to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy cleaning_feedbacks_select
  on public.cleaning_feedbacks for select to authenticated
  using ((select public.has_permission('cleaning_feedbacks', 'read')));

create policy cleaning_feedbacks_insert
  on public.cleaning_feedbacks for insert to authenticated
  with check ((select public.has_permission('cleaning_feedbacks', 'create')));

create policy cleaning_feedbacks_update
  on public.cleaning_feedbacks for update to authenticated
  using ((select public.has_permission('cleaning_feedbacks', 'update')))
  with check ((select public.has_permission('cleaning_feedbacks', 'update')));

create policy cleaning_feedbacks_delete
  on public.cleaning_feedbacks for delete to authenticated
  using ((select public.has_permission('cleaning_feedbacks', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'cleaning_feedbacks', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'cleaning_feedbacks', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'cleaning_feedbacks', true, true,  true,  true);
```

### Step 2. pgTAP test (create file)

Create `supabase/tests/database/cleaning_feedbacks.test.sql` with exactly this content:

```sql
-- pgTAP: cleaning_feedbacks. RLS, access, constraints.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

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

select ok(
  (select relrowsecurity from pg_class where oid = 'public.cleaning_feedbacks'::regclass),
  'cleaning_feedbacks has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.cleaning_feedbacks$$,
  '42501',
  null,
  'anon is denied select on cleaning_feedbacks'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.cleaning_feedbacks (cleaning_job_id, rating) values ('c3000000-0000-0000-0000-000000000001', 4)$$,
  'an Admin can insert into cleaning_feedbacks'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.cleaning_feedbacks) >= 1,
  'a User can read cleaning_feedbacks'
);

select throws_ok(
  $$insert into public.cleaning_feedbacks (cleaning_job_id, rating) values ('c3000000-0000-0000-0000-000000000001', 4)$$,
  '42501',
  null,
  'a User cannot insert into cleaning_feedbacks'
);

select lives_ok(
  $$update public.cleaning_feedbacks set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.cleaning_feedbacks$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.cleaning_feedbacks) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select is(
  (select count(*) from public.cleaning_feedbacks where feedback is null),
  1::bigint,
  'feedback is optional'
);

select lives_ok(
  $$insert into public.cleaning_feedbacks (cleaning_job_id, rating, feedback) values ('c3000000-0000-0000-0000-000000000001', 0, 'Lowest')$$,
  'rating 0 is allowed'
);

select lives_ok(
  $$insert into public.cleaning_feedbacks (cleaning_job_id, rating, feedback) values ('c3000000-0000-0000-0000-000000000001', 5, 'Highest')$$,
  'rating 5 is allowed'
);

select throws_ok(
  $$insert into public.cleaning_feedbacks (cleaning_job_id, rating) values ('c3000000-0000-0000-0000-000000000001', -1)$$,
  '23514',
  null,
  'rating below 0 is rejected'
);

select throws_ok(
  $$insert into public.cleaning_feedbacks (cleaning_job_id, rating) values ('c3000000-0000-0000-0000-000000000001', 6)$$,
  '23514',
  null,
  'rating above 5 is rejected'
);

select throws_ok(
  $$insert into public.cleaning_feedbacks (cleaning_job_id, rating) values ('c3000000-0000-0000-0000-000000000001', null)$$,
  '23502',
  null,
  'rating is required'
);

select throws_ok(
  $$insert into public.cleaning_feedbacks (cleaning_job_id, rating) values (null, 3)$$,
  '23502',
  null,
  'cleaning_job_id is required'
);

select throws_ok(
  $$insert into public.cleaning_feedbacks (cleaning_job_id, rating) values ('99999999-9999-9999-9999-999999999999', 3)$$,
  '23503',
  null,
  'cleaning_job_id must exist in cleaning_jobs'
);

select * from finish();
rollback;
```

### Step 3. Gate

```bash
pnpm db:reset && grep -c "cleaning_feedbacks" src/types/database.types.ts
```

**Expect:** `db:reset` exits 0 with no SQL error and applies `0017_cleaning_feedbacks.sql`; the `grep` prints a number greater than `0`.

```bash
pnpm test:db
```

**Expect:** every file reports `ok`, the summary ends with `Result: PASS`, and `cleaning_feedbacks.test.sql` runs 16 tests. If a test fails, stop and report; do not edit the test or the migration to make it pass.

```bash
pnpm typecheck && pnpm lint
```

**Expect:** both exit 0.

```bash
git status --short
```

**Expect:** only `supabase/migrations/0017_cleaning_feedbacks.sql`, `supabase/tests/database/cleaning_feedbacks.test.sql`, `src/types/database.types.ts` and this plan file. Anything else: stop and report.

## Rollback

- Before commit: `git switch main && git branch -D feat/T3C-B19-Cleaning-Feedbacks-Table`, then `pnpm db:reset`.
- After merge, if a hosted DB already has `0017_cleaning_feedbacks.sql`: add `0117_drop_cleaning_feedbacks.sql` containing `delete from public.app_permissions where resource = 'cleaning_feedbacks';` and `drop table public.cleaning_feedbacks;`. Never edit or delete an applied migration. Stop and ask first if other tables already reference `cleaning_feedbacks`.

## Conventional commits

Branch: `feat/T3C-B19-Cleaning-Feedbacks-Table` (from `main`). Stage explicit paths only. Each commit leaves the suites green. Every commit ends with:

```
Refs: T3C-B19

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `feat(db): add cleaning_feedbacks table with role-based RLS`
   Files: `supabase/migrations/0017_cleaning_feedbacks.sql`, `src/types/database.types.ts`
2. `test(db): cover cleaning_feedbacks constraints and access`
   Files: `supabase/tests/database/cleaning_feedbacks.test.sql`
3. `docs(plans): add T3C-B19 plan`
   Files: `.claude/plans/T3C-B19-Cleaning-Feedbacks-Table.md`

PR title: `feat(db): add cleaning_feedbacks table` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
