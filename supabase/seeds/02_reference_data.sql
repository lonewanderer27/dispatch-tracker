-- Local development seed 2 of 4: reference data (companies, cleaning types, statuses, property types,
-- areas, items). Every block is safe to run more than once. NEVER run against a hosted project.

-- Reference data: the companies we operate under. Safe to run more than once.
insert into public.companies (name) values
  ('The Tidy Team'),
  ('Total Home Care'),
  ('Maids in Pink'),
  ('Diamond MIP')
on conflict (name) do nothing;

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

-- Reference data: job statuses, in life-cycle order. Fixed ids: cleaning_jobs defaults to Booked.
insert into public.cleaning_statuses (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Booked'),
  ('10000000-0000-0000-0000-000000000002', 'Confirmed'),
  ('10000000-0000-0000-0000-000000000003', 'In Progress'),
  ('10000000-0000-0000-0000-000000000004', 'Done')
on conflict do nothing;

-- Reference data: property types (House and Townhouse are in use per The Tidy Team Schedule).
-- Safe to run more than once.
insert into public.property_types (name) values
  ('House'),
  ('Apartment'),
  ('Townhouse'),
  ('Condo'),
  ('Office')
on conflict (name) do nothing;

-- Reference data: areas. The first five are from "What areas need cleaning?" in The Tidy Team
-- Schedule; the rest are common rooms from online house and move-out cleaning checklists.
-- Safe to run more than once.
insert into public.areas (name) values
  ('Kitchen'),
  ('Bathroom'),
  ('Bedroom'),
  ('Living Area'),
  ('Floor'),
  ('Dining Room'),
  ('Hallway'),
  ('Laundry Room'),
  ('Basement'),
  ('Garage'),
  ('Balcony')
on conflict (name) do nothing;

-- Reference data: items cleaners handle. The first eleven are mentioned in at least five job notes
-- in The Tidy Team Schedule; the rest are common appliances and fixtures from online
-- house and move-out cleaning checklists. Safe to run more than once.
insert into public.items (name) values
  ('Oven'),
  ('Stove'),
  ('Fridge'),
  ('Cabinet'),
  ('Window'),
  ('Blind'),
  ('Baseboard'),
  ('Wall'),
  ('Carpet'),
  ('Couch'),
  ('Stairs'),
  ('Dishwasher'),
  ('Microwave'),
  ('Range Hood'),
  ('Light Fixture'),
  ('Ceiling Fan'),
  ('Vent Cover'),
  ('Light Switch'),
  ('Door Handle'),
  ('Window Sill'),
  ('Drawer'),
  ('Mirror'),
  ('Toilet'),
  ('Shower'),
  ('Bathtub'),
  ('Sink'),
  ('Countertop'),
  ('Washing Machine'),
  ('Dryer')
on conflict (name) do nothing;
