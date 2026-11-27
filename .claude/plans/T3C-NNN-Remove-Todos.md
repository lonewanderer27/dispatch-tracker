# T3C-NNN Remove the todos feature from the whole app

> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked. Stage explicit paths only.

## Why

`todos` is the sample domain from the Supabase + Refine starter. It has nothing to do with dispatching cleaning jobs. It still adds a sidebar item, four pages, a table, a `todo_stats()` RPC, a "Call RPC" dashboard card, a realtime publication entry, seed rows and tests. Remove all of it so the app only holds dispatch features.

## Facts (verified 2026-11-27)

1. Branch `main`. Last migration is `supabase/migrations/0040_signup_no_default_role.sql`, so the new one is `0041`. Last architecture doc is `docs/architecture/0008-Feature-Folders.md`, so the new one is `0009`.
2. Web files that only exist for todos:
   - `src/features/todos/routes.tsx`
   - `src/features/todos/pages/TodoList.tsx`, `TodoCreate.tsx`, `TodoEdit.tsx`, `TodoShow.tsx` (no tests there)
   - `src/features/dashboard/components/RpcCard.tsx`
   - `e2e/todos.spec.ts`, `e2e/realtime.spec.ts` (todos only), `e2e/rpc.spec.ts` (the Call RPC button only)
3. Web files that mention todos and are edited, not deleted:
   - `src/app/features.ts` lines 13 and 19 (`import { todosFeature } ...`, `  todosFeature,`)
   - `src/types/db.ts` line 11 (`export type Todo = Tables<'todos'>`) and line 48 (`export type TodoStats = ...`)
   - `src/features/dashboard/api.ts`: import of `TodoStats` (line 5), `EMPTY_STATS` (line 16), `fetchTodoStats` (lines 46-50)
   - `src/features/dashboard/useIntegrationCheck.ts`: imports (lines 3-8) and `useTodoStatsCheck` (lines 51-56)
   - `src/features/dashboard/pages/DashboardPage.tsx`: `RpcCard` import and `<RpcCard />`
   - `src/features/dashboard/integration.test.tsx`: `RpcCard` and `fetchTodoStats` imports, the `rpc` mock, `describe('fetchTodoStats')`, `describe('RpcCard')`
   - `src/app/providers/accessControlProvider.test.ts` line 15 (`resource: 'todos'`)
   - `e2e/users.spec.ts` lines 25-26 (`btn-call-rpc`, link `Todos`)
4. DB objects: table `public.todos` (0001; policies rewritten in 0040), function `public.todo_stats()` (0002), `app_permissions` rows with `resource = 'todos'` for the three roles (0004), membership of `supabase_realtime` (0001). Nothing has a foreign key **to** `todos`. `todos.user_id` references `auth.users`.
5. DB tests and seed that mention todos:
   - `supabase/tests/database/todo_stats.test.sql` (whole file)
   - `rls.test.sql` (plan 15), `no_role.test.sql` (plan 13), `rbac.test.sql` (plan 38), `seed.test.sql` (plan 6)
   - `supabase/seeds/01_users.sql` lines 57-61 (`insert into public.todos ...`)
6. `public.is_admin()` stays: the `profiles` policies still call it.
7. `src/types/database.types.ts` is generated (`pnpm db:types`, run by `pnpm db:reset`). Never hand-edit it.
8. The Refine live provider (`liveProvider` in `src/app/providers/dataProvider.ts`, `liveMode: 'auto'` in `src/app/App.tsx`) is generic. No other table is in the `supabase_realtime` publication, so after this change nothing uses it.
9. Old plans in `.claude/plans/` and the history in migrations `0001`, `0002`, `0004`, `0040` mention todos. They are records and are **not** edited.
10. `EdgeFunctionCard` has `data-testid="btn-invoke-edge"` (see `integration.test.tsx`). The sidebar label `Companies` exists (`src/features/companies/routes.tsx`).

## Decisions already made (do not reopen)

