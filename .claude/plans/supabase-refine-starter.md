# Plan: Supabase + Refine starter

## Decisions to confirm
- **Package manager:** pnpm.
- **react-router:** v7 with `@refinedev/react-router`.
- **Supabase:** local-first via CLI and Docker.
- **Sample domain:** `profiles` + `todos`.
- **External API:** [Frankfurter](https://frankfurter.dev), `GET https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR`.
  - Free, no API key, no signup, and it serves JSON with CORS.
  - A key-less API means no secrets to manage in the starter.
  - Fallback if you'd rather use something else: Open-Meteo (weather).

## Phase 1: Scaffold
1. `pnpm create vite . --template react-ts`
2. Set strict TS, the `@/` path alias in `vite.config.ts` and `tsconfig`, and ESLint + Prettier.
3. Install:
   - `@refinedev/core @refinedev/antd @refinedev/supabase @refinedev/react-router antd @ant-design/icons react-router`
   - `@supabase/supabase-js`
4. Add `.env.example` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Gitignore `.env*`.

## Phase 2: Supabase backend
1. `supabase init`, then `supabase start`.
2. Migration `0001_init.sql`:
   - `profiles` (id → `auth.users`, display name, role).
   - Trigger on `auth.users` insert to create the profile.
   - `todos` (id, `user_id`, title, done, `created_at`).
3. **RLS**
   - Enable RLS on every table.
   - `profiles`: select own row, update own row.
   - `todos`: CRUD only where `user_id = auth.uid()`.
   - Add an `is_admin()` security-definer helper for admin override policies.
4. **Realtime:** `alter publication supabase_realtime add table todos;`
5. `supabase/seed.sql` with test users (admin + normal user).
6. **Auth config:** email/password in `config.toml`. Leave the OAuth stub commented out.

### RPC: migration `0002_todo_stats.sql`
```sql
create or replace function public.todo_stats()
returns table (total int, done int, pending int, pct_done numeric)
language sql
stable
security invoker          -- RLS still applies, so each user sees only their own counts
set search_path = public
as $$
  select
    count(*)::int,
    count(*) filter (where done)::int,
    count(*) filter (where not done)::int,
    coalesce(round(100.0 * count(*) filter (where done) / nullif(count(*), 0), 1), 0)
  from public.todos;
$$;

revoke execute on function public.todo_stats() from public, anon;
grant  execute on function public.todo_stats() to authenticated;
```
- Returns the totals for the caller. Because it's `security invoker`, RLS filters the rows. The pgTAP test proves this.
- The `revoke`/`grant` pair means anon can't call it.

### Edge function: `supabase/functions/exchange-rate`
- Verifies the caller's JWT (`verify_jwt = true` in `config.toml`).
- Reads `?base=USD&symbol=EUR`, validates against a regex allowlist (`^[A-Z]{3}$`), rejects anything else with 400.
- Calls `${EXCHANGE_API_URL ?? "https://api.frankfurter.dev"}/v1/latest?...` with `fetch`.
- **Timeout and errors:**
  - 5s `AbortSignal.timeout`.
  - Upstream failure returns 502 with `{ error }`.
- **Response:** `{ base, symbol, rate, date, fetchedAt, source: "frankfurter" }`.
- CORS headers and `OPTIONS` handled.
- `EXCHANGE_API_URL` is overridable so tests can point it at a stub.
- Optional: use the caller's JWT to write a row to a `rate_checks` table (user, pair, rate, timestamp). Proves the function talks to the DB as well as the internet. Drop it for a leaner starter.

## Phase 3: Typed models
1. Script: `"db:types": "supabase gen types typescript --local > src/types/database.types.ts"`
2. `src/lib/supabase.ts` uses `createClient<Database>()`.
3. `src/types/db.ts` exports helpers: `Tables<'todos'>`, `TablesInsert<'todos'>`, `TablesUpdate<'todos'>`.
4. `supabase.rpc('todo_stats')` is fully typed from `Database['public']['Functions']`.
   Export `type TodoStats = Database['public']['Functions']['todo_stats']['Returns'][number]`.
5. Use these types in Refine resources and hooks (`useTable<Tables<'todos'>>`).
6. Add `"db:reset": "supabase db reset && pnpm db:types"`.
7. CI step: regenerate types, then `git diff --exit-code` to catch drift.

## Phase 4: Refine app
1. `App.tsx`:
   - `<Refine>` with the Supabase `dataProvider` and `liveProvider`.
   - A custom `authProvider` (login, register, logout, `check`, `getIdentity`, `onError`) on supabase-js.
   - `routerProvider` from `@refinedev/react-router`.
   - AntD `ThemedLayout` and `useNotificationProvider`.
   - `liveMode: "auto"`.
2. Routes:
   - `/login` and `/register`
   - `/` dashboard
   - `/todos` (list, create, edit, show)
   - an `Authenticated` wrapper redirecting to `/login`
3. Todo pages use `useTable`, `useForm`, `useShow` with AntD `Table`/`Form`. Realtime updates show in the list without a refetch.
4. Optional: an `accessControlProvider` that reads the role from `profiles`.

### Dashboard "Integration checks" card
Two `Card`s, each with a button:

| Button | Call | Shows |
|---|---|---|
| **Invoke edge function** | `supabase.functions.invoke('exchange-rate', { USD→EUR })` | rate, date, latency in ms, success/error `Alert` |
| **Call RPC** | `supabase.rpc('todo_stats')` | total, done, pending, `Progress` bar of `pct_done` |

- Each button has a loading state, an error state and `data-testid`s (`btn-invoke-edge`, `btn-call-rpc`, `result-edge`, `result-rpc`) for Playwright.
- Wrap each call in a hook under `src/features/integration/`. Keep supabase calls out of the components.

## Phase 5: Testing

### pgTAP, `supabase/tests/database/` (`supabase test db`)
- RLS enabled on all tables.
- User A can't read or write user B's todos.
- Anon is denied.
- Profile trigger fires.
- Admin override works.
- **RPC** `todo_stats.test.sql`:
  - Seed 3 todos (1 done) as user A and 1 as user B.
  - As A: `total=3, done=1, pending=2, pct_done=33.3`.
  - As B: sees only their own counts, proving `security invoker` + RLS.
  - Empty user returns `0,0,0,0`, no divide-by-zero.
  - `anon` gets permission denied.

### Deno, edge function
- `index.test.ts` stubs `globalThis.fetch`:
  - happy path returns the shaped response
  - invalid `symbol` returns 400
  - upstream 500 returns 502
  - timeout returns 502
- No network in these tests.

### Vitest
- Install `vitest jsdom @testing-library/react @testing-library/jest-dom`.
- Unit-test `authProvider` with a mocked supabase client.
- Component-test a page with a mocked `dataProvider`.
- Unit-test the integration hooks and the two button components with a mocked supabase client:
  - loading, success and error states
  - the RPC progress renders `33.3`

### Playwright
- `playwright.config.ts` with `webServer: pnpm dev`.
- Global setup logs in as the seeded user and saves `storageState`.
- Specs: login redirect, todo CRUD, and two browser contexts to prove realtime.
- **`rpc.spec.ts`:** seed todos, click `btn-call-rpc`, assert counts match.
- **`edge-function.spec.ts`:** click `btn-invoke-edge`, assert a numeric rate is displayed.
- **External-API caveat:** the edge function runs server-side in Docker, so Playwright can't intercept its outbound fetch. Two options:
  - **A (recommended):** the e2e run starts a tiny stub server and sets `EXCHANGE_API_URL` for `supabase functions serve --env-file`. Deterministic and offline.
  - **B:** hit the real API. Tag it `@external` and run it as a non-blocking CI job, since it breaks if Frankfurter is down.

### Scripts
`test`, `test:db`, `test:fn` (`deno test`), `test:e2e`, `test:all`.

## Phase 6: DX and CI
1. GitHub Actions:
   - `supabase/setup-cli`
   - `supabase start`
   - types drift check
   - lint and typecheck
   - `supabase test db`
   - `deno test` for the function
   - vitest
   - start the stub server, then playwright, with the report uploaded as an artifact
2. README: setup steps, scripts table, "how to add a new table" (migration → RLS → pgTAP → types → resource), and a table of the two test buttons:
   - Edge button proves: JWT passes through, outbound network works, secrets and env work.
   - RPC button proves: SQL logic runs, RLS applies to the RPC, types flow end to end.
3. Optional: husky + lint-staged, and a `supabase db lint` step.

## Layout
```
supabase/{config.toml,migrations/{0001_init,0002_todo_stats},functions/exchange-rate,tests/database,seed.sql}
src/{lib,types,providers,features/integration,pages/{dashboard,todos}}
e2e/{stub-exchange-server.ts,*.spec.ts}  tests/
```

## Verification checklist
- `supabase start && pnpm db:reset` runs clean, and the generated types include `todo_stats`.
- `pnpm dev`: register, log in, create a todo.
- A second tab shows the change live.
- A second user can't see the first user's todos.
- Dashboard **Call RPC** shows counts that match the todos list.
- Dashboard **Invoke edge function** shows a live USD→EUR rate.
- A second user's RPC counts don't include the first user's todos.
- An unauthenticated `curl` to the function returns 401.
- `pnpm test:all` is green offline, using the stub.
- `git diff` is empty after `db:types`.

## Risks
- Docker is required locally, and the function needs a Docker network route to the internet.
- `@refinedev/supabase` is loosely typed, so cast at the provider boundary.
- Pin the `@refinedev/*` and antd versions together. Refine lags new antd majors.
- Realtime needs the table in the publication, and RLS also filters realtime events.
- The Frankfurter free tier may rate-limit. The stub and the unit tests avoid depending on it in CI.
- `security invoker` is the safe default for the RPC. Switching to `security definer` would bypass RLS, so the pgTAP isolation test guards against that.
