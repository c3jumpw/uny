import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { computeStatus, signupState } from "@/lib/subscriptionStatus";

export default async function DashboardPage() {
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
  const signup = withCreated
    ? signupState(withCreated)
    : { incomplete: false, daysSinceSignup: null, nudgeStep: null };
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
      {signup.incomplete ? (
        <div
          style={{
            marginBottom: 24,
            padding: "16px 18px",
            borderRadius: 10,
            background: "rgba(90,169,230,.1)",
            border: "1px solid rgba(90,169,230,.3)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            You haven&apos;t chosen a plan yet
          </div>
          <p
            style={{
              margin: "0 0 12px",
              color: "var(--paper-dim)",
              fontSize: "0.9rem",
              lineHeight: 1.6,
            }}
          >
            Your account is set up
            {signup.daysSinceSignup !== null && signup.daysSinceSignup > 0
              ? ` (${signup.daysSinceSignup} day${
                  signup.daysSinceSignup === 1 ? "" : "s"
                } ago)`
              : ""}
            , but your workspace won&apos;t be active until you pick a plan. It takes about
            a minute.
          </p>
          <Link href="/start" className="btn btn-amber" style={{ padding: "9px 18px" }}>
            Choose your plan
          </Link>
        </div>
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
