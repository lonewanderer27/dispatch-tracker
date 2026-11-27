# T3C-B6 Add the clients table

> **Status: PENDING REVIEW.** Not approved for implementation until the owner removes this line.
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

Source: sprint sheet `The Tidy Team - Digital Platforms Sprint - Sprint 2_ Nov-23-27-2026'.csv`.

- T3C-B6: "As a dispatcher, I want clients stored against the company they book with, so that I can see whose customer they are." Acceptance: table `clients` with columns `id`, `company_id`, `name`; `company_id` is a required foreign key to `companies.id`; `name` is required text; one company can have many clients.

Clients are the parent of contacts, properties, preferred cleaners and jobs.

Also in scope (UI, added 2026-11-27): a user-facing **Clients** sidebar item, so that Admins can create, edit and delete clients. Steps 4 to 6 specify it.

## Facts (verified 2026-11-27)

1. Branch is `main` at the start. This plan creates `feat/T3C-B5-B6-Clients-Contacts` from `main`, and T3C-B5 is implemented on the same branch. Migrations are numbered `NNNN_name.sql`. This plan adds `supabase/migrations/0007_clients.sql`, so migrations up to `0006` must already exist. Plans are applied in migration order: roles is `0003`, app_permissions is `0004` and user admin is `0005` (T3C-B0), companies is `0006` (`.claude/plans/T3C-B7-S8-Companies-Table.md`).
2. Required earlier migrations (plan that creates each): `0003_roles.sql` and `0004_app_permissions.sql` (T3C-B0); `0006_companies.sql` (T3C-B7-S8). If any is missing, **stop and report**.
3. Table `public.clients` does not exist yet, and `src/types/database.types.ts` has no `clients` entry. That file is generated; never hand-edit it.
4. Roles come from T3C-B0 (`.claude/plans/T3C-B0-Users-Table.md`): `supabase/migrations/0003_roles.sql` creates `public.roles` (Admin id `30000000-0000-0000-0000-000000000001`, User id `30000000-0000-0000-0000-000000000002`) and replaces `profiles.role` with `profiles.role_id`. `public.is_admin()` is true when the caller's profile has the Admin role id. Policies of this table do not use it; they call `(select public.has_permission('<table>', '<action>'))`, which needs `0004_app_permissions.sql` (T3C-B0 phase 2: Super Admin role id `30000000-0000-0000-0000-000000000003`, `public.app_permissions`, `public.has_permission`). If `0004_app_permissions.sql` is missing, **stop and report**. If `0003_roles.sql` is missing, **stop and report**.
5. Table pattern (`0001_init.sql`): `id uuid primary key default gen_random_uuid()`, `enable row level security`, `revoke all ... from anon, authenticated`, explicit `grant ... to authenticated`, then policies.
6. `supabase/tests/database/` holds `rls.test.sql`, `seed.test.sql`, `todo_stats.test.sql` (and `roles.test.sql` and `companies.test.sql` once T3C-B0 and T3C-B7-S8 are implemented). `rls.test.sql` already asserts that every public table has RLS enabled.
7. The web app is Refine (`src/App.tsx`): a `resources` array of `ResourceProps`, and one `<Route path="/companies">` block per resource. The companies pages (`src/pages/companies/CompanyList.tsx`, `CompanyCreate.tsx`, `CompanyEdit.tsx`, from T3C-B7-S8) are the pattern for the clients pages.
8. `src/features/users/roles.ts` holds the fixed role ids (`USER_ROLE_ID`, `SUPER_ADMIN_ROLE_ID`) and `isSuperAdmin`. `src/providers/accessControlProvider.ts` shapes the UI with `const SUPER_ADMIN_ONLY = new Set(['profiles'])`. The database enforces the real rules; the UI only hides what a role may not do.
9. `src/types/db.ts` is hand-written. It exports `Tables`, `TablesInsert`, `TablesUpdate` and the `Company` alias, all built on the generated `database.types.ts`.
10. In `src/App.tsx` the icon import ends with the line `  ShopOutlined,` followed by `} from '@ant-design/icons'`. The companies routes end with `              <Route path="edit/:id" element={<CompanyEdit />} />` followed by `            </Route>`.

