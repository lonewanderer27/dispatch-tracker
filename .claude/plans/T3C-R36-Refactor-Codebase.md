# T3C-R36 Reorganise `src/` into feature folders with enforced import boundaries

> **Status: Draft, not approved.**
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked.
>
> **Phases.** Phase 1 (Steps 1 to 4) moves files and rewrites imports, with no behaviour change. Phase 2 (Steps 5 to 8) gives each feature its own `routes.tsx` and shrinks `App.tsx`. Phase 3 (Steps 9 to 10) makes ESLint enforce the boundaries. Phase 4 (Steps 11 to 12) flattens `.claude/plans/`. Phase 5 (Steps 13 to 16) updates `AGENTS.md`, `README.md` and the architecture docs. One commit per phase. Gate totals do not change: Vitest 23 files and 147 tests, Playwright 21 tests (20 plus setup), pgTAP unchanged (no SQL is touched).

## Why

Source: owner request in conversation (2026-11-27): "the repository is a bit wonky in terms of file folder structure ... re-organize it based on best practices around feature-based directory system ... give a clear direction to AI Agent and future developers". Ticket id `T3C-R36` was chosen by the owner.

What is wonky today (see Facts):

- One feature is spread over three trees. The Cleaning Jobs feature lives in `src/features/cleaning-jobs/` (data), `src/components/cleaning-jobs/` (components) and `src/pages/cleaning-jobs/` (page). Every other resource has only `src/pages/<resource>/`.
- Folders break the repo's own rule. `AGENTS.md` says a pages folder holds only Create, Edit and List pages, but `src/pages/dashboard/` holds `EdgeFunctionCard.tsx` and `RpcCard.tsx`, and `src/pages/company-cleaners/` holds the helper `companyFilter.ts`.
- The wrong things are called features. `src/features/integration/` is the dashboard's data access, but it also exports `AppSupabaseClient`, which `users` and `cleaning-jobs` import, so two features depend on the dashboard. `src/features/color-motif/` is not a feature: it is shared by the companies, cleaning types, cleaning statuses and cleaning jobs screens.
- `src/App.tsx` (266 lines) grows by about 15 lines and three edits (icon import, page imports, resource, routes) for every new table.
- Nothing enforces any of this, so each new agent or developer guesses.
- `.claude/plans/backend/` holds a frontend plan (`T3C-F35`), and `AGENTS.md` says plans live in `.claude/plans/`.

Target: one folder per feature that owns its pages, components, data access, hooks and routes; a `shared/` layer for code used by two or more features; an `app/` layer that only composes; and an ESLint rule that makes the import direction `app → features → shared → types` impossible to break by accident.

## Facts (verified 2026-11-27)