- Drop the table and the function with a **new** migration `0041_remove_todos.sql`. Old migrations are never edited.
- Keep the dashboard and its "Invoke edge function" card. Only the RPC card goes.
- Delete the todos data. Step 0 takes a local dump first; the seed rows are demo data.
- Leave `liveProvider` and `liveMode: 'auto'` in place (Fact 8). Removing them is a separate change.
- Delete `e2e/realtime.spec.ts` with the feature; it only tested todos.
- Two code commits, each deleting code together with its tests, because deleting one without the other leaves the suites red. Web goes first so the app stops using the table before the table is dropped.

**Open question (does not block):** does the hosted Supabase project hold todos worth keeping? This plan only changes local migration files. Pushing `0041` to a hosted project is a separate step that needs the owner's approval.

## Out of scope

- Pushing the migration to any hosted project.
- Removing the live provider or `liveMode`.
- Editing old plans or old migrations.
- Any change to `is_admin()`, `has_permission()` or other tables.

## Steps

### Step 0: branch and backup

```bash
git switch -c feat/T3C-NNN-Remove-Todos
pnpm db:start
pnpm exec supabase db dump --local --data-only -f "$TMPDIR/todos-backup.sql"
grep -c 'public"."todos"' "$TMPDIR/todos-backup.sql"
```

**Expect:** the branch is created, the stack starts, and the last command prints a number of 1 or more.

---

## Phase 1: web (one commit)

### Step 1: delete the todos web files

```bash
git rm -r src/features/todos
git rm src/features/dashboard/components/RpcCard.tsx e2e/todos.spec.ts e2e/realtime.spec.ts e2e/rpc.spec.ts
```

**Expect:** git lists 9 removed files: 5 under `src/features/todos`, `RpcCard.tsx`, and 3 e2e specs.

### Step 2: edit `src/app/features.ts`

Remove this line (find, replace with nothing):

```ts
import { todosFeature } from '@/features/todos/routes'
```

Remove this line (find, replace with nothing):

```ts
  todosFeature,
```

### Step 3: edit `src/types/db.ts`

Remove this line:

```ts
export type Todo = Tables<'todos'>
```

Remove this line:

```ts
export type TodoStats = PublicSchema['Functions']['todo_stats']['Returns'][number]
```

### Step 4: edit `src/features/dashboard/api.ts`

Remove this line:

```ts
import type { TodoStats } from '@/types/db'
```

Remove these two lines (the constant and the blank line after it):

```ts
const EMPTY_STATS: TodoStats = { total: 0, done: 0, pending: 0, pct_done: 0 }

```

Remove this block, including the blank line before it (it is the end of the file):

```ts

export async function fetchTodoStats(client: AppSupabaseClient): Promise<TodoStats> {
  const { data, error } = await client.rpc('todo_stats')
  if (error) throw new Error(error.message)
  return data[0] ?? EMPTY_STATS
}
```

### Step 5: edit `src/features/dashboard/useIntegrationCheck.ts`

Replace:

```ts
import {
  fetchExchangeRate,
  fetchTodoStats,
  type ExchangeRateResult,
} from '@/features/dashboard/api'
import type { TodoStats } from '@/types/db'
```

with:

```ts
import { fetchExchangeRate, type ExchangeRateResult } from '@/features/dashboard/api'
```

Remove this block, including the blank line before it (it is the end of the file):

```ts

/** Dashboard check 2: call the todo_stats RPC. */
export function useTodoStatsCheck() {
  const { run: runCheck, ...rest } = useIntegrationCheck<TodoStats>()
  const run = useCallback(() => runCheck(() => fetchTodoStats(supabase)), [runCheck])
  return { ...rest, run }
}
```

### Step 6: edit `src/features/dashboard/pages/DashboardPage.tsx`

Remove this line:

```tsx
import { RpcCard } from '@/features/dashboard/components/RpcCard'
```

Remove this line:

```tsx
        <RpcCard />
```

### Step 7: edit `src/features/dashboard/integration.test.tsx`

Remove this line:

```tsx
import { RpcCard } from '@/features/dashboard/components/RpcCard'
```

Remove these two lines (`AppSupabaseClient` is only used by the `fetchTodoStats` test):

