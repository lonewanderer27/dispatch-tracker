# T3C-B17 Add the preferred_cleaners table

> **Status: PENDING REVIEW.** Not approved for implementation until the owner removes this line.
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

Source: sprint sheet `The Tidy Team - Digital Platforms Sprint - Sprint 2_ Nov-23-27-2026'.csv`.

- T3C-B17: "As a dispatcher, I want to record a client's preferred cleaners, so that I can send the people they like first." Acceptance: table `preferred_cleaners` with columns `id`, `cleaner_id`, `client_id`; both are required foreign keys (`cleaners.id`, `clients.id`); the pair (`client_id`, `cleaner_id`) is unique; a client can have several preferred cleaners.

## Facts (verified 2026-11-27)

1. Branch is `main`. Migrations are numbered `NNNN_name.sql`. This plan adds `supabase/migrations/0013_preferred_cleaners.sql`, so migrations up to `0012` must already exist. Plans are applied in migration order: roles is `0003` (T3C-B0), companies is `0004` (`.claude/plans/backend/T3C-B7-S8-Companies-Table.md`).
2. Required earlier migrations (plan that creates each): `0003_roles.sql` (T3C-B0); `0005_clients.sql` (T3C-B6); `0007_cleaners.sql` (T3C-B9). If any is missing, **stop and report**.
3. Table `public.preferred_cleaners` does not exist yet, and `src/types/database.types.ts` has no `preferred_cleaners` entry. That file is generated; never hand-edit it.
4. Roles come from T3C-B0 (`.claude/plans/backend/T3C-B0-Users-Table.md`): `supabase/migrations/0003_roles.sql` creates `public.roles` (Admin id `30000000-0000-0000-0000-000000000001`, User id `30000000-0000-0000-0000-000000000002`) and replaces `profiles.role` with `profiles.role_id`. `public.is_admin()` is true when the caller's profile has the Admin role id. Policies call it as `(select public.is_admin())`. If `0003_roles.sql` is missing, **stop and report**.
5. Table pattern (`0001_init.sql`): `id uuid primary key default gen_random_uuid()`, `enable row level security`, `revoke all ... from anon, authenticated`, explicit `grant ... to authenticated`, then policies.
6. `supabase/tests/database/` holds `rls.test.sql`, `seed.test.sql`, `todo_stats.test.sql` (and `roles.test.sql` and `companies.test.sql` once T3C-B0 and T3C-B7-S8 are implemented). `rls.test.sql` already asserts that every public table has RLS enabled.

## Decisions already made (do not reopen)

- Both foreign keys are `on delete cascade` (a preference has no meaning without either side).
- Column order follows the story (`cleaner_id` before `client_id`); the unique pair is (`client_id`, `cleaner_id`).
- **Access (owner rule)**: a profile with the **Admin** role can read and write this table; a profile with the **User** role can only read it. Implemented as one select policy for every signed-in user plus one admin-only `for all` policy using `is_admin()`. `anon` gets nothing. There is no per-user ownership on this data, so there is no user-isolation test.
- **Columns are exactly those in the story**, in the story order. No `created_at` unless the story lists it.
- **Required text columns** are `not null` and also reject blank or whitespace-only values (`char_length(trim(col)) > 0`).
- **No UI** in this plan. Backend and seed stories only. Pages for this table are out of scope (see open question).

### Open questions (do not block)

1. Should a preferred cleaner be required to work for the same company as the client (via `company_cleaners`)? Not enforced.
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
git status --short && git switch -c feat/T3C-B17-Preferred-Cleaners-Table && pnpm db:start
```

**Gate:** `git branch --show-current && ls supabase/migrations`
**Expect:** `feat/T3C-B17-Preferred-Cleaners-Table`, then a migration list that ends at `0012_cleaning_job_updates.sql` (the file just before this plan's `0013`). If `git status --short` printed anything before the switch, or the list is different, stop and report.

### Step 1. Migration (create file)

Create `supabase/migrations/0013_preferred_cleaners.sql` with exactly this content:

```sql
-- 0013_preferred_cleaners: a client's preferred cleaners.

