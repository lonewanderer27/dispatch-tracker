# T3C-B32 Add the invoices table

> **Status: PENDING REVIEW.** Not approved for implementation until the owner removes this line.
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

Source: sprint sheet `The Tidy Team - Digital Platforms Sprint - Sprint 2_ Nov-23-27-2026'.csv`.

- T3C-B32: "As a finance user, I want to raise an invoice for a completed clean, so that the client can be billed and I can track payment." Acceptance: table `invoices` with columns `id`, `cleaning_job_id`, `client_id`, `invoice_status_id`, `invoice_template_id`, `description`; `cleaning_job_id`, `client_id`, `invoice_status_id` and `invoice_template_id` are required foreign keys; `invoice_status_id` defaults to Draft; `description` is optional text.

## Facts (verified 2026-11-27)

1. Branch is `main`. Migrations are numbered `NNNN_name.sql`. This plan adds `supabase/migrations/0034_invoices.sql`, so migrations up to `0033` must already exist. Plans are applied in migration order: roles is `0003`, app_permissions is `0004` and user admin is `0005` (T3C-B0), companies is `0006` (`.claude/plans/backend/T3C-B7-S8-Companies-Table.md`).
2. Required earlier migrations (plan that creates each): `0003_roles.sql` and `0004_app_permissions.sql` (T3C-B0); `0007_clients.sql` (T3C-B6); `0022_cleaning_jobs.sql` (T3C-B15); `0032_invoice_statuses.sql` (T3C-B28-S29); `0033_invoice_templates.sql` (T3C-B30). If any is missing, **stop and report**.
3. The seed from T3C-S29 must be applied: the `Draft` status row with id `20000000-0000-0000-0000-000000000001` must exist after `pnpm db:reset`.
4. Table `public.invoices` does not exist yet, and `src/types/database.types.ts` has no `invoices` entry. That file is generated; never hand-edit it.
5. Roles come from T3C-B0 (`.claude/plans/backend/T3C-B0-Users-Table.md`): `supabase/migrations/0003_roles.sql` creates `public.roles` (Admin id `30000000-0000-0000-0000-000000000001`, User id `30000000-0000-0000-0000-000000000002`) and replaces `profiles.role` with `profiles.role_id`. `public.is_admin()` is true when the caller's profile has the Admin role id. Policies of this table do not use it; they call `(select public.has_permission('<table>', '<action>'))`, which needs `0004_app_permissions.sql` (T3C-B0 phase 2: Super Admin role id `30000000-0000-0000-0000-000000000003`, `public.app_permissions`, `public.has_permission`). If `0004_app_permissions.sql` is missing, **stop and report**. If `0003_roles.sql` is missing, **stop and report**.
6. Table pattern (`0001_init.sql`): `id uuid primary key default gen_random_uuid()`, `enable row level security`, `revoke all ... from anon, authenticated`, explicit `grant ... to authenticated`, then policies.
7. `supabase/tests/database/` holds `rls.test.sql`, `seed.test.sql`, `todo_stats.test.sql` (and `roles.test.sql` and `companies.test.sql` once T3C-B0 and T3C-B7-S8 are implemented). `rls.test.sql` already asserts that every public table has RLS enabled.

## Decisions already made (do not reopen)

- All four foreign keys are `no action`: a job, client, status or template that has invoices cannot be deleted (invoices are financial records).
- The Draft default is the fixed uuid from T3C-S29 written as a literal.
- Not unique per job: more than one invoice may exist for a job (the story does not limit it).
- The invoice's `client_id` is **not** checked against the job's `client_id`, and the template is not checked against the client's company.
- **Access (owner rule)**: a profile with the **Admin** role can read and write this table; a profile with the **User** role can only read it. Implemented as four policies (select, insert, update, delete) that call `has_permission(<table>, <action>)`, plus the table's three rows in `app_permissions` (Admin and Super Admin read and write, User reads only), seeded in the same migration. `anon` gets nothing. There is no per-user ownership on this data, so there is no user-isolation test.
- **Columns are exactly those in the story**, in the story order. No `created_at` unless the story lists it.
- **Required text columns** are `not null` and also reject blank or whitespace-only values (`char_length(trim(col)) > 0`).
- **No UI** in this plan. Backend and seed stories only. Pages for this table are out of scope (see open question).

