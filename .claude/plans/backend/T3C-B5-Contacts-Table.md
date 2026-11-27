# T3C-B5 Add the contacts table

> **Status: PENDING REVIEW.** Not approved for implementation until the owner removes this line.
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.

## Why

Source: sprint sheet `The Tidy Team - Digital Platforms Sprint - Sprint 2_ Nov-23-27-2026'.csv`.

- T3C-B5: "As a dispatcher, I want each client to have one or more contacts with a name and phone number, so that I can reach the right person about a booking." Acceptance: table `contacts` with columns `id`, `client_id`, `first_name`, `last_name`, `contact_no`; `client_id` is a required foreign key to `clients.id`; `first_name`, `last_name`, `contact_no` are required text; one client can have many contacts; `contact_no` is stored as text exactly as entered (+, spaces and leading zeros are kept).

Also in scope (UI, added 2026-11-27): a user-facing **Contacts** sidebar item, so that Admins can create, edit and delete contacts, and one Playwright spec (`e2e/dispatch.spec.ts`) that covers the client and contact flows end to end. Steps 4 to 8 specify them.

## Facts (verified 2026-11-27)

1. Branch is `feat/T3C-B5-B6-Clients-Contacts`, shared with T3C-B6 (see Decisions). Migrations are numbered `NNNN_name.sql`. This plan adds `supabase/migrations/0008_contacts.sql`, so migrations up to `0007` must already exist. Plans are applied in migration order: roles is `0003`, app_permissions is `0004` and user admin is `0005` (T3C-B0), companies is `0006` (`.claude/plans/backend/T3C-B7-S8-Companies-Table.md`).
2. Required earlier migrations (plan that creates each): `0003_roles.sql` and `0004_app_permissions.sql` (T3C-B0); `0007_clients.sql` (T3C-B6). If any is missing, **stop and report**.
3. Table `public.contacts` does not exist yet, and `src/types/database.types.ts` has no `contacts` entry. That file is generated; never hand-edit it.
4. Roles come from T3C-B0 (`.claude/plans/backend/T3C-B0-Users-Table.md`): `supabase/migrations/0003_roles.sql` creates `public.roles` (Admin id `30000000-0000-0000-0000-000000000001`, User id `30000000-0000-0000-0000-000000000002`) and replaces `profiles.role` with `profiles.role_id`. `public.is_admin()` is true when the caller's profile has the Admin role id. Policies of this table do not use it; they call `(select public.has_permission('<table>', '<action>'))`, which needs `0004_app_permissions.sql` (T3C-B0 phase 2: Super Admin role id `30000000-0000-0000-0000-000000000003`, `public.app_permissions`, `public.has_permission`). If `0004_app_permissions.sql` is missing, **stop and report**. If `0003_roles.sql` is missing, **stop and report**.
5. Table pattern (`0001_init.sql`): `id uuid primary key default gen_random_uuid()`, `enable row level security`, `revoke all ... from anon, authenticated`, explicit `grant ... to authenticated`, then policies.
6. `supabase/tests/database/` holds `rls.test.sql`, `seed.test.sql`, `todo_stats.test.sql` (and `roles.test.sql` and `companies.test.sql` once T3C-B0 and T3C-B7-S8 are implemented). `rls.test.sql` already asserts that every public table has RLS enabled.
7. `supabase/seed.sql` is the local-only dev seed (never run against a hosted project). It already seeds users and companies. This plan adds client and contact scenarios to it (Step 1b). `seed.test.sql` asserts exactly four companies; the scenario does not change that count.
8. T3C-B6 Steps 4 to 6 must be done: `src/features/users/roles.ts`, `src/providers/accessControlProvider.ts`, `src/types/db.ts` (with `Client` and `ClientRow`) and `src/pages/clients/` exist. If any is missing, **stop and report**.
9. `src/providers/accessControlProvider.ts` contains exactly `const ADMIN_WRITE_ONLY = new Set(['clients'])` (from T3C-B6). Step 4 changes that line.
10. `supabase/seed.sql` also seeds `admin@example.com` (Admin role), `user@example.com` (User role) and `superadmin@example.com` (Super Admin). `e2e/global.setup.ts` signs in as the User and saves the session for the other specs.
11. `playwright.config.ts` starts `pnpm dev` on `127.0.0.1:5173` for the e2e run, and reuses a server that is already running.

## Decisions already made (do not reopen)

