-- pgTAP: cleaning_statuses. RLS, access, constraints, seed.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Seed (runs after db:reset): exactly the four statuses in order, and no duplicates on re-run.
select results_eq(
  $$select name from public.cleaning_statuses order by id$$,
  $$values ('Booked'), ('Confirmed'), ('In Progress'), ('Done')$$,
  'seed creates the four statuses in life-cycle order'
);

insert into public.cleaning_statuses (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Booked'),
  ('10000000-0000-0000-0000-000000000002', 'Confirmed'),
  ('10000000-0000-0000-0000-000000000003', 'In Progress'),
  ('10000000-0000-0000-0000-000000000004', 'Done')
on conflict do nothing;

select is(
  (select count(*) from public.cleaning_statuses),
  4::bigint,
  'seeding twice creates no duplicate statuses'
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

update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'cccccccc-0000-0000-0000-00000000000c';

-- Fixture rows, inserted as the table owner (bypasses RLS).
insert into public.cleaning_statuses (name) values ('Test Status');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.cleaning_statuses'::regclass),
  'cleaning_statuses has RLS enabled'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.cleaning_statuses$$,
  '42501',
  null,
  'anon is denied select on cleaning_statuses'
);
reset role;

-- Act as Carol (Admin role): can write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
select lives_ok(
  $$insert into public.cleaning_statuses (name) values ('Alice Status')$$,
  'an Admin can insert into cleaning_statuses'
);
reset role;

-- Act as Alice (User role): can read, cannot write.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select ok(
  (select count(*) from public.cleaning_statuses) >= 1,
  'a User can read cleaning_statuses'
);

select throws_ok(
  $$insert into public.cleaning_statuses (name) values ('Alice Status')$$,
  '42501',
  null,
  'a User cannot insert into cleaning_statuses'
);

select lives_ok(
  $$update public.cleaning_statuses set id = id$$,
  'a User update is silently filtered by RLS'
);

select lives_ok(
  $$delete from public.cleaning_statuses$$,
  'a User delete is silently filtered by RLS'
);
reset role;

select ok(
  (select count(*) from public.cleaning_statuses) >= 1,
  'rows survive the User update and delete attempts'
);

-- Constraints (as owner).
select throws_ok(
  $$insert into public.cleaning_statuses (name) values ('Test Status')$$,
  '23505',
  null,
  'name must be unique'
);

select throws_ok(
  $$insert into public.cleaning_statuses (name) values (null)$$,
  '23502',
  null,
  'name is required'
);

select throws_ok(
  $$insert into public.cleaning_statuses (name) values ('   ')$$,
  '23514',
  null,
  'name cannot be blank'
);

select * from finish();
rollback;
