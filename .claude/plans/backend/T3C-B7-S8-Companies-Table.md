# T3C-B7 T3C-S8 Add the companies table and seed the four companies

> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

Source: sprint sheet `The Tidy Team - Digital Platforms Sprint - Sprint 2_ Nov-23-27-2026'.csv`, stories T3C-B7 (Backend, Companies table) and T3C-S8 (Seed, Seed companies).

- T3C-B7: "As a dispatcher, I want a list of the companies we operate under, so that clients, cleaners and invoices can be tied to the right brand." Acceptance: table `companies` with columns `id`, `name`; `name` is required and unique.
- T3C-S8: "As a dispatcher, I want the four companies available from day one." Acceptance: after seeding, `companies` holds exactly `The Tidy Team`, `Total Home Care`, `Maids in Pink`, `Diamond MIP`, spelled exactly like that; running the seed twice creates no duplicates.

`companies` is the root of the schema. Clients (T3C-B6), company cleaners (T3C-B10) and invoice templates (T3C-B30) all point at it, so it must land first.

## Facts (verified 2026-11-27)

1. Branch is `main`, working tree clean. Migrations in `supabase/migrations/`: `0001_init.sql`, `0002_todo_stats.sql`, `0003_roles.sql`, `0004_app_permissions.sql` and `0005_user_admin.sql` from T3C-B0 (`.claude/plans/backend/T3C-B0-Users-Table.md`, must be implemented first; if it is missing, **stop and report**). They are numbered `NNNN_name.sql`, not timestamped. The next file is `0006_companies.sql`.
2. `public.is_admin()` exists (`0001_init.sql`, redefined in `0003_roles.sql` to test `profiles.role_id` against the Admin role id `30000000-0000-0000-0000-000000000001`; `security definer`, executable by `authenticated` only). Policies of this table do not use it; they call `(select public.has_permission('<table>', '<action>'))`, which needs `0004_app_permissions.sql` (T3C-B0 phase 2: Super Admin role id `30000000-0000-0000-0000-000000000003`, `public.app_permissions`, `public.has_permission`). If `0004_app_permissions.sql` is missing, **stop and report**. The User role id is `30000000-0000-0000-0000-000000000002`.
3. Table pattern in `0001_init.sql`: `id uuid primary key default gen_random_uuid()`, `alter table ... enable row level security`, `revoke all on public.<t> from anon, authenticated`, then explicit `grant ... to authenticated`, then policies.
4. `supabase/seed.sql` is 58 lines (it also seeds a Super Admin user, T3C-B0 phase 2). Lines 1-3 are the header:
   `-- Local development seed. Test users only. NEVER run against a hosted project.`
   `-- Passwords: admin@example.com / admin-password-123 , user@example.com / user-password-123 ,`
   `-- superadmin@example.com / superadmin-password-123`
   The last line (58) is `  ('11111111-1111-1111-1111-111111111111', 'Admin-only reminder', false);`. It runs only on `pnpm db:reset`.
5. `supabase/tests/database/` holds `rls.test.sql`, `seed.test.sql`, `todo_stats.test.sql`. `seed.test.sql` line 4 is `select plan(4);` and line 34 is `select * from finish();`. `rls.test.sql` already asserts "every public table has RLS enabled", so the new table is covered by that check automatically.
6. `src/types/db.ts` contains the line `export type Todo = Tables<'todos'>` (T3C-B0 phase 3 adds `Profile` and `UserRow` below it).
7. `src/App.tsx` (after T3C-B0 phase 3; line numbers shift, so use the find strings): the icon import is `import { DashboardOutlined, CheckSquareOutlined, TeamOutlined } from '@ant-design/icons'`; line 18 `import { TodoShow } from '@/pages/todos/TodoShow'`; the `todos` resource is the last entry of `resources` (lines 26-33); the `todos` routes are lines 66-71.
8. `src/pages/` has `dashboard` and `todos` only. `src/types/database.types.ts` has no `companies` yet (0 matches). It is generated; never hand-edit it.
9. `.prettierrc.json`: no semicolons, single quotes, trailing commas, width 100. `src/types/database.types.ts` is in `.prettierignore`.
10. `README.md` Layout block: line 55 `migrations/0001_init.sql ...`, line 56 `migrations/0002_todo_stats.sql`, then the lines `migrations/0003_roles.sql ...`, `migrations/0004_app_permissions.sql ...` and `migrations/0005_user_admin.sql ...` added by T3C-B0, the line `seed.sql                     local test users and todos`, and the line `pages/dashboard, pages/todos, pages/users` (line numbers shift; use the find strings).

