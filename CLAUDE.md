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

## Other rules

- Never set `auth.users.is_super_admin`; roles live in `public.user_roles`
  and the `SUPER_ADMIN_EMAILS` / `TECHNICAL_ADMIN_EMAILS` env vars.
- Nothing cuts off or pauses on its own: automation detects and warns, a
  person flips the switch (subscriptions and client sites alike).
- Keep plan names, prices and feature lists identical in
  `app/src/lib/plans.ts`, `unybase/js/config.js` and `unybase/index.html`.