## Decisions already made (do not reopen)

- `company_id` references `companies.id` with the default `no action` (a company that has clients cannot be deleted).
- `name` is not unique (two clients may share a name).
- **Access (owner rule)**: a profile with the **Admin** role can read and write this table; a profile with the **User** role can only read it. Implemented as four policies (select, insert, update, delete) that call `has_permission(<table>, <action>)`, plus the table's three rows in `app_permissions` (Admin and Super Admin read and write, User reads only), seeded in the same migration. `anon` gets nothing. There is no per-user ownership on this data, so there is no user-isolation test.
- **Columns are exactly those in the story**, in the story order. No `created_at` unless the story lists it.
- **Required text columns** are `not null` and also reject blank or whitespace-only values (`char_length(trim(col)) > 0`).
- **UI included.** A `Clients` sidebar item (resource `clients`) with list, create and edit pages in `src/pages/clients/`, following the companies pattern. The create and edit forms pick the company from a select on `companies`. Delete asks for confirmation, and the confirmation says that the client's contacts (T3C-B5) are deleted too.
- **Admin-only changes in the UI.** `accessControlProvider` lists `clients` in `ADMIN_WRITE_ONLY`: every signed-in user can list and show, and only an Admin or Super Admin gets create, edit and delete. Refine disables those buttons for a User. The database policies above remain the enforcement.

### Open questions (do not block)

1. Should a client name be unique within a company?
2. Answered: pages were added for this table (see Decisions).

## Out of scope

- Every other table or story in the sprint sheet.
- Playwright e2e specs. They are in T3C-B5, which covers both tables.
- Vitest tests beyond the access provider cases in Step 4.
- Pages for any other table.
- The role model beyond Admin, User and Super Admin.
- Loading data into SIT or production.
- `README.md` and `AGENTS.md` edits.

## Steps

Working directory for every command: the repo root (`dispatch-tracker`).

### Step 0. Branch and baseline

```bash
git status --short && git switch -c feat/T3C-B5-B6-Clients-Contacts && pnpm db:start
```