- `client_id` is `on delete cascade`: deleting a client deletes its contacts.
- `contact_no` is plain `text` with no format check and no trimming or normalising, so `+`, spaces and leading zeros are kept.
- **Access (owner rule)**: a profile with the **Admin** role can read and write this table; a profile with the **User** role can only read it. Implemented as four policies (select, insert, update, delete) that call `has_permission(<table>, <action>)`, plus the table's three rows in `app_permissions` (Admin and Super Admin read and write, User reads only), seeded in the same migration. `anon` gets nothing. There is no per-user ownership on this data, so there is no user-isolation test.
- **Columns are exactly those in the story**, in the story order. No `created_at` unless the story lists it.
- **Required text columns** are `not null` and also reject blank or whitespace-only values (`char_length(trim(col)) > 0`).
- **UI included.** A `Contacts` sidebar item (resource `contacts`) with list, create and edit pages in `src/pages/contacts/`. Create and edit pick the client from a select on `clients` and take the three required fields. Delete asks for confirmation.
- **Admin-only changes in the UI.** `ADMIN_WRITE_ONLY` now lists `contacts` too. A User sees the list with create, edit and delete disabled. The database policies remain the enforcement.
- **One e2e spec for the dispatch flow.** `e2e/dispatch.spec.ts` covers a User (both lists read-only, create disabled) and an Admin (create, edit and delete a client, and create, edit and delete a contact for it). Names are unique per run, and the spec deletes what it creates.
- **One branch with T3C-B6.** `contacts` references `clients`, so T3C-B5 and T3C-B6 are implemented on one branch, `feat/T3C-B5-B6-Clients-Contacts`, created from `main` by the T3C-B6 plan. They ship in one PR. Do not create a second branch for this plan.
- **Test scenarios live in `supabase/seed.sql`** (local dev data, not a hosted DB). Two scenarios, both under The Tidy Team:
  - `Sam Newbie`: a new client who books for themselves. One client, one contact, and the contact is the same person.
  - `Harbour Build Pty Ltd`: a recurring client that is a sub-con or parent-con company. One client, three contacts (`Priya Shah`, `Tom Reyes`, `Lee Chen`).
- **The final contacts test is scoped to the test client.** Seeded contacts exist, so "no contacts remain" is checked only for the fixture client `c1000000-0000-0000-0000-000000000001`.

### Open questions (do not block)

1. Should `contact_no` get any format validation (for example digits, spaces and a leading `+` only)? The story says store exactly as entered, so none is added.
2. Answered: pages were added for this table (see Decisions).

## Out of scope

- Every other table or story in the sprint sheet.
- Vitest component tests.
- Pages for any table other than clients and contacts.
- The role model beyond Admin, User and Super Admin.
- Loading data into SIT or production. The scenario seed is local-only.
- `AGENTS.md` edits. (`README.md` changes are in Step 6.)

## Steps

Working directory for every command: the repo root (`dispatch-tracker`).

### Step 0. Branch and baseline

**Prerequisite:** the T3C-B6 plan's Steps 0 to 3 are done on `feat/T3C-B5-B6-Clients-Contacts`, so `supabase/migrations/0007_clients.sql` and `supabase/tests/database/clients.test.sql` exist on that branch. Do not create a new branch in this plan. If they are missing, stop and report.

```bash
git branch --show-current && git status --short && pnpm db:start
```

