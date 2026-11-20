# Working in this repo

Monorepo for Unywebs. See README.md for what each folder is and where it
deploys. The UnyBase app lives in `app/`; its history and specs are in
`app/ROADMAP.md`.

## Keeping the tour and guide up to date (required for every UI change)

UnyBase has an in-app, step-by-step getting-started tour at
`/dashboard/tour` (Help in the menu), with a track per kind of user:
everyone, shared access, technical admin and super admin. Every step is
a real screenshot with numbered callouts. It must describe the app as
it is after your change, so any change that adds or alters a screen
also updates the tour in the same commit:

1. **New page.** Add a step for it to `app/src/lib/tour.json`, in the
   track for the people who use it, with the page in the step's
   `routes`, an `added` date, and `updated` bumped to today. A page that
   genuinely needs no step goes in `exempt` with the reason.
2. **New or changed screen.** Show it with sample data in
   `app/src/app/guide/demo/page.tsx` (real components, made-up data, so
   the screenshot is faithful). Add or update its capture in
   `app/scripts/capture-guide.cjs` (what to click, the crop, and one
   numbered mark per thing worth explaining). Write one note per mark,
   in the same order, in `app/src/lib/shotNotes.json`.
3. **Re-take the screenshots:** `cd app && npm run capture:guide`
   (needs Playwright with Chromium). If you can't run it locally, push:
   `.github/workflows/guide-screenshots.yml` re-takes them on every push
   that touches `app/src` and commits any that changed.
4. **Check:** `npm run check:guide`. `npm run build` runs it first and
   fails the build if a page has no tour step, a step points at a page
   that is gone, a screenshot is missing, or a screenshot's callouts and
   notes disagree. Don't work around a failure; fix the tour.
5. If the long-form guide (`app/src/app/guide/page.tsx`) describes the
   behaviour you changed, update its text too. Its screenshots and
   callout text come from the same files as the tour.

## Logging every change (required, same commit as the change)

`app/src/lib/changelog.json` is the permanent record of every change to
UnyBase. It drives Admin → Change log (`/admin/changelog`), the What's
new page (`/dashboard/whats-new`) and the popup people see the first
time they log in after a change that applies to them.

- Append one entry per user-visible change at the **end** of `entries`
  (the file is oldest first), dated the day it ships: `id`
  (`YYYY-MM-DD-short-name`), `date`, `type` (new, improved, fixed,
  security, removed), `area`, `audiences`, `title`, `summary`, and
  where useful `details`, `link`, `shot` (a screenshot id) and
  `tourSteps`.
- `audiences` decides who sees it in What's new: `everyone`, `client`,
  `shared` (people a client shared credentials with), `technical_admin`,
  `super_admin`. Use `internal` for website, build or infrastructure
  changes: they appear only in the super-admin change log, never in the
  popup.
- Write titles and summaries for the people in `audiences`, in plain
  words; they read them in the popup.
- New tour steps must be named in an entry's `tourSteps`, and a tour
  update needs a log entry on or after its date. `npm run check:guide`
  (and so every build) fails otherwise.
- Never edit or delete past entries except to fix a mistake; never
  reorder them.

## Other rules

- Never set `auth.users.is_super_admin`; roles live in `public.user_roles`
  and the `SUPER_ADMIN_EMAILS` / `TECHNICAL_ADMIN_EMAILS` env vars.
- Nothing cuts off or pauses on its own: automation detects and warns, a
  person flips the switch (subscriptions and client sites alike).
- Keep plan names, prices and feature lists identical in
  `app/src/lib/plans.ts`, `unybase/js/config.js` and `unybase/index.html`.
