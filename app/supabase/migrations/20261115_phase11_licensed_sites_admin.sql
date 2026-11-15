-- Phase 11b: client app licensing (kill switch), admin and status rules.
--
-- Each client app Unywebs builds gets a row here and a key (unyl_ + 48
-- hex). The app asks GET /api/license/status about once a minute; the
-- answer is active, grace or paused. Super admins flip the switch at
-- /admin/sites. Nothing pauses automatically: a failed payment only
-- yields "grace", which client apps show to their own staff, never to
-- the public. Only the SHA-256 of each key is stored.

-- A site outlives its owner's account, and some clients pay outside
-- UnyBase: the owner link is optional and never cascades a delete.
alter table public.licensed_sites alter column owner_id drop not null;
alter table public.licensed_sites drop constraint if exists licensed_sites_owner_id_fkey;
alter table public.licensed_sites add constraint licensed_sites_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete set null;

alter table public.licensed_sites
  add column if not exists client_name text,
  add column if not exists notes text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists override_set_at timestamptz,
  add column if not exists override_set_by uuid references auth.users(id) on delete set null,
  add column if not exists last_check_origin text,
  add column if not exists key_rotated_at timestamptz;

create index if not exists licensed_sites_owner_idx on public.licensed_sites(owner_id);

-- Super admins manage sites from /admin/sites. Client apps never read
-- the table: they go through license_status() via the service role.
drop policy if exists "super admin manages licensed sites" on public.licensed_sites;
create policy "super admin manages licensed sites" on public.licensed_sites
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- The one place that decides a site's state, so the admin page and the
-- client app can never disagree. Precedence:
--   retired key > site Paused > site Always on > no owner linked
--   > owner cut off > owner billing-exempt > failed payment (grace) > active
create or replace function public.licensed_site_state(p_site_id uuid)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  s public.licensed_sites;
  st public.subscription_status;
begin
  select * into s from public.licensed_sites where id = p_site_id;
  if not found then return null; end if;
  if s.revoked_at is not null then return 'retired'; end if;
  if s.status_override = 'paused' then return 'paused'; end if;
  if s.status_override = 'active' then return 'active'; end if;
  if s.owner_id is null then return 'active'; end if;

  select * into st from public.subscription_status where user_id = s.owner_id;
  if not found then return 'active'; end if;
  if coalesce(st.automations_active, true) = false or st.cut_off_at is not null then
    return 'paused';
  end if;
  if coalesce(st.billing_exempt, false) then return 'active'; end if;
  if st.last_payment_failed_at is not null
     and (st.last_payment_at is null or st.last_payment_failed_at > st.last_payment_at) then
    return 'grace';
  end if;
  return 'active';
end $$;

revoke all on function public.licensed_site_state(uuid) from public, anon;
grant execute on function public.licensed_site_state(uuid) to authenticated, service_role;

-- What a client app receives. Unknown, malformed and retired keys all
-- answer unknown_key; client apps treat that as "keep running".
drop function if exists public.license_status(text);
create or replace function public.license_status(p_key text, p_origin text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.licensed_sites;
  state text;
  origin text := nullif(left(coalesce(p_origin, ''), 200), '');
begin
  if p_key is null or p_key !~ '^unyl_[0-9a-f]{48}$' then
    return jsonb_build_object('status', 'unknown_key');
  end if;

  select * into s from public.licensed_sites
   where key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
     and revoked_at is null;
  if not found then
    return jsonb_build_object('status', 'unknown_key');
  end if;

  state := public.licensed_site_state(s.id);

  -- Record the check-in, at most once a minute per caller, so a busy
  -- site does not turn every page view into a write.
  if s.last_checked_at is null
     or s.last_checked_at < now() - interval '1 minute'
     or s.last_check_origin is distinct from origin then
    update public.licensed_sites
       set last_checked_at = now(), last_check_origin = origin
     where id = s.id;
  end if;

  return jsonb_build_object(
    'status', state,
    'site', s.site_name,
    'message', case when state = 'paused'
      then 'Please check back soon.' end,
    'owner_message', case state
      when 'paused' then 'This app has been paused by your provider, Unywebs. Contact Unywebs to restore access.'
      when 'grace' then 'The latest payment for this app did not go through. Please update your billing details with Unywebs to avoid an interruption.'
      end,
    'checked_at', now(),
    'recheck_after', 60
  );
end $$;

revoke all on function public.license_status(text, text) from public, anon, authenticated;
grant execute on function public.license_status(text, text) to service_role;

-- Keys are now issued by /admin/sites, which also records who did it.
drop function if exists public.issue_site_key(text, text, text);

-- Admin list with the computed state. security_invoker keeps the
-- table's RLS in force: only super admins see rows.
create or replace view public.licensed_sites_admin
with (security_invoker = true) as
select
  s.id, s.owner_id, s.site_name, s.client_name, s.domain, s.notes, s.key_prefix,
  s.status_override, s.override_reason, s.override_set_at,
  s.created_at, s.updated_at, s.last_checked_at, s.last_check_origin,
  s.key_rotated_at, s.revoked_at,
  public.licensed_site_state(s.id) as effective_status
from public.licensed_sites s;

revoke all on public.licensed_sites_admin from public, anon;
grant select on public.licensed_sites_admin to authenticated, service_role;
