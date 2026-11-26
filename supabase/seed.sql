-- Local development seed. Test users only. NEVER run against a hosted project.
-- Passwords: admin@example.com / admin-password-123 , user@example.com / user-password-123

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
  );

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', 'email',
   '11111111-1111-1111-1111-111111111111', now(), now(), now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"user@example.com"}', 'email',
   '22222222-2222-2222-2222-222222222222', now(), now(), now());

-- The trigger created both profiles. Promote the admin.
update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';

insert into public.todos (user_id, title, done) values
  ('22222222-2222-2222-2222-222222222222', 'Buy milk', true),
  ('22222222-2222-2222-2222-222222222222', 'Write the README', false),
  ('22222222-2222-2222-2222-222222222222', 'Ship the starter', false),
  ('11111111-1111-1111-1111-111111111111', 'Admin-only reminder', false);
