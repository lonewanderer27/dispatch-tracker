# Dispatch Tracker

Supabase + Refine starter. React 19, Vite, Ant Design 5, react-router 7, local-first Supabase (Docker).

Sample domain: `profiles` and `todos`, with per-user RLS, realtime updates, an RPC (`todo_stats`) and an edge function (`exchange-rate`, backed by [Frankfurter](https://frankfurter.dev), no API key).

## Prerequisites

- Node 24+, pnpm 10
- Docker (OrbStack or Docker Desktop) running. Local Supabase needs it.
- Deno 2 (for the edge function tests)

## Setup

```bash
pnpm install
pnpm db:start                 # starts the local Supabase stack (first run pulls images)
pnpm exec supabase status     # copy API URL and anon key into .env.local
cp .env.example .env.local    # then fill VITE_SUPABASE_ANON_KEY
pnpm db:reset                 # applies migrations, seeds users, regenerates types
pnpm dev                      # http://127.0.0.1:5173
```

Seeded local accounts (local only, never on a hosted project):

| Email               | Password             | Role  |
| ------------------- | -------------------- | ----- |
| `admin@example.com` | `admin-password-123` | admin |
| `user@example.com`  | `user-password-123`  | user  |

## Scripts

| Script                         | What it does                                               |
| ------------------------------ | ---------------------------------------------------------- |
| `pnpm dev`                     | Vite dev server                                            |
| `pnpm build`                   | Typecheck and production build                             |
| `pnpm typecheck`               | `tsc -b`                                                   |
| `pnpm lint`                    | ESLint (typed rules)                                       |
| `pnpm format` / `format:check` | Prettier                                                   |
| `pnpm test`                    | Vitest unit and component tests (offline, mocked Supabase) |
| `pnpm db:start` / `db:stop`    | Start or stop the local stack                              |
| `pnpm db:reset`                | Reset DB from migrations and seed, then regenerate types   |
| `pnpm db:types`                | Regenerate `src/types/database.types.ts`                   |
| `pnpm test:db`                 | pgTAP tests (`supabase test db`)                           |
| `pnpm test:fn`                 | Deno tests for the edge function (no network)              |
| `pnpm exchange-stub`           | Stub Frankfurter server on port 4010                       |
| `pnpm test:e2e`                | Playwright end-to-end tests                                |
| `pnpm test:all`                | Lint, typecheck, unit, db, fn and e2e                      |

## Layout

```
supabase/
  config.jsonc                 local stack config (auth, functions, realtime)
  migrations/0001_init.sql     profiles, todos, RLS, realtime
  migrations/0002_todo_stats.sql
  migrations/0003_roles.sql      roles (Admin, User), profiles.role_id
  seed.sql                     local test users and todos
  functions/exchange-rate/     edge function + Deno tests
  tests/database/              pgTAP tests
src/
  lib/supabase.ts              typed client
  types/                       generated DB types + helpers (db.ts)
  providers/                   Refine data/live provider, auth provider
  features/integration/        data access + hooks for dashboard checks
  pages/dashboard, pages/todos
e2e/                           Playwright specs and the Frankfurter stub
```

## How to add a new table

1. Migration: `supabase migration new add_<table>` and write the `create table`.
2. RLS: enable RLS on the table, then add explicit `grant`s and policies. Anon gets nothing by default.
3. pgTAP: add a test under `supabase/tests/database/` that proves isolation (user A cannot read or write user B's rows).
4. Types: `pnpm db:reset`, which regenerates `src/types/database.types.ts`.
5. Resource: add a `ResourceProps` entry in `src/App.tsx`, then pages under `src/pages/<table>/` using `useTable`, `useForm` and `useShow` with `Tables<'<table>'>`.
6. Run `pnpm test:all`.

## The two integration buttons

| Button                   | Proves                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| **Invoke edge function** | JWT passes through the gateway, outbound network works, secrets and env vars are wired.     |
| **Call RPC**             | SQL logic runs, RLS applies inside the RPC (`security invoker`), and types flow end to end. |

## Notes

- `todo_stats` is `security invoker`. Switching it to `security definer` would bypass RLS. The pgTAP isolation test guards against that.
- Admins have an RLS override on `todos`, so for an admin `todo_stats` counts every user's todos, not only their own.
- Users can update only `profiles.display_name`. `role_id` (Admin or User, from the `roles` table) is column-protected and can only be changed with direct DB access. Admins can read and write the dispatch tables; Users can only read them. Anonymous sign-in is off.
- The edge function runs in Docker. For offline e2e, `EXCHANGE_API_URL` points it at the stub; see `supabase/functions/.env.example`.
