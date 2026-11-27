# T3C-B10 Add the company_cleaners table

> **Status: PENDING REVIEW.** Not approved for implementation until the owner removes this line.
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

Source: sprint sheet `The Tidy Team - Digital Platforms Sprint - Sprint 2_ Nov-23-27-2026'.csv`.

- T3C-B10: "As a dispatcher, I want to record which companies each cleaner works for, so that I only dispatch cleaners to the right brand." Acceptance: table `company_cleaners` with columns `id`, `cleaner_id`, `company_id`; both are required foreign keys (`cleaners.id`, `companies.id`); the pair (`cleaner_id`, `company_id`) is unique; a cleaner can work for several companies.

## Facts (verified 2026-11-27)

1. Branch is `main` for T3C-B9. This plan is built on that same branch (see Step 0). Migrations are numbered `NNNN_name.sql`. This plan adds `supabase/migrations/0010_company_cleaners.sql`, so migrations up to `0009` must already exist. Plans are applied in migration order: roles is `0003`, app_permissions is `0004` and user admin is `0005` (T3C-B0), companies is `0006` (`.claude/plans/T3C-B7-S8-Companies-Table.md`).
2. Required earlier migrations (plan that creates each): `0003_roles.sql` and `0004_app_permissions.sql` (T3C-B0); `0006_companies.sql` (T3C-B7-S8); `0009_cleaners.sql` (T3C-B9). If any is missing, **stop and report**.
3. Table `public.company_cleaners` does not exist yet, and `src/types/database.types.ts` has no `company_cleaners` entry. That file is generated; never hand-edit it.
4. Roles come from T3C-B0 (`.claude/plans/T3C-B0-Users-Table.md`): `supabase/migrations/0003_roles.sql` creates `public.roles` (Admin id `30000000-0000-0000-0000-000000000001`, User id `30000000-0000-0000-0000-000000000002`) and replaces `profiles.role` with `profiles.role_id`. `public.is_admin()` is true when the caller's profile has the Admin role id. Policies of this table do not use it; they call `(select public.has_permission('<table>', '<action>'))`, which needs `0004_app_permissions.sql` (T3C-B0 phase 2: Super Admin role id `30000000-0000-0000-0000-000000000003`, `public.app_permissions`, `public.has_permission`). If `0004_app_permissions.sql` is missing, **stop and report**. If `0003_roles.sql` is missing, **stop and report**.
5. Table pattern (`0001_init.sql`): `id uuid primary key default gen_random_uuid()`, `enable row level security`, `revoke all ... from anon, authenticated`, explicit `grant ... to authenticated`, then policies.
6. `supabase/tests/database/` holds `rls.test.sql`, `seed.test.sql`, `todo_stats.test.sql` (and `roles.test.sql` and `companies.test.sql` once T3C-B0 and T3C-B7-S8 are implemented). `rls.test.sql` already asserts that every public table has RLS enabled.

## Decisions already made (do not reopen)

- `cleaner_id` is `on delete cascade` (deleting a cleaner removes their company links). `company_id` is `no action` (a company with cleaners cannot be deleted).
- **Access (owner rule)**: a profile with the **Admin** role can read and write this table; a profile with the **User** role can only read it. Implemented as four policies (select, insert, update, delete) that call `has_permission(<table>, <action>)`, plus the table's three rows in `app_permissions` (Admin and Super Admin read and write, User reads only), seeded in the same migration. `anon` gets nothing. There is no per-user ownership on this data, so there is no user-isolation test.
- **Columns are exactly those in the story**, in the story order. No `created_at` unless the story lists it.
- **Required text columns** are `not null` and also reject blank or whitespace-only values (`char_length(trim(col)) > 0`).
- **UI included (added after the first draft).** Pages live in `src/pages/company-cleaners/` at `/company-cleaners`. The list shows **one row per cleaner**, with each company as a closable tag. Closing a tag asks for confirmation and removes that link. A multi-select filter above the table picks one or more companies, or "No company" (cleaners with no links). An empty selection shows everyone. The rule is in `companyFilter.ts`, with unit tests. The create page picks a cleaner and a company. **There is no edit page:** a link is kept or removed, so changing one means removing it and adding the right one.
- **Access**: `company_cleaners` is in `ADMIN_WRITE_ONLY` (`accessControlProvider.ts`), the same as `clients` and `contacts`. Users can read the list; the add and remove controls are hidden for them, and the database enforces the same rule.
- **Seed included (added after the first draft).** Each of the ten seeded cleaners works for Total Home Care and The Tidy Team, which gives 20 links (`supabase/seed.sql`).

