-- Local development seed 2 of 4: reference data (companies, cleaning types, statuses, property types,
-- areas, items). Every block is safe to run more than once. NEVER run against a hosted project.

-- Reference data: the companies we operate under, each with its pill colour (0029_color_motifs.sql).
-- Safe to run more than once: a re-run resets the colours to these values.
insert into public.companies (name, color_motif) values
  ('The Tidy Team', 'red'),
  ('Total Home Care', 'cyan'),
  ('Maids in Pink', 'magenta'),
  ('Diamond MIP', 'blue')
on conflict (name) do update set color_motif = excluded.color_motif;

-- Reference data: cleaning types, each with its pill colour. Safe to run more than once.
insert into public.cleaning_types (name, color_motif) values
  ('Regular', 'lime'),
  ('Deep', 'purple'),
  ('Move-In', 'cyan'),
  ('Move-Out', 'orange'),
  ('Construction', 'gold'),
  ('1500+ Square Feet', 'geekblue'),
  ('Diamond Cleaning', 'magenta')
on conflict (name) do update set color_motif = excluded.color_motif;

-- Reference data: job statuses, in life-cycle order, coloured by life-cycle stage. Fixed ids:
-- cleaning_jobs defaults to Booked. Safe to run more than once.
insert into public.cleaning_statuses (id, name, color_motif) values
  ('10000000-0000-0000-0000-000000000001', 'Booked', 'blue'),
  ('10000000-0000-0000-0000-000000000002', 'Confirmed', 'cyan'),
  ('10000000-0000-0000-0000-000000000003', 'In Progress', 'orange'),
  ('10000000-0000-0000-0000-000000000004', 'Done', 'green')
on conflict (id) do update set color_motif = excluded.color_motif;

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
