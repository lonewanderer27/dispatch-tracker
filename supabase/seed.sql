-- Local development seed. Test users and reference data (companies). NEVER run against a hosted project.
-- Passwords: admin@example.com / admin-password-123 , user@example.com / user-password-123 ,
-- superadmin@example.com / superadmin-password-123

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'admin@example.com',
    extensions.crypt('admin-password-123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Local Admin"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'user@example.com',
    extensions.crypt('user-password-123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Local User"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', 'superadmin@example.com',
    extensions.crypt('superadmin-password-123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Local Super Admin"}',
    now(), now(), '', '', '', ''
  );

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', 'email',
   '11111111-1111-1111-1111-111111111111', now(), now(), now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"user@example.com"}', 'email',
   '22222222-2222-2222-2222-222222222222', now(), now(), now()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333',
   '{"sub":"33333333-3333-3333-3333-333333333333","email":"superadmin@example.com"}', 'email',
   '33333333-3333-3333-3333-333333333333', now(), now(), now());

-- The trigger created the profiles. Promote the admin and the super admin.
update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set role_id = '30000000-0000-0000-0000-000000000003' where id = '33333333-3333-3333-3333-333333333333';

insert into public.todos (user_id, title, done) values
  ('22222222-2222-2222-2222-222222222222', 'Buy milk', true),
  ('22222222-2222-2222-2222-222222222222', 'Write the README', false),
  ('22222222-2222-2222-2222-222222222222', 'Ship the starter', false),
  ('11111111-1111-1111-1111-111111111111', 'Admin-only reminder', false);

-- Reference data: the companies we operate under. Safe to run more than once.
insert into public.companies (name) values
  ('The Tidy Team'),
  ('Total Home Care'),
  ('Maids in Pink'),
  ('Diamond MIP')
on conflict (name) do nothing;

-- Client scenarios for local testing. Safe to run more than once.
-- 1. A new client who books for themselves: one client, one contact (the same person).
-- 2. A recurring client that is a company (sub-con or parent-con) with three contacts.
insert into public.clients (id, company_id, name) values
  ('d0000000-0000-0000-0000-000000000001',
   (select id from public.companies where name = 'The Tidy Team'), 'Sam Newbie'),
  ('d0000000-0000-0000-0000-000000000002',
   (select id from public.companies where name = 'The Tidy Team'), 'Harbour Build Pty Ltd')
on conflict (id) do nothing;

insert into public.contacts (id, client_id, first_name, last_name, contact_no) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Sam', 'Newbie', '+61 400 111 222'),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'Priya', 'Shah', '+61 2 9000 1111'),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'Tom', 'Reyes', '0400 222 333'),
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'Lee', 'Chen', '+61 3 9000 2222')
on conflict (id) do nothing;

-- Cleaners roster. The surnames are invented placeholders for local testing only; replace them
-- with the real names before any hosted use. Safe to run more than once.
insert into public.cleaners (first_name, last_name)
select v.first_name, v.last_name
from (values
  ('Aimee', 'Calloway'),
  ('Jen', 'Ashdown'),
  ('Joy', 'Lindqvist'),
  ('Leigha', 'Fairweather'),
  ('Lynn', 'Orchard'),
  ('Nilda', 'Sorrento'),
  ('Nosh', 'Maddox'),
  ('Ruth', 'Penhallow'),
  ('Samira', 'Hollis'),
  ('Sheng', 'Whitlock')
) as v(first_name, last_name)
where not exists (
  select 1 from public.cleaners c
  where c.first_name = v.first_name and c.last_name = v.last_name
);

-- Company links for the roster above: each cleaner works for Total Home Care and The Tidy Team.
-- Runs after the cleaners seed, so it looks the cleaners up by full name. Safe to run more than once.
insert into public.company_cleaners (cleaner_id, company_id)
select c.id, co.id
from (values
  ('Aimee', 'Calloway'),
  ('Jen', 'Ashdown'),
  ('Joy', 'Lindqvist'),
  ('Leigha', 'Fairweather'),
  ('Lynn', 'Orchard'),
  ('Nilda', 'Sorrento'),
  ('Nosh', 'Maddox'),
  ('Ruth', 'Penhallow'),
  ('Samira', 'Hollis'),
  ('Sheng', 'Whitlock')
) as v(first_name, last_name)
join public.cleaners c on c.first_name = v.first_name and c.last_name = v.last_name
join public.companies co on co.name in ('Total Home Care', 'The Tidy Team')
on conflict (cleaner_id, company_id) do nothing;

-- Reference data: cleaning types. Safe to run more than once.
insert into public.cleaning_types (name) values
  ('Regular'),
  ('Deep'),
  ('Move-In'),
  ('Move-Out'),
  ('Construction'),
  ('1500+ Square Feet'),
  ('Diamond Cleaning')
on conflict (name) do nothing;
