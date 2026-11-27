# T3C-B5 Add the contacts table

> **Status: PENDING REVIEW.** Not approved for implementation until the owner removes this line.
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

Source: sprint sheet `The Tidy Team - Digital Platforms Sprint - Sprint 2_ Nov-23-27-2026'.csv`.

- T3C-B5: "As a dispatcher, I want each client to have one or more contacts with a name and phone number, so that I can reach the right person about a booking." Acceptance: table `contacts` with columns `id`, `client_id`, `first_name`, `last_name`, `contact_no`; `client_id` is a required foreign key to `clients.id`; `first_name`, `last_name`, `contact_no` are required text; one client can have many contacts; `contact_no` is stored as text exactly as entered (+, spaces and leading zeros are kept).

## Facts (verified 2026-11-27)

1. Branch is `main`. Migrations are numbered `NNNN_name.sql`. This plan adds `supabase/migrations/0008_contacts.sql`, so migrations up to `0007` must already exist. Plans are applied in migration order: roles is `0003`, app_permissions is `0004` and user admin is `0005` (T3C-B0), companies is `0006` (`.claude/plans/backend/T3C-B7-S8-Companies-Table.md`).
2. Required earlier migrations (plan that creates each): `0003_roles.sql` and `0004_app_permissions.sql` (T3C-B0); `0007_clients.sql` (T3C-B6). If any is missing, **stop and report**.
3. Table `public.contacts` does not exist yet, and `src/types/database.types.ts` has no `contacts` entry. That file is generated; never hand-edit it.
4. Roles come from T3C-B0 (`.claude/plans/backend/T3C-B0-Users-Table.md`): `supabase/migrations/0003_roles.sql` creates `public.roles` (Admin id `30000000-0000-0000-0000-000000000001`, User id `30000000-0000-0000-0000-000000000002`) and replaces `profiles.role` with `profiles.role_id`. `public.is_admin()` is true when the caller's profile has the Admin role id. Policies of this table do not use it; they call `(select public.has_permission('<table>', '<action>'))`, which needs `0004_app_permissions.sql` (T3C-B0 phase 2: Super Admin role id `30000000-0000-0000-0000-000000000003`, `public.app_permissions`, `public.has_permission`). If `0004_app_permissions.sql` is missing, **stop and report**. If `0003_roles.sql` is missing, **stop and report**.
5. Table pattern (`0001_init.sql`): `id uuid primary key default gen_random_uuid()`, `enable row level security`, `revoke all ... from anon, authenticated`, explicit `grant ... to authenticated`, then policies.
6. `supabase/tests/database/` holds `rls.test.sql`, `seed.test.sql`, `todo_stats.test.sql` (and `roles.test.sql` and `companies.test.sql` once T3C-B0 and T3C-B7-S8 are implemented). `rls.test.sql` already asserts that every public table has RLS enabled.

## Decisions already made (do not reopen)

- `client_id` is `on delete cascade`: deleting a client deletes its contacts.
- `contact_no` is plain `text` with no format check and no trimming or normalising, so `+`, spaces and leading zeros are kept.
- **Access (owner rule)**: a profile with the **Admin** role can read and write this table; a profile with the **User** role can only read it. Implemented as four policies (select, insert, update, delete) that call `has_permission(<table>, <action>)`, plus the table's three rows in `app_permissions` (Admin and Super Admin read and write, User reads only), seeded in the same migration. `anon` gets nothing. There is no per-user ownership on this data, so there is no user-isolation test.
- **Columns are exactly those in the story**, in the story order. No `created_at` unless the story lists it.
- **Required text columns** are `not null` and also reject blank or whitespace-only values (`char_length(trim(col)) > 0`).
- **No UI** in this plan. Backend and seed stories only. Pages for this table are out of scope (see open question).

### Open questions (do not block)

1. Should `contact_no` get any format validation (for example digits, spaces and a leading `+` only)? The story says store exactly as entered, so none is added.
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
git status --short && git switch -c feat/T3C-B5-Contacts-Table && pnpm db:start
```

**Gate:** `git branch --show-current && ls supabase/migrations`
**Expect:** `feat/T3C-B5-Contacts-Table`, then a migration list that ends at `0007_clients.sql` (the file just before this plan's `0008`). If `git status --short` printed anything before the switch, or the list is different, stop and report.

### Step 1. Migration (create file)

Create `supabase/migrations/0008_contacts.sql` with exactly this content:

```sql
-- 0008_contacts: contacts (name and phone number) for each client.

create table public.contacts (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) > 0),
  last_name  text not null check (char_length(trim(last_name)) > 0),
  contact_no text not null check (char_length(trim(contact_no)) > 0)
);

