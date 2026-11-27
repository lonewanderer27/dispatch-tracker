-- 0041_remove_todos: the todos sample feature is gone from the app.
-- Dropping the table also drops its index, its five policies and its place in the
-- supabase_realtime publication. todo_stats() only read that table, so it goes first.

delete from public.app_permissions where resource = 'todos';

drop function public.todo_stats();

drop table public.todos;
