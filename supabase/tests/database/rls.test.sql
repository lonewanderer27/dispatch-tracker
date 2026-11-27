-- pgTAP: RLS, grants, profile trigger, admin override.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Fixed test identities. The whole file runs in one transaction and rolls back.

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bob@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'carol@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

-- A sign-up has no role (0040). These tests were written for a User, so give the test users that role.
update public.profiles set role_id = '30000000-0000-0000-0000-000000000002' where role_id is null;

-- Seed todos as the table owner (bypasses RLS).
insert into public.todos (user_id, title, done) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'alice one', false),
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'alice two', false),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'bob one', false);

-- 1-2: RLS is on for every public table and the two we own.
select is(
  (select count(*) from pg_tables t
     join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace
   where t.schemaname = 'public' and not c.relrowsecurity),
  0::bigint,
  'every public table has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.todos'::regclass),
  'todos has RLS enabled'
);

-- 3: profile trigger fires and derives display_name from the email.
select is(
  (select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  'alice',
  'profile trigger creates a profile with display_name from email'
);

-- 4: profile role defaults to user.
select is(
  (select role_id from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  '30000000-0000-0000-0000-000000000002'::uuid,
  'new profiles default to the User role'
);

-- Act as Alice (authenticated).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);

-- 5: Alice sees only her own todos.
select is(
  (select count(*) from public.todos),
  2::bigint,
  'user A sees only their own todos'
);

-- 6: Alice cannot read Bob's todos.
select is(
  (select count(*) from public.todos where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'),
  0::bigint,
  'user A cannot read user B todos'
);

-- 6b: is_admin() is false for a normal user.
select is(public.is_admin(), false, 'normal users are not admins (is_admin is false)');

-- 7: Alice's update of Bob's rows matches nothing (RLS filters it out); no error, no change.
select lives_ok(
  $$update public.todos set title = 'hijacked' where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'$$,
  'user A update of user B todos is silently filtered by RLS'
);

-- 8: Alice cannot insert a todo owned by Bob.
select throws_ok(
  $$insert into public.todos (user_id, title) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'sneaky')$$,
  '42501',
  null,
  'user A cannot insert todos for user B'
);

-- 9: Alice cannot promote herself to admin.
select throws_ok(
  $$update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '42501',
  null,
  'users cannot change their own role'
);

reset role;

-- 7b: Bob's todo title was not changed (checked as owner).
select is(
  (select title from public.todos where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'),
  'bob one',
  'user B todo title untouched after user A update attempt'
);

-- 10: anon is denied table access.
set local role anon;
select throws_ok(
  'select count(*) from public.todos',
  '42501',
  null,
  'anon is denied select on todos'
);
reset role;

-- Promote Carol to admin (as owner, the only path to role changes).
update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'cccccccc-0000-0000-0000-00000000000c';

-- 11: admin override: Carol (admin) sees Alice's and Bob's todos.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select is(
  (select count(*) from public.todos
     where user_id in ('aaaaaaaa-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-00000000000b')),
  3::bigint,
  'admin override lets an admin read other users todos (A and B)'
);
reset role;

-- 12: is_admin() is not callable by anon.
set local role anon;
select throws_ok(
  'select public.is_admin()',
  '42501',
  null,
  'anon cannot call is_admin()'
);
reset role;

-- 14: Realtime publication includes todos.
select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'todos'
  ),
  'todos is in the supabase_realtime publication'
);

select * from finish();
rollback;
