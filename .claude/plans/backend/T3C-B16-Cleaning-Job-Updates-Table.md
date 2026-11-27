# T3C-B16 Add the cleaning_job_updates table

> **Status: Approved and implemented** on `feat/T3C-B15-B16-B18-B19-B26-B27-B33-F35-Cleaning-Jobs` (commits `5c02d16`, `a5e5d8e`, with plan updates in `df938b5` and `e5218ff`).
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

Source: sprint sheet `The Tidy Team - Digital Platforms Sprint - Sprint 2_ Nov-23-27-2026'.csv`.

- T3C-B16: "As a dispatcher, I want to log notes against a job as it progresses, so that everyone sees what has happened." Acceptance: table `cleaning_job_updates` with columns `id`, `cleaning_job_id`, `description`; `cleaning_job_id` is a required foreign key to `cleaning_jobs.id`; `description` is required text; `created_at` records when each update was made.

The story lists `created_at` in its acceptance text, so it is added as a fourth column.

## Facts (verified 2026-11-27)

1. Branch is `main`. Migrations are numbered `NNNN_name.sql`. This plan adds `supabase/migrations/0023_cleaning_job_updates.sql`, so migrations up to `0022` must already exist. Plans are applied in migration order: roles is `0003`, app_permissions is `0004` and user admin is `0005` (T3C-B0), companies is `0006` (`.claude/plans/backend/T3C-B7-S8-Companies-Table.md`).
2. Required earlier migrations (plan that creates each): `0003_roles.sql` and `0004_app_permissions.sql` (T3C-B0); `0022_cleaning_jobs.sql` (T3C-B15). If any is missing, **stop and report**.
3. Table `public.cleaning_job_updates` does not exist yet, and `src/types/database.types.ts` has no `cleaning_job_updates` entry. That file is generated; never hand-edit it.
4. Roles come from T3C-B0 (`.claude/plans/backend/T3C-B0-Users-Table.md`): `supabase/migrations/0003_roles.sql` creates `public.roles` (Admin id `30000000-0000-0000-0000-000000000001`, User id `30000000-0000-0000-0000-000000000002`) and replaces `profiles.role` with `profiles.role_id`. `public.is_admin()` is true when the caller's profile has the Admin role id. Policies of this table do not use it; they call `(select public.has_permission('<table>', '<action>'))`, which needs `0004_app_permissions.sql` (T3C-B0 phase 2: Super Admin role id `30000000-0000-0000-0000-000000000003`, `public.app_permissions`, `public.has_permission`). If `0004_app_permissions.sql` is missing, **stop and report**. If `0003_roles.sql` is missing, **stop and report**.
5. Table pattern (`0001_init.sql`): `id uuid primary key default gen_random_uuid()`, `enable row level security`, `revoke all ... from anon, authenticated`, explicit `grant ... to authenticated`, then policies.
6. `supabase/tests/database/` holds `rls.test.sql`, `seed.test.sql`, `todo_stats.test.sql` (and `roles.test.sql` and `companies.test.sql` once T3C-B0 and T3C-B7-S8 are implemented). `rls.test.sql` already asserts that every public table has RLS enabled.

## Decisions already made (do not reopen)

- `cleaning_job_id` is `on delete cascade`: deleting a job deletes its updates.
- `created_at` is `timestamptz not null default now()`.
- **Access (owner rule)**: a profile with the **Admin** role can read and write this table; a profile with the **User** role can only read it. Implemented as four policies (select, insert, update, delete) that call `has_permission(<table>, <action>)`, plus the table's three rows in `app_permissions` (Admin and Super Admin read and write, User reads only), seeded in the same migration. `anon` gets nothing. There is no per-user ownership on this data, so there is no user-isolation test.
- **Columns are exactly those in the story**, in the story order. No `created_at` unless the story lists it.
- **Required text columns** are `not null` and also reject blank or whitespace-only values (`char_length(trim(col)) > 0`).
- **No UI** in this plan. Backend and seed stories only. Pages for this table are out of scope (see open question).

### Open questions (do not block)

1. Updates record no author. Should a `user_id` (who logged it) be added?
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
git status --short && git switch -c feat/T3C-B16-Cleaning-Job-Updates-Table && pnpm db:start
```

**Gate:** `git branch --show-current && ls supabase/migrations`
**Expect:** `feat/T3C-B16-Cleaning-Job-Updates-Table`, then a migration list that ends at `0022_cleaning_jobs.sql` (the file just before this plan's `0023`). If `git status --short` printed anything before the switch, or the list is different, stop and report.

### Step 1. Migration (create file)

Create `supabase/migrations/0023_cleaning_job_updates.sql` with exactly this content:

```sql
-- 0023_cleaning_job_updates: progress notes logged against a job.

create table public.cleaning_job_updates (
  id              uuid primary key default gen_random_uuid(),
  cleaning_job_id uuid not null references public.cleaning_jobs (id) on delete cascade,
  description     text not null check (char_length(trim(description)) > 0),
  created_at      timestamptz not null default now()
);

