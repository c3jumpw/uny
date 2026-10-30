import Link from "next/link";

// The dashboard overview, as a pure view. The page fetches the
// numbers; this renders them. Kept separate so the user guide can
// show exactly what people see, with demo numbers.

export type OverviewData = {
  name: string;
  welcome: boolean;
  status: { label: string; color: string; bg: string; actionHint: string };
  trial: { endsAt: string; daysLeft: number } | null;
  apiKey: { key: string; revoked_at: string | null } | null;
  vault: { total: number; attention: number };
  domains: { total: number; next: { name: string; label: string; color: string } | null };
  changes: { open: number; pending: number };
};

const cardLabel: React.CSSProperties = { color: "var(--muted)", fontSize: "0.85rem", marginBottom: 8 };
const bigNumber: React.CSSProperties = { fontSize: "1.05rem", fontWeight: 500, marginBottom: 4 };
const cardLink: React.CSSProperties = { color: "var(--sky)", fontSize: "0.9rem" };

export function OverviewView({ data }: { data: OverviewData }) {
  const { status, apiKey, vault, domains, changes } = data;
  return (
    <>
      {data.welcome ? <WelcomeBanner /> : null}
      {data.trial ? <TrialBanner endsAt={data.trial.endsAt} daysLeft={data.trial.daysLeft} /> : null}

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>Welcome back, {data.name}.</h1>
        <p style={{ margin: 0, color: "var(--paper-dim)" }}>Your UnyBase workspace at a glance.</p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <div className="card" data-guide="subscription">
          <div style={cardLabel}>Subscription</div>
          <div style={{ marginBottom: 8 }}>
            <span
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: "0.75rem",
                fontWeight: 600,
                color: status.color,
                background: status.bg,
                border: `1px solid ${status.color}33`,
              }}
            >
              {status.label}
            </span>
          </div>
          <p style={{ color: "var(--paper-dim)", fontSize: "0.85rem", margin: 0 }}>{status.actionHint}</p>
        </div>

        <div className="card" data-guide="vault-card">
          <div style={cardLabel}>Vault</div>
          <div style={bigNumber}>
            {vault.total === 0
              ? "No credentials yet"
              : `${vault.total} credential${vault.total === 1 ? "" : "s"}`}
          </div>
          {vault.attention > 0 ? (
            <div style={{ color: "#ffb066", fontSize: "0.85rem", marginBottom: 4 }}>
              {vault.attention} need{vault.attention === 1 ? "s" : ""} attention
            </div>
          ) : vault.total > 0 ? (
            <div style={{ color: "#7CC084", fontSize: "0.85rem", marginBottom: 4 }}>All healthy</div>
          ) : null}
          <Link href="/dashboard/vault" style={cardLink}>
            {vault.total === 0 ? "Add your first credential →" : "Open vault →"}
          </Link>
        </div>

        <div className="card" data-guide="domains-card">
          <div style={cardLabel}>Domains</div>
          <div style={bigNumber}>
            {domains.total === 0 ? "None tracked yet" : `${domains.total} domain${domains.total === 1 ? "" : "s"}`}
          </div>
          {domains.next ? (
            <div style={{ fontSize: "0.85rem", marginBottom: 4 }}>
              <span style={{ color: "var(--paper-dim)" }}>{domains.next.name}: </span>
              <span style={{ color: domains.next.color }}>{domains.next.label}</span>
            </div>
          ) : null}
          <Link href="/dashboard/domains" style={cardLink}>
            {domains.total === 0 ? "Add a domain →" : "Manage domains →"}
          </Link>
        </div>

        <div className="card" data-guide="changes-card">
          <div style={cardLabel}>Change requests</div>
          <div style={bigNumber}>
            {changes.open === 0 ? "Nothing open" : `${changes.open} open`}
          </div>
          {changes.pending > 0 ? (
            <div style={{ color: "var(--paper-dim)", fontSize: "0.85rem", marginBottom: 4 }}>
              {changes.pending} not sent to your developer yet
            </div>
          ) : null}
          <Link href="/dashboard/changes" style={cardLink}>
            {changes.open === 0 ? "Log a change →" : "Open backlog →"}
          </Link>
        </div>

        <div className="card" data-guide="guide-card">
          <div style={cardLabel}>New to UnyBase?</div>
          <div style={bigNumber}>The visual guide</div>
          <div style={{ color: "var(--paper-dim)", fontSize: "0.85rem", marginBottom: 4 }}>
            Every page and button, with screenshots.
          </div>
          <Link href="/guide" style={cardLink}>
            Take the 10-minute tour →
          </Link>
        </div>

        <div className="card" data-guide="apikey-card">
          <div style={cardLabel}>
            API key <span style={{ color: "var(--amber)" }}>(preview)</span>
          </div>
          {apiKey ? (
            <>
              <div
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: "0.8rem",
                  wordBreak: "break-all",
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "var(--ink-2)",
                  border: "1px solid var(--line)",
                  marginBottom: 8,
                  opacity: apiKey.revoked_at ? 0.4 : 1,
                }}
              >
                {apiKey.key}
              </div>
              {apiKey.revoked_at ? (
                <p style={{ color: "#ffb3b3", fontSize: "0.8rem", margin: 0 }}>
                  Paused. It starts working again as soon as your account is back in good standing.
                </p>
              ) : (
                <p style={{ color: "var(--paper-dim)", fontSize: "0.8rem", margin: 0 }}>
                  Your workspace key. API access is in preview; keep it private.
                </p>
              )}
            </>
          ) : (
            <p style={{ color: "var(--paper-dim)", fontSize: "0.85rem", margin: 0 }}>No key issued yet.</p>
          )}
        </div>
      </div>
    </>
  );
}

