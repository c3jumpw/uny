import { AuthShell } from "@/components/AuthShell";
import Link from "next/link";

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: "$29.95",
    period: "/month",
    desc: "Single web apps and early-stage products. Standard processing and memory limits.",
  },
  {
    id: "premium",
    name: "Premium",
    price: "$49.95",
    period: "/month",
    desc: "Higher processing speeds and larger memory limits. Best for AI-powered and integrated workspaces that need headroom for embeddings, background jobs, and multi-service pipelines.",
  },
];

export default function StartPage() {
  return (
    <AuthShell
      title="Choose your plan"
      subtitle="Pick a plan to create your account."
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
          <Link
            key={p.id}
            href={`/signup?plan=${p.id}`}
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              padding: 16,
              border: "1px solid var(--line)",
              borderRadius: 10,
              background: "var(--ink-2)",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 4 }}>{p.name}</div>
              <div style={{ color: "var(--paper-dim)", fontSize: "0.85rem" }}>{p.desc}</div>
            </div>
            <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              <span style={{ fontWeight: 600 }}>{p.price}</span>
              <span style={{ color: "var(--paper-dim)", fontSize: "0.85rem" }}>{p.period}</span>
            </div>
          </Link>
        ))}
      </div>
    </AuthShell>
  );
}
