-- pgTAP: companies table. RLS, admin-only writes, name constraints.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Fixed test identities. The whole file runs in one transaction and rolls back.
-- Alice is a normal user. Carol is promoted to admin below.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-1111-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'co-alice@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('cccccccc-1111-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'co-carol@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

-- A sign-up has no role (0040). These tests were written for a User, so give the test users that role.
update public.profiles set role_id = '30000000-0000-0000-0000-000000000002' where role_id is null;

update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'cccccccc-1111-0000-0000-00000000000c';

-- A row to read and to try to change (inserted as the table owner, bypassing RLS).
insert into public.companies (name) values ('Test Co A');

-- 1: RLS is on.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.companies'::regclass),
  'companies has RLS enabled'
);

-- 2: anon is denied.
set local role anon;
select throws_ok(
  'select count(*) from public.companies',
  '42501',
  null,
  'anon is denied select on companies'
);
reset role;

-- Act as Alice (normal user).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-1111-0000-0000-00000000000a', true);

-- 3: a normal user can read companies.
select is(
  (select count(*) from public.companies where name = 'Test Co A'),
  1::bigint,
  'a normal user can read companies'
);

-- 4: a normal user cannot insert.
select throws_ok(
  $$insert into public.companies (name) values ('Sneaky Co')$$,
  '42501',
  null,
  'a normal user cannot insert a company'
);

-- 5-6: update and delete match no rows for a normal user (RLS filters them), no error.
select lives_ok(
  $$update public.companies set name = 'Hijacked' where name = 'Test Co A'$$,
  'a normal user update is silently filtered by RLS'
);
select lives_ok(
  $$delete from public.companies where name = 'Test Co A'$$,
  'a normal user delete is silently filtered by RLS'
);
reset role;

-- 7: the row is untouched (checked as owner).
select is(
  (select count(*) from public.companies where name = 'Test Co A'),
  1::bigint,
  'Test Co A is unchanged after the normal user update and delete attempts'
);

-- 8-10: name constraints (as owner).
select throws_ok(
  $$insert into public.companies (name) values ('Test Co A')$$,
  '23505',
  null,
  'name must be unique'
);
select throws_ok(
  $$insert into public.companies (name) values (null)$$,
  '23502',
  null,
  'name is required'
);
select throws_ok(
  $$insert into public.companies (name) values ('   ')$$,
  '23514',
  null,
  'name cannot be blank'
);

-- Act as Carol (admin).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-1111-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-1111-0000-0000-00000000000c', true);

-- 11: an admin can insert.
select lives_ok(
  $$insert into public.companies (name) values ('Test Co B')$$,
  'an admin can insert a company'
);

-- 12-13: an admin can update.
select lives_ok(
  $$update public.companies set name = 'Test Co C' where name = 'Test Co B'$$,
  'an admin can update a company'
);
select is(
  (select count(*) from public.companies where name = 'Test Co C'),
  1::bigint,
  'the admin update took effect'
);

-- 14-15: an admin can delete.
select lives_ok(
  $$delete from public.companies where name = 'Test Co C'$$,
  'an admin can delete a company'
);
select is(
  (select count(*) from public.companies where name in ('Test Co B', 'Test Co C')),
  0::bigint,
  'the admin delete took effect'
);
reset role;

select * from finish();
rollback;