```tsx
import { fetchTodoStats } from '@/features/dashboard/api'
import type { AppSupabaseClient } from '@/shared/supabase'
```

Remove this line:

```tsx
const rpc = vi.fn<(...args: unknown[]) => Promise<unknown>>()
```

Replace:

```tsx
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    rpc: (...args: unknown[]) => rpc(...args),
```

with:

```tsx
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
```

Remove the whole `describe('fetchTodoStats', ...)` block (from the line `describe('fetchTodoStats', () => {` to its closing `})`, plus one blank line after it).

Remove the whole `describe('RpcCard', ...)` block at the end of the file (from `describe('RpcCard', () => {` to its closing `})`), plus the blank line before it.

### Step 8: edit `src/app/providers/accessControlProvider.test.ts`

Replace:

```ts
    const res = await accessControlProvider.can({ resource: 'todos', action: 'list' })
```

with:

```ts
    const res = await accessControlProvider.can({ resource: 'companies', action: 'list' })
```

### Step 9: edit `e2e/users.spec.ts`

Replace:

```ts
    await expect(page.getByTestId('btn-call-rpc')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Todos' })).toBeVisible()
```

with:

```ts
    await expect(page.getByTestId('btn-invoke-edge')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Companies' })).toBeVisible()
```

### Step 10: format the touched files and run the web gate

```bash
pnpm exec prettier --write src/app/features.ts src/types/db.ts src/features/dashboard/api.ts src/features/dashboard/useIntegrationCheck.ts src/features/dashboard/pages/DashboardPage.tsx src/features/dashboard/integration.test.tsx src/app/providers/accessControlProvider.test.ts e2e/users.spec.ts
pnpm lint && pnpm typecheck && pnpm test
grep -rIn -i "todo" src e2e
```

**Expect:** prettier lists the files; lint, typecheck and vitest all exit 0; the final `grep` prints only `src/types/database.types.ts` lines (generated; fixed in Phase 2) and nothing else.

### Step 11: commit Phase 1

```bash
git add src/app/features.ts src/types/db.ts src/features/dashboard src/features/todos src/app/providers/accessControlProvider.test.ts e2e/users.spec.ts e2e/todos.spec.ts e2e/realtime.spec.ts e2e/rpc.spec.ts
git commit
```

Message: see "Conventional commits", commit 1.

---

## Phase 2: database (one commit)

### Step 12: create `supabase/migrations/0041_remove_todos.sql` (new file, in full)

```sql
-- 0041_remove_todos: the todos sample feature is gone from the app.
-- Dropping the table also drops its index, its five policies and its place in the
-- supabase_realtime publication. todo_stats() only read that table, so it goes first.

delete from public.app_permissions where resource = 'todos';

drop function public.todo_stats();

drop table public.todos;
```

### Step 13: delete the todo_stats test

```bash
git rm supabase/tests/database/todo_stats.test.sql
```

### Step 14: edit `supabase/seeds/01_users.sql`

Remove this block (it ends the file, or is followed only by blank lines; also remove the blank line before it):

```sql

insert into public.todos (user_id, title, done) values
  ('22222222-2222-2222-2222-222222222222', 'Buy milk', true),
  ('22222222-2222-2222-2222-222222222222', 'Write the README', false),
  ('22222222-2222-2222-2222-222222222222', 'Ship the starter', false),
  ('11111111-1111-1111-1111-111111111111', 'Admin-only reminder', false);
```

### Step 15: edit `supabase/tests/database/seed.test.sql`

Replace `select plan(6);` with `select plan(5);`.

Remove this block (and one blank line after it):

```sql
select is(
  (select count(*) from public.todos where user_id = '22222222-2222-2222-2222-222222222222'),
  3::bigint,
  'seeded normal user has 3 todos'
);

```

### Step 16: edit `supabase/tests/database/no_role.test.sql`

Replace `select plan(13);` with `select plan(10);`.

Remove this block (and one blank line after it):

```sql
-- One todo of Nora's, made as the owner, so we can tell "hidden" from "not there".
insert into public.todos (user_id, title) values ('e5500000-0000-0000-0000-00000000000e', 'Nora todo');

```

