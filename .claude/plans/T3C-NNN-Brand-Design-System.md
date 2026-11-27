# T3C-NNN Apply The Tidy Team brand (accent colour, fonts, sparkle icon) to the admin app

> **For the implementer:** follow the steps in order. Run every Gate command and compare its output with the Expect line. On any mismatch, or when the code does not match the Facts, **stop and report**; do not try to fix it. Do not `git add -A`, commit or push unless asked. Stage explicit paths only.

## Why

The admin app still looks like the Refine starter: default Ant Design blue, system font, the Vite lightning-bolt favicon and the sidebar title "Refine Project". The Tidy Team Design System (`../Design System/`, outside this repo) defines the brand. This plan applies the parts that suit a dense admin tool: the berry accent, the cocoa text colours, the status colours, the two fonts and the sparkle mark. It does **not** copy the marketing look (pill buttons, gold and cocoa panels, scallops, hard shadows).

## Facts (verified 2026-11-28)

1. Branch `main`. Last architecture doc is `docs/architecture/0009-Remove-Todos.md`, so the new one is `0010`.
2. Design System files used (read only, never edited): `../Design System/tokens.css`, `../Design System/fonts/Anton-Regular.woff2` (18 612 bytes), `../Design System/fonts/Figtree-Variable.woff2` (20 156 bytes, weights 300 to 900).
3. Design System values used (light theme only):
   - accent: `berry-600` `#b61f47` (action, links), `berry-800` `#79112d` (hover, pressed)
   - text: `cocoa-700` `#3e2318` (ink), `cocoa-500` `#6b402f` (secondary text)
   - page ground: `blush-100` `#efe1dd`
   - status: success `#0b6b7a`, warning `#8a5a00`, danger `#b3260b`
   - fonts: display `"Anton", "Impact", "Arial Narrow", sans-serif`; sans `"Figtree", system-ui, -apple-system, "Segoe UI", sans-serif`
   - sparkle path (24x24 viewBox): `M12 0C12.9 7.2 16.8 11.1 24 12C16.8 12.9 12.9 16.8 12 24C11.1 16.8 7.2 12.9 0 12C7.2 11.1 11.1 7.2 12 0Z`
4. Design System icon rule: no icon set was supplied; use 2px-stroke line icons in `currentColor`; the sparkle is the only brand shape. The app already uses outlined `@ant-design/icons` (13 files, all under `src/features/*/routes.tsx` and `CleaningJobFilterBar.tsx`). Nothing in `src/` has a hard-coded brand colour: the only hex values are in `src/index.css` lines 9 and 14 and in two test fixtures.
5. `src/app/App.tsx`: line 2 imports `ThemedTitle`; line 9 is `import { ConfigProvider, theme } from 'antd'`; line 18 is `<ConfigProvider theme={{ algorithm: [theme.defaultAlgorithm] }}>`; line 42 is `<ThemedLayout Title={ThemedTitle}>`; lines 62-63 are `<AuthPage type="login" />` and `<AuthPage type="register" />`.
6. `src/main.tsx` line 5 is `import './index.css'`. `src/index.css` sets `color-scheme: light dark`, a system font stack, a `#f5f5f5` body and a `#141414` dark body under `prefers-color-scheme: dark`. The antd theme is light only (`theme.defaultAlgorithm`), so the dark body is already inconsistent with the components.
7. `index.html` line 5 links `/favicon.svg`; line 7 is `<title>app</title>`. `public/favicon.svg` is the Vite logo. `public/icons.svg` is the Vite starter sprite; `git grep -n icons.svg` finds no reference to it in `src`, `e2e`, `index.html`, `README.md` or `docs`.
8. `@refinedev/antd` page titles (List, Create, Edit, Show) render `Typography.Title` with `level: 3`, so they are `h3`. The sidebar `Title` prop of `ThemedLayout` receives `{ collapsed }`. `AuthPage` accepts a `title` prop.
9. Test setup `src/test/setup.ts` loads jest-dom and stubs `matchMedia`. Tests sit next to the file they test.

## Decisions already made (do not reopen)

