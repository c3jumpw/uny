import { createClient } from "@/lib/supabase/server";
import { computeStatus, trialState } from "@/lib/subscriptionStatus";
import { expiryState, type HealthStatus } from "@/lib/integrations";
import { OverviewView } from "@/components/OverviewView";

// Overview: real counts from the workspace, rendered by OverviewView
// (which the user guide also uses, with demo numbers).
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: statusRow }, { data: keyRow }, { data: creds }, { data: doms }, { data: changes }] =
    await Promise.all([
      supabase.from("subscription_status").select("*").eq("user_id", user!.id).maybeSingle(),
      supabase.from("api_keys").select("key, revoked_at").eq("user_id", user!.id).maybeSingle(),
      supabase
        .from("integrations")
        .select("health_status, expires_at")
        .eq("workspace_owner_id", user!.id),
      supabase
        .from("domains")
        .select("domain_name, expires_at, ssl_expires_at")
        .eq("workspace_owner_id", user!.id),
      supabase.from("change_requests").select("status").eq("workspace_owner_id", user!.id),
    ]);

  const withCreated = statusRow ? { ...statusRow, created_at: user!.created_at } : null;
  const trial = withCreated ? trialState(withCreated) : null;
  const status = withCreated
    ? computeStatus(withCreated)
    : { label: "Never paid", color: "#7c7568", bg: "rgba(60,60,60,.15)", actionHint: "Awaiting first payment" };

  const credRows = (creds as Array<{ health_status: HealthStatus; expires_at: string | null }> | null) ?? [];
  const attention = credRows.filter(
    (c) => c.health_status === "failed" || c.health_status === "degraded" || expiryState(c.expires_at).urgent
  ).length;

  // Soonest renewal across domain and SSL dates.
  const domRows =
    (doms as Array<{ domain_name: string; expires_at: string | null; ssl_expires_at: string | null }> | null) ?? [];
  let next: { name: string; label: string; color: string; at: number } | null = null;
  for (const d of domRows) {
    for (const [at, what] of [
      [d.expires_at, "renews"],
      [d.ssl_expires_at, "SSL"],
    ] as const) {
      if (!at) continue;
      const t = new Date(at).getTime();
      if (!next || t < next.at) {
        const e = expiryState(at);
        next = {
          name: d.domain_name,
          label: what === "SSL" ? `SSL ${e.label.toLowerCase()}` : e.label.replace("Expires", "Renews"),
          color: e.color,
          at: t,
        };
      }
    }
  }

  const changeRows = (changes as Array<{ status: string }> | null) ?? [];

  return (
    <OverviewView
      data={{
        name: user?.email?.split("@")[0] || "there",
        welcome: Boolean(welcome),
        status,
        trial: trial?.onTrial && trial.endsAt ? { endsAt: trial.endsAt, daysLeft: trial.daysLeft ?? 0 } : null,
        apiKey: (keyRow as { key: string; revoked_at: string | null } | null) ?? null,
        vault: { total: credRows.length, attention },
        domains: { total: domRows.length, next: next ? { name: next.name, label: next.label, color: next.color } : null },
        changes: {
          open: changeRows.filter((c) => c.status === "pending" || c.status === "sent").length,
          pending: changeRows.filter((c) => c.status === "pending").length,
        },
      }}
    />
  );
}
