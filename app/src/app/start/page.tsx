import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { PLANS, formatPrice, yearlySaving } from "@/lib/plans";

export default function StartPage() {
  return (
    <AuthShell
      title="Choose your plan"
      subtitle="Pick a plan and billing cycle, then create your account. You'll confirm your email and check out after."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--sky)" }}>
            Log in
          </Link>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {PLANS.map((p) => (
          <div
            key={p.id}
            style={{
              padding: 16,
              border: "1px solid var(--line)",
              borderRadius: 10,
              background: "var(--ink-2)",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 4 }}>{p.name}</div>
            <div style={{ color: "var(--paper-dim)", fontSize: "0.85rem", marginBottom: 12 }}>{p.tagline}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Link
                href={`/signup?plan=${p.id}&cycle=monthly`}
                className="btn btn-ghost"
                style={{ textAlign: "center", padding: "8px 10px", fontSize: "0.85rem" }}
              >
                {formatPrice(p.monthly)}/mo
              </Link>
              <Link
                href={`/signup?plan=${p.id}&cycle=yearly`}
                className="btn btn-amber"
                style={{ textAlign: "center", padding: "8px 10px", fontSize: "0.85rem" }}
              >
                {formatPrice(p.yearly)}/yr · save {formatPrice(yearlySaving(p))}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </AuthShell>
  );
}
