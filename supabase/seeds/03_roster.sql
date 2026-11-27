-- Local development seed 3 of 4: the roster. Client scenarios with contacts, the cleaners and their
-- companies. Needs 02_reference_data.sql. Every block is safe to run more than once.

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
