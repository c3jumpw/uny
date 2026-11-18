import { CutoffButton } from "@/components/CutoffButton";
import { ImportClients } from "@/components/ImportClients";
import { ExemptButton } from "@/components/ExemptButton";
import { TrialButton } from "@/components/TrialButton";
import { SystemeSyncButton } from "@/components/SystemeSyncButton";
import { SIGNUP_TAG, CUSTOMER_TAG, PAID_TAGS } from "@/lib/systeme";
import type { StatusMeta } from "@/lib/subscriptionStatus";

// The Subscriptions admin screen, given its data. /admin fetches and
// passes real rows; the tour's demo workspace (/guide/demo) passes
// sample rows, so the getting-started screenshots always show the
// screen as it really is.

export type UserRow = {
  user_id: string;
  email: string;
  is_super_admin: boolean;
  created_at?: string | null;
};
export type StatusRow = {
  user_id: string;
  billing_exempt?: boolean | null;
  exempt_reason?: string | null;
  intended_plan?: string | null;
  plan_selected_at?: string | null;
  created_at?: string | null;
  last_payment_at: string | null;
  last_payment_failed_at: string | null;
  subscription_state: string;
  automations_active: boolean;
  cut_off_at: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  trial_note?: string | null;
  trial_converted_at?: string | null;
  intended_cycle?: string | null;
  active_plan?: string | null;
  active_cycle?: string | null;
  systeme_signup_tagged_at?: string | null;
  systeme_customer_tagged_at?: string | null;
};
export type SyncRow = {
  id: string;
  email: string | null;
  action: string;
  ok: boolean;
  status_code: number | null;
  detail: string | null;
  created_at: string;
};
export type KeyRow = { user_id: string; revoked_at: string | null };
export type EventRow = {
  user_id: string | null;
  event_type: string;
  received_at: string;
};
export type ActionRow = {
  id: string;
  admin_email: string;
  target_email: string | null;
  action_type: string;
  notes: string | null;
  created_at: string;
};


export type AdminRow = {
  user: UserRow;
  status: StatusRow;
  statusMeta: StatusMeta;
  key: KeyRow | null;
  events: EventRow[];
};