- **Light theme only.** The app has no theme switch. Dark mode is not added.
- **Colours:** berry as the single accent (`colorPrimary`, `colorInfo`, links); cocoa for text; blush for the page background (`colorBgLayout`); the three status colours. Gold, `berry-200`, cocoa panels, white-on-berry panels are **not** used.
- **Shape and depth stay Ant Design defaults.** No pill buttons, no hard shadows, no scallops, no marquee. Not asked for, and they cost density.
- **Fonts:** Figtree for all text (antd `fontFamily`); Anton, uppercase through CSS, for `h1`, `h2`, `h3` and the sidebar brand name only. Fonts are copied into the repo and served by Vite (no CDN).
- **Icons:** keep the outlined `@ant-design/icons` (they are line icons in `currentColor`, which matches the Design System rule). Add no icon library. Add only the sparkle, as a local component, used in the sidebar title, the login and register pages and the favicon.
- **Brand name** is "The Tidy Team", typed in sentence case and uppercased by CSS (the Design System forbids hand-typed uppercase). The legal name is not used.
- Replace the favicon, delete the unused `public/icons.svg`, set the page title to "The Tidy Team".
- New code lives in `src/shared/brand/` (used by `app/` only today, but it is shared UI, not a feature).

**Open question (does not block):** should the admin ever get a dark theme? The Design System has dark tokens; this plan ignores them.

**Known risk (does not block):** danger red `#b3260b` sits close to berry `#b61f47`. Ant Design destructive buttons and error text pair with an icon or a word, so state is never colour alone. A reviewer may still want a different danger tone; that is a follow-up.

## Out of scope

- Dark theme, pill radii, shadows, scallops, gold or cocoa panels, marquee, hero or marketing components.
- A new icon library or replacing any existing `@ant-design/icons` icon.
- Editing anything under `../Design System/`.
- A real logo (the Design System says none exists).
- The WordPress embed plans (`T3C-NNN-WordPress-Embed-*.md`).

## Steps

### Step 0: branch

```bash
git switch -c feat/T3C-NNN-Brand-Design-System
git status --short
```

**Expect:** the three untracked `T3C-NNN-*` plan files already in the tree plus this plan; no modified files.

### Step 1: copy the fonts

```bash
mkdir -p src/shared/brand/fonts
cp "../Design System/fonts/Anton-Regular.woff2" src/shared/brand/fonts/Anton-Regular.woff2
cp "../Design System/fonts/Figtree-Variable.woff2" src/shared/brand/fonts/Figtree-Variable.woff2
ls -l src/shared/brand/fonts
```

**Expect:** two files, `Anton-Regular.woff2` 18612 bytes and `Figtree-Variable.woff2` 20156 bytes. If the source files are missing or the sizes differ, stop and report.

### Step 2: create `src/shared/brand/brand.css`

```css
/* The Tidy Team brand for the admin app. Values come from the Design System tokens.css (light theme).
   Only the accent, text, page ground, fonts and the sidebar title are applied here. */

@font-face {
  font-family: 'Anton';
  src: url('./fonts/Anton-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Figtree';
  src: url('./fonts/Figtree-Variable.woff2') format('woff2');
  font-weight: 300 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --berry-600: #b61f47;
  --berry-800: #79112d;
  --cocoa-700: #3e2318;
  --cocoa-500: #6b402f;
  --blush-100: #efe1dd;
  --font-display: 'Anton', 'Impact', 'Arial Narrow', sans-serif;
  --font-sans: 'Figtree', system-ui, -apple-system, 'Segoe UI', sans-serif;
}

/* Page titles (Refine renders them as h3) and any other large heading. */
h1.ant-typography,
h2.ant-typography,
h3.ant-typography {
  font-family: var(--font-display);
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

/* Sidebar and login title: sparkle plus the brand name. */
.brand-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--cocoa-700);
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 1;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-decoration: none;
}

.brand-title .tt-sparkle {
  width: 24px;
  height: 24px;
  color: var(--berry-600);
}
```

### Step 3: create `src/shared/brand/Sparkle.tsx`

```tsx
import type { SVGProps } from 'react'

// The Tidy Team four-point sparkle (Design System, `tt-sparkle`). Decorative, so hidden from
// assistive technology. It takes its colour from `currentColor` and its size from the font size.
export function Sparkle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className="tt-sparkle"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12 0C12.9 7.2 16.8 11.1 24 12C16.8 12.9 12.9 16.8 12 24C11.1 16.8 7.2 12.9 0 12C7.2 11.1 11.1 7.2 12 0Z" />
    </svg>
  )
}
```

