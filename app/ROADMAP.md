# UnyBase app roadmap

Living document. Update as phases ship. Kept in-repo so future rebuilds
or context compactions do not lose the spec.

## Phase 1 — Login restored & role system in place ✅

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
- Three-tier role system (see below).
- Onboarding pages now render with the shared logo header.
- Premium plan positioned for AI-powered / integrated workspaces:
  greater processing speeds, larger memory limits.

## Role system

Three tiers, matched by email against env vars in phase 1:

- **super_admin** — UnyBase company platform account. Full control and
  visibility across every workspace, every subscription, every
  integration. Configured via `SUPER_ADMIN_EMAILS`.
- **technical_admin** — Agency-style client-services account. Can
  access and manage multiple client workspaces **when granted access
  by the client**. Configured via `TECHNICAL_ADMIN_EMAILS`. The
  admin shell renders for them, but the data view is scoped to
  workspaces they've been granted access to (empty until phase 2
  wires the grants table).
- **client** — Default role. Regular consumer front-end account. Can
  only see and manage their own workspace.

The API surface (`getUserRole`, `canAccessAdmin`, `roleLabel` in
`app/src/lib/admin.ts`) is stable. When we outgrow env vars we swap
the implementation to read from a `user_roles` table without
touching callers.

## Phase 2 — Subscription admin dashboard ✅

### What shipped
- `subscription_events` table: raw log of every webhook event, matched or not.
- `subscription_status` table: per-user state (active/lapsed/cancelled/never_paid,
  automations_active, cut_off_at/by/reason).
- `api_keys` table: stub `unyb_live_<hex>` per user, auto-issued on signup via
  trigger, `revoked_at` set by cutoff toggle.
- `admin_actions` table: full audit trail of every cutoff/restore.
- `technical_admin_grants` table: workspace-owner grants tech admin access.
- `user_roles` table (public schema): super_admin / technical_admin / client.
  **Do not use `auth.users.is_super_admin`** — GoTrue uses that column for
  Postgres superuser privileges; setting it to `true` breaks login with
  "database error querying schema".
- Webhook `/api/webhooks/systeme`: validates token, logs all events, updates
  status on payment.succeeded / payment.failed / subscription.cancelled.
  Systeme.io does not support manual test API calls — real payment events from
  subscribers will populate the log automatically.
- Admin dashboard `/admin`: real user table, worst-first sort, six-tier status
  matrix (grace/warning/escalated/cutoff-recommended/cut-off/active), cutoff
  toggle with type-CUTOFF confirmation modal, audit trail table.
- Client dashboard `/dashboard`: live subscription status pill + API key card.
- Three-tier RLS: super_admin (via user_roles) sees everything; technical_admin
  sees only workspaces granted to them; client sees only own rows.

### Known gotcha: SQL-inserted users
When seeding accounts directly into `auth.users` via SQL (not the signup flow),
all `text` / `character varying` token columns must be `''` (empty string),
not `NULL`. GoTrue's Go scanner panics on NULL→string conversion and returns
"error finding user: sql: Scan error on column index N, name
\"confirmation_token\": converting NULL to string is unsupported".
Fix: `UPDATE auth.users SET confirmation_token='', recovery_token='', ...`
for any SQL-inserted row.

### What still needs to happen before phase 2 is production-ready
- SMTP config (Supabase → Auth → SMTP) so cutoff/restore emails send to
  clients. Currently stubbed to console.log.
- Admin alert email on payment.failed (currently just updates DB; no outbound).
- Client-side grant UI (phase 4+) so clients can grant/revoke tech admin access
  from workspace settings instead of needing SQL.

## Phase 2 (original spec — kept for reference)

Route: `/admin`, gated by `canAccessAdmin(role)`. Scaffolded in phase
1; wire up in phase 2.

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
5. **Filter by role:** super_admin sees everything; technical_admin
   sees only workspaces whose owners have granted them access
   (`technical_admin_grants` table).

### Automation cutoff

- **Always manual.** The dashboard flags who to review; the human
  clicks the toggle.
- Notifications on lapse (email) are automated so admin knows *when*
  to look, not what to do.
- Persist an activity log per user for audit trail.

### Client-side grant UI (workspace settings)

Clients grant/revoke technical admin access from their own workspace
settings page: "Grant access to a technical admin" — email lookup,
optional expiration, revoke at will. Grants are what turn the empty
technical-admin view into a real one.

### Open questions to answer before building

1. What does "cut off automations" concretely mean on the user's side?
   Options: revoke API keys, set is_active=false flag, or something
   specific to how UnyBase provisions infrastructure.
2. Which systeme.io webhook events was the old system subscribed to?

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
- Metadata: expiration date, last regenerated date, current status
  (active / expiring soon / expired / revoked).
- **Account ownership fields:** the specific login/username tied to
  the integration (Vercel account, GitHub account, Supabase account),
  and whether it lives under **agency's master account** or the
  **client's own account** — matters for billing and offboarding.

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
- Rebuild `/dashboard/vault` (or fold into phase 3).
- Rebuild `/onboarding/{developer,manual}` flows with real content.
- Prospect-tag flow post-signup.
- Custom Supabase auth email templates (branded sender via SMTP:
  Postmark, Resend, or SendGrid). Configured in Supabase dashboard
  under Authentication → Email Templates and Project Settings → Auth.

## Reference — infra of this app

- Repo: `c3jumpw/uny`, folder `app/`, branch `main`.
- Vercel project: `unybase-app-v2` (id
  `prj_vUCH1sIVFJEtbwC3NfAa7FsRbtps`), team `team_EhbsLA85gVYFcKhJth5adAyd`.
- Supabase project: `uwomibcrrrahucqtsvte`.
- Domain: `unybase.unywebs.com`.
- Env vars on Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPER_ADMIN_EMAILS` (comma-separated)
  - `TECHNICAL_ADMIN_EMAILS` (comma-separated)
- Old broken project: `unybase-app` (`prj_QjgR38764hUnXYAIlxDIAXDCXoLX`)
  — safe to delete from the Vercel dashboard once the new setup is
  fully validated.

## Test accounts (per user spec)

- **Super Admin** — `admin@unywebs.com` (UnyBase company platform
  account, full control).
- **Technical Admin** — `c3.jumpw@gmail.com` (client-services account,
  granted access to multiple clients).
- **Client** — any regular signup (managed via `/dashboard`).

Accounts are created via the app's signup flow at `/start`. Role
assignment is automatic based on env var match at sign-in time.
