# T3C-B30 Add the invoice_templates table

> **Status: PENDING REVIEW.** Not approved for implementation until the owner removes this line.
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

Source: sprint sheet `The Tidy Team - Digital Platforms Sprint - Sprint 2_ Nov-23-27-2026'.csv`.

- T3C-B30: "As a finance user, I want each company to have its own invoice template, email address and GST rate, so that invoices carry the right branding and tax." Acceptance: table `invoice_templates` with columns `id`, `company_id`, `template`, `invoice_email`, `gst_percent`; `company_id` is a required foreign key to `companies.id`; `template` and `invoice_email` are required text; `gst_percent` is required numeric(5,2) between 0 and 100; each company has at most one template (unique `company_id`), pending Q9.

## Facts (verified 2026-11-27)

1. Branch is `main`. Migrations are numbered `NNNN_name.sql`. This plan adds `supabase/migrations/0023_invoice_templates.sql`, so migrations up to `0022` must already exist. Plans are applied in migration order: roles is `0003` (T3C-B0), companies is `0004` (`.claude/plans/backend/T3C-B7-S8-Companies-Table.md`).
2. Required earlier migrations (plan that creates each): `0003_roles.sql` (T3C-B0); `0004_companies.sql` (T3C-B7-S8). If any is missing, **stop and report**.
3. Table `public.invoice_templates` does not exist yet, and `src/types/database.types.ts` has no `invoice_templates` entry. That file is generated; never hand-edit it.
4. Roles come from T3C-B0 (`.claude/plans/backend/T3C-B0-Users-Table.md`): `supabase/migrations/0003_roles.sql` creates `public.roles` (Admin id `30000000-0000-0000-0000-000000000001`, User id `30000000-0000-0000-0000-000000000002`) and replaces `profiles.role` with `profiles.role_id`. `public.is_admin()` is true when the caller's profile has the Admin role id. Policies call it as `(select public.is_admin())`. If `0003_roles.sql` is missing, **stop and report**.
5. Table pattern (`0001_init.sql`): `id uuid primary key default gen_random_uuid()`, `enable row level security`, `revoke all ... from anon, authenticated`, explicit `grant ... to authenticated`, then policies.
6. `supabase/tests/database/` holds `rls.test.sql`, `seed.test.sql`, `todo_stats.test.sql` (and `roles.test.sql` and `companies.test.sql` once T3C-B0 and T3C-B7-S8 are implemented). `rls.test.sql` already asserts that every public table has RLS enabled.

## Decisions already made (do not reopen)

- `company_id` is **unique** (one template per company), as the story states, even though it says "pending Q9".
- `gst_percent` between 0 and 100 inclusive.
- `invoice_email` has no format check (only non-blank).
- Finance configuration: reads for everyone, writes for admins only.
- **Access (owner rule)**: a profile with the **Admin** role can read and write this table; a profile with the **User** role can only read it. Implemented as one select policy for every signed-in user plus one admin-only `for all` policy using `is_admin()`. `anon` gets nothing. There is no per-user ownership on this data, so there is no user-isolation test.
- **Columns are exactly those in the story**, in the story order. No `created_at` unless the story lists it.
- **Required text columns** are `not null` and also reject blank or whitespace-only values (`char_length(trim(col)) > 0`).
- **No UI** in this plan. Backend and seed stories only. Pages for this table are out of scope (see open question).

### Open questions (do not block)

1. The story marks the unique `company_id` as "pending Q9", but Q9 is not in the sheet I was given. Confirm one template per company is right (versus several, for example per period).
2. Should `invoice_email` be validated as an email address?
3. Pages (list, create, edit) for this table are not planned. Should they be added, as was done for companies?

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
git status --short && git switch -c feat/T3C-B30-Invoice-Templates-Table && pnpm db:start
```

**Gate:** `git branch --show-current && ls supabase/migrations`
**Expect:** `feat/T3C-B30-Invoice-Templates-Table`, then a migration list that ends at `0022_invoice_statuses.sql` (the file just before this plan's `0023`). If `git status --short` printed anything before the switch, or the list is different, stop and report.

### Step 1. Migration (create file)

Create `supabase/migrations/0023_invoice_templates.sql` with exactly this content:

```sql
-- 0023_invoice_templates: per-company invoice template, email address and GST rate.

create table public.invoice_templates (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id),
  template      text not null check (char_length(trim(template)) > 0),
  invoice_email text not null check (char_length(trim(invoice_email)) > 0),
  gst_percent   numeric(5, 2) not null check (gst_percent between 0 and 100),
  constraint invoice_templates_company_id_key unique (company_id)
);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.invoice_templates enable row level security;

revoke all on public.invoice_templates from anon, authenticated;
grant select, insert, update, delete on public.invoice_templates to authenticated;

-- Everyone signed in can read.
create policy invoice_templates_select_authenticated
  on public.invoice_templates for select to authenticated
  using (true);

-- Only admins can change.
create policy invoice_templates_admin_all
  on public.invoice_templates for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
