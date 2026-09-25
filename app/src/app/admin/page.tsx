// Admin dashboard.
//
// Phase 1 (now): stubbed table with the columns from the spec so
// routing and access control are proven, and the layout is ready
// to fill in.
//
// Phase 2 (next): pull real users from Supabase, join with
// subscription events from systeme.io webhooks, enable the manual
// cutoff toggle. The cutoff decision stays human — the toggle just
// flips a flag; automated notifications tell you *when* to look.

export default function AdminPage() {
  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>
          Subscription admin
        </h1>
        <p style={{ margin: 0, color: "var(--paper-dim)" }}>
          Oversee payment status across all subscribers and manually pause automations for lapsed
          accounts.
        </p>
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
                No subscriber data yet. Systeme.io webhook events will populate this table.
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
        <strong style={{ color: "var(--paper)" }}>Phase 2 (next):</strong> live Supabase user list,
        systeme.io payment events joined per user, alerts on payment lapse (delivered via email),
        activity log, and the manual &ldquo;pause automations&rdquo; toggle. The cutoff decision
        stays in your hands — this dashboard flags who to review, but never acts without you.
      </div>
    </>
  );
}
