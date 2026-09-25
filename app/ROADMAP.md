# UnyBase app roadmap

Living document. Update as phases ship. Kept in-repo so future rebuilds
or context compactions do not lose the spec.

## Phase 1 — Login restored ✅

Rebuild the app after the previous CLI-deployed project (`unybase-app`)
got stuck in an unrecoverable state that neither the API nor the
dashboard would roll back.

- Fresh git-linked Vercel project `unybase-app-v2` (rootDirectory=`app`,
  linked to `c3jumpw/uny`, production branch `main`).
- Next.js 16 + React 19 + Supabase SSR auth.
- Routes: `/`, `/login`, `/signup`, `/start`, `/dashboard`,
  `/dashboard/{domains,team,vault}`, `/onboarding/{developer,manual}`,
  `/invite/[token]`, `/admin`, `/auth/callback`,
  `/api/webhooks/systeme`.
- Middleware protects private routes and preserves the `next=` query
  param on redirect.
- Domain `unybase.unywebs.com` moved off the old project onto this one.

## Phase 2 — Subscription admin dashboard

Route: `/admin`, gated by `ADMIN_EMAILS` env var (comma-separated).
Scaffolded in phase 1; wire up in phase 2.

Design principle (user's own words): **automate detection and audit
trail, human owns the kill switch.** Nobody gets locked out by a
glitch.

### Table columns

- User (name / email)
- Subscription status
- Last payment date
- Connected tools (per user)
- Automations (manual pause toggle)

### Data flow

1. Systeme.io webhook → `/api/webhooks/systeme` (endpoint exists in
   phase 1, currently logs payloads only).
2. Parse subscription events (payment success, payment failure,
   subscription cancelled, subscription renewed, refund).
3. Persist to Supabase in a `subscription_events` table (schema TBD).
4. Join events per user for the admin table.

### Automation cutoff

- **Always manual.** The dashboard flags who to review; the human
  clicks the toggle.
- Notifications on lapse (email) are automated so admin knows *when*
  to look, not what to do.
- Persist an activity log per user for audit trail.

### Open questions to answer before building

1. What does "cut off automations" concretely mean on the user's side?
   Options:
   - Revoke their API keys / access tokens so their apps can't reach
     their backend.
   - Set an `is_active=false` flag their app queries before running
     automations.
   - Something specific to how UnyBase provisions their infrastructure.
2. Which systeme.io webhook events was the old system subscribed to?
3. Admin auth long-term: env var (current) vs `role` column on users
   table (extensible to a team of admins).

## Phase 3 — Integration health & credentials hub

Route TBD (candidates: `/dashboard/vault` — already scaffolded — or
`/dashboard/integrations`). One place per workspace for every
integration a client's web app depends on.

### What it stores (per integration)

- Integration name and type (GitHub PAT, Supabase key + URL,
  systeme.io API, ClickUp API + callback URLs, generic env vars).
- Credential value (encrypted at rest).
- Callback URLs where the integration expects them.
- Environmental variable name it maps to on the client's side.
- Metadata:
  - Expiration date (where applicable).
  - Last regenerated date.
  - Current status (active / expiring soon / expired / revoked).
- **Account ownership fields:**
  - The specific login / username tied to the integration
    (e.g. Vercel account, GitHub account, Supabase account).
  - Whether it lives under **agency's master account** or the
    **client's own account** — matters for billing and for
    offboarding when a client leaves.

### Live health checks

Since the credentials are stored, the hub actively hits each API to
confirm it responds:

- GitHub: check PAT scopes and validity via `GET /user`.
- Supabase: check anon key against `/auth/v1/settings`.
- systeme.io: hit their auth-required endpoint.
- ClickUp: hit `/api/v2/user`.
- Generic HTTP integrations: configurable ping URL + expected status.

Results feed a "green / yellow / red" status per integration.

### Metadata tracking

Layered on top of live checks as a secondary signal:

- Expiration date reminders (email 14 / 7 / 1 days before).
- "Recently regenerated" flag on any token rotation.
- Change history per integration (who, when, from what to what — with
  values redacted).

### Add-new flow

A form for adding a new integration when a client onboards a new
service: paste credential, define callback URL, tag the owning
account, save. The hub tests it immediately and stores the initial
green status.

### Why this earns its place

From the user's own words: "credential rot and silent integration
failures are what usually blow up client web apps quietly." This
turns a reactive triage problem into a proactive dashboard-driven
one, and at agency scale (managing dozens or hundreds of client
apps) it is the difference between operational sanity and chaos.

## Phase 4+ (backlog)

- Rebuild `/dashboard/domains` with real domain-management UX.
- Rebuild `/dashboard/team` with invites (uses `/invite/[token]`).
- Rebuild `/onboarding/{developer,manual}` flows.
- Prospect-tag flow post-signup (mentioned in earlier session).

## Reference — infra of this app

- Repo: `c3jumpw/uny`, folder `app/`, branch `main`.
- Vercel project: `unybase-app-v2` (id
  `prj_vUCH1sIVFJEtbwC3NfAa7FsRbtps`), team `team_EhbsLA85gVYFcKhJth5adAyd`.
- Supabase project: `uwomibcrrrahucqtsvte`.
- Domain: `unybase.unywebs.com`.
- Env vars on Vercel: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ADMIN_EMAILS`.
- Old broken project: `unybase-app` (`prj_QjgR38764hUnXYAIlxDIAXDCXoLX`)
  — safe to delete from the Vercel dashboard once the new setup is
  fully validated.
