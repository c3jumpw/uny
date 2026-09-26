import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin";

// Admin dashboard.
//
// Phase 1 (now): scaffolded table with role-aware framing.
//   - Super admin sees the full platform (empty until phase 2 wires data)
//   - Technical admin sees only workspaces they've been granted access to
//     (empty until phase 2 wires the technical_admin_grants table)
//
// Phase 2 (next): pull real users from Supabase, join with subscription
// events from systeme.io webhooks, enable the manual cutoff toggle.
// The cutoff decision stays human — the toggle just flips a flag;
// automated notifications tell you *when* to look.

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = getUserRole(user?.email);

  const isSuperAdmin = role === "super_admin";

  const scopeLabel = isSuperAdmin
    ? "Every workspace on the platform"
    : "Workspaces you've been granted access to";

  const scopeHint = isSuperAdmin
    ? "As Super Admin, you see the full platform: every subscriber, every subscription, every integration."
    : "As Technical Admin, you see only client accounts that have granted you access. Clients grant access from their own workspace settings.";

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>
          Subscription admin
        </h1>
        <p style={{ margin: 0, color: "var(--paper-dim)" }}>
          Oversee payment status across subscribers and manually pause automations for lapsed
          accounts.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
          padding: "12px 16px",
          borderRadius: 10,
          background: "var(--surface)",
          border: "1px solid var(--line)",
        }}
      >
        <span className={isSuperAdmin ? "pill pill-good" : "pill pill-warn"}>
          {isSuperAdmin ? "Super Admin" : "Technical Admin"}
        </span>
        <div style={{ fontSize: "0.9rem", color: "var(--paper-dim)" }}>
          <strong style={{ color: "var(--paper)" }}>Scope:</strong> {scopeLabel}.{" "}
          <span style={{ color: "var(--muted)" }}>{scopeHint}</span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>User</th>
              <th>Subscription</th>
              <th>Last payment</th>
              <th>Connected tools</th>
              <th style={{ textAlign: "right" }}>Automations</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} style={{ color: "var(--paper-dim)", textAlign: "center" }}>
                {isSuperAdmin
                  ? "No subscriber data yet. Systeme.io webhook events will populate this table."
                  : "No client workspaces have granted you access yet."}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 20,
          padding: "14px 16px",
          borderRadius: 10,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          color: "var(--paper-dim)",
          fontSize: "0.9rem",
        }}
      >
        <strong style={{ color: "var(--paper)" }}>Phase 2 (next):</strong> live Supabase user
        list, systeme.io payment events joined per user, alerts on payment lapse (delivered via
        email), activity log, and the manual &ldquo;pause automations&rdquo; toggle. The cutoff
        decision stays in your hands &mdash; this dashboard flags who to review, but never acts
        without you. Client-to-technical-admin access grants will be surfaced here as well.
      </div>
    </>
  );
}
