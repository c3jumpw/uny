import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const name = user?.email?.split("@")[0] || "there";

  return (
    <>
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
          <div style={{ fontSize: "1.05rem", fontWeight: 500, marginBottom: 4 }}>
            Setup in progress
          </div>
          <p style={{ color: "var(--paper-dim)", fontSize: "0.9rem", margin: "0 0 16px" }}>
            We&apos;re rebuilding your workspace tools. Existing subscribers will be added shortly.
          </p>
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
