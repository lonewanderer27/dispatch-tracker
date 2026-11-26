# Implementation plan (Haiku-ready): Supabase + Refine starter

Same scope as `.claude/plans/supabase-refine-starter.md`, rewritten so a smaller model can execute it mechanically: exact commands, full file contents, one verification per step, no open decisions.

## 0. Rules for the executor (read first)

1. Do the steps **in order**. Do not skip, merge, or reorder.
2. Copy file contents **exactly** as given. Do not "improve" them.
3. After each step, run its **Verify** command. If the output does not match, go to **If it fails**. Do **not** continue to the next step.
4. **Stop and report** (do not guess) if: a command fails twice, a package prints a peer-dependency warning, or a file/export named in this plan does not exist.
5. Never commit `.env*` files. Never print secrets.
6. Working directory for every command: `/Users/lonewanderer27/Documents/The Tidy Team Cleaning Inc/dispatch-tracker` (call it `$ROOT`).
7. Tool use: use the file Write/Edit tools to create files, not `echo`/heredocs.
8. At the end, report: steps done, steps skipped, any deviation, and the output of the final acceptance checklist (section 4).

## 0.1 Environment principles (apply to every step)

1. **Local-first.** The local Supabase stack (Docker) is the primary environment. Every feature must be built, run, and fully tested locally (`pnpm test:all`) with **no cloud account and no internet** (except the optional real-API call from the dashboard button). Nothing in tests or dev scripts may depend on SIT.
2. **SIT second.** SIT is a separate, cloud-hosted Supabase project used for integration testing. It is reached **only** through the explicit `sit:*` scripts and the CI deploy job (Step 18). It is never the default target of any command.
3. **One source of truth.** Schema lives only in `supabase/migrations/`. Local and SIT are both produced from the same migrations. Types are generated from the **local** DB.
4. **SIT is optional and guarded.** Do Step 18 only if the user supplies a SIT project ref. If not, skip it, say so in the report, and finish everything else. **Never** run `db reset`, `db push`, or `functions deploy` against SIT unless the user has confirmed the project ref in this conversation.

| | Local (default) | SIT |
|---|---|---|
| Backend | `pnpm supabase start` (Docker) | Supabase cloud project (separate from prod) |
| Frontend env file | `.env` | `.env.sit` (used via `--mode sit`) |
| Schema applied by | `pnpm supabase db reset` | `pnpm supabase db push` (migrations only, no seed) |
| Edge function | `pnpm supabase functions serve` | `pnpm supabase functions deploy` |
| `EXCHANGE_API_URL` | unset (real API) or stub (e2e) | unset (real API) |
| Tests run against it | all (unit, fn, pgTAP, e2e) | smoke only (manual or CI) |

## 1. Decisions already made (do not revisit)

| Topic | Choice |
|---|---|
| Environments | **Local first** (default), then **SIT** (separate cloud project, optional, Step 18) |
| Package manager | pnpm |
| Router | `react-router` v7 + `@refinedev/react-router` |
| Backend | Supabase local via Docker. CLI is a pnpm devDependency, run as `pnpm supabase ...` (no Homebrew, no global install) |
| Sample tables | `profiles`, `todos` |
| External API | Frankfurter: `https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR` (free, no key) |
| e2e external API handling | **Option A**: local stub server on port 4010 (deterministic, offline) |
| Dev server | `http://127.0.0.1:3000` (matches `site_url` already in `supabase/config.jsonc`) |
| Admin roles / accessControl / `rate_checks` table | **Out of scope** |

### Pinned versions (verified on npm 2026-11-25)

| Package | Version range | Note |
|---|---|---|
| `@refinedev/core` | `^5` | needs `@tanstack/react-query` `^5.81.5` |
| `@refinedev/antd` | `^6` | **requires `antd` `^5.23`. Do NOT install antd 6.** |
| `@refinedev/supabase` | `^6` | |
| `@refinedev/react-router` | `^2` | needs `react-router` `^7` |
| `antd` | `^5.23` | |
| `@supabase/supabase-js` | `^2` | |
| Supabase CLI | `3.4.0` | config file is `supabase/config.jsonc` (not `.toml`) |

### Current project state (already true)

- `$ROOT/supabase/config.jsonc` exists (from `supabase init`). `email.enable_confirmations` is `false`. `realtime` and `edge_runtime` are enabled.
- `$ROOT/README.md` and `$ROOT/AGENTS.md` exist and are empty.
- Node 24, pnpm 10, Docker, and Deno are installed. **The `supabase` CLI is NOT installed globally**; Step 3 adds it as a devDependency.
- There is no `package.json` and no `src/`.

---

## 2. Steps

### Step 1. Check prerequisites

The Supabase CLI is installed per-project through pnpm in Step 3 (no Homebrew, no global install). Every CLI command in this plan is run as `pnpm supabase ...`.

```bash
node -v && pnpm -v && docker --version && deno --version
```
**Verify:** all four print a version (Node 20.19+ or 22.12+, pnpm 10+, Docker, Deno 2.x).
**If it fails:** stop and report which tool is missing. Docker Desktop must also be running (`docker info` succeeds).

### Step 2. Scaffold Vite (into a temp folder, then copy)

The project folder is non-empty, so scaffold elsewhere and copy.

```bash
cd "$ROOT"
pnpm create vite@latest scaffold-tmp --template react-ts --no-interactive
cp -R scaffold-tmp/. .
rm -rf scaffold-tmp
pnpm install
```
**Verify:** `ls "$ROOT"` shows `package.json`, `src`, `vite.config.ts`, `tsconfig.app.json`, and `supabase`.
**If it fails:** if a prompt appears, choose **React** then **TypeScript**. If `--no-interactive` is rejected, drop that flag.

Then remove template junk:
```bash
rm -f src/App.css src/assets/react.svg public/vite.svg
```

### Step 3. Install dependencies

```bash
pnpm add react-router@^7 antd@^5.23 @ant-design/icons@^5 dayjs \
  @refinedev/core@^5 @refinedev/antd@^6 @refinedev/supabase@^6 @refinedev/react-router@^2 \
  @tanstack/react-query@^5 @supabase/supabase-js@^2

pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  @playwright/test dotenv

pnpm exec playwright install chromium
```

