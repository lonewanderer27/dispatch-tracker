# Dispatch Tracker

Supabase + Refine starter. React 19, Vite, Ant Design 5, react-router 7, local-first Supabase (Docker).

Sample domain: `profiles`, with per-user RLS and an edge function (`exchange-rate`, backed by [Frankfurter](https://frankfurter.dev), no API key).

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
pnpm db:reset                 # applies migrations, loads supabase/seeds (users, reference data, roster, demo jobs), regenerates types
pnpm dev                      # http://127.0.0.1:5173
```

Seeded local accounts (local only, never on a hosted project):

| Email                    | Password                  | Role        |
| ------------------------ | ------------------------- | ----------- |
| `admin@example.com`      | `admin-password-123`      | Admin       |
| `user@example.com`       | `user-password-123`       | User        |
| `superadmin@example.com` | `superadmin-password-123` | Super Admin |

Architecture changes are documented, one numbered file each, in [docs/architecture](docs/architecture). Access control: [0001 Role-based access](docs/architecture/0001-Role-Based-Access.md). Users page: [0002 User management](docs/architecture/0002-User-Management.md). Cleaning jobs: [0003 Data model](docs/architecture/0003-Cleaning-Job-Data-Model.md), [0004 List function and hooks](docs/architecture/0004-Cleaning-Jobs-List-Function.md), [0005 Preferred time zone](docs/architecture/0005-Preferred-Time-Zone.md). Local data: [0006 Seed data](docs/architecture/0006-Local-Seed-Data.md). Pill colours: [0007 Color motifs](docs/architecture/0007-Color-Motifs.md). Code layout: [0008 Feature folders](docs/architecture/0008-Feature-Folders.md). Todos removal: [0009 Remove todos](docs/architecture/0009-Remove-Todos.md). Branding: [0010 Branding](docs/architecture/0010-Branding.md).

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
  migrations/0001_init.sql     profiles, todos (dropped in 0041), RLS, realtime
  migrations/0002_todo_stats.sql  todo_stats() (dropped in 0041)
  migrations/0003_roles.sql      roles (Admin, User), profiles.role_id
  migrations/0004_app_permissions.sql  Super Admin role, app_permissions, has_permission()
  migrations/0005_user_admin.sql  is_super_admin(), admin_update_profile()
  migrations/0006_companies.sql  companies (brands), role-based RLS
  migrations/0007_clients.sql  clients (each booked against a company), role-based RLS
  migrations/0008_contacts.sql contacts (name and number per client), role-based RLS
  seeds/                       local dev data, loaded in order by db:reset: 01_users, 02_reference_data, 03_roster, 04_cleaning_jobs (anonymised demo jobs), 05_cleaning_job_areas_items
  functions/exchange-rate/     edge function + Deno tests
  tests/database/              pgTAP tests
src/
  main.tsx                     entry point, mounts src/app/App.tsx
  app/                         composition only, imports features
    App.tsx                    Refine, layout and the routes of every feature
    features.ts                the feature list (its order is the sidebar order)
    providers/                 Refine data/live, auth and access control providers
  features/<feature>/          one folder per feature: areas, cleaners, cleaning-jobs, cleaning-statuses,
                               cleaning-types, clients, companies, company-cleaners, contacts, dashboard,
                               items, users. Never imports another feature.
    routes.tsx                 the feature's Refine resource and <Route> tree (a FeatureModule)
    pages/                     only List, Create, Edit and Show pages, and their tests
    components/                any other component of the feature (filter bars, modals, pickers)
    api.ts, hooks.ts, *.ts     data access (takes the client as an argument), React Query hooks, helpers
  shared/                      used by two or more features; never imports a feature
    supabase.ts                typed client and AppSupabaseClient
    featureModule.ts          the { resource, routes } contract each feature exports
    ui/                        generic UI wrappers (Card)
    color-motif/               the pill colour palette (COLOR_MOTIFS), ColorMotifSelect, ColorMotifTag
    company/                   CompanyTag, the company pill
  types/                       generated DB types + helpers (db.ts)
  test/setup.ts                Vitest setup
e2e/                           Playwright specs and the Frankfurter stub
```

## How to add a new table

1. Migration: `supabase migration new add_<table>` and write the `create table`.
2. RLS: enable RLS on the table, then add explicit `grant`s and policies. Anon gets nothing by default. Policies call `has_permission('<table>', '<action>')`, and the same migration inserts the table's rows in `app_permissions` (Admin and Super Admin read and write, User reads only). `rbac.test.sql` fails if a table has no row for a role.
3. pgTAP: add a test under `supabase/tests/database/` that proves isolation (user A cannot read or write user B's rows).
4. Types: `pnpm db:reset`, which regenerates `src/types/database.types.ts`.
5. Feature: create `src/features/<table>/` with `pages/` (only List, Create, Edit and Show; any other component goes in `src/features/<table>/components/`) using `useTable`, `useForm` and `useShow` with `Tables<'<table>'>`, and a `routes.tsx` that exports a `FeatureModule` (follow `src/features/areas/routes.tsx`). Add it to the `features` array in `src/app/features.ts`; its position there is its place in the sidebar. Code used by another feature too goes in `src/shared/`.
6. Run `pnpm test:all`.

## The integration button

| Button                   | Proves                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------- |
| **Invoke edge function** | JWT passes through the gateway, outbound network works, secrets and env vars are wired. |

## Notes

- Users can update only `profiles.display_name`. `role_id` (Admin or User, from the `roles` table) is column-protected: only a Super Admin can change it, from the Users page. Admins can read and write the dispatch tables; Users can only read them. Roles are Admin, User and Super Admin. A new sign-up has **no role** and sees nothing until a Super Admin gives one on the Users page (see [0001](docs/architecture/0001-Role-Based-Access.md)). The `app_permissions` table lists what each role may do per table (read, create, update, delete). Admin can modify every dispatch table but not `roles` or `app_permissions`; only Super Admin can modify those two. Anonymous sign-in is off.
- The edge function runs in Docker. For offline e2e, `EXCHANGE_API_URL` points it at the stub; see `supabase/functions/.env.example`.
