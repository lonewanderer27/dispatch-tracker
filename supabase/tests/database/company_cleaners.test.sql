-- pgTAP: company_cleaners. RLS, access, constraints.
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

update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'cccccccc-0000-0000-0000-00000000000c';

-- Fixture rows, inserted as the table owner (bypasses RLS).
insert into public.companies (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Test Co');
insert into public.companies (id, name) values ('c0000000-0000-0000-0000-000000000002', 'Test Co 2');
insert into public.cleaners (id, first_name, last_name) values
  ('c2000000-0000-0000-0000-000000000001', 'Test', 'Cleaner'),
  ('c2000000-0000-0000-0000-000000000002', 'Second', 'Cleaner');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.company_cleaners'::regclass),
  'company_cleaners has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.company_cleaners$$,
  '42501',
  null,
  'anon is denied select on company_cleaners'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.company_cleaners (cleaner_id, company_id) values ('c2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001')$$,
  'an Admin can insert into company_cleaners'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.company_cleaners) >= 1,
  'a User can read company_cleaners'
);

select throws_ok(
  $$insert into public.company_cleaners (cleaner_id, company_id) values ('c2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'a User cannot insert into company_cleaners'
);

select lives_ok(
  $$update public.company_cleaners set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.company_cleaners$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.company_cleaners) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select throws_ok(
  $$insert into public.company_cleaners (cleaner_id, company_id) values ('c2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001')$$,
  '23505',
  null,
  'the (cleaner_id, company_id) pair must be unique'
);

select lives_ok(
  $$insert into public.company_cleaners (cleaner_id, company_id) values ('c2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')$$,
  'a cleaner can work for several companies'
);

select throws_ok(
  $$insert into public.company_cleaners (cleaner_id, company_id) values (null, 'c0000000-0000-0000-0000-000000000001')$$,
  '23502',
  null,
  'cleaner_id is required'
);

select throws_ok(
  $$insert into public.company_cleaners (cleaner_id, company_id) values ('c2000000-0000-0000-0000-000000000001', null)$$,
  '23502',
  null,
  'company_id is required'
);

select throws_ok(
  $$insert into public.company_cleaners (cleaner_id, company_id) values ('99999999-9999-9999-9999-999999999999', 'c0000000-0000-0000-0000-000000000001')$$,
  '23503',
  null,
  'cleaner_id must exist in cleaners'
);

select throws_ok(
  $$insert into public.company_cleaners (cleaner_id, company_id) values ('c2000000-0000-0000-0000-000000000002', '99999999-9999-9999-9999-999999999999')$$,
  '23503',
  null,
  'company_id must exist in companies'
);

select * from finish();
rollback;