Install the Supabase CLI as a dev dependency. pnpm 10 blocks dependency install scripts by default, and the CLI needs its postinstall to download the binary, so allow it:
```bash
pnpm add -D supabase@^3.4.0
```
If pnpm prints "Ignored build scripts: supabase", create `$ROOT/pnpm-workspace.yaml` with:
```yaml
onlyBuiltDependencies:
  - supabase
  - esbuild
```
then run `pnpm rebuild supabase`. (If your pnpm rejects that key, run `pnpm approve-builds`, select `supabase` with space, press Enter, and confirm.)

**Verify:**
- `pnpm supabase --version` prints a version starting with `3.`.
- `pnpm ls antd @refinedev/antd @refinedev/core` shows `antd 5.x` (**not 6.x**), `@refinedev/antd 6.x`, `@refinedev/core 5.x`.

**If it fails:** if `antd` resolved to 6.x, run `pnpm add antd@^5.23` and re-verify. If any peer warning remains, stop and report it. If `pnpm supabase --version` says the binary is missing, redo the `onlyBuiltDependencies` fix above; if still failing, stop and report (do **not** fall back to Homebrew without asking the user).

Note: inside `package.json` scripts, write plain `supabase ...` (pnpm adds `node_modules/.bin` to the PATH). In your terminal, GitHub Actions `run:` lines, and docs, write `pnpm supabase ...`.

### Step 4. Vite config, TS alias, env files

Replace `$ROOT/vite.config.ts` with:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { host: "127.0.0.1", port: 3000, strictPort: true },
});
```

In `$ROOT/tsconfig.app.json`, inside `"compilerOptions"`, add these two keys (keep the rest):
```json
"baseUrl": ".",
"paths": { "@/*": ["src/*"] }
```

Create `$ROOT/.env.example` (local):
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=replace-me
```

Create `$ROOT/.env.sit.example` (SIT, filled in later in Step 18):
```
VITE_SUPABASE_URL=https://<sit-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=replace-me
```

Add to `$ROOT/package.json` `"scripts"`:
```json
"dev:sit": "vite --mode sit",
"build:sit": "tsc -b && vite build --mode sit"
```
(Vite loads `.env` then `.env.sit`, and `.env.sit` wins. `pnpm dev` with no mode keeps using local `.env`.)

Append to `$ROOT/.gitignore` (create it if missing):
```
.env
.env.*
!.env.example
!.env.sit.example
e2e/.auth
playwright-report
test-results
supabase/.temp
supabase/.branches
```

Create `$ROOT/src/vite-env.d.ts` only if it does not exist:
```ts
/// <reference types="vite/client" />
```

**Verify:** `pnpm exec tsc -b --noEmit` exits 0 (ignore errors about files you haven't created yet; stop only on errors in `vite.config.ts` or `tsconfig.app.json`).

### Step 5. Start Supabase and create `.env`

```bash
cd "$ROOT"
pnpm supabase start
pnpm supabase status -o env
```
From the printed output, copy the **API URL** and the **anon (publishable) key** into a new `$ROOT/.env`:
```
VITE_SUPABASE_URL=<API URL, normally http://127.0.0.1:54321>
VITE_SUPABASE_ANON_KEY=<anon key>
```
**Verify:** `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:54321/auth/v1/health` prints `200` (add the anon key as an `apikey` header if it prints 401: `-H "apikey: <anon key>"`).
**If it fails:** make sure Docker Desktop is running. Run `pnpm supabase stop` then `pnpm supabase start`.

### Step 6. Migration 1: tables, RLS, trigger, realtime

```bash
pnpm supabase migration new init
```
This creates `supabase/migrations/<timestamp>_init.sql`. Put exactly this in it:

```sql
-- profiles -------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on public.profiles from anon;
grant select, update on public.profiles to authenticated;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- auto-create a profile for each new auth user --------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- todos ----------------------------------------------------------------
create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index todos_user_id_idx on public.todos (user_id);

alter table public.todos enable row level security;

revoke all on public.todos from anon;
grant select, insert, update, delete on public.todos to authenticated;

create policy "todos_select_own" on public.todos
  for select to authenticated using (user_id = (select auth.uid()));
create policy "todos_insert_own" on public.todos
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "todos_update_own" on public.todos
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "todos_delete_own" on public.todos
  for delete to authenticated using (user_id = (select auth.uid()));

-- realtime -------------------------------------------------------------
alter publication supabase_realtime add table public.todos;
```

### Step 7. Migration 2: the RPC

```bash
pnpm supabase migration new todo_stats
```
Put exactly this in the new file:

```sql
create or replace function public.todo_stats()
returns table (total int, done int, pending int, pct_done numeric)
language sql
stable
security invoker          -- RLS still applies: each user only counts their own todos
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
grant execute on function public.todo_stats() to authenticated;
```

**Apply and verify (steps 6 and 7):**
```bash
pnpm supabase db reset
```
**Verify:** output ends without `ERROR`. Then:
```bash
docker exec supabase_db_dispatch-tracker psql -U postgres -c "select proname from pg_proc where proname = 'todo_stats';"
```
prints one row `todo_stats`.
**If it fails:** read the SQL error, fix the typo in the migration file, rerun `pnpm supabase db reset`.

### Step 8. Generate TypeScript types

```bash
mkdir -p src/types
pnpm supabase gen types typescript --local > src/types/database.types.ts
```
**If the command says unknown subcommand:** run `pnpm supabase gen types --help` and use the flag form it shows (for example `pnpm supabase gen types --lang typescript --local`).

Add these scripts to `$ROOT/package.json` `"scripts"` (keep existing ones):
```json
"db:types": "supabase gen types typescript --local > src/types/database.types.ts",
"db:reset": "supabase db reset && pnpm db:types"
```

**Verify:** `grep -n "todo_stats" src/types/database.types.ts` prints a match, and `grep -n "todos" src/types/database.types.ts` prints matches.

Create `$ROOT/src/types/db.ts`:
```ts
import type { Database } from "./database.types";

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];

export type TodoStats = PublicSchema["Functions"]["todo_stats"]["Returns"][number];
```

Create `$ROOT/src/lib/supabase.ts`:
```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient<Database>(url, key);
```
**Verify:** `pnpm exec tsc -b --noEmit` has no errors in `src/lib/supabase.ts` or `src/types/db.ts`.

### Step 9. Edge function: `exchange-rate`

```bash
pnpm supabase functions new exchange-rate
```
This creates `supabase/functions/exchange-rate/index.ts`. **Replace** its contents with:
```ts
import { handler } from "./handler.ts";

Deno.serve((req) => handler(req));
```

Create `supabase/functions/exchange-rate/handler.ts`:
```ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CODE = /^[A-Z]{3}$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handler(
  req: Request,
  fetchFn: typeof fetch = fetch,
  baseUrl: string = Deno.env.get("EXCHANGE_API_URL") ?? "https://api.frankfurter.dev",
): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let base = "USD";
  let symbol = "EUR";
  try {
    const body = await req.json();
    if (body?.base !== undefined) base = String(body.base);
    if (body?.symbol !== undefined) symbol = String(body.symbol);
  } catch {
    return json({ error: "invalid json body" }, 400);
  }

  if (!CODE.test(base) || !CODE.test(symbol)) {
    return json({ error: "base and symbol must be 3 uppercase letters" }, 400);
  }

  try {
    const res = await fetchFn(`${baseUrl}/v1/latest?base=${base}&symbols=${symbol}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return json({ error: `upstream returned ${res.status}` }, 502);

    const data = await res.json();
    const rate = data?.rates?.[symbol];
    if (typeof rate !== "number") return json({ error: "upstream response missing rate" }, 502);

    return json({
      base,
      symbol,
      rate,
      date: data.date,
      fetchedAt: new Date().toISOString(),
      source: "frankfurter",
    });
  } catch (err) {
    return json({ error: `upstream request failed: ${(err as Error).message}` }, 502);
  }
}
```

Create `supabase/functions/exchange-rate/handler.test.ts`:
```ts
import { assertEquals } from "jsr:@std/assert@1";
import { handler } from "./handler.ts";

