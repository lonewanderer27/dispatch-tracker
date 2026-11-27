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
