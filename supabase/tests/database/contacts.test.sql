-- pgTAP: contacts. RLS, access, constraints.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

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
insert into public.clients (id, company_id, name) values ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Test Client');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.contacts'::regclass),
  'contacts has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.contacts$$,
  '42501',
  null,
  'anon is denied select on contacts'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values ('c1000000-0000-0000-0000-000000000001', 'Alice', 'Contact', '+61 0412 345 678')$$,
  'an Admin can insert into contacts'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.contacts) >= 1,
  'a User can read contacts'
);

select throws_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values ('c1000000-0000-0000-0000-000000000001', 'Alice', 'Contact', '+61 0412 345 678')$$,
  '42501',
  null,
  'a User cannot insert into contacts'
);

select lives_ok(
  $$update public.contacts set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.contacts$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.contacts) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select is(
  (select contact_no from public.contacts where first_name = 'Alice'),
  '+61 0412 345 678',
  'contact_no is stored exactly as entered'
);

select lives_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values ('c1000000-0000-0000-0000-000000000001', 'Zero', 'Lead', '0412345678')$$,
  'a leading zero is accepted'
);

select is(
  (select contact_no from public.contacts where first_name = 'Zero'),
  '0412345678',
  'a leading zero is kept'
);

select throws_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values (null, 'A', 'B', '1')$$,
  '23502',
  null,
  'client_id is required'
);

select throws_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values ('99999999-9999-9999-9999-999999999999', 'A', 'B', '1')$$,
  '23503',
  null,
  'client_id must exist in clients'
);

select throws_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values ('c1000000-0000-0000-0000-000000000001', null, 'B', '1')$$,
  '23502',
  null,
  'first_name is required'
);

select throws_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values ('c1000000-0000-0000-0000-000000000001', 'A', null, '1')$$,
  '23502',
  null,
  'last_name is required'
);

select throws_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values ('c1000000-0000-0000-0000-000000000001', 'A', 'B', null)$$,
  '23502',
  null,
  'contact_no is required'
);

select throws_ok(
  $$insert into public.contacts (client_id, first_name, last_name, contact_no) values ('c1000000-0000-0000-0000-000000000001', '  ', 'B', '1')$$,
  '23514',
  null,
  'first_name cannot be blank'
);

-- Scoped to the test client: seeded local data also has contacts.
delete from public.clients where id = 'c1000000-0000-0000-0000-000000000001';

select is(
  (select count(*) from public.contacts where client_id = 'c1000000-0000-0000-0000-000000000001'),
  0::bigint,
  'deleting a client deletes its contacts'
);

select * from finish();
rollback;