const BASE = "http://stub.test";

function post(body: unknown): Request {
  return new Request("http://localhost/exchange-rate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

Deno.test("happy path returns shaped response", async () => {
  const fakeFetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ base: "USD", date: "2026-01-01", rates: { EUR: 0.5 } })),
    )) as typeof fetch;
  const res = await handler(post({ base: "USD", symbol: "EUR" }), fakeFetch, BASE);
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.rate, 0.5);
  assertEquals(body.source, "frankfurter");
});

Deno.test("invalid symbol returns 400", async () => {
  const res = await handler(post({ base: "USD", symbol: "eur!" }), fetch, BASE);
  assertEquals(res.status, 400);
});

Deno.test("upstream 500 returns 502", async () => {
  const fakeFetch = (() => Promise.resolve(new Response("boom", { status: 500 }))) as typeof fetch;
  const res = await handler(post({}), fakeFetch, BASE);
  assertEquals(res.status, 502);
});

Deno.test("upstream throws (timeout) returns 502", async () => {
  const fakeFetch = (() => Promise.reject(new Error("timeout"))) as typeof fetch;
  const res = await handler(post({}), fakeFetch, BASE);
  assertEquals(res.status, 502);
});

Deno.test("GET returns 405", async () => {
  const res = await handler(new Request("http://localhost/x", { method: "GET" }), fetch, BASE);
  assertEquals(res.status, 405);
});
```

Add to `package.json` `"scripts"`:
```json
"test:fn": "deno test --allow-env supabase/functions/exchange-rate/handler.test.ts"
```

**Verify:** `pnpm test:fn` shows 5 passed, 0 failed.
**If it fails:** if `jsr:@std/assert` cannot resolve, the machine is offline or Deno is old; run `deno --version` (need 2.x) and stop and report.

JWT note: `verify_jwt` defaults to `true`, so do **not** add anything to `config.jsonc`.

### Step 10. pgTAP tests

Create the folder `supabase/tests/database/`.

**File 1: `supabase/tests/database/rls.test.sql`**
```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- 1-2: RLS is on
select ok((select relrowsecurity from pg_class where oid = 'public.todos'::regclass), 'todos has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS');

-- two users (trigger should create profiles)
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.dev'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.dev');

-- 3: profile trigger
select is(
  (select count(*)::int from public.profiles
    where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')),
  2, 'profile trigger created a profile for each user');

-- todos owned by each user (inserted as postgres, bypasses RLS)
insert into public.todos (user_id, title) values
  ('11111111-1111-1111-1111-111111111111', 'a-1'),
  ('11111111-1111-1111-1111-111111111111', 'a-2'),
  ('22222222-2222-2222-2222-222222222222', 'b-1');

-- act as user A
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- 4: A sees only own todos
select is((select count(*)::int from public.todos), 2, 'A sees only own todos');

-- 5: A cannot insert a todo for B
select throws_ok(
  $$ insert into public.todos (user_id, title) values ('22222222-2222-2222-2222-222222222222', 'hack') $$,
  '42501', null, 'A cannot insert for B');

-- 6: A can insert own todo (user_id defaults to auth.uid())
select lives_ok($$ insert into public.todos (title) values ('a-3') $$, 'A can insert own todo');

-- 7: A updating B's row does nothing (no error, zero rows)
select lives_ok(
  $$ update public.todos set title = 'hacked' where user_id = '22222222-2222-2222-2222-222222222222' $$,
  'A update on B rows runs without error');

-- act as user B
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

-- 8: B's row untouched
select is((select title from public.todos limit 1), 'b-1', 'B row not modified by A');

-- 9: B sees only own profile
select is((select count(*)::int from public.profiles), 1, 'B sees only own profile');

-- anon
set local role anon;
-- 10: anon cannot read todos
select throws_ok($$ select * from public.todos $$, '42501', null, 'anon denied on todos');
-- 11: anon cannot read profiles
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon denied on profiles');

select * from finish();
rollback;
```

**File 2: `supabase/tests/database/todo_stats.test.sql`**
```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email) values
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@test.dev'),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@test.dev'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@test.dev');

