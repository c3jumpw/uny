import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin";
import { computeStatus, sortByPriority } from "@/lib/subscriptionStatus";
import { CutoffButton } from "@/components/CutoffButton";

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

type UserRow = { user_id: string; email: string; is_super_admin: boolean };
type StatusRow = {
  user_id: string;
  last_payment_at: string | null;
  last_payment_failed_at: string | null;
  subscription_state: string;
  automations_active: boolean;
  cut_off_at: string | null;
};
type KeyRow = { user_id: string; revoked_at: string | null };
type EventRow = {
  user_id: string | null;
  event_type: string;
  received_at: string;
};
type ActionRow = {
  id: string;
  admin_email: string;
  target_email: string | null;
  action_type: string;
  notes: string | null;
  created_at: string;
};

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = getUserRole(user?.email);
  const isSuperAdmin = role === "super_admin";

  const [{ data: usersData }, { data: statusData }, { data: keysData }, { data: eventsData }, { data: actionsData }] =
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
    ]);

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
    const status = statusMap.get(u.user_id) ?? {
      user_id: u.user_id,
      last_payment_at: null,
      last_payment_failed_at: null,
      subscription_state: "never_paid",
      automations_active: true,
      cut_off_at: null,
    };
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
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>
          Subscription admin
        </h1>
        <p style={{ margin: 0, color: "var(--paper-dim)" }}>
          Payment status per workspace. Nothing auto-cuts &mdash; you glance daily, act on
          reds.
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
          <strong style={{ color: "var(--paper)" }}>Scope:</strong> {scopeLabel}.
        </div>
      </div>

      <StatusLegend />

      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: "1%" }}>Status</th>
              <th>Workspace</th>
              <th>Last payment</th>
              <th>API key</th>
              <th>Recent events</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: "var(--paper-dim)", textAlign: "center" }}>
                  {isSuperAdmin
                    ? "No users yet."
                    : "No client workspaces have granted you access yet."}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr key={row.user.user_id}>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: row.statusMeta.color,
                        background: row.statusMeta.bg,
                        border: `1px solid ${row.statusMeta.color}33`,
                        whiteSpace: "nowrap",
                      }}
                      title={row.statusMeta.actionHint}
                    >
                      {row.statusMeta.label}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{row.user.email}</div>
                    {row.user.is_super_admin ? (
                      <div style={{ fontSize: "0.7rem", color: "var(--amber)" }}>
                        (super admin account)
                      </div>
                    ) : null}
                  </td>
                  <td style={{ fontSize: "0.85rem", color: "var(--paper-dim)" }}>
                    {row.status.last_payment_at
                      ? new Date(row.status.last_payment_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td>
                    {row.key?.revoked_at ? (
                      <span className="pill" style={{ color: "#ffb3b3", borderColor: "rgba(240,80,80,.3)" }}>
                        Revoked
                      </span>
                    ) : (
                      <span className="pill pill-good">Active</span>
                    )}
                  </td>
                  <td style={{ fontSize: "0.75rem", color: "var(--paper-dim)" }}>
                    {row.events.length === 0 ? (
                      <span>—</span>
                    ) : (
                      row.events.map((e, i) => (
                        <div key={i}>
                          <code>{e.event_type}</code>{" "}
                          <span style={{ color: "var(--muted)" }}>
                            {new Date(e.received_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <CutoffButton
                      targetUserId={row.user.user_id}
                      targetEmail={row.user.email}
                      currentlyActive={row.status.automations_active}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem", fontWeight: 600 }}>
        Recent admin actions
      </h2>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>When</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Target</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {actions.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--paper-dim)", textAlign: "center" }}>
                  No admin actions recorded yet.
                </td>
              </tr>
            ) : (
              actions.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontSize: "0.8rem", color: "var(--paper-dim)" }}>
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>{a.admin_email}</td>
                  <td>
                    <span
                      className={
                        a.action_type === "cutoff"
                          ? "pill"
                          : "pill pill-good"
                      }
                      style={
                        a.action_type === "cutoff"
                          ? { color: "#ffb3b3", borderColor: "rgba(240,80,80,.3)" }
                          : undefined
                      }
                    >
                      {a.action_type}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>{a.target_email ?? "—"}</td>
                  <td style={{ fontSize: "0.8rem", color: "var(--paper-dim)" }}>
                    {a.notes ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatusLegend() {
  const items = [
    { label: "Active", color: "#7CC084", bg: "rgba(120,180,120,.15)" },
    { label: "Grace (0-3d)", color: "#ffd76a", bg: "rgba(200,170,50,.15)" },
    { label: "Warning (4-7d)", color: "#ffb066", bg: "rgba(200,120,40,.2)" },
    { label: "Escalated (8-14d)", color: "#ff8080", bg: "rgba(180,60,60,.25)" },
    { label: "Cutoff recommended (15d+)", color: "#ffb3b3", bg: "rgba(180,30,30,.35)" },
    { label: "Cut off", color: "#9C9488", bg: "rgba(60,60,60,.35)" },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 12,
        fontSize: "0.75rem",
      }}
    >
      {items.map((i) => (
        <span
          key={i.label}
          style={{
            padding: "3px 10px",
            borderRadius: 999,
            color: i.color,
            background: i.bg,
            border: `1px solid ${i.color}33`,
            whiteSpace: "nowrap",
          }}
        >
          {i.label}
        </span>
      ))}
    </div>
  );
}
