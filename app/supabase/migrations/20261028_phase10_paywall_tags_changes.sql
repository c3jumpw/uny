-- Phase 10: paywall + billing cycle, systeme.io segment tags,
-- change requests. Additive only (new columns, new tables, replaced
-- functions) — nothing is dropped or rewritten.

-- 1. Billing cycle + segment tracking on subscription_status
alter table public.subscription_status
  add column if not exists intended_cycle text,
  add column if not exists active_plan text,
  add column if not exists active_cycle text,
  add column if not exists systeme_signup_tagged_at timestamptz,
  add column if not exists systeme_customer_tagged_at timestamptz;

-- 2. Copy the plan picked on the marketing site into the status row
--    at signup, so admin sees "awaiting first payment" rather than
--    "no plan chosen" for someone who did choose.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_plan text := nullif(new.raw_user_meta_data ->> 'intended_plan', '');
  v_cycle text := nullif(new.raw_user_meta_data ->> 'intended_cycle', '');
begin
  if v_plan is not null and v_plan not in ('basic', 'premium') then
    v_plan := null;
  end if;
  if v_cycle is not null and v_cycle not in ('monthly', 'yearly') then
    v_cycle := null;
  end if;

  insert into public.api_keys (user_id, key)
  values (new.id, 'unyb_live_' || encode(extensions.gen_random_bytes(24), 'hex'))
  on conflict (user_id) do nothing;

  insert into public.subscription_status (user_id, subscription_state, intended_plan, intended_cycle, plan_selected_at)
  values (new.id, 'never_paid', v_plan, v_cycle, case when v_plan is not null then now() end)
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

-- 3. Server-only lookups for the nightly sweep. Confirmation state
--    matters: an unconfirmed account cannot log in, so a "finish
--    checkout" email would send them to a login that fails.
create or replace function public.auth_user_summary(p_user uuid)
returns table(email text, created_at timestamptz, email_confirmed_at timestamptz, last_sign_in_at timestamptz)
language sql
stable security definer
set search_path to 'public', 'auth'
as $function$
  select u.email::text, u.created_at, u.email_confirmed_at, u.last_sign_in_at
  from auth.users u where u.id = p_user;
$function$;
revoke all on function public.auth_user_summary(uuid) from public, anon, authenticated;
grant execute on function public.auth_user_summary(uuid) to service_role;

create or replace function public.unconfirmed_signups(p_min_age interval, p_max_age interval)
returns table(user_id uuid, email text, created_at timestamptz)
language sql
stable security definer
set search_path to 'public', 'auth'
as $function$
  select u.id, u.email::text, u.created_at
  from auth.users u
  where u.email_confirmed_at is null
    and u.created_at <= now() - p_min_age
    and u.created_at >= now() - p_max_age;
$function$;
revoke all on function public.unconfirmed_signups(interval, interval) from public, anon, authenticated;
grant execute on function public.unconfirmed_signups(interval, interval) to service_role;

-- 4. systeme.io sync log. The public API contract could not be
--    verified against official docs, so every call is recorded.
create table if not exists public.systeme_sync_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  action text not null,
  ok boolean not null default false,
  status_code integer,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists systeme_sync_log_created_idx on public.systeme_sync_log (created_at desc);
alter table public.systeme_sync_log enable row level security;
create policy "super admin reads systeme log" on public.systeme_sync_log
  for select using (public.is_super_admin());

-- 5. Change requests
create table if not exists public.change_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text,
  body text not null check (char_length(body) between 1 and 4000),
  associated_system text,
  kind text not null default 'change' check (kind in ('fix', 'change', 'new')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'done', 'dropped')),
  status_note text,
  sent_at timestamptz,
  done_at timestamptz,
  dropped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists change_requests_owner_idx on public.change_requests (workspace_owner_id, created_at desc);
alter table public.change_requests enable row level security;

create policy "owner manages change requests" on public.change_requests
  for all using (auth.uid() = workspace_owner_id) with check (auth.uid() = workspace_owner_id);
create policy "super admin manages change requests" on public.change_requests
  for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy "tech admin manages granted change requests" on public.change_requests
  for all using (public.has_tech_admin_grant(workspace_owner_id))
  with check (public.has_tech_admin_grant(workspace_owner_id));
-- People the vault is shared with (developers, contractors) can read
-- the requests for the systems they were given, add new ones, and
-- move them along (mark sent / done). Deleting stays with the owner.
create policy "shared reads change requests" on public.change_requests
  for select using (public.has_vault_share(workspace_owner_id, associated_system, null));
create policy "shared inserts change requests" on public.change_requests
  for insert with check (public.has_vault_share(workspace_owner_id, associated_system, null));
create policy "shared updates change requests" on public.change_requests
  for update using (public.has_vault_share(workspace_owner_id, associated_system, null))
  with check (public.has_vault_share(workspace_owner_id, associated_system, null));

create trigger change_requests_touch before update on public.change_requests
  for each row execute function public.touch_updated_at();

-- Workspaces the caller can log change requests against. Own first;
-- then granted, shared, and (super admins) internal exempt ones.
create or replace function public.change_request_workspaces()
returns table(owner_id uuid, email text, access text)
language sql
stable security definer
set search_path to 'public', 'auth'
as $function$
  select u.id, u.email::text, 'owner'::text
  from auth.users u where u.id = auth.uid()
  union
  select u.id, u.email::text, 'granted'
  from public.technical_admin_grants g join auth.users u on u.id = g.workspace_owner_id
  where g.technical_admin_id = auth.uid() and g.revoked_at is null
    and (g.expires_at is null or g.expires_at > now())
  union
  select u.id, u.email::text, 'shared'
  from public.vault_shares s join auth.users u on u.id = s.workspace_owner_id
  where lower(s.grantee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and s.revoked_at is null and (s.expires_at is null or s.expires_at > now())
  union
  select u.id, u.email::text, 'internal'
  from public.subscription_status ss join auth.users u on u.id = ss.user_id
  where ss.billing_exempt and public.is_super_admin();
$function$;
revoke all on function public.change_request_workspaces() from public, anon;
grant execute on function public.change_request_workspaces() to authenticated, service_role;