1. Branch `main` is at `1f8b90d` (merge of PR #8, T3C-F35 Phase 3: company pills and assignee first names, `b1ec6fe` to `848619a`). That phase added `src/components/company/CompanyTag.tsx` (+ test), `src/features/cleaning-jobs/cleanerName.ts` (+ test), `src/pages/clients/ClientList.test.tsx` and `src/pages/company-cleaners/CompanyCleanerList.test.tsx`. Every Gate below was run on a scratch copy of exactly that tree (`2f7b909` with the same branch merged). Step 0 checks that no other branch with `src/` changes is open.
2. On `1f8b90d`: `pnpm lint` and `pnpm typecheck` are clean; `pnpm vitest run` gives `Test Files  23 passed (23)` and `Tests  147 passed (147)`.
3. Current `src/` tree, not counting `src/types/`, `src/test/`, `main.tsx`, `index.css`, `vite-env.d.ts`:
   - `src/App.tsx`; `src/providers/{accessControlProvider,authProvider}.ts` (+ tests), `src/providers/dataProvider.ts`; `src/lib/supabase.ts`; `src/components/Card.tsx`.
   - `src/components/color-motif/{ColorMotifSelect.tsx,ColorMotifSelect.test.tsx,ColorMotifTag.tsx}`; `src/features/color-motif/{colorMotif.ts,colorMotif.test.ts}`; `src/components/company/{CompanyTag.tsx,CompanyTag.test.tsx}`; `src/components/cleaning-jobs/` (FilterBar, FeedbackModal, TimeZonePicker + tests).
   - `src/features/integration/{api.ts,useIntegrationCheck.ts,integration.test.tsx}`; `src/features/users/{api.ts,api.test.ts,roles.ts}`; `src/features/cleaning-jobs/` (api, hooks, filterChips, timeZone, usePreferredTimeZone, cleanerName + tests).
   - `src/pages/<r>/` for `areas cleaners cleaning-jobs cleaning-statuses cleaning-types clients companies company-cleaners contacts dashboard items todos users`.
4. `src/features/integration/api.ts` lines 3 to 7 are exactly:
   ```ts
   import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
   import type { Database } from '@/types/database.types'
   import type { TodoStats } from '@/types/db'

   export type AppSupabaseClient = SupabaseClient<Database>
   ```
   `import type { AppSupabaseClient } from '@/features/integration/api'` is line 2 of `src/features/users/api.ts`, `src/features/users/api.test.ts`, `src/features/cleaning-jobs/api.ts` and `src/features/cleaning-jobs/api.test.ts`. `src/features/integration/integration.test.tsx` line 8 is `import { fetchTodoStats, type AppSupabaseClient } from '@/features/integration/api'`.
5. Only three relative imports exist in `src/` (besides `src/types/db.ts` → `./database.types`, which stays): `src/main.tsx` → `'./App'`, `src/pages/dashboard/DashboardPage.tsx` → `'./EdgeFunctionCard'` and `'./RpcCard'`, `src/pages/company-cleaners/CompanyCleanerList.tsx` → `'./companyFilter'`. No file uses `'../'`.
6. `vi.mock('@/lib/supabase', ...)`, `vi.mock('@/providers/authProvider', ...)` and `await import('@/providers/authProvider')` appear in tests; the import rewrite in Step 2 must match any `'@/...'` string, not only `from '...'` (a version that matched only `from` left `src/providers/authProvider.test.ts` broken).
7. `tsconfig.app.json` maps `@/*` to `./src/*` and includes `src`; `vite.config.ts` aliases `@` and runs Vitest on `src/**/*.test.{ts,tsx}` with `./src/test/setup.ts`. Neither needs a change. `index.html` loads `/src/main.tsx`, which stays where it is. `.github/workflows/ci.yml`, `package.json` scripts, `.prettierignore` and the ESLint ignore list only reference `src/types/database.types.ts`, which does not move.
8. ESLint is v10 flat config (`eslint.config.js`). `no-restricted-imports` supports `patterns: [{ regex, message }]`. Tested on 2026-11-27: the rule in Step 9 reports a cross-feature import, a `'../'` import, and `src/shared/` importing `@/app/...` or `@/features/...`, and allows a feature to import itself with `@/features/<own>/...`.
9. A `routes.tsx` that exports only a `FeatureModule` object holding JSX passes `react-refresh/only-export-components`. `<Routes>` accepts `<Fragment key=...>` children wrapping a `<Route>`, so `App.tsx` can map over the features (verified by the full Playwright run).
10. `pnpm format:check` (whole repo) already reports 7 files on `main`: `.claude/plans/backend/T3C-B5-Contacts-Table.md`, `T3C-B6-Clients-Table.md`, `T3C-F35-Cleaning-Jobs-List.md`, `.claude/plans/supabase-refine-starter.md`, `.github/pull_request_template.md`, `supabase/config.jsonc`, `tsconfig.json`. This plan does not fix them; its gates run Prettier only on the paths it touches.
11. `e2e/edge-function.spec.ts` needs `supabase functions serve` and the exchange stub (see README Notes). On 2026-11-27 they were not running locally, and that one test failed the same way on unmodified `main` (`Edge Function returned a non-2xx status code`). With them running it should pass.
12. `.claude/plans/backend/` holds 25 plans. `grep -rl "plans/backend"` finds that path in 25 of those plans and in `docs/architecture/0001`, `0002`, `0003`, `0004`, `0005`, `0007`. `.claude/plans/supabase-refine-starter.md` has no `backend` reference.
13. Stale code paths in docs: `docs/architecture/0004-Cleaning-Jobs-List-Function.md` lines 33 and 34 (`src/components/cleaning-jobs/`, `src/pages/cleaning-jobs/`); `docs/architecture/0007-Color-Motifs.md` lines 26, 37 and 54 (`src/features/color-motif/colorMotif.ts`, `src/components/color-motif/`, `src/components/company/CompanyTag.tsx`); `README.md` lines 71 to 81 (Layout) and 91 (checklist step 5); `AGENTS.md` lines 28 and 35. The highest architecture doc is `0007`, so the new one is `0008`.
14. The scripts below use `perl -pi -e` rather than `sed -i`, so they behave the same on macOS and Linux.

## Decisions already made (do not reopen)

1. **Layers and direction.** `src/app/` (composition) → `src/features/<feature>/` → `src/shared/` → `src/types/`. A feature never imports another feature or `src/app/`. `src/shared/` and `src/types/` never import a feature or `src/app/`. `src/app/` may import anything (its providers already use `@/features/users/roles`).
2. **One folder per feature, named after its route** (kebab case): `areas cleaners cleaning-jobs cleaning-statuses cleaning-types clients companies company-cleaners contacts dashboard items todos users`. Inside a feature: `routes.tsx`, `pages/` (only List, Create, Edit, Show and their tests), `components/` (any other component), and data access, hooks and helpers at the feature root. A feature creates `components/` only when it has one.
3. **`integration` becomes `dashboard`.** It is only used by the dashboard cards; the page and both cards move into the same feature.
4. **Shared code:** `src/shared/supabase.ts` (client and the `AppSupabaseClient` type, moved out of the dashboard feature), `src/shared/ui/Card.tsx`, `src/shared/color-motif/` (palette, select and tag), `src/shared/company/CompanyTag.tsx` (used by four features), `src/shared/featureModule.ts` (the contract a feature hands to the app).
5. **`src/types/` stays where it is**, including the hand-written aliases in `src/types/db.ts`. Moving the generated file would change CI, the scripts and two ignore lists for no gain; splitting `db.ts` per feature is Open question 1.
6. **No barrel `index.ts` files.** Imports name the file (`@/features/cleaning-jobs/hooks`), which keeps `vi.mock` paths exact and avoids import cycles. The boundary rule, not a barrel, defines what is private.
7. **Always import with `@/`; `../` is a lint error.** Same-folder `./x` stays allowed but the moved files no longer use it.
8. **Each feature exports one `FeatureModule`** from `routes.tsx` (`{ resource, routes }`). `src/app/features.ts` lists them once; that order is the sidebar order (unchanged from today).
9. **Tests move with their file** and stay next to it. Phase 1 is a pure move, so code and tests share its commit (the AGENTS rule "code and tests in separate commits" is for new behaviour).
10. **The boundary rule uses ESLint's built-in `no-restricted-imports`**, with the feature list read from `src/features/` at lint time. No new dependency (`eslint-plugin-boundaries` was considered and is not needed for three rules).
11. **`.claude/plans/` is flat.** The ticket id already names the area. Implemented plans are records and are not rewritten, except for the `plans/backend/` path.
12. **`supabase/` and `e2e/` keep their layout.** `supabase/` follows the Supabase CLI convention (`migrations/`, `seeds/`, `tests/database/`, `functions/<name>/`), and `e2e/` is small and flat.

### Open questions (do not block)

1. Should the feature-specific aliases in `src/types/db.ts` (for example `CleaningJobListRow`, `CleanerWithCompanies`) move into each feature's `types.ts`? Worth doing when a feature next changes its types; not needed for the boundaries.
2. Rename `.claude/plans/supabase-refine-starter.md` to the ticket naming (`T3C-NNN-Supabase-Refine-Starter.md`)?

## Out of scope

- Any behaviour, UI, SQL, migration, seed, edge function or e2e spec change.
- Splitting `src/types/db.ts` (Open question 1), moving `src/types/`.
- Fixing the 7 files Prettier already reports (Fact 10) or the local edge function setup (Fact 11).
- `supabase/`, `e2e/`, CI, `package.json`.
- Rewriting implemented plans beyond the `plans/backend/` path.

## Steps

### Phase 0: preconditions

#### Step 0. Branch and baseline

```bash
git switch main && git pull --ff-only
git status --short
git log --oneline main..feat/T3C-B15-B16-B18-B19-B26-B27-B33-F35-Cleaning-Jobs
git branch --no-merged main
git switch -c feat/T3C-R36-Refactor-Codebase
pnpm lint && pnpm typecheck && pnpm vitest run 2>&1 | grep -E "Test Files|Tests "
```

**Gate:** the commands above.

**Expect:** `git status --short` prints nothing (untracked plan files of other tickets are fine). The `git log` prints nothing (PR #8 is merged); if it prints commits, **stop and report**. `git branch --no-merged main` prints no branch that changes `src/` (check each with `git diff --stat main...<branch> -- src`); if one does, **stop and report**, because it will conflict with the moves. Lint and typecheck print no errors. Vitest prints `Test Files  23 passed (23)` and `Tests  147 passed (147)`.

No backup is needed: no data is touched and every step is in git.

### Phase 1: move files (no behaviour change)

#### Step 1. Move the files

Run from the repo root:

```bash
bash <<'EOF'
set -euo pipefail
# App shell
mkdir -p src/app
git mv src/App.tsx src/app/App.tsx
git mv src/providers src/app/providers
# Shared (used by more than one feature)
mkdir -p src/shared/ui src/shared/color-motif src/shared/company
git mv src/lib/supabase.ts src/shared/supabase.ts
git mv src/components/Card.tsx src/shared/ui/Card.tsx
for f in src/features/color-motif/* src/components/color-motif/*; do git mv "$f" src/shared/color-motif/; done
for f in src/components/company/*; do git mv "$f" src/shared/company/; done
# Dashboard = the old integration feature plus the dashboard page and its cards
mkdir -p src/features/dashboard/components src/features/dashboard/pages
for f in src/features/integration/*; do git mv "$f" src/features/dashboard/; done
git mv src/pages/dashboard/EdgeFunctionCard.tsx src/features/dashboard/components/EdgeFunctionCard.tsx
git mv src/pages/dashboard/RpcCard.tsx src/features/dashboard/components/RpcCard.tsx
git mv src/pages/dashboard/DashboardPage.tsx src/features/dashboard/pages/DashboardPage.tsx
# Cleaning jobs components
mkdir -p src/features/cleaning-jobs/components
for f in src/components/cleaning-jobs/*; do git mv "$f" src/features/cleaning-jobs/components/; done
# Company cleaners helper is not a page
mkdir -p src/features/company-cleaners
git mv src/pages/company-cleaners/companyFilter.ts src/features/company-cleaners/companyFilter.ts
git mv src/pages/company-cleaners/companyFilter.test.ts src/features/company-cleaners/companyFilter.test.ts
# Every remaining pages folder becomes src/features/<name>/pages/
for r in areas cleaners cleaning-jobs cleaning-statuses cleaning-types clients companies company-cleaners contacts items todos users; do
  mkdir -p src/features/$r/pages
  for f in src/pages/$r/*; do git mv "$f" src/features/$r/pages/; done
done
find src -type d -empty -delete
EOF
```

**Gate:**

```bash
ls src src/features
ls src/pages src/components src/lib src/providers src/features/integration src/features/color-motif 2>&1 | grep -c "No such file"
```

**Expect:** `ls src` lists exactly `app features index.css main.tsx shared test types vite-env.d.ts`. `ls src/features` prints the 13 names of Decision 2. The count line prints `6`. (Typecheck fails until Step 2; that is expected.)

#### Step 2. Rewrite the imports

```bash
bash <<'EOF'
set -euo pipefail
grep -rlE "'(@/|\./)" src --include='*.ts' --include='*.tsx' | xargs perl -pi -e '
  s#\x27\@/providers/#\x27\@/app/providers/#g;
  s#\x27\@/lib/supabase\x27#\x27\@/shared/supabase\x27#g;
  s#\x27\@/components/Card\x27#\x27\@/shared/ui/Card\x27#g;
  s#\x27\@/components/company/#\x27\@/shared/company/#g;
  s#\x27\@/components/color-motif/#\x27\@/shared/color-motif/#g;
  s#\x27\@/features/color-motif/#\x27\@/shared/color-motif/#g;
  s#\x27\@/features/integration/#\x27\@/features/dashboard/#g;
  s#\x27\@/pages/dashboard/(EdgeFunctionCard|RpcCard)\x27#\x27\@/features/dashboard/components/$1\x27#g;
  s#\x27\@/components/cleaning-jobs/#\x27\@/features/cleaning-jobs/components/#g;
  s#\x27\@/pages/company-cleaners/companyFilter\x27#\x27\@/features/company-cleaners/companyFilter\x27#g;
  s#\x27\@/pages/([a-z-]+)/#\x27\@/features/$1/pages/#g;
'
perl -pi -e 's#from \x27\./(EdgeFunctionCard|RpcCard)\x27#from \x27\@/features/dashboard/components/$1\x27#' src/features/dashboard/pages/DashboardPage.tsx
perl -pi -e 's#from \x27\./companyFilter\x27#from \x27\@/features/company-cleaners/companyFilter\x27#' src/features/company-cleaners/pages/CompanyCleanerList.tsx
perl -pi -e 's#from \x27\./App\x27#from \x27\@/app/App\x27#' src/main.tsx
EOF
```

**Gate:**

```bash
grep -rnE "@/(pages|components|lib|providers)/|@/features/(integration|color-motif)/|from '\./" src | grep -v "src/types/db.ts"
pnpm typecheck
```

**Expect:** the `grep` prints nothing. `pnpm typecheck` prints `$ tsc -b` and no error.

#### Step 3. Move `AppSupabaseClient` into the shared client

Replace the whole of `src/shared/supabase.ts` with:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// The typed client every feature's data access takes as an argument, so tests can pass a mock.
export type AppSupabaseClient = SupabaseClient<Database>

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill it in.',
  )
}