export function AdminSubscriptionsView({
  rows: sorted,
  isSuperAdmin,
  scopeLabel,
  actions,
  syncLog,
  systemeOn,
  sitesByOwner,
}: {
  rows: AdminRow[];
  isSuperAdmin: boolean;
  scopeLabel: string;
  actions: ActionRow[];
  syncLog: SyncRow[];
  systemeOn: boolean;
  sitesByOwner: Record<string, number>;
}) {
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
        data-guide="admin-scope"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
          padding: "12px 16px",
          borderRadius: 10,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          flexWrap: "wrap",
        }}
      >
        <span className={isSuperAdmin ? "pill pill-good" : "pill pill-warn"}>
          {isSuperAdmin ? "Super Admin" : "Technical Admin"}
        </span>
        <div style={{ fontSize: "0.9rem", color: "var(--paper-dim)", flex: 1 }}>
          <strong style={{ color: "var(--paper)" }}>Scope:</strong> {scopeLabel}.
        </div>
        {isSuperAdmin ? <ImportClients /> : null}
      </div>

      <StatusLegend />

      <div className="card" data-guide="admin-table" style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
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
                    <PlanLine status={row.status} />
                    {isSuperAdmin && !row.status.billing_exempt ? (
                      <TagLine status={row.status} />
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
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        justifyContent: "flex-end",
                        flexWrap: "wrap",
                      }}
                    >
                      {isSuperAdmin && !row.status.billing_exempt ? (
                        <TrialButton
                          targetUserId={row.user.user_id}
                          targetEmail={row.user.email}
                          trialEndsAt={row.status.trial_ends_at ?? null}
                          trialConverted={Boolean(row.status.trial_converted_at)}
                          trialNote={row.status.trial_note ?? null}
                        />
                      ) : null}
                      {isSuperAdmin ? (
                        <ExemptButton
                          targetUserId={row.user.user_id}
                          targetEmail={row.user.email}
                          currentlyExempt={Boolean(row.status.billing_exempt)}
                          currentReason={row.status.exempt_reason ?? null}
                        />
                      ) : null}
                      <CutoffButton
                        targetUserId={row.user.user_id}
                        targetEmail={row.user.email}
                        currentlyActive={row.status.automations_active}
                        siteCount={sitesByOwner[row.user.user_id] ?? 0}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isSuperAdmin ? <SystemePanel log={syncLog} configured={systemeOn} /> : null}

      <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem", fontWeight: 600 }}>
        Recent admin actions
      </h2>
      <div className="card" data-guide="admin-actions" style={{ padding: 0, overflow: "hidden" }}>
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
                        a.action_type === "cutoff" || a.action_type === "site_paused"
                          ? "pill"
                          : "pill pill-good"
                      }
                      style={
                        a.action_type === "cutoff" || a.action_type === "site_paused"
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
    { label: "No plan chosen", color: "#8fb8d8", bg: "rgba(90,169,230,.14)" },
    { label: "On trial", color: "#6ec8d8", bg: "rgba(90,190,215,.15)" },
    { label: "Trial ended", color: "#ffb066", bg: "rgba(200,120,40,.22)" },
    { label: "Internal — no billing", color: "#b79be8", bg: "rgba(150,110,220,.15)" },
    { label: "Grace (0-3d)", color: "#ffd76a", bg: "rgba(200,170,50,.15)" },
    { label: "Warning (4-7d)", color: "#ffb066", bg: "rgba(200,120,40,.2)" },
    { label: "Escalated (8-14d)", color: "#ff8080", bg: "rgba(180,60,60,.25)" },
    { label: "Cutoff recommended (15d+)", color: "#ffb3b3", bg: "rgba(180,30,30,.35)" },
    { label: "Cut off", color: "#9C9488", bg: "rgba(60,60,60,.35)" },
  ];
  return (
    <div
      data-guide="status-legend"
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

function PlanLine({ status }: { status: StatusRow }) {
  const plan = status.active_plan || status.intended_plan;
  const cycle = status.active_cycle || status.intended_cycle;
  if (!plan && !status.trial_ends_at) return null;
  const bits: string[] = [];
  if (plan) bits.push(`${plan[0].toUpperCase()}${plan.slice(1)}${cycle ? ` · ${cycle}` : ""}${status.active_plan ? "" : " (chosen)"}`);
  if (status.trial_ends_at && !status.trial_converted_at) {
    bits.push(`trial to ${new Date(status.trial_ends_at).toLocaleDateString()}`);
  }
  if (status.trial_converted_at) bits.push("trial converted");
  return (
    <div style={{ fontSize: "0.72rem", color: "var(--paper-dim)", marginTop: 2 }}>{bits.join(" — ")}</div>
  );
}

function TagLine({ status }: { status: StatusRow }) {
  const tag = (on: boolean, label: string) => (
    <span style={{ color: on ? "#7CC084" : "var(--muted)" }}>
      {on ? "✓" : "○"} {label}
    </span>
  );
  return (
    <div style={{ fontSize: "0.7rem", marginTop: 2, display: "flex", gap: 8 }} title="systeme.io segment tags">
      {tag(Boolean(status.systeme_signup_tagged_at), "signup tag")}
      {tag(Boolean(status.systeme_customer_tagged_at), "customer tag")}
    </div>
  );
}

function SystemePanel({ log, configured }: { log: SyncRow[]; configured: boolean }) {
  return (
    <div className="card" data-guide="systeme-panel" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600 }}>systeme.io segments</div>
          <div style={{ fontSize: "0.82rem", color: "var(--paper-dim)" }}>
            {configured ? (
              <>
                Signups get <code>{SIGNUP_TAG}</code>; paying customers get <code>{CUSTOMER_TAG}</code> (and
                lose the signup tag). Payment is confirmed by the webhook, or by finding{" "}
                <code>{PAID_TAGS.join(", ")}</code> on the contact.
              </>
            ) : (
              <>
                Not connected: add <code>SYSTEME_API_KEY</code> in Vercel to start tagging. Until then, every
                tagging attempt is logged here as skipped.
              </>
            )}
          </div>
        </div>
        {configured ? <SystemeSyncButton /> : null}
      </div>
      {log.length === 0 ? (
        <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>No sync activity yet.</div>
      ) : (
        <table className="tbl" style={{ fontSize: "0.78rem" }}>
          <thead>
            <tr>
              <th>When</th>
              <th>Email</th>
              <th>Action</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {log.map((l) => (
              <tr key={l.id}>
                <td style={{ color: "var(--paper-dim)", whiteSpace: "nowrap" }}>{new Date(l.created_at).toLocaleString()}</td>
                <td>{l.email ?? "—"}</td>
                <td>
                  <code>{l.action}</code>
                </td>
                <td style={{ color: l.ok ? "#7CC084" : "#ffb066" }}>
                  {l.ok ? "ok" : "failed"}
                  {l.status_code ? ` (${l.status_code})` : ""}
                  {l.detail ? <span style={{ color: "var(--paper-dim)" }}> — {l.detail.slice(0, 120)}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