Remove this block (and one blank line after it), between the `roles` assertion and `reset role;`:

```sql
-- 8-9: even her own todos are hidden and she cannot add one.
select is((select count(*) from public.todos), 0::bigint, 'no role: her own todo is hidden');
select throws_ok(
  $$insert into public.todos (user_id, title) values ('e5500000-0000-0000-0000-00000000000e', 'x')$$,
  '42501',
  null,
  'no role: she cannot create a todo'
);
```

(`reset role;` that follows stays.)

Replace:

```sql
-- 11-13: now she gets what a User gets.
```

with:

```sql
-- 11-12: now she gets what a User gets.
```

Remove this line:

```sql
select is((select count(*) from public.todos), 1::bigint, 'with the User role she sees her own todo');
```

### Step 17: edit `supabase/tests/database/rbac.test.sql`

Replace `select plan(38);` with `select plan(36);`.

Remove this block:

```sql
select is(
  (select concat_ws(',', "read", "create", "update", "delete") from public.app_permissions
    where role_id = '30000000-0000-0000-0000-000000000002' and resource = 'todos'),
  't,t,t,t',
  'User keeps full access to their own todos'
);
```

Remove this line:

```sql
select is(public.has_permission('todos', 'read'), true, 'User can read todos');
```

Replace:

```sql
  $$delete from public.app_permissions where resource = 'todos'$$,
```

with:

```sql
  $$delete from public.app_permissions where resource = 'profiles'$$,
```

Replace:

```sql
  (select count(*) from public.app_permissions where resource = 'todos'),
```

with:

```sql
  (select count(*) from public.app_permissions where resource = 'profiles'),
```

(`profiles` has exactly 3 rows, one per role, so the `= 3` assertion that follows stays correct.)

### Step 18: edit `supabase/tests/database/rls.test.sql`

Replace `select plan(15);` with `select plan(6);`.

Remove this block (and one blank line after it):

```sql
-- Seed todos as the table owner (bypasses RLS).
insert into public.todos (user_id, title, done) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'alice one', false),
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'alice two', false),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'bob one', false);

```

Replace:

```sql
-- 1-2: RLS is on for every public table and the two we own.
```

with:

```sql
-- 1: RLS is on for every public table.
```

Remove this block (and one blank line after it):

```sql
select ok(
  (select relrowsecurity from pg_class where oid = 'public.todos'::regclass),
  'todos has RLS enabled'
);
```

Remove this block (and one blank line after it):

```sql
-- 5: Alice sees only her own todos.
select is(
  (select count(*) from public.todos),
  2::bigint,
  'user A sees only their own todos'
);

-- 6: Alice cannot read Bob's todos.
select is(
  (select count(*) from public.todos where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'),
  0::bigint,
  'user A cannot read user B todos'
);

```

Remove this block (and one blank line after it):

```sql
-- 7: Alice's update of Bob's rows matches nothing (RLS filters it out); no error, no change.
select lives_ok(
  $$update public.todos set title = 'hijacked' where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'$$,
  'user A update of user B todos is silently filtered by RLS'
);

-- 8: Alice cannot insert a todo owned by Bob.
select throws_ok(
  $$insert into public.todos (user_id, title) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'sneaky')$$,
  '42501',
  null,
  'user A cannot insert todos for user B'
);

```

Remove this block, from the comment through the closing `reset role;` of the anon test, replacing it with just `reset role;` once. Concretely, find:

```sql
reset role;

-- 7b: Bob's todo title was not changed (checked as owner).
select is(
  (select title from public.todos where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'),
  'bob one',
  'user B todo title untouched after user A update attempt'
);

-- 10: anon is denied table access.
set local role anon;
select throws_ok(
  'select count(*) from public.todos',
  '42501',
  null,
  'anon is denied select on todos'
);
reset role;

-- Promote Carol to admin (as owner, the only path to role changes).
update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'cccccccc-0000-0000-0000-00000000000c';

-- 11: admin override: Carol (admin) sees Alice's and Bob's todos.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select is(
  (select count(*) from public.todos
     where user_id in ('aaaaaaaa-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-00000000000b')),
  3::bigint,
  'admin override lets an admin read other users todos (A and B)'
);
reset role;
```

