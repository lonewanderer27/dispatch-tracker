# 0007 Color motifs: one palette for the pills of companies, cleaning types and statuses

- Ticket: T3C-F35 (Phase 2)
- Plan: `.claude/plans/T3C-F35-Cleaning-Jobs-List.md`
- Date: 2026-11-27
- Status: implemented
- Builds on: [0004 Cleaning jobs list function](0004-Cleaning-Jobs-List-Function.md)

## Summary

`companies`, `cleaning_types` and `cleaning_statuses` each have a `color_motif` column. The Cleaning
Jobs list shows Company, Status and each Cleaning Type as an Ant Design `Tag` in that colour, and an
Admin picks the colour on the Create and Edit pages of each resource.

## Why

The owner asked for a distinguishing colour on the pills. A fixed palette of Ant Design's preset tag
colours works with `Tag color`, adapts to the light and dark themes and leaves no free-form hex value
to validate.

## How it works

- The palette is `default` (the neutral grey tag) plus `magenta`, `red`, `volcano`, `orange`, `gold`,
  `lime`, `green`, `cyan`, `blue`, `geekblue` and `purple`. It exists twice, once per side:
  `public.color_motifs()` in the database (`0029_color_motifs.sql`) and `COLOR_MOTIFS` in
  `src/features/color-motif/colorMotif.ts`.
- They cannot drift: `colorMotif.test.ts` (Vitest) reads the array from the newest migration that
  defines `public.color_motifs()` and compares it with `COLOR_MOTIFS`; `color_motifs.test.sql`
  (pgTAP) compares the function with the same list and checks that every table's constraint calls it.
- Each column is `text not null default 'default'` with a check constraint
  `color_motif = any (public.color_motifs())`. The existing update policies (`has_permission`) decide
  who may change it: Admin and Super Admin, not User.
- `get_cleaning_jobs` returns `company_color`, `status_color` and each cleaning type as
  `{"name", "color"}`. Its return type changed, so `0029` drops and recreates it with the same
  arguments, filters, sorts and paging.
- The web never trusts the stored value blindly: `toColorMotif` turns anything unknown into
  `default`. `ColorMotifTag` (`src/components/color-motif/`) draws every pill and always keeps its
  text, so colour is never the only signal. `ColorMotifSelect` is the "Color" field of the six
  Create and Edit pages; each option is the pill itself.
- The local seed (`02_reference_data.sql`) gives every seeded row its own colour; statuses follow the
  life cycle (Booked blue, Confirmed cyan, In Progress orange, Done green).

## Known limits

- Changing the palette takes a migration that replaces `public.color_motifs()` and an edit of
  `COLOR_MOTIFS`, in the same change. Removing a colour that rows still use fails the migration until
  those rows are moved.
- Preset colours are not checked for contrast by this repo; Ant Design's preset tags are designed to
  be readable in both themes.
- The colours of rows created on a hosted database start as `default` until an Admin sets them.

## Company pills

- `src/components/company/CompanyTag.tsx` is the one place that draws a company as a pill in its colour. It takes `{ name, color_motif }` and is used by the Companies, Clients, Company cleaners and Cleaning Jobs lists. A missing company is a grey "Unknown" pill. Any list that shows a company through another table selects `companies(name, color_motif)`.
