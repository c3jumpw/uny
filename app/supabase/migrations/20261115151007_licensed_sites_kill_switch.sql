-- Phase 11a: client app licensing (kill switch), base table.
-- Applied 2026-11-15. Refined by 20261115_phase11_licensed_sites_admin.sql:
-- owner becomes optional, license_status() gains an origin argument and
-- richer output, and issue_site_key() is replaced by the admin page.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.licensed_sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  site_name text not null,
  domain text,
  key_hash text not null unique,
  key_prefix text not null,
  status_override text not null default 'auto' check (status_override in ('auto','active','paused')),
  override_reason text,
  created_at timestamptz not null default now(),
  last_checked_at timestamptz,
  revoked_at timestamptz
);
alter table public.licensed_sites enable row level security;

create or replace function public.license_status(p_key text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s public.licensed_sites; st public.subscription_status; result text; msg text;
begin
  select * into s from public.licensed_sites
   where key_hash = encode(extensions.digest(coalesce(p_key,''), 'sha256'), 'hex') and revoked_at is null;
  if not found then return jsonb_build_object('status','unknown_key'); end if;
  select * into st from public.subscription_status where user_id = s.owner_id;
  if s.status_override = 'paused' then result := 'paused';
  elsif s.status_override = 'active' then result := 'active';
  elsif st.user_id is null then result := 'active';
  elsif coalesce(st.automations_active, true) = false then result := 'paused';
  elsif coalesce(st.billing_exempt, false) then result := 'active';
  elsif st.last_payment_failed_at is not null
        and (st.last_payment_at is null or st.last_payment_failed_at > st.last_payment_at) then result := 'grace';
  else result := 'active'; end if;
  msg := case result
    when 'paused' then 'This service is temporarily paused. Please contact your provider to restore access.'
    when 'grace'  then 'There is a problem with the latest payment for this service. Please update your billing details to avoid interruption.'
    else null end;
  update public.licensed_sites set last_checked_at = now() where id = s.id;
  return jsonb_build_object('status', result, 'site', s.site_name, 'message', msg, 'checked_at', now());
end $$;
revoke all on function public.license_status(text) from public, anon, authenticated;

create or replace function public.issue_site_key(p_owner_email text, p_site_name text, p_domain text default null)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare owner uuid; k text;
begin
  select id into owner from auth.users where lower(email) = lower(p_owner_email);
  if owner is null then raise exception 'No UnyBase account with email %', p_owner_email; end if;
  k := 'unyl_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.licensed_sites(owner_id, site_name, domain, key_hash, key_prefix)
  values (owner, p_site_name, p_domain, encode(extensions.digest(k, 'sha256'), 'hex'), left(k, 12));
  return k;
end $$;
revoke all on function public.issue_site_key(text, text, text) from public, anon, authenticated;