**Gate:** `git branch --show-current && ls supabase/migrations`
**Expect:** `feat/T3C-B5-B6-Clients-Contacts`, then a migration list that ends at `0007_clients.sql` (the file just before this plan's `0008`). `git status --short` shows only files from the T3C-B6 plan; if it shows anything else, or the list is different, stop and report.

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

### Step 1b. Seed scenarios (edit file)

Edit `supabase/seed.sql`. Find the line `on conflict (name) do nothing;` (the end of the companies insert, the last statement in the file) and replace it with that same line followed by the block below. The block is idempotent (`on conflict (id) do nothing`).

Find:

```
on conflict (name) do nothing;
```

Replace with:

```
on conflict (name) do nothing;

-- Client scenarios for local testing. Safe to run more than once.
-- 1. A new client who books for themselves: one client, one contact (the same person).
-- 2. A recurring client that is a company (sub-con or parent-con) with three contacts.
insert into public.clients (id, company_id, name) values
  ('d0000000-0000-0000-0000-000000000001',
   (select id from public.companies where name = 'The Tidy Team'), 'Sam Newbie'),
  ('d0000000-0000-0000-0000-000000000002',
   (select id from public.companies where name = 'The Tidy Team'), 'Harbour Build Pty Ltd')
on conflict (id) do nothing;

insert into public.contacts (id, client_id, first_name, last_name, contact_no) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Sam', 'Newbie', '+61 400 111 222'),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'Priya', 'Shah', '+61 2 9000 1111'),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'Tom', 'Reyes', '0400 222 333'),
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'Lee', 'Chen', '+61 3 9000 2222')
on conflict (id) do nothing;
```

**Gate (run after the `pnpm db:reset` in Step 3):**

```bash
docker exec -i supabase_db_dispatch-tracker psql -U postgres -d postgres -X -At -c "select cl.name || ' | ' || count(ct.id) from public.clients cl left join public.contacts ct on ct.client_id = cl.id group by cl.name order by cl.name;"
```

**Expect:** exactly two lines: `Harbour Build Pty Ltd | 3` and `Sam Newbie | 1`. Any other output: stop and report.

### Step 2. pgTAP test (create file)

Create `supabase/tests/database/contacts.test.sql` with exactly this content, except the final `select is(...)` block, which is scoped to the test client (see Decisions):

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

-- Scoped to the test client: seeded local data also has contacts.
select is(
  (select count(*) from public.contacts where client_id = 'c1000000-0000-0000-0000-000000000001'),
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

**Expect:** only `supabase/migrations/0008_contacts.sql`, `supabase/seed.sql`, `supabase/tests/database/contacts.test.sql`, `src/types/database.types.ts` and this plan file. Anything else: stop and report. (The web and e2e files come in Steps 4 to 8, so this check covers the database part only.)

### Step 4. Contact types and admin-only changes

Edit `src/types/db.ts`. Find the line `export type ClientRow = Client & { companies: { name: string } | null }` and replace it with that line followed by:

```ts
export type Contact = Tables<'contacts'>
export type ContactRow = Contact & { clients: { name: string } | null }
```

Edit `src/providers/accessControlProvider.ts`. Find `const ADMIN_WRITE_ONLY = new Set(['clients'])` and replace it with `const ADMIN_WRITE_ONLY = new Set(['clients', 'contacts'])`.

Replace the whole file `src/providers/accessControlProvider.test.ts` with exactly this content (this overwrites the T3C-B6 version):

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

  it.each(['clients', 'contacts'])('lets a User read %s without asking who they are', async (resource) => {
    getIdentity.mockClear()
    const res = await accessControlProvider.can({ resource, action: 'list' })
    expect(res).toEqual({ can: true })
    expect(getIdentity).not.toHaveBeenCalled()
  })

  it.each(['clients', 'contacts'])('lets an Admin change %s', async (resource) => {
    getIdentity.mockResolvedValue({ id: 'u3', roleId: ADMIN_ROLE_ID })
    for (const action of ['create', 'edit', 'delete']) {
      expect(await accessControlProvider.can({ resource, action })).toEqual({ can: true })
    }
  })

  it.each(['clients', 'contacts'])('denies a User changing %s', async (resource) => {
    getIdentity.mockResolvedValue({ id: 'u2', roleId: USER_ROLE_ID })
    for (const action of ['create', 'edit', 'delete']) {
      const res = await accessControlProvider.can({ resource, action })
      expect(res.can).toBe(false)
    }
  })
})
```

### Step 5. Contacts pages and sidebar item

Create `src/pages/contacts/ContactList.tsx` with exactly this content:

```tsx
import { DeleteButton, EditButton, List, useTable } from '@refinedev/antd'
import { Space, Table } from 'antd'
import type { ContactRow } from '@/types/db'

