-- 0002_todo_stats: per-caller todo totals, exposed as RPC.

create or replace function public.todo_stats()
returns table (total int, done int, pending int, pct_done numeric)
language sql
stable
security invoker          -- RLS still applies, so each user sees only their own counts
set search_path = public
as $$
  select
    count(*)::int,
    count(*) filter (where done)::int,
    count(*) filter (where not done)::int,
    coalesce(round(100.0 * count(*) filter (where done) / nullif(count(*), 0), 1), 0)
  from public.todos;
$$;

revoke execute on function public.todo_stats() from public, anon;
grant  execute on function public.todo_stats() to authenticated;