## Decisions already made (do not reopen)

- **Columns are exactly `id` and `name`**, as the story says. No `created_at`. `id` is `uuid default gen_random_uuid()`, like `todos`.
- **`name`**: `text not null`, `check (char_length(trim(name)) between 1 and 200)` (same shape as `todos.title`, rejects blank names), `unique`. Uniqueness is exact (case-sensitive).
- **Access (owner rule)**: a profile with the Admin role can read and write companies; a profile with the User role can only read. Implemented as four policies (select, insert, update, delete) that call `has_permission(<table>, <action>)`, plus the table's three rows in `app_permissions` (Admin and Super Admin read and write, User reads only), seeded in the same migration. `anon` gets nothing.
- **Deleting a company** that other tables point at will be blocked by those tables' foreign keys (default `no action`). Nothing to do here.
- **Seed lives in `supabase/seed.sql`** with `on conflict (name) do nothing`, which gives "run twice, no duplicates". Do not put the companies in a migration.
- **No realtime** for this table (not added to `supabase_realtime`).
- **Phase 2 (UI) is included** because the README checklist asks for a resource and pages. It is independent of phase 1: if the owner drops it, phase 1 still stands.
- **UI pages: list, create, edit.** No show page (two fields; the list already shows both).
- Ticket key is `T3C` (from the sprint sheet), so the plan, branch and commits use `T3C-B7-S8`. `AGENTS.md` still says `DT` is a placeholder; do not edit `AGENTS.md` in this work.

### Open questions (do not block)

1. `seed.sql` is local only (its header says never run it against a hosted project). The four companies are real reference data, so SIT and production will need them loaded another way (a data migration or a manual load). Decide before the first hosted deploy.
2. Should `The Tidy Team` and `the tidy team` count as duplicates? The story says "unique" only, so exact match is used.
3. The UI shows Create, Edit and Delete to every signed-in user, but non-admins will get an RLS error notification. Hiding them needs a role-aware access control provider, which the project does not have (only the Admin and User roles exist).

## Out of scope

- Any other table in the sprint sheet (clients, contacts, cleaners, and so on).
- Role model beyond the existing `user` / `admin`.
- Realtime, a show page, Playwright e2e specs, Vitest component tests.
- Loading data into SIT or production.
- Editing `AGENTS.md`.

## Steps

Working directory for every command: the repo root (`dispatch-tracker`).

### Step 0. Branch and baseline

```bash
git status --short && git switch -c feat/T3C-B7-S8-Companies-Table && pnpm db:start
```

**Gate:** `git branch --show-current`
**Expect:** `feat/T3C-B7-S8-Companies-Table`. If `git status --short` printed anything before the switch, stop and report.

### Phase 1: database

#### Step 1. Migration (create file)

Create `supabase/migrations/0006_companies.sql` with exactly this content:

```sql
-- 0006_companies: the companies (brands) we operate under. Shared reference data.

create table public.companies (
  id   uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 200),
  constraint companies_name_key unique (name)
);

-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.companies enable row level security;

revoke all on public.companies from anon, authenticated;
grant select, insert, update, delete on public.companies to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy companies_select
  on public.companies for select to authenticated
  using ((select public.has_permission('companies', 'read')));

create policy companies_insert
  on public.companies for insert to authenticated
  with check ((select public.has_permission('companies', 'create')));

create policy companies_update
  on public.companies for update to authenticated
  using ((select public.has_permission('companies', 'update')))
  with check ((select public.has_permission('companies', 'update')));

create policy companies_delete
  on public.companies for delete to authenticated
  using ((select public.has_permission('companies', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'companies', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'companies', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'companies', true, true,  true,  true);
```

#### Step 2. Seed (edit `supabase/seed.sql`)

Edit A. Find (line 1):

```sql
-- Local development seed. Test users only. NEVER run against a hosted project.
```

Replace with:

```sql
-- Local development seed. Test users and reference data (companies). NEVER run against a hosted project.
```

