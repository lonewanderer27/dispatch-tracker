# T3C-F40 Fix the Company Cleaners create form: name search and several companies per save

> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked. Stage explicit paths only.

## Why

Source: sprint ticket T3C-F40, Frontend, "Add Company Cleaners".

On `/company-cleaners/create`:

1. Typing in the Cleaner box never finds anyone (newly added cleaners such as JohnLery Guasch and Tina Moran did not appear). Cause: the Cleaner label is built from two columns (a function `optionLabel`), so Refine's `useSelect` falls back to `searchField = "title"`, which sends a server filter on a column `cleaners` does not have. `@refinedev/antd` also sets `filterOption: false`, so nothing filters in the browser.
2. A cleaner can be given only one company per save, although the table allows many. Cause: the form has a single-value Company select.

## Facts (verified 2026-11-27)

1. Branch `main`. Feature folder: `src/features/company-cleaners/` (`routes.tsx`, `companyFilter.ts`, `pages/CompanyCleanerList.tsx`, `pages/CompanyCleanerCreate.tsx`). Resource name is `company_cleaners`; create route is `/company-cleaners/create`, list route is `/company-cleaners`.
2. At `HEAD`, `CompanyCleanerCreate.tsx` uses `useForm<TablesInsert<'company_cleaners'>>({ action: 'create' })` and two `useSelect` calls. The Cleaner `useSelect` has a function `optionLabel` that joins first and last name, `optionValue: 'id'`, no `sorters`, no `onSearch`. The Company field is `name="company_id"` with a single-value `Select`.
3. `supabase/migrations/0010_company_cleaners.sql` already has `unique (cleaner_id, company_id)`, so one cleaner can have many rows. **No migration, policy or `app_permissions` change is needed.**
4. `@refinedev/core` `useSelect` defaults to `pageSize: 10` and `searchField` to `"title"` when `optionLabel` is a function (`node_modules/@refinedev/core/dist/index.mjs`, `useSelect`).
5. `@refinedev/supabase` `createMany` is one `insert(variables)`, so a multi-row save is all-or-nothing.
6. `src/features/users/pages/UserEdit.tsx` already uses `useNavigate` from `react-router`, so the feature may too.
7. The final code of both files was drafted in the working tree on 2026-11-27 (uncommitted: `CompanyCleanerCreate.tsx` modified, `CompanyCleanerCreate.test.tsx` new). Step 0 backs them up and returns to `HEAD` so the commits can be made one concern at a time.
8. ESLint rules in force that shaped the code: `no-confusing-void-expression` (arrow bodies that call a void function need braces), `no-misused-promises` (use `void navigate(...)`), and `non-nullable-type-assertion-style` plus `no-non-null-assertion` (find the select boxes with `getByLabelText`, not an indexed `getAllByRole`).

## Decisions already made (do not reopen)

- Search matches any of `first_name`, `middle_name` or `last_name` with an `or` filter on the server. A full-name query such as "Tina Moran" does not match, because each word is tested against one column at a time. Not fixed here.
- The Cleaner list is sorted by `last_name` ascending. Page size is left at Refine's default of 10; the search is how you reach the rest.
- The Company field becomes a multi-select named `company_ids`. Save inserts one `company_cleaners` row per company through `useCreateMany`, then goes to `/company-cleaners`.
- `useCreateMany` replaces `useForm` on this page, because `useForm` creates one record. Validation stays in the antd `Form` rules.
- Picking a company the cleaner already has fails on the unique key; Refine shows the error and nothing is saved. Hiding already-linked companies is not done.
- Three commits for code and tests (search fix, multi-company, test), plus the plan on its own, as `AGENTS.md` asks for one concern per commit and code and tests apart.

### Open question (does not block)

1. Should the Company dropdown hide companies the chosen cleaner already works for? Not needed to close this ticket.

## Out of scope

- The list page, the filter, the database, `app_permissions` and `accessControlProvider.ts`.
- A full-name search, and lifting the 10-row cap on the Cleaner list.
- An edit page for links. A link is removed from the list page and re-added here.
- Playwright e2e. The pgTAP tests already cover the table and its policies.

## Steps

### Step 0. Back up and return to HEAD

```bash
cd "/Users/adriane.puzon/Documents/The Tidy Team Cleaning Company Inc/dispatch-tracker"
git branch --show-current
mkdir -p the scratchpad backup folder
cp src/features/company-cleaners/pages/CompanyCleanerCreate.tsx the scratchpad backup folder/ 2>/dev/null
cp src/features/company-cleaners/pages/CompanyCleanerCreate.test.tsx the scratchpad backup folder/ 2>/dev/null
git checkout -- src/features/company-cleaners/pages/CompanyCleanerCreate.tsx
rm -f src/features/company-cleaners/pages/CompanyCleanerCreate.test.tsx
git status --short
```

**Expect:** the branch name printed is a feature branch cut from `main` (create `fix/T3C-F40-Add-Company-Cleaners` from `main` first if it prints `main`); `git status --short` lists only untracked `.claude/plans/` files and no change under `src/`.