### Step 4: create `src/shared/brand/BrandTitle.tsx`

```tsx
import { Link } from 'react-router'
import { Sparkle } from '@/shared/brand/Sparkle'

const BRAND_NAME = 'The Tidy Team'

// Sidebar and auth-page title. The name is typed in sentence case; CSS (`.brand-title`) uppercases it.
// When the sidebar is collapsed only the sparkle shows, so the link carries an aria-label.
export function BrandTitle({ collapsed }: { collapsed: boolean }) {
  return (
    <Link to="/" className="brand-title" aria-label={BRAND_NAME}>
      <Sparkle />
      {collapsed ? null : <span>{BRAND_NAME}</span>}
    </Link>
  )
}
```

### Step 5: create `src/shared/brand/theme.ts`

```ts
import { theme, type ThemeConfig } from 'antd'

// The Tidy Team brand as an Ant Design theme (light). Hex values are the Design System tokens:
// berry-600 / berry-800 (accent), cocoa-700 / cocoa-500 (text), blush-100 (page ground),
// and the success, warning and danger status colours. Keep them in step with tokens.css.
export const brandTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#b61f47',
    colorPrimaryHover: '#79112d',
    colorPrimaryActive: '#79112d',
    colorInfo: '#b61f47',
    colorLink: '#b61f47',
    colorLinkHover: '#79112d',
    colorLinkActive: '#79112d',
    colorSuccess: '#0b6b7a',
    colorWarning: '#8a5a00',
    colorError: '#b3260b',
    colorText: '#3e2318',
    colorTextSecondary: '#6b402f',
    colorBgLayout: '#efe1dd',
    fontFamily: "'Figtree', system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
}
```

### Step 6: create the tests

`src/shared/brand/Sparkle.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Sparkle } from '@/shared/brand/Sparkle'

describe('Sparkle', () => {
  it('is a decorative svg that inherits the text colour', () => {
    const { container } = render(<Sparkle />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('fill', 'currentColor')
  })
})
```

`src/shared/brand/BrandTitle.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { BrandTitle } from '@/shared/brand/BrandTitle'

function renderTitle(collapsed: boolean) {
  return render(
    <MemoryRouter>
      <BrandTitle collapsed={collapsed} />
    </MemoryRouter>,
  )
}

describe('BrandTitle', () => {
  it('shows the sparkle and the name, linking to the dashboard', () => {
    renderTitle(false)
    const link = screen.getByRole('link', { name: 'The Tidy Team' })
    expect(link).toHaveAttribute('href', '/')
    expect(link).toHaveTextContent('The Tidy Team')
  })

  it('hides the name but keeps the accessible name when the sidebar is collapsed', () => {
    renderTitle(true)
    const link = screen.getByRole('link', { name: 'The Tidy Team' })
    expect(link).not.toHaveTextContent('The Tidy Team')
  })
})
```

`src/shared/brand/theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { brandTheme } from '@/shared/brand/theme'

describe('brandTheme', () => {
  it('uses berry-600 as the accent and berry-800 for hover and pressed', () => {
    expect(brandTheme.token?.colorPrimary).toBe('#b61f47')
    expect(brandTheme.token?.colorPrimaryHover).toBe('#79112d')
    expect(brandTheme.token?.colorPrimaryActive).toBe('#79112d')
  })

  it('uses the Design System status colours', () => {
    expect(brandTheme.token?.colorSuccess).toBe('#0b6b7a')
    expect(brandTheme.token?.colorWarning).toBe('#8a5a00')
    expect(brandTheme.token?.colorError).toBe('#b3260b')
  })
})
```

**Gate:**

```bash
pnpm exec prettier --check src/shared/brand
pnpm lint
pnpm typecheck
pnpm exec vitest run src/shared/brand
```

**Expect:** prettier reports all matched files formatted (if it fails only on files from Steps 2 to 6, run `pnpm exec prettier --write src/shared/brand` and re-check; the `.woff2` files are ignored or skipped); lint and typecheck print no errors; vitest shows 3 test files, 5 tests passed.

**Commit 1 here** (nothing is wired yet, so the suites stay green).

### Step 7: wire the theme, title and fonts into the app

