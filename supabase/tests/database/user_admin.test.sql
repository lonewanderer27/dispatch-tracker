-- pgTAP: is_super_admin() and admin_update_profile().
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Fixed test identities. The whole file runs in one transaction and rolls back.
-- Alice is a User, Carol is an Admin, Sam is a Super Admin.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'carol@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sam@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

-- A sign-up has no role (0040). These tests were written for a User, so give the test users that role.
update public.profiles set role_id = '30000000-0000-0000-0000-000000000002' where role_id is null;

update public.profiles set role_id = '30000000-0000-0000-0000-000000000001'
  where id = 'cccccccc-0000-0000-0000-00000000000c';
update public.profiles set role_id = '30000000-0000-0000-0000-000000000003'
  where id = 'dddddddd-0000-0000-0000-00000000000d';

-- 1: anon cannot call the function.
set local role anon;
select throws_ok(
  $$select public.admin_update_profile('aaaaaaaa-0000-0000-0000-00000000000a', 'Hacked', '30000000-0000-0000-0000-000000000002')$$,
  '42501',
  null,
  'anon cannot call admin_update_profile'
);
reset role;

-- Act as Alice (User).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);

-- 2-3
select throws_ok(
  $$select public.admin_update_profile('aaaaaaaa-0000-0000-0000-00000000000a', 'Alice', '30000000-0000-0000-0000-000000000003')$$,
  '42501',
  null,
  'a User cannot call admin_update_profile'
);
select is(public.is_super_admin(), false, 'is_super_admin() is false for a User');
reset role;

-- Act as Carol (Admin).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);

-- 4-6
select throws_ok(
  $$select public.admin_update_profile('aaaaaaaa-0000-0000-0000-00000000000a', 'Alice', '30000000-0000-0000-0000-000000000002')$$,
  '42501',
  null,
  'an Admin cannot call admin_update_profile'
);
select throws_ok(
  $$update public.profiles set role_id = '30000000-0000-0000-0000-000000000003' where id = 'cccccccc-0000-0000-0000-00000000000c'$$,
  '42501',
  null,
  'an Admin still cannot write role_id directly'
);
select is(public.is_super_admin(), false, 'is_super_admin() is false for an Admin');
reset role;

-- Act as Sam (Super Admin).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-00000000000d', true);

-- 7-11: a Super Admin reads and updates other users.
select is(public.is_super_admin(), true, 'is_super_admin() is true for a Super Admin');
select ok(
  (select count(*) from public.profiles
     where id in ('aaaaaaaa-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-00000000000c',
                  'dddddddd-0000-0000-0000-00000000000d')) = 3,
  'a Super Admin can read every profile'
);
select lives_ok(
  $$select public.admin_update_profile('aaaaaaaa-0000-0000-0000-00000000000a', 'Alice Renamed', '30000000-0000-0000-0000-000000000001')$$,
  'a Super Admin can update another user'
);
select is(
  (select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  'Alice Renamed',
  'the display name was updated'
);
select is(
  (select role_id from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  '30000000-0000-0000-0000-000000000001'::uuid,
  'the role was updated'
);

-- 12-13: the display name is trimmed.
select lives_ok(
  $$select public.admin_update_profile('aaaaaaaa-0000-0000-0000-00000000000a', '  Padded  ', '30000000-0000-0000-0000-000000000001')$$,
  'a padded display name is accepted'
);
select is(
  (select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  'Padded',
  'the display name was trimmed'
);

-- 14: too long.
select throws_ok(
  $$select public.admin_update_profile('aaaaaaaa-0000-0000-0000-00000000000a', repeat('x', 101), '30000000-0000-0000-0000-000000000001')$$,
  '22023',
  null,
  'a display name over 100 characters is rejected'
);

-- 15-16: own role is locked, own display name is not.
select throws_ok(
  $$select public.admin_update_profile('dddddddd-0000-0000-0000-00000000000d', 'Sam', '30000000-0000-0000-0000-000000000001')$$,
  '22023',
  null,
  'a Super Admin cannot change their own role'
);
select lives_ok(
  $$select public.admin_update_profile('dddddddd-0000-0000-0000-00000000000d', 'Sam Renamed', '30000000-0000-0000-0000-000000000003')$$,
  'a Super Admin can change their own display name'
);

-- 17-18: unknown user and unknown role.
select throws_ok(
  $$select public.admin_update_profile('99999999-9999-9999-9999-999999999999', 'Nobody', '30000000-0000-0000-0000-000000000002')$$,
  'P0002',
  null,
  'an unknown user is rejected'
);
select throws_ok(
  $$select public.admin_update_profile('aaaaaaaa-0000-0000-0000-00000000000a', 'Alice', '99999999-9999-9999-9999-999999999999')$$,
  '23503',
  null,
  'an unknown role is rejected'
);
reset role;

select * from finish();
rollback;
