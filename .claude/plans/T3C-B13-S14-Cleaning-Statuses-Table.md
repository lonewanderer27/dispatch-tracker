# T3C-B13 T3C-S14 Add the cleaning_statuses table and seed it

> **Status: Approved and implemented** on `feat/T3C-B11-B13-S12-S14-Cleaning-Types-And-Statuses` (commits `243ccac`, `6b158ae`, `bd64a67`).
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

Source: sprint sheet `The Tidy Team - Digital Platforms Sprint - Sprint 2_ Nov-23-27-2026'.csv`.

- T3C-B13: "As a dispatcher, I want a list of job statuses, so that I can see where each job is in its life cycle." Acceptance: table `cleaning_statuses` with columns `id`, `name`; `name` is required and unique.
- T3C-S14: "As a dispatcher, I want the four job statuses available, so that jobs can move from booking to completion." Acceptance: after seeding, `cleaning_statuses` holds exactly: Booked, Confirmed, In Progress, Done; rows are inserted in that order; running the seed twice creates no duplicates.

`cleaning_jobs.cleaning_status_id` (T3C-B15) must default to Booked, so the Booked row needs a known id.

## Facts (verified 2026-11-27)

1. Branch is `main`. Migrations are numbered `NNNN_name.sql`. This plan adds `supabase/migrations/0012_cleaning_statuses.sql`, so migrations up to `0011` must already exist. Plans are applied in migration order: roles is `0003`, app_permissions is `0004` and user admin is `0005` (T3C-B0), companies is `0006` (`.claude/plans/T3C-B7-S8-Companies-Table.md`).
2. Required earlier migrations (plan that creates each): `0003_roles.sql` (T3C-B0). If any is missing, **stop and report**.
3. Table `public.cleaning_statuses` does not exist yet, and `src/types/database.types.ts` has no `cleaning_statuses` entry. That file is generated; never hand-edit it.
4. Roles come from T3C-B0 (`.claude/plans/T3C-B0-Users-Table.md`): `supabase/migrations/0003_roles.sql` creates `public.roles` (Admin id `30000000-0000-0000-0000-000000000001`, User id `30000000-0000-0000-0000-000000000002`) and replaces `profiles.role` with `profiles.role_id`. `public.is_admin()` is true when the caller's profile has the Admin role id. Policies of this table do not use it; they call `(select public.has_permission('<table>', '<action>'))`, which needs `0004_app_permissions.sql` (T3C-B0 phase 2: Super Admin role id `30000000-0000-0000-0000-000000000003`, `public.app_permissions`, `public.has_permission`). If `0004_app_permissions.sql` is missing, **stop and report**. If `0003_roles.sql` is missing, **stop and report**.
5. Table pattern (`0001_init.sql`): `id uuid primary key default gen_random_uuid()`, `enable row level security`, `revoke all ... from anon, authenticated`, explicit `grant ... to authenticated`, then policies.
6. `supabase/tests/database/` holds `rls.test.sql`, `seed.test.sql`, `todo_stats.test.sql` (and `roles.test.sql` and `companies.test.sql` once T3C-B0 and T3C-B7-S8 are implemented). `rls.test.sql` already asserts that every public table has RLS enabled.
7. `supabase/seed.sql` runs only on `pnpm db:reset`. New seed blocks are **appended to the end** of the file.

## Decisions already made (do not reopen)

- **The four seeded rows have fixed ids** (`10000000-0000-0000-0000-00000000000{1..4}` for Booked, Confirmed, In Progress, Done) so that `cleaning_jobs` can use the Booked id as a column default (T3C-B15). Inserting in that order also makes the ids sort in life-cycle order; there is no separate sort column because the story lists only `id` and `name`.
- Lookup table: reads for everyone, writes for admins only.
- **Access (owner rule)**: a profile with the **Admin** role can read and write this table; a profile with the **User** role can only read it. Implemented as four policies (select, insert, update, delete) that call `has_permission(<table>, <action>)`, plus the table's three rows in `app_permissions` (Admin and Super Admin read and write, User reads only), seeded in the same migration. `anon` gets nothing. There is no per-user ownership on this data, so there is no user-isolation test.
- **Columns are exactly those in the story**, in the story order. No `created_at` unless the story lists it.
- **Required text columns** are `not null` and also reject blank or whitespace-only values (`char_length(trim(col)) > 0`).
- **No UI** in this plan. Backend and seed stories only. Pages for this table are out of scope (see open question).

### Open questions (do not block)

1. There is no sort column, so display order relies on the fixed ids. Should a `sort_order` column be added?
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
git status --short && git switch -c feat/T3C-B13-S14-Cleaning-Statuses-Table && pnpm db:start
```

**Gate:** `git branch --show-current && ls supabase/migrations`
**Expect:** `feat/T3C-B13-S14-Cleaning-Statuses-Table`, then a migration list that ends at `0011_cleaning_types.sql` (the file just before this plan's `0012`). If `git status --short` printed anything before the switch, or the list is different, stop and report.

### Step 1. Migration (create file)

Create `supabase/migrations/0012_cleaning_statuses.sql` with exactly this content:

```sql
-- 0012_cleaning_statuses: the life-cycle statuses of a job.

create table public.cleaning_statuses (
  id   uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  constraint cleaning_statuses_name_key unique (name)
);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.cleaning_statuses enable row level security;

revoke all on public.cleaning_statuses from anon, authenticated;
grant select, insert, update, delete on public.cleaning_statuses to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy cleaning_statuses_select
  on public.cleaning_statuses for select to authenticated
  using ((select public.has_permission('cleaning_statuses', 'read')));