Edit `src/app/App.tsx` with these exact find/replace pairs.

1. Find `import { AuthPage, ThemedLayout, ThemedTitle, useNotificationProvider } from '@refinedev/antd'`
   Replace `import { AuthPage, ThemedLayout, useNotificationProvider } from '@refinedev/antd'`
2. Find `import { ConfigProvider, theme } from 'antd'`
   Replace `import { ConfigProvider } from 'antd'`
3. Find `import { refineDataProvider, refineLiveProvider } from '@/app/providers/dataProvider'`
   Replace
   ```tsx
   import { refineDataProvider, refineLiveProvider } from '@/app/providers/dataProvider'
   import { BrandTitle } from '@/shared/brand/BrandTitle'
   import { brandTheme } from '@/shared/brand/theme'
   ```
4. Find `<ConfigProvider theme={{ algorithm: [theme.defaultAlgorithm] }}>`
   Replace `<ConfigProvider theme={brandTheme}>`
5. Find `<ThemedLayout Title={ThemedTitle}>`
   Replace `<ThemedLayout Title={BrandTitle}>`
6. Find `<Route path="/login" element={<AuthPage type="login" />} />`
   Replace `<Route path="/login" element={<AuthPage type="login" title={<BrandTitle collapsed={false} />} />} />`
7. Find `<Route path="/register" element={<AuthPage type="register" />} />`
   Replace `<Route path="/register" element={<AuthPage type="register" title={<BrandTitle collapsed={false} />} />} />`

Edit `src/main.tsx`: find `import './index.css'`, replace with

```tsx
import '@/shared/brand/brand.css'
import './index.css'
```

Replace the **whole** content of `src/index.css` with:

```css
:root {
  color-scheme: light;
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

body {
  margin: 0;
  background: var(--blush-100);
}

#root {
  min-height: 100svh;
  box-sizing: border-box;
}

/* Phone width: 16px gutter, no horizontal page scroll. */
.app-content {
  box-sizing: border-box;
  padding: 16px;
  max-width: 100%;
  overflow-x: hidden;
}
```

**Gate:**

```bash
pnpm exec prettier --write src/app/App.tsx src/main.tsx src/index.css
pnpm lint && pnpm typecheck && pnpm test
```

**Expect:** prettier may re-wrap the two `<Route ...>` lines; that is fine. Lint and typecheck print no errors; vitest passes with no failures. A type error on the `title` prop of `AuthPage`, or on `Title={BrandTitle}`, means the Facts (item 8) are wrong: stop and report.

### Step 8: favicon, page title, remove the unused sprite

Replace the **whole** content of `public/favicon.svg` with:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#b61f47"/><path fill="#f4c77c" transform="translate(4.8 4.8) scale(.6)" d="M12 0C12.9 7.2 16.8 11.1 24 12C16.8 12.9 12.9 16.8 12 24C11.1 16.8 7.2 12.9 0 12C7.2 11.1 11.1 7.2 12 0Z"/></svg>
```

(Gold-300 sparkle on a berry tile: the Design System allows gold sparkles on berry.)

Edit `index.html`: find `<title>app</title>`, replace `<title>The Tidy Team</title>`.

```bash
git grep -n "icons.svg" -- . ':!.claude/plans'
git rm public/icons.svg
```

**Expect:** the `git grep` prints nothing (no reference outside old plans). If it prints a line, stop and report. `git rm` prints `rm 'public/icons.svg'`.

### Step 9: full check in the browser and the suites

```bash
pnpm build
pnpm exec playwright test e2e/login.spec.ts
pnpm dev
```

**Expect:** `pnpm build` succeeds and its output lists a `.woff2` asset for each font. The login e2e passes. With `pnpm dev` running, open http://127.0.0.1:5173 and confirm by eye:

- login page shows the berry sparkle and "THE TIDY TEAM" above the form; the Sign in button is berry, not blue
- after signing in as `admin@example.com`: sidebar shows the sparkle and "THE TIDY TEAM"; collapsing the sidebar leaves only the sparkle
- page titles (for example "Cleaning Jobs") are Anton, uppercase; body text and the table are Figtree
- primary buttons and links are berry and turn darker berry on hover; page background is blush with white cards
- the browser tab shows the berry sparkle favicon and the title "The Tidy Team"

If any item is wrong, stop and report which one. Stop the dev server (Ctrl+C) when done.

**Gate (full suite, needs `pnpm db:start`):**

```bash
pnpm test:all
```

**Expect:** every stage passes.

**Commit 2 here.**

### Step 10: document the decision

Create `docs/architecture/0010-Branding.md`:

```markdown
# 0010 The Tidy Team branding

