# T3C-B0 Add the roles table, link profiles to it, and add role-based access

> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

There is no story for this in the sprint sheet (`B0` is the owner's number). It was requested directly:

- Create a `roles` table with two rows: **Admin** and **User**.
- Replace the text column `profiles.role` with `profiles.role_id`, and link every existing profile to its role row.
- Rule for every other table plan: a profile with the **Admin** role can read and write every table; a profile with the **User** role can only read. The other plans (T3C-B5 to T3C-B33) were rewritten to follow this rule, and now depend on this plan (they need `0003_roles.sql` and, since Phase 2, `0004_app_permissions.sql`).
- Disable anonymous sign-in.

This plan runs **first**. Phase 1 takes migration number `0003`; every other plan was renumbered to start at `0004`.

**Phase 2 (added later, requested directly):** role-based access.

- Add a third role, **Super Admin**.
- Create a table `app_permissions` with the columns `resource` (the table name), `read`, `create`, `update`, `delete` (booleans), and seed it with what the Admin and User roles can do today (with `roles` changed to Super Admin only).
- **Admin can modify anything except `app_permissions` and `roles`. Only Super Admin can modify `app_permissions` and `roles`.**
- Phase 1 is already committed on this branch (commits `405712f`, `b3394a5`, `460633c`, `09ae121`). Phase 2 adds new commits on the same branch and takes migration number `0004`. **This shifts every other plan (T3C-B5 to T3C-B33) up by one: they now start at `0005`.** The other plans were already renumbered and rewritten in the same change (their migrations and rollback hints use the new numbers, and their policies call `has_permission`).
- Phase 2 also seeds a local Super Admin user (`superadmin@example.com`).

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

## Phase 2 facts (verified 2026-11-27 against the working tree)

Phase 2 builds on Phase 1 being committed. Step 9 re-checks this.

12. `supabase/migrations/` holds `0001_init.sql`, `0002_todo_stats.sql`, `0003_roles.sql`.
13. `0003_roles.sql` creates the policies `roles_select_authenticated` (select, `using (true)`) and `roles_admin_all` (all, `is_admin()`) on `public.roles`. The 22 other plans (T3C-B5 to T3C-B33) have been rewritten so that each table's policies call `has_permission` and its migration seeds its own `app_permissions` rows. `authenticated` has `select, insert, update, delete` on `roles`; `anon` has nothing.
14. `public.is_admin()` (replaced in `0003_roles.sql`) tests `p.role_id = '30000000-0000-0000-0000-000000000001'` (Admin only). It is used by `profiles_admin_select` and `todos_admin_all` (`0001_init.sql`). After this phase the dispatch-table plans (T3C-B5 to T3C-B33) no longer call it; they call `has_permission`.
15. Existing access, which the seed reproduces (except `roles`, which Phase 2 deliberately changes to Super Admin write):
    - `roles`: Admin read and write; User read (Phase 1). **Phase 2 changes this: only Super Admin writes.**
    - `profiles`: everyone reads their own row, Admin reads all (`profiles_select_own`, `profiles_admin_select`); everyone updates only their own `display_name` (`profiles_update_own` plus the column grant); nobody inserts or deletes through the API.
    - `todos`: Users create, read, update and delete their own todos; Admin can do all four on every todo (`todos_admin_all`).
16. `supabase/tests/database/roles.test.sql` lines 36-40: `select set_eq(` with `$$values ('Admin'), ('User')$$,` and the message `'the migration creates exactly the Admin and User roles'`. This test breaks when Super Admin is added, so Step 12 edits it. Its plan count (`select plan(22);`) does not change.
17. `supabase/seed.sql` inserts two `auth.users` rows (ids `1111…` admin and `2222…` user), two matching `auth.identities` rows, then promotes the admin with `update public.profiles set role_id = ... where id = '11111111-1111-1111-1111-111111111111';`. `supabase/tests/database/seed.test.sql` has `select plan(3);`.
18. `README.md` line 59 is `  migrations/0003_roles.sql      roles (Admin, User), profiles.role_id`; line 92 is the bullet that ends with `Anonymous sign-in is off.`
19. Postgres reserves `create`; the `app_permissions` columns `read`, `create`, `update` and `delete` must be double-quoted in SQL (`"create"`).

## Phase 2 decisions already made (do not reopen)

- **Super Admin id** is `30000000-0000-0000-0000-000000000003` (fixed, like the other two).
- **`app_permissions` has a `role_id` column** in addition to the five columns you listed. Without it the table cannot say what each role may do, so it could not "map the permissions of the Admin and User roles". The primary key is `(role_id, resource)`; `role_id` references `roles (id)` with `on delete cascade`.
- **`resource` is plain text**, equal to the table name (`roles`, `profiles`, `todos`, `app_permissions`). It is not a foreign key, so it can name tables from later plans. Each action column is `boolean not null default false`.
- **The matrix is enforced** by a new function `public.has_permission(resource, action)`. The policies of `roles`, `app_permissions` and every dispatch table (T3C-B5 to T3C-B33) call it. The rows for `profiles` and `todos` document today's behaviour; their policies are **not** changed (out of scope), so those two rows are informational.
- **Every new table adds its own rows** to `app_permissions` in its own migration: Admin and Super Admin `t,t,t,t`, User `t,f,f,f`. A pgTAP test (`rbac.test.sql`) fails if a public table has no row for a role.
- **Seeded matrix** (read, create, update, delete). `profiles` update means "own `display_name` only" and `todos` for User means "own rows only":
  - Admin: `roles` `t,f,f,f`; `profiles` `t,f,t,f`; `todos` `t,t,t,t`; `app_permissions` `t,f,f,f`.
  - User: `roles` `t,f,f,f`; `profiles` `t,f,t,f`; `todos` `t,t,t,t`; `app_permissions` `t,f,f,f`.
  - Super Admin: `roles` `t,t,t,t`; `profiles` `t,f,t,f`; `todos` `t,t,t,t`; `app_permissions` `t,t,t,t`.
- **Reading `app_permissions` is allowed for every role** (so a future screen can show it). Only Super Admin can insert, update or delete.
- **Super Admin counts as an Admin for `profiles` and `todos`.** `is_admin()` is replaced again so it is true for Admin and Super Admin, so `profiles_admin_select` and `todos_admin_all` also cover Super Admin. The result: Admin can modify every dispatch table but not `app_permissions` or `roles`; Super Admin can modify everything.
- **`roles` policies are rebuilt** as four policies (select, insert, update, delete) that each call `has_permission('roles', <action>)`, replacing `roles_select_authenticated` and `roles_admin_all`. Behaviour for User stays the same as Phase 1. **Admin loses write access to `roles`** (Phase 1 gave it); only Super Admin writes `roles`.
- **`has_permission` is `security definer`, `stable`, `set search_path = ''`**, executable by `authenticated` only (same pattern as `is_admin()`). Unknown actions return `false`. A signed-in user with no matching row gets `false` (deny by default).
- **Roles are still assigned only with direct DB access.** Nothing here lets a user change `role_id`.
- **A local Super Admin is seeded** in `seed.sql`: id `33333333-3333-3333-3333-333333333333`, `superadmin@example.com` / `superadmin-password-123`, display name `Local Super Admin`. `seed.test.sql` gets one more test (plan 3 becomes 4).
- Local stack, local data only.

### Phase 2 open question (does not block)

8. **Lock-out.** A Super Admin can remove their own `app_permissions` rights, and then only direct DB access can restore them. Accepted for now; a guard can be added later if wanted.

## Out of scope

- Any other table or story; the policies of `profiles` and `todos` (including moving them onto `has_permission`). The other plans were updated in the same change as this one, but running them is out of scope here.
- An Admin or Super Admin UI for roles or permissions, Dispatcher or Finance roles, pages for `roles` or `app_permissions`.
- A way to change a user's role from the app.
- Hosted (SIT/production) data or dashboard changes.
- Playwright e2e specs.

## Phase 1 steps

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
Replace with: `      role: profile?.roles.name ?? 'User',`

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

**Expect:** all exit 0. A type error on `profile?.roles.name` means the types were not regenerated: run `pnpm db:types` and repeat; if it persists, stop and report.

```bash
pnpm exec prettier --check README.md src/providers/authProvider.ts src/providers/authProvider.test.ts .claude/plans/backend/T3C-B0-Users-Table.md
```

**Expect:** `All matched files use Prettier code style!` If a file is listed, run `pnpm exec prettier --write` on **only that file**, then repeat.

```bash
pnpm test:all
```

**Expect:** lint, typecheck, vitest, pgTAP, Deno and Playwright all pass. Then `git status --short` lists only: this plan, `supabase/migrations/0003_roles.sql`, `supabase/seed.sql`, `supabase/tests/database/roles.test.sql`, `supabase/tests/database/rls.test.sql`, `supabase/tests/database/seed.test.sql`, `src/types/database.types.ts`, `src/providers/authProvider.ts`, `src/providers/authProvider.test.ts`, `README.md`. Anything else: stop and report.

## Phase 2 steps

Run these only after Phase 1 is done and green. Working directory: the repo root.

### Step 9. Baseline

```bash
git branch --show-current && git status --short && ls supabase/migrations && pnpm db:reset && pnpm test:db
```

**Expect:** branch `feat/T3C-B0-Users-Table`; `git status --short` lists only the plan files under `.claude/plans/backend/` (the T3C-B0 plan and the other table plans, edited before Phase 2 and committed in Phase 2 commits 10 and 11), with no other changes; the `ls` shows exactly `0001_init.sql`, `0002_todo_stats.sql`, `0003_roles.sql`; `db:reset` exits 0; `pnpm test:db` ends with `Result: PASS`. Anything else: stop and report.

### Step 10. Migration (create file)

Create `supabase/migrations/0004_app_permissions.sql` with exactly this content:

```sql
-- 0004_app_permissions: role-based access.
-- Adds the Super Admin role and a permission matrix (role x table x read/create/update/delete).
-- The policies of roles and app_permissions read the matrix through has_permission().

insert into public.roles (id, name) values
  ('30000000-0000-0000-0000-000000000003', 'Super Admin');

create table public.app_permissions (
  role_id  uuid    not null references public.roles (id) on delete cascade,
  resource text    not null check (char_length(trim(resource)) > 0),
  "read"   boolean not null default false,
  "create" boolean not null default false,
  "update" boolean not null default false,
  "delete" boolean not null default false,
  primary key (role_id, resource)
);

-- Seed: today's access. Admin 000...001, User 000...002, Super Admin 000...003.
-- profiles and todos rows describe current behaviour (their policies are unchanged).
-- roles: only Super Admin writes (Phase 1 let Admin write it; this migration removes that).
-- Every later table migration inserts its own rows.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'roles',           true, false, false, false),
  ('30000000-0000-0000-0000-000000000001', 'profiles',        true, false, true,  false),
  ('30000000-0000-0000-0000-000000000001', 'todos',           true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000001', 'app_permissions', true, false, false, false),
  ('30000000-0000-0000-0000-000000000002', 'roles',           true, false, false, false),
  ('30000000-0000-0000-0000-000000000002', 'profiles',        true, false, true,  false),
  ('30000000-0000-0000-0000-000000000002', 'todos',           true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'app_permissions', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'roles',           true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000003', 'profiles',        true, false, true,  false),
  ('30000000-0000-0000-0000-000000000003', 'todos',           true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000003', 'app_permissions', true, true,  true,  true);

-- Same signature as before. Super Admin is an Admin for every policy that calls is_admin().
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
      and p.role_id in (
        '30000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000003'
      )
  );
$$;

-- Does the signed-in user's role allow this action on this table? Deny by default.
create function public.has_permission(p_resource text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(bool_or(
    case p_action
      when 'read'   then ap."read"
      when 'create' then ap."create"
      when 'update' then ap."update"
      when 'delete' then ap."delete"
      else false
    end
  ), false)
  from public.profiles p
  join public.app_permissions ap on ap.role_id = p.role_id
  where p.id = (select auth.uid())
    and ap.resource = p_resource;
$$;

revoke all on function public.has_permission(text, text) from public, anon;
grant execute on function public.has_permission(text, text) to authenticated;

-- roles: replace the two Phase 1 policies with one policy per action (only Super Admin writes).
drop policy roles_select_authenticated on public.roles;
drop policy roles_admin_all on public.roles;

create policy roles_select
  on public.roles for select to authenticated
  using ((select public.has_permission('roles', 'read')));

create policy roles_insert
  on public.roles for insert to authenticated
  with check ((select public.has_permission('roles', 'create')));

create policy roles_update
  on public.roles for update to authenticated
  using ((select public.has_permission('roles', 'update')))
  with check ((select public.has_permission('roles', 'update')));

create policy roles_delete
  on public.roles for delete to authenticated
  using ((select public.has_permission('roles', 'delete')));

-- app_permissions: RLS on, deny by default. Everyone signed in can read; only Super Admin can write.
alter table public.app_permissions enable row level security;

revoke all on public.app_permissions from anon, authenticated;
grant select, insert, update, delete on public.app_permissions to authenticated;

create policy app_permissions_select
  on public.app_permissions for select to authenticated
  using ((select public.has_permission('app_permissions', 'read')));

create policy app_permissions_insert
  on public.app_permissions for insert to authenticated
  with check ((select public.has_permission('app_permissions', 'create')));

create policy app_permissions_update
  on public.app_permissions for update to authenticated
  using ((select public.has_permission('app_permissions', 'update')))
  with check ((select public.has_permission('app_permissions', 'update')));

create policy app_permissions_delete
  on public.app_permissions for delete to authenticated
  using ((select public.has_permission('app_permissions', 'delete')));
```

### Step 11. Apply it and check the seed

This applies only the new migration to the database from Step 9 (no reset).

```bash
pnpm exec supabase migration up --local
docker exec supabase_db_dispatch-tracker psql -U postgres -At -c "select name from public.roles order by name collate \"C\""
docker exec supabase_db_dispatch-tracker psql -U postgres -At -c "select r.name, a.resource, concat_ws(',', a.\"read\", a.\"create\", a.\"update\", a.\"delete\") from public.app_permissions a join public.roles r on r.id = a.role_id order by r.name collate \"C\", a.resource collate \"C\""
```

**Expect:** `migration up` applies `0004_app_permissions.sql` with no error. The first query prints exactly:

```
Admin
Super Admin
User
```

The second prints exactly these 12 lines. PostgreSQL prints each boolean as `t` or `f`, so the four flags read `t,f,f,f` (read, create, update, delete):

```
Admin|app_permissions|t,f,f,f
Admin|profiles|t,f,t,f
Admin|roles|t,f,f,f
Admin|todos|t,t,t,t
Super Admin|app_permissions|t,t,t,t
Super Admin|profiles|t,f,t,f
Super Admin|roles|t,t,t,t
Super Admin|todos|t,t,t,t
User|app_permissions|t,f,f,f
User|profiles|t,f,t,f
User|roles|t,f,f,f
User|todos|t,t,t,t
```

### Step 12. Update the Phase 1 roles test

Only a Super Admin can write `roles` now, so Carol in `roles.test.sql` becomes a Super Admin (the Admin cases move to `rbac.test.sql`). Edit `supabase/tests/database/roles.test.sql`; the plan count stays `22`. Seven find/replace pairs:

Edit A. Find:

```sql
  $$values ('Admin'), ('User')$$,
  'the migration creates exactly the Admin and User roles'
```

Replace with:

```sql
  $$values ('Admin'), ('User'), ('Super Admin')$$,
  'the migrations create exactly the Admin, User and Super Admin roles'
```

Edit B. Find: `-- Alice is a normal user. Carol is promoted to Admin below.`
Replace with: `-- Alice is a normal user. Carol is promoted to Super Admin below (only a Super Admin writes roles).`

Edit C. Find:

```sql
update public.profiles set role_id = '30000000-0000-0000-0000-000000000001'
  where id = 'cccccccc-0000-0000-0000-00000000000c';
```

Replace with:

```sql
update public.profiles set role_id = '30000000-0000-0000-0000-000000000003'
  where id = 'cccccccc-0000-0000-0000-00000000000c';
```

Edit D. Find: `-- Act as Carol (Admin role).`
Replace with: `-- Act as Carol (Super Admin role).`

Edit E. Find: `-- 13-14: an Admin is recognised and can write.`
Replace with: `-- 13-14: a Super Admin is recognised and can write.`

Edit F. Find: `select is(public.is_admin(), true, 'is_admin() is true for a profile with the Admin role');`
Replace with: `select is(public.is_admin(), true, 'is_admin() is true for a profile with the Super Admin role');`

Edit G. Find: `  'an Admin can insert a role'`
Replace with: `  'a Super Admin can insert a role'`

### Step 13. New pgTAP test (create file)

Create `supabase/tests/database/rbac.test.sql` with exactly this content:

```sql
-- pgTAP: Super Admin role, app_permissions, has_permission(), is_admin() with Super Admin.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- Fixed test identities. The whole file runs in one transaction and rolls back.
-- Alice is a User, Carol is an Admin, Sam is a Super Admin.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'carol@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sam@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

update public.profiles set role_id = '30000000-0000-0000-0000-000000000001'
  where id = 'cccccccc-0000-0000-0000-00000000000c';
update public.profiles set role_id = '30000000-0000-0000-0000-000000000003'
  where id = 'dddddddd-0000-0000-0000-00000000000d';

-- 1-2: RLS is on; anon is denied.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.app_permissions'::regclass),
  'app_permissions has RLS enabled'
);
set local role anon;
select throws_ok(
  'select count(*) from public.app_permissions',
  '42501',
  null,
  'anon is denied select on app_permissions'
);
reset role;

-- 3-6: shape and seed.
select set_eq(
  $$select column_name::text from information_schema.columns
      where table_schema = 'public' and table_name = 'app_permissions'$$,
  $$values ('role_id'), ('resource'), ('read'), ('create'), ('update'), ('delete')$$,
  'app_permissions has the expected columns'
);
select is(
  (select name from public.roles where id = '30000000-0000-0000-0000-000000000003'),
  'Super Admin',
  'the Super Admin role exists with its fixed id'
);
select cmp_ok(
  (select count(*) from public.app_permissions),
  '>=',
  12::bigint,
  'at least three roles x four tables are seeded'
);
-- Every public table must have a row for every role (each table migration seeds its own rows).
select is(
  (select count(*) from pg_tables t cross join public.roles r
    where t.schemaname = 'public'
      and not exists (
        select 1 from public.app_permissions a
        where a.role_id = r.id and a.resource = t.tablename)),
  0::bigint,
  'every public table has an app_permissions row for every role'
);

-- 7-12: seeded matrix, read,create,update,delete.
select is(
  (select concat_ws(',', "read", "create", "update", "delete") from public.app_permissions
    where role_id = '30000000-0000-0000-0000-000000000001' and resource = 'roles'),
  't,f,f,f',
  'Admin can only read roles'
);
select is(
  (select concat_ws(',', "read", "create", "update", "delete") from public.app_permissions
    where role_id = '30000000-0000-0000-0000-000000000001' and resource = 'app_permissions'),
  't,f,f,f',
  'Admin can only read app_permissions'
);
select is(
  (select concat_ws(',', "read", "create", "update", "delete") from public.app_permissions
    where role_id = '30000000-0000-0000-0000-000000000002' and resource = 'roles'),
  't,f,f,f',
  'User can only read roles'
);
select is(
  (select concat_ws(',', "read", "create", "update", "delete") from public.app_permissions
    where role_id = '30000000-0000-0000-0000-000000000002' and resource = 'todos'),
  't,t,t,t',
  'User keeps full access to their own todos'
);
select is(
  (select concat_ws(',', "read", "create", "update", "delete") from public.app_permissions
    where role_id = '30000000-0000-0000-0000-000000000003' and resource = 'roles'),
  't,t,t,t',
  'Super Admin can read and write roles'
);
select is(
  (select concat_ws(',', "read", "create", "update", "delete") from public.app_permissions
    where role_id = '30000000-0000-0000-0000-000000000003' and resource = 'app_permissions'),
  't,t,t,t',
  'Super Admin can read and write app_permissions'
);

-- Act as Alice (User).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);

-- 13-15
select is(public.has_permission('roles', 'create'), false, 'User cannot create roles');
select is(public.has_permission('todos', 'read'), true, 'User can read todos');
select throws_ok(
  $$insert into public.app_permissions (role_id, resource, "read")
    values ('30000000-0000-0000-0000-000000000002', 'sneaky', true)$$,
  '42501',
  null,
  'a User cannot insert into app_permissions'
);
reset role;

-- Act as Carol (Admin).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);

-- 16-23: an Admin writes the dispatch tables but not roles or app_permissions.
select is(public.is_admin(), true, 'is_admin() is true for an Admin');
select is(public.has_permission('roles', 'create'), false, 'Admin cannot create roles');
select is(public.has_permission('app_permissions', 'update'), false, 'Admin cannot update app_permissions');
select throws_ok(
  $$insert into public.roles (name) values ('Sneaky Role')$$,
  '42501',
  null,
  'an Admin cannot insert a role'
);
select throws_ok(
  $$insert into public.app_permissions (role_id, resource, "read")
    values ('30000000-0000-0000-0000-000000000002', 'sneaky', true)$$,
  '42501',
  null,
  'an Admin cannot insert into app_permissions'
);
select lives_ok(
  $$update public.app_permissions set "update" = true
      where role_id = '30000000-0000-0000-0000-000000000001' and resource = 'app_permissions'$$,
  'an Admin update of app_permissions is silently filtered by RLS'
);
select lives_ok(
  $$delete from public.app_permissions where resource = 'todos'$$,
  'an Admin delete of app_permissions is silently filtered by RLS'
);
select lives_ok(
  $$update public.roles set name = 'Hijacked'$$,
  'an Admin update of roles is silently filtered by RLS'
);
reset role;

-- Act as Sam (Super Admin).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-00000000000d', true);

-- 24-32: a Super Admin is an Admin and can write roles and app_permissions.
select is(public.is_admin(), true, 'is_admin() is true for a Super Admin');
select is(public.has_permission('roles', 'create'), true, 'Super Admin can create roles');
select is(public.has_permission('app_permissions', 'update'), true, 'Super Admin can update app_permissions');
select is(public.has_permission('roles', 'bogus'), false, 'an unknown action is denied');
select lives_ok(
  $$insert into public.roles (name) values ('Test Role')$$,
  'a Super Admin can insert a role'
);
select lives_ok(
  $$insert into public.app_permissions (role_id, resource, "read")
    values ('30000000-0000-0000-0000-000000000002', 'test_resource', true)$$,
  'a Super Admin can insert into app_permissions'
);
select lives_ok(
  $$update public.app_permissions set "read" = false where resource = 'test_resource'$$,
  'a Super Admin can update app_permissions'
);
select is(
  (select "read" from public.app_permissions where resource = 'test_resource'),
  false,
  'the Super Admin update was applied'
);
select lives_ok(
  $$delete from public.app_permissions where resource = 'test_resource'$$,
  'a Super Admin can delete from app_permissions'
);
reset role;

-- 33-36: nothing else changed.
select is(
  (select count(*) from public.app_permissions where resource = 'test_resource'),
  0::bigint,
  'the Super Admin test row is gone'
);
select is(
  (select concat_ws(',', "read", "create", "update", "delete") from public.app_permissions
    where role_id = '30000000-0000-0000-0000-000000000001' and resource = 'app_permissions'),
  't,f,f,f',
  'Admin permissions on app_permissions are unchanged'
);
select cmp_ok(
  (select count(*) from public.app_permissions where resource = 'todos'),
  '=',
  3::bigint,
  'the Admin delete attempt removed nothing'
);
select is(
  (select count(*) from public.roles where name = 'Hijacked'),
  0::bigint,
  'the Admin update of roles changed nothing'
);

-- 37-38: constraints (as owner).
select throws_ok(
  $$insert into public.app_permissions (role_id, resource)
    values ('30000000-0000-0000-0000-000000000001', 'roles')$$,
  '23505',
  null,
  'a role has one row per resource'
);
select throws_ok(
  $$insert into public.app_permissions (role_id, resource)
    values ('99999999-9999-9999-9999-999999999999', 'roles')$$,
  '23503',
  null,
  'app_permissions.role_id must exist in roles'
);

select * from finish();
rollback;
```

### Step 14. Seed the first Super Admin and update the seed test

**14a. `supabase/seed.sql`.** Four edits.

Edit A. Find:

```sql
-- Passwords: admin@example.com / admin-password-123 , user@example.com / user-password-123
```

Replace with:

```sql
-- Passwords: admin@example.com / admin-password-123 , user@example.com / user-password-123 ,
-- superadmin@example.com / superadmin-password-123
```

Edit B. Find:

```sql
    '{"display_name":"Local User"}',
    now(), now(), '', '', '', ''
  );
```

Replace with:

```sql
    '{"display_name":"Local User"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', 'superadmin@example.com',
    extensions.crypt('superadmin-password-123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Local Super Admin"}',
    now(), now(), '', '', '', ''
  );
```

Edit C. Find:

```sql
   '22222222-2222-2222-2222-222222222222', now(), now(), now());
```

Replace with:

```sql
   '22222222-2222-2222-2222-222222222222', now(), now(), now()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333',
   '{"sub":"33333333-3333-3333-3333-333333333333","email":"superadmin@example.com"}', 'email',
   '33333333-3333-3333-3333-333333333333', now(), now(), now());
```

Edit D. Find:

```sql
-- The trigger created both profiles. Promote the admin.
update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = '11111111-1111-1111-1111-111111111111';
```

Replace with:

```sql
-- The trigger created the profiles. Promote the admin and the super admin.
update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set role_id = '30000000-0000-0000-0000-000000000003' where id = '33333333-3333-3333-3333-333333333333';
```

**14b. `supabase/tests/database/seed.test.sql`.** Two edits.

Edit A. Find: `select plan(3);`
Replace with: `select plan(4);`

Edit B. Find: `select * from finish();`
Replace with:

```sql
select is(
  (select r.name from public.profiles p join public.roles r on r.id = p.role_id
     where p.id = '33333333-3333-3333-3333-333333333333'),
  'Super Admin',
  'seeded super admin has the Super Admin role'
);

select * from finish();
```

### Step 15. README and AGENTS.md

**15a. `README.md`.** Four edits.

Edit A. Find: `  migrations/0003_roles.sql      roles (Admin, User), profiles.role_id`
Replace with:

```
  migrations/0003_roles.sql      roles (Admin, User), profiles.role_id
  migrations/0004_app_permissions.sql  Super Admin role, app_permissions, has_permission()
```

Edit B. Find: `Anonymous sign-in is off.`
Replace with:

```
Roles are Admin, User and Super Admin. The `app_permissions` table lists what each role may do per table (read, create, update, delete). Admin can modify every dispatch table but not `roles` or `app_permissions`; only Super Admin can modify those two. Anonymous sign-in is off.
```

Edit C. Find: ``| `user@example.com`  | `user-password-123`  | User  |``
Replace with:

```
| `user@example.com`  | `user-password-123`  | User  |
| `superadmin@example.com` | `superadmin-password-123` | Super Admin |
```

Edit D. In the "How to add a new table" list, find: `2. RLS: enable RLS on the table, then add explicit `grant`s and policies. Anon gets nothing by default.`
Replace with:

```
2. RLS: enable RLS on the table, then add explicit `grant`s and policies. Anon gets nothing by default. Policies call `has_permission('<table>', '<action>')`, and the same migration inserts the table's rows in `app_permissions` (Admin and Super Admin read and write, User reads only). `rbac.test.sql` fails if a table has no row for a role.
```

Then run `pnpm exec prettier --write README.md` (it realigns the credentials table; this is the only formatting change allowed).

**15b. `AGENTS.md`.** Two edits.

Edit A. Find: `- Every new table gets RLS, explicit grants and a pgTAP isolation test (see the README checklist).`
Replace with: `- Every new table gets RLS, explicit grants, policies that call `has_permission`, its own rows in `app_permissions`, and a pgTAP isolation test (see the README checklist).`

Edit B. In the Plans layout list, find the end of item 7: `Large plans group steps into phases, one commit per phase.`
Replace with:

```
Large plans group steps into phases, one commit per phase. A plan that makes a major architectural change (for example access control, the data model or auth) ends with a step that documents the change in its own numbered file `docs/architecture/NNNN-Short-Name.md` (NNNN is the next free number, starting at `0001`; create the folder if missing). The file starts with the ticket, the plan path, the date and the status, and `README.md` links to it.
```

### Step 16. Document the architecture change (`docs/architecture/0001-Role-Based-Access.md`)

This plan changes how access is decided across the whole database, so it ends by documenting it in the repo (convention added in Step 15b). Each architecture change gets its own numbered file in `docs/architecture/`, so later changes add `0002-...`, `0003-...` and so on. Neither `docs/` nor `docs/architecture/` exists yet; create them. This is change `0001`.

Create `docs/architecture/0001-Role-Based-Access.md` with exactly this content:

```markdown
# 0001 Role-based access

- Ticket: T3C-B0
- Plan: `.claude/plans/backend/T3C-B0-Users-Table.md`
- Date: 2026-11-27
- Status: implemented

## Summary

Access is decided by the signed-in user's role, through a permission matrix in the database.

## Access control

Access is decided in Postgres, by row level security (RLS). The web app and the edge functions only
ask the database; they do not decide who may do what.

### Roles

- `public.roles` holds three rows with fixed ids: Admin (`30000000-0000-0000-0000-000000000001`),
  User (`...0002`) and Super Admin (`...0003`).
- `public.profiles.role_id` links every profile to one role. New profiles default to User.
- `role_id` is column-protected: signed-in users can update only `profiles.display_name`. A role is
  assigned only with direct database access.
- Anonymous sign-in is off (`enable_anonymous_sign_ins = false` in `supabase/config.jsonc`). On
  hosted projects it is switched off in the Supabase dashboard.

### Permission matrix

- `public.app_permissions` has one row per role and table: `role_id`, `resource` (the table name),
  and four booleans `read`, `create`, `update`, `delete`. The key is `(role_id, resource)`.
- Admin and Super Admin read and write every dispatch table. User reads only.
- Only Super Admin can write `roles` and `app_permissions`. Admin can only read them.
- The rows for `profiles` and `todos` describe today's behaviour (own rows only for Users). Their
  policies are written by hand and do not read the matrix.

### How a policy reads the matrix

- `public.has_permission(resource, action)` is `security definer` and `stable`. It looks up the
  signed-in user's role in `profiles`, then the row for that resource in `app_permissions`. It returns
  `false` for an unknown action or when there is no row (deny by default).
- Every dispatch table has four policies, one per action, that call
  `(select public.has_permission('<table>', '<action>'))`.
- `public.is_admin()` is true for Admin and Super Admin. Only the `profiles` and `todos` policies still
  use it.

### Adding a table

1. Create the table, enable RLS, revoke all from `anon` and `authenticated`, grant explicitly.
2. Add the four `has_permission` policies.
3. In the same migration insert the table's three rows in `app_permissions` (Admin and Super Admin
   `read, create, update, delete`; User `read` only).
4. `supabase/tests/database/rbac.test.sql` fails if any public table has no row for a role.

### Known limits

- A Super Admin can remove their own `app_permissions` rights. Only direct database access restores
  them.
- Nothing in the app lets a user change a role.
- Anyone who can register gets the User role and can read every table (`enable_signup` is `true`).
```

Then run `pnpm exec prettier --write docs/architecture/0001-Role-Based-Access.md` and add a link to it in `README.md`: find `## Scripts` (the heading directly after the seeded accounts table) and replace with:

```
Architecture changes are documented, one numbered file each, in [docs/architecture](docs/architecture). Access control: [0001 Role-based access](docs/architecture/0001-Role-Based-Access.md).

## Scripts
```

### Step 17. Phase 2 gates

```bash
pnpm db:reset && pnpm db:types && grep -c "app_permissions" src/types/database.types.ts
```

**Expect:** exits 0; the `grep` prints a number greater than `0`.

```bash
pnpm test:db
```

**Expect:** every file reports `ok` and the summary ends with `Result: PASS`; `rbac.test.sql` runs 38 tests, `roles.test.sql` 22, `rls.test.sql` 15, `seed.test.sql` 4, `todo_stats.test.sql` 6. If `rls.test.sql` fails, stop and report (do not edit it).

```bash
pnpm lint && pnpm typecheck && pnpm test
```

**Expect:** all exit 0.

```bash
pnpm exec prettier --check README.md AGENTS.md docs/architecture/0001-Role-Based-Access.md .claude/plans/backend/T3C-B0-Users-Table.md
```

**Expect:** `All matched files use Prettier code style!` If a file is listed, run `pnpm exec prettier --write` on **only that file**, then repeat.

```bash
pnpm test:all
```

**Expect:** lint, typecheck, vitest, pgTAP, Deno and Playwright all pass. Then `git status --short` lists only: this plan, `supabase/migrations/0004_app_permissions.sql`, `supabase/seed.sql`, `supabase/tests/database/rbac.test.sql`, `supabase/tests/database/roles.test.sql`, `supabase/tests/database/seed.test.sql`, `src/types/database.types.ts`, `README.md`, `AGENTS.md`, `docs/architecture/0001-Role-Based-Access.md`, plus the changed plan files under `.claude/plans/backend/` for T3C-B5 to T3C-B33 and T3C-S31. Anything else: stop and report.

## Rollback

- Phase 2, before commit: `git restore --staged --worktree supabase/seed.sql supabase/tests/database/roles.test.sql supabase/tests/database/seed.test.sql README.md AGENTS.md src/types/database.types.ts && rm supabase/migrations/0004_app_permissions.sql supabase/tests/database/rbac.test.sql`, then `pnpm db:reset`.
- Phase 2, after merge, if a hosted DB already has `0004`: add a new migration (next free number) that moves any profile with the Super Admin role to Admin, recreates `roles_select_authenticated` and `roles_admin_all` exactly as in `0003_roles.sql`, restores `is_admin()` to test only the Admin id, then drops the `roles_*` policies of this phase, `public.has_permission(text, text)`, `public.app_permissions`, and the Super Admin role row. Stop and ask first if other tables already call `has_permission` (every table from T3C-B5 to T3C-B33 does, so none of them may be applied first).
- Phase 1, before commit: `git switch main && git branch -D feat/T3C-B0-Users-Table`, then `pnpm db:reset`. To restore the pre-change local data, load `~/dispatch-tracker-pre-roles.sql` after the reset (the seed already recreates the same rows, so it is usually unnecessary).
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

Phase 2 (new commits on the same branch; Phase 1 commits 1-4 already exist):

5. `feat(db): add Super Admin role and app_permissions`
   Files: `supabase/migrations/0004_app_permissions.sql`, `supabase/seed.sql`, `supabase/tests/database/roles.test.sql`, `supabase/tests/database/seed.test.sql`, `src/types/database.types.ts`
   Body: the new Super Admin row and the Super-Admin-only `roles` rule break the Phase 1 roles test, and the seeded Super Admin needs the seed test, so they move with the migration to keep every commit green.
6. `test(db): cover app_permissions and has_permission`
   Files: `supabase/tests/database/rbac.test.sql`
7. `docs: document Super Admin and app_permissions`
   Files: `README.md`
8. `docs(agents): require app_permissions rows and architecture docs`
   Files: `AGENTS.md`
9. `docs: add architecture 0001 role-based access`
   Files: `docs/architecture/0001-Role-Based-Access.md`, `README.md`
10. `docs(plans): add T3C-B0 phase 2`
    Files: `.claude/plans/backend/T3C-B0-Users-Table.md`
11. `docs(plans): move table plans onto app_permissions`
    Files: every other file in `.claude/plans/backend/` that changed (T3C-B5 to T3C-B33, T3C-S31)
    Body: renumbers their migrations by one (they now start at `0005`) and replaces `is_admin()` policies with `has_permission()` policies plus their own `app_permissions` rows.

PR title: `feat(db): add roles and link profiles to them` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