### Step 1. Plan commit

Commit the plan file alone (see Conventional commits, commit 1).

### Step 2. Fix the cleaner name search

In `src/features/company-cleaners/pages/CompanyCleanerCreate.tsx`, replace this find string, which occurs once, the lines right after the Cleaner `optionValue`:

```tsx
    optionValue: 'id',
  })
  const { selectProps: companySelectProps } = useSelect<Company>({
```

with:

```tsx
    optionValue: 'id',
    sorters: [{ field: 'last_name', order: 'asc' }],
    // The label is built from two columns, so Refine has no single field to search. Match either name.
    onSearch: (value) =>
      value
        ? [
            {
              operator: 'or',
              value: [
                { field: 'first_name', operator: 'contains', value },
                { field: 'middle_name', operator: 'contains', value },
                { field: 'last_name', operator: 'contains', value },
              ],
            },
          ]
        : [],
  })
  const { selectProps: companySelectProps } = useSelect<Company>({
```

**Gate:**

```bash
pnpm exec prettier --check src/features/company-cleaners/pages/CompanyCleanerCreate.tsx && pnpm exec eslint src/features/company-cleaners/pages/CompanyCleanerCreate.tsx && pnpm exec tsc --noEmit -p tsconfig.app.json && pnpm exec vitest run src/features/company-cleaners
```

**Expect:** Prettier says "All matched files use Prettier code style!", ESLint and `tsc` print nothing, Vitest ends with `Test Files  2 passed` and `Tests  9 passed`.

Commit 2 (see below).

### Step 3. Assign several companies in one save

Replace the whole of `src/features/company-cleaners/pages/CompanyCleanerCreate.tsx` with:

```tsx
import { useCreateMany } from '@refinedev/core'
import { Create, useSelect } from '@refinedev/antd'
import { Form, Select } from 'antd'
import { useNavigate } from 'react-router'
import type { Cleaner, Company } from '@/types/db'

interface FormValues {
  cleaner_id: string
  company_ids: string[]
}

export function CompanyCleanerCreate() {
  const [form] = Form.useForm<FormValues>()
  const navigate = useNavigate()
  const { mutate: createLinks, mutation } = useCreateMany()
  const { selectProps: cleanerSelectProps } = useSelect<Cleaner>({
    resource: 'cleaners',
    optionLabel: (cleaner) => `${cleaner.first_name} ${cleaner.last_name}`,
    optionValue: 'id',
    sorters: [{ field: 'last_name', order: 'asc' }],
    // The label is built from two columns, so Refine has no single field to search. Match either name.
    onSearch: (value) =>
      value
        ? [
            {
              operator: 'or',
              value: [
                { field: 'first_name', operator: 'contains', value },
                { field: 'middle_name', operator: 'contains', value },
                { field: 'last_name', operator: 'contains', value },
              ],
            },
          ]
        : [],
  })
  const { selectProps: companySelectProps } = useSelect<Company>({
    resource: 'companies',
    optionLabel: 'name',
    optionValue: 'id',
  })

  return (
    <Create
      saveButtonProps={{
        onClick: () => {
          form.submit()
        },
        loading: mutation.isPending,
      }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={({ cleaner_id, company_ids }) => {
          createLinks(
            {
              resource: 'company_cleaners',
              values: company_ids.map((company_id) => ({ cleaner_id, company_id })),
            },
            {
              onSuccess: () => {
                void navigate('/company-cleaners')
              },
            },
          )
        }}
      >
        <Form.Item
          label="Cleaner"
          name="cleaner_id"
          rules={[{ required: true, message: 'Choose the cleaner' }]}
        >
          <Select {...cleanerSelectProps} placeholder="Cleaner" />
        </Form.Item>
        <Form.Item
          label="Companies"
          name="company_ids"
          rules={[{ required: true, message: 'Choose at least one company' }]}
        >
          <Select {...companySelectProps} mode="multiple" placeholder="Companies" />
        </Form.Item>
      </Form>
    </Create>
  )
}
```

**Gate:** same command as Step 2.

**Expect:** same as Step 2 (still 9 tests; the form has no test yet).

Commit 3 (see below).

### Step 4. Test the form

