-- pgTAP: color_motif on companies, cleaning_types and cleaning_statuses (0029_color_motifs.sql).
-- Palette, default, check constraint, seed colours and who may change a colour.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- The palette. This literal must equal COLOR_MOTIFS in src/features/color-motif/colorMotif.ts, in
-- the same order. colorMotif.test.ts compares COLOR_MOTIFS with the array in the newest migration
-- that defines public.color_motifs(), and this test compares that function with the literal, so a
-- change on either side fails one of the two suites.
select is(
  public.color_motifs(),
  array['default', 'magenta', 'red', 'volcano', 'orange', 'gold',
        'lime', 'green', 'cyan', 'blue', 'geekblue', 'purple']::text[],
  'color_motifs() is the Ant Design preset tag palette plus default'
);

-- Each table's check constraint uses the function, so there is one list in the database.
select set_eq(
  $$select conrelid::regclass::text from pg_constraint
    where conname like '%\_color\_motif\_valid' and contype = 'c'
      and pg_get_constraintdef(oid) like '%color_motifs()%'$$,
  $$values ('companies'), ('cleaning_types'), ('cleaning_statuses')$$,
  'each table checks color_motif against color_motifs()'
);

-- Column shape.
select col_not_null('public', 'companies', 'color_motif', 'companies.color_motif is required');
select col_not_null('public', 'cleaning_types', 'color_motif', 'cleaning_types.color_motif is required');
select col_not_null('public', 'cleaning_statuses', 'color_motif', 'cleaning_statuses.color_motif is required');

-- Fixture rows without a colour, inserted as the table owner (bypasses RLS).
insert into public.companies (id, name) values ('d0000000-0000-0000-0000-000000000001', 'Motif Co');
insert into public.cleaning_types (id, name) values ('d4000000-0000-0000-0000-000000000001', 'Motif Type');
insert into public.cleaning_statuses (id, name) values ('d7000000-0000-0000-0000-000000000001', 'Motif Status');

select is(
  (select color_motif from public.companies where id = 'd0000000-0000-0000-0000-000000000001'),
  'default', 'a new company gets the default colour'
);
select is(
  (select color_motif from public.cleaning_types where id = 'd4000000-0000-0000-0000-000000000001'),
  'default', 'a new cleaning type gets the default colour'
);
select is(
  (select color_motif from public.cleaning_statuses where id = 'd7000000-0000-0000-0000-000000000001'),
  'default', 'a new cleaning status gets the default colour'
);

-- The check rejects anything outside the palette (including a hex value and a different case).
select throws_ok(
  $$update public.companies set color_motif = 'pink' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'companies rejects a colour outside the palette'
);
select throws_ok(
  $$update public.cleaning_types set color_motif = '#ff0000' where id = 'd4000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'cleaning_types rejects a hex colour'
);
select throws_ok(
  $$update public.cleaning_statuses set color_motif = 'Blue' where id = 'd7000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'cleaning_statuses rejects a colour in the wrong case'
);

-- Every palette value is accepted by every table.
select lives_ok(
  $$insert into public.companies (name, color_motif)
    select 'Motif Co ' || m, m from unnest(public.color_motifs()) m$$,
  'companies accepts every palette colour'
);
select lives_ok(
  $$insert into public.cleaning_types (name, color_motif)
    select 'Motif Type ' || m, m from unnest(public.color_motifs()) m$$,
  'cleaning_types accepts every palette colour'
);
select lives_ok(
  $$insert into public.cleaning_statuses (name, color_motif)
    select 'Motif Status ' || m, m from unnest(public.color_motifs()) m$$,
  'cleaning_statuses accepts every palette colour'
);

