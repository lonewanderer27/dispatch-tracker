# 0001 Role-based access

- Ticket: T3C-B0
- Plan: `.claude/plans/T3C-B0-Users-Table.md`
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
- `role_id` is column-protected: signed-in users can update only `profiles.display_name`. Only a
  Super Admin can change a role, through a function (see 0002 User management).
- Anonymous sign-in is off (`enable_anonymous_sign_ins = false` in `supabase/config.jsonc`). On
  hosted projects it is switched off in the Supabase dashboard.

### Permission matrix

- `public.app_permissions` has one row per role and table: `role_id`, `resource` (the table name),
  and four booleans `read`, `create`, `update`, `delete`. The key is `(role_id, resource)`.
- Admin and Super Admin read and write every dispatch table. User reads only.
- Only Super Admin can write `roles` and `app_permissions`. Admin can only read them.
- The row for `profiles` describes today's behaviour (own rows only for Users). Its policies are
  written by hand and do not read the matrix. (`todos` had a row too until 0041 dropped the table.)

### How a policy reads the matrix

- `public.has_permission(resource, action)` is `security definer` and `stable`. It looks up the
  signed-in user's role in `profiles`, then the row for that resource in `app_permissions`. It returns
  `false` for an unknown action or when there is no row (deny by default).
- Every dispatch table has four policies, one per action, that call
  `(select public.has_permission('<table>', '<action>'))`.
- `public.is_admin()` is true for Admin and Super Admin. Only the `profiles` policies still use it.

### Adding a table

1. Create the table, enable RLS, revoke all from `anon` and `authenticated`, grant explicitly.
2. Add the four `has_permission` policies.
3. In the same migration insert the table's three rows in `app_permissions` (Admin and Super Admin
   `read, create, update, delete`; User `read` only).
4. `supabase/tests/database/rbac.test.sql` fails if any public table has no row for a role.

### Known limits

- A Super Admin can remove their own `app_permissions` rights. Only direct database access restores
  them.
- Only a Super Admin can change a role, from the Users page (see 0002 User management).
- Anyone who can register gets the User role and can read every table (`enable_signup` is `true`).

## Sign-ups have no role (0040)

- Ticket: T3C-B39. Plan: `.claude/plans/T3C-B39-Backend-Signup-No-Default-Role.md`. Date: 2026-11-27.
- `profiles.role_id` is empty for a new sign-up (no default, not required). Nothing invents a role. Existing users keep theirs.
- `has_permission()` is false for a user with no role, so the dispatch tables, `roles` and `app_permissions` show them nothing. The four own-row policies of `todos` now call `has_permission('todos', ...)` too, so even their own todos are hidden. (The table was dropped in 0041; see [0009](0009-Remove-Todos.md).) A user with no role can still read and rename their own profile row, because the app needs it to know who they are.
- The web app replaces every page with "Your account has no access yet" and a Sign out button for such a user (`RoleOutlet`, `src/app/RoleGate.tsx`). It fails closed. The database is what enforces the rule.
- A Super Admin gives a role on the Users page (`admin_update_profile`). The list shows "No role" for new sign-ups.
- Public sign-up stays on. In the hosted project **Confirm email must be on**, so nobody can sign up with an address they do not own.
- Known limits: nobody is told when someone signs up; a person with a password and a role can use the API directly (not only the web app).