**Gate:** `git branch --show-current && ls supabase/migrations`
**Expect:** `feat/T3C-B5-B6-Clients-Contacts`, then a migration list that ends at `0006_companies.sql` (the file just before this plan's `0007`). If `git status --short` printed anything before the switch, or the list is different, stop and report.

### Step 1. Migration (create file)

Create `supabase/migrations/0007_clients.sql` with exactly this content:

```sql
-- 0007_clients: clients, each booked against one company.

create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name       text not null check (char_length(trim(name)) > 0)
);

create index clients_company_id_idx on public.clients (company_id);


-- RLS on, deny by default. Anon gets nothing; authenticated gets what is granted below.
alter table public.clients enable row level security;

revoke all on public.clients from anon, authenticated;
grant select, insert, update, delete on public.clients to authenticated;

-- Access comes from app_permissions (T3C-B0 phase 2): one policy per action.
create policy clients_select
  on public.clients for select to authenticated
  using ((select public.has_permission('clients', 'read')));

create policy clients_insert
  on public.clients for insert to authenticated
  with check ((select public.has_permission('clients', 'create')));

create policy clients_update
  on public.clients for update to authenticated
  using ((select public.has_permission('clients', 'update')))
  with check ((select public.has_permission('clients', 'update')));

create policy clients_delete
  on public.clients for delete to authenticated
  using ((select public.has_permission('clients', 'delete')));

-- Permission matrix for this table: Admin and Super Admin read and write, User reads only.
insert into public.app_permissions (role_id, resource, "read", "create", "update", "delete") values
  ('30000000-0000-0000-0000-000000000001', 'clients', true, true,  true,  true),
  ('30000000-0000-0000-0000-000000000002', 'clients', true, false, false, false),
  ('30000000-0000-0000-0000-000000000003', 'clients', true, true,  true,  true);
```

### Step 2. pgTAP test (create file)

Create `supabase/tests/database/clients.test.sql` with exactly this content:

```sql
-- pgTAP: clients. RLS, access, constraints.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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

select ok(
  (select relrowsecurity from pg_class where oid = 'public.clients'::regclass),
  'clients has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.clients$$,
  '42501',
  null,
  'anon is denied select on clients'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.clients (company_id, name) values ('c0000000-0000-0000-0000-000000000001', 'Alice Client')$$,
  'an Admin can insert into clients'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.clients) >= 1,
  'a User can read clients'
);

select throws_ok(
  $$insert into public.clients (company_id, name) values ('c0000000-0000-0000-0000-000000000001', 'Alice Client')$$,
  '42501',
  null,
  'a User cannot insert into clients'
);

select lives_ok(
  $$update public.clients set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.clients$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.clients) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select throws_ok(
  $$insert into public.clients (company_id, name) values (null, 'No Company')$$,
  '23502',
  null,
  'company_id is required'
);

select throws_ok(
  $$insert into public.clients (company_id, name) values ('99999999-9999-9999-9999-999999999999', 'Orphan')$$,
  '23503',
  null,
  'company_id must exist in companies'
);

select throws_ok(
  $$insert into public.clients (company_id, name) values ('c0000000-0000-0000-0000-000000000001', null)$$,
  '23502',
  null,
  'name is required'
);

select throws_ok(
  $$insert into public.clients (company_id, name) values ('c0000000-0000-0000-0000-000000000001', '   ')$$,
  '23514',
  null,
  'name cannot be blank'
);

select lives_ok(
  $$insert into public.clients (company_id, name) values ('c0000000-0000-0000-0000-000000000001', 'Second Client')$$,
  'one company can have many clients'
);

select * from finish();
rollback;
```

### Step 3. Gate

```bash
pnpm db:reset && grep -c "clients" src/types/database.types.ts
```

**Expect:** `db:reset` exits 0 with no SQL error and applies `0007_clients.sql`; the `grep` prints a number greater than `0`.

```bash
pnpm test:db
```

**Expect:** every file reports `ok`, the summary ends with `Result: PASS`, and `clients.test.sql` runs 13 tests. If a test fails, stop and report; do not edit the test or the migration to make it pass.

```bash
pnpm typecheck && pnpm lint
```

**Expect:** both exit 0.

```bash
git status --short
```

**Expect:** only `supabase/migrations/0007_clients.sql`, `supabase/tests/database/clients.test.sql`, `src/types/database.types.ts` and this plan file. Anything else: stop and report. (The web files come in Steps 4 to 6, so this check covers the database part only.)

### Step 4. Access rule and types

Create `src/features/users/roles.ts` with exactly this content:

```ts
// Fixed role ids, created in supabase/migrations/0003_roles.sql and 0004_app_permissions.sql.
export const ADMIN_ROLE_ID = '30000000-0000-0000-0000-000000000001'
export const USER_ROLE_ID = '30000000-0000-0000-0000-000000000002'
export const SUPER_ADMIN_ROLE_ID = '30000000-0000-0000-0000-000000000003'

export function isSuperAdmin(roleId: string | undefined): boolean {
  return roleId === SUPER_ADMIN_ROLE_ID
}

// Admin and Super Admin may change dispatch data (clients, contacts). A User only reads it.
export function canChangeDispatchData(roleId: string | undefined): boolean {
  return roleId === ADMIN_ROLE_ID || isSuperAdmin(roleId)
}
```

Edit `src/types/db.ts`. Find the line `export type Company = Tables<'companies'>` and replace it with:

```ts
export type Company = Tables<'companies'>
export type Client = Tables<'clients'>
export type ClientRow = Client & { companies: { name: string } | null }
```

Create `src/providers/accessControlProvider.ts` with exactly this content:

```ts
import type { AccessControlProvider } from '@refinedev/core'
import { canChangeDispatchData, isSuperAdmin } from '@/features/users/roles'
import { authProvider } from '@/providers/authProvider'

// Resource names only a Super Admin may open. This only shapes the UI (hides the menu item and
// redirects); the database enforces the rule (see admin_update_profile in 0005_user_admin.sql).
const SUPER_ADMIN_ONLY = new Set(['profiles'])

// Resources every signed-in user may read but only an Admin or Super Admin may change. The
// database enforces this through app_permissions; this only hides the create, edit and delete UI.
const ADMIN_WRITE_ONLY = new Set(['clients'])
const READ_ACTIONS = new Set(['list', 'show'])

export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }) => {
    if (!resource) return { can: true }

    if (SUPER_ADMIN_ONLY.has(resource)) {
      const identity = await authProvider.getIdentity()
      if (identity && isSuperAdmin(identity.roleId)) return { can: true }
      return { can: false, reason: 'Only a Super Admin can manage users' }
    }

    if (ADMIN_WRITE_ONLY.has(resource) && !READ_ACTIONS.has(action)) {
      const identity = await authProvider.getIdentity()
      if (identity && canChangeDispatchData(identity.roleId)) return { can: true }
      return { can: false, reason: 'Only an Admin can change clients and contacts' }
    }

    return { can: true }
  },
}
```

Create `src/providers/accessControlProvider.test.ts` with exactly this content:

```ts
import { describe, expect, it, vi } from 'vitest'
import { ADMIN_ROLE_ID, SUPER_ADMIN_ROLE_ID, USER_ROLE_ID } from '@/features/users/roles'

const getIdentity = vi.fn<() => Promise<{ id: string; roleId: string } | null>>()

vi.mock('@/providers/authProvider', () => ({
  authProvider: { getIdentity: () => getIdentity() },
}))

// Imported after the mock is registered.
const { accessControlProvider } = await import('@/providers/accessControlProvider')

describe('accessControlProvider', () => {
  it('allows resources that are not restricted without asking who the user is', async () => {
    const res = await accessControlProvider.can({ resource: 'todos', action: 'list' })
    expect(res).toEqual({ can: true })
    expect(getIdentity).not.toHaveBeenCalled()
  })

  it('allows a Super Admin to open the users resource', async () => {
    getIdentity.mockResolvedValue({ id: 'u1', roleId: SUPER_ADMIN_ROLE_ID })
    const res = await accessControlProvider.can({ resource: 'profiles', action: 'list' })
    expect(res).toEqual({ can: true })
  })

  it('denies a User and a signed-out visitor', async () => {
    getIdentity.mockResolvedValue({ id: 'u2', roleId: USER_ROLE_ID })
    const asUser = await accessControlProvider.can({ resource: 'profiles', action: 'list' })
    expect(asUser.can).toBe(false)
    getIdentity.mockResolvedValue(null)
    const signedOut = await accessControlProvider.can({ resource: 'profiles', action: 'list' })
    expect(signedOut.can).toBe(false)
  })

  it('lets a User read clients without asking who they are', async () => {
    getIdentity.mockClear()
    const res = await accessControlProvider.can({ resource: 'clients', action: 'list' })
    expect(res).toEqual({ can: true })
    expect(getIdentity).not.toHaveBeenCalled()
  })

  it('lets an Admin change clients', async () => {
    getIdentity.mockResolvedValue({ id: 'u3', roleId: ADMIN_ROLE_ID })
    for (const action of ['create', 'edit', 'delete']) {
      expect(await accessControlProvider.can({ resource: 'clients', action })).toEqual({
        can: true,
      })
    }
  })

  it('denies a User changing clients', async () => {
    getIdentity.mockResolvedValue({ id: 'u2', roleId: USER_ROLE_ID })
    for (const action of ['create', 'edit', 'delete']) {
      const res = await accessControlProvider.can({ resource: 'clients', action })
      expect(res.can).toBe(false)
    }
  })
})
```

**Gate:**

```bash
pnpm test
```

**Expect:** exits 0 and reports no failed tests.

### Step 5. Clients pages and sidebar item

Create `src/pages/clients/ClientList.tsx` with exactly this content:

```tsx
import { DeleteButton, EditButton, List, useTable } from '@refinedev/antd'
import { Space, Table } from 'antd'
import type { ClientRow } from '@/types/db'

export function ClientList() {
  const { tableProps } = useTable<ClientRow>({
    syncWithLocation: true,
    meta: { select: '*, companies(name)' },
    sorters: { initial: [{ field: 'name', order: 'asc' }] },
  })

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column<ClientRow> dataIndex="name" title="Name" sorter />
        <Table.Column<ClientRow>
          title="Company"
          render={(_, record) => record.companies?.name ?? 'Unknown'}
        />
        <Table.Column<ClientRow>
          title="Actions"
          render={(_, record) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton
                hideText
                size="small"
                recordItemId={record.id}
                confirmTitle="Delete this client? Its contacts are deleted too."
              />
            </Space>
          )}
        />
      </Table>
    </List>
  )
}
```

Create `src/pages/clients/ClientCreate.tsx` with exactly this content:

```tsx
import { Create, useForm, useSelect } from '@refinedev/antd'
import { Form, Input, Select } from 'antd'
import type { Company, TablesInsert } from '@/types/db'

export function ClientCreate() {
  const { formProps, saveButtonProps } = useForm<TablesInsert<'clients'>>({ action: 'create' })
  const { selectProps } = useSelect<Company>({
    resource: 'companies',
    optionLabel: 'name',
    optionValue: 'id',
  })

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Company"
          name="company_id"
          rules={[{ required: true, message: 'Choose the company this client books with' }]}
        >
          <Select {...selectProps} placeholder="Company" />
        </Form.Item>
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, whitespace: true, message: 'Name is required' },
            { max: 200, message: 'Keep it under 200 characters' },
          ]}
        >
          <Input placeholder="Client name" autoFocus />
        </Form.Item>
      </Form>
    </Create>
  )
}
```

Create `src/pages/clients/ClientEdit.tsx` with exactly this content:

```tsx
import type { HttpError } from '@refinedev/core'
import { Edit, useForm, useSelect } from '@refinedev/antd'
import { Form, Input, Select } from 'antd'
import type { Client, Company, TablesUpdate } from '@/types/db'

export function ClientEdit() {
  const { formProps, saveButtonProps, query } = useForm<
    Client,
    HttpError,
    TablesUpdate<'clients'>
  >({ action: 'edit' })
  const { selectProps } = useSelect<Company>({
    resource: 'companies',
    optionLabel: 'name',
    optionValue: 'id',
  })
  const isLoading = query?.isLoading ?? false

  return (
    <Edit saveButtonProps={saveButtonProps} isLoading={isLoading}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Company"
          name="company_id"
          rules={[{ required: true, message: 'Choose the company this client books with' }]}
        >
          <Select {...selectProps} placeholder="Company" />
        </Form.Item>
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

Edit `src/App.tsx` in four places:

1. Find `  ShopOutlined,\n} from '@ant-design/icons'` (two lines) and replace with `  ShopOutlined,\n  SolutionOutlined,\n} from '@ant-design/icons'`.
2. Find `import { CompanyEdit } from '@/pages/companies/CompanyEdit'` and add these lines after it:

```ts
import { ClientList } from '@/pages/clients/ClientList'
import { ClientCreate } from '@/pages/clients/ClientCreate'
import { ClientEdit } from '@/pages/clients/ClientEdit'
```

3. Find `    meta: { label: 'Companies', icon: <ShopOutlined /> },\n  },\n]` and replace it with the same text, but with this entry added before the `]`:

```ts
  {
    name: 'clients',
    list: '/clients',
    create: '/clients/create',
    edit: '/clients/edit/:id',
    meta: { label: 'Clients', icon: <SolutionOutlined /> },
  },