insert into public.todos (user_id, title, done) values
  ('33333333-3333-3333-3333-333333333333', 'c-1', true),
  ('33333333-3333-3333-3333-333333333333', 'c-2', false),
  ('33333333-3333-3333-3333-333333333333', 'c-3', false),
  ('44444444-4444-4444-4444-444444444444', 'd-1', false);

set local role authenticated;

-- user C: 3 todos, 1 done
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select total from public.todo_stats()), 3, 'C total = 3');
select is((select done from public.todo_stats()), 1, 'C done = 1');
select is((select pending from public.todo_stats()), 2, 'C pending = 2');
select is((select pct_done from public.todo_stats()), 33.3::numeric, 'C pct_done = 33.3');

-- user D: only sees own 1 todo (proves security invoker + RLS)
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is((select total from public.todo_stats()), 1, 'D total = 1 (isolated from C)');

-- user E: no todos, no divide-by-zero
select set_config('request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select is((select total from public.todo_stats()), 0, 'E total = 0');
select is((select pct_done from public.todo_stats()), 0::numeric, 'E pct_done = 0');

-- anon cannot call the RPC
set local role anon;
select throws_ok($$ select * from public.todo_stats() $$, '42501', null, 'anon denied on todo_stats');

select * from finish();
rollback;
```

Add to `package.json` `"scripts"`:
```json
"test:db": "supabase test db"
```

**Verify:** `pnpm test:db` ends with `Result: PASS` and `Files=2, Tests=19`.
**If it fails:**
- `permission denied for table` in the *act as user* parts: the Step 6 `grant` statements were missed. Fix the migration, then `pnpm supabase db reset`.
- `42501` expected but got a different error on the anon tests: confirm the `revoke all ... from anon` lines are in Step 6 and Step 7.
- `pct_done` mismatch: check the SQL in Step 7.

### Step 11. Auth provider

Create `src/providers/authProvider.ts`:
```ts
import type { AuthProvider } from "@refinedev/core";
import { supabase } from "@/lib/supabase";

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error };
    if (data?.session) return { success: true, redirectTo: "/" };
    return { success: false, error: { name: "LoginError", message: "Login failed" } };
  },

  register: async ({ email, password }) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { success: false, error };
    if (data.session) return { success: true, redirectTo: "/" };
    return {
      success: false,
      error: { name: "RegisterError", message: "Check your email to confirm your account" },
    };
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return { success: false, error };
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) return { authenticated: true };
    return { authenticated: false, redirectTo: "/login", logout: true };
  },

  getIdentity: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      return { id: data.user.id, name: data.user.email, email: data.user.email };
    }
    return null;
  },

  onError: async (error) => {
    const status = (error as { status?: number; statusCode?: number })?.status
      ?? (error as { statusCode?: number })?.statusCode;
    if (status === 401) return { logout: true, redirectTo: "/login" };
    return { error };
  },
};
```

### Step 12. Integration feature (the two test buttons)

Create `src/features/integration/useEdgeInvoke.ts`:
```ts
import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";

export type ExchangeRateResult = {
  base: string;
  symbol: string;
  rate: number;
  date: string;
  fetchedAt: string;
  source: string;
};

export function useEdgeInvoke() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExchangeRateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    const t0 = performance.now();
    const res = await supabase.functions.invoke<ExchangeRateResult>("exchange-rate", {
      body: { base: "USD", symbol: "EUR" },
    });
    setLatencyMs(Math.round(performance.now() - t0));
    if (res.error) setError(res.error.message);
    else setData(res.data);
    setLoading(false);
  }, []);

  return { run, loading, data, error, latencyMs };
}
```

Create `src/features/integration/useTodoStats.ts`:
```ts
import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TodoStats } from "@/types/db";

export function useTodoStats() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TodoStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    const res = await supabase.rpc("todo_stats");
    if (res.error) setError(res.error.message);
    else setData(res.data?.[0] ?? null);
    setLoading(false);
  }, []);

  return { run, loading, data, error };
}
```

Create `src/features/integration/IntegrationChecks.tsx`:
```tsx
import { Alert, Button, Card, Col, Progress, Row, Space, Statistic } from "antd";
import { useEdgeInvoke } from "./useEdgeInvoke";
import { useTodoStats } from "./useTodoStats";

export function IntegrationChecks() {
  const edge = useEdgeInvoke();
  const stats = useTodoStats();

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={12}>
        <Card title="Edge function (external API)">
          <Space direction="vertical" style={{ width: "100%" }}>
            <Button
              type="primary"
              data-testid="btn-invoke-edge"
              loading={edge.loading}
              onClick={edge.run}
            >
              Invoke edge function
            </Button>
            {edge.data && (
              <div data-testid="result-edge">
                <Alert
                  type="success"
                  showIcon
                  message={`1 ${edge.data.base} = ${edge.data.rate} ${edge.data.symbol}`}
                  description={`Date ${edge.data.date} · ${edge.latencyMs} ms · source ${edge.data.source}`}
                />
              </div>
            )}
            {edge.error && (
              <div data-testid="error-edge">
                <Alert type="error" showIcon message={edge.error} />
              </div>
            )}
          </Space>
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card title="Database RPC (todo_stats)">
          <Space direction="vertical" style={{ width: "100%" }}>
            <Button
              type="primary"
              data-testid="btn-call-rpc"
              loading={stats.loading}
              onClick={stats.run}
            >
              Call RPC
            </Button>
            {stats.data && (
              <div data-testid="result-rpc">
                <Space size="large">
                  <span data-testid="rpc-total"><Statistic title="Total" value={stats.data.total} /></span>
                  <Statistic title="Done" value={stats.data.done} />
                  <Statistic title="Pending" value={stats.data.pending} />
                </Space>
                <Progress percent={Number(stats.data.pct_done)} />
              </div>
            )}
            {stats.error && (
              <div data-testid="error-rpc">
                <Alert type="error" showIcon message={stats.error} />
              </div>
            )}
          </Space>
        </Card>
      </Col>
    </Row>
  );
}
```

Create `src/pages/dashboard/index.tsx`:
```tsx
import { Typography } from "antd";
import { IntegrationChecks } from "@/features/integration/IntegrationChecks";

