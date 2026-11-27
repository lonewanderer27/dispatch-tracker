# Dispatch Tracker

Supabase + Refine starter. React 19, Vite, Ant Design 5, react-router 7, local-first Supabase (Docker).

Sample domain: `profiles` and `todos`, with per-user RLS, realtime updates, an RPC (`todo_stats`) and an edge function (`exchange-rate`, backed by [Frankfurter](https://frankfurter.dev), no API key).

## Prerequisites

- Node 24+, pnpm 10
- Docker (OrbStack or Docker Desktop) running. Local Supabase needs it.
- Deno 2 (for the edge function tests). Install with `brew install deno` on macOS, or see [deno.com](https://deno.com/manual/getting_started/installation). Check with `deno --version`.
- Playwright Chromium (for the e2e tests). Installed with the setup step below. It is a separate browser download, not part of `pnpm install`.

## Setup

```bash
pnpm install
pnpm exec playwright install chromium  # one-time browser download for the e2e tests (repeat after a Playwright upgrade)
pnpm db:start                 # starts the local Supabase stack (first run pulls images)
pnpm exec supabase status     # copy API URL and anon key into .env.local
cp .env.example .env.local    # then fill VITE_SUPABASE_ANON_KEY
pnpm db:reset                 # applies migrations, seeds users, regenerates types
pnpm dev                      # http://127.0.0.1:5173
```

Seeded local accounts (local only, never on a hosted project):

| Email                    | Password                  | Role        |
| ------------------------ | ------------------------- | ----------- |
| `admin@example.com`      | `admin-password-123`      | Admin       |
| `user@example.com`       | `user-password-123`       | User        |
| `superadmin@example.com` | `superadmin-password-123` | Super Admin |

Architecture changes are documented, one numbered file each, in [docs/architecture](docs/architecture). Access control: [0001 Role-based access](docs/architecture/0001-Role-Based-Access.md). Users page: [0002 User management](docs/architecture/0002-User-Management.md).

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
  migrations/0004_app_permissions.sql  Super Admin role, app_permissions, has_permission()
  migrations/0005_user_admin.sql  is_super_admin(), admin_update_profile()
  seed.sql                     local test users and todos
  functions/exchange-rate/     edge function + Deno tests
  tests/database/              pgTAP tests
src/
  lib/supabase.ts              typed client
  types/                       generated DB types + helpers (db.ts)
  providers/                   Refine data/live provider, auth provider
  features/integration/        data access + hooks for dashboard checks
  features/users/              role ids and the Super Admin user update call
  pages/dashboard, pages/todos, pages/users
e2e/                           Playwright specs and the Frankfurter stub
```

## How to add a new table

1. Migration: `supabase migration new add_<table>` and write the `create table`.
2. RLS: enable RLS on the table, then add explicit `grant`s and policies. Anon gets nothing by default. Policies call `has_permission('<table>', '<action>')`, and the same migration inserts the table's rows in `app_permissions` (Admin and Super Admin read and write, User reads only). `rbac.test.sql` fails if a table has no row for a role.
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
- Users can update only `profiles.display_name`. `role_id` (Admin or User, from the `roles` table) is column-protected: only a Super Admin can change it, from the Users page. Admins can read and write the dispatch tables; Users can only read them. Roles are Admin, User and Super Admin. The `app_permissions` table lists what each role may do per table (read, create, update, delete). Admin can modify every dispatch table but not `roles` or `app_permissions`; only Super Admin can modify those two. Anonymous sign-in is off.
- The edge function runs in Docker. For offline e2e, `EXCHANGE_API_URL` points it at the stub; see `supabase/functions/.env.example`.
