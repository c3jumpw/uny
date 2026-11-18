import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin";
import { computeStatus, sortByPriority } from "@/lib/subscriptionStatus";
import { systemeConfigured } from "@/lib/systeme";
import {
  AdminSubscriptionsView,
  type ActionRow,
  type EventRow,
  type KeyRow,
  type StatusRow,
  type SyncRow,
  type UserRow,
} from "@/components/AdminSubscriptionsView";

// Admin dashboard — phase 2.
//
// Real data from Supabase, joined per user:
//   - visible users (RPC: super_admin sees all, technical_admin
//     sees only workspaces granted to them)
//   - subscription_status (via RLS)
//   - api_keys (revoked status)
//   - recent events (last 5)
//
// Display status is computed live from last_payment_failed_at.
// The timing matrix (grace/warning/escalated/cutoff-recommended)
// is a client-side / render-time calculation — no cron needed.
//
// Sort: worst-status-first so "cutoff recommended" rows float to
// the top for daily glance-review.

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = getUserRole(user?.email);
  const isSuperAdmin = role === "super_admin";

  const [
    { data: usersData },
    { data: statusData },
    { data: keysData },
    { data: eventsData },
    { data: actionsData },
    { data: syncData },
    { data: sitesData },
  ] =
    await Promise.all([
      supabase.rpc("list_visible_users_for_admin"),
      supabase.from("subscription_status").select("*"),
      supabase.from("api_keys").select("user_id, revoked_at"),
      supabase
        .from("subscription_events")
        .select("user_id, event_type, received_at")
        .order("received_at", { ascending: false })
        .limit(30),
      supabase
        .from("admin_actions")
        .select("id, admin_email, target_email, action_type, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      isSuperAdmin
        ? supabase
            .from("systeme_sync_log")
            .select("id, email, action, ok, status_code, detail, created_at")
            .order("created_at", { ascending: false })
            .limit(12)
        : Promise.resolve({ data: [] as SyncRow[] }),
      // Client sites on Auto follow the account, so a cutoff pauses them.
      // RLS returns rows to super admins only; errors (table missing)
      // just mean no count.
      isSuperAdmin
        ? supabase.from("licensed_sites").select("owner_id").eq("status_override", "auto").is("revoked_at", null)
        : Promise.resolve({ data: [] as { owner_id: string | null }[] }),
    ]);
  const sitesByOwner = new Map<string, number>();
  for (const s of (sitesData as { owner_id: string | null }[] | null) ?? []) {
    if (s.owner_id) sitesByOwner.set(s.owner_id, (sitesByOwner.get(s.owner_id) ?? 0) + 1);
  }
  const syncLog = (syncData as SyncRow[] | null) ?? [];

  const users = (usersData as UserRow[] | null) ?? [];
  const statusMap = new Map<string, StatusRow>();
  for (const s of (statusData as StatusRow[] | null) ?? []) statusMap.set(s.user_id, s);
  const keyMap = new Map<string, KeyRow>();
  for (const k of (keysData as KeyRow[] | null) ?? []) keyMap.set(k.user_id, k);
  const eventsByUser = new Map<string, EventRow[]>();
  for (const e of (eventsData as EventRow[] | null) ?? []) {
    if (!e.user_id) continue;
    const arr = eventsByUser.get(e.user_id) ?? [];
    if (arr.length < 3) arr.push(e);
    eventsByUser.set(e.user_id, arr);
  }

  const rows = users.map((u) => {
    const base = statusMap.get(u.user_id) ?? {
      user_id: u.user_id,
      last_payment_at: null,
      last_payment_failed_at: null,
      subscription_state: "never_paid",
      automations_active: true,
      cut_off_at: null,
    };
    // created_at comes from the users RPC, not subscription_status,
    // and the signup-incomplete clock needs it.
    const status = { ...base, created_at: u.created_at ?? null };
    const meta = computeStatus(status);
    return {
      user: u,
      status,
      statusMeta: meta,
      key: keyMap.get(u.user_id) ?? null,
      events: eventsByUser.get(u.user_id) ?? [],
    };
  });

  const sorted = sortByPriority(rows);
  const actions = (actionsData as ActionRow[] | null) ?? [];

  const scopeLabel = isSuperAdmin
    ? `${users.length} workspace${users.length === 1 ? "" : "s"} on the platform`
    : `${users.length} workspace${users.length === 1 ? "" : "s"} granted to you`;

  return (
    <AdminSubscriptionsView
      rows={sorted}
      isSuperAdmin={isSuperAdmin}
      scopeLabel={scopeLabel}
      actions={actions}
      syncLog={syncLog}
      systemeOn={systemeConfigured()}
      sitesByOwner={Object.fromEntries(sitesByOwner)}
    />
  );
}
