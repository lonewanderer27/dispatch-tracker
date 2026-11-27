-- pgTAP: the local seed produces the expected test users and roles.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select is(
  (select count(*) from public.profiles where id in (
     '11111111-1111-1111-1111-111111111111',
     '22222222-2222-2222-2222-222222222222')),
  2::bigint,
  'seed creates two profiles'
);

select is(
  (select r.name from public.profiles p join public.roles r on r.id = p.role_id
     where p.id = '11111111-1111-1111-1111-111111111111'),
  'Admin',
  'seeded admin has the Admin role'
);

select is(
  (select count(*) from public.todos where user_id = '22222222-2222-2222-2222-222222222222'),
  3::bigint,
  'seeded normal user has 3 todos'
);

select is(
  (select r.name from public.profiles p join public.roles r on r.id = p.role_id
     where p.id = '33333333-3333-3333-3333-333333333333'),
  'Super Admin',
  'seeded super admin has the Super Admin role'
);

select set_eq(
  $$select name from public.companies$$,
  $$values ('The Tidy Team'), ('Total Home Care'), ('Maids in Pink'), ('Diamond MIP')$$,
  'seed creates exactly the four companies'
);

-- Re-run the seed insert: it must not create duplicates.
insert into public.companies (name) values
  ('The Tidy Team'),
  ('Total Home Care'),
  ('Maids in Pink'),
  ('Diamond MIP')
on conflict (name) do nothing;

select is(
  (select count(*) from public.companies),
  4::bigint,
  'seeding twice creates no duplicate companies'
);

select * from finish();
rollback;
