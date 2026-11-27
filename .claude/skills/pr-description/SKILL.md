---
name: pr-description
description: Write a PR description for the current branch from the repo's PR template, the branch commits, the diff and the matching plan, capture a screenshot for each item the description lists, and export both to .claude/pr/<TICKET>-<Short-Name>/. Use when the user asks for a PR description, PR body, PR write-up or PR screenshots.
---

# PR description

Write the PR body for the current branch, using `.github/pull_request_template.md`, capture a screenshot for each visual item it lists, and export both into the repo. Do not commit them and do not open the PR unless the user asks.

## Inputs

- **Ticket** (for example `T3C-NNN`). If the user did not give one, take it from the branch name (`feat/T3C-NNN-...`) or the plan file name. If none exists, ask once.
- **Base branch**: `main` unless the user names another (AGENTS.md says branch from `main`).

## Steps

1. **Gather facts, read only.**
   - `git branch --show-current` and `git log --oneline <base>..HEAD`.
   - `git diff --stat <base>...HEAD` and the diff of any file whose purpose is unclear.
   - The matching plan: `.claude/plans/<TICKET>-*.md`. Use its **Why**, **Decisions**, **Out of scope**, **How to test** and any "by eye" checklist.
   - Any new `docs/architecture/NNNN-*.md` on the branch.
   - `.github/pull_request_template.md`. Its sections are the structure you fill in.

2. **Draft the description.** Fill the template:
   - *Type of Change*: tick only what applies. Use `[x]`, not `[X]`.
   - *Description*: what changed and why, in plain prose. Name what is deliberately not done.
   - *Implementation*: the approach, the files or layers touched, and the trade-offs a reviewer should check. Do not paste the diff.
   - *Screenshots*: list one item per visual change the reviewer should see (login, sidebar, page heading, button and its hover state, favicon, and so on). Take the list from the plan's by-eye checklist and from the diff. Each item gets a number, a one-line label and an image slot, filled in step 3.
   - *How to Test*: numbered steps a reviewer can follow, starting from `pnpm db:start` and `pnpm dev`. Use seeded logins only from the seed files and mark them local only.
   - *Checks run*: list only commands you ran in this session, with their result. If a check was not run, say so. Never write "all tests pass" from memory.
   - *Known gaps*: keep any gap the plan or the diff reveals. Do not hide it.

3. **Capture a screenshot for each item.**
   - Make sure the app is running: `curl -sf http://127.0.0.1:5173/login`. If it is not, start `pnpm dev --host 127.0.0.1 --port 5173 --strictPort` in the background, and remember that you started it.
   - Write the capture script to the scratchpad, not the repo. It should use `@playwright/test` from the repo's `node_modules`, run headless Chromium at 1280x800, and sign in as the seeded admin from `supabase/seeds/01_users.sql`. Use the same login the e2e setup uses. Do not use any other credentials.
   - For each item, navigate to the page, wait for the element the item is about, do any hover or click the item needs, and save `.claude/pr/<TICKET>-<Short-Name>/screenshots/NN-short-name.png`. Record the computed colour, font family or title text the item is about, so the description can quote them.
   - For items the browser does not show directly (for example the favicon), render the asset on its own page and screenshot that. Say in the description that it is the asset, not the browser tab.
   - Open each PNG with Read and check it shows what the item claims. If it does not, fix the capture and retake it, or write the mismatch under *Known gaps*.
   - If an item cannot be captured, leave its image slot empty, say which item and why, and do not invent an image.
   - If you started the dev server, stop it when done. Leave it running if it was already up.

4. **Write the file** to `.claude/pr/<TICKET>-<Short-Name>/pr-description.md`. Image links are relative, for example `![Login](screenshots/01-login.png)`. Create the `screenshots/` folder if it is missing.

5. **Final message**: give the file path, the screenshot folder, the list of gaps and any item that has no screenshot. Put the PR title at the top, in the commit format (`type(scope): description`, 72 characters or fewer). Keep the message short.

## Rules

- Do not commit, push or open the PR unless asked.
- Keep the PR material in `.claude/pr/`. Never leave it in the scratchpad. The capture script can stay in the scratchpad.
- Do not write `@name` unless it is a real GitHub login the user gave you. Use plain names or backticks otherwise.
- Do not include personal details, email addresses, credentials or real customer data. Seed data is fine.
- End the body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
