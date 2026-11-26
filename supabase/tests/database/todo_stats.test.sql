-- pgTAP: todo_stats() RPC. Proves security invoker + RLS, math, and grants.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('a1a1a1a1-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'stats-a@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('b1b1b1b1-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'stats-b@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('d1d1d1d1-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'stats-empty@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

-- User A: 3 todos, 1 done. User B: 1 todo, not done. User D: none.
insert into public.todos (user_id, title, done) values
  ('a1a1a1a1-0000-0000-0000-000000000001', 'a1', true),
  ('a1a1a1a1-0000-0000-0000-000000000001', 'a2', false),
  ('a1a1a1a1-0000-0000-0000-000000000001', 'a3', false),
  ('b1b1b1b1-0000-0000-0000-000000000002', 'b1', false);

-- 1: as A, counts are 3 / 1 / 2 and pct_done is 33.3.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a1a1a1a1-0000-0000-0000-000000000001', true);
select results_eq(
  $$select total, done, pending, pct_done from public.todo_stats()$$,
  $$values (3, 1, 2, 33.3::numeric)$$,
  'as user A: total=3 done=1 pending=2 pct_done=33.3'
);
reset role;

-- 2: as B, sees only their own counts (security invoker + RLS).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1b1b1b1-0000-0000-0000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'b1b1b1b1-0000-0000-0000-000000000002', true);
select results_eq(
  $$select total, done, pending, pct_done from public.todo_stats()$$,
  $$values (1, 0, 1, 0::numeric)$$,
  'as user B: sees only B counts, not A counts'
);
reset role;

-- 3: a user with no todos gets zeros, no divide-by-zero.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1d1d1d1-0000-0000-0000-000000000003","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd1d1d1d1-0000-0000-0000-000000000003', true);
select results_eq(
  $$select total, done, pending, pct_done from public.todo_stats()$$,
  $$values (0, 0, 0, 0::numeric)$$,
  'empty user returns 0,0,0,0 without divide-by-zero'
);
reset role;

-- 4: anon has no execute permission.
set local role anon;
select throws_ok(
  'select * from public.todo_stats()',
  '42501',
  null,
  'anon is denied execute on todo_stats()'
);
reset role;

-- 5: the function is security invoker (not definer), so RLS is not bypassed.
select is(
  (select prosecdef from pg_proc where proname = 'todo_stats' and pronamespace = 'public'::regnamespace),
  false,
  'todo_stats is SECURITY INVOKER (prosecdef = false)'
);

-- 6: only authenticated has execute (public revoked).
select ok(
  has_function_privilege('authenticated', 'public.todo_stats()', 'execute')
    and not has_function_privilege('anon', 'public.todo_stats()', 'execute'),
  'authenticated can execute todo_stats(); anon cannot'
);

select * from finish();
rollback;