create policy cleaning_statuses_insert
  on public.cleaning_statuses for insert to authenticated
  with check ((select public.has_permission('cleaning_statuses', 'create')));

create policy cleaning_statuses_update
  on public.cleaning_statuses for update to authenticated
  using ((select public.has_permission('cleaning_statuses', 'update')))
  with check ((select public.has_permission('cleaning_statuses', 'update')));

create policy cleaning_statuses_delete
  on public.cleaning_statuses for delete to authenticated
  using ((select public.has_permission('cleaning_statuses', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'cleaning_statuses', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'cleaning_statuses', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'cleaning_statuses', true, true,  true,  true);
```

### Step 2. Seed (edit `supabase/seed.sql`)

Append to the end of the file (after its last line) a blank line and this block:

```sql

-- Reference data: job statuses, in life-cycle order. Fixed ids: cleaning_jobs defaults to Booked.
insert into public.cleaning_statuses (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Booked'),
  ('10000000-0000-0000-0000-000000000002', 'Confirmed'),
  ('10000000-0000-0000-0000-000000000003', 'In Progress'),
  ('10000000-0000-0000-0000-000000000004', 'Done')
on conflict do nothing;
```

### Step 3. pgTAP test (create file)

Create `supabase/tests/database/cleaning_statuses.test.sql` with exactly this content:

```sql
-- pgTAP: cleaning_statuses. RLS, access, constraints, seed.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Seed (runs after db:reset): exactly the four statuses in order, and no duplicates on re-run.
select results_eq(
  $$select name from public.cleaning_statuses order by id$$,
  $$values ('Booked'), ('Confirmed'), ('In Progress'), ('Done')$$,
  'seed creates the four statuses in life-cycle order'
);

insert into public.cleaning_statuses (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Booked'),
  ('10000000-0000-0000-0000-000000000002', 'Confirmed'),
  ('10000000-0000-0000-0000-000000000003', 'In Progress'),
  ('10000000-0000-0000-0000-000000000004', 'Done')
on conflict do nothing;

select is(
  (select count(*) from public.cleaning_statuses),
  4::bigint,
  'seeding twice creates no duplicate statuses'
);

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
insert into public.cleaning_statuses (name) values ('Test Status');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.cleaning_statuses'::regclass),
  'cleaning_statuses has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.cleaning_statuses$$,
  '42501',
  null,
  'anon is denied select on cleaning_statuses'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.cleaning_statuses (name) values ('Alice Status')$$,
  'an Admin can insert into cleaning_statuses'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.cleaning_statuses) >= 1,
  'a User can read cleaning_statuses'
);

select throws_ok(
  $$insert into public.cleaning_statuses (name) values ('Alice Status')$$,
  '42501',
  null,
  'a User cannot insert into cleaning_statuses'
);

select lives_ok(
  $$update public.cleaning_statuses set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.cleaning_statuses$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.cleaning_statuses) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select throws_ok(
  $$insert into public.cleaning_statuses (name) values ('Test Status')$$,
  '23505',
  null,
  'name must be unique'
);

select throws_ok(
  $$insert into public.cleaning_statuses (name) values (null)$$,
  '23502',
  null,
  'name is required'
);

select throws_ok(
  $$insert into public.cleaning_statuses (name) values ('   ')$$,
  '23514',
  null,
  'name cannot be blank'
);

select * from finish();
rollback;
```

### Step 4. Gate

```bash
pnpm db:reset && grep -c "cleaning_statuses" src/types/database.types.ts
```

**Expect:** `db:reset` exits 0 with no SQL error and applies `0012_cleaning_statuses.sql`; the `grep` prints a number greater than `0`.

```bash
pnpm test:db
```

**Expect:** every file reports `ok`, the summary ends with `Result: PASS`, and `cleaning_statuses.test.sql` runs 13 tests. If a test fails, stop and report; do not edit the test or the migration to make it pass.

```bash
pnpm typecheck && pnpm lint
```

**Expect:** both exit 0.

```bash
git status --short
```

**Expect:** only `supabase/migrations/0012_cleaning_statuses.sql`, `supabase/seed.sql`, `supabase/tests/database/cleaning_statuses.test.sql`, `src/types/database.types.ts` and this plan file. Anything else: stop and report.

## Rollback

- Before commit: `git switch main && git branch -D feat/T3C-B13-S14-Cleaning-Statuses-Table`, then `pnpm db:reset`.
- After merge, if a hosted DB already has `0012_cleaning_statuses.sql`: add `0112_drop_cleaning_statuses.sql` containing `delete from public.app_permissions where resource = 'cleaning_statuses';` and `drop table public.cleaning_statuses;`. Never edit or delete an applied migration. Stop and ask first if other tables already reference `cleaning_statuses`.

## Conventional commits

Branch: `feat/T3C-B13-S14-Cleaning-Statuses-Table` (from `main`). Stage explicit paths only. Each commit leaves the suites green. Every commit ends with:

```
Refs: T3C-B13, T3C-S14

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `feat(db): add cleaning_statuses table with role-based RLS`
   Files: `supabase/migrations/0012_cleaning_statuses.sql`, `src/types/database.types.ts`
2. `feat(db): seed the four job statuses`
   Files: `supabase/seed.sql`
3. `test(db): cover cleaning_statuses constraints and access`
   Files: `supabase/tests/database/cleaning_statuses.test.sql`
4. `docs(plans): add T3C-B13 T3C-S14 plan`
   Files: `.claude/plans/T3C-B13-S14-Cleaning-Statuses-Table.md`

PR title: `feat(db): add cleaning_statuses table` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