```

### Step 2. pgTAP test (create file)

Create `supabase/tests/database/invoice_templates.test.sql` with exactly this content:

```sql
-- pgTAP: invoice_templates. RLS, access, constraints.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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
insert into public.companies (id, name) values ('c0000000-0000-0000-0000-000000000002', 'Test Co 2'), ('c0000000-0000-0000-0000-000000000003', 'Test Co 3');
insert into public.invoice_templates (company_id, template, invoice_email, gst_percent) values ('c0000000-0000-0000-0000-000000000001', 'Template', 'inv@test.local', 10);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.invoice_templates'::regclass),
  'invoice_templates has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.invoice_templates$$,
  '42501',
  null,
  'anon is denied select on invoice_templates'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.invoice_templates (company_id, template, invoice_email, gst_percent) values ('c0000000-0000-0000-0000-000000000002', 'Template', 'inv2@test.local', 10)$$,
  'an Admin can insert into invoice_templates'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.invoice_templates) >= 1,
  'a User can read invoice_templates'
);

select throws_ok(
  $$insert into public.invoice_templates (company_id, template, invoice_email, gst_percent) values ('c0000000-0000-0000-0000-000000000002', 'Template', 'inv2@test.local', 10)$$,
  '42501',
  null,
  'a User cannot insert into invoice_templates'
);

select lives_ok(
  $$update public.invoice_templates set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.invoice_templates$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.invoice_templates) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select throws_ok(
  $$insert into public.invoice_templates (company_id, template, invoice_email, gst_percent) values ('c0000000-0000-0000-0000-000000000001', 'Again', 'a@test.local', 5)$$,
  '23505',
  null,
  'each company has at most one template'
);

select lives_ok(
  $$insert into public.invoice_templates (company_id, template, invoice_email, gst_percent) values ('c0000000-0000-0000-0000-000000000003', 'Zero', 'z@test.local', 0)$$,
  'gst_percent 0 is allowed'
);

select throws_ok(
  $$insert into public.invoice_templates (company_id, template, invoice_email, gst_percent) values (null, 'T', 'a@test.local', 5)$$,
  '23502',
  null,
  'company_id is required'
);

select throws_ok(
  $$insert into public.invoice_templates (company_id, template, invoice_email, gst_percent) values ('99999999-9999-9999-9999-999999999999', 'T', 'a@test.local', 5)$$,
  '23503',
  null,
  'company_id must exist in companies'
);

select throws_ok(
  $$insert into public.invoice_templates (company_id, template, invoice_email, gst_percent) values ('c0000000-0000-0000-0000-000000000001', null, 'a@test.local', 5)$$,
  '23502',
  null,
  'template is required'
);

select throws_ok(
  $$insert into public.invoice_templates (company_id, template, invoice_email, gst_percent) values ('c0000000-0000-0000-0000-000000000001', 'T', null, 5)$$,
  '23502',
  null,
  'invoice_email is required'
);

select throws_ok(
  $$insert into public.invoice_templates (company_id, template, invoice_email, gst_percent) values ('c0000000-0000-0000-0000-000000000001', 'T', 'a@test.local', null)$$,
  '23502',
  null,
  'gst_percent is required'
);

select throws_ok(
  $$insert into public.invoice_templates (company_id, template, invoice_email, gst_percent) values ('c0000000-0000-0000-0000-000000000001', 'T', 'a@test.local', -0.01)$$,
  '23514',
  null,
  'gst_percent cannot be below 0'
);

select throws_ok(
  $$insert into public.invoice_templates (company_id, template, invoice_email, gst_percent) values ('c0000000-0000-0000-0000-000000000001', 'T', 'a@test.local', 100.01)$$,
  '23514',
  null,
  'gst_percent cannot be above 100'
);

select * from finish();
rollback;
```

### Step 3. Gate

```bash
pnpm db:reset && grep -c "invoice_templates" src/types/database.types.ts
```

**Expect:** `db:reset` exits 0 with no SQL error and applies `0023_invoice_templates.sql`; the `grep` prints a number greater than `0`.

```bash
pnpm test:db
```

**Expect:** every file reports `ok`, the summary ends with `Result: PASS`, and `invoice_templates.test.sql` runs 17 tests. If a test fails, stop and report; do not edit the test or the migration to make it pass.

```bash
pnpm typecheck && pnpm lint
```

**Expect:** both exit 0.

```bash
git status --short
```

**Expect:** only `supabase/migrations/0023_invoice_templates.sql`, `supabase/tests/database/invoice_templates.test.sql`, `src/types/database.types.ts` and this plan file. Anything else: stop and report.

## Rollback

- Before commit: `git switch main && git branch -D feat/T3C-B30-Invoice-Templates-Table`, then `pnpm db:reset`.
- After merge, if a hosted DB already has `0023_invoice_templates.sql`: add `0123_drop_invoice_templates.sql` containing `drop table public.invoice_templates;`. Never edit or delete an applied migration. Stop and ask first if other tables already reference `invoice_templates`.

## Conventional commits

Branch: `feat/T3C-B30-Invoice-Templates-Table` (from `main`). Stage explicit paths only. Each commit leaves the suites green. Every commit ends with:

```
Refs: T3C-B30

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `feat(db): add invoice_templates table with admin-write RLS`
   Files: `supabase/migrations/0023_invoice_templates.sql`, `src/types/database.types.ts`
2. `test(db): cover invoice_templates constraints and access`
   Files: `supabase/tests/database/invoice_templates.test.sql`
3. `docs(plans): add T3C-B30 plan`
   Files: `.claude/plans/T3C-B30-Invoice-Templates-Table.md`

PR title: `feat(db): add invoice_templates table` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
