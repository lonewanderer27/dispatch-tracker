# T3C-B21 Add the properties table

> **Status: Approved and implemented** on `feat/T3C-B20-S34-B21-B22-B24-Properties-Areas-Items` (commits `f780139`, `d1154f3`).
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

Source: sprint sheet `The Tidy Team - Digital Platforms Sprint - Sprint 2_ Nov-23-27-2026'.csv`.

- T3C-B21: "As a dispatcher, I want to store each client's property address and parking instructions, so that cleaners can find and access it." Acceptance: table `properties` with columns `id`, `client_id`, `property_type_id`, `sqft`, `address_line_1`, `address_line_2`, `city`, `province_state`, `postal_code`, `country_code`, `parking_instructions`; `client_id` and `property_type_id` are required foreign keys; `address_line_1`, `city`, `province_state`, `postal_code`, `country_code` are required text; `sqft` is an optional floating number; `address_line_2` and `parking_instructions` are optional text; `country_code` is a 2-letter uppercase ISO 3166-1 code, enforced by a check constraint; one client can have many properties.

## Facts (verified 2026-11-27)

1. Branch is `main`. Migrations are numbered `NNNN_name.sql`. This plan adds `supabase/migrations/0019_properties.sql`, so migrations up to `0018` must already exist. **As built:** `0018` exists (commit `b713621`, T3C-B20). `0013` to `0017` are still missing, but the Step 0 Expect line (list ends at `0018`) matched. Plans are applied in migration order: roles is `0003`, app_permissions is `0004` and user admin is `0005` (T3C-B0), companies is `0006` (`.claude/plans/backend/T3C-B7-S8-Companies-Table.md`).
2. Required earlier migrations (plan that creates each): `0003_roles.sql` and `0004_app_permissions.sql` (T3C-B0); `0007_clients.sql` (T3C-B6); `0018_property_types.sql` (T3C-B20-S34). If any is missing, **stop and report**.
3. Table `public.properties` does not exist yet, and `src/types/database.types.ts` has no `properties` entry. That file is generated; never hand-edit it.
4. Roles come from T3C-B0 (`.claude/plans/backend/T3C-B0-Users-Table.md`): `supabase/migrations/0003_roles.sql` creates `public.roles` (Admin id `30000000-0000-0000-0000-000000000001`, User id `30000000-0000-0000-0000-000000000002`) and replaces `profiles.role` with `profiles.role_id`. `public.is_admin()` is true when the caller's profile has the Admin role id. Policies of this table do not use it; they call `(select public.has_permission('<table>', '<action>'))`, which needs `0004_app_permissions.sql` (T3C-B0 phase 2: Super Admin role id `30000000-0000-0000-0000-000000000003`, `public.app_permissions`, `public.has_permission`). If `0004_app_permissions.sql` is missing, **stop and report**. If `0003_roles.sql` is missing, **stop and report**.
5. Table pattern (`0001_init.sql`): `id uuid primary key default gen_random_uuid()`, `enable row level security`, `revoke all ... from anon, authenticated`, explicit `grant ... to authenticated`, then policies.
6. `supabase/tests/database/` holds `rls.test.sql`, `seed.test.sql`, `todo_stats.test.sql` (and `roles.test.sql` and `companies.test.sql` once T3C-B0 and T3C-B7-S8 are implemented). `rls.test.sql` already asserts that every public table has RLS enabled.

## Decisions already made (do not reopen)

- `sqft` is `double precision` ("floating number"). No range check is added.
- `country_code` is checked against the pattern `^[A-Z]{2}$` (two uppercase letters). It does **not** verify that the code is a real ISO 3166-1 code.
- `client_id` is `on delete cascade`. `property_type_id` is `no action`.
- **Access (owner rule)**: a profile with the **Admin** role can read and write this table; a profile with the **User** role can only read it. Implemented as four policies (select, insert, update, delete) that call `has_permission(<table>, <action>)`, plus the table's three rows in `app_permissions` (Admin and Super Admin read and write, User reads only), seeded in the same migration. `anon` gets nothing. There is no per-user ownership on this data, so there is no user-isolation test.
- **Columns are exactly those in the story**, in the story order. No `created_at` unless the story lists it.
- **Required text columns** are `not null` and also reject blank or whitespace-only values (`char_length(trim(col)) > 0`).
- **No UI** in this plan. Backend and seed stories only. Pages for this table are out of scope (see open question).

### Open questions (do not block)

1. Should `sqft` be required to be positive? The story gives no range.
2. Should `country_code` be checked against the real ISO 3166-1 list instead of just two uppercase letters?
3. Pages (list, create, edit) for this table are not planned. Should they be added, as was done for companies?

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
git status --short && git switch -c feat/T3C-B21-Properties-Table && pnpm db:start
```

**Gate:** `git branch --show-current && ls supabase/migrations`
**Expect:** `feat/T3C-B21-Properties-Table`, then a migration list that ends at `0018_property_types.sql` (the file just before this plan's `0019`). If `git status --short` printed anything before the switch, or the list is different, stop and report.

### Step 1. Migration (create file)

Create `supabase/migrations/0019_properties.sql` with exactly this content:

```sql
-- 0019_properties: each client's property address and parking instructions.

create table public.properties (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references public.clients (id) on delete cascade,
  property_type_id     uuid not null references public.property_types (id),
  sqft                 double precision,
  address_line_1       text not null check (char_length(trim(address_line_1)) > 0),
  address_line_2       text,
  city                 text not null check (char_length(trim(city)) > 0),
  province_state       text not null check (char_length(trim(province_state)) > 0),
  postal_code          text not null check (char_length(trim(postal_code)) > 0),
  country_code         text not null check (country_code ~ '^[A-Z]{2}$'),
  parking_instructions text
);

