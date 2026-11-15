import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin";
import { computeStatus, type StatusRow } from "@/lib/subscriptionStatus";
import { BUILDER_PROMPT, BUILDER_PROMPT_VERSION } from "@/lib/builderPrompt";
import { SitesClient, type SiteView } from "@/components/SitesClient";

// Admin → Client sites: the kill switch for apps Unywebs builds.
//
// Each row is one client app. Its state comes from the SQL view
// licensed_sites_admin (licensed_site_state()), the same function the
// public /api/license/status endpoint uses, so what this page shows is
// exactly what the client app is told.

export const dynamic = "force-dynamic";

type ViewRow = {
  id: string;
  owner_id: string | null;
  site_name: string;
  client_name: string | null;
  domain: string | null;
  notes: string | null;
  key_prefix: string;
  status_override: "auto" | "paused" | "active";
  override_reason: string | null;
  override_set_at: string | null;
  created_at: string;
  last_checked_at: string | null;
  last_check_origin: string | null;
  key_rotated_at: string | null;
  revoked_at: string | null;
  effective_status: "active" | "grace" | "paused" | "retired" | null;
};

type UserRow = { user_id: string; email: string; created_at?: string | null };

export default async function ClientSitesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (getUserRole(user?.email) !== "super_admin") {
    return (
      <div className="card">
        <h1 style={{ margin: "0 0 6px", fontSize: "1.3rem" }}>Client sites</h1>
        <p style={{ margin: 0, color: "var(--paper-dim)" }}>
          Only a super admin can see and switch client sites.
        </p>
      </div>
    );
  }

  const [sitesRes, { data: usersData }, { data: statusData }] = await Promise.all([
    supabase
      .from("licensed_sites_admin")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.rpc("list_visible_users_for_admin"),
    supabase.from("subscription_status").select("*"),
  ]);

  const users = (usersData as UserRow[] | null) ?? [];
  const emailById = new Map(users.map((u) => [u.user_id, u.email]));
  const createdById = new Map(users.map((u) => [u.user_id, u.created_at ?? null]));
  const statusById = new Map(
    ((statusData as StatusRow[] | null) ?? []).map((s) => [s.user_id, s])
  );

  const accounts = users
    .map((u) => u.email)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const sites: SiteView[] = ((sitesRes.data as ViewRow[] | null) ?? []).map((s) => {
    const st = s.owner_id ? statusById.get(s.owner_id) : undefined;
    const meta = st
      ? computeStatus({ ...st, created_at: createdById.get(s.owner_id!) ?? null })
      : null;
    return {
      id: s.id,
      siteName: s.site_name,
      clientName: s.client_name,
      domain: s.domain,
      notes: s.notes,
      keyPrefix: s.key_prefix,
      mode: s.status_override,
      overrideReason: s.override_reason,
      overrideSetAt: s.override_set_at,
      createdAt: s.created_at,
      lastCheckedAt: s.last_checked_at,
      lastCheckOrigin: s.last_check_origin,
      keyRotatedAt: s.key_rotated_at,
      retiredAt: s.revoked_at,
      state: s.effective_status ?? "active",
      ownerEmail: s.owner_id ? emailById.get(s.owner_id) ?? "(account not visible)" : null,
      account: meta ? { label: meta.label, color: meta.color, bg: meta.bg, hint: meta.actionHint } : null,
    };
  });

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>Client sites</h1>
        <p style={{ margin: 0, color: "var(--paper-dim)", maxWidth: 760 }}>
          Every app Unywebs builds checks in here about once a minute. Pause one and its visitors see a
          neutral &ldquo;temporarily unavailable&rdquo; page within a minute. Nothing is deleted, webhooks keep
          running, and switching it back is just as quick. Nothing pauses on its own: a failed payment only
          moves a site to <em>grace</em>.
        </p>
      </div>

      {sitesRes.error ? (
        <div className="card" style={{ borderColor: "rgba(242,169,59,.45)" }}>
          <strong>The database update for client sites isn&rsquo;t applied yet.</strong>
          <p style={{ margin: "6px 0 0", color: "var(--paper-dim)", fontSize: "0.9rem" }}>
            Apply migration <code>20261115_phase11_licensed_sites_admin.sql</code>, then reload this page.
          </p>
        </div>
      ) : (
        <SitesClient
          sites={sites}
          accounts={accounts}
          prompt={BUILDER_PROMPT}
          promptVersion={BUILDER_PROMPT_VERSION}
        />
      )}
    </>
  );
}