function WelcomeBanner() {
  return (
    <div
      role="status"
      style={{
        marginBottom: 24,
        padding: "16px 18px",
        borderRadius: 10,
        background: "rgba(120,180,120,.1)",
        border: "1px solid rgba(120,180,120,.35)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Payment confirmed — your workspace is live 🎉</div>
      <p style={{ margin: "0 0 10px", color: "var(--paper-dim)", fontSize: "0.9rem", lineHeight: 1.6 }}>
        A confirmation is on its way to your inbox. Three good first steps:
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href="/dashboard/vault" className="btn btn-amber" style={{ padding: "8px 14px" }}>
          1. Add a credential
        </Link>
        <Link href="/dashboard/domains" className="btn btn-ghost" style={{ padding: "8px 14px" }}>
          2. Add your domains
        </Link>
        <Link href="/guide" className="btn btn-ghost" style={{ padding: "8px 14px" }}>
          3. Read the guide
        </Link>
      </div>
    </div>
  );
}

function TrialBanner({ endsAt, daysLeft }: { endsAt: string; daysLeft: number }) {
  const soon = daysLeft <= 3;
  return (
    <div
      style={{
        marginBottom: 24,
        padding: "16px 18px",
        borderRadius: 10,
        background: soon ? "rgba(242,169,59,.1)" : "rgba(90,190,215,.08)",
        border: `1px solid ${soon ? "rgba(242,169,59,.35)" : "rgba(90,190,215,.3)"}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          You&apos;re on a trial until{" "}
          {new Date(endsAt).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          {` (${daysLeft} day${daysLeft === 1 ? "" : "s"} left)`}
        </div>
        <p style={{ margin: 0, color: "var(--paper-dim)", fontSize: "0.88rem", lineHeight: 1.6 }}>
          Full access, nothing to pay. When it ends you&apos;ll be asked to choose a plan at login &mdash; nothing
          you&apos;ve added is deleted.
        </p>
      </div>
      <Link href="/plans" className={soon ? "btn btn-amber" : "btn btn-ghost"} style={{ padding: "9px 18px" }}>
        Choose a plan
      </Link>
    </div>
  );
}