Edit B. Append to the end of the file, after the line `  ('11111111-1111-1111-1111-111111111111', 'Admin-only reminder', false);`, a blank line and this block:

```sql

-- Reference data: the companies we operate under. Safe to run more than once.
insert into public.companies (name) values
  ('The Tidy Team'),
  ('Total Home Care'),
  ('Maids in Pink'),
  ('Diamond MIP')
on conflict (name) do nothing;
```

**Gate:** `pnpm db:reset`
**Expect:** exits 0 with no SQL error, the migrations list ends with `0006_companies.sql`, and the seed runs. Then `grep -c "companies" src/types/database.types.ts` prints a number greater than `0` (types were regenerated).

#### Step 3. pgTAP: new test file (create)

Create `supabase/tests/database/companies.test.sql` with exactly this content:

```sql
-- pgTAP: companies table. RLS, admin-only writes, name constraints.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Fixed test identities. The whole file runs in one transaction and rolls back.
-- Alice is a normal user. Carol is promoted to admin below.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-1111-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'co-alice@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('cccccccc-1111-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'co-carol@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'cccccccc-1111-0000-0000-00000000000c';

-- A row to read and to try to change (inserted as the table owner, bypassing RLS).
insert into public.companies (name) values ('Test Co A');

-- 1: RLS is on.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.companies'::regclass),
  'companies has RLS enabled'
);

-- 2: anon is denied.
set local role anon;
select throws_ok(
  'select count(*) from public.companies',
  '42501',
  null,
  'anon is denied select on companies'
);
reset role;

-- Act as Alice (normal user).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-1111-0000-0000-00000000000a', true);

-- 3: a normal user can read companies.
select is(
  (select count(*) from public.companies where name = 'Test Co A'),
  1::bigint,
  'a normal user can read companies'
);

-- 4: a normal user cannot insert.
select throws_ok(
  $$insert into public.companies (name) values ('Sneaky Co')$$,
  '42501',
  null,
  'a normal user cannot insert a company'
);

-- 5-6: update and delete match no rows for a normal user (RLS filters them), no error.
select lives_ok(
  $$update public.companies set name = 'Hijacked' where name = 'Test Co A'$$,
  'a normal user update is silently filtered by RLS'
);
select lives_ok(
  $$delete from public.companies where name = 'Test Co A'$$,
  'a normal user delete is silently filtered by RLS'
);
reset role;

-- 7: the row is untouched (checked as owner).
select is(
  (select count(*) from public.companies where name = 'Test Co A'),
  1::bigint,
  'Test Co A is unchanged after the normal user update and delete attempts'
);

-- 8-10: name constraints (as owner).
select throws_ok(
  $$insert into public.companies (name) values ('Test Co A')$$,
  '23505',
  null,
  'name must be unique'
);
select throws_ok(
  $$insert into public.companies (name) values (null)$$,
  '23502',
  null,
  'name is required'
);
select throws_ok(
  $$insert into public.companies (name) values ('   ')$$,
  '23514',
  null,
  'name cannot be blank'
);

-- Act as Carol (admin).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-1111-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-1111-0000-0000-00000000000c', true);

-- 11: an admin can insert.
select lives_ok(
  $$insert into public.companies (name) values ('Test Co B')$$,
  'an admin can insert a company'
);

-- 12-13: an admin can update.
select lives_ok(
  $$update public.companies set name = 'Test Co C' where name = 'Test Co B'$$,
  'an admin can update a company'
);
select is(
  (select count(*) from public.companies where name = 'Test Co C'),
  1::bigint,
  'the admin update took effect'
);

-- 14-15: an admin can delete.
select lives_ok(
  $$delete from public.companies where name = 'Test Co C'$$,
  'an admin can delete a company'
);
select is(
  (select count(*) from public.companies where name in ('Test Co B', 'Test Co C')),
  0::bigint,
  'the admin delete took effect'
);
reset role;

select * from finish();
rollback;
```

#### Step 4. pgTAP: extend the seed test (edit `supabase/tests/database/seed.test.sql`)

Edit A. Find: `select plan(4);` Replace with: `select plan(6);`

Edit B. Find (the last line):

```sql
select * from finish();
```

Replace with:

```sql
select set_eq(
  $$select name from public.companies$$,
  $$values ('The Tidy Team'), ('Total Home Care'), ('Maids in Pink'), ('Diamond MIP')$$,
  'seed creates exactly the four companies'
);

-- Re-run the seed insert: it must not create duplicates.
insert into public.companies (name) values
  ('The Tidy Team'),
  ('Total Home Care'),
  ('Maids in Pink'),
  ('Diamond MIP')
on conflict (name) do nothing;

select is(
  (select count(*) from public.companies),
  4::bigint,
  'seeding twice creates no duplicate companies'
);

select * from finish();
```

**Gate:** `pnpm test:db`
**Expect:** every file reports `ok` and the summary ends with `Result: PASS` (files: `companies.test.sql`, `rls.test.sql`, `seed.test.sql`, `todo_stats.test.sql`; `companies.test.sql` runs 15 tests, `seed.test.sql` runs 6). If `seed.test.sql` fails on the company count, `db:reset` was not run after Step 2: run `pnpm db:reset` and repeat, and if it still fails, stop and report.

### Phase 2: web

#### Step 5. Type alias (edit `src/types/db.ts`)

Find: `export type Todo = Tables<'todos'>`
Replace with:

```ts
export type Todo = Tables<'todos'>
export type Company = Tables<'companies'>
```

#### Step 6. Pages (create three files)

Create `src/pages/companies/CompanyList.tsx`:

```tsx
import { DeleteButton, EditButton, List, useTable } from '@refinedev/antd'
import { Space, Table } from 'antd'
import type { Company } from '@/types/db'

export function CompanyList() {
  const { tableProps } = useTable<Company>({
    syncWithLocation: true,
    sorters: { initial: [{ field: 'name', order: 'asc' }] },
  })

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column<Company> dataIndex="name" title="Name" sorter />
        <Table.Column<Company>
          title="Actions"
          render={(_, record) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  )
}
```

Create `src/pages/companies/CompanyCreate.tsx`:

```tsx
import { Create, useForm } from '@refinedev/antd'
import { Form, Input } from 'antd'
import type { TablesInsert } from '@/types/db'

export function CompanyCreate() {
  const { formProps, saveButtonProps } = useForm<TablesInsert<'companies'>>({ action: 'create' })

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, whitespace: true, message: 'Name is required' },
            { max: 200, message: 'Keep it under 200 characters' },
          ]}
        >
          <Input placeholder="Company name" autoFocus />
        </Form.Item>
      </Form>
    </Create>
  )
}
```

Create `src/pages/companies/CompanyEdit.tsx`:

```tsx
import type { HttpError } from '@refinedev/core'
import { Edit, useForm } from '@refinedev/antd'
import { Form, Input } from 'antd'
import type { Company, TablesUpdate } from '@/types/db'

export function CompanyEdit() {
  const { formProps, saveButtonProps, query } = useForm<
    Company,
    HttpError,
    TablesUpdate<'companies'>
  >({ action: 'edit' })
  const isLoading = query?.isLoading ?? false

  return (
    <Edit saveButtonProps={saveButtonProps} isLoading={isLoading}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, whitespace: true, message: 'Name is required' },
            { max: 200, message: 'Keep it under 200 characters' },
          ]}
        >
          <Input />
        </Form.Item>
      </Form>
    </Edit>
  )
}
```

#### Step 7. Wire the resource (edit `src/App.tsx`)

Edit A. Find:

```tsx
import { DashboardOutlined, CheckSquareOutlined, TeamOutlined } from '@ant-design/icons'
```

Replace with:

```tsx
import {
  DashboardOutlined,
  CheckSquareOutlined,
  TeamOutlined,
  ShopOutlined,
} from '@ant-design/icons'
```

Edit B. Find:

```tsx
import { TodoShow } from '@/pages/todos/TodoShow'
```

Replace with:

```tsx
import { TodoShow } from '@/pages/todos/TodoShow'
import { CompanyList } from '@/pages/companies/CompanyList'
import { CompanyCreate } from '@/pages/companies/CompanyCreate'
import { CompanyEdit } from '@/pages/companies/CompanyEdit'
```

Edit C. Find:

```tsx
    meta: { label: 'Users', icon: <TeamOutlined /> },
  },
]
```

Replace with:

```tsx
    meta: { label: 'Users', icon: <TeamOutlined /> },
  },
  {
    name: 'companies',
    list: '/companies',
    create: '/companies/create',
    edit: '/companies/edit/:id',
    meta: { label: 'Companies', icon: <ShopOutlined /> },
  },
]
```

Edit D. Find:

```tsx
              <Route path="show/:id" element={<TodoShow />} />
            </Route>
```

Replace with:

```tsx
              <Route path="show/:id" element={<TodoShow />} />
            </Route>
            <Route path="/companies">
              <Route index element={<CompanyList />} />
              <Route path="create" element={<CompanyCreate />} />
              <Route path="edit/:id" element={<CompanyEdit />} />
            </Route>
```

**Gate:** `pnpm lint && pnpm typecheck`
**Expect:** both exit 0 with no errors or warnings. A type error on `'companies'` means `database.types.ts` was not regenerated: run `pnpm db:types` and repeat; if it persists, stop and report.

#### Step 8. README (edit `README.md`)

Edit A. Find: `  migrations/0005_user_admin.sql  is_super_admin(), admin_update_profile()`
Replace with:

```
  migrations/0005_user_admin.sql  is_super_admin(), admin_update_profile()
  migrations/0006_companies.sql  companies (brands), role-based RLS
```

Edit B. Find: `  seed.sql                     local test users and todos`
Replace with: `  seed.sql                     local test users, todos and the four companies`

Edit C. Find: `  pages/dashboard, pages/todos, pages/users`
Replace with: `  pages/dashboard, pages/todos, pages/users, pages/companies`

**Gate:** `pnpm exec prettier --check README.md .claude/plans/T3C-B7-S8-Companies-Table.md src/App.tsx src/types/db.ts src/pages/companies`
**Expect:** `All matched files use Prettier code style!` If it lists a file, run `pnpm exec prettier --write` on **only that file**, then repeat.

### Step 9. Full gate

```bash
pnpm test:all
```

**Expect:** lint, typecheck, vitest, pgTAP, Deno and Playwright all pass, exit 0. Then `git status --short` lists only: the plan file, `supabase/migrations/0006_companies.sql`, `supabase/seed.sql`, `supabase/tests/database/companies.test.sql`, `supabase/tests/database/seed.test.sql`, `src/types/database.types.ts`, `src/types/db.ts`, `src/App.tsx`, `src/pages/companies/` (3 files), `README.md`. Anything else: stop and report.

## Rollback

Nothing is applied outside the local Docker database, so:

- Before commit: `git switch main && git branch -D feat/T3C-B7-S8-Companies-Table`, then `pnpm db:reset` (rebuilds the local DB without `0006`).
- After commit, before merge: delete the branch and reset as above.
- After merge, if a hosted DB already has `0006`: add a new migration `0007_drop_companies.sql` with `drop table public.companies;`. Never edit or delete an applied migration. (Stop and ask first if clients or other tables already reference `companies`.)

## Conventional commits

Branch: `feat/T3C-B7-S8-Companies-Table` (from `main`). Stage explicit paths only. Each commit leaves the suites green. Every commit ends with:

```
Refs: T3C-B7, T3C-S8

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

(Use `Refs: T3C-B7` alone on commit 1, `Refs: T3C-S8` alone on commit 2.)

1. `feat(db): add companies table with role-based RLS`
   Files: `supabase/migrations/0006_companies.sql`, `src/types/database.types.ts`
   Body: shared reference data; everyone signed in reads, only admins write.
2. `feat(db): seed the four companies`
   Files: `supabase/seed.sql`
3. `test(db): cover companies RLS, constraints and seed`
   Files: `supabase/tests/database/companies.test.sql`, `supabase/tests/database/seed.test.sql`
4. `feat(web): add companies list, create and edit pages`
   Files: `src/types/db.ts`, `src/pages/companies/CompanyList.tsx`, `src/pages/companies/CompanyCreate.tsx`, `src/pages/companies/CompanyEdit.tsx`, `src/App.tsx`
5. `docs: add companies to the README layout`
   Files: `README.md`
6. `docs(plans): add companies table plan`
   Files: `.claude/plans/T3C-B7-S8-Companies-Table.md`

PR title: `feat(db): add companies table and seed` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
