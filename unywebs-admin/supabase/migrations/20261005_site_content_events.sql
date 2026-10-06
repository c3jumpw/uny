-- Audit log for the Unywebs website CMS (admin.unywebs.com).
--
-- Website edits were previously logged into admin_actions, the UnyBase
-- subscription audit table. Its insert policies are scoped to UnyBase
-- concepts (a super admin, or a technical admin acting on a workspace
-- they were granted), so a technical admin editing the website had no
-- policy to log under. The old admin only worked because it wrote with
-- the service-role key.
--
-- A separate log for the parent company's website keeps the hierarchy in
-- the data and lets the admin run with each user's own permissions.
-- The admin treats this table as optional: edits work without it, and the
-- overview says the change log is off until this has been applied.

create table if not exists public.site_content_events (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid not null references auth.users(id),
  actor_email  text not null,
  action       text not null,
  target_kind  text not null check (target_kind in ('solution', 'guide', 'media')),
  target_slug  text,
  notes        text,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

comment on table public.site_content_events is
  'Who changed what on the Unywebs website, written by admin.unywebs.com. Separate from admin_actions, which belongs to UnyBase subscription operations.';

create index if not exists site_content_events_recent_idx
  on public.site_content_events (created_at desc);

alter table public.site_content_events enable row level security;

drop policy if exists site_content_events_admin_read on public.site_content_events;
create policy site_content_events_admin_read
  on public.site_content_events for select
  to authenticated
  using (public.is_site_admin());

-- An admin can only record events as themselves.
drop policy if exists site_content_events_admin_insert on public.site_content_events;
create policy site_content_events_admin_insert
  on public.site_content_events for insert
  to authenticated
  with check (public.is_site_admin() and actor_id = auth.uid());

-- No update or delete policy: the log is append-only.

-- Lock is_site_admin() to signed-in callers. An earlier migration revoked
-- EXECUTE from anon, but Postgres grants function EXECUTE to PUBLIC by
-- default and anon inherits from PUBLIC, so that revoke had no effect.
-- RLS policies evaluate it as the querying role, so authenticated keeps it.
revoke execute on function public.is_site_admin() from public, anon;
grant execute on function public.is_site_admin() to authenticated;
