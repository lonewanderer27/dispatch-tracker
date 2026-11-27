-- pgTAP: roles table, profiles.role_id, is_admin().
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Fixed test identities. The whole file runs in one transaction and rolls back.
-- Alice is a normal user. Carol is promoted to Admin below.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'carol@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

update public.profiles set role_id = '30000000-0000-0000-0000-000000000001'
  where id = 'cccccccc-0000-0000-0000-00000000000c';

-- 1-2: RLS is on; anon is denied.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.roles'::regclass),
  'roles has RLS enabled'
);
set local role anon;
select throws_ok(
  'select count(*) from public.roles',
  '42501',
  null,
  'anon is denied select on roles'
);
reset role;

-- 3-4: exactly the two roles, with their fixed ids.
select set_eq(
  $$select name from public.roles$$,
  $$values ('Admin'), ('User')$$,
  'the migration creates exactly the Admin and User roles'
);
select is(
  (select count(*) from public.roles where id in
    ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')),
  2::bigint,
  'the roles have their fixed ids'
);

-- 5-6: profiles.role is gone; a new profile defaults to the User role.
select is(
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'),
  0::bigint,
  'profiles.role no longer exists'
);
select is(
  (select role_id from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  '30000000-0000-0000-0000-000000000002'::uuid,
  'a new profile defaults to the User role'
);

-- 7-12: constraints (as owner).
select throws_ok(
  $$update public.profiles set role_id = null where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '23502',
  null,
  'profiles.role_id is required'
);
select throws_ok(
  $$update public.profiles set role_id = '99999999-9999-9999-9999-999999999999' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '23503',
  null,
  'profiles.role_id must exist in roles'
);
select throws_ok(
  $$delete from public.roles where id = '30000000-0000-0000-0000-000000000002'$$,
  '23503',
  null,
  'a role that is in use cannot be deleted'
);
select throws_ok(
  $$insert into public.roles (name) values ('Admin')$$,
  '23505',
  null,
  'role name must be unique'
);
select throws_ok(
  $$insert into public.roles (name) values (null)$$,
  '23502',
  null,
  'role name is required'
);
select throws_ok(
  $$insert into public.roles (name) values ('   ')$$,
  '23514',
  null,
  'role name cannot be blank'
);

-- Act as Carol (Admin role).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);

-- 13-14: an Admin is recognised and can write.
select is(public.is_admin(), true, 'is_admin() is true for a profile with the Admin role');
select lives_ok(
  $$insert into public.roles (name) values ('Test Role')$$,
  'an Admin can insert a role'
);
reset role;

-- Act as Alice (User role).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);

-- 15-19: a User can read but not write.
select is(public.is_admin(), false, 'is_admin() is false for a profile with the User role');
select ok(
  (select count(*) from public.roles) >= 2,
  'a User can read roles'
);
select throws_ok(
  $$insert into public.roles (name) values ('Sneaky Role')$$,
  '42501',
  null,
  'a User cannot insert a role'
);
select lives_ok(
  $$update public.roles set name = 'Hijacked'$$,
  'a User update is silently filtered by RLS'
);
select lives_ok(
  $$delete from public.roles where name = 'Test Role'$$,
  'a User delete is silently filtered by RLS'
);

-- 20: a User cannot promote themselves (no update grant on role_id).
select throws_ok(
  $$update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '42501',
  null,
  'a User cannot change their own role'
);
reset role;

-- 21-22: nothing was changed by the User attempts.
select ok(
  (select count(*) from public.roles where name in ('Admin', 'User', 'Test Role')) = 3,
  'roles are unchanged after the User update and delete attempts'
);
select is(
  (select role_id from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  '30000000-0000-0000-0000-000000000002'::uuid,
  'Alice is still a User'
);

select * from finish();
rollback;