- Ticket: T3C-NNN
- Plan: `.claude/plans/T3C-NNN-Brand-Design-System.md`
- Date: 2026-11-28
- Status: implemented

## Context

The admin app used the Refine and Ant Design defaults. The Tidy Team Design System (kept outside this repo, in `../Design System/`) defines the brand. It targets the marketing site: pill buttons, gold and cocoa panels, scallops and hard shadows. An admin tool needs density, so only part of it is applied.

## Decision

- Light theme only. One accent: berry-600 for primary actions, links and info; berry-800 for hover and pressed.
- Cocoa text (`cocoa-700`, `cocoa-500`), blush page ground, and the Design System success, warning and danger colours. No gold, no panels, no dark theme.
- Figtree for all text; Anton, uppercased by CSS, for `h1` to `h3` and the sidebar brand name. Both fonts are copied to `src/shared/brand/fonts/`.
- Icons stay as outlined `@ant-design/icons` (line icons in `currentColor`, as the Design System asks). The four-point sparkle is a local component used in the sidebar title, the auth pages and the favicon.
- Theme values live in `src/shared/brand/theme.ts` and `brand.css`. They are copies of Design System tokens, so a token change there must be repeated here by hand.

## Consequences

- Danger red `#b3260b` is close to berry `#b61f47`. Destructive actions always carry an icon or a word, never colour alone.
- Dark mode, pill radii and shadows are not applied. Adding them is a separate change.
```

Edit `README.md`: find `Todos removal: [0009 Remove todos](docs/architecture/0009-Remove-Todos.md).` and replace with `Todos removal: [0009 Remove todos](docs/architecture/0009-Remove-Todos.md). Branding: [0010 Branding](docs/architecture/0010-Branding.md).`

**Gate:**

```bash
pnpm exec prettier --check README.md docs/architecture/0010-Branding.md
```

**Expect:** both files pass (if only these fail, run `--write` on them and re-check).

**Commit 3 here.**

## Rollback

Before pushing: `git switch main && git branch -D feat/T3C-NNN-Brand-Design-System`. After merging: `git revert` the three commits in reverse order. No database, migration or dependency changes were made, so nothing else needs undoing. The Design System folder is never modified.

## Conventional commits

Branch: `feat/T3C-NNN-Brand-Design-System`. Stage the explicit paths shown. Each commit ends with `Refs: T3C-NNN`, then `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

1. Subject: `feat(web): add the Tidy Team brand theme, fonts and sparkle`
   Body: `New shared brand module with its tests. Nothing is wired yet.`
   Files: `src/shared/brand/brand.css`, `src/shared/brand/Sparkle.tsx`, `src/shared/brand/BrandTitle.tsx`, `src/shared/brand/theme.ts`, `src/shared/brand/Sparkle.test.tsx`, `src/shared/brand/BrandTitle.test.tsx`, `src/shared/brand/theme.test.ts`, `src/shared/brand/fonts/Anton-Regular.woff2`, `src/shared/brand/fonts/Figtree-Variable.woff2`

2. Subject: `feat(web): apply the Tidy Team brand to the admin app`
   Body: `Berry accent and cocoa text in the antd theme, Figtree and Anton, sparkle title on the sidebar and auth pages, new favicon and page title. Removes the unused Vite icons sprite.`
   Files: `src/app/App.tsx`, `src/main.tsx`, `src/index.css`, `index.html`, `public/favicon.svg`, `public/icons.svg` (deleted)

3. Subject: `docs(web): document the Tidy Team branding`
   Files: `docs/architecture/0010-Branding.md`, `README.md`

4. (Separate, when asked) Subject: `docs(plans): add the Brand Design System plan`
   Files: `.claude/plans/T3C-NNN-Brand-Design-System.md`

PR title: `feat(web): apply the Tidy Team brand to the admin app`
PR body: from `.github/pull_request_template.md` once one exists, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Merge with a normal merge commit.
