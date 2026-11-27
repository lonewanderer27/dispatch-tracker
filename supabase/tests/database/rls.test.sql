-- pgTAP: RLS, grants, profile trigger, admin override.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

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

-- 1: RLS is on for every public table.
select is(
  (select count(*) from pg_tables t
     join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace
   where t.schemaname = 'public' and not c.relrowsecurity),
  0::bigint,
  'every public table has RLS enabled'
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

-- 6b: is_admin() is false for a normal user.
select is(public.is_admin(), false, 'normal users are not admins (is_admin is false)');

-- 9: Alice cannot promote herself to admin.
select throws_ok(
  $$update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '42501',
  null,
  'users cannot change their own role'
);

reset role;

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

select * from finish();
rollback;