and replace with:

```sql
reset role;
```

Remove this block (and one blank line before it), at the end before `select * from finish();`:

```sql
-- 14: Realtime publication includes todos.
select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'todos'
  ),
  'todos is in the supabase_realtime publication'
);
```

### Step 19: reset the database, regenerate types and run the DB gate

```bash
pnpm db:reset
pnpm test:db
grep -c -i "todo" src/types/database.types.ts
git diff --stat src/types/database.types.ts
```

**Expect:** `db:reset` applies `0041` without error and rewrites `src/types/database.types.ts`; `test:db` reports every file passing (`rls`, `no_role`, `rbac`, `seed` and all others) with no `todo_stats` file; the `grep -c` prints `0`; the diff stat shows only deletions for `src/types/database.types.ts`.

### Step 20: run the full gate

```bash
pnpm test:all
```

**Expect:** exit 0 (lint, typecheck, vitest, pgTAP, Deno, Playwright all pass).

### Step 21: commit Phase 2

```bash
git add supabase/migrations/0041_remove_todos.sql supabase/tests/database supabase/seeds/01_users.sql src/types/database.types.ts
git commit
```

Message: see commit 2.

---

## Phase 3: docs (one commit)

### Step 22: create `docs/architecture/0009-Remove-Todos.md` (new file, in full)

```markdown
# 0009 Remove the todos sample feature

- Ticket: T3C-NNN
- Plan: `.claude/plans/T3C-NNN-Remove-Todos.md`
- Date: 2026-11-27
- Status: implemented

## Context

`todos` came with the Supabase + Refine starter. It had a table, a `todo_stats()` RPC, a four-page
feature, a "Call RPC" dashboard card and a realtime e2e test. It is not part of dispatching cleaning
jobs.

## Decision

- Migration `0041_remove_todos.sql` deletes the `todos` rows of `app_permissions`, drops `todo_stats()`
  and drops the `todos` table. The table's policies, index and `supabase_realtime` entry go with it.
  Older migrations are not edited.
- The web feature, the RPC card and the todos e2e specs are deleted. The dashboard keeps the
  "Invoke edge function" card.
- `is_admin()` stays, because the `profiles` policies call it.

## Consequences

- Todo data is deleted. A local dump was taken before the migration; a hosted project needs its own
  decision before `0041` is pushed there.
- No table is in the `supabase_realtime` publication now. The live provider and `liveMode: 'auto'`
  stay in the app and are unused until a table is added to the publication.
```

### Step 23: edit `README.md`

Replace:

```
Sample domain: `profiles` and `todos`, with per-user RLS, realtime updates, an RPC (`todo_stats`) and an edge function (`exchange-rate`, backed by [Frankfurter](https://frankfurter.dev), no API key).
```

with:

```
Sample domain: `profiles`, with per-user RLS and an edge function (`exchange-rate`, backed by [Frankfurter](https://frankfurter.dev), no API key).
```

Replace:

```
  migrations/0001_init.sql     profiles, todos, RLS, realtime
  migrations/0002_todo_stats.sql
```

with:

```
  migrations/0001_init.sql     profiles, todos (dropped in 0041), RLS, realtime
  migrations/0002_todo_stats.sql  todo_stats() (dropped in 0041)
```

Replace:

```
                               items, todos, users. Never imports another feature.
```

with:

```
                               items, users. Never imports another feature.
```

Replace the whole section:

```
## The two integration buttons

| Button                   | Proves                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| **Invoke edge function** | JWT passes through the gateway, outbound network works, secrets and env vars are wired.     |
| **Call RPC**             | SQL logic runs, RLS applies inside the RPC (`security invoker`), and types flow end to end. |
```

with:

```
## The integration button

| Button                   | Proves                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------- |
| **Invoke edge function** | JWT passes through the gateway, outbound network works, secrets and env vars are wired. |
```

Remove these two lines from **Notes** (and nothing else there):