Create `src/features/company-cleaners/pages/CompanyCleanerCreate.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompanyCleanerCreate } from '@/features/company-cleaners/pages/CompanyCleanerCreate'

const createLinks = vi.fn()
const navigate = vi.fn()
const useSelect = vi.fn()

vi.mock('@refinedev/antd', () => ({
  Create: ({
    children,
    saveButtonProps,
  }: {
    children: ReactNode
    saveButtonProps: { onClick: () => void }
  }) => (
    <div>
      {children}
      <button onClick={saveButtonProps.onClick}>Save</button>
    </div>
  ),
  useSelect: (options: { resource: string }) => useSelect(options) as unknown,
}))
vi.mock('@refinedev/core', () => ({
  useCreateMany: () => ({ mutate: createLinks, mutation: { isPending: false } }),
}))
vi.mock('react-router', () => ({ useNavigate: () => navigate }))

const options = {
  cleaners: [{ label: 'Tina Moran', value: 'k1' }],
  companies: [
    { label: 'The Tidy Team', value: 'co1' },
    { label: 'Total Home Care', value: 'co2' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  useSelect.mockImplementation((args: { resource: 'cleaners' | 'companies' }) => ({
    selectProps: { options: options[args.resource] },
  }))
})

describe('CompanyCleanerCreate', () => {
  it('searches cleaners by first, middle or last name', () => {
    render(<CompanyCleanerCreate />)
    const cleanerArgs = useSelect.mock.calls
      .map(([args]) => args as { resource: string; onSearch?: (value: string) => unknown })
      .find((args) => args.resource === 'cleaners')
    expect(cleanerArgs?.onSearch?.('')).toEqual([])
    expect(cleanerArgs?.onSearch?.('Moran')).toEqual([
      {
        operator: 'or',
        value: [
          { field: 'first_name', operator: 'contains', value: 'Moran' },
          { field: 'middle_name', operator: 'contains', value: 'Moran' },
          { field: 'last_name', operator: 'contains', value: 'Moran' },
        ],
      },
    ])
  })

  it('saves one link per chosen company in a single request, then returns to the list', async () => {
    render(<CompanyCleanerCreate />)

    await userEvent.click(screen.getByLabelText('Cleaner'))
    await userEvent.click(await screen.findByTitle('Tina Moran'))
    await userEvent.click(screen.getByLabelText('Companies'))
    await userEvent.click(await screen.findByTitle('The Tidy Team'))
    await userEvent.click(await screen.findByTitle('Total Home Care'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(createLinks).toHaveBeenCalledTimes(1)
    })
    const [request, callbacks] = createLinks.mock.calls[0] as [unknown, { onSuccess: () => void }]
    expect(request).toEqual({
      resource: 'company_cleaners',
      values: [
        { cleaner_id: 'k1', company_id: 'co1' },
        { cleaner_id: 'k1', company_id: 'co2' },
      ],
    })
    callbacks.onSuccess()
    expect(navigate).toHaveBeenCalledWith('/company-cleaners')
  })

  it('does not save until a company is chosen', async () => {
    render(<CompanyCleanerCreate />)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Choose at least one company')).toBeInTheDocument()
    expect(createLinks).not.toHaveBeenCalled()
  })
})
```

**Gate:**

```bash
pnpm exec prettier --check src/features/company-cleaners/pages/ && pnpm exec eslint src/features/company-cleaners/ && pnpm exec tsc --noEmit -p tsconfig.app.json && pnpm exec vitest run src/features/company-cleaners
```

**Expect:** Prettier passes, ESLint and `tsc` print nothing, Vitest ends with `Test Files  3 passed` and `Tests  12 passed`.

Commit 4 (see below).

### Step 5. Full gate

```bash
pnpm test:all
```

**Expect:** exits 0. It needs Docker (`pnpm db:start`). If Docker is not available, stop and report; do not skip it silently.

### Step 6. Manual check (needs `pnpm dev` and a signed-in user with the Admin or Super Admin role)

1. Open `/company-cleaners/create`, type part of a cleaner's first or last name in Cleaner. **Expect** the cleaner appears.
2. Pick that cleaner, pick two companies, press Save. **Expect** the page goes to `/company-cleaners` and the cleaner's row shows both company tags.
3. Open create again, pick the same cleaner and one of those companies, Save. **Expect** an error notification and no new tag.

## Rollback

No migration or data change. To undo, revert the three code and test commits in reverse order (`git revert <test> <multi> <search>`), or restore the backup copies from `the scratchpad backup folder/` if Step 0 was run and the commits were not made. Links created while testing are removed from the list page with the tag's close icon.

## Conventional commits

Branch: `fix/T3C-F40-Add-Company-Cleaners`. PR title: `fix(web): fix Company Cleaners create form search and multi-assign`.

1. `docs(plans): add the T3C-F40 Company Cleaners plan`
   - Stage: `.claude/plans/T3C-F40-Add-Company-Cleaners.md`
   - Footer: `Refs: T3C-F40`
2. `fix(web): search cleaners by name on the company cleaners form`
   - Stage: `src/features/company-cleaners/pages/CompanyCleanerCreate.tsx` (Step 2 state)
   - Body: the label is built from two columns, so Refine searched a missing `title` column.
   - Footer: `Refs: T3C-F40`
3. `feat(web): assign several companies to a cleaner in one save`
   - Stage: `src/features/company-cleaners/pages/CompanyCleanerCreate.tsx` (Step 3 state)
   - Footer: `Refs: T3C-F40`
4. `test(web): cover the company cleaners create form`
   - Stage: `src/features/company-cleaners/pages/CompanyCleanerCreate.test.tsx`
   - Footer: `Refs: T3C-F40`

Each commit ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` after the `Refs:` line. Every commit leaves the Vitest and lint gates green: commit 1 has no code, commit 2 and 3 pass the Step 2 and 3 gates, commit 4 passes the Step 4 gate. The PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