### Open questions (do not block)

1. Resolved: pages were added after review (see Decisions). There is no edit page, by design.

## Out of scope

- Every other table or story in the sprint sheet.
- Playwright e2e specs and Vitest component tests for the pages. The filter logic has unit tests (`companyFilter.test.ts`). The pages have not been opened in a browser.
- Capacity (h/day) from the sprint screenshot. It is not in the T3C-B10 story, and the table has no column for it.
- The role model beyond Admin, User and Super Admin.
- Loading data into SIT or production.
- `AGENTS.md` edits. `README.md` changes only the layout line, to list the new page folder.

## Steps

Working directory for every command: the repo root (`dispatch-tracker`).

### Step 0. Branch and baseline

```bash
git switch feat/T3C-B9-B10-Cleaners-And-Company-Cleaners && pnpm db:start
```

**Gate:** `git branch --show-current && ls supabase/migrations`
**Expect:** `feat/T3C-B9-B10-Cleaners-And-Company-Cleaners`, then a migration list that ends at `0009_cleaners.sql` (the file just before this plan's `0010`). If the list is different, stop and report. The clean-tree check from the first draft does not apply: T3C-B9's work is uncommitted on this branch.

**As built:** T3C-B10 could not branch from `main`, because it needs `0009_cleaners.sql` from T3C-B9. It was built on the T3C-B9 branch, renamed to `feat/T3C-B9-B10-Cleaners-And-Company-Cleaners`.

### Step 1. Migration (create file)

Create `supabase/migrations/0010_company_cleaners.sql` with exactly this content:

```sql
-- 0010_company_cleaners: which companies each cleaner works for.

create table public.company_cleaners (
  id         uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references public.cleaners (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  constraint company_cleaners_pair_key unique (cleaner_id, company_id)
);

create index company_cleaners_company_id_idx on public.company_cleaners (company_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.company_cleaners enable row level security;

revoke all on public.company_cleaners from anon, authenticated;
grant select, insert, update, delete on public.company_cleaners to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy company_cleaners_select
  on public.company_cleaners for select to authenticated
  using ((select public.has_permission('company_cleaners', 'read')));

create policy company_cleaners_insert
  on public.company_cleaners for insert to authenticated
  with check ((select public.has_permission('company_cleaners', 'create')));

create policy company_cleaners_update
  on public.company_cleaners for update to authenticated
  using ((select public.has_permission('company_cleaners', 'update')))
  with check ((select public.has_permission('company_cleaners', 'update')));

create policy company_cleaners_delete
  on public.company_cleaners for delete to authenticated
  using ((select public.has_permission('company_cleaners', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'company_cleaners', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'company_cleaners', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'company_cleaners', true, true,  true,  true);
```

### Step 2. pgTAP test (create file)

Create `supabase/tests/database/company_cleaners.test.sql` with exactly this content:

```sql
-- pgTAP: company_cleaners. RLS, access, constraints.
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
insert into public.companies (id, name) values ('c0000000-0000-0000-0000-000000000002', 'Test Co 2');
insert into public.cleaners (id, first_name, last_name) values
  ('c2000000-0000-0000-0000-000000000001', 'Test', 'Cleaner'),
  ('c2000000-0000-0000-0000-000000000002', 'Second', 'Cleaner');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.company_cleaners'::regclass),
  'company_cleaners has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.company_cleaners$$,
  '42501',
  null,
  'anon is denied select on company_cleaners'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.company_cleaners (cleaner_id, company_id) values ('c2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001')$$,
  'an Admin can insert into company_cleaners'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.company_cleaners) >= 1,
  'a User can read company_cleaners'
);

select throws_ok(
  $$insert into public.company_cleaners (cleaner_id, company_id) values ('c2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'a User cannot insert into company_cleaners'
);

select lives_ok(
  $$update public.company_cleaners set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.company_cleaners$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.company_cleaners) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select throws_ok(
  $$insert into public.company_cleaners (cleaner_id, company_id) values ('c2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001')$$,
  '23505',
  null,
  'the (cleaner_id, company_id) pair must be unique'
);

select lives_ok(
  $$insert into public.company_cleaners (cleaner_id, company_id) values ('c2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')$$,
  'a cleaner can work for several companies'
);

select throws_ok(
  $$insert into public.company_cleaners (cleaner_id, company_id) values (null, 'c0000000-0000-0000-0000-000000000001')$$,
  '23502',
  null,
  'cleaner_id is required'
);

select throws_ok(
  $$insert into public.company_cleaners (cleaner_id, company_id) values ('c2000000-0000-0000-0000-000000000001', null)$$,
  '23502',
  null,
  'company_id is required'
);

select throws_ok(
  $$insert into public.company_cleaners (cleaner_id, company_id) values ('99999999-9999-9999-9999-999999999999', 'c0000000-0000-0000-0000-000000000001')$$,
  '23503',
  null,
  'cleaner_id must exist in cleaners'
);

select throws_ok(
  $$insert into public.company_cleaners (cleaner_id, company_id) values ('c2000000-0000-0000-0000-000000000002', '99999999-9999-9999-9999-999999999999')$$,
  '23503',
  null,
  'company_id must exist in companies'
);

select * from finish();
rollback;
```

### Step 3. Gate

```bash
pnpm db:reset && grep -c "company_cleaners" src/types/database.types.ts
```

**Expect:** `db:reset` exits 0 with no SQL error and applies `0010_company_cleaners.sql`; the `grep` prints a number greater than `0`.

```bash
pnpm test:db
```

**Expect:** every file reports `ok`, the summary ends with `Result: PASS`, and `company_cleaners.test.sql` runs 14 tests. If a test fails, stop and report; do not edit the test or the migration to make it pass.

```bash
pnpm typecheck && pnpm lint
```

**Expect:** both exit 0.

```bash
git status --short
```

**Expect:** only `supabase/migrations/0010_company_cleaners.sql`, `supabase/tests/database/company_cleaners.test.sql`, `src/types/database.types.ts` and this plan file. Anything else: stop and report. This check runs before Steps 4 and 5. After them, the files named there are also expected, and so are T3C-B9's files, which are on the same branch.

### Step 4. Pages, filter and access (added after the first draft)

The contents are in the repo. The first draft was reviewed without them, so this plan names the files and what each one does.

- `src/types/db.ts`: add `CleanerCompanyLink` (a `company_cleaners` row plus `companies: { name } | null`) and `CleanerWithCompanies` (a `cleaners` row plus `company_cleaners: CleanerCompanyLink[]`). The list is one row per cleaner, so there is no per-link row type.
- `src/pages/company-cleaners/companyFilter.ts`: `NO_COMPANY` and `matchesCompanyFilter(cleaner, selected)`. An empty selection matches everyone. Otherwise a cleaner matches when they work for any selected company, or when `NO_COMPANY` is selected and they have no links.
- `src/pages/company-cleaners/companyFilter.test.ts`: five unit tests for that rule.
- `src/pages/company-cleaners/CompanyCleanerList.tsx`: one row per cleaner (name, then companies as closable tags). Closing a tag asks for confirmation and deletes that link. The multi-select filter sits above the table. The table has no pagination, so the filter can run on the full list.
- `src/pages/company-cleaners/CompanyCleanerCreate.tsx`: a cleaner select (labelled with full name) and a company select, both required.
- `src/providers/accessControlProvider.ts`: add `'company_cleaners'` to `ADMIN_WRITE_ONLY`. `accessControlProvider.test.ts`: add it to the `it.each` lists.
- `src/App.tsx`: icon `LinkOutlined`, resource `company_cleaners` (`/company-cleaners`, create; no edit route), and the `/company-cleaners` routes.
- `README.md`: the layout line lists `pages/company-cleaners`.

**Gate:** `pnpm typecheck && pnpm lint && pnpm test && pnpm exec vite build`
**Expect:** all exit 0. Vitest reports 32 tests passing (the 27 existing tests plus the five filter tests).

### Step 5. Seed (added after the first draft)

- `supabase/seed.sql`: append a company-links section after the cleaners section. It joins the roster by full name to `Total Home Care` and `The Tidy Team` and uses `on conflict (cleaner_id, company_id) do nothing`, so it is safe to run twice.

**Gate:** `pnpm db:reset && pnpm exec supabase db query --local "select count(*) from public.company_cleaners"`
**Expect:** `db:reset` exits 0. The count is `20`.

**Gate:** run the links section a second time through `psql` in the local DB container (the CLI cannot run a multi-statement file), then `pnpm test:db`.
**Expect:** the section exits 0 and the count is still `20`. `pnpm test:db` ends with `Result: PASS` (11 files, 179 tests as built).

## Rollback

- Before commit: do not delete the branch, because it also holds T3C-B9. To undo only T3C-B10, remove what it added: `0010_company_cleaners.sql`, `company_cleaners.test.sql`, `src/pages/company-cleaners/`, its lines in `App.tsx`, `accessControlProvider.ts` and its test, `db.ts`, and `README.md`, plus the company-links section of `seed.sql`. Then run `pnpm db:reset`.
- After merge, if a hosted DB already has `0010_company_cleaners.sql`: add `0110_drop_company_cleaners.sql` containing `delete from public.app_permissions where resource = 'company_cleaners';` and `drop table public.company_cleaners;`. Never edit or delete an applied migration. Stop and ask first if other tables already reference `company_cleaners`.

## Conventional commits

Branch: `feat/T3C-B9-B10-Cleaners-And-Company-Cleaners` (from `main`), shared with T3C-B9. Stage explicit paths only. Each commit leaves the suites green. Every commit ends with:

```
Refs: T3C-B10

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>
```

1. `feat(db): add company_cleaners table with role-based RLS`
   Files: `supabase/migrations/0010_company_cleaners.sql`, `src/types/database.types.ts`
2. `test(db): cover company_cleaners constraints and access`
   Files: `supabase/tests/database/company_cleaners.test.sql`
3. `feat(web): add company_cleaners pages with a company filter`
   Files: `src/pages/company-cleaners/`, `src/types/db.ts`, `src/App.tsx`, `src/providers/accessControlProvider.ts`, `src/providers/accessControlProvider.test.ts`, `README.md`
4. `feat(db): seed company links for the cleaners roster`
   Files: `supabase/seed.sql` (company-links section only)
5. `docs(plans): add T3C-B10 plan`
   Files: `.claude/plans/T3C-B10-Company-Cleaners-Table.md`

Shared files: `src/types/db.ts`, `src/App.tsx`, `src/providers/accessControlProvider.ts`, its test, `README.md` and `supabase/seed.sql` also carry T3C-B9 changes. Split them by hunk with `git add -p`, or commit both tickets together.

PR title: `feat(db): add company_cleaners table` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
