# 0002 User management

- Ticket: T3C-B0
- Plan: `.claude/plans/backend/T3C-B0-Users-Table.md` (Phase 3)
- Date: 2026-11-27
- Status: implemented
- Builds on: [0001 Role-based access](0001-Role-Based-Access.md)

## Summary

A Super Admin can change another user's display name and role from a Users page. Nobody else can.

## How it works

- `public.is_super_admin()` is true when the caller's profile has the Super Admin role.
- `public.admin_update_profile(user_id, display_name, role_id)` is the only way to change someone
  else's profile or any `role_id`. It is `security definer` and raises `42501` unless the caller is a
  Super Admin. It trims the name, limits it to 100 characters, and does not let a Super Admin change
  their own role, so at least one Super Admin always exists.
- No grant or policy on `profiles` changed. Users can still update only their own `display_name`.
- The web app has an `accessControlProvider` that allows the `profiles` resource only for a Super Admin
  (the identity carries `roleId`). That hides the Users sidebar item and redirects `/users` to the
  dashboard. It is a convenience: the database is what enforces the rule.
- The Users page lists every profile (a Super Admin can already read them all) and edits through the
  function, not through the data provider.

## Known limits

- The list shows no email address, because `profiles` has no email column.
- A changed role applies on the user's next request; their open page keeps showing the old role until
  it reloads.
- There is no way to create or delete users or roles from the app.
