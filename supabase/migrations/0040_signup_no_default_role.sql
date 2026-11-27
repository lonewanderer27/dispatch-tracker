-- 0040_signup_no_default_role: a new sign-up has no role, so it can read nothing until a Super Admin
-- gives it one on the Users page. Existing users keep their roles; no data changes.

alter table public.profiles
  alter column role_id drop default,
  alter column role_id drop not null;

-- has_permission() is false for a profile without a role (its join finds no app_permissions row), so every
-- table whose policies call it already shows nothing to such a user. todos was the exception: its own-row
-- policies did not look at the permission matrix. They do now. todos_admin_all is unchanged.
drop policy todos_select_own on public.todos;
drop policy todos_insert_own on public.todos;
drop policy todos_update_own on public.todos;
drop policy todos_delete_own on public.todos;

create policy todos_select_own
  on public.todos for select to authenticated
  using (user_id = (select auth.uid()) and (select public.has_permission('todos', 'read')));

create policy todos_insert_own
  on public.todos for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_permission('todos', 'create')));

create policy todos_update_own
  on public.todos for update to authenticated
  using (user_id = (select auth.uid()) and (select public.has_permission('todos', 'update')))
  with check (user_id = (select auth.uid()) and (select public.has_permission('todos', 'update')));

create policy todos_delete_own
  on public.todos for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.has_permission('todos', 'delete')));
