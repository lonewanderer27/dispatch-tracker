# 0010 The Tidy Team branding

- Ticket: T3C-NNN
- Plan: `.claude/plans/T3C-NNN-Brand-Design-System.md`
- Date: 2026-11-28
- Status: implemented

## Context

The admin app used the Refine and Ant Design defaults. The Tidy Team Design System (kept outside this repo, in `../Design System/`) defines the brand. It targets the marketing site: pill buttons, gold and cocoa panels, scallops and hard shadows. An admin tool needs density, so only part of it is applied.

## Decision

- Light theme only. One accent: berry-600 for primary actions, links and info; berry-800 for hover and pressed.
- Cocoa text (`cocoa-700`, `cocoa-500`), and the Design System success, warning and danger colours. No gold, no panels, no dark theme.
- Page ground is a neutral near-white (`#f7f7f7`), not the Design System `blush-100`. The blush wash made the admin screens feel dull for long sessions, and an admin tool does not need the marketing look.
- Figtree for all text; Anton, uppercased by CSS, for `h1` to `h3` and the sidebar brand name. Both fonts are copied to `src/shared/brand/fonts/`.
- Icons stay as outlined `@ant-design/icons` (line icons in `currentColor`, as the Design System asks). The four-point sparkle is a local component used in the sidebar title, the auth pages and the favicon.
- Theme values live in `src/shared/brand/theme.ts` and `brand.css`. They are copies of Design System tokens, so a token change there must be repeated here by hand.

## Consequences

- Danger red `#b3260b` is close to berry `#b61f47`. Destructive actions always carry an icon or a word, never colour alone.
- Dark mode, pill radii and shadows are not applied. Adding them is a separate change.
- The page ground deliberately differs from the Design System, so a Design System change to `blush-100` does not flow into the admin app.