### Open questions (do not block)

1. Should an invoice be limited to one per job?
2. Should the database enforce that `invoices.client_id` equals the job's client, and that the template belongs to the client's company? Today a mismatched invoice can be saved.
3. The Draft default only works where the S29 seed ran (SIT and production need the three statuses loaded).
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
git status --short && git switch -c feat/T3C-B32-Invoices-Table && pnpm db:start
```

**Gate:** `git branch --show-current && ls supabase/migrations`
**Expect:** `feat/T3C-B32-Invoices-Table`, then a migration list that ends at `0033_invoice_templates.sql` (the file just before this plan's `0034`). If `git status --short` printed anything before the switch, or the list is different, stop and report.

### Step 1. Migration (create file)

Create `supabase/migrations/0034_invoices.sql` with exactly this content:

```sql
-- 0034_invoices: invoices raised for completed cleans.

create table public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  cleaning_job_id     uuid not null references public.cleaning_jobs (id),
  client_id           uuid not null references public.clients (id),
  invoice_status_id   uuid not null
    default '20000000-0000-0000-0000-000000000001'  -- Draft (fixed id seeded by T3C-S29)
    references public.invoice_statuses (id),
  invoice_template_id uuid not null references public.invoice_templates (id),
  description         text
);

create index invoices_cleaning_job_id_idx on public.invoices (cleaning_job_id);
create index invoices_client_id_idx on public.invoices (client_id);
create index invoices_invoice_status_id_idx on public.invoices (invoice_status_id);
create index invoices_invoice_template_id_idx on public.invoices (invoice_template_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.invoices enable row level security;

revoke all on public.invoices from anon, authenticated;
grant select, insert, update, delete on public.invoices to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy invoices_select
  on public.invoices for select to authenticated
  using ((select public.has_permission('invoices', 'read')));

create policy invoices_insert
  on public.invoices for insert to authenticated
  with check ((select public.has_permission('invoices', 'create')));

create policy invoices_update
  on public.invoices for update to authenticated
  using ((select public.has_permission('invoices', 'update')))
  with check ((select public.has_permission('invoices', 'update')));

create policy invoices_delete
  on public.invoices for delete to authenticated
  using ((select public.has_permission('invoices', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'invoices', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'invoices', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'invoices', true, true,  true,  true);
```

### Step 2. pgTAP test (create file)

Create `supabase/tests/database/invoices.test.sql` with exactly this content:

```sql
-- pgTAP: invoices. RLS, access, constraints.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

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
insert into public.invoice_templates (id, company_id, template, invoice_email, gst_percent) values ('c8000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Template', 'inv@test.local', 10);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.invoices'::regclass),
  'invoices has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.invoices$$,
  '42501',
  null,
  'anon is denied select on invoices'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.invoices (cleaning_job_id, client_id, invoice_template_id) values ('c3000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-000000000001')$$,
  'an Admin can insert into invoices'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.invoices) >= 1,
  'a User can read invoices'
);

select throws_ok(
  $$insert into public.invoices (cleaning_job_id, client_id, invoice_template_id) values ('c3000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'a User cannot insert into invoices'
);

select lives_ok(
  $$update public.invoices set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.invoices$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.invoices) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select is(
  (select invoice_status_id from public.invoices limit 1),
  (select id from public.invoice_statuses where name = 'Draft'),
  'new invoices default to the Draft status'
);

select lives_ok(
  $$insert into public.invoices (cleaning_job_id, client_id, invoice_template_id, description) values ('c3000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-000000000001', 'With a description')$$,
  'description is optional and a job can have more than one invoice'
);

select throws_ok(
  $$insert into public.invoices (cleaning_job_id, client_id, invoice_template_id) values (null, 'c1000000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-000000000001')$$,
  '23502',
  null,
  'cleaning_job_id is required'
);

select throws_ok(
  $$insert into public.invoices (cleaning_job_id, client_id, invoice_template_id) values ('c3000000-0000-0000-0000-000000000001', null, 'c8000000-0000-0000-0000-000000000001')$$,
  '23502',
  null,
  'client_id is required'
);

select throws_ok(
  $$insert into public.invoices (cleaning_job_id, client_id, invoice_template_id) values ('c3000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null)$$,
  '23502',
  null,
  'invoice_template_id is required'
);

select throws_ok(
  $$insert into public.invoices (cleaning_job_id, client_id, invoice_status_id, invoice_template_id) values ('c3000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', null, 'c8000000-0000-0000-0000-000000000001')$$,
  '23502',
  null,
  'invoice_status_id cannot be null'
);

select throws_ok(
  $$insert into public.invoices (cleaning_job_id, client_id, invoice_template_id) values ('99999999-9999-9999-9999-999999999999', 'c1000000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-000000000001')$$,
  '23503',
  null,
  'cleaning_job_id must exist in cleaning_jobs'
);

select throws_ok(
  $$insert into public.invoices (cleaning_job_id, client_id, invoice_template_id) values ('c3000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', 'c8000000-0000-0000-0000-000000000001')$$,
  '23503',
  null,
  'client_id must exist in clients'
);

select throws_ok(
  $$insert into public.invoices (cleaning_job_id, client_id, invoice_status_id, invoice_template_id) values ('c3000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', 'c8000000-0000-0000-0000-000000000001')$$,
  '23503',
  null,
  'invoice_status_id must exist in invoice_statuses'
);

select throws_ok(
  $$insert into public.invoices (cleaning_job_id, client_id, invoice_template_id) values ('c3000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999')$$,
  '23503',
  null,
  'invoice_template_id must exist in invoice_templates'
);

select * from finish();
rollback;
```

### Step 3. Gate

```bash
pnpm db:reset && grep -c "invoices" src/types/database.types.ts
```

**Expect:** `db:reset` exits 0 with no SQL error and applies `0034_invoices.sql`; the `grep` prints a number greater than `0`.

```bash
pnpm test:db
```

**Expect:** every file reports `ok`, the summary ends with `Result: PASS`, and `invoices.test.sql` runs 18 tests. If a test fails, stop and report; do not edit the test or the migration to make it pass.

```bash
pnpm typecheck && pnpm lint
```

**Expect:** both exit 0.

```bash
git status --short
```

**Expect:** only `supabase/migrations/0034_invoices.sql`, `supabase/tests/database/invoices.test.sql`, `src/types/database.types.ts` and this plan file. Anything else: stop and report.

## Rollback

- Before commit: `git switch main && git branch -D feat/T3C-B32-Invoices-Table`, then `pnpm db:reset`.
- After merge, if a hosted DB already has `0034_invoices.sql`: add `0134_drop_invoices.sql` containing `delete from public.app_permissions where resource = 'invoices';` and `drop table public.invoices;`. Never edit or delete an applied migration. Stop and ask first if other tables already reference `invoices`.

## Conventional commits

Branch: `feat/T3C-B32-Invoices-Table` (from `main`). Stage explicit paths only. Each commit leaves the suites green. Every commit ends with:

```
Refs: T3C-B32

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `feat(db): add invoices table with role-based RLS`
   Files: `supabase/migrations/0034_invoices.sql`, `src/types/database.types.ts`
2. `test(db): cover invoices constraints and access`
   Files: `supabase/tests/database/invoices.test.sql`
3. `docs(plans): add T3C-B32 plan`
   Files: `.claude/plans/backend/T3C-B32-Invoices-Table.md`

PR title: `feat(db): add invoices table` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
