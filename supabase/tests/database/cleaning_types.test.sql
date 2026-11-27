-- pgTAP: cleaning_types. RLS, access, constraints, seed.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Seed (runs after db:reset): exactly the seven types, and no duplicates on re-run.
select set_eq(
  $$select name from public.cleaning_types$$,
  $$values ('Regular'), ('Deep'), ('Move-In'), ('Move-Out'), ('Construction'), ('1500+ Square Feet'), ('Diamond Cleaning')$$,
  'seed creates exactly the standard cleaning types'
);

insert into public.cleaning_types (name) values
  ('Regular'),
  ('Deep'),
  ('Move-In'),
  ('Move-Out'),
  ('Construction'),
  ('1500+ Square Feet'),
  ('Diamond Cleaning')
on conflict (name) do nothing;

select is(
  (select count(*) from public.cleaning_types),
  7::bigint,
  'seeding twice creates no duplicate cleaning types'
);

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
insert into public.cleaning_types (name) values ('Test Type');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.cleaning_types'::regclass),
  'cleaning_types has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.cleaning_types$$,
  '42501',
  null,
  'anon is denied select on cleaning_types'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.cleaning_types (name) values ('Alice Type')$$,
  'an Admin can insert into cleaning_types'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.cleaning_types) >= 1,
  'a User can read cleaning_types'
);

select throws_ok(
  $$insert into public.cleaning_types (name) values ('Alice Type')$$,
  '42501',
  null,
  'a User cannot insert into cleaning_types'
);

select lives_ok(
  $$update public.cleaning_types set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.cleaning_types$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.cleaning_types) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select throws_ok(
  $$insert into public.cleaning_types (name) values ('Test Type')$$,
  '23505',
  null,
  'name must be unique'
);

select throws_ok(
  $$insert into public.cleaning_types (name) values (null)$$,
  '23502',
  null,
  'name is required'
);

select throws_ok(
  $$insert into public.cleaning_types (name) values ('   ')$$,
  '23514',
  null,
  'name cannot be blank'
);

select * from finish();
rollback;
