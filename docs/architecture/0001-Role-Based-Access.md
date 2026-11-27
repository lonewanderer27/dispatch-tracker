# 0001 Role-based access

- Ticket: T3C-B0
- Plan: `.claude/plans/backend/T3C-B0-Users-Table.md`
- Date: 2026-11-27
- Status: implemented

## Summary

Access is decided by the signed-in user's role, through a permission matrix in the database.

## Access control

Access is decided in Postgres, by row level security (RLS). The web app and the edge functions only
ask the database; they do not decide who may do what.

### Roles

- `public.roles` holds three rows with fixed ids: Admin (`30000000-0000-0000-0000-000000000001`),
  User (`...0002`) and Super Admin (`...0003`).
- `public.profiles.role_id` links every profile to one role. New profiles default to User.
- `role_id` is column-protected: signed-in users can update only `profiles.display_name`. A role is
  assigned only with direct database access.
- Anonymous sign-in is off (`enable_anonymous_sign_ins = false` in `supabase/config.jsonc`). On
  hosted projects it is switched off in the Supabase dashboard.

### Permission matrix

- `public.app_permissions` has one row per role and table: `role_id`, `resource` (the table name),
  and four booleans `read`, `create`, `update`, `delete`. The key is `(role_id, resource)`.
- Admin and Super Admin read and write every dispatch table. User reads only.
- Only Super Admin can write `roles` and `app_permissions`. Admin can only read them.
- The rows for `profiles` and `todos` describe today's behaviour (own rows only for Users). Their
  policies are written by hand and do not read the matrix.

### How a policy reads the matrix

- `public.has_permission(resource, action)` is `security definer` and `stable`. It looks up the
  signed-in user's role in `profiles`, then the row for that resource in `app_permissions`. It returns
  `false` for an unknown action or when there is no row (deny by default).
- Every dispatch table has four policies, one per action, that call
  `(select public.has_permission('<table>', '<action>'))`.
- `public.is_admin()` is true for Admin and Super Admin. Only the `profiles` and `todos` policies still
  use it.

### Adding a table

1. Create the table, enable RLS, revoke all from `anon` and `authenticated`, grant explicitly.
2. Add the four `has_permission` policies.
3. In the same migration insert the table's three rows in `app_permissions` (Admin and Super Admin
   `read, create, update, delete`; User `read` only).
4. `supabase/tests/database/rbac.test.sql` fails if any public table has no row for a role.

### Known limits

- A Super Admin can remove their own `app_permissions` rights. Only direct database access restores
  them.
- Nothing in the app lets a user change a role.
- Anyone who can register gets the User role and can read every table (`enable_signup` is `true`).