export function Dashboard() {
  return (
    <>
      <Typography.Title level={3}>Integration checks</Typography.Title>
      <IntegrationChecks />
    </>
  );
}
```

### Step 13. Todo pages

Create `src/pages/todos/list.tsx`:
```tsx
import { DeleteButton, EditButton, List, useTable } from "@refinedev/antd";
import { Checkbox, Space, Table } from "antd";
import type { Tables } from "@/types/db";

export function TodoList() {
  const { tableProps } = useTable<Tables<"todos">>({
    syncWithLocation: true,
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
  });

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="title" title="Title" />
        <Table.Column dataIndex="done" title="Done" render={(v: boolean) => <Checkbox checked={v} disabled />} />
        <Table.Column dataIndex="created_at" title="Created" />
        <Table.Column
          title="Actions"
          render={(_, record: Tables<"todos">) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
}
```

Create `src/pages/todos/create.tsx`:
```tsx
import { Create, useForm } from "@refinedev/antd";
import { Form, Input } from "antd";
import type { Tables } from "@/types/db";

export function TodoCreate() {
  const { formProps, saveButtonProps } = useForm<Tables<"todos">>();

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item label="Title" name="title" rules={[{ required: true, max: 200 }]}>
          <Input />
        </Form.Item>
      </Form>
    </Create>
  );
}
```

Create `src/pages/todos/edit.tsx`:
```tsx
import { Edit, useForm } from "@refinedev/antd";
import { Checkbox, Form, Input } from "antd";
import type { Tables } from "@/types/db";

