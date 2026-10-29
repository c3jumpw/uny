import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { computeStatus, trialState } from "@/lib/subscriptionStatus";

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

  const name = user?.email?.split("@")[0] || "there";

  const [{ data: statusRow }, { data: keyRow }] = await Promise.all([
    supabase
      .from("subscription_status")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase.from("api_keys").select("key, revoked_at").eq("user_id", user!.id).maybeSingle(),
  ]);
  const withCreated = statusRow
    ? { ...statusRow, created_at: user!.created_at }
    : null;
  const trial = withCreated ? trialState(withCreated) : null;
  const status = withCreated
    ? computeStatus(withCreated)
    : {
        label: "Never paid",
        color: "#7c7568",
        bg: "rgba(60,60,60,.15)",
        actionHint: "Awaiting first payment",
      };
  const apiKey = (keyRow as { key: string; revoked_at: string | null } | null) ?? null;

  return (
    <>
      {welcome ? <WelcomeBanner /> : null}
      {trial?.onTrial && trial.endsAt ? (
        <TrialBanner endsAt={trial.endsAt} daysLeft={trial.daysLeft ?? 0} />
      ) : null}

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>
          Welcome back, {name}.
        </h1>
        <p style={{ margin: 0, color: "var(--paper-dim)" }}>
          Your UnyBase workspace at a glance.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <div className="card">
          <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 8 }}>
            Subscription
          </div>
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
          <p style={{ color: "var(--paper-dim)", fontSize: "0.85rem", margin: 0 }}>
            {status.actionHint}
          </p>
        </div>

        <div className="card">
          <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 8 }}>
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
                  Revoked. Contact support to restore.
                </p>
              ) : (
                <p style={{ color: "var(--paper-dim)", fontSize: "0.8rem", margin: 0 }}>
                  Stub key. Production keys arrive in the credentials hub (phase 3).
                </p>
              )}
            </>
          ) : (
            <p style={{ color: "var(--paper-dim)", fontSize: "0.85rem", margin: 0 }}>
              No key issued yet.
            </p>
          )}
        </div>

        <div className="card">
          <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 8 }}>
            Domains
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: 500, marginBottom: 4 }}>—</div>
          <Link
            href="/dashboard/domains"
            style={{ color: "var(--sky)", fontSize: "0.9rem" }}
          >
            Manage domains →
          </Link>
        </div>

        <div className="card">
          <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 8 }}>Team</div>
          <div style={{ fontSize: "1.05rem", fontWeight: 500, marginBottom: 4 }}>Just you</div>
          <Link href="/dashboard/team" style={{ color: "var(--sky)", fontSize: "0.9rem" }}>
            Invite teammates →
          </Link>
        </div>

        <div className="card">
          <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 8 }}>Vault</div>
          <div style={{ fontSize: "1.05rem", fontWeight: 500, marginBottom: 4 }}>
            0 credentials
          </div>
          <Link href="/dashboard/vault" style={{ color: "var(--sky)", fontSize: "0.9rem" }}>
            Open vault →
          </Link>
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
        <Link href="/dashboard/team" className="btn btn-ghost" style={{ padding: "8px 14px" }}>
          3. Invite your developer
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