export const supabase: AppSupabaseClient = createClient<Database>(url, anonKey)
```

In `src/features/dashboard/api.ts` (anchor: line 3), find:

```ts
import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { TodoStats } from '@/types/db'

export type AppSupabaseClient = SupabaseClient<Database>
```

replace with:

```ts
import { FunctionsHttpError } from '@supabase/supabase-js'
import type { AppSupabaseClient } from '@/shared/supabase'
import type { TodoStats } from '@/types/db'
```

In `src/features/dashboard/integration.test.tsx` (anchor: line 8), find:

```ts
import { fetchTodoStats, type AppSupabaseClient } from '@/features/dashboard/api'
```

replace with:

```ts
import { fetchTodoStats } from '@/features/dashboard/api'
import type { AppSupabaseClient } from '@/shared/supabase'
```

Then, in the four files of Fact 4 (line 2 of each):

```bash
perl -pi -e 's#^import type \{ AppSupabaseClient \} from \x27\@/features/dashboard/api\x27$#import type { AppSupabaseClient } from \x27\@/shared/supabase\x27#' \
  src/features/users/api.ts src/features/users/api.test.ts \
  src/features/cleaning-jobs/api.ts src/features/cleaning-jobs/api.test.ts
```

**Gate:**

```bash
grep -rn "AppSupabaseClient" src | grep import | grep -v "@/shared/supabase"
grep -rn "@/features/dashboard/" src | grep -v "^src/features/dashboard/"
```

**Expect:** both print nothing.

#### Step 4. Phase 1 gate

```bash
pnpm lint && pnpm typecheck && pnpm exec prettier --check src && pnpm vitest run 2>&1 | grep -E "Test Files|Tests "
git add src && git diff --cached --name-only | grep -v '^src/'
```

**Expect:** no lint or type error; `All matched files use Prettier code style!`; `Test Files  23 passed (23)` and `Tests  147 passed (147)`. The last `grep` prints nothing (only `src/` is staged). Commit 1 (see Conventional commits).

### Phase 2: one routes module per feature

#### Step 5. The feature contract

Create `src/shared/featureModule.ts`:

```ts
import type { ResourceProps } from '@refinedev/core'
import type { ReactElement } from 'react'

