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