export function ContactList() {
  const { tableProps } = useTable<ContactRow>({
    syncWithLocation: true,
    meta: { select: '*, clients(name)' },
    sorters: { initial: [{ field: 'last_name', order: 'asc' }] },
  })

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column<ContactRow>
          title="Name"
          render={(_, record) => `${record.first_name} ${record.last_name}`}
        />
        <Table.Column<ContactRow> dataIndex="contact_no" title="Contact number" />
        <Table.Column<ContactRow>
          title="Client"
          render={(_, record) => record.clients?.name ?? 'Unknown'}
        />
        <Table.Column<ContactRow>
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

Create `src/pages/contacts/ContactCreate.tsx` with exactly this content:

```tsx
import { Create, useForm, useSelect } from '@refinedev/antd'
import { Form, Input, Select } from 'antd'
import type { Client, TablesInsert } from '@/types/db'

export function ContactCreate() {
  const { formProps, saveButtonProps } = useForm<TablesInsert<'contacts'>>({ action: 'create' })
  const { selectProps } = useSelect<Client>({
    resource: 'clients',
    optionLabel: 'name',
    optionValue: 'id',
  })

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Client"
          name="client_id"
          rules={[{ required: true, message: 'Choose the client this contact belongs to' }]}
        >
          <Select {...selectProps} placeholder="Client" />
        </Form.Item>
        <Form.Item
          label="First name"
          name="first_name"
          rules={[
            { required: true, whitespace: true, message: 'First name is required' },
            { max: 100, message: 'Keep it under 100 characters' },
          ]}
        >
          <Input autoFocus />
        </Form.Item>
        <Form.Item
          label="Last name"
          name="last_name"
          rules={[
            { required: true, whitespace: true, message: 'Last name is required' },
            { max: 100, message: 'Keep it under 100 characters' },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Contact number"
          name="contact_no"
          rules={[{ required: true, whitespace: true, message: 'Contact number is required' }]}
        >
          <Input placeholder="As entered, e.g. +61 400 000 000" />
        </Form.Item>
      </Form>
    </Create>
  )
}
```

Create `src/pages/contacts/ContactEdit.tsx` with exactly this content:

```tsx
import type { HttpError } from '@refinedev/core'
import { Edit, useForm, useSelect } from '@refinedev/antd'
import { Form, Input, Select } from 'antd'
import type { Client, Contact, TablesUpdate } from '@/types/db'

export function ContactEdit() {
  const { formProps, saveButtonProps, query } = useForm<
    Contact,
    HttpError,
    TablesUpdate<'contacts'>
  >({ action: 'edit' })
  const { selectProps } = useSelect<Client>({
    resource: 'clients',
    optionLabel: 'name',
    optionValue: 'id',
  })
  const isLoading = query?.isLoading ?? false

  return (
    <Edit saveButtonProps={saveButtonProps} isLoading={isLoading}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Client"
          name="client_id"
          rules={[{ required: true, message: 'Choose the client this contact belongs to' }]}
        >
          <Select {...selectProps} placeholder="Client" />
        </Form.Item>
        <Form.Item
          label="First name"
          name="first_name"
          rules={[
            { required: true, whitespace: true, message: 'First name is required' },
            { max: 100, message: 'Keep it under 100 characters' },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Last name"
          name="last_name"
          rules={[
            { required: true, whitespace: true, message: 'Last name is required' },
            { max: 100, message: 'Keep it under 100 characters' },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Contact number"
          name="contact_no"
          rules={[{ required: true, whitespace: true, message: 'Contact number is required' }]}
        >
          <Input />
        </Form.Item>
      </Form>
    </Edit>
  )
}
```

Edit `src/App.tsx` in four places:

1. Find `  SolutionOutlined,\n} from '@ant-design/icons'` and replace it with `  SolutionOutlined,\n  PhoneOutlined,\n} from '@ant-design/icons'`.
2. Find `import { ClientEdit } from '@/pages/clients/ClientEdit'` and add these lines after it:

```ts
import { ContactList } from '@/pages/contacts/ContactList'
import { ContactCreate } from '@/pages/contacts/ContactCreate'
import { ContactEdit } from '@/pages/contacts/ContactEdit'
```

3. Find `    meta: { label: 'Clients', icon: <SolutionOutlined /> },\n  },\n]` and add this entry before the `]`:

```ts
  {
    name: 'contacts',
    list: '/contacts',
    create: '/contacts/create',
    edit: '/contacts/edit/:id',
    meta: { label: 'Contacts', icon: <PhoneOutlined /> },
  },
```

4. Find `              <Route path="edit/:id" element={<ClientEdit />} />\n            </Route>` and add after the `</Route>`:

```tsx
            <Route path="/contacts">
              <Route index element={<ContactList />} />
              <Route path="create" element={<ContactCreate />} />
              <Route path="edit/:id" element={<ContactEdit />} />
            </Route>
```

**Gate:**

```bash
pnpm typecheck && pnpm test
```

**Expect:** both exit 0.

### Step 6. README

Edit `README.md` in three places:

1. Find `  migrations/0007_clients.sql  clients (each booked against a company), role-based RLS` and add this line after it: `  migrations/0008_contacts.sql contacts (name and number per client), role-based RLS`
2. Find `  seed.sql                     local test users, todos and the four companies` and replace it with `  seed.sql                     local test users, todos, the four companies, and client/contact scenarios`
3. Find `  pages/dashboard, pages/todos, pages/users, pages/companies, pages/clients` and replace it with `  pages/dashboard, pages/todos, pages/users, pages/companies, pages/clients, pages/contacts`

### Step 7. End-to-end spec

Before this step, make sure no leftover rows exist from an earlier failed run. Run:

```bash
docker exec -i supabase_db_dispatch-tracker psql -U postgres -d postgres -X -At -c "select name from public.clients where name like 'E2E Client%';"
```

**Expect:** no output. If it lists rows, delete them with `delete from public.clients where name like 'E2E Client%';` (same `psql` command, local only), then continue.

Create `e2e/dispatch.spec.ts` with exactly this content (Prettier formats it in Step 8):

```ts
import { test, expect, type Page } from '@playwright/test'

// Local seed only (supabase/seed.sql).
async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByRole('link', { name: 'Clients' })).toBeVisible()
}

// antd marks required fields with a leading "*" in the accessible name, e.g. "* Name".
function textField(page: Page, label: string) {
  return page.getByRole('textbox', { name: new RegExp(`^\\* ?${label}$`) })
}

// The confirmation DeleteButton opens ("Are you sure?" with Cancel and Delete).
async function confirmDelete(page: Page) {
  await page
    .getByRole('tooltip')
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
}

async function pickOption(page: Page, field: string, option: string) {
  await page.getByRole('combobox', { name: field }).click()
  await page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .getByText(option, { exact: true })
    .click()
  await expect(page.locator('.ant-select-selection-item').filter({ hasText: option })).toBeVisible()
}

test.describe('as a normal user', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('sees Clients and Contacts read-only', async ({ page }) => {
    await signIn(page, 'user@example.com', 'user-password-123')

    await page.getByRole('link', { name: 'Clients' }).click()
    await expect(page.getByRole('cell', { name: 'Sam Newbie', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /create/i })).toBeDisabled()

    await page.getByRole('link', { name: 'Contacts' }).click()
    await expect(page.getByRole('cell', { name: 'Priya Shah' })).toBeVisible()
    await expect(page.getByRole('button', { name: /create/i })).toBeDisabled()
  })
})

test.describe('as an admin', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('creates, edits and deletes a client and its contacts', async ({ page }) => {
    // Unique per run, so reruns never collide with rows left by an earlier run.
    const stamp = Date.now()
    const client = `E2E Client ${stamp}`
    const edited = `${client} Renamed`
    const last = `Person${stamp}`
    const lastEdited = `Persona${stamp}`
    await signIn(page, 'admin@example.com', 'admin-password-123')

    // Client: create, then rename.
    await page.goto('/clients/create')
    await pickOption(page, 'Company', 'The Tidy Team')
    await textField(page, 'Name').fill(client)
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByRole('cell', { name: client, exact: true })).toBeVisible()

    await page.getByRole('row', { name: client }).getByRole('button', { name: 'edit' }).click()
    // Wait for the record to load first, or the loaded value overwrites the typed one.
    await expect(textField(page, 'Name')).toHaveValue(client)
    await textField(page, 'Name').fill(edited)
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByRole('cell', { name: edited, exact: true })).toBeVisible()

    // Contact: create for the client, check the number is kept as entered, then edit it.
    await page.goto('/contacts/create')
    await pickOption(page, 'Client', edited)
    await textField(page, 'First name').fill('Test')
    await textField(page, 'Last name').fill(last)
    await textField(page, 'Contact number').fill('0412 345 678')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByRole('cell', { name: `Test ${last}` })).toBeVisible()
    await expect(
      page
        .getByRole('row', { name: `Test ${last}` })
        .getByRole('cell', { name: '0412 345 678', exact: true }),
    ).toBeVisible()

    await page.getByRole('row', { name: `Test ${last}` }).getByRole('button', { name: 'edit' }).click()
    await expect(textField(page, 'Last name')).toHaveValue(last)
    await textField(page, 'Last name').fill(lastEdited)
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByRole('cell', { name: `Test ${lastEdited}` })).toBeVisible()

    // Delete the contact, then the client.
    await page.goto('/contacts')
    await page.getByRole('row', { name: `Test ${lastEdited}` }).getByRole('button', { name: 'delete' }).click()
    await confirmDelete(page)
    await expect(page.getByRole('cell', { name: `Test ${lastEdited}` })).toHaveCount(0)

    await page.goto('/clients')
    await page.getByRole('row', { name: edited }).getByRole('button', { name: 'delete' }).click()
    await confirmDelete(page)
    await expect(page.getByRole('cell', { name: edited, exact: true })).toHaveCount(0)
  })
})
```

**Gate:**

```bash
npx playwright test e2e/dispatch.spec.ts --reporter=list
```

**Expect:** `3 passed`: the `[setup]` project, the `as a normal user` test and the `as an admin` test, each reported as `✓`. If a test fails, stop and report, and do not weaken its assertions. After the run, the query in this step's precondition must return no rows.

### Step 8. Web gate and formatting

```bash
pnpm typecheck && pnpm lint && pnpm test
```

**Expect:** all three exit 0.

```bash
npx prettier --write src/types/db.ts src/providers/accessControlProvider.ts src/providers/accessControlProvider.test.ts src/pages/contacts src/App.tsx README.md e2e/dispatch.spec.ts
```

**Expect:** the listed files are formatted (formatting only; no other file is touched). Then run `pnpm typecheck && pnpm lint && pnpm test` again and expect exit 0.

```bash
git status --short
```

**Expect:** the DB files from Step 3, and the web and e2e files `src/types/db.ts`, `src/providers/accessControlProvider.ts`, `src/providers/accessControlProvider.test.ts`, `src/App.tsx`, `README.md`, `src/pages/contacts/`, `e2e/dispatch.spec.ts` and this plan file, plus the T3C-B6 files that are still uncommitted. Anything else: stop and report.

## Rollback

- Before commit: revert this plan's files only: `supabase/migrations/0008_contacts.sql`, `supabase/tests/database/contacts.test.sql`, the scenario added to `supabase/seed.sql`, the contacts lines in `src/types/db.ts`, `src/App.tsx` and `README.md`, the folder `src/pages/contacts/`, and `e2e/dispatch.spec.ts`. Restore `src/providers/accessControlProvider.ts` to the T3C-B6 version (`ADMIN_WRITE_ONLY = new Set(['clients'])`), and restore its test to the T3C-B6 version. Then run `pnpm db:types` and `pnpm db:reset`. Do not delete the branch: it is shared with T3C-B6. Review any uncommitted files first; do not discard them without checking.
- After merge, if a hosted DB already has `0008_contacts.sql`: add `0108_drop_contacts.sql` containing `delete from public.app_permissions where resource = 'contacts';` and `drop table public.contacts;`. Never edit or delete an applied migration. Stop and ask first if other tables already reference `contacts`.

## Conventional commits

Branch: `feat/T3C-B5-B6-Clients-Contacts` (shared with T3C-B6; these commits follow the T3C-B6 commits). Stage explicit paths only. Each commit leaves the suites green. Every commit ends with:

```
Refs: T3C-B5

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `feat(db): add contacts table with role-based RLS`
   Files: `supabase/migrations/0008_contacts.sql`, `src/types/database.types.ts`
2. `feat(db): seed client and contact scenarios`
   Files: `supabase/seed.sql`
3. `test(db): cover contacts constraints and access`
   Files: `supabase/tests/database/contacts.test.sql`
4. `feat(web): add contacts pages and admin-only changes`
   Files: `src/types/db.ts`, `src/providers/accessControlProvider.ts`, `src/pages/contacts/ContactList.tsx`, `src/pages/contacts/ContactCreate.tsx`, `src/pages/contacts/ContactEdit.tsx`, `src/App.tsx`, `README.md`
5. `test(web): cover contact access and the dispatch flow`
   Files: `src/providers/accessControlProvider.test.ts`, `e2e/dispatch.spec.ts`
6. `docs(plans): add T3C-B5 plan`
   Files: `.claude/plans/backend/T3C-B5-Contacts-Table.md`

PR: one PR for the branch, with T3C-B6, titled `feat(db): add clients and contacts tables` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
