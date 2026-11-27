# T3C-S31 Seed a starting invoice template for each company

> **Status: PENDING REVIEW, and BLOCKED on Finance data.** Not approved for implementation until the owner removes this line and Finance has supplied the values in the "Inputs required" table.
>
> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked. **Never invent a template, email address or GST rate.**

## Why

Source: sprint sheet `The Tidy Team - Digital Platforms Sprint - Sprint 2_ Nov-23-27-2026'.csv`.

- T3C-S31: "As a finance user, I want a starting invoice template for each company, so that invoices can be generated without manual setup." Acceptance: after seeding, each company in S8 has one invoice template; template text, invoice email and GST percent for each company are supplied by Finance; running the seed twice creates no duplicates.

Priority is Lowest. The story says the values come from Finance, and they are not in the sheet.

## Facts (verified 2026-11-27)

1. Needs `supabase/migrations/0033_invoice_templates.sql` (T3C-B30) and the companies seed (T3C-B7-S8). If either is missing, **stop and report**.
2. `invoice_templates` has a unique `company_id`, so `on conflict (company_id) do nothing` makes the seed idempotent.
3. `supabase/seeds/02_reference_data.sql` runs only on `pnpm db:reset`. New seed blocks are **appended to the end** of the file, after the companies block.
4. The four company names are exactly: `The Tidy Team`, `Total Home Care`, `Maids in Pink`, `Diamond MIP`.

## Inputs required (from Finance)

| Company         | Template text       | Invoice email    | GST percent (0 to 100) |
| --------------- | ------------------- | ---------------- | ---------------------- |
| The Tidy Team   | `<<TEMPLATE_TIDY>>` | `<<EMAIL_TIDY>>` | `<<GST_TIDY>>`         |
| Total Home Care | `<<TEMPLATE_THC>>`  | `<<EMAIL_THC>>`  | `<<GST_THC>>`          |
| Maids in Pink   | `<<TEMPLATE_MIP>>`  | `<<EMAIL_MIP>>`  | `<<GST_MIP>>`          |
| Diamond MIP     | `<<TEMPLATE_DMIP>>` | `<<EMAIL_DMIP>>` | `<<GST_DMIP>>`         |

The implementer replaces each `<<...>>` token in Step 1 with the value from this table. Template and email go inside single quotes (escape a single quote by doubling it); GST is a bare number like `10` or `5.5`. **If any value is missing, stop and report.**

## Decisions already made (do not reopen)

- The seed joins `companies` by name, so it inserts nothing for a company that does not exist.
- Only `02_reference_data.sql` changes. No migration, no UI.
- The test asserts four templates (one per seeded company).

### Open questions (do not block)

1. Finance has not supplied the template text, invoice email or GST percent for any company. Who owns getting them, and by when?
2. The seed is local only; SIT and production will need the templates loaded another way.

## Out of scope

- Inventing placeholder data. The table, its constraints and RLS (T3C-B30). UI.

## Steps

### Step 0. Branch, baseline and inputs

```bash
git status --short && git switch -c feat/T3C-S31-Invoice-Templates-Seed && pnpm db:start && ls supabase/migrations/0033_invoice_templates.sql
```

**Gate:** `git branch --show-current`
**Expect:** `feat/T3C-S31-Invoice-Templates-Seed`, and the `ls` finds the file. Otherwise stop and report. Also stop if any Inputs table cell is still a `<<...>>` token.

### Step 1. Seed (edit `supabase/seeds/02_reference_data.sql`)

Append to the end of the file a blank line and this block, with every `<<...>>` token replaced from the Inputs table:

```sql

-- Reference data: one starting invoice template per company. Safe to run more than once.
insert into public.invoice_templates (company_id, template, invoice_email, gst_percent)
select c.id, v.template, v.invoice_email, v.gst_percent
from (values
  ('The Tidy Team', '<<TEMPLATE_TIDY>>', '<<EMAIL_TIDY>>', <<GST_TIDY>>),
  ('Total Home Care', '<<TEMPLATE_THC>>', '<<EMAIL_THC>>', <<GST_THC>>),
  ('Maids in Pink', '<<TEMPLATE_MIP>>', '<<EMAIL_MIP>>', <<GST_MIP>>),
  ('Diamond MIP', '<<TEMPLATE_DMIP>>', '<<EMAIL_DMIP>>', <<GST_DMIP>>)
) as v (company_name, template, invoice_email, gst_percent)
join public.companies c on c.name = v.company_name
on conflict (company_id) do nothing;
```

**Gate:** `grep -c "<<" supabase/seeds/02_reference_data.sql`
**Expect:** `0`.

### Step 2. pgTAP test (create file)

Create `supabase/tests/database/invoice_templates_seed.test.sql` with exactly this content:

```sql
-- pgTAP: invoice template seed (T3C-S31). Runs after db:reset.
-- Run with: pnpm test:db   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select is(
  (select count(*) from public.invoice_templates),
  4::bigint,
  'seed creates one invoice template per company'
);

select is(
  (select count(distinct company_id) from public.invoice_templates),
  4::bigint,
  'every seeded template belongs to a different company'
);

select is(
  (select count(*) from public.companies c where not exists (select 1 from public.invoice_templates t where t.company_id = c.id)),
  0::bigint,
  'every company has a template'
);

select * from finish();
rollback;
```

### Step 3. Gate

```bash
pnpm db:reset && pnpm test:db
```

**Expect:** `db:reset` exits 0 and `pnpm test:db` ends with `Result: PASS`; `invoice_templates_seed.test.sql` runs 3 tests. If the seed fails on a `gst_percent` or constraint error, stop and report the value.

```bash
git status --short
```

**Expect:** only `supabase/seeds/02_reference_data.sql`, `supabase/tests/database/invoice_templates_seed.test.sql` and this plan file.

## Rollback

- Before commit: `git switch main && git branch -D feat/T3C-S31-Invoice-Templates-Seed`, then `pnpm db:reset`.
- After merge: remove the block from `02_reference_data.sql` in a new commit. Seeded rows are local only.

## Conventional commits

Branch: `feat/T3C-S31-Invoice-Templates-Seed` (from `main`). Stage explicit paths only. Every commit ends with:

```
Refs: T3C-S31

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

1. `feat(db): seed a starting invoice template per company`
   Files: `supabase/seeds/02_reference_data.sql`
2. `test(db): cover the invoice template seed`
   Files: `supabase/tests/database/invoice_templates_seed.test.sql`
3. `docs(plans): add T3C-S31 plan`
   Files: `.claude/plans/backend/T3C-S31-Invoice-Templates-Seed.md`

PR title: `feat(db): seed invoice templates` (body from `.github/pull_request_template.md`, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge with a normal merge commit.
