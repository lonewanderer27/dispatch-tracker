-- pgTAP: a sign-up has no role (0040) and can read nothing until a Super Admin gives one.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Nora just signed up (no role). Sam is a Super Admin.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('e5500000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'nora@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('d5500000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sam@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

update public.profiles set role_id = '30000000-0000-0000-0000-000000000003'
  where id = 'd5500000-0000-0000-0000-00000000000d';

-- One todo of Nora's, made as the owner, so we can tell "hidden" from "not there".
insert into public.todos (user_id, title) values ('e5500000-0000-0000-0000-00000000000e', 'Nora todo');

-- 1: the trigger gave her no role.
select is(
  (select role_id from public.profiles where id = 'e5500000-0000-0000-0000-00000000000e'),
  null::uuid,
  'a new sign-up has no role'
);

-- Act as Nora.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e5500000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e5500000-0000-0000-0000-00000000000e', true);

-- 2-5: no permission, no admin rights.
select is(public.has_permission('clients', 'read'), false, 'no role: cannot read clients');
select is(public.has_permission('cleaning_jobs', 'read'), false, 'no role: cannot read cleaning jobs');
select is(public.is_admin(), false, 'no role: not an admin');
select is(public.is_super_admin(), false, 'no role: not a Super Admin');

-- 6-7: only her own profile; no role list.
select is(
  (select count(*) from public.profiles),
  1::bigint,
  'no role: she sees only her own profile'
);
select is((select count(*) from public.roles), 0::bigint, 'no role: she cannot read roles');

-- 8-9: even her own todos are hidden and she cannot add one.
select is((select count(*) from public.todos), 0::bigint, 'no role: her own todo is hidden');
select throws_ok(
  $$insert into public.todos (user_id, title) values ('e5500000-0000-0000-0000-00000000000e', 'x')$$,
  '42501',
  null,
  'no role: she cannot create a todo'
);
reset role;

-- 10: Sam gives her the User role.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d5500000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'd5500000-0000-0000-0000-00000000000d', true);
select lives_ok(
  $$select public.admin_update_profile('e5500000-0000-0000-0000-00000000000e', 'Nora', '30000000-0000-0000-0000-000000000002')$$,
  'a Super Admin can give her a role'
);
reset role;

-- 11-13: now she gets what a User gets.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e5500000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e5500000-0000-0000-0000-00000000000e', true);
select is(public.has_permission('clients', 'read'), true, 'with the User role she can read clients');
select is(public.has_permission('clients', 'create'), false, 'with the User role she still cannot create clients');
select is((select count(*) from public.todos), 1::bigint, 'with the User role she sees her own todo');
reset role;

select * from finish();
rollback;
