# T3C-B0 Add the roles table and link profiles to it

> **Status: PENDING REVIEW.** Not approved for implementation until the owner removes this line.
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

There is no story for this in the sprint sheet (`B0` is the owner's number). It was requested directly:

- Create a `roles` table with two rows: **Admin** and **User**.
- Replace the text column `profiles.role` with `profiles.role_id`, and link every existing profile to its role row.
- Rule for every other table plan: a profile with the **Admin** role can read and write every table; a profile with the **User** role can only read. The other plans (T3C-B5 to T3C-B33) were rewritten to follow this rule, and now depend on this plan (they need `0003_roles.sql`).
- Disable anonymous sign-in.

This plan runs **first**. It takes migration number `0003`; every other plan was renumbered to start at `0004`.

## Facts (verified 2026-11-27)

1. Branch is `main`. `supabase/migrations/` holds `0001_init.sql` and `0002_todo_stats.sql` only. If anything else is there, **stop and report**.
2. `profiles` (in `0001_init.sql`) has `role text not null default 'user' check (role in ('user', 'admin'))`. Authenticated users have `grant update (display_name)` only, so they cannot change `role`; the new `role_id` is protected the same way as long as nobody grants update on it.
3. `public.is_admin()` (`0001_init.sql`) is `security definer`, `set search_path = ''`, `stable`, and tests `p.role = 'admin'`. It is executable by `authenticated` only. It is used by the policies `profiles_admin_select` and `todos_admin_all`. Its signature will not change, so those policies keep working.
4. `handle_new_user()` inserts `(id, display_name)` only, so a new profile takes the column default.
5. `supabase/seed.sql` line 38: `update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';`
6. `supabase/tests/database/rls.test.sql`: lines 46-51 test "profile role defaults to user" (`select role from public.profiles ...`, `'user'`); line 91 `$$update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,`; line 117 `update public.profiles set role = 'admin' where id = 'cccccccc-0000-0000-0000-00000000000c';`. The plan count (`select plan(15);`) does not change.
7. `supabase/tests/database/seed.test.sql` lines 14-18 select `role` from `public.profiles` and expect `'admin'`.
8. `src/providers/authProvider.ts` line 63 `.select('display_name, role')` and line 72 `role: profile?.role ?? 'user',`. `src/providers/authProvider.test.ts` line 81 mocks `{ display_name: 'Ada', role: 'admin' }` and line 83 expects `role: 'admin'`. Nothing else in `src/` or `e2e/` reads `role`.
9. `README.md` line 56 is `  migrations/0002_todo_stats.sql`; line 89 is ``- Users can update only `profiles.display_name`. `role` is column-protected and can only be changed with direct DB access.``
10. `supabase/config.jsonc` line 206 `"enable_signup": true,` and line 208 `"enable_anonymous_sign_ins": false,`. **Anonymous sign-in is already off locally.** The work here is to keep it off and prove it.
11. The local database container is named `supabase_db_dispatch-tracker` (`project_id` is `dispatch-tracker`).

## Decisions already made (do not reopen)

- **Role ids are fixed**: Admin `30000000-0000-0000-0000-000000000001`, User `30000000-0000-0000-0000-000000000002`. `is_admin()`, the `profiles.role_id` default and the tests all use them, so a renamed role cannot break access.
- **Roles are created inside the migration**, not in `seed.sql`, because existing profiles must be linked in the same migration, and production needs the two rows.
- **Backfill rule**: `role = 'admin'` becomes the Admin id; anything else becomes the User id.
- **`profiles.role_id`** is `uuid not null default <User id> references roles (id)` (default `no action`, so a role in use cannot be deleted). The old `role` column is dropped (its check constraint goes with it). New users get User through the default; `handle_new_user()` is not changed.
- **`is_admin()`** is replaced with `create or replace` (same signature, so its grants stay) and now tests `p.role_id = <Admin id>`.
- **`roles` table access** follows the owner rule: any signed-in user can read; only Admins can write.
- **Anonymous sign-in stays off.** `enable_anonymous_sign_ins` is already `false` in `supabase/config.jsonc`; this plan only verifies it (Step 6). Anonymous users still get the `authenticated` database role, so if the setting were ever turned on they could read every table. For hosted projects the setting lives in the Supabase dashboard (see open question).
- **Scope of "every table"** is `roles` plus all the dispatch tables in the other plans. `profiles` and `todos` keep their current policies (see open question).
- **The web identity** keeps a `role` field but it now holds the role name (`Admin` or `User`).
- Local stack, local data only. Nothing here touches a hosted database.

### Open questions (do not block)

1. "Every table": I applied the Admin-write / User-read rule to `roles` and the dispatch tables, not to `todos` (users keep create/edit/delete on their own todos) or `profiles` (users edit their own `display_name`; nobody changes a role from the app). Confirm that is what you want.
2. Roles can only be assigned with direct DB access, as before. Do you want an Admin screen or RPC to change a user's role? It needs care: a plain `update` grant on `role_id` would let any user promote themselves, so it must not be a column grant.
3. With the User role able to read every table, **anyone who can register can read all business data**. `enable_signup` is `true`. Should sign-up be closed (invite only) or limited to company email addresses?
4. Anonymous sign-in on SIT and production: it must be switched off in each project's Supabase dashboard (Authentication, then Sign In / Providers). It is not in the repo for hosted projects. Do you want a DB-level backstop (policies that also reject JWTs with `is_anonymous = true`)?
5. Later roles (for example Dispatcher, Finance) are not created. Only Admin and User.
6. `identity.role` changes from `admin`/`user` to `Admin`/`User`. Nothing reads it today.
7. Plan numbering: the rate plans (T3C-B23, T3C-B25) were deleted from `.claude/plans/` before this change, so migrations are numbered without them. If they come back, their migrations must be inserted and numbers after them shift.

## Out of scope

- Any other table or story; the policies of `profiles` and `todos`.
- An Admin UI for roles, Dispatcher or Finance roles, pages for `roles`.
- Hosted (SIT/production) data or dashboard changes.
- Playwright e2e specs.

## Steps

Working directory for every command: the repo root (`dispatch-tracker`).

### Step 0. Branch and baseline

```bash
git status --short && git switch -c feat/T3C-B0-Users-Table && pnpm db:start && ls supabase/migrations
```

**Gate:** `git branch --show-current`
**Expect:** `feat/T3C-B0-Users-Table`, and the `ls` shows only `0001_init.sql` and `0002_todo_stats.sql`. If `git status --short` printed anything before the switch, stop and report.

### Step 1. Back up and capture the "before" data

The migration rewrites data in `profiles`. Local data is rebuilt by `db:reset`, but back it up first in case it holds anything you want to keep.

```bash
pnpm db:reset
docker exec supabase_db_dispatch-tracker pg_dump -U postgres --data-only --table=public.profiles --table=public.todos > ~/dispatch-tracker-pre-roles.sql
docker exec supabase_db_dispatch-tracker psql -U postgres -At -c "select role, count(*) from public.profiles group by role order by role"
```

**Expect:** `db:reset` exits 0; `~/dispatch-tracker-pre-roles.sql` is not empty (`wc -c` greater than 0); the query prints exactly these two lines:

```
admin|1
user|1
```

### Step 2. Migration (create file)

Create `supabase/migrations/0003_roles.sql` with exactly this content:

```sql
-- 0003_roles: a roles table, and profiles.role (text) becomes profiles.role_id (foreign key).

create table public.roles (
  id   uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  constraint roles_name_key unique (name)
);

-- Fixed ids: is_admin(), the profiles default and the tests rely on them.
insert into public.roles (id, name) values
  ('30000000-0000-0000-0000-000000000001', 'Admin'),
  ('30000000-0000-0000-0000-000000000002', 'User');

-- profiles: add role_id, link every existing row, then drop the old text column.
alter table public.profiles
  add column role_id uuid references public.roles (id);

update public.profiles
set role_id = case role
  when 'admin' then '30000000-0000-0000-0000-000000000001'::uuid
  else '30000000-0000-0000-0000-000000000002'::uuid
end;

alter table public.profiles
  alter column role_id set default '30000000-0000-0000-0000-000000000002',
  alter column role_id set not null;

alter table public.profiles drop column role;

create index profiles_role_id_idx on public.profiles (role_id);

-- Same signature as before, so the grants and every policy that calls it keep working.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role_id = '30000000-0000-0000-0000-000000000001'
  );
$$;

-- roles: RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.roles enable row level security;

revoke all on public.roles from anon, authenticated;
grant select, insert, update, delete on public.roles to authenticated;

-- Everyone signed in can read.
create policy roles_select_authenticated
  on public.roles for select to authenticated
  using (true);

-- Only admins can change.
create policy roles_admin_all
  on public.roles for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
```

### Step 3. Apply it to the existing data and check the backfill

This applies only the new migration to the database from Step 1 (no reset), so the existing profiles are really converted.

```bash
pnpm exec supabase migration up --local
docker exec supabase_db_dispatch-tracker psql -U postgres -At -c "select r.name, count(*) from public.profiles p join public.roles r on r.id = p.role_id group by r.name order by r.name"
docker exec supabase_db_dispatch-tracker psql -U postgres -At -c "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles' order by column_name"
```

**Expect:** `migration up` applies `0003_roles.sql` with no error. The first query prints exactly:

```
Admin|1
User|1
```

The second prints exactly (no `role` column):

```
created_at
display_name
id
role_id
```

### Step 4. Update the seed, the existing tests and the web code

**4a. `supabase/seed.sql`.** Find (line 38):

```sql
update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
```

Replace with:

```sql
update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = '11111111-1111-1111-1111-111111111111';
```

**4b. `supabase/tests/database/rls.test.sql`.** Three edits.

Edit A. Find:

```sql
  (select role from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  'user',
  'new profiles default to role user'
```

Replace with:

```sql
  (select role_id from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  '30000000-0000-0000-0000-000000000002'::uuid,
  'new profiles default to the User role'
```

Edit B. Find:

```sql
  $$update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
```

Replace with:

```sql
  $$update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
```

Edit C. Find:

```sql
update public.profiles set role = 'admin' where id = 'cccccccc-0000-0000-0000-00000000000c';
```

Replace with:

```sql
update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'cccccccc-0000-0000-0000-00000000000c';
```

**4c. `supabase/tests/database/seed.test.sql`.** Find:

```sql
  (select role from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'admin',
  'seeded admin has role admin'
```

Replace with:

```sql
  (select r.name from public.profiles p join public.roles r on r.id = p.role_id
     where p.id = '11111111-1111-1111-1111-111111111111'),
  'Admin',
  'seeded admin has the Admin role'
```

**4d. `src/providers/authProvider.ts`.** Two edits.

Find: `      .select('display_name, role')`
Replace with: `      .select('display_name, roles(name)')`

Find: `      role: profile?.role ?? 'user',`
Replace with: `      role: profile?.roles?.name ?? 'User',`

**4e. `src/providers/authProvider.test.ts`.** Two edits.

Find: `    maybeSingle.mockResolvedValue({ data: { display_name: 'Ada', role: 'admin' }, error: null })`
Replace with:

```ts
maybeSingle.mockResolvedValue({
  data: { display_name: 'Ada', roles: { name: 'Admin' } },
  error: null,
})
```

Find: `    expect(id).toEqual({ id: 'u1', email: 'u@b.co', name: 'Ada', role: 'admin' })`
Replace with: `    expect(id).toEqual({ id: 'u1', email: 'u@b.co', name: 'Ada', role: 'Admin' })`

### Step 5. New pgTAP test (create file)

Create `supabase/tests/database/roles.test.sql` with exactly this content:

```sql
-- pgTAP: roles table, profiles.role_id, is_admin().
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Fixed test identities. The whole file runs in one transaction and rolls back.
-- Alice is a normal user. Carol is promoted to Admin below.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'carol@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

update public.profiles set role_id = '30000000-0000-0000-0000-000000000001'
  where id = 'cccccccc-0000-0000-0000-00000000000c';

-- 1-2: RLS is on; anon is denied.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.roles'::regclass),
  'roles has RLS enabled'
);
set local role anon;
select throws_ok(
  'select count(*) from public.roles',
  '42501',
  null,
  'anon is denied select on roles'
);
reset role;

-- 3-4: exactly the two roles, with their fixed ids.
select set_eq(
  $$select name from public.roles$$,
  $$values ('Admin'), ('User')$$,
  'the migration creates exactly the Admin and User roles'
);
select is(
  (select count(*) from public.roles where id in
    ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')),
  2::bigint,
  'the roles have their fixed ids'
);

-- 5-6: profiles.role is gone; a new profile defaults to the User role.
select is(
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'),
  0::bigint,
  'profiles.role no longer exists'
);
select is(
  (select role_id from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  '30000000-0000-0000-0000-000000000002'::uuid,
  'a new profile defaults to the User role'
);

-- 7-12: constraints (as owner).
select throws_ok(
  $$update public.profiles set role_id = null where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '23502',
  null,
  'profiles.role_id is required'
);
select throws_ok(
  $$update public.profiles set role_id = '99999999-9999-9999-9999-999999999999' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '23503',
  null,
  'profiles.role_id must exist in roles'
);
select throws_ok(
  $$delete from public.roles where id = '30000000-0000-0000-0000-000000000002'$$,
  '23503',
  null,
  'a role that is in use cannot be deleted'
);
select throws_ok(
  $$insert into public.roles (name) values ('Admin')$$,
  '23505',
  null,
  'role name must be unique'
);
select throws_ok(
  $$insert into public.roles (name) values (null)$$,
  '23502',
  null,
  'role name is required'
);
select throws_ok(
  $$insert into public.roles (name) values ('   ')$$,
  '23514',
  null,
  'role name cannot be blank'
);

-- Act as Carol (Admin role).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);

-- 13-14: an Admin is recognised and can write.
select is(public.is_admin(), true, 'is_admin() is true for a profile with the Admin role');
select lives_ok(
  $$insert into public.roles (name) values ('Test Role')$$,
  'an Admin can insert a role'
);
reset role;

-- Act as Alice (User role).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);

-- 15-19: a User can read but not write.
select is(public.is_admin(), false, 'is_admin() is false for a profile with the User role');
select ok(
  (select count(*) from public.roles) >= 2,
  'a User can read roles'
);
select throws_ok(
  $$insert into public.roles (name) values ('Sneaky Role')$$,
  '42501',
  null,
  'a User cannot insert a role'
);
select lives_ok(
  $$update public.roles set name = 'Hijacked'$$,
  'a User update is silently filtered by RLS'
);
select lives_ok(
  $$delete from public.roles where name = 'Test Role'$$,
  'a User delete is silently filtered by RLS'
);

-- 20: a User cannot promote themselves (no update grant on role_id).
select throws_ok(
  $$update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '42501',
  null,
  'a User cannot change their own role'
);
reset role;

-- 21-22: nothing was changed by the User attempts.
select ok(
  (select count(*) from public.roles where name in ('Admin', 'User', 'Test Role')) = 3,
  'roles are unchanged after the User update and delete attempts'
);
select is(
  (select role_id from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  '30000000-0000-0000-0000-000000000002'::uuid,
  'Alice is still a User'
);

select * from finish();
rollback;
```

### Step 6. Confirm anonymous sign-in is off

```bash
grep -n '"enable_anonymous_sign_ins"' supabase/config.jsonc
```

**Expect:** exactly `208:    "enable_anonymous_sign_ins": false,`. If it says `true`, change it to `false` (the only edit allowed to `config.jsonc`), run `pnpm exec supabase stop && pnpm db:start`, and say so in the report. Do not change anything else in that file.

### Step 7. README (edit `README.md`)

Edit A. Find: `  migrations/0002_todo_stats.sql`
Replace with:

```
  migrations/0002_todo_stats.sql
  migrations/0003_roles.sql      roles (Admin, User), profiles.role_id
```

Edit B. Find: ``- Users can update only `profiles.display_name`. `role` is column-protected and can only be changed with direct DB access.``
Replace with: ``- Users can update only `profiles.display_name`. `role_id` (Admin or User, from the `roles` table) is column-protected and can only be changed with direct DB access. Admins can read and write the dispatch tables; Users can only read them. Anonymous sign-in is off.``

### Step 8. Gates

```bash
pnpm db:reset && grep -c "role_id" src/types/database.types.ts
```

**Expect:** exits 0; the `grep` prints a number greater than `0`.

```bash
pnpm test:db
```

**Expect:** every file reports `ok` and the summary ends with `Result: PASS`; `roles.test.sql` runs 22 tests, `rls.test.sql` 15, `seed.test.sql` 3, `todo_stats.test.sql` 6.

```bash
pnpm lint && pnpm typecheck && pnpm test
```

**Expect:** all exit 0. A type error on `profile?.roles?.name` means the types were not regenerated: run `pnpm db:types` and repeat; if it persists, stop and report.

```bash
pnpm exec prettier --check README.md src/providers/authProvider.ts src/providers/authProvider.test.ts .claude/plans/backend/T3C-B0-Users-Table.md
```

**Expect:** `All matched files use Prettier code style!` If a file is listed, run `pnpm exec prettier --write` on **only that file**, then repeat.

```bash
pnpm test:all
```

**Expect:** lint, typecheck, vitest, pgTAP, Deno and Playwright all pass. Then `git status --short` lists only: this plan, `supabase/migrations/0003_roles.sql`, `supabase/seed.sql`, `supabase/tests/database/roles.test.sql`, `supabase/tests/database/rls.test.sql`, `supabase/tests/database/seed.test.sql`, `src/types/database.types.ts`, `src/providers/authProvider.ts`, `src/providers/authProvider.test.ts`, `README.md`. Anything else: stop and report.

## Rollback

- Before commit: `git switch main && git branch -D feat/T3C-B0-Users-Table`, then `pnpm db:reset`. To restore the pre-change local data, load `~/dispatch-tracker-pre-roles.sql` after the reset (the seed already recreates the same rows, so it is usually unnecessary).
- After merge, if a hosted DB already has `0003`: add `0027_revert_roles.sql` (use the next free number) that adds `profiles.role text not null default 'user' check (role in ('user', 'admin'))`, sets it from `role_id` (`Admin` id becomes `'admin'`, anything else `'user'`), restores the old `is_admin()` body (`p.role = 'admin'`), then drops `role_id` and `public.roles`. Stop and ask first if other tables already use `is_admin()` for their policies; they keep working because the function name does not change.

## Conventional commits

Branch: `feat/T3C-B0-Users-Table` (from `main`). Stage explicit paths only. Every commit ends with:

```
Refs: T3C-B0

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `feat(db): link profiles to a roles table`
   Files: `supabase/migrations/0003_roles.sql`, `supabase/seed.sql`, `supabase/tests/database/rls.test.sql`, `supabase/tests/database/seed.test.sql`, `src/types/database.types.ts`, `src/providers/authProvider.ts`, `src/providers/authProvider.test.ts`
   Body: the column rename breaks the seed, two existing tests and the identity lookup, so they move together to keep every commit green.
2. `test(db): cover roles, role_id and is_admin`
   Files: `supabase/tests/database/roles.test.sql`
3. `docs: document roles and admin-write access`
   Files: `README.md`
4. `docs(plans): add T3C-B0 plan`
   Files: `.claude/plans/backend/T3C-B0-Users-Table.md`

PR title: `feat(db): add roles and link profiles to them` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