create index properties_client_id_idx on public.properties (client_id);
create index properties_property_type_id_idx on public.properties (property_type_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.properties enable row level security;

revoke all on public.properties from anon, authenticated;
grant select, insert, update, delete on public.properties to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy properties_select
  on public.properties for select to authenticated
  using ((select public.has_permission('properties', 'read')));

create policy properties_insert
  on public.properties for insert to authenticated
  with check ((select public.has_permission('properties', 'create')));

create policy properties_update
  on public.properties for update to authenticated
  using ((select public.has_permission('properties', 'update')))
  with check ((select public.has_permission('properties', 'update')));

create policy properties_delete
  on public.properties for delete to authenticated
  using ((select public.has_permission('properties', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'properties', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'properties', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'properties', true, true,  true,  true);
```

### Step 2. pgTAP test (create file)

Create `supabase/tests/database/properties.test.sql` with exactly this content:

```sql
-- pgTAP: properties. RLS, access, constraints.
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
insert into public.property_types (id, name) values ('c5000000-0000-0000-0000-000000000001', 'Test Property Type');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.properties'::regclass),
  'properties has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.properties$$,
  '42501',
  null,
  'anon is denied select on properties'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '1 Test St', 'Testville', 'NSW', '2000', 'AU')$$,
  'an Admin can insert into properties'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.properties) >= 1,
  'a User can read properties'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '1 Test St', 'Testville', 'NSW', '2000', 'AU')$$,
  '42501',
  null,
  'a User cannot insert into properties'
);

select lives_ok(
  $$update public.properties set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.properties$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.properties) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select is(
  (select count(*) from public.properties where sqft is null and address_line_2 is null and parking_instructions is null),
  1::bigint,
  'sqft, address_line_2 and parking_instructions are optional'
);

select lives_ok(
  $$insert into public.properties (client_id, property_type_id, sqft, address_line_1, address_line_2, city, province_state, postal_code, country_code, parking_instructions) values ('c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 1200.5, '2 Test St', 'Unit 4', 'Testville', 'NSW', '2000', 'CA', 'Visitor bay')$$,
  'one client can have many properties, with all optional fields set'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'x', 'x', 'x', 'x', 'au')$$,
  '23514',
  null,
  'lowercase country_code is rejected'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'x', 'x', 'x', 'x', 'AUS')$$,
  '23514',
  null,
  'three-letter country_code is rejected'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'x', 'x', 'x', 'x', null)$$,
  '23502',
  null,
  'country_code is required'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values (null, 'c5000000-0000-0000-0000-000000000001', 'x', 'x', 'x', 'x', 'AU')$$,
  '23502',
  null,
  'client_id is required'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('c1000000-0000-0000-0000-000000000001', null, 'x', 'x', 'x', 'x', 'AU')$$,
  '23502',
  null,
  'property_type_id is required'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('99999999-9999-9999-9999-999999999999', 'c5000000-0000-0000-0000-000000000001', 'x', 'x', 'x', 'x', 'AU')$$,
  '23503',
  null,
  'client_id must exist in clients'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('c1000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', 'x', 'x', 'x', 'x', 'AU')$$,
  '23503',
  null,
  'property_type_id must exist in property_types'
);

select throws_ok(
  $$insert into public.properties (client_id, property_type_id, address_line_1, city, province_state, postal_code, country_code) values ('c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '  ', 'x', 'x', 'x', 'AU')$$,
  '23514',
  null,
  'address_line_1 cannot be blank'
);

select * from finish();
rollback;
```

### Step 3. Gate

```bash
pnpm db:reset && grep -c "properties" src/types/database.types.ts
```

**Expect:** `db:reset` exits 0 with no SQL error and applies `0019_properties.sql`; the `grep` prints a number greater than `0`.

```bash
pnpm test:db
```

**Expect:** every file reports `ok`, the summary ends with `Result: PASS`, and `properties.test.sql` runs 18 tests. If a test fails, stop and report; do not edit the test or the migration to make it pass.

```bash
pnpm typecheck && pnpm lint
```

**Expect:** both exit 0.

```bash
git status --short
```

**Expect:** only `supabase/migrations/0019_properties.sql`, `supabase/tests/database/properties.test.sql`, `src/types/database.types.ts` and this plan file. Anything else: stop and report.

## Rollback

- Before commit: `git switch main && git branch -D feat/T3C-B21-Properties-Table`, then `pnpm db:reset`.
- After merge, if a hosted DB already has `0019_properties.sql`: add `0119_drop_properties.sql` containing `delete from public.app_permissions where resource = 'properties';` and `drop table public.properties;`. Never edit or delete an applied migration. Stop and ask first if other tables already reference `properties`.

## Conventional commits

Branch: `feat/T3C-B21-Properties-Table` (from `main`). Stage explicit paths only. Each commit leaves the suites green. Every commit ends with:

```
Refs: T3C-B21

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

As built, in order (the database types commit is shared, see T3C-B20):

1. `f780139` `feat(db): add properties table with role-based RLS`
   Files: `supabase/migrations/0019_properties.sql`
2. `d1154f3` `test(db): cover properties constraints and access`
   Files: `supabase/tests/database/properties.test.sql`
3. `docs(plans): mark T3C-B21 plan implemented`
   Files: `.claude/plans/backend/T3C-B21-Properties-Table.md`

PR title: `feat(db): add properties table` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