-- Seed (02_reference_data.sql): every seeded row has its own, non-default colour.
select results_eq(
  $$select name, color_motif from public.companies
    where name in ('The Tidy Team', 'Total Home Care', 'Maids in Pink', 'Diamond MIP') order by name$$,
  $$values ('Diamond MIP', 'blue'), ('Maids in Pink', 'magenta'), ('The Tidy Team', 'red'), ('Total Home Care', 'cyan')$$,
  'the seeded companies have their colours'
);
select results_eq(
  $$select name, color_motif from public.cleaning_types
    where name in ('Regular', 'Deep', 'Move-In', 'Move-Out', 'Construction', '1500+ Square Feet', 'Diamond Cleaning') order by name$$,
  $$values ('1500+ Square Feet', 'geekblue'), ('Construction', 'gold'), ('Deep', 'purple'), ('Diamond Cleaning', 'magenta'), ('Move-In', 'cyan'), ('Move-Out', 'orange'), ('Regular', 'lime')$$,
  'the seeded cleaning types have their colours'
);
select results_eq(
  $$select name, color_motif from public.cleaning_statuses where id::text like '10000000-%' order by id$$,
  $$values ('Booked', 'blue'), ('Confirmed', 'cyan'), ('In Progress', 'orange'), ('Done', 'green')$$,
  'the seeded statuses are coloured by life-cycle stage'
);

-- Re-running the seed keeps one row per name and puts a changed colour back.
update public.cleaning_types set color_motif = 'red' where name = 'Deep';
insert into public.cleaning_types (name, color_motif) values ('Deep', 'purple')
on conflict (name) do update set color_motif = excluded.color_motif;
select results_eq(
  $$select count(*), min(color_motif) from public.cleaning_types where name = 'Deep'$$,
  $$values (1::bigint, 'purple')$$,
  'seeding again restores the colour without a duplicate'
);

-- Fixed test identities: Alice is a User, Carol an Admin.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', '', '{}', '{}', now(), now(), '', '', '', ''),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'carol@test.local', '', '{}', '{}', now(), now(), '', '', '', '');
update public.profiles set role_id = '30000000-0000-0000-0000-000000000001' where id = 'cccccccc-0000-0000-0000-00000000000c';

-- Act as Alice (User role): the update policies filter her updates out, so nothing changes.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
update public.companies set color_motif = 'red' where id = 'd0000000-0000-0000-0000-000000000001';
update public.cleaning_types set color_motif = 'red' where id = 'd4000000-0000-0000-0000-000000000001';
update public.cleaning_statuses set color_motif = 'red' where id = 'd7000000-0000-0000-0000-000000000001';
reset role;

select is(
  (select color_motif from public.companies where id = 'd0000000-0000-0000-0000-000000000001'),
  'default', 'a User cannot change a company colour'
);
select is(
  (select color_motif from public.cleaning_types where id = 'd4000000-0000-0000-0000-000000000001'),
  'default', 'a User cannot change a cleaning type colour'
);
select is(
  (select color_motif from public.cleaning_statuses where id = 'd7000000-0000-0000-0000-000000000001'),
  'default', 'a User cannot change a cleaning status colour'
);

-- Act as Carol (Admin role): she can change a colour, but only to a palette value.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', true);
update public.companies set color_motif = 'green' where id = 'd0000000-0000-0000-0000-000000000001';
update public.cleaning_types set color_motif = 'green' where id = 'd4000000-0000-0000-0000-000000000001';
update public.cleaning_statuses set color_motif = 'green' where id = 'd7000000-0000-0000-0000-000000000001';
select throws_ok(
  $$update public.cleaning_types set color_motif = 'pink' where id = 'd4000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'an Admin is held to the palette too'
);
reset role;

select is(
  (select color_motif from public.companies where id = 'd0000000-0000-0000-0000-000000000001'),
  'green', 'an Admin can change a company colour'
);
select is(
  (select color_motif from public.cleaning_types where id = 'd4000000-0000-0000-0000-000000000001'),
  'green', 'an Admin can change a cleaning type colour'
);
select is(
  (select color_motif from public.cleaning_statuses where id = 'd7000000-0000-0000-0000-000000000001'),
  'green', 'an Admin can change a cleaning status colour'
);

select * from finish();
rollback;