```

4. Find `              <Route path="edit/:id" element={<CompanyEdit />} />\n            </Route>` and add after the `</Route>`:

```tsx
            <Route path="/clients">
              <Route index element={<ClientList />} />
              <Route path="create" element={<ClientCreate />} />
              <Route path="edit/:id" element={<ClientEdit />} />
            </Route>
```

Edit `README.md` in two places:

1. Find `  migrations/0006_companies.sql  companies (brands), role-based RLS` and add this line after it: `  migrations/0007_clients.sql  clients (each booked against a company), role-based RLS`
2. Find `  pages/dashboard, pages/todos, pages/users, pages/companies` and replace it with `  pages/dashboard, pages/todos, pages/users, pages/companies, pages/clients`

### Step 6. Web gate

```bash
pnpm typecheck && pnpm lint && pnpm test
```

**Expect:** all three exit 0.

```bash
npx prettier --write src/features/users/roles.ts src/types/db.ts src/providers/accessControlProvider.ts src/providers/accessControlProvider.test.ts src/pages/clients src/App.tsx README.md
```

**Expect:** the listed files are formatted (formatting only; no other file is touched).

```bash
git status --short
```

**Expect:** the DB files from Step 3, and the web files `src/features/users/roles.ts`, `src/providers/accessControlProvider.ts`, `src/providers/accessControlProvider.test.ts`, `src/types/db.ts`, `src/App.tsx`, `README.md`, `src/pages/clients/` and this plan file. Anything else: stop and report.

## Rollback

- Before commit: revert this plan's files only: `supabase/migrations/0007_clients.sql`, `supabase/tests/database/clients.test.sql`, the clients part of `src/types/database.types.ts`, `src/features/users/roles.ts`, `src/providers/accessControlProvider.ts`, `src/providers/accessControlProvider.test.ts`, `src/types/db.ts`, the clients lines in `src/App.tsx` and `README.md`, and the folder `src/pages/clients/`. Then run `pnpm db:types` and `pnpm db:reset`. Do not delete the branch: T3C-B5 shares it. Review any uncommitted files first; do not discard them without checking.
- After merge, if a hosted DB already has `0007_clients.sql`: add `0107_drop_clients.sql` containing `delete from public.app_permissions where resource = 'clients';` and `drop table public.clients;`. Never edit or delete an applied migration. Stop and ask first if other tables already reference `clients`.

## Conventional commits

Branch: `feat/T3C-B5-B6-Clients-Contacts` (from `main`; shared with T3C-B5, whose commits follow these). Stage explicit paths only. Each commit leaves the suites green. Every commit ends with:

```
Refs: T3C-B6

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `feat(db): add clients table with role-based RLS`
   Files: `supabase/migrations/0007_clients.sql`, `src/types/database.types.ts`
2. `test(db): cover clients constraints and access`
   Files: `supabase/tests/database/clients.test.sql`
3. `feat(web): add clients pages and admin-only changes`
   Files: `src/features/users/roles.ts`, `src/providers/accessControlProvider.ts`, `src/types/db.ts`, `src/pages/clients/ClientList.tsx`, `src/pages/clients/ClientCreate.tsx`, `src/pages/clients/ClientEdit.tsx`, `src/App.tsx`, `README.md`
4. `test(web): cover admin-only client changes`
   Files: `src/providers/accessControlProvider.test.ts`
5. `docs(plans): add T3C-B6 plan`
   Files: `.claude/plans/T3C-B6-Clients-Table.md`

PR title: `feat(db): add clients and contacts tables`, one PR for T3C-B6 and T3C-B5 (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