```
- `todo_stats` is `security invoker`. Switching it to `security definer` would bypass RLS. The pgTAP isolation test guards against that.
- Admins have an RLS override on `todos`, so for an admin `todo_stats` counts every user's todos, not only their own.
```

Add, in the README's existing list of architecture docs if there is one (search with `grep -n "0008" README.md`), a link to `docs/architecture/0009-Remove-Todos.md` next to the 0008 link in the same style. If the README has no such list, add nothing.

### Step 24: edit `docs/architecture/0001-Role-Based-Access.md`

Replace:

```
- The rows for `profiles` and `todos` describe today's behaviour (own rows only for Users). Their
  policies are written by hand and do not read the matrix.
```

with:

```
- The row for `profiles` describes today's behaviour (own rows only for Users). Its policies are
  written by hand and do not read the matrix. (`todos` had a row too until 0041 dropped the table.)
```

Replace:

```
- `public.is_admin()` is true for Admin and Super Admin. Only the `profiles` and `todos` policies still
  use it.
```

with:

```
- `public.is_admin()` is true for Admin and Super Admin. Only the `profiles` policies still use it.
```

In the "Sign-ups have no role (0040)" section, append to the sentence that ends `so even their own todos are hidden.` the text ` (The table was dropped in 0041; see [0009](0009-Remove-Todos.md).)`

### Step 25: final check and commit Phase 3

```bash
pnpm exec prettier --check README.md docs/architecture/0001-Role-Based-Access.md docs/architecture/0009-Remove-Todos.md
grep -rIil "todo" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude=pnpm-lock.yaml . | grep -v "^./.claude/plans/" | sort
git add README.md docs/architecture/0001-Role-Based-Access.md docs/architecture/0009-Remove-Todos.md
git commit
```

**Expect:** prettier passes (if it fails only on the files you edited, run `--write` on those three files and re-check). The `grep` lists exactly: `./README.md`, `./docs/architecture/0001-Role-Based-Access.md`, `./docs/architecture/0009-Remove-Todos.md`, `./supabase/migrations/0001_init.sql`, `./supabase/migrations/0002_todo_stats.sql`, `./supabase/migrations/0004_app_permissions.sql`, `./supabase/migrations/0040_signup_no_default_role.sql`, `./supabase/migrations/0041_remove_todos.sql`. Any other file: stop and report.

## Rollback

- Before pushing: `git switch main && git branch -D feat/T3C-NNN-Remove-Todos`, then `pnpm db:reset` to rebuild the local database from `main`.
- The dropped data exists only in `$TMPDIR/todos-backup.sql` (Step 0) and in the seed history. To restore a local copy, `git revert` the three commits, run `pnpm db:reset`, then load the dump with `psql` if its rows are needed.
- A hosted project is not touched by this plan.

## Conventional commits

Branch: `feat/T3C-NNN-Remove-Todos`. Stage the explicit paths shown in each step.

1. Subject: `refactor(web): remove the todos feature and the RPC card`
   Body: `Deletes the todos pages, the dashboard RPC card, the todos e2e specs and their tests together, so no commit leaves a red suite.`
   Files: Step 11.
   Footer: `Refs: T3C-NNN`, then `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

2. Subject: `refactor(db): drop the todos table and todo_stats function`
   Body: `Migration 0041 removes the app_permissions rows, the function and the table. Their pgTAP tests, the seed rows and the generated types go in the same commit.`
   Files: Step 21.
   Footer: `Refs: T3C-NNN`, then the `Co-Authored-By` line.

3. Subject: `docs(db): document the removal of todos`
   Files: Step 25.
   Footer: `Refs: T3C-NNN`, then the `Co-Authored-By` line.

4. (Separate, when asked) Subject: `docs(plans): add the T3C-NNN Remove Todos plan`
   Files: `.claude/plans/T3C-NNN-Remove-Todos.md`.
   Footer: `Refs: T3C-NNN`, then the `Co-Authored-By` line.

PR title: `refactor(web): remove the todos feature from the app`
PR body: from `.github/pull_request_template.md` once one exists, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Merge with a normal merge commit.
