# T3C-B39 Sign-ups get no role until an administrator gives one

> **Status: Draft, not approved.**
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.
>
> **Phases.** Phase 1 (Steps 0 to 5) is one atomic change: the migration, the test and seed updates it forces, and the web updates the regenerated types force. It is one commit because no smaller piece leaves the suites green. Phase 2 (Steps 6 to 8) adds the new tests. Phase 3 (Step 9) is docs and the full gate.
>
> **Independent of the WordPress embed plans** (`T3C-NNN-WordPress-Embed-*.md`). It can be implemented before or after them; it uses migration number `0040` so the two never collide. Run it **before go-live** of the embed, because the embed plans assume that self sign-ups are harmless (see "Why").

## Why

Source: owner decision in conversation (2026-11-27). Public sign-up **stays on** in Dispatch Tracker. Anyone who signs up must get **no role**, so that they **cannot see any data at all** until they tell an administrator, who gives them a role on the Users page.

Today it is the opposite: every new sign-up silently becomes a **User**, and a User can **read every dispatch table** (clients, contacts, cleaners, cleaning jobs and so on). Anyone on the internet who can reach the Supabase API (the anon key is public) could sign up and read the business's data. This plan closes that.

- Acceptance:
  - A new sign-up (by any path: the app's `/register` page or a direct call to the Supabase API) has `profiles.role_id` empty.
  - A user with no role gets **nothing** from every data table, from `roles` and from `app_permissions`, can read only their own profile row, and cannot create, change or delete anything (the todos sample table included).
  - In the app, a user with no role sees one screen, "Your account has no access yet", with a Sign out button, and nothing else.
  - A Super Admin gives them a role on the Users page (existing page, no change to that flow). From then on they see what that role allows.
  - Existing users keep their roles. The seeded local `user@example.com` is still a User.

## Facts (verified 2026-11-27)

Branch at the time of writing: `main`; working tree has only untracked plan files.

1. **The role is required and defaults to User.** `0003_roles.sql` sets `alter column role_id set default '30000000-0000-0000-0000-000000000002'` and `set not null` on `public.profiles.role_id`. Fixed role ids: Admin `...0001`, User `...0002`, Super Admin `...0003` (`src/features/users/roles.ts`).
2. **The sign-up trigger** `public.handle_new_user()` (`0001_init.sql:36-52`) inserts only `(id, display_name)`, so the default applies. It fires for every insert into `auth.users`, whether from a sign-up, from the admin API or from a SQL test.
3. **`has_permission(resource, action)`** (`0004_app_permissions.sql:55-76`) joins `profiles p` to `app_permissions ap on ap.role_id = p.role_id`. A profile with a null role matches no row, `bool_or` over no rows is null, and `coalesce(..., false)` makes it **false** for every resource and action. So every table whose policies call `has_permission` (all the dispatch tables, `roles`, `app_permissions`) already shows nothing to a user without a role. `is_admin()` and `is_super_admin()` compare `role_id` to a fixed id and are false for null.
4. **`todos` is the exception.** Its policies (`0001_init.sql:98-119`: `todos_select_own`, `todos_insert_own`, `todos_update_own`, `todos_delete_own`, `todos_admin_all`) check only `user_id = auth.uid()` or `is_admin()`, not the permission matrix. Every role has `todos` rows in `app_permissions` with all four actions true (`0004:22-33`).
5. **`profiles`**: `profiles_select_own` (own row), `profiles_admin_select` (admins read all), `profiles_update_own`; users may update only their own `display_name` (`0001_init.sql:79-92`). `role_id` is not writable by users.
6. **Tests rely on the default.** 29 of the 32 files in `supabase/tests/database/` insert into `auth.users` and let the trigger make the profile a User; the three that do not are `seed.test.sql`, `seed_cleaning_jobs.test.sql`, `seed_cleaning_job_areas_items.test.sql`. `roles.test.sql` (`plan(22)`) asserts the default at its test 6 (lines 54-59, "a new profile defaults to the User role") and the not-null rule at its test 7 (lines 61-67, "profiles.role_id is required", `23502`).
7. **Seeds.** `supabase/seeds/01_users.sql:51-53` promotes the admin and the super admin; `user@example.com` (`22222222-2222-2222-2222-222222222222`) relies on the default.
8. **Web.** `src/app/providers/authProvider.ts:3` imports `USER_ROLE_ID`; `getIdentity` (lines 53-72) returns `role: profile?.roles.name ?? 'User'` and `roleId: profile?.role_id ?? USER_ROLE_ID`, so today a missing role **falls back to User**. `src/features/users/roles.ts` has `isSuperAdmin(roleId: string | undefined)` and `canChangeDispatchData(roleId: string | undefined)`. `UserList.tsx` renders `record.roles?.name ?? 'Unknown'`. `src/app/App.tsx` renders `<Outlet />` inside `<div className="app-content">`. `accessControlProvider.ts` is **not** changed by this plan (see Decisions).
9. **Local config.** `supabase/config.jsonc:261` and `:308` have `"enable_confirmations": false`, so a local sign-up gets a session at once. That is fine locally and is what the e2e test in Step 7 relies on. The hosted project is configured in the Supabase dashboard, not in this repo.
10. `src/types/database.types.ts` is generated; `pnpm db:reset` regenerates it. After this plan `profiles.role_id` is `string | null`, which makes `tsc` reject code that assumed a role (that is intended; Step 5 fixes it).

## Decisions already made (do not reopen)

- **"No role" is an empty `profiles.role_id`**, not a new role. The column becomes nullable with **no default**. Nothing in the database invents a role for a new user any more.
- **No role means no access, by the existing rule.** `has_permission` already denies; this plan relies on it rather than adding a parallel check, and adds **one** more gate: the four own-row `todos` policies also require `has_permission('todos', <action>)`. The admin override policy stays as it is.
- **A user with no role may still read their own `profiles` row** (and rename themselves). The app needs it to know who is signed in and that they have no role. No other row of any table is readable.
- **Migration** `0040_signup_no_default_role.sql`. It changes no data: every existing user keeps their role.
- **The app shows one notice** ("Your account has no access yet") in place of every page, through a small component `RoleOutlet` that replaces `<Outlet />` in `App.tsx`. The sidebar is not hidden (it only lists page names; the database is what enforces access). `accessControlProvider.ts` stays unchanged to avoid rewriting its tests for a cosmetic gain.
- **Fail closed in the app:** if the identity cannot be loaded, or has no role, show the notice. The database enforces the rule either way.
- **Giving a role is the existing flow**: a Super Admin edits the user on the Users page (`admin_update_profile`). No approval queue, no notification to admins.
- **Existing tests are patched in a deterministic way**: after every `insert into auth.users ...;` in each pgTAP file (except `roles.test.sql`, which is edited by hand) the script adds `update public.profiles set role_id = <User> where role_id is null;`. Test intent is unchanged: those tests were written for "Alice is a User".
- **Hosted setting (not code):** turn **Confirm email ON** in the Supabase dashboard. Without it anyone can sign up with someone else's address (see the WordPress embed master plan, "Production checklist").
- This plan **is** a change to access control, so Step 9 documents it by appending a section to the existing `docs/architecture/0001-Role-Based-Access.md` (not a new numbered file, so it cannot collide with the embed plan's `0009`).

### Open questions (do not block)

1. Should the `exchange-rate` edge function (public currency rates, needs only a signed-in JWT) also require a role? It exposes no business data, so this plan leaves it.
2. Should an administrator be told when someone signs up (a Slack message, an email)? Out of scope; today they find the person on the Users page (the new row has the role "No role").
3. A person who signs up with a password can later be given a role and then use the API directly with that password, not only through the WordPress embed. If the embed must be the **only** way in, that is a separate decision (master plan of the embed, open questions).

## Out of scope

- Disabling or approving sign-ups, rate limiting, captcha. (Deleting a stale or squatting sign-up is done by a Super Admin on the Users page; that button comes from the WordPress embed plan, `admin_delete_user`.)
- Changing `accessControlProvider.ts`, the `register` page, `admin_update_profile`, `has_permission`, or any dispatch table's policies.
- A way to take a role away from the app (the function would accept it, the Users page requires a role in its form; unchanged).
- The WordPress embed (separate plans).
- Fixing any baseline failure in Step 0.

## Steps

### Step 0: baseline

```bash
git status --short
ls supabase/migrations | tail -3
pnpm db:reset
pnpm test:db
pnpm test
```

**Expect:** `git status --short` shows nothing, or only untracked plan files under `.claude/plans/`; the migrations list has no `0040_*`; `pnpm db:reset` ends without error; `pnpm test:db` passes every file; `pnpm test` passes. Note the file counts. Anything else: stop and report.

Create the branch: `git switch -c feat/T3C-B39-Backend-Signup-No-Default-Role`.

### Phase 1: one atomic change

#### Step 1: migration

Create `supabase/migrations/0040_signup_no_default_role.sql` with exactly:

```sql
-- 0040_signup_no_default_role: a new sign-up has no role, so it can read nothing until a Super Admin
-- gives it one on the Users page. Existing users keep their roles; no data changes.

alter table public.profiles
  alter column role_id drop default,
  alter column role_id drop not null;

-- has_permission() is false for a profile without a role (its join finds no app_permissions row), so every
-- table whose policies call it already shows nothing to such a user. todos was the exception: its own-row
-- policies did not look at the permission matrix. They do now. todos_admin_all is unchanged.
drop policy todos_select_own on public.todos;
drop policy todos_insert_own on public.todos;
drop policy todos_update_own on public.todos;
drop policy todos_delete_own on public.todos;

create policy todos_select_own
  on public.todos for select to authenticated
  using (user_id = (select auth.uid()) and (select public.has_permission('todos', 'read')));

create policy todos_insert_own
  on public.todos for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_permission('todos', 'create')));

create policy todos_update_own
  on public.todos for update to authenticated
  using (user_id = (select auth.uid()) and (select public.has_permission('todos', 'update')))
  with check (user_id = (select auth.uid()) and (select public.has_permission('todos', 'update')));

create policy todos_delete_own
  on public.todos for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.has_permission('todos', 'delete')));
```

**Gate:** `pnpm db:reset`
**Expect:** every migration including `0040_signup_no_default_role.sql` applies with no error. Then `grep -n "role_id" src/types/database.types.ts | head -5` shows `role_id: string | null` in the `profiles` `Row` (the first match). The suites are red from here until Step 4; that is expected.

#### Step 2: patch the existing pgTAP files

This is the one mechanical edit. It makes every test user a User explicitly, as they were before. Run exactly:

```bash
python3 - <<'EOF'
import pathlib, re

LINE = (
    "\n\n-- A sign-up has no role (0040). These tests were written for a User, so give the test users that role.\n"
    "update public.profiles set role_id = '30000000-0000-0000-0000-000000000002' where role_id is null;"
)
patched = 0
for path in sorted(pathlib.Path('supabase/tests/database').glob('*.test.sql')):
    if path.name == 'roles.test.sql':
        continue  # edited by hand in Step 3
    text = path.read_text()
    starts = [m.start() for m in re.finditer(r'insert into auth\.users', text)]
    if not starts:
        continue
    for start in reversed(starts):
        end = text.index(';', start)
        text = text[: end + 1] + LINE + text[end + 1 :]
    path.write_text(text)
    patched += 1
print('patched', patched, 'files')
EOF
```

**Expect:** it prints `patched N files` with N at least 26 (the 29 files that insert users, minus `roles.test.sql`, minus any that do not match). Then `git diff --stat supabase/tests/database | tail -1` shows only insertions (no deletions). Do not edit the files further.

#### Step 3: `roles.test.sql` by hand

In `supabase/tests/database/roles.test.sql`, make these three edits (the plan count `22` does not change):

1. Find: `-- 5-6: profiles.role is gone; a new profile defaults to the User role.` Replace with: `-- 5-6: profiles.role is gone; a new profile has no role (0040).`
2. Find:

```
select is(
  (select role_id from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  '30000000-0000-0000-0000-000000000002'::uuid,
  'a new profile defaults to the User role'
);
```

Replace with:

```
select is(
  (select role_id from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  null::uuid,
  'a new profile has no role'
);
-- The tests below need Alice to be a User, as before sign-ups had no role.
update public.profiles set role_id = '30000000-0000-0000-0000-000000000002'
  where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
```

3. Find:

```
select throws_ok(
  $$update public.profiles set role_id = null where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '23502',
  null,
  'profiles.role_id is required'
);
```

Replace with:

```
select lives_ok(
  $$update public.profiles set role_id = null where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  'profiles.role_id may be empty'
);
update public.profiles set role_id = '30000000-0000-0000-0000-000000000002'
  where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
```

#### Step 4: the local seed

Edit `supabase/seeds/01_users.sql`. Find:

```
update public.profiles set role_id = '30000000-0000-0000-0000-000000000003' where id = '33333333-3333-3333-3333-333333333333';
```

Replace with:

```
update public.profiles set role_id = '30000000-0000-0000-0000-000000000003' where id = '33333333-3333-3333-3333-333333333333';
-- A sign-up has no role (0040), so the seeded plain user is given the User role explicitly.
update public.profiles set role_id = '30000000-0000-0000-0000-000000000002' where id = '22222222-2222-2222-2222-222222222222';
```

**Gate:** `pnpm db:reset && pnpm test:db`
**Expect:** the reset ends without error and **every** pgTAP file passes (the same number of files as in Step 0). If a file fails, **stop and report** with its name and the failing test; do not edit it.

#### Step 5: the web app

5a. Edit `src/features/users/roles.ts`. Find `export function isSuperAdmin(roleId: string | undefined): boolean {` and replace with `export function isSuperAdmin(roleId: string | null | undefined): boolean {`. Find `export function canChangeDispatchData(roleId: string | undefined): boolean {` and replace with `export function canChangeDispatchData(roleId: string | null | undefined): boolean {`.

5b. Edit `src/app/providers/authProvider.ts`:

- Find and **delete** the whole line `import { USER_ROLE_ID } from '@/features/users/roles'`.
- Find:

```
      role: profile?.roles.name ?? 'User',
      roleId: profile?.role_id ?? USER_ROLE_ID,
```

Replace with:

```
      // No role (a new sign-up, or a profile that did not load) stays "no role": it never falls back to User.
      role: profile?.roles?.name ?? null,
      roleId: profile?.role_id ?? null,
```

5c. Edit `src/app/providers/authProvider.test.ts`. Find the line `  it('getIdentity returns null when signed out', async () => {` and replace with:

```
  it('getIdentity reports no role for a profile without one', async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { id: 'u2', email: 'n@b.co' } },
    })
    maybeSingle.mockResolvedValue({
      data: { display_name: '', role_id: null, roles: null },
      error: null,
    })
    expect(await authProvider.getIdentity()).toEqual({
      id: 'u2',
      email: 'n@b.co',
      name: 'n@b.co',
      role: null,
      roleId: null,
    })
  })

  it('getIdentity never falls back to a role when the profile is missing', async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { id: 'u3', email: 'm@b.co' } },
    })
    maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await authProvider.getIdentity()).toMatchObject({ role: null, roleId: null })
  })

  it('getIdentity returns null when signed out', async () => {
```

5d. Edit `src/features/users/pages/UserList.tsx`. Find `{record.roles?.name ?? 'Unknown'}` and replace with `{record.role_id === null ? 'No role' : (record.roles?.name ?? 'Unknown')}`.

5e. Create `src/app/RoleGate.tsx` with exactly:

```tsx
import { useGetIdentity, useLogout } from '@refinedev/core'
import { Button, Result, Spin } from 'antd'
import { Outlet } from 'react-router'

interface Identity {
  roleId: string | null
}

// Replaces <Outlet /> in the signed-in layout. A user with no role (a new sign-up) sees one notice instead
// of any page. The database already shows them nothing; this explains why. It fails closed: if the
// identity is missing it shows the notice too.
export function RoleOutlet() {
  const { data: identity, isLoading } = useGetIdentity<Identity>()
  const { mutate: logout } = useLogout()

  if (isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!identity?.roleId) {
    return (
      <Result
        status="403"
        title="Your account has no access yet"
        subTitle="Ask an administrator to give you a role, then reload this page."
        extra={
          <Button
            onClick={() => {
              logout()
            }}
          >
            Sign out
          </Button>
        }
      />
    )
  }
  return <Outlet />
}
```

5f. Create `src/app/RoleGate.test.tsx` with exactly:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const identity = vi.hoisted(() => ({ value: { data: undefined as unknown, isLoading: false } }))

vi.mock('@refinedev/core', () => ({
  useGetIdentity: () => identity.value,
  useLogout: () => ({ mutate: vi.fn() }),
}))
vi.mock('react-router', () => ({ Outlet: () => 'page content' }))

const { RoleOutlet } = await import('@/app/RoleGate')

describe('RoleOutlet', () => {
  it('shows the page for a user with a role', () => {
    identity.value = { data: { roleId: '30000000-0000-0000-0000-000000000002' }, isLoading: false }
    render(<RoleOutlet />)
    expect(screen.getByText('page content')).toBeInTheDocument()
  })

  it('shows only the notice for a user with no role', () => {
    identity.value = { data: { roleId: null }, isLoading: false }
    render(<RoleOutlet />)
    expect(screen.getByText('Your account has no access yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.queryByText('page content')).not.toBeInTheDocument()
  })

  it('fails closed when there is no identity', () => {
    identity.value = { data: undefined, isLoading: false }
    render(<RoleOutlet />)
    expect(screen.getByText('Your account has no access yet')).toBeInTheDocument()
  })
})
```

5g. Edit `src/app/App.tsx`:

- Find `import { features } from '@/app/features'` and replace with:

```
import { features } from '@/app/features'
import { RoleOutlet } from '@/app/RoleGate'
```

(if the line is followed by other imports added by another plan, keep them; only add the `RoleOutlet` line right after it.)

- Find the line that contains only `<Outlet />` inside `<div className="app-content">` (the one **not** in `fallback={<Outlet />}`) and replace `<Outlet />` on that line with `<RoleOutlet />`.
- Then `Outlet` is still used by the other routes in the file, so keep the `Outlet` import. If `pnpm lint` reports it unused, stop and report.

Format the touched files: `pnpm exec prettier --write src/app/RoleGate.tsx src/app/RoleGate.test.tsx src/app/App.tsx src/app/providers/authProvider.ts src/app/providers/authProvider.test.ts src/features/users/roles.ts src/features/users/pages/UserList.tsx`

**Gate:** `pnpm lint && pnpm typecheck && pnpm test`
**Expect:** no lint or type errors; all Vitest files pass, including the new `RoleGate.test.tsx` (3 tests) and the 2 new `authProvider` tests. If `tsc` reports another place that assumed a role (for example another file reading `identity.role`), **stop and report** the file and line.

**Phase 1 is complete here.** Commit it as one commit (see "Conventional commits", commit 2).

### Phase 2: new tests

#### Step 6: pgTAP test for the new rule

Create `supabase/tests/database/no_role.test.sql` with exactly:

```sql
-- pgTAP: a sign-up has no role (0040) and can read nothing until a Super Admin gives one.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Nora just signed up (no role). Sam is a Super Admin.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('e5500000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'nora@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('d5500000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sam@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

update public.profiles set role_id = '30000000-0000-0000-0000-000000000003'
  where id = 'd5500000-0000-0000-0000-00000000000d';

-- One todo of Nora's, made as the owner, so we can tell "hidden" from "not there".
insert into public.todos (user_id, title) values ('e5500000-0000-0000-0000-00000000000e', 'Nora todo');

-- 1: the trigger gave her no role.
select is(
  (select role_id from public.profiles where id = 'e5500000-0000-0000-0000-00000000000e'),
  null::uuid,
  'a new sign-up has no role'
);

-- Act as Nora.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e5500000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e5500000-0000-0000-0000-00000000000e', true);

-- 2-5: no permission, no admin rights.
select is(public.has_permission('clients', 'read'), false, 'no role: cannot read clients');
select is(public.has_permission('cleaning_jobs', 'read'), false, 'no role: cannot read cleaning jobs');
select is(public.is_admin(), false, 'no role: not an admin');
select is(public.is_super_admin(), false, 'no role: not a Super Admin');

-- 6-7: only her own profile; no role list.
select is(
  (select count(*) from public.profiles),
  1::bigint,
  'no role: she sees only her own profile'
);
select is((select count(*) from public.roles), 0::bigint, 'no role: she cannot read roles');

-- 8-9: even her own todos are hidden and she cannot add one.
select is((select count(*) from public.todos), 0::bigint, 'no role: her own todo is hidden');
select throws_ok(
  $$insert into public.todos (user_id, title) values ('e5500000-0000-0000-0000-00000000000e', 'x')$$,
  '42501',
  null,
  'no role: she cannot create a todo'
);
reset role;

-- 10: Sam gives her the User role.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d5500000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd5500000-0000-0000-0000-00000000000d', true);
select lives_ok(
  $$select public.admin_update_profile('e5500000-0000-0000-0000-00000000000e', 'Nora', '30000000-0000-0000-0000-000000000002')$$,
  'a Super Admin can give her a role'
);
reset role;

-- 11-13: now she gets what a User gets.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e5500000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e5500000-0000-0000-0000-00000000000e', true);
select is(public.has_permission('clients', 'read'), true, 'with the User role she can read clients');
select is(public.has_permission('clients', 'create'), false, 'with the User role she still cannot create clients');
select is((select count(*) from public.todos), 1::bigint, 'with the User role she sees her own todo');
reset role;

select * from finish();
rollback;
```

**Gate:** `pnpm test:db`
**Expect:** every file passes, including `no_role.test.sql` (13 tests, all `ok`).

#### Step 7: end-to-end test of a real sign-up

Create `e2e/signup-no-role.spec.ts` with exactly:

```ts
import { expect, test } from '@playwright/test'

// Local only: supabase/config.jsonc has enable_confirmations = false, so a sign-up gets a session at once.
// The user it creates stays until `pnpm db:reset`.
test.use({ storageState: { cookies: [], origins: [] } })

test('someone who signs up has no role and sees only the notice', async ({ page }) => {
  const email = `signup-${String(Date.now())}@example.com`
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('a-long-password-123')
  await page.getByRole('button', { name: /sign up|register/i }).click()

  await expect(page.getByText('Your account has no access yet')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  // No page content: neither the dashboard buttons nor any list.
  await expect(page.getByTestId('btn-call-rpc')).toHaveCount(0)
})
```

Format: `pnpm exec prettier --write e2e/signup-no-role.spec.ts`

**Gate:** `pnpm exec playwright test e2e/signup-no-role.spec.ts --project=chromium`
**Expect:** 1 test passes. If the register form labels or button name differ (the test cannot find them), **stop and report**; do not guess other selectors.

### Phase 3: docs and the full gate

#### Step 8: docs

8a. Append to the **end** of `docs/architecture/0001-Role-Based-Access.md` (leave the existing text unchanged):

```md

## Sign-ups have no role (0040)

- Ticket: T3C-B39. Plan: `.claude/plans/T3C-B39-Backend-Signup-No-Default-Role.md`. Date: 2026-11-27.
- `profiles.role_id` is empty for a new sign-up (no default, not required). Nothing invents a role. Existing users keep theirs.
- `has_permission()` is false for a user with no role, so the dispatch tables, `roles` and `app_permissions` show them nothing. The four own-row policies of `todos` now call `has_permission('todos', ...)` too, so even their own todos are hidden. A user with no role can still read and rename their own profile row, because the app needs it to know who they are.
- The web app replaces every page with "Your account has no access yet" and a Sign out button for such a user (`RoleOutlet`, `src/app/RoleGate.tsx`). It fails closed. The database is what enforces the rule.
- A Super Admin gives a role on the Users page (`admin_update_profile`). The list shows "No role" for new sign-ups.
- Public sign-up stays on. In the hosted project **Confirm email must be on**, so nobody can sign up with an address they do not own.
- Known limits: nobody is told when someone signs up; a person with a password and a role can use the API directly (not only the web app).
```

8b. Edit `README.md`. Find `Roles are Admin, User and Super Admin.` and replace with `Roles are Admin, User and Super Admin. A new sign-up has **no role** and sees nothing until a Super Admin gives one on the Users page (see [0001](docs/architecture/0001-Role-Based-Access.md)).`

Format: `pnpm exec prettier --check docs/architecture/0001-Role-Based-Access.md README.md` **Expect:** formatted (if not, run `--write` on those two files only).

#### Step 9: full gate

**Gate:** `pnpm test:all`
**Expect:** lint, typecheck, Vitest, pgTAP, Deno and Playwright all pass. The Deno and Playwright parts need `supabase functions serve` running as in the CI workflow. Any failure: stop and report.

## Rollback

Nothing is deployed by this plan. To undo locally before merge: `git switch main && git branch -D feat/T3C-B39-Backend-Signup-No-Default-Role && pnpm db:reset`. If `0040` has been applied to a shared or hosted database, do not edit it. **Do not simply restore the old default**: that would give every roleless sign-up the User role, and with it read access to all dispatch data. First list them (`select id from public.profiles where role_id is null`) and decide for each person. Then add a later migration that restores the three `todos` policies of `0001_init.sql` and, only if you really want the old behaviour, sets the default and `not null` again after giving those people a role.

## Conventional commits

Branch: `feat/T3C-B39-Backend-Signup-No-Default-Role` (from `main`). Stage explicit paths only (never `git add -A`; patched test files are many, list them with `git diff --name-only supabase/tests/database`). Every commit ends with the footer lines:

```
Refs: T3C-B39
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `docs(plans): add the signup without a default role plan`. Stage: `.claude/plans/T3C-B39-Backend-Signup-No-Default-Role.md` (skip if already committed).
2. `feat(db): give new sign-ups no role and no access` (after Step 5). Stage: `supabase/migrations/0040_signup_no_default_role.sql`, `src/types/database.types.ts`, every file listed by `git diff --name-only supabase/tests/database`, `supabase/seeds/01_users.sql`, `src/features/users/roles.ts`, `src/features/users/pages/UserList.tsx`, `src/app/App.tsx`, `src/app/RoleGate.tsx`, `src/app/RoleGate.test.tsx`, `src/app/providers/authProvider.ts`, `src/app/providers/authProvider.test.ts`. Body: a new profile has no role; has_permission already denies it; the todos policies now check the matrix; existing tests and the seed give their users the User role explicitly; the web app shows a no-access notice. One commit because the regenerated types and the existing suites cannot be green in smaller pieces.
3. `test(db): cover sign-ups with no role` (after Step 6). Stage: `supabase/tests/database/no_role.test.sql`.
4. `test(e2e): cover a sign-up that has no role` (after Step 7). Stage: `e2e/signup-no-role.spec.ts`.
5. `docs(db): document sign-ups without a role` (after Step 8). Stage: `docs/architecture/0001-Role-Based-Access.md`, `README.md`.

PR title: `feat(db): give new sign-ups no role and no access` (72 characters or fewer). Body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
