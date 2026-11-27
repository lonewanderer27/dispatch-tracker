-- pgTAP: profiles.preferred_time_zone. Default, validation, who can change it.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Fixed test identities. The whole file runs in one transaction and rolls back.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bob@test.local', '', '{}', '{}', now(), now(), '', '', '', '');

select is(
  (select preferred_time_zone from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  'America/Edmonton',
  'a new profile defaults to America/Edmonton'
);

select ok(public.is_valid_time_zone('Australia/Sydney'), 'a real IANA name is valid');
select ok(not public.is_valid_time_zone('Mars/Olympus'), 'an unknown name is not valid');

-- Alice changes her own value.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);

select lives_ok(
  $$update public.profiles set preferred_time_zone = 'Australia/Sydney' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  'a user can change their own preferred_time_zone'
);

select throws_ok(
  $$update public.profiles set preferred_time_zone = 'Mars/Olympus' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$,
  '23514',
  null,
  'an unknown time zone is rejected'
);

-- A silent no-op: RLS hides Bob's row from Alice.
select lives_ok(
  $$update public.profiles set preferred_time_zone = 'UTC' where id = 'bbbbbbbb-0000-0000-0000-00000000000b'$$,
  'a user update of another profile is silently filtered by RLS'
);
reset role;

select is(
  (select preferred_time_zone from public.profiles where id = 'bbbbbbbb-0000-0000-0000-00000000000b'),
  'America/Edmonton',
  'the other user keeps their value'
);

select * from finish();
rollback;