create index contacts_client_id_idx on public.contacts (client_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.contacts enable row level security;

revoke all on public.contacts from anon, authenticated;
grant select, insert, update, delete on public.contacts to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy contacts_select
  on public.contacts for select to authenticated
  using ((select public.has_permission('contacts', 'read')));

create policy contacts_insert
  on public.contacts for insert to authenticated
  with check ((select public.has_permission('contacts', 'create')));

create policy contacts_update
  on public.contacts for update to authenticated
  using ((select public.has_permission('contacts', 'update')))
  with check ((select public.has_permission('contacts', 'update')));

create policy contacts_delete
  on public.contacts for delete to authenticated
  using ((select public.has_permission('contacts', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'contacts', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'contacts', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'contacts', true, true,  true,  true);
```

### Step 2. pgTAP test (create file)

Create `supabase/tests/database/contacts.test.sql` with exactly this content:

```sql
-- pgTAP: contacts. RLS, access, constraints.
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

select ok(
  (select relrowsecurity from pg_class where oid = 'public.contacts'::regclass),
  'contacts has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.contacts$$,
  '42501',
  null,
  'anon is denied select on contacts'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values ('c1000000-0000-0000-0000-000000000001', 'Alice', 'Contact', '+61 0412 345 678')$$,
  'an Admin can insert into contacts'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.contacts) >= 1,
  'a User can read contacts'
);

select throws_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values ('c1000000-0000-0000-0000-000000000001', 'Alice', 'Contact', '+61 0412 345 678')$$,
  '42501',
  null,
  'a User cannot insert into contacts'
);

select lives_ok(
  $$update public.contacts set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.contacts$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.contacts) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select is(
  (select contact_no from public.contacts where first_name = 'Alice'),
  '+61 0412 345 678',
  'contact_no is stored exactly as entered'
);

select lives_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values ('c1000000-0000-0000-0000-000000000001', 'Zero', 'Lead', '0412345678')$$,
  'a leading zero is accepted'
);

select is(
  (select contact_no from public.contacts where first_name = 'Zero'),
  '0412345678',
  'a leading zero is kept'
);

select throws_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values (null, 'A', 'B', '1')$$,
  '23502',
  null,
  'client_id is required'
);

select throws_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values ('99999999-9999-9999-9999-999999999999', 'A', 'B', '1')$$,
  '23503',
  null,
  'client_id must exist in clients'
);

select throws_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values ('c1000000-0000-0000-0000-000000000001', null, 'B', '1')$$,
  '23502',
  null,
  'first_name is required'
);

select throws_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values ('c1000000-0000-0000-0000-000000000001', 'A', null, '1')$$,
  '23502',
  null,
  'last_name is required'
);

select throws_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values ('c1000000-0000-0000-0000-000000000001', 'A', 'B', null)$$,
  '23502',
  null,
  'contact_no is required'
);

select throws_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values ('c1000000-0000-0000-0000-000000000001', '  ', 'B', '1')$$,
  '23514',
  null,
  'first_name cannot be blank'
);

delete from public.clients where id = 'c1000000-0000-0000-0000-000000000001';

select is(
  (select count(*) from public.contacts),
  0::bigint,
  'deleting a client deletes its contacts'
);

select * from finish();
rollback;
```

### Step 3. Gate

```bash
pnpm db:reset && grep -c "contacts" src/types/database.types.ts
```

**Expect:** `db:reset` exits 0 with no SQL error and applies `0008_contacts.sql`; the `grep` prints a number greater than `0`.

```bash
pnpm test:db
```

**Expect:** every file reports `ok`, the summary ends with `Result: PASS`, and `contacts.test.sql` runs 18 tests. If a test fails, stop and report; do not edit the test or the migration to make it pass.

```bash
pnpm typecheck && pnpm lint
```

**Expect:** both exit 0.

```bash
git status --short
```

**Expect:** only `supabase/migrations/0008_contacts.sql`, `supabase/tests/database/contacts.test.sql`, `src/types/database.types.ts` and this plan file. Anything else: stop and report.

## Rollback

- Before commit: `git switch main && git branch -D feat/T3C-B5-Contacts-Table`, then `pnpm db:reset`.
- After merge, if a hosted DB already has `0008_contacts.sql`: add `0108_drop_contacts.sql` containing `delete from public.app_permissions where resource = 'contacts';` and `drop table public.contacts;`. Never edit or delete an applied migration. Stop and ask first if other tables already reference `contacts`.

## Conventional commits

Branch: `feat/T3C-B5-Contacts-Table` (from `main`). Stage explicit paths only. Each commit leaves the suites green. Every commit ends with:

```
Refs: T3C-B5

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `feat(db): add contacts table with role-based RLS`
   Files: `supabase/migrations/0008_contacts.sql`, `src/types/database.types.ts`
2. `test(db): cover contacts constraints and access`
   Files: `supabase/tests/database/contacts.test.sql`
3. `docs(plans): add T3C-B5 plan`
   Files: `.claude/plans/T3C-B5-Contacts-Table.md`

PR title: `feat(db): add contacts table` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
