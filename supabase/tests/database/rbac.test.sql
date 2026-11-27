-- pgTAP: Super Admin role, app_permissions, has_permission(), is_admin() with Super Admin.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

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

update public.profiles set role_id = '30000000-0000-0000-0000-000000000001'
  where id = 'cccccccc-0000-0000-0000-00000000000c';
update public.profiles set role_id = '30000000-0000-0000-0000-000000000003'
  where id = 'dddddddd-0000-0000-0000-00000000000d';

-- 1-2: RLS is on; anon is denied.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.app_permissions'::regclass),
  'app_permissions has RLS enabled'
);
set local role anon;
select throws_ok(
  'select count(*) from public.app_permissions',
  '42501',
  null,
  'anon is denied select on app_permissions'
);
reset role;

-- 3-6: shape and seed.
select set_eq(
  $$select column_name::text from information_schema.columns
      where table_schema = 'public' and table_name = 'app_permissions'$$,
  $$values ('role_id'), ('resource'), ('read'), ('create'), ('update'), ('delete')$$,
  'app_permissions has the expected columns'
);
select is(
  (select name from public.roles where id = '30000000-0000-0000-0000-000000000003'),
  'Super Admin',
  'the Super Admin role exists with its fixed id'
);
select cmp_ok(
  (select count(*) from public.app_permissions),
  '>=',
  12::bigint,
  'at least three roles x four tables are seeded'
);
-- Every public table must have a row for every role (each table migration seeds its own rows).
select is(
  (select count(*) from pg_tables t cross join public.roles r
    where t.schemaname = 'public'
      and not exists (
        select 1 from public.app_permissions a
        where a.role_id = r.id and a.resource = t.tablename)),
  0::bigint,
  'every public table has an app_permissions row for every role'
);

-- 7-12: seeded matrix, read,create,update,delete.
select is(
  (select concat_ws(',', "read", "create", "update", "delete") from public.app_permissions
    where role_id = '30000000-0000-0000-0000-000000000001' and resource = 'roles'),
  't,f,f,f',
  'Admin can only read roles'
);
select is(
  (select concat_ws(',', "read", "create", "update", "delete") from public.app_permissions
    where role_id = '30000000-0000-0000-0000-000000000001' and resource = 'app_permissions'),
  't,f,f,f',
  'Admin can only read app_permissions'
);
select is(
  (select concat_ws(',', "read", "create", "update", "delete") from public.app_permissions
    where role_id = '30000000-0000-0000-0000-000000000002' and resource = 'roles'),
  't,f,f,f',
  'User can only read roles'
);
select is(
  (select concat_ws(',', "read", "create", "update", "delete") from public.app_permissions
    where role_id = '30000000-0000-0000-0000-000000000002' and resource = 'todos'),
  't,t,t,t',
  'User keeps full access to their own todos'
);
select is(
  (select concat_ws(',', "read", "create", "update", "delete") from public.app_permissions
    where role_id = '30000000-0000-0000-0000-000000000003' and resource = 'roles'),
  't,t,t,t',
  'Super Admin can read and write roles'
);
select is(
  (select concat_ws(',', "read", "create", "update", "delete") from public.app_permissions
    where role_id = '30000000-0000-0000-0000-000000000003' and resource = 'app_permissions'),
  't,t,t,t',
  'Super Admin can read and write app_permissions'
);

-- Act as Alice (User).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);

-- 13-15
select is(public.has_permission('roles', 'create'), false, 'User cannot create roles');
select is(public.has_permission('todos', 'read'), true, 'User can read todos');
select throws_ok(
  $$insert into public.app_permissions (role_id, resource, "read")
    values ('30000000-0000-0000-0000-000000000002', 'sneaky', true)$$,
  '42501',
  null,
  'a User cannot insert into app_permissions'
);
reset role;

-- Act as Carol (Admin).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);

-- 16-23: an Admin writes the dispatch tables but not roles or app_permissions.
select is(public.is_admin(), true, 'is_admin() is true for an Admin');
select is(public.has_permission('roles', 'create'), false, 'Admin cannot create roles');
select is(public.has_permission('app_permissions', 'update'), false, 'Admin cannot update app_permissions');
select throws_ok(
  $$insert into public.roles (name) values ('Sneaky Role')$$,
  '42501',
  null,
  'an Admin cannot insert a role'
);
select throws_ok(
  $$insert into public.app_permissions (role_id, resource, "read")
    values ('30000000-0000-0000-0000-000000000002', 'sneaky', true)$$,
  '42501',
  null,
  'an Admin cannot insert into app_permissions'
);
select lives_ok(
  $$update public.app_permissions set "update" = true
      where role_id = '30000000-0000-0000-0000-000000000001' and resource = 'app_permissions'$$,
  'an Admin update of app_permissions is silently filtered by RLS'
);
select lives_ok(
  $$delete from public.app_permissions where resource = 'todos'$$,
  'an Admin delete of app_permissions is silently filtered by RLS'
);
select lives_ok(
  $$update public.roles set name = 'Hijacked'$$,
  'an Admin update of roles is silently filtered by RLS'
);
reset role;

-- Act as Sam (Super Admin).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-00000000000d', true);

-- 24-32: a Super Admin is an Admin and can write roles and app_permissions.
select is(public.is_admin(), true, 'is_admin() is true for a Super Admin');
select is(public.has_permission('roles', 'create'), true, 'Super Admin can create roles');
select is(public.has_permission('app_permissions', 'update'), true, 'Super Admin can update app_permissions');
select is(public.has_permission('roles', 'bogus'), false, 'an unknown action is denied');
select lives_ok(
  $$insert into public.roles (name) values ('Test Role')$$,
  'a Super Admin can insert a role'
);
select lives_ok(
  $$insert into public.app_permissions (role_id, resource, "read")
    values ('30000000-0000-0000-0000-000000000002', 'test_resource', true)$$,
  'a Super Admin can insert into app_permissions'
);
select lives_ok(
  $$update public.app_permissions set "read" = false where resource = 'test_resource'$$,
  'a Super Admin can update app_permissions'
);
select is(
  (select "read" from public.app_permissions where resource = 'test_resource'),
  false,
  'the Super Admin update was applied'
);
select lives_ok(
  $$delete from public.app_permissions where resource = 'test_resource'$$,
  'a Super Admin can delete from app_permissions'
);
reset role;

-- 33-36: nothing else changed.
select is(
  (select count(*) from public.app_permissions where resource = 'test_resource'),
  0::bigint,
  'the Super Admin test row is gone'
);
select is(
  (select concat_ws(',', "read", "create", "update", "delete") from public.app_permissions
    where role_id = '30000000-0000-0000-0000-000000000001' and resource = 'app_permissions'),
  't,f,f,f',
  'Admin permissions on app_permissions are unchanged'
);
select cmp_ok(
  (select count(*) from public.app_permissions where resource = 'todos'),
  '=',
  3::bigint,
  'the Admin delete attempt removed nothing'
);
select is(
  (select count(*) from public.roles where name = 'Hijacked'),
  0::bigint,
  'the Admin update of roles changed nothing'
);

-- 37-38: constraints (as owner).
select throws_ok(
  $$insert into public.app_permissions (role_id, resource)
    values ('30000000-0000-0000-0000-000000000001', 'roles')$$,
  '23505',
  null,
  'a role has one row per resource'
);
select throws_ok(
  $$insert into public.app_permissions (role_id, resource)
    values ('99999999-9999-9999-9999-999999999999', 'roles')$$,
  '23503',
  null,
  'app_permissions.role_id must exist in roles'
);

select * from finish();
rollback;