create table public.preferred_cleaners (
  id         uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references public.cleaners (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  constraint preferred_cleaners_pair_key unique (client_id, cleaner_id)
);

create index preferred_cleaners_cleaner_id_idx on public.preferred_cleaners (cleaner_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.preferred_cleaners enable row level security;

revoke all on public.preferred_cleaners from anon, authenticated;
grant select, insert, update, delete on public.preferred_cleaners to authenticated;

-- Everyone signed in can read.
create policy preferred_cleaners_select_authenticated
  on public.preferred_cleaners for select to authenticated
  using (true);

-- Only admins can change.
create policy preferred_cleaners_admin_all
  on public.preferred_cleaners for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
```

### Step 2. pgTAP test (create file)

Create `supabase/tests/database/preferred_cleaners.test.sql` with exactly this content:

```sql
-- pgTAP: preferred_cleaners. RLS, access, constraints.
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
insert into public.cleaners (id, first_name, last_name) values
  ('c2000000-0000-0000-0000-000000000001', 'Test', 'Cleaner'),
  ('c2000000-0000-0000-0000-000000000002', 'Second', 'Cleaner');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.preferred_cleaners'::regclass),
  'preferred_cleaners has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.preferred_cleaners$$,
  '42501',
  null,
  'anon is denied select on preferred_cleaners'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.preferred_cleaners (cleaner_id, client_id) values ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001')$$,
  'an Admin can insert into preferred_cleaners'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.preferred_cleaners) >= 1,
  'a User can read preferred_cleaners'
);

select throws_ok(
  $$insert into public.preferred_cleaners (cleaner_id, client_id) values ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'a User cannot insert into preferred_cleaners'
);

select lives_ok(
  $$update public.preferred_cleaners set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.preferred_cleaners$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.preferred_cleaners) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select throws_ok(
  $$insert into public.preferred_cleaners (cleaner_id, client_id) values ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001')$$,
  '23505',
  null,
  'the (client_id, cleaner_id) pair must be unique'
);

select lives_ok(
  $$insert into public.preferred_cleaners (cleaner_id, client_id) values ('c2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001')$$,
  'a client can have several preferred cleaners'
);

select throws_ok(
  $$insert into public.preferred_cleaners (cleaner_id, client_id) values (null, 'c1000000-0000-0000-0000-000000000001')$$,
  '23502',
  null,
  'cleaner_id is required'
);

select throws_ok(
  $$insert into public.preferred_cleaners (cleaner_id, client_id) values ('c2000000-0000-0000-0000-000000000001', null)$$,
  '23502',
  null,
  'client_id is required'
);

select throws_ok(
  $$insert into public.preferred_cleaners (cleaner_id, client_id) values ('99999999-9999-9999-9999-999999999999', 'c1000000-0000-0000-0000-000000000001')$$,
  '23503',
  null,
  'cleaner_id must exist in cleaners'
);

select throws_ok(
  $$insert into public.preferred_cleaners (cleaner_id, client_id) values ('c2000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999')$$,
  '23503',
  null,
  'client_id must exist in clients'
);

select * from finish();
rollback;
```

### Step 3. Gate

```bash
pnpm db:reset && grep -c "preferred_cleaners" src/types/database.types.ts
```

**Expect:** `db:reset` exits 0 with no SQL error and applies `0013_preferred_cleaners.sql`; the `grep` prints a number greater than `0`.

```bash
pnpm test:db
```

**Expect:** every file reports `ok`, the summary ends with `Result: PASS`, and `preferred_cleaners.test.sql` runs 14 tests. If a test fails, stop and report; do not edit the test or the migration to make it pass.

```bash
pnpm typecheck && pnpm lint
```

**Expect:** both exit 0.

```bash
git status --short
```

**Expect:** only `supabase/migrations/0013_preferred_cleaners.sql`, `supabase/tests/database/preferred_cleaners.test.sql`, `src/types/database.types.ts` and this plan file. Anything else: stop and report.

## Rollback

- Before commit: `git switch main && git branch -D feat/T3C-B17-Preferred-Cleaners-Table`, then `pnpm db:reset`.
- After merge, if a hosted DB already has `0013_preferred_cleaners.sql`: add `0113_drop_preferred_cleaners.sql` containing `drop table public.preferred_cleaners;`. Never edit or delete an applied migration. Stop and ask first if other tables already reference `preferred_cleaners`.

## Conventional commits

Branch: `feat/T3C-B17-Preferred-Cleaners-Table` (from `main`). Stage explicit paths only. Each commit leaves the suites green. Every commit ends with:

```
Refs: T3C-B17

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `feat(db): add preferred_cleaners table with admin-write RLS`
   Files: `supabase/migrations/0013_preferred_cleaners.sql`, `src/types/database.types.ts`
2. `test(db): cover preferred_cleaners constraints and access`
   Files: `supabase/tests/database/preferred_cleaners.test.sql`
3. `docs(plans): add T3C-B17 plan`
   Files: `.claude/plans/T3C-B17-Preferred-Cleaners-Table.md`

PR title: `feat(db): add preferred_cleaners table` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
