-- pgTAP: the local seed produces the expected test users and roles.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select is(
  (select count(*) from public.profiles where id in (
     '11111111-1111-1111-1111-111111111111',
     '22222222-2222-2222-2222-222222222222')),
  2::bigint,
  'seed creates two profiles'
);

select is(
  (select role from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'admin',
  'seeded admin has role admin'
);

select is(
  (select count(*) from public.todos where user_id = '22222222-2222-2222-2222-222222222222'),
  3::bigint,
  'seeded normal user has 3 todos'
);

select * from finish();
rollback;