// What a feature hands to src/app/App.tsx: its sidebar resource and its <Route> tree.
// The app lists every feature once in src/app/features.ts; the sidebar follows that order.
export interface FeatureModule {
  resource: ResourceProps
  routes: ReactElement
}
```

#### Step 6. Create the 13 `routes.tsx` files

Each `resource` is copied unchanged from today's `resources` array in `App.tsx`, and each `routes` from today's `<Routes>` block.

`src/features/dashboard/routes.tsx`:

```tsx
import { DashboardOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'

export const dashboardFeature: FeatureModule = {
  resource: {
    name: 'dashboard',
    list: '/',
    meta: { label: 'Dashboard', icon: <DashboardOutlined /> },
  },
  routes: <Route index element={<DashboardPage />} />,
}
```

`src/features/todos/routes.tsx`:

```tsx
import { CheckSquareOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { TodoList } from '@/features/todos/pages/TodoList'
import { TodoCreate } from '@/features/todos/pages/TodoCreate'
import { TodoEdit } from '@/features/todos/pages/TodoEdit'
import { TodoShow } from '@/features/todos/pages/TodoShow'

export const todosFeature: FeatureModule = {
  resource: {
    name: 'todos',
    list: '/todos',
    create: '/todos/create',
    edit: '/todos/edit/:id',
    show: '/todos/show/:id',
    meta: { label: 'Todos', icon: <CheckSquareOutlined /> },
  },
  routes: (
    <Route path="/todos">
      <Route index element={<TodoList />} />
      <Route path="create" element={<TodoCreate />} />
      <Route path="edit/:id" element={<TodoEdit />} />
      <Route path="show/:id" element={<TodoShow />} />
    </Route>
  ),
}
```

`src/features/users/routes.tsx`:

```tsx
import { TeamOutlined } from '@ant-design/icons'
import { CanAccess } from '@refinedev/core'
import { Navigate, Outlet, Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { UserEdit } from '@/features/users/pages/UserEdit'
import { UserList } from '@/features/users/pages/UserList'

export const usersFeature: FeatureModule = {
  resource: {
    name: 'profiles',
    list: '/users',
    edit: '/users/edit/:id',
    meta: { label: 'Users', icon: <TeamOutlined /> },
  },
  routes: (
    <Route
      path="/users"
      element={
        <CanAccess resource="profiles" action="list" fallback={<Navigate to="/" replace />}>
          <Outlet />
        </CanAccess>
      }
    >
      <Route index element={<UserList />} />
      <Route path="edit/:id" element={<UserEdit />} />
    </Route>
  ),
}
```

`src/features/companies/routes.tsx`:

```tsx
import { ShopOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { CompanyList } from '@/features/companies/pages/CompanyList'
import { CompanyCreate } from '@/features/companies/pages/CompanyCreate'
import { CompanyEdit } from '@/features/companies/pages/CompanyEdit'

export const companiesFeature: FeatureModule = {
  resource: {
    name: 'companies',
    list: '/companies',
    create: '/companies/create',
    edit: '/companies/edit/:id',
    meta: { label: 'Companies', icon: <ShopOutlined /> },
  },
  routes: (
    <Route path="/companies">
      <Route index element={<CompanyList />} />
      <Route path="create" element={<CompanyCreate />} />
      <Route path="edit/:id" element={<CompanyEdit />} />
    </Route>
  ),
}
```

`src/features/clients/routes.tsx`:

```tsx
import { SolutionOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { ClientList } from '@/features/clients/pages/ClientList'
import { ClientCreate } from '@/features/clients/pages/ClientCreate'
import { ClientEdit } from '@/features/clients/pages/ClientEdit'

export const clientsFeature: FeatureModule = {
  resource: {
    name: 'clients',
    list: '/clients',
    create: '/clients/create',
    edit: '/clients/edit/:id',
    meta: { label: 'Clients', icon: <SolutionOutlined /> },
  },
  routes: (
    <Route path="/clients">
      <Route index element={<ClientList />} />
      <Route path="create" element={<ClientCreate />} />
      <Route path="edit/:id" element={<ClientEdit />} />
    </Route>
  ),
}
```

`src/features/contacts/routes.tsx`:

```tsx
import { PhoneOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { ContactList } from '@/features/contacts/pages/ContactList'
import { ContactCreate } from '@/features/contacts/pages/ContactCreate'
import { ContactEdit } from '@/features/contacts/pages/ContactEdit'

export const contactsFeature: FeatureModule = {
  resource: {
    name: 'contacts',
    list: '/contacts',
    create: '/contacts/create',
    edit: '/contacts/edit/:id',
    meta: { label: 'Contacts', icon: <PhoneOutlined /> },
  },
  routes: (
    <Route path="/contacts">
      <Route index element={<ContactList />} />
      <Route path="create" element={<ContactCreate />} />
      <Route path="edit/:id" element={<ContactEdit />} />
    </Route>
  ),
}
```

`src/features/cleaners/routes.tsx`:

```tsx
import { UserOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { CleanerList } from '@/features/cleaners/pages/CleanerList'
import { CleanerCreate } from '@/features/cleaners/pages/CleanerCreate'
import { CleanerEdit } from '@/features/cleaners/pages/CleanerEdit'

export const cleanersFeature: FeatureModule = {
  resource: {
    name: 'cleaners',
    list: '/cleaners',
    create: '/cleaners/create',
    edit: '/cleaners/edit/:id',
    meta: { label: 'Cleaners', icon: <UserOutlined /> },
  },
  routes: (
    <Route path="/cleaners">
      <Route index element={<CleanerList />} />
      <Route path="create" element={<CleanerCreate />} />
      <Route path="edit/:id" element={<CleanerEdit />} />
    </Route>
  ),
}
```

`src/features/company-cleaners/routes.tsx`:

```tsx
import { LinkOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { CompanyCleanerList } from '@/features/company-cleaners/pages/CompanyCleanerList'
import { CompanyCleanerCreate } from '@/features/company-cleaners/pages/CompanyCleanerCreate'

export const companyCleanersFeature: FeatureModule = {
  resource: {
    name: 'company_cleaners',
    list: '/company-cleaners',
    create: '/company-cleaners/create',
    meta: { label: 'Company cleaners', icon: <LinkOutlined /> },
  },
  routes: (
    <Route path="/company-cleaners">
      <Route index element={<CompanyCleanerList />} />
      <Route path="create" element={<CompanyCleanerCreate />} />
    </Route>
  ),
}
```

`src/features/cleaning-types/routes.tsx`:

```tsx
import { TagsOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { CleaningTypeList } from '@/features/cleaning-types/pages/CleaningTypeList'
import { CleaningTypeCreate } from '@/features/cleaning-types/pages/CleaningTypeCreate'
import { CleaningTypeEdit } from '@/features/cleaning-types/pages/CleaningTypeEdit'

export const cleaningTypesFeature: FeatureModule = {
  resource: {
    name: 'cleaning_types',
    list: '/cleaning-types',
    create: '/cleaning-types/create',
    edit: '/cleaning-types/edit/:id',
    meta: { label: 'Cleaning types', icon: <TagsOutlined /> },
  },
  routes: (
    <Route path="/cleaning-types">
      <Route index element={<CleaningTypeList />} />
      <Route path="create" element={<CleaningTypeCreate />} />
      <Route path="edit/:id" element={<CleaningTypeEdit />} />
    </Route>
  ),
}
```

`src/features/cleaning-statuses/routes.tsx`:

```tsx
import { ClockCircleOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { CleaningStatusList } from '@/features/cleaning-statuses/pages/CleaningStatusList'
import { CleaningStatusCreate } from '@/features/cleaning-statuses/pages/CleaningStatusCreate'
import { CleaningStatusEdit } from '@/features/cleaning-statuses/pages/CleaningStatusEdit'

export const cleaningStatusesFeature: FeatureModule = {
  resource: {
    name: 'cleaning_statuses',
    list: '/cleaning-statuses',
    create: '/cleaning-statuses/create',
    edit: '/cleaning-statuses/edit/:id',
    meta: { label: 'Cleaning statuses', icon: <ClockCircleOutlined /> },
  },
  routes: (
    <Route path="/cleaning-statuses">
      <Route index element={<CleaningStatusList />} />
      <Route path="create" element={<CleaningStatusCreate />} />
      <Route path="edit/:id" element={<CleaningStatusEdit />} />
    </Route>
  ),
}
```

`src/features/areas/routes.tsx`:

```tsx
import { EnvironmentOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { AreaList } from '@/features/areas/pages/AreaList'
import { AreaCreate } from '@/features/areas/pages/AreaCreate'
import { AreaEdit } from '@/features/areas/pages/AreaEdit'

export const areasFeature: FeatureModule = {
  resource: {
    name: 'areas',
    list: '/areas',
    create: '/areas/create',
    edit: '/areas/edit/:id',
    meta: { label: 'Areas', icon: <EnvironmentOutlined /> },
  },
  routes: (
    <Route path="/areas">
      <Route index element={<AreaList />} />
      <Route path="create" element={<AreaCreate />} />
      <Route path="edit/:id" element={<AreaEdit />} />
    </Route>
  ),
}
```

`src/features/items/routes.tsx`:

```tsx
import { ToolOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { ItemList } from '@/features/items/pages/ItemList'
import { ItemCreate } from '@/features/items/pages/ItemCreate'
import { ItemEdit } from '@/features/items/pages/ItemEdit'

export const itemsFeature: FeatureModule = {
  resource: {
    name: 'items',
    list: '/items',
    create: '/items/create',
    edit: '/items/edit/:id',
    meta: { label: 'Items', icon: <ToolOutlined /> },
  },
  routes: (
    <Route path="/items">
      <Route index element={<ItemList />} />
      <Route path="create" element={<ItemCreate />} />
      <Route path="edit/:id" element={<ItemEdit />} />
    </Route>
  ),
}
```

`src/features/cleaning-jobs/routes.tsx`:

```tsx
import { CalendarOutlined } from '@ant-design/icons'
import { Route } from 'react-router'
import type { FeatureModule } from '@/shared/featureModule'
import { CleaningJobList } from '@/features/cleaning-jobs/pages/CleaningJobList'

export const cleaningJobsFeature: FeatureModule = {
  resource: {
    name: 'cleaning_jobs',
    list: '/cleaning-jobs',
    meta: { label: 'Cleaning Jobs', icon: <CalendarOutlined /> },
  },
  routes: (
    <Route path="/cleaning-jobs">
      <Route index element={<CleaningJobList />} />
    </Route>
  ),
}
```

#### Step 7. The feature list and the slim `App.tsx`

Create `src/app/features.ts`:

```ts
import type { FeatureModule } from '@/shared/featureModule'
import { areasFeature } from '@/features/areas/routes'
import { cleanersFeature } from '@/features/cleaners/routes'
import { cleaningJobsFeature } from '@/features/cleaning-jobs/routes'
import { cleaningStatusesFeature } from '@/features/cleaning-statuses/routes'
import { cleaningTypesFeature } from '@/features/cleaning-types/routes'
import { clientsFeature } from '@/features/clients/routes'
import { companiesFeature } from '@/features/companies/routes'
import { companyCleanersFeature } from '@/features/company-cleaners/routes'
import { contactsFeature } from '@/features/contacts/routes'
import { dashboardFeature } from '@/features/dashboard/routes'
import { itemsFeature } from '@/features/items/routes'
import { todosFeature } from '@/features/todos/routes'
import { usersFeature } from '@/features/users/routes'

// Every feature the app mounts. The sidebar shows them in this order.
export const features: FeatureModule[] = [
  dashboardFeature,
  todosFeature,
  usersFeature,
  companiesFeature,
  clientsFeature,
  contactsFeature,
  cleanersFeature,
  companyCleanersFeature,
  cleaningTypesFeature,
  cleaningStatusesFeature,
  areasFeature,
  itemsFeature,
  cleaningJobsFeature,
]
```

Replace the whole of `src/app/App.tsx` with:

```tsx
import { Authenticated, Refine } from '@refinedev/core'
import { AuthPage, ThemedLayout, ThemedTitle, useNotificationProvider } from '@refinedev/antd'
import '@refinedev/antd/dist/reset.css'
import routerProvider, {
  CatchAllNavigate,
  DocumentTitleHandler,
  UnsavedChangesNotifier,
} from '@refinedev/react-router'
import { ConfigProvider, theme } from 'antd'
import { Fragment } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router'
import { features } from '@/app/features'
import { accessControlProvider } from '@/app/providers/accessControlProvider'
import { authProvider } from '@/app/providers/authProvider'
import { refineDataProvider, refineLiveProvider } from '@/app/providers/dataProvider'

const resources = features.map((feature) => feature.resource)

export default function App() {
  return (
    <ConfigProvider theme={{ algorithm: [theme.defaultAlgorithm] }}>
      <Refine
        dataProvider={{ default: refineDataProvider }}
        liveProvider={refineLiveProvider}
        authProvider={authProvider}
        accessControlProvider={accessControlProvider}
        routerProvider={routerProvider}
        notificationProvider={useNotificationProvider}
        resources={resources}
        options={{
          liveMode: 'auto',
          syncWithLocation: true,
          disableTelemetry: true,
          projectId: 'dispatch-tracker',
        }}
      >
        <Routes>
          <Route
            element={
              <Authenticated key="authenticated-inner" fallback={<CatchAllNavigate to="/login" />}>
                <ThemedLayout Title={ThemedTitle}>
                  <div className="app-content">
                    <Outlet />
                  </div>
                </ThemedLayout>
              </Authenticated>
            }
          >
            {features.map((feature) => (
              <Fragment key={feature.resource.name}>{feature.routes}</Fragment>
            ))}
          </Route>

          <Route
            element={
              <Authenticated key="authenticated-outer" fallback={<Outlet />}>
                <Navigate to="/" replace />
              </Authenticated>
            }
          >
            <Route path="/login" element={<AuthPage type="login" />} />
            <Route path="/register" element={<AuthPage type="register" />} />
          </Route>
        </Routes>
        <UnsavedChangesNotifier />
        <DocumentTitleHandler />
      </Refine>
    </ConfigProvider>
  )
}
```

#### Step 8. Phase 2 gate (includes the browser tests)

Start the local stack and, for the edge function test, the function server and stub as in README Notes. Then:

```bash
pnpm lint && pnpm typecheck && pnpm exec prettier --check src && pnpm vitest run 2>&1 | grep -E "Test Files|Tests "
pnpm test:e2e 2>&1 | tail -4
```

**Expect:** no lint or type error; Prettier clean; `Test Files  23 passed (23)`, `Tests  147 passed (147)`; Playwright `21 passed`. If only `e2e/edge-function.spec.ts` fails with `Edge Function returned a non-2xx status code`, run it on `main` too (Fact 11); if it fails there the same way, note it in the report and continue; otherwise **stop and report**. Sign in as `superadmin@example.com` with `pnpm dev` and check that the sidebar shows the same 13 items in the same order as on `main`. Commit 2.

### Phase 3: enforce the boundaries

#### Step 9. ESLint rule

In `eslint.config.js` (anchor: line 7), find:

```js
import { defineConfig, globalIgnores } from 'eslint/config'
```

replace with:

```js
import { defineConfig, globalIgnores } from 'eslint/config'
import { readdirSync } from 'node:fs'

// One folder per feature under src/features/. Read at lint time so a new feature is covered at once.
const featureNames = readdirSync(new URL('./src/features', import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

const noParentImports = {
  regex: '^\\.\\./',
  message: "Import with the '@/' alias, not '../'.",
}
const noAppImports = {
  regex: '^@/app(/|$)',
  message: 'src/app/ composes the features. A feature or src/shared/ must not import it.',
}
```

Then find (anchor: the last config block):

```js
  {
    files: ['*.config.{js,ts}', 'e2e/**/*.ts', 'tests/**/*.ts'],
```

replace with:

```js
  // Layer boundaries: app -> features -> shared -> types. See docs/architecture/0008-Feature-Folders.md.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [noParentImports] }] },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}', 'src/types/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noParentImports,
            noAppImports,
            {
              regex: '^@/features(/|$)',
              message: 'src/shared/ and src/types/ must not import a feature.',
            },
          ],
        },
      ],
    },
  },
  ...featureNames.map((name) => ({
    files: [`src/features/${name}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noParentImports,
            noAppImports,
            {
              regex: `^@/features/(?!${name}(/|$))`,
              message: `A feature imports only itself and src/shared/. Move code that ${name} shares with another feature to src/shared/.`,
            },
          ],
        },
      ],
    },
  })),
  {
    files: ['*.config.{js,ts}', 'e2e/**/*.ts', 'tests/**/*.ts'],
```

(The later blocks must come after the general `src/**` block: in flat config the last matching block sets the rule, and each later block repeats `noParentImports` for that reason.)

#### Step 10. Phase 3 gate (rule works both ways)

```bash
pnpm lint && pnpm exec prettier --check eslint.config.js
printf "import { CompanyList } from '@/features/companies/pages/CompanyList'\nexport const a = CompanyList\n" > src/features/areas/zzBoundary.ts
printf "import { features } from '@/app/features'\nimport { NO_COMPANY } from '@/features/company-cleaners/companyFilter'\nexport const b = [features, NO_COMPANY]\n" > src/shared/zzBoundary.ts
printf "import { NO_COMPANY } from '@/features/company-cleaners/companyFilter'\nimport { matchesCompanyFilter } from '../companyFilter'\nexport const c = [NO_COMPANY, matchesCompanyFilter]\n" > src/features/company-cleaners/pages/zzBoundary.ts
pnpm exec eslint src/features/areas/zzBoundary.ts src/shared/zzBoundary.ts src/features/company-cleaners/pages/zzBoundary.ts | grep -c "no-restricted-imports"
rm src/features/areas/zzBoundary.ts src/shared/zzBoundary.ts src/features/company-cleaners/pages/zzBoundary.ts
git status --short | grep zzBoundary
```

**Expect:** lint clean on the real code; Prettier clean. The count prints `4` (areas → companies; shared → app; shared → feature; `../`). The own-feature import on line 1 of the third file is **not** reported. The last line prints nothing. Commit 3.

### Phase 4: flat plans folder

#### Step 11. Move the plans

```bash
git mv .claude/plans/backend/*.md .claude/plans/
rmdir .claude/plans/backend
perl -pi -e 's#\.claude/plans/backend/#.claude/plans/#g' docs/architecture/*.md .claude/plans/T3C-[BFS]*.md
```

(The glob `T3C-[BFS]*` leaves this plan, `T3C-R36-...`, untouched.)

#### Step 12. Phase 4 gate

```bash
grep -rn "plans/backend" docs .claude/plans README.md AGENTS.md | grep -v "T3C-R36-Refactor-Codebase.md"
ls .claude/plans | wc -l
git diff --stat -- docs .claude/plans | tail -1
```

**Expect:** the `grep` prints nothing; `27` files (25 moved + `supabase-refine-starter.md` + this plan); the stat line shows the same number of insertions and deletions. Commit 4.

### Phase 5: document the layout

#### Step 13. Fix stale paths in the architecture docs

```bash
perl -pi -e '
  s#src/components/cleaning-jobs/#src/features/cleaning-jobs/components/#g;
  s#src/pages/cleaning-jobs/#src/features/cleaning-jobs/pages/#g;
  s#src/features/color-motif/#src/shared/color-motif/#g;
  s#src/components/color-motif/#src/shared/color-motif/#g;
  s#src/components/company/#src/shared/company/#g;
' docs/architecture/0004-Cleaning-Jobs-List-Function.md docs/architecture/0007-Color-Motifs.md
```

#### Step 14. `AGENTS.md`

Find line 28 (starts with `- Follow the existing structure:`) and replace the whole line with:

```md
- Follow the feature-folder layout ([0008](docs/architecture/0008-Feature-Folders.md)). `src/app/` only composes: `App.tsx`, `features.ts` (the feature list, which is the sidebar order) and the Refine providers in `app/providers/`. `src/features/<feature>/` owns everything for one feature: `routes.tsx` (its Refine resource and `<Route>` tree), `pages/` (**only** the List, Create, Edit and Show pages and their tests), `components/` (any other component: filter bars, modals, pickers), and its data access, hooks and helpers at the feature root. `src/shared/` holds code used by two or more features (`supabase.ts`, `ui/`, `color-motif/`, `company/`, `featureModule.ts`). Imports go one way, `app → features → shared → types`: a feature never imports another feature or `src/app/`, and `src/shared/` never imports a feature. ESLint enforces this; when two features need the same code, move it to `src/shared/` rather than disabling the rule. Import with `@/`, never `../`. Tests sit next to the file they test. Use the generated `Tables<'...'>` types; never hand-edit `src/types/database.types.ts` (run `pnpm db:types`).
```

Find line 35 (starts with `- Plans are tracked in`) and replace the whole line with:

```md
- Plans are tracked in `.claude/plans/` with no subfolders, one per ticket, named `<TICKET>-Short-Name.md`. When a plan covers several tickets the name lists every number (`T3C-B7-S8-Short-Name.md`). Work with no ticket yet uses `NNN` (`T3C-NNN-Short-Name.md`). An implemented plan is a record of what was done: its code paths may predate a later restructure, so check the code and `docs/architecture/` before reusing them.
```

#### Step 15. `README.md`

At the end of line 34 (ends with `[0007 Color motifs](docs/architecture/0007-Color-Motifs.md).`), find:

```md
Pill colours: [0007 Color motifs](docs/architecture/0007-Color-Motifs.md).
```

replace with:

```md
Pill colours: [0007 Color motifs](docs/architecture/0007-Color-Motifs.md). Code layout: [0008 Feature folders](docs/architecture/0008-Feature-Folders.md).
```

In the Layout block, find (lines 71 to 81):

```
src/
  lib/supabase.ts              typed client
  types/                       generated DB types + helpers (db.ts)
  providers/                   Refine data/live provider, auth provider
  features/integration/        data access + hooks for dashboard checks
  features/users/              role ids and the Super Admin user update call
  features/cleaning-jobs/      data access, React Query hooks and helpers for the Cleaning Jobs list
  features/color-motif/        the pill colour palette (COLOR_MOTIFS) shared by every list and form
  components/<feature>/        components used by a page that are not a page (filter bars, modals, pickers)
  pages/dashboard, pages/todos, pages/users, pages/companies, pages/clients, pages/contacts, pages/cleaners, pages/company-cleaners
                               (a pages folder holds only Create, Edit and List pages)
```

replace with:

```
src/
  main.tsx                     entry point, mounts src/app/App.tsx
  app/                         composition only, imports features
    App.tsx                    Refine, layout and the routes of every feature
    features.ts                the feature list (its order is the sidebar order)
    providers/                 Refine data/live, auth and access control providers
  features/<feature>/          one folder per feature: areas, cleaners, cleaning-jobs, cleaning-statuses,
                               cleaning-types, clients, companies, company-cleaners, contacts, dashboard,
                               items, todos, users. Never imports another feature.
    routes.tsx                 the feature's Refine resource and <Route> tree (a FeatureModule)
    pages/                     only List, Create, Edit and Show pages, and their tests
    components/                any other component of the feature (filter bars, modals, pickers)
    api.ts, hooks.ts, *.ts     data access (takes the client as an argument), React Query hooks, helpers
  shared/                      used by two or more features; never imports a feature
    supabase.ts                typed client and AppSupabaseClient
    featureModule.ts           the { resource, routes } contract each feature exports
    ui/                        generic UI wrappers (Card)
    color-motif/               the pill colour palette (COLOR_MOTIFS), ColorMotifSelect, ColorMotifTag
    company/                   CompanyTag, the company pill
  types/                       generated DB types + helpers (db.ts)
  test/setup.ts                Vitest setup
```

Find line 91 (starts with `5. Resource:`) and replace the whole line with:

```md
5. Feature: create `src/features/<table>/` with `pages/` (only List, Create, Edit and Show; any other component goes in `src/features/<table>/components/`) using `useTable`, `useForm` and `useShow` with `Tables<'<table>'>`, and a `routes.tsx` that exports a `FeatureModule` (follow `src/features/areas/routes.tsx`). Add it to the `features` array in `src/app/features.ts`; its position there is its place in the sidebar. Code used by another feature too goes in `src/shared/`.
```

#### Step 16. Architecture doc

Create `docs/architecture/0008-Feature-Folders.md`:

```md
# 0008 Feature folders: one folder per feature, imports in one direction

- Ticket: T3C-R36
- Plan: `.claude/plans/T3C-R36-Refactor-Codebase.md`
- Date: 2026-11-27
- Status: implemented

## Context

The web code was split by kind (`src/pages/`, `src/components/`, `src/features/`), and only some
features used all three, so a feature such as Cleaning Jobs lived in three trees. `src/App.tsx`
listed every resource, page and route by hand. Nothing stopped a feature from importing another
(`users` and `cleaning-jobs` imported the client type from the dashboard's `integration` folder).

## Decision

- `src/app/` composes the app: `App.tsx`, `features.ts` (the list of features, in sidebar order)
  and the Refine providers. Features and shared code never import `src/app/`.
- `src/features/<feature>/` owns one feature: `routes.tsx` exports a `FeatureModule`
  (`{ resource, routes }`, see `src/shared/featureModule.ts`), `pages/` holds only the List, Create,
  Edit and Show pages, `components/` holds any other component, and data access, hooks and helpers
  sit at the feature root. Tests sit next to their file.
- `src/shared/` holds code that two or more features use: the typed Supabase client and
  `AppSupabaseClient`, UI wrappers, the colour palette and the company pill.
- `src/types/` keeps the generated `database.types.ts` and the aliases in `db.ts`.
- Imports go `app → features → shared → types`. ESLint (`no-restricted-imports` in
  `eslint.config.js`) fails the lint when a feature imports another feature or `src/app/`, when
  `src/shared/` or `src/types/` imports a feature or `src/app/`, or when any file uses `../`. The
  feature list for the rule is read from `src/features/` at lint time.
- No barrel `index.ts` files: imports name the file, which keeps `vi.mock` paths exact.

## Consequences

- Adding a table's screens touches one new folder and one line in `src/app/features.ts`.
- When two features need the same code it moves to `src/shared/`; the lint error says so.
- `supabase/` (Supabase CLI layout) and `e2e/` are unchanged.
- Plans live flat in `.claude/plans/`; implemented plans keep the paths they were written with.
```

**Gate (Phase 5):**

```bash
grep -rnE "src/(pages|components|lib|providers)/|src/App\.tsx|src/features/(integration|color-motif)" README.md AGENTS.md docs | grep -v "0008-Feature-Folders.md"
pnpm exec prettier --check README.md AGENTS.md docs
pnpm test:all
```

**Expect:** the `grep` prints nothing; Prettier clean; `pnpm test:all` passes (same results as Step 8 for e2e, pgTAP as on `main`). Commit 5.

## Rollback

No data or schema changes. Before merge: `git switch main && git branch -D feat/T3C-R36-Refactor-Codebase`. After merge: `git revert -m 1 <merge commit>`. A branch opened before this lands: rebase it on `main`, apply each conflicting change to the file's new path (Step 1 is the map), then run the Step 2 script on the branch to fix its imports and run `pnpm lint`.

## Conventional commits

Branch: `feat/T3C-R36-Refactor-Codebase`. Every footer: `Refs: T3C-R36`, then the `Co-Authored-By` line on agent commits.

0. `docs(plans): add the T3C-R36 refactor codebase plan`: `.claude/plans/T3C-R36-Refactor-Codebase.md`.
1. `refactor(web): move pages and components into feature folders`: `src` (Phase 1; check `git status` shows only `src/`).
2. `refactor(web): give each feature its own routes module`: `src/app/App.tsx src/app/features.ts src/shared/featureModule.ts src/features/*/routes.tsx`.
3. `build(web): enforce feature folder import boundaries in ESLint`: `eslint.config.js`.
4. `docs(plans): move the plans out of the backend folder`: `.claude/plans docs/architecture` (only the renames and the `plans/backend` path edits of Step 11).
5. `docs(agents): document the feature folder layout`: `AGENTS.md README.md docs/architecture/0004-Cleaning-Jobs-List-Function.md docs/architecture/0007-Color-Motifs.md docs/architecture/0008-Feature-Folders.md`.

PR title: `refactor(web): reorganise src into feature folders`. Body from `.github/pull_request_template.md` (Type: Code refactor, Documentation), ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Merge with a merge commit.