export function TodoEdit() {
  const { formProps, saveButtonProps } = useForm<Tables<"todos">>();

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item label="Title" name="title" rules={[{ required: true, max: 200 }]}>
          <Input />
        </Form.Item>
        <Form.Item name="done" valuePropName="checked">
          <Checkbox>Done</Checkbox>
        </Form.Item>
      </Form>
    </Edit>
  );
}
```

Create `src/pages/todos/index.ts`:
```ts
export { TodoList } from "./list";
export { TodoCreate } from "./create";
export { TodoEdit } from "./edit";
```

### Step 14. App shell

Replace `src/App.tsx`:
```tsx
import { Authenticated, Refine } from "@refinedev/core";
import {
  AuthPage,
  ErrorComponent,
  ThemedLayout,
  useNotificationProvider,
} from "@refinedev/antd";
import "@refinedev/antd/dist/reset.css";
import routerProvider, {
  CatchAllNavigate,
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { dataProvider, liveProvider } from "@refinedev/supabase";
import { App as AntdApp, ConfigProvider } from "antd";
import { BrowserRouter, Outlet, Route, Routes } from "react-router";

import { supabase } from "@/lib/supabase";
import { authProvider } from "@/providers/authProvider";
import { Dashboard } from "@/pages/dashboard";
import { TodoCreate, TodoEdit, TodoList } from "@/pages/todos";

export default function App() {
  return (
    <BrowserRouter>
      <ConfigProvider>
        <AntdApp>
          <Refine
            dataProvider={dataProvider(supabase)}
            liveProvider={liveProvider(supabase)}
            authProvider={authProvider}
            routerProvider={routerProvider}
            notificationProvider={useNotificationProvider}
            options={{ syncWithLocation: true, warnWhenUnsavedChanges: true, liveMode: "auto" }}
            resources={[
              { name: "dashboard", list: "/", meta: { label: "Dashboard" } },
              {
                name: "todos",
                list: "/todos",
                create: "/todos/create",
                edit: "/todos/edit/:id",
                meta: { label: "Todos" },
              },
            ]}
          >
            <Routes>
              <Route
                element={
                  <Authenticated key="auth" fallback={<CatchAllNavigate to="/login" />}>
                    <ThemedLayout>
                      <Outlet />
                    </ThemedLayout>
                  </Authenticated>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="/todos">
                  <Route index element={<TodoList />} />
                  <Route path="create" element={<TodoCreate />} />
                  <Route path="edit/:id" element={<TodoEdit />} />
                </Route>
                <Route path="*" element={<ErrorComponent />} />
              </Route>

              <Route
                element={
                  <Authenticated key="unauth" fallback={<Outlet />}>
                    <NavigateToResource />
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
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}
```

Replace `src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```
Delete `src/index.css` and remove any `import "./index.css"` if present.

**Verify:**
```bash
pnpm exec tsc -b --noEmit
pnpm build
```
Both exit 0.
**If it fails:** read the first error only.
- "has no exported member" for a `@refinedev/*` name: open `node_modules/@refinedev/<pkg>/dist/index.d.ts`, find the real export name, and fix the import. **Report** the rename.
- `reset.css` not found: delete that single import line.
- Type error from `dataProvider(supabase)`: cast with `supabase as never`. Report it.

**Manual smoke check:** `pnpm dev`, then open `http://127.0.0.1:3000`. Expected: redirected to `/login`. Register `me@test.dev` / `Passw0rd!test`, land on the dashboard. Both buttons render. Stop the server (Ctrl+C) after.

### Step 15. Vitest

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
```

Create `src/test/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
```

Add `"vitest/globals"` and `"@testing-library/jest-dom"` to `compilerOptions.types` in `tsconfig.app.json` (create the `types` array if missing, keep `"vite/client"` in it).

Create `src/features/integration/IntegrationChecks.test.tsx`:
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    rpc: mocks.rpc,
  },
}));

import { IntegrationChecks } from "./IntegrationChecks";

describe("IntegrationChecks", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.rpc.mockReset();
  });

  it("shows the exchange rate after invoking the edge function", async () => {
    mocks.invoke.mockResolvedValue({
      data: { base: "USD", symbol: "EUR", rate: 0.5, date: "2026-01-01", fetchedAt: "x", source: "frankfurter" },
      error: null,
    });
    render(<IntegrationChecks />);
    fireEvent.click(screen.getByTestId("btn-invoke-edge"));
    const result = await screen.findByTestId("result-edge");
    expect(result).toHaveTextContent("0.5");
    expect(mocks.invoke).toHaveBeenCalledWith("exchange-rate", { body: { base: "USD", symbol: "EUR" } });
  });

  it("shows an error when the edge function fails", async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: { message: "boom" } });
    render(<IntegrationChecks />);
    fireEvent.click(screen.getByTestId("btn-invoke-edge"));
    expect(await screen.findByTestId("error-edge")).toHaveTextContent("boom");
  });

  it("shows todo stats after calling the RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ total: 3, done: 1, pending: 2, pct_done: 33.3 }],
      error: null,
    });
    render(<IntegrationChecks />);
    fireEvent.click(screen.getByTestId("btn-call-rpc"));
    const result = await screen.findByTestId("result-rpc");
    expect(result).toHaveTextContent("33.3");
    expect(screen.getByTestId("rpc-total")).toHaveTextContent("3");
    expect(mocks.rpc).toHaveBeenCalledWith("todo_stats");
  });

  it("shows an error when the RPC fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "denied" } });
    render(<IntegrationChecks />);
    fireEvent.click(screen.getByTestId("btn-call-rpc"));
    expect(await screen.findByTestId("error-rpc")).toHaveTextContent("denied");
  });
});
```

Create `src/providers/authProvider.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));

import { authProvider } from "./authProvider";

describe("authProvider", () => {
  beforeEach(() => Object.values(auth).forEach((f) => f.mockReset()));

  it("login succeeds when a session is returned", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    const r = await authProvider.login({ email: "a@b.c", password: "x" });
    expect(r).toEqual({ success: true, redirectTo: "/" });
  });

  it("login fails on error", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: new Error("bad") });
    const r = await authProvider.login({ email: "a@b.c", password: "x" });
    expect(r.success).toBe(false);
  });

  it("check redirects to /login with no session", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    const r = await authProvider.check();
    expect(r).toMatchObject({ authenticated: false, redirectTo: "/login" });
  });

  it("check passes with a session", async () => {
    auth.getSession.mockResolvedValue({ data: { session: {} } });
    const r = await authProvider.check();
    expect(r).toEqual({ authenticated: true });
  });
});
```

Add to `package.json` `"scripts"`:
```json
"test": "vitest run"
```

**Verify:** `pnpm test` shows 2 test files, 8 tests passed.
**If it fails:** fix only the failing test or source file and rerun. Do not delete tests.

### Step 16. Playwright (e2e)

Create `e2e/stub-exchange-server.mjs`:
```js
import http from "node:http";

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url?.startsWith("/v1/latest")) {
    res.end(JSON.stringify({ amount: 1, base: "USD", date: "2026-01-01", rates: { EUR: 0.5 } }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  }
});

server.listen(4010, "0.0.0.0", () => console.log("stub exchange server on :4010"));
```

Create `e2e/.env.e2e` (this file is gitignored by `.env.*`):
```
EXCHANGE_API_URL=http://host.docker.internal:4010
```

Add to `package.json` `"scripts"`:
```json
"fn:serve:e2e": "supabase functions serve --env-file e2e/.env.e2e",
"test:e2e": "playwright test"
```

Create `playwright.config.ts`:
```ts
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    storageState: "e2e/.auth/user.json",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/stub-exchange-server.mjs",
      port: 4010,
      reuseExistingServer: true,
    },
    {
      command: "pnpm dev",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: true,
    },
  ],
});
```

Create `e2e/global-setup.ts`:
```ts
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "node:fs";

dotenv.config({ path: ".env" });

export const E2E_USER = { email: "e2e-a@test.dev", password: "Passw0rd!test" };

export default async function globalSetup() {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.VITE_SUPABASE_ANON_KEY!;

  // create the user if missing (email confirmation is off locally); ignore "already registered"
  await createClient(url, key).auth.signUp(E2E_USER);

  fs.mkdirSync("e2e/.auth", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:3000/login");
  await page.getByLabel("Email").fill(E2E_USER.email);
  await page.getByLabel("Password").fill(E2E_USER.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("http://127.0.0.1:3000/");
  await page.context().storageState({ path: "e2e/.auth/user.json" });
  await browser.close();
}
```
Note: `globalSetup` runs **after** `webServer` starts, so the dev server is available.

Create `e2e/auth.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("unauthenticated user is redirected to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
```

Create `e2e/todos.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("create a todo and see it in the list", async ({ page }) => {
  const title = `todo-${Date.now()}`;
  await page.goto("/todos/create");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: /save/i }).click();
  await page.goto("/todos");
  await expect(page.getByText(title)).toBeVisible();
});
```

Create `e2e/rpc.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("RPC button reflects a newly created todo", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("btn-call-rpc").click();
  await expect(page.getByTestId("result-rpc")).toBeVisible();
  const before = Number((await page.getByTestId("rpc-total").innerText()).replace(/\D/g, ""));

  await page.goto("/todos/create");
  await page.getByLabel("Title").fill(`rpc-${Date.now()}`);
  await page.getByRole("button", { name: /save/i }).click();
  await page.goto("/");

  await page.getByTestId("btn-call-rpc").click();
  await expect(page.getByTestId("rpc-total")).toContainText(String(before + 1));
});
```
(`rpc-total` also contains the label "Total"; the `replace(/\D/g, "")` keeps only digits.)

Create `e2e/edge-function.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

// Requires: `pnpm fn:serve:e2e` running (see section 3) so EXCHANGE_API_URL points at the stub.
test("edge function returns the stubbed rate", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("btn-invoke-edge").click();
  await expect(page.getByTestId("result-edge")).toContainText("0.5");
});
```

Create `e2e/realtime.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("a todo created in one page appears live in another", async ({ browser }) => {
  const context = await browser.newContext({ storageState: "e2e/.auth/user.json" });
  const viewer = await context.newPage();
  const creator = await context.newPage();

  await viewer.goto("/todos");
  const title = `live-${Date.now()}`;

  await creator.goto("/todos/create");
  await creator.getByLabel("Title").fill(title);
  await creator.getByRole("button", { name: /save/i }).click();

  // no reload on viewer
  await expect(viewer.getByText(title)).toBeVisible({ timeout: 10_000 });
  await context.close();
});
```

Add to `package.json` `"scripts"`:
```json
"test:all": "pnpm test && pnpm test:fn && pnpm test:db && pnpm test:e2e"
```

**Run e2e (needs 2 terminals):**
1. Terminal 1: `cd "$ROOT" && node e2e/stub-exchange-server.mjs & pnpm fn:serve:e2e` (leave running).
2. Terminal 2: `cd "$ROOT" && pnpm test:e2e`.

**Verify:** 5 spec files, all tests pass (`auth`, `todos`, `rpc`, `edge-function`, `realtime`).
**If it fails:**
- Login selectors (`getByLabel("Email")`) not found: open `playwright-report`, or run `pnpm exec playwright codegen http://127.0.0.1:3000/login` to see the real labels. Adjust **only** the selector text. Report the change.
- `edge-function.spec.ts` returns 401 or a non-0.5 rate: confirm terminal 1 is running and `docker run` can reach the host (`host.docker.internal`). Report if still failing.
- `realtime.spec.ts` fails: confirm `alter publication supabase_realtime add table public.todos` is in the migration (`pnpm supabase db reset` re-applies it).

### Step 17. CI workflow

Create `.github/workflows/ci.yml`:
```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x

      # Supabase CLI comes from devDependencies (pnpm supabase ...), no setup-cli action needed
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium

      - name: Start Supabase
        run: pnpm supabase start

      - name: Write .env
        run: |
          eval "$(pnpm supabase status -o env | sed 's/^/export /')"
          echo "VITE_SUPABASE_URL=$API_URL" >> .env
          echo "VITE_SUPABASE_ANON_KEY=$ANON_KEY" >> .env

      - name: Types drift check
        run: |
          pnpm db:types
          git diff --exit-code src/types/database.types.ts

      - run: pnpm exec tsc -b --noEmit
      - run: pnpm test
      - run: pnpm test:fn
      - run: pnpm test:db

      - name: Serve edge functions with stub env
        run: |
          echo "EXCHANGE_API_URL=http://host.docker.internal:4010" > e2e/.env.e2e
          nohup node e2e/stub-exchange-server.mjs > stub.log 2>&1 &
          nohup pnpm supabase functions serve --env-file e2e/.env.e2e > fn.log 2>&1 &
          for i in $(seq 1 30); do
            code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:54321/functions/v1/exchange-rate || true)
            [ "$code" != "000" ] && [ "$code" != "502" ] && break
            sleep 2
          done

      - run: pnpm test:e2e

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: |
            playwright-report
            test-results
            fn.log
            stub.log
```
**Note:** the CI file is **not testable locally**. Do not try to run it. Just confirm it is valid YAML: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"` (skip if `yaml` module missing).
**Known risk:** the env names printed by `pnpm supabase status -o env` may differ in CLI v3 (for example the anon key's name). If CI fails at "Write .env", run `pnpm supabase status -o env` locally and rename `API_URL` / `ANON_KEY` to match. Report the mismatch.

### Step 18. SIT environment (optional, needs user input)

**Gate:** ask the user for the SIT Supabase **project ref** (the `<ref>` in `https://<ref>.supabase.co`). The user creates the project in the Supabase dashboard (new project, separate from production, region of their choice) and also provides the DB password.
- If no ref is provided: **skip this whole step**, write "SIT skipped: no project ref" in the report, and continue to Step 19.
- Confirm the ref back to the user before running anything below.

**18a. Link and push (first deploy).** Replace `<ref>` with the confirmed value:
```bash
pnpm supabase login                                  # user completes the browser login if prompted
pnpm supabase link --project-ref <ref>
pnpm supabase db push --dry-run                      # review: should list exactly the 2 migrations
pnpm supabase db push                                # apply only after the dry run looks right
pnpm supabase functions deploy exchange-rate
```
Do **not** run `pnpm supabase db reset --linked`, and do **not** set `EXCHANGE_API_URL` on SIT (the function then calls the real Frankfurter API).

**18b. SIT frontend env.** Create `$ROOT/.env.sit` (gitignored) from `.env.sit.example` using the SIT project URL and anon key from the dashboard (Project Settings, API).

**18c. SIT dashboard settings (tell the user to do these; you cannot):**
- Authentication, URL Configuration: set Site URL and add any SIT frontend URL to redirect URLs.
- Authentication, Providers, Email: decide whether "Confirm email" stays on (cloud default is on). With it on, register a SIT user manually and confirm it from the email or from the dashboard.

**18d. Scripts.** Add to `package.json` `"scripts"`:
```json
"sit:push": "supabase db push",
"sit:deploy-fn": "supabase functions deploy exchange-rate"
```
These act on whatever project is currently linked. The README (Step 19) must say to run `pnpm supabase projects list` and check the linked project before using them.

**18e. Smoke test SIT (manual):**
```bash
pnpm dev:sit
```
Open `http://127.0.0.1:3000`, log in with a SIT user, click **Call RPC** and **Invoke edge function**. Both must succeed. The edge button must show a real USD to EUR rate.

**18f. CI deploy job.** Append this job to `.github/workflows/ci.yml` (same file as Step 17, at the same indentation as `test:`):
```yaml
  deploy-sit:
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: sit
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_DB_PASSWORD: ${{ secrets.SIT_DB_PASSWORD }}
      SIT_PROJECT_REF: ${{ vars.SIT_PROJECT_REF }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm supabase link --project-ref "$SIT_PROJECT_REF"
      - run: pnpm supabase db push
      - run: pnpm supabase functions deploy exchange-rate
```
Tell the user to create: GitHub environment `sit`, secrets `SUPABASE_ACCESS_TOKEN` and `SIT_DB_PASSWORD`, and variable `SIT_PROJECT_REF`. The deploy runs only after all local-stack tests pass, only on pushes to `main`.

**Verify:** `pnpm supabase projects list` shows the SIT project with a linked marker, `pnpm supabase migration list` shows both migrations applied remotely, and the 18e smoke test passes.
**If it fails:** stop and report the exact error. Do not retry `db push` more than once.

### Step 19. README

Replace `$ROOT/README.md` with:
````markdown
# Supabase + Refine starter

React + Vite + TypeScript + Refine (Ant Design) on a local Supabase stack (Postgres, Auth, RLS, Realtime, Edge Functions).

## Environments
- **Local (default, develop here first):** Docker-based Supabase stack. Everything, including all tests, runs with no cloud account.
- **SIT (second):** separate Supabase cloud project for integration testing. Reached only through `pnpm dev:sit`, `pnpm build:sit`, `pnpm sit:*`, and the CI deploy job. Before any `sit:*` command, run `pnpm supabase projects list` and confirm the linked project is SIT.

## Setup (local)
```bash
pnpm install                         # also installs the Supabase CLI (run it as `pnpm supabase ...`)
pnpm supabase start
pnpm supabase status -o env               # copy API URL + anon key into .env (see .env.example)
pnpm db:reset                        # apply migrations, regenerate types
pnpm dev                             # http://127.0.0.1:3000
```

## Scripts
| Script | What it does |
|---|---|
| `pnpm dev` | Vite dev server on :3000 |
| `pnpm db:types` | Regenerate `src/types/database.types.ts` from the local DB |
| `pnpm db:reset` | Reset DB, re-run migrations and seed, regenerate types |
| `pnpm test` | Vitest unit tests |
| `pnpm test:fn` | Deno tests for edge functions |
| `pnpm test:db` | pgTAP tests (`pnpm supabase test db`) |
| `pnpm test:e2e` | Playwright (needs the stub server and `pnpm fn:serve:e2e` running) |
| `pnpm fn:serve:e2e` | Serve edge functions with `EXCHANGE_API_URL` pointing at the stub |
| `pnpm dev:sit` / `pnpm build:sit` | Run or build the frontend against SIT (`.env.sit`) |
| `pnpm sit:push` | Apply migrations to the **linked** (SIT) project |
| `pnpm sit:deploy-fn` | Deploy the edge function to the **linked** (SIT) project |

## The two dashboard test buttons
| Button | Proves |
|---|---|
| **Invoke edge function** | JWT passes to the function, the function reaches an external API (Frankfurter), env vars work |
| **Call RPC** | SQL logic runs, RLS applies inside the RPC (`security invoker`), types flow end to end |

## Add a new table
1. `pnpm supabase migration new <name>`; write the table, `enable row level security`, grants, policies.
2. Add a pgTAP test in `supabase/tests/database/`.
3. `pnpm db:reset` (this also regenerates types).
4. Add a Refine resource in `src/App.tsx` and pages under `src/pages/<name>/`.
````

### Step 20. Optional cleanup (do only if everything above passed)

```bash
pnpm exec tsc -b --noEmit
pnpm build
```
Then stop all background processes (stub server, `fn:serve:e2e`) and run `pnpm supabase stop`.

---

## 3. Running e2e: quick reference

| Terminal | Command | Leave running? |
|---|---|---|
| 1 | `node e2e/stub-exchange-server.mjs & pnpm fn:serve:e2e` | yes |
| 2 | `pnpm test:e2e` | no |

Playwright starts the stub itself if it is not running (`reuseExistingServer: true`). Terminal 1 is still needed for `fn:serve:e2e` because it restarts the function with the stub env.

## 4. Final acceptance checklist

Run each and paste the result in your report.

- [ ] `pnpm supabase --version` starts with `3.`
- [ ] `pnpm ls antd` shows `5.x`
- [ ] `pnpm db:reset` finishes without `ERROR`
- [ ] `grep -c todo_stats src/types/database.types.ts` is at least `1`
- [ ] `pnpm exec tsc -b --noEmit` exits 0
- [ ] `pnpm build` exits 0
- [ ] `pnpm test` passes (8 tests)
- [ ] `pnpm test:fn` passes (5 tests)
- [ ] `pnpm test:db` passes (19 tests, `Result: PASS`)
- [ ] `pnpm test:e2e` passes (5 specs) with terminal 1 running
- [ ] Unauthenticated call is rejected: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:54321/functions/v1/exchange-rate` prints `401`
- [ ] After `pnpm db:types`, `git diff` on `src/types/database.types.ts` is empty (skip if the project is not a git repo and say so)
- [ ] Local-first proven: with Wi-Fi off (or without `.env.sit`), `pnpm test`, `pnpm test:fn`, `pnpm test:db` still pass
- [ ] SIT (only if Step 18 ran): `pnpm supabase migration list` shows both migrations remote, and the 18e smoke test passed
- [ ] SIT skipped? Report says "SIT skipped: no project ref"

## 5. Troubleshooting table

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cannot connect to the Docker daemon` | Docker not running | Start Docker Desktop, rerun |
| `antd` resolved to 6.x | pnpm took latest | `pnpm add antd@^5.23` |
| `permission denied for table todos` in the app | missing `grant` | check Step 6, `pnpm supabase db reset` |
| `401` from the edge function when logged in | JWT verification vs local keys | stop and report; do **not** disable `verify_jwt` on your own |
| Realtime not updating | table not in publication or RLS blocking | check the Step 6 `alter publication` line |
| Playwright cannot find "Email" label | Refine `AuthPage` labels changed | use `playwright codegen`, update selectors only |
| `pnpm supabase gen types` unknown subcommand | CLI v3 syntax | see Step 8 fallback |
| `db push` targets the wrong project | wrong project linked | `pnpm supabase projects list`; re-run `pnpm supabase link --project-ref <sit-ref>` |
| SIT login works but register shows "Check your email" | cloud email confirmation is on | confirm the user from the dashboard (Step 18c) |

## 6. Notes for the plan author (not for the executor)

- Package versions were checked against npm on 2026-11-25. Refine v5/v6 APIs were checked only through the published `.d.ts` exports (`AuthPage`, `ThemedLayout`, `reset.css`, `dataProvider`/`liveProvider`, `CatchAllNavigate`, `NavigateToResource`); nothing was compiled. Step 14's "If it fails" exists for that reason.
- The Supabase CLI v3 `gen types` flag form and `status -o env` variable names were not verified because the CLI is not installed yet. Steps 8 and 17 list fallbacks.
- Local `--env-file` + `host.docker.internal` is the macOS/Docker Desktop path. It differs on Linux CI. On the GitHub runner `host.docker.internal` may not resolve; if so, use the runner's docker bridge IP (`172.17.0.1`) in `e2e/.env.e2e`.
