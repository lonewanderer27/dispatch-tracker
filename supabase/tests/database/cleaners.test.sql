-- pgTAP: cleaners. RLS, access, constraints.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Fixed test identities. The whole file runs in one transaction and rolls back.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'carol@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

-- A sign-up has no role (0040). These tests were written for a User, so give the test users that role.
update public.profiles set role_id = '30000000-0000-0000-0000-000000000002' where role_id is null;

update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'cccccccc-0000-0000-0000-00000000000c';

-- Fixture rows, inserted as the table owner (bypasses RLS).

select ok(
  (select relrowsecurity from pg_class where oid = 'public.cleaners'::regclass),
  'cleaners has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.cleaners$$,
  '42501',
  null,
  'anon is denied select on cleaners'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.cleaners (first_name, last_name) values ('Alice', 'Cleaner')$$,
  'an Admin can insert into cleaners'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.cleaners) >= 1,
  'a User can read cleaners'
);

select throws_ok(
  $$insert into public.cleaners (first_name, last_name) values ('Alice', 'Cleaner')$$,
  '42501',
  null,
  'a User cannot insert into cleaners'
);

select lives_ok(
  $$update public.cleaners set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.cleaners$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.cleaners) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select lives_ok(
  $$insert into public.cleaners (first_name, middle_name, last_name) values ('Mid', 'Dle', 'Name')$$,
  'middle_name is accepted when given'
);

select is(
  (select count(*) from public.cleaners where first_name = 'Alice' and middle_name is null),
  1::bigint,
  'middle_name is optional'
);

select throws_ok(
  $$insert into public.cleaners (first_name, last_name) values (null, 'X')$$,
  '23502',
  null,
  'first_name is required'
);

select throws_ok(
  $$insert into public.cleaners (first_name, last_name) values ('X', null)$$,
  '23502',
  null,
  'last_name is required'
);

select throws_ok(
  $$insert into public.cleaners (first_name, last_name) values ('  ', 'X')$$,
  '23514',
  null,
  'first_name cannot be blank'
);

select throws_ok(
  $$insert into public.cleaners (first_name, last_name) values ('X', '  ')$$,
  '23514',
  null,
  'last_name cannot be blank'
);

select * from finish();
rollback;
