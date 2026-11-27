# AGENTS.md

Guidance for AI coding agents working in this repo.

## Overview

Dispatch Tracker: Supabase + Refine starter (React 19, Vite, Ant Design 5, react-router 7, local-first Supabase in Docker). Setup, scripts, layout and the "how to add a new table" checklist are in `README.md`; do not duplicate them here.

## Commands

Run from the repo root with pnpm. The full gate is:

```bash
pnpm test:all   # lint, typecheck, vitest, pgTAP, Deno fn tests, Playwright e2e
```

The local stack needs Docker (`pnpm db:start`). `supabase/functions/.env` and `.env.local` are git-ignored: never commit secrets, `.env*` (except `.env.example`) or e2e auth state.

## Conventions

- **Plans must be implementable by a smaller model (Haiku 5.5 or similar).** Every plan is written so a lower-tier model can execute it without design decisions:
  - give each new file **in full** (final code, no "similar to X" or "pick one");
  - give each edit as an exact find/replace pair with the anchor line;
  - give the exact shell command for every gate, with an "Expect" line;
  - state the decisions already made; list open questions separately and say they do not block;
  - say what is out of scope;
  - tell the implementer to **stop and report** (not fix) when the code does not match the plan's Facts or a gate's Expect.
- Follow the existing structure: `src/features/<feature>/` for data access and hooks, `src/pages/<resource>/` for pages, `src/components/<feature>/` for the other components of a feature, `src/providers/` for Refine providers. **A pages folder holds only the Create, Edit and List pages** of its resource; any other component (filter bars, modals, pickers) goes in `src/components/<feature>/`. Use the generated `Tables<'...'>` types; never hand-edit `src/types/database.types.ts` (run `pnpm db:types`).
- Every new table gets RLS, explicit grants, policies that call `has_permission`, its own rows in `app_permissions`, and a pgTAP isolation test (see the README checklist).
- Prettier and ESLint are the formatters; apply them only to files you touch (`pnpm format:check`), never reformat untouched files.
- Update `README.md` when a script, the layout or a setup step changes. Edit `AGENTS.md` only when a convention or command changes.

## Plans

- Plans are tracked in `.claude/plans/`, one per ticket, named `<TICKET>-Short-Name.md`. When a plan covers several tickets the name lists every number (`DT-001-002-Short-Name.md`). Work with no ticket yet uses `NNN` (`DT-NNN-Short-Name.md`). `DT` is a placeholder prefix until the team picks a ticket key; replace it here when it does.
- Plan layout, in order:
  1. `# <TICKET> <what changes>`
  2. A blockquote for the implementer: follow the steps in order, run every gate and compare with "Expect", stop and report on any mismatch, do not `git add -A`, commit or push unless asked.
  3. **Why**
  4. **Facts (verified YYYY-MM-DD)**: numbered file paths, line numbers and exact strings.
  5. **Decisions already made (do not reopen)**, plus any "Open question (does not block)".
  6. **Out of scope**
  7. **Steps**, numbered from `0` (backup first when data is at risk, e.g. a DB dump before a migration). Each step has its edits, a **Gate** command and **Expect** text. Large plans group steps into phases, one commit per phase. A plan that makes a major architectural change (for example access control, the data model or auth) ends with a step that documents the change in its own numbered file `docs/architecture/NNNN-Short-Name.md` (NNNN is the next free number, starting at `0001`; create the folder if missing). The file starts with the ticket, the plan path, the date and the status, and `README.md` links to it.
  8. **Rollback**
  9. **Conventional commits**: the ordered commit list (subject, files staged, footer), the branch name and the PR title.

## Git

- Branch `main`; work lands via feature branches and PRs. Branch from `main` as `feat/<TICKETS>-<Short-Name>` (or `fix/...`).
- Commit subject: `type(scope): description`. Type and scope lowercase, one space after the colon, imperative description starting lowercase (proper nouns keep capitals), no trailing period, **72 characters or fewer**.
  - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`.
  - Scopes: `web` (`src/`), `db` (`supabase/migrations`, `supabase/seeds/`, `supabase/tests`), `functions` (`supabase/functions/`), `e2e` (`e2e/`), `agents` (`AGENTS.md`), `plans` (`.claude/plans/`).
- One concern per commit. Code and its tests go in separate commits (a small pair may be squashed). Never mix code from different phases in one commit. Every commit leaves the suites green: no red commit in history (amend before pushing, or add a `fix(...)` commit).
- Body is optional, wrapped at 72, and says why. Footer `Refs: <TICKET>[, <TICKET>]`, then the `Co-Authored-By` line on agent commits.
- Stage explicit paths, never `git add -A` (untracked plan files of other tickets may sit in the working tree).
- Commit or push only when asked.
- PR: title in the same format (72 characters or fewer), body from `.github/pull_request_template.md` once one exists, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Merge with a normal merge commit; do not squash the commit list away.