create index cleaning_job_updates_cleaning_job_id_idx on public.cleaning_job_updates (cleaning_job_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.cleaning_job_updates enable row level security;

revoke all on public.cleaning_job_updates from anon, authenticated;
grant select, insert, update, delete on public.cleaning_job_updates to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy cleaning_job_updates_select
  on public.cleaning_job_updates for select to authenticated
  using ((select public.has_permission('cleaning_job_updates', 'read')));

create policy cleaning_job_updates_insert
  on public.cleaning_job_updates for insert to authenticated
  with check ((select public.has_permission('cleaning_job_updates', 'create')));

create policy cleaning_job_updates_update
  on public.cleaning_job_updates for update to authenticated
  using ((select public.has_permission('cleaning_job_updates', 'update')))
  with check ((select public.has_permission('cleaning_job_updates', 'update')));

create policy cleaning_job_updates_delete
  on public.cleaning_job_updates for delete to authenticated
  using ((select public.has_permission('cleaning_job_updates', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'cleaning_job_updates', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'cleaning_job_updates', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'cleaning_job_updates', true, true,  true,  true);
```

### Step 2. pgTAP test (create file)

Create `supabase/tests/database/cleaning_job_updates.test.sql` with exactly this content:

```sql
-- pgTAP: cleaning_job_updates. RLS, access, constraints.
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
insert into public.property_types (id, name) values ('c5000000-0000-0000-0000-000000000001', 'Test Property Type');
insert into public.properties (id, client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code)
values ('c6000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '1 Test St', 'Testville', 'NSW', '2000', 'AU');
insert into public.cleaning_jobs (id, schedule, client_id, property_id, est_hours, cleaners_needed, rate)
values ('c3000000-0000-0000-0000-000000000001', '2026-12-01 09:00:00+00', 'c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 2, 1, 50.00);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.cleaning_job_updates'::regclass),
  'cleaning_job_updates has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.cleaning_job_updates$$,
  '42501',
  null,
  'anon is denied select on cleaning_job_updates'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.cleaning_job_updates (cleaning_job_id, description) values ('c3000000-0000-0000-0000-000000000001', 'Cleaner arrived')$$,
  'an Admin can insert into cleaning_job_updates'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.cleaning_job_updates) >= 1,
  'a User can read cleaning_job_updates'
);

select throws_ok(
  $$insert into public.cleaning_job_updates (cleaning_job_id, description) values ('c3000000-0000-0000-0000-000000000001', 'Cleaner arrived')$$,
  '42501',
  null,
  'a User cannot insert into cleaning_job_updates'
);

select lives_ok(
  $$update public.cleaning_job_updates set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.cleaning_job_updates$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.cleaning_job_updates) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select ok(
  (select created_at is not null from public.cleaning_job_updates where description = 'Cleaner arrived'),
  'created_at is filled in automatically'
);

select throws_ok(
  $$insert into public.cleaning_job_updates (cleaning_job_id, description) values (null, 'x')$$,
  '23502',
  null,
  'cleaning_job_id is required'
);

select throws_ok(
  $$insert into public.cleaning_job_updates (cleaning_job_id, description) values ('99999999-9999-9999-9999-999999999999', 'x')$$,
  '23503',
  null,
  'cleaning_job_id must exist in cleaning_jobs'
);

select throws_ok(
  $$insert into public.cleaning_job_updates (cleaning_job_id, description) values ('c3000000-0000-0000-0000-000000000001', null)$$,
  '23502',
  null,
  'description is required'
);

select throws_ok(
  $$insert into public.cleaning_job_updates (cleaning_job_id, description) values ('c3000000-0000-0000-0000-000000000001', '  ')$$,
  '23514',
  null,
  'description cannot be blank'
);

delete from public.cleaning_jobs where id = 'c3000000-0000-0000-0000-000000000001';

select is(
  (select count(*) from public.cleaning_job_updates),
  0::bigint,
  'deleting a job deletes its updates'
);

select * from finish();
rollback;
```

### Step 3. Gate

```bash
pnpm db:reset && grep -c "cleaning_job_updates" src/types/database.types.ts
```

**Expect:** `db:reset` exits 0 with no SQL error and applies `0023_cleaning_job_updates.sql`; the `grep` prints a number greater than `0`.

```bash
pnpm test:db
```

**Expect:** every file reports `ok`, the summary ends with `Result: PASS`, and `cleaning_job_updates.test.sql` runs 14 tests. If a test fails, stop and report; do not edit the test or the migration to make it pass.

```bash
pnpm typecheck && pnpm lint
```

**Expect:** both exit 0.

```bash
git status --short
```

**Expect:** only `supabase/migrations/0023_cleaning_job_updates.sql`, `supabase/tests/database/cleaning_job_updates.test.sql`, `src/types/database.types.ts` and this plan file. Anything else: stop and report.

## As built (2026-11-27)

- Migration and pgTAP test match the steps (commits `5c02d16`, `a5e5d8e`; this table's migration number is the one in this plan). `pnpm test:db` passes.
- The plan was renumbered to follow `0019_properties.sql` (see `df938b5`), and the test fixtures gained a property because `cleaning_jobs.property_id` is required.
- Not built: pages for this table, Playwright specs and Vitest component tests.

## Rollback

- Before commit: `git switch main && git branch -D feat/T3C-B16-Cleaning-Job-Updates-Table`, then `pnpm db:reset`.
- After merge, if a hosted DB already has `0023_cleaning_job_updates.sql`: add `0123_drop_cleaning_job_updates.sql` containing `delete from public.app_permissions where resource = 'cleaning_job_updates';` and `drop table public.cleaning_job_updates;`. Never edit or delete an applied migration. Stop and ask first if other tables already reference `cleaning_job_updates`.

## Conventional commits

Branch: `feat/T3C-B16-Cleaning-Job-Updates-Table` (from `main`). Stage explicit paths only. Each commit leaves the suites green. Every commit ends with:

```
Refs: T3C-B16

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `feat(db): add cleaning_job_updates table with role-based RLS`
   Files: `supabase/migrations/0023_cleaning_job_updates.sql`, `src/types/database.types.ts`
2. `test(db): cover cleaning_job_updates constraints and access`
   Files: `supabase/tests/database/cleaning_job_updates.test.sql`
3. `docs(plans): add T3C-B16 plan`
   Files: `.claude/plans/backend/T3C-B16-Cleaning-Job-Updates-Table.md`

PR title: `feat(db): add cleaning_job_updates table` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
